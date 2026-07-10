-- ============================================================
-- 035_ai_handoff_message.sql — Human-handoff message + alert
--
-- Until now, when the auto-reply bot decided it could not safely help
-- (the `[[HANDOFF]]` sentinel — see src/lib/ai/defaults.ts) it went
-- SILENT: it flipped `conversations.ai_autoreply_disabled = true` and
-- left the customer's message unanswered for a human to pick up in the
-- inbox. The customer saw nothing back.
--
-- This migration adds the pieces for a *spoken* handoff:
--
--   1. `ai_configs.handoff_message` — the message the bot sends the
--      customer on handoff (e.g. "Para ayudarte mejor, comunícate con
--      Max Patricio por WhatsApp: +51 989 377 295"). NULL falls back to
--      a built-in default (see src/lib/ai/defaults.ts DEFAULT_HANDOFF_
--      MESSAGE) so existing accounts get a sensible message with no edit.
--
--   2. `ai_configs.handoff_notify_number` — an optional WhatsApp number
--      to alert (best-effort) when a handoff happens, so a human knows a
--      conversation needs attention. Stored in plain E.164 (it's not a
--      secret, unlike the API keys in this table).
--
--   3. A new `notifications.type` value, 'ai_handoff', so the in-app
--      bell can surface handoffs to the account's admins/owners. The
--      existing CHECK constraint only allowed 'conversation_assigned';
--      we widen it.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS handoff_message text;

ALTER TABLE ai_configs
  ADD COLUMN IF NOT EXISTS handoff_notify_number text;

-- Widen the notifications type CHECK to include the handoff alert.
-- Drop-and-recreate because ALTER ... ADD CHECK can't edit an existing
-- named constraint in place.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('conversation_assigned', 'ai_handoff'));
