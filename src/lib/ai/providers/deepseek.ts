import { generateOpenAiCompatible } from './openai-compatible'
import type { ProviderArgs } from './shared'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

/**
 * Call DeepSeek's Chat Completions endpoint (OpenAI-compatible) with the
 * caller's own key. Returns the raw assistant text (handoff parsing
 * happens in `generateReply`).
 */
export async function generateDeepSeek(args: ProviderArgs): Promise<string> {
  return generateOpenAiCompatible(args, {
    providerLabel: 'DeepSeek',
    endpoint: DEEPSEEK_URL,
  })
}
