import { AiError, type ChatMessage } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[]
}

/**
 * Gemini's `generateContent` shape differs from the other providers:
 * "contents" instead of "messages", roles are 'user'/'model' (not
 * 'assistant'), and the system prompt is its own top-level field. Same
 * empty-transcript guard as Anthropic's adapter — Gemini requires a
 * non-empty `contents` array.
 */
function toGeminiContents(messages: ChatMessage[]) {
  const merged = mergeConsecutive(messages)
  if (merged.length === 0) {
    return [
      { role: 'user', parts: [{ text: '(The customer has not sent a message yet.)' }] },
    ]
  }
  return merged.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

/**
 * Call Gemini's generateContent endpoint with the caller's own key. The
 * key travels in the query string, not an Authorization header — that's
 * this API's own convention, not something we chose.
 */
export async function generateGemini(args: ProviderArgs): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args
  const url = `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError('Gemini', res)
  }

  const data = (await res.json().catch(() => null)) as GeminiResponse | null
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) {
    throw new AiError('Gemini returned an empty response.', {
      code: 'empty_response',
    })
  }
  return text
}
