-- ============================================================
-- 033_ai_more_providers
--
-- Widens the AI reply assistant (migration 029) beyond OpenAI/Anthropic
-- to also accept DeepSeek, Z.ai (GLM), and Google Gemini as the chat
-- provider. Purely a constraint change — chunking, embeddings (still
-- OpenAI-only, unrelated to this column), and retrieval are untouched.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_provider_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_provider_check
  CHECK (provider IN ('openai', 'anthropic', 'deepseek', 'zai', 'gemini'));
