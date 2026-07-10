import { NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ingestInboundMessage } from '@/lib/inbound/ingest-core'

// Telegram delivers updates as POSTs authenticated by a per-account
// secret we set via setWebhook. Unlike Meta's HMAC signature, Telegram
// echoes the raw secret back in a header (`X-Telegram-Bot-Api-Secret-
// Token`); we match it against `telegram_config.secret_token`, which
// both authenticates the request AND routes it to the right account.
export const maxDuration = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

interface TelegramUser {
  id: number
  is_bot: boolean
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramChat {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConfigRow = any

function displayName(msg: TelegramMessage): string {
  const from = msg.from
  const full = [from?.first_name, from?.last_name].filter(Boolean).join(' ').trim()
  return (
    full ||
    from?.username ||
    msg.chat.title ||
    msg.chat.username ||
    String(msg.chat.id)
  )
}

// POST — receive Telegram updates.
export async function POST(request: Request) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!secret) {
    // No secret header → not a legitimate Telegram delivery for us.
    return NextResponse.json({ error: 'Missing secret token' }, { status: 401 })
  }

  // Resolve the account by the shared secret. One indexed lookup; the
  // secret is unique per account (see migration 036).
  const { data: config, error: configError } = await supabaseAdmin()
    .from('telegram_config')
    .select('*')
    .eq('secret_token', secret)
    .maybeSingle()

  if (configError) {
    console.error('[telegram webhook] error looking up config by secret:', configError)
    // Ack anyway so Telegram doesn't hammer retries on a transient DB blip.
    return NextResponse.json({ status: 'ignored' }, { status: 200 })
  }
  if (!config) {
    console.warn('[telegram webhook] rejected update with unknown secret token')
    return NextResponse.json({ error: 'Invalid secret token' }, { status: 401 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Same after()-based deferred processing as the WhatsApp / meta-omni
  // webhooks: ack Telegram fast, keep the function alive until DB writes
  // land.
  after(async () => {
    try {
      await processUpdate(config, update)
    } catch (error) {
      console.error('[telegram webhook] error processing update:', error)
    }
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function processUpdate(config: ConfigRow, update: TelegramUpdate): Promise<void> {
  const msg = update.message ?? update.edited_message
  if (!msg) return
  // Ignore messages from bots (our own echoes, other bots) and anything
  // without plain text — attachments/commands are out of scope for now.
  if (msg.from?.is_bot) return
  if (!msg.text) return

  const chatId = String(msg.chat.id)

  console.log(
    `[telegram webhook] inbound text from chat ${chatId} on bot @${config.bot_username ?? config.bot_id}`,
  )

  await ingestInboundMessage({
    accountId: config.account_id,
    configOwnerUserId: config.user_id,
    channel: 'telegram',
    identity: { kind: 'channel_identity', channel: 'telegram', externalId: chatId },
    contactName: displayName(msg),
    contentType: 'text',
    contentText: msg.text,
    externalMessageId: String(msg.message_id),
    createdAt: new Date(msg.date * 1000).toISOString(),
  })
}
