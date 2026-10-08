-- ============================================================
-- 037_account_branding
--
-- Per-account white-label branding: the name, logo and brand
-- color shown in the app chrome (sidebar, browser tab) instead of
-- the template's "CRM Template for WhatsApp".
--
--   brand_name   — display name of the business ("Agente TED").
--                  NULL → the app falls back to its default label.
--   brand_logo_url — public https URL of the logo (uploaded to the
--                  existing `avatars` bucket under the admin's own
--                  folder, so no new storage policy is needed).
--   brand_color  — primary accent as #RRGGBB. Offered to every
--                  member as the "Color de la empresa" theme.
--   brand_color_secondary — optional second brand color (#RRGGBB),
--                  used for highlights/charts.
--
-- RLS: no change needed. `accounts_update` (017) already restricts
-- writes to admins+, and `accounts_select` lets every member read.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS brand_name TEXT,
  ADD COLUMN IF NOT EXISTS brand_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS brand_color TEXT,
  ADD COLUMN IF NOT EXISTS brand_color_secondary TEXT;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_brand_name_len;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_brand_name_len
  CHECK (brand_name IS NULL OR char_length(brand_name) BETWEEN 1 AND 60);

-- Only https URLs: the value is rendered as <img src> for every
-- member, so block javascript:/data: and plain-http mixed content.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_brand_logo_url_format;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_brand_logo_url_format
  CHECK (
    brand_logo_url IS NULL
    OR (brand_logo_url ~ '^https://[^\s"''<>]+$' AND char_length(brand_logo_url) <= 1024)
  );

-- Strict hex so the value can be dropped into a CSS custom property
-- without any risk of CSS injection.
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_brand_color_format;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_brand_color_format
  CHECK (brand_color IS NULL OR brand_color ~ '^#[0-9A-Fa-f]{6}$');

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_brand_color_secondary_format;
ALTER TABLE accounts
  ADD CONSTRAINT accounts_brand_color_secondary_format
  CHECK (brand_color_secondary IS NULL OR brand_color_secondary ~ '^#[0-9A-Fa-f]{6}$');
