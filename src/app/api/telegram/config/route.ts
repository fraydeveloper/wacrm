import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getMe, setWebhook, deleteWebhook } from '@/lib/telegram/api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'

/** Mirrors src/app/api/messenger/config/route.ts's resolveAccountId. */
async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/**
 * Public HTTPS origin Telegram should POST updates to. Telegram rejects
 * non-HTTPS and localhost webhooks outright, so we prefer an explicit
 * `NEXT_PUBLIC_SITE_URL` and fall back to the reverse-proxy headers a
 * production deploy always sets. Returns null when we can't derive a
 * usable https origin (e.g. local dev with no tunnel).
 */
function resolvePublicOrigin(request: Request): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (explicit) {
    const url = explicit.replace(/\/+$/, '')
    return url.startsWith('https://') ? url : null
  }
  const fwdHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const fwdProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  if (fwdHost && (fwdProto ?? 'https') === 'https') {
    return `https://${fwdHost}`
  }
  const host = request.headers.get('host')?.trim()
  if (host) {
    const proto = new URL(request.url).protocol.replace(':', '')
    if (proto === 'https') return `https://${host}`
  }
  return null
}

/**
 * GET /api/telegram/config
 *
 * Health check — decrypts the bot token and pings getMe. Mirrors
 * /api/messenger/config's `{ connected, reason }` shape so the settings
 * UI can render a specific message rather than a generic error.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { connected: false, reason: 'no_account', message: 'Your profile is not linked to an account.' },
        { status: 200 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('telegram_config')
      .select('bot_token, bot_username, status')
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) {
      console.error('Error fetching telegram_config:', configError)
      return NextResponse.json(
        { connected: false, reason: 'db_error', message: 'Failed to fetch configuration' },
        { status: 200 },
      )
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message: 'No Telegram configuration saved yet. Paste your bot token and click Save.',
        },
        { status: 200 },
      )
    }

    let botToken: string
    try {
      botToken = decrypt(config.bot_token)
    } catch (err) {
      console.error('[telegram/config GET] Token decryption failed:', err)
      return NextResponse.json(
        {
          connected: false,
          reason: 'token_corrupted',
          needs_reset: true,
          message:
            'The stored bot token cannot be decrypted with the current ENCRYPTION_KEY. Click "Reset" below, then re-save.',
        },
        { status: 200 },
      )
    }

    try {
      const info = await getMe(botToken)
      return NextResponse.json({
        connected: true,
        bot_info: { id: info.id, username: info.username ?? config.bot_username },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Telegram API error'
      console.error('[telegram/config GET] Telegram API verification failed:', message)
      return NextResponse.json(
        { connected: false, reason: 'telegram_api_error', message: `Telegram rejected the token: ${message}` },
        { status: 200 },
      )
    }
  } catch (error) {
    console.error('Error in Telegram config GET:', error)
    return NextResponse.json(
      { connected: false, reason: 'unknown', message: 'Internal server error' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/telegram/config
 *
 * Saves the bot token, validates it with getMe, registers the webhook
 * (setWebhook with a fresh per-account secret), then stores the encrypted
 * token. RLS enforces admin+ on the write.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const botToken = typeof body?.bot_token === 'string' ? body.bot_token.trim() : ''
    if (!botToken) {
      return NextResponse.json({ error: 'bot_token is required' }, { status: 400 })
    }

    // Validate the token with Telegram before doing anything else.
    let info
    try {
      info = await getMe(botToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Telegram API error'
      return NextResponse.json({ error: `Telegram error: ${message}` }, { status: 400 })
    }

    // Reject if another account already connected this same bot — its
    // webhook can only point at one place, so sharing it would break one
    // of them. Same one-bot-per-account rationale as messenger's page_id.
    const botId = String(info.id)
    const { data: claimed, error: claimedError } = await supabaseAdmin()
      .from('telegram_config')
      .select('account_id')
      .eq('bot_id', botId)
      .neq('account_id', accountId)
      .maybeSingle()
    if (claimedError) {
      console.error('Error checking bot_id ownership:', claimedError)
      return NextResponse.json({ error: 'Failed to validate configuration' }, { status: 500 })
    }
    if (claimed) {
      return NextResponse.json(
        { error: 'This Telegram bot is already connected to another account on this instance.' },
        { status: 409 },
      )
    }

    // We need a public HTTPS URL to register the webhook. In local dev
    // without a tunnel this can't work — say so clearly.
    const origin = resolvePublicOrigin(request)
    if (!origin) {
      return NextResponse.json(
        {
          error:
            'Telegram needs a public HTTPS URL for the webhook. Set NEXT_PUBLIC_SITE_URL to your deployed https domain (Telegram rejects http/localhost).',
        },
        { status: 400 },
      )
    }
    const webhookUrl = `${origin}/api/telegram/webhook`

    // Fresh shared secret for this connection. Telegram echoes it back in
    // a header on every update; the webhook matches it to find the account.
    const secretToken = randomBytes(24).toString('hex')

    try {
      await setWebhook({ botToken, url: webhookUrl, secretToken })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Telegram API error'
      console.error('setWebhook failed:', message)
      return NextResponse.json({ error: `Could not register webhook: ${message}` }, { status: 400 })
    }

    let encryptedToken: string
    try {
      encryptedToken = encrypt(botToken)
    } catch (err) {
      console.error('Encryption failed:', err)
      return NextResponse.json(
        {
          error:
            'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string.',
        },
        { status: 500 },
      )
    }

    const baseRow = {
      bot_token: encryptedToken,
      bot_username: info.username ?? null,
      bot_id: botId,
      secret_token: secretToken,
      status: 'connected',
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('telegram_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    if (existing) {
      const { error: updateError } = await supabase
        .from('telegram_config')
        .update(baseRow)
        .eq('account_id', accountId)
      if (updateError) {
        console.error('Error updating telegram_config:', updateError)
        return NextResponse.json({ error: 'Failed to update configuration' }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('telegram_config')
        .insert({ account_id: accountId, user_id: user.id, ...baseRow })
      if (insertError) {
        console.error('Error inserting telegram_config:', insertError)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      saved: true,
      bot_info: { id: info.id, username: info.username },
    })
  } catch (error) {
    console.error('Error in Telegram config POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/telegram/config
 *
 * Deregisters the webhook (best-effort) and removes the config row.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 })
    }

    // Best-effort: tell Telegram to stop delivering before we drop the row.
    const { data: config } = await supabase
      .from('telegram_config')
      .select('bot_token')
      .eq('account_id', accountId)
      .maybeSingle()
    if (config?.bot_token) {
      try {
        await deleteWebhook(decrypt(config.bot_token))
      } catch (err) {
        console.warn('[telegram/config DELETE] deleteWebhook failed (non-fatal):', err)
      }
    }

    const { error: deleteError } = await supabase
      .from('telegram_config')
      .delete()
      .eq('account_id', accountId)
    if (deleteError) {
      console.error('Error deleting telegram_config:', deleteError)
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in Telegram config DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
