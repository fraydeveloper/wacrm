-- ============================================================
-- 031_channel_foundations
--
-- Omnichannel groundwork. Until now every conversation/message was
-- implicitly WhatsApp — no `channel` column existed, and contact
-- identity was phone-only. This migration adds the generic pieces
-- needed to onboard non-WhatsApp channels (Messenger now; Instagram
-- and Telegram later) without touching WhatsApp's existing behavior:
--
--   1. `channel` on `conversations` / `messages`, defaulting to
--      'whatsapp' so every existing row is backfilled for free.
--   2. A real uniqueness guarantee of (account_id, contact_id, channel)
--      on `conversations` — today's one-conversation-per-contact
--      assumption is app-level only (see findOrCreateConversation),
--      so a contact can now have one WhatsApp thread AND one
--      Messenger thread without them colliding.
--   3. `contact_channel_identities` — where a non-phone identity
--      (e.g. a Messenger PSID) maps to a `contacts` row. WhatsApp
--      keeps using `contacts.phone` as-is; this table is additive.
--   4. `messenger_config` — one row per account, mirroring
--      `whatsapp_config`'s shape (encrypted token at rest, same RLS
--      pattern from migration 020).
--
-- Idempotent — safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 0) `contacts.phone` becomes optional. A Messenger (or future
--    Telegram) contact has no phone number at all — forcing one
--    would mean storing a fake placeholder, which would collide with
--    the `(account_id, phone_normalized)` dedup index (migration 022)
--    the moment two channel-only contacts got the same placeholder.
--    `phone_normalized` is a STORED generated column — regexp_replace
--    on a NULL phone yields NULL, and NULLs are never considered
--    duplicates by a unique index, so this is safe with no further
--    changes to migration 022's index. WhatsApp contacts are
--    unaffected — that path always has a real phone.
-- ------------------------------------------------------------
ALTER TABLE contacts ALTER COLUMN phone DROP NOT NULL;

-- ------------------------------------------------------------
-- 1) Channel column on conversations / messages.
-- ------------------------------------------------------------
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'messenger', 'instagram', 'telegram'));

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'messenger', 'instagram', 'telegram'));

CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(channel);

-- ------------------------------------------------------------
-- 2) One conversation per (account, contact, channel).
--
-- Wrapped in a DO block: if duplicate (account_id, contact_id,
-- channel) rows already exist (possible under the old app-only
-- guarantee, e.g. a lost race in findOrCreateConversation), creating
-- the index would fail the whole migration. Skip with a NOTICE
-- instead so the rest of this migration still applies; an operator
-- can dedupe and re-run to pick up the constraint.
-- ------------------------------------------------------------
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_account_contact_channel
    ON conversations (account_id, contact_id, channel);
EXCEPTION WHEN unique_violation THEN
  RAISE NOTICE 'Skipping idx_conversations_account_contact_channel: duplicate (account_id, contact_id, channel) rows exist. Resolve duplicates, then re-run this migration.';
END $$;

-- ------------------------------------------------------------
-- 3) Non-phone contact identities (Messenger PSID, Telegram
--    chat_id, etc.). One contact can have identities across
--    several channels; one external id maps to exactly one contact
--    per account+channel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_channel_identities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL CHECK (channel IN ('messenger', 'instagram', 'telegram')),
  external_id TEXT NOT NULL,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_channel_identities_contact
  ON contact_channel_identities(contact_id);

ALTER TABLE contact_channel_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_channel_identities_select ON contact_channel_identities;
CREATE POLICY contact_channel_identities_select ON contact_channel_identities FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS contact_channel_identities_insert ON contact_channel_identities;
CREATE POLICY contact_channel_identities_insert ON contact_channel_identities FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS contact_channel_identities_update ON contact_channel_identities;
CREATE POLICY contact_channel_identities_update ON contact_channel_identities FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

DROP POLICY IF EXISTS contact_channel_identities_delete ON contact_channel_identities;
CREATE POLICY contact_channel_identities_delete ON contact_channel_identities FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- ------------------------------------------------------------
-- 4) Messenger config — one row per account, same shape and RLS
--    pattern as `whatsapp_config` (migration 001 + 020).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messenger_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  -- Audit / sender-of-record for row inserts that need a NOT NULL
  -- user_id FK downstream (contacts, conversations) — same role as
  -- whatsapp_config.user_id: whichever admin saved this config.
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id           TEXT NOT NULL,
  page_access_token TEXT NOT NULL, -- AES-256-GCM-encrypted, same encrypt()/decrypt() as whatsapp_config.access_token
  verify_token      TEXT,          -- AES-256-GCM-encrypted
  status            TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id),
  UNIQUE(page_id)
);

ALTER TABLE messenger_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messenger_config_select ON messenger_config;
CREATE POLICY messenger_config_select ON messenger_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS messenger_config_insert ON messenger_config;
CREATE POLICY messenger_config_insert ON messenger_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_update ON messenger_config;
CREATE POLICY messenger_config_update ON messenger_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS messenger_config_delete ON messenger_config;
CREATE POLICY messenger_config_delete ON messenger_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON messenger_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON messenger_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
