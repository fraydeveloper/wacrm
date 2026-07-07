-- ============================================================
-- 034_ai_channel_toggle.sql — Per-channel AI on/off
--
-- Until now `ai_configs.is_active` / `auto_reply_enabled` gated the AI
-- assistant for the whole account — no way to keep it answering on
-- WhatsApp while pausing it on Messenger (or vice versa), even though
-- `conversations.channel` (migration 031) already distinguishes them.
--
-- `ai_channels_enabled` is the account's channel allow-list for the
-- assistant. Default is all four channels (matches today's de-facto
-- "on everywhere" behavior) so existing accounts see zero change until
-- an admin explicitly turns one off. `dispatchInboundToAiReply` checks
-- `conversation.channel = ANY(ai_channels_enabled)` alongside the
-- existing `auto_reply_enabled` gate; the manual "Draft with AI" button
-- in the inbox is unaffected by this list on purpose (an agent can
-- still ask for a draft on a paused channel — the toggle only stops the
-- bot from replying on its own).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS ai_channels_enabled text[]
  NOT NULL DEFAULT ARRAY['whatsapp', 'messenger', 'instagram', 'telegram'];

ALTER TABLE ai_configs DROP CONSTRAINT IF EXISTS ai_configs_channels_enabled_check;
ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_channels_enabled_check
  CHECK (ai_channels_enabled <@ ARRAY['whatsapp', 'messenger', 'instagram', 'telegram']::text[]);
