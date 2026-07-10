import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { verifyMetaWebhookSignature } from '@/lib/whatsapp/webhook-signature'
import { ingestInboundMessage } from '@/lib/inbound/ingest-core'

// Currently handles Messenger only (object === 'page'). Instagram Direct
// shares this same Graph API webhook shape (object === 'instagram') and
// is intentionally not wired up yet — a future change adds an `object`
// branch here plus an `instagram_config` table, following the same
// pattern as messenger_config below.
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

interface MessengerAttachment {
  type: string
  payload?: { url?: string }
}

interface MessengerMessagingItem {
  sender: { id: string }
  recipient: { id: string }
  timestamp: number
  message?: {
    mid: string
    text?: string
    attachments?: MessengerAttachment[]
    is_echo?: boolean
  }
}

interface MessengerWebhookEntry {
  id: string // Page ID
  time: number
  messaging?: MessengerMessagingItem[]
}

interface MessengerWebhookBody {
  object?: string
  entry?: MessengerWebhookEntry[]
}

// GET - webhook verification (same challenge-echo contract as Meta's
// other products; see src/app/api/whatsapp/webhook/route.ts).
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json({ error: 'Missing verification parameters' }, { status: 400 })
    }

    const { data: configs, error: configError } = await supabaseAdmin()
      .from('messenger_config')
      .select('id, verify_token')

    if (configError || !configs) {
      console.error('[meta-omni webhook] Error fetching configs for verification:', configError)
      return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
    }

    for (const config of configs) {
      if (!config.verify_token) continue
      try {
        if (decrypt(config.verify_token) === verifyToken) {
          return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' },
          })
        }
      } catch {
        // Malformed / wrong-key token row — skip it and keep checking.
      }
    }

    return NextResponse.json({ error: 'Verification token mismatch' }, { status: 403 })
  } catch (error) {
    console.error('[meta-omni webhook] Error in GET verification:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - receive Messenger events.
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')

  if (!verifyMetaWebhookSignature(rawBody, signature)) {
    // The single most common reason Messenger "doesn't respond" while
    // WhatsApp works: the Facebook Page and the WhatsApp number live in
    // DIFFERENT Meta apps, so this POST is signed with a different App
    // Secret than the one in META_APP_SECRET — every Messenger event is
    // dropped here before it ever reaches the AI. Put both products under
    // the same Meta app (or point META_APP_SECRET at the app that owns
    // the Page). See docs/messenger-troubleshooting.md.
    console.warn(
      '[meta-omni webhook] rejected request with invalid signature — ' +
        'the signing App Secret does not match META_APP_SECRET. Confirm the ' +
        'Facebook Page and WhatsApp number are in the SAME Meta app.',
    )
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let body: MessengerWebhookBody
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Same after()-based deferred processing as the WhatsApp webhook, and
  // for the same reason: ack Meta fast, but keep the function alive
  // (via `after()`) until DB writes actually land — see issue #301.
  after(async () => {
    try {
      await processWebhook(body)
    } catch (error) {
      console.error('[meta-omni webhook] Error processing webhook:', error)
    }
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processWebhook(body: MessengerWebhookBody) {
  // Only Messenger is wired up right now — see the module comment above.
  if (body.object !== 'page' || !body.entry) return

  for (const entry of body.entry) {
    const pageId = entry.id

    const { data: configRows, error: configError } = await supabaseAdmin()
      .from('messenger_config')
      .select('*')
      .eq('page_id', pageId)

    if (configError) {
      console.error('[meta-omni webhook] Error fetching messenger_config for page_id:', pageId, configError)
      continue
    }
    if (!configRows || configRows.length === 0) {
      console.error('[meta-omni webhook] No config found for page_id:', pageId)
      continue
    }
    if (configRows.length > 1) {
      // Shouldn't happen — messenger_config.page_id is UNIQUE — but
      // fail loudly rather than pick one arbitrarily, mirroring the
      // WhatsApp webhook's handling of the same edge case.
      console.error(
        `[meta-omni webhook] Multiple configs (${configRows.length}) found for page_id:`,
        pageId,
        '— inbound message dropped.',
      )
      continue
    }
    const config = configRows[0]

    for (const item of entry.messaging ?? []) {
      // Echoes are our own outbound messages bounced back to the
      // webhook (when "Send API" events are subscribed) — never an
      // inbound customer message. Attachments/postbacks/quick replies
      // are out of scope for this first pass; only plain text lands.
      if (item.message?.is_echo) continue
      if (!item.message?.text) continue

      // Breadcrumb so "Messenger isn't responding" is diagnosable from
      // the server logs: if you DON'T see this line when you send a
      // message, the event never reached the app (webhook not subscribed
      // to the `messages` field, or signature rejected above). If you DO
      // see it but no reply goes out, the issue is downstream (AI paused
      // for Messenger, or the Send API rejecting the outbound).
      console.log(
        `[meta-omni webhook] inbound Messenger text from PSID ${item.sender.id} on page ${pageId}`,
      )

      await ingestInboundMessage({
        accountId: config.account_id,
        configOwnerUserId: config.user_id,
        channel: 'messenger',
        identity: { kind: 'channel_identity', channel: 'messenger', externalId: item.sender.id },
        contactName: item.sender.id, // Messenger's webhook carries no profile name; PSID stands in until an agent renames the contact.
        contentType: 'text',
        contentText: item.message.text,
        externalMessageId: item.message.mid,
        createdAt: new Date(item.timestamp).toISOString(),
      })
    }
  }
}
