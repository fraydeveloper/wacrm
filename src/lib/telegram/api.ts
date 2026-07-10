/**
 * Telegram Bot API helpers.
 *
 * Same named-params style as src/lib/messenger/api.ts / meta-api.ts, for
 * the same reason: a typo in argument order should be a TypeScript error,
 * not a runtime API rejection.
 *
 * The bot token itself is the path secret in Telegram's API
 * (`/bot<token>/<method>`), so it never travels in a header or body.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org'

interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
}

async function callTelegram<T>(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/${method}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: TelegramApiResponse<T>
  try {
    data = (await res.json()) as TelegramApiResponse<T>
  } catch {
    throw new Error(`Telegram API error: ${res.status}`)
  }
  if (!data.ok || data.result === undefined) {
    // Telegram's `description` is human-readable ("Unauthorized",
    // "chat not found", ...) — surface it so the settings UI / logs can
    // show exactly why a call failed.
    throw new Error(data.description || `Telegram API error: ${res.status}`)
  }
  return data.result
}

export interface TelegramBotInfo {
  id: number
  is_bot: boolean
  first_name: string
  username?: string
}

/**
 * Validate a bot token by fetching the bot's own identity. Confirms the
 * token is valid and returns the bot id + username for display/echo
 * filtering. https://core.telegram.org/bots/api#getme
 */
export async function getMe(botToken: string): Promise<TelegramBotInfo> {
  return callTelegram<TelegramBotInfo>(botToken, 'getMe')
}

export interface SendTelegramTextArgs {
  botToken: string
  /** Telegram chat id — the `chat.id` from the inbound update. */
  chatId: string
  text: string
}

export interface TelegramSendResult {
  messageId: string
}

/**
 * Send a plain-text Telegram message.
 * https://core.telegram.org/bots/api#sendmessage
 */
export async function sendTelegramText(
  args: SendTelegramTextArgs,
): Promise<TelegramSendResult> {
  const result = await callTelegram<{ message_id: number }>(
    args.botToken,
    'sendMessage',
    { chat_id: args.chatId, text: args.text },
  )
  return { messageId: String(result.message_id) }
}

export interface SetWebhookArgs {
  botToken: string
  /** Public HTTPS URL Telegram will POST updates to. */
  url: string
  /** Echoed back in the X-Telegram-Bot-Api-Secret-Token header on every
   *  update — used to authenticate + route inbound requests. */
  secretToken: string
}

/**
 * Register (or re-register) the bot's webhook. Idempotent on Telegram's
 * side — calling again just overwrites the URL/secret.
 * https://core.telegram.org/bots/api#setwebhook
 */
export async function setWebhook(args: SetWebhookArgs): Promise<void> {
  await callTelegram<boolean>(args.botToken, 'setWebhook', {
    url: args.url,
    secret_token: args.secretToken,
    // Only the update types we actually handle — keeps noise (and our
    // webhook's work) down. Plain messages + edited messages for now.
    allowed_updates: ['message', 'edited_message'],
    // A fresh connection shouldn't replay a backlog of old messages.
    drop_pending_updates: true,
  })
}

/**
 * Remove the bot's webhook (used on "Reset"/disconnect so Telegram stops
 * delivering to a config we're about to delete).
 * https://core.telegram.org/bots/api#deletewebhook
 */
export async function deleteWebhook(botToken: string): Promise<void> {
  await callTelegram<boolean>(botToken, 'deleteWebhook', {
    drop_pending_updates: true,
  })
}
