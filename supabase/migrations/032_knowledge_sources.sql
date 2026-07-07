-- ============================================================
-- 032_knowledge_sources
--
-- Lets the AI knowledge base (migration 030) be populated from more
-- than pasted text: uploaded .md/.pdf files, and Google Sheets pulled
-- in via a per-account Service Account (synced on demand, no cron).
-- Both paths still funnel through the existing ingestDocument() —
-- chunking, embedding, and retrieval are unchanged.
--
-- Idempotent — safe to run multiple times.
-- ============================================================

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual'
  CHECK (source_type IN ('manual', 'file', 'google_sheet'));

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS source_spreadsheet_id text;

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS source_sheet_range text;

ALTER TABLE ai_knowledge_documents
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ============================================================
-- Google Sheets Service Account — one per account, same shape and
-- RLS pattern as whatsapp_config / messenger_config.
-- ============================================================
CREATE TABLE IF NOT EXISTS google_sheets_config (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  service_account_email TEXT NOT NULL,
  service_account_json  TEXT NOT NULL, -- AES-256-GCM-encrypted, same encrypt()/decrypt() as whatsapp_config.access_token
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id)
);

ALTER TABLE google_sheets_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_sheets_config_select ON google_sheets_config;
CREATE POLICY google_sheets_config_select ON google_sheets_config FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS google_sheets_config_insert ON google_sheets_config;
CREATE POLICY google_sheets_config_insert ON google_sheets_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS google_sheets_config_update ON google_sheets_config;
CREATE POLICY google_sheets_config_update ON google_sheets_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS google_sheets_config_delete ON google_sheets_config;
CREATE POLICY google_sheets_config_delete ON google_sheets_config FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON google_sheets_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON google_sheets_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
