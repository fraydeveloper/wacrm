import { generateOpenAiCompatible } from './openai-compatible'
import type { ProviderArgs } from './shared'

const ZAI_URL = 'https://api.z.ai/api/paas/v4/chat/completions'

/**
 * Call Z.ai's Chat Completions endpoint (OpenAI-compatible core shape —
 * we don't use its extra `thinking`/`tool_stream` fields) with the
 * caller's own key. Returns the raw assistant text (handoff parsing
 * happens in `generateReply`).
 */
export async function generateZai(args: ProviderArgs): Promise<string> {
  return generateOpenAiCompatible(args, {
    providerLabel: 'Z.ai',
    endpoint: ZAI_URL,
  })
}
