-- ============================================================
-- 038_channel_app_secret
--
-- Optional per-account Meta App Secret for WhatsApp and Messenger.
--
-- Webhooks are verified with the global META_APP_SECRET env var,
-- which only works when every account connects through the
-- operator's Meta app. An account that uses its OWN Meta app saves
-- that app's secret here; the webhook routes fall back to it when
-- the global check fails (src/lib/inbound/meta-account-secrets.ts).
--
--   app_secret — AES-256-GCM-encrypted (same encrypt()/decrypt() as
--                access_token). NULL → use META_APP_SECRET.
--
-- The index on waba_id backs the webhook lookup of template events,
-- which carry the WABA id but no phone_number_id.
--
-- RLS: no change needed — existing whatsapp_config / messenger_config
-- policies cover the new column; writes go through the admin-only
-- config API routes.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS app_secret TEXT;

ALTER TABLE messenger_config
  ADD COLUMN IF NOT EXISTS app_secret TEXT;

CREATE INDEX IF NOT EXISTS whatsapp_config_waba_id_idx
  ON whatsapp_config (waba_id);
