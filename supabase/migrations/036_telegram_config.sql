-- ============================================================
-- 036_telegram_config.sql — Telegram channel
--
-- Adds Telegram as a live channel, completing the omnichannel set the
-- foundation (migration 031) reserved. Telegram is the simplest channel
-- to bring online: no Meta App Review, no OAuth — a Bot Token from
-- @BotFather plus a `setWebhook` call is enough.
--
-- `telegram_config` mirrors `messenger_config` (migration 031) one row
-- per account, same encrypt()/decrypt() token-at-rest + RLS pattern,
-- with two Telegram-specific columns:
--
--   - `secret_token` — a random per-account string we pass to Telegram's
--     `setWebhook`. Telegram echoes it back on every inbound update in
--     the `X-Telegram-Bot-Api-Secret-Token` header, which is how the
--     webhook (a) authenticates the request came from Telegram and
--     (b) routes it to the right account. UNIQUE so the lookup is exact.
--     Stored in plaintext on purpose: unlike `bot_token` it grants no
--     access to Telegram's API — it's only a shared webhook secret, and
--     it must be queryable by value (AES-GCM's random IV would make an
--     encrypted column non-deterministic to look up).
--   - `bot_username` / `bot_id` — cached from getMe for display + echo
--     filtering; not secret.
--
-- Reuses `contact_channel_identities` (channel='telegram', external_id =
-- Telegram chat id) and the existing `channel` columns on conversations/
-- messages — both already allow 'telegram' (migration 031). Nothing to
-- change there.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

CREATE TABLE IF NOT EXISTS telegram_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Audit / sender-of-record for inserts needing a NOT NULL user_id FK
  -- downstream (contacts, conversations) — same role as
  -- messenger_config.user_id: whichever admin saved this config.
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token     TEXT NOT NULL,          -- AES-256-GCM-encrypted @BotFather token
  bot_username  TEXT,                   -- e.g. "my_sales_bot" (no @)
  bot_id        TEXT,                   -- numeric bot id (as text) from getMe
  secret_token  TEXT NOT NULL,          -- plaintext webhook shared secret (see header note)
  status        TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id),
  UNIQUE(secret_token)
);

ALTER TABLE telegram_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS telegram_config_select ON telegram_config;
CREATE POLICY telegram_config_select ON telegram_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS telegram_config_insert ON telegram_config;
CREATE POLICY telegram_config_insert ON telegram_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS telegram_config_update ON telegram_config;
CREATE POLICY telegram_config_update ON telegram_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS telegram_config_delete ON telegram_config;
CREATE POLICY telegram_config_delete ON telegram_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON telegram_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON telegram_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
