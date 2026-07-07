/**
 * Meta Messenger Send API helpers.
 *
 * Same named-params style as src/lib/whatsapp/meta-api.ts, for the same
 * reason: a typo in argument order should be a TypeScript error, not a
 * runtime Graph API rejection.
 */

const META_API_VERSION = 'v21.0'
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MessengerSendResult {
  messageId: string
}

interface MetaErrorResponse {
  error?: { message?: string; code?: number; type?: string }
}

async function throwMetaError(response: Response, fallback: string): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as MetaErrorResponse
    if (data.error?.message) message = data.error.message
  } catch {
    // response body wasn't JSON — keep the fallback
  }
  throw new Error(message)
}

export interface MetaPageInfo {
  id: string
  name?: string
}

export interface VerifyPageTokenArgs {
  pageId: string
  pageAccessToken: string
}

/**
 * Verify a Page Access Token by fetching the Page's own public metadata.
 * Confirms the token is valid AND actually scoped to `pageId`.
 */
export async function verifyPageToken(args: VerifyPageTokenArgs): Promise<MetaPageInfo> {
  const { pageId, pageAccessToken } = args
  const url = `${META_API_BASE}/${pageId}?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`
  const response = await fetch(url)
  if (!response.ok) {
    await throwMetaError(response, `Meta API error: ${response.status}`)
  }
  return response.json()
}

export interface SendMessengerTextArgs {
  pageAccessToken: string
  /** The recipient's Page-Scoped ID (PSID), from the webhook's `sender.id`. */
  recipientPsid: string
  text: string
}

/**
 * Send a plain-text Messenger message via the Send API.
 * https://developers.facebook.com/docs/messenger-platform/send-messages
 */
export async function sendMessengerText(
  args: SendMessengerTextArgs
): Promise<MessengerSendResult> {
  const { pageAccessToken, recipientPsid, text } = args
  const url = `${META_API_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: recipientPsid },
      message: { text },
    }),
  })
  if (!response.ok) {
    await throwMetaError(response, `Messenger API error: ${response.status}`)
  }
  const data = await response.json()
  return { messageId: data.message_id }
}
