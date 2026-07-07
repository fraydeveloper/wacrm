import { AiError } from '../types'
import { MAX_OUTPUT_TOKENS } from '../defaults'
import {
  mergeConsecutive,
  providerHttpError,
  toNetworkError,
  type ProviderArgs,
} from './shared'

interface OpenAiCompatibleResponse {
  choices?: { message?: { content?: string } }[]
}

/**
 * Shared Chat Completions caller for providers that mirror OpenAI's
 * request/response shape (DeepSeek, Z.ai) — same `messages` array and
 * `choices[0].message.content` response, just a different base URL and
 * the classic `max_tokens` field (OpenAI's own adapter uses the newer
 * `max_completion_tokens` name, which these providers don't recognize).
 */
export async function generateOpenAiCompatible(
  args: ProviderArgs,
  opts: { providerLabel: string; endpoint: string },
): Promise<string> {
  const { apiKey, model, systemPrompt, messages, timeoutMs } = args

  let res: Response
  try {
    res = await fetch(opts.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...mergeConsecutive(messages),
        ],
        max_tokens: MAX_OUTPUT_TOKENS,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    throw toNetworkError(err)
  }

  if (!res.ok) {
    throw await providerHttpError(opts.providerLabel, res)
  }

  const data = (await res.json().catch(() => null)) as OpenAiCompatibleResponse | null
  const text = data?.choices?.[0]?.message?.content
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AiError(`${opts.providerLabel} returned an empty response.`, {
      code: 'empty_response',
    })
  }
  return text
}
