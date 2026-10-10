import { decrypt, encrypt } from '@/lib/whatsapp/encryption'
import { verifyMetaSignatureWithSecret } from '@/lib/whatsapp/webhook-signature'
import { supabaseAdmin } from './admin-client'

// ------------------------------------------------------------
// Per-account Meta App Secrets.
//
// By default every WhatsApp / Messenger webhook is verified with the
// single `META_APP_SECRET` env var — i.e. every account connects through
// the operator's Meta app. An account that brings its OWN Meta app saves
// that app's secret in its channel config (`whatsapp_config.app_secret`,
// `messenger_config.app_secret`, encrypted like every other credential).
//
// When the env-secret check fails, the webhook routes call in here: we
// look up only the accounts the payload claims to be about, re-verify the
// signature with each one's own secret, and keep only the entries that
// belong to an account whose secret actually signed the request. A
// payload signed by account A's app can therefore never inject events
// for account B, even if it names B's number or Page.
// ------------------------------------------------------------

/** Meta App Secrets are 32 hex characters. */
const APP_SECRET_RE = /^[a-f0-9]{32}$/i

/**
 * Turn the config form's App Secret fields into a column patch:
 *   - `app_secret` non-empty → validated and encrypted
 *   - `clear_app_secret: true` → NULL (back to META_APP_SECRET)
 *   - otherwise → `{}` so a re-save keeps the stored value
 * The column is only touched when asked, so saving still works before
 * migration 038 is applied.
 */
export function appSecretPatch(body: {
  app_secret?: unknown
  clear_app_secret?: unknown
}): { patch: { app_secret?: string | null } } | { error: string } {
  if (body.clear_app_secret === true) return { patch: { app_secret: null } }
  const raw = typeof body.app_secret === 'string' ? body.app_secret.trim() : ''
  if (!raw) return { patch: {} }
  if (!APP_SECRET_RE.test(raw)) {
    return {
      error:
        'El App Secret debe tener 32 caracteres hexadecimales (Meta → Configuración de la app → Básica).',
    }
  }
  return { patch: { app_secret: encrypt(raw) } }
}

/** Upper bound on ids looked up per request — Meta batches a handful of
 *  entries per delivery; anything larger is not a real webhook. */
const MAX_IDS = 50

export interface AccountSecretRow {
  /** Ids this row answers for (phone_number_id + waba_id, or page_id). */
  ids: Array<string | null | undefined>
  /** Encrypted App Secret, as stored. */
  appSecret: string
}

/**
 * Ids whose stored App Secret validates `signature` over `rawBody`.
 * Pure — rows come from the caller — so it's unit-testable.
 */
export function idsSignedByOwnSecret(
  rows: AccountSecretRow[],
  rawBody: string,
  signature: string | null,
): Set<string> {
  const trusted = new Set<string>()
  for (const row of rows) {
    let secret: string
    try {
      secret = decrypt(row.appSecret)
    } catch {
      continue // malformed / wrong-key row
    }
    if (!verifyMetaSignatureWithSecret(rawBody, signature, secret)) continue
    for (const id of row.ids) if (id) trusted.add(id)
  }
  return trusted
}

function uniqueCapped(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v !== ''))].slice(0, MAX_IDS)
}

// ------------------------------------------------------------
// WhatsApp: entry.id is the WABA id; message/status changes carry
// value.metadata.phone_number_id. Template events have no metadata, so
// they're matched by WABA id.
// ------------------------------------------------------------

export interface WhatsAppLikeBody {
  entry?: Array<{
    id: string
    changes: Array<{ value?: { metadata?: { phone_number_id?: string } } }>
  }>
}

export function filterWhatsAppEntries<T extends WhatsAppLikeBody>(
  body: T,
  trusted: Set<string>,
): T | null {
  const entry = (body.entry ?? [])
    .map((e) => ({
      ...e,
      changes: e.changes.filter(
        (c) =>
          trusted.has(e.id) ||
          trusted.has(c.value?.metadata?.phone_number_id ?? ''),
      ),
    }))
    .filter((e) => e.changes.length > 0)
  return entry.length > 0 ? ({ ...body, entry } as T) : null
}

/**
 * Returns the subset of `body` signed by the owning accounts' own App
 * Secrets, or null when nothing in it is.
 */
export async function trustedWhatsAppEntries<T extends WhatsAppLikeBody>(
  body: T,
  rawBody: string,
  signature: string | null,
): Promise<T | null> {
  const wabaIds = uniqueCapped((body.entry ?? []).map((e) => e.id))
  const phoneIds = uniqueCapped(
    (body.entry ?? []).flatMap((e) =>
      e.changes.map((c) => c.value?.metadata?.phone_number_id),
    ),
  )
  if (wabaIds.length === 0 && phoneIds.length === 0) return null

  const db = supabaseAdmin()
  const select = 'phone_number_id, waba_id, app_secret'
  const [byPhone, byWaba] = await Promise.all([
    phoneIds.length
      ? db.from('whatsapp_config').select(select).not('app_secret', 'is', null).in('phone_number_id', phoneIds)
      : Promise.resolve({ data: [], error: null }),
    wabaIds.length
      ? db.from('whatsapp_config').select(select).not('app_secret', 'is', null).in('waba_id', wabaIds)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (byPhone.error || byWaba.error) {
    console.error(
      '[meta-account-secrets] whatsapp_config lookup failed:',
      byPhone.error ?? byWaba.error,
    )
    return null
  }

  type Row = { phone_number_id: string; waba_id: string | null; app_secret: string }
  const rows = [...((byPhone.data ?? []) as Row[]), ...((byWaba.data ?? []) as Row[])]
  const trusted = idsSignedByOwnSecret(
    rows.map((r) => ({ ids: [r.phone_number_id, r.waba_id], appSecret: r.app_secret })),
    rawBody,
    signature,
  )
  return trusted.size ? filterWhatsAppEntries(body, trusted) : null
}

// ------------------------------------------------------------
// Messenger: entry.id is the Facebook Page id.
// ------------------------------------------------------------

export interface PageLikeBody {
  entry?: Array<{ id: string }>
}

export function filterPageEntries<T extends PageLikeBody>(
  body: T,
  trusted: Set<string>,
): T | null {
  const entry = (body.entry ?? []).filter((e) => trusted.has(e.id))
  return entry.length > 0 ? ({ ...body, entry } as T) : null
}

export async function trustedMessengerEntries<T extends PageLikeBody>(
  body: T,
  rawBody: string,
  signature: string | null,
): Promise<T | null> {
  const pageIds = uniqueCapped((body.entry ?? []).map((e) => e.id))
  if (pageIds.length === 0) return null

  const { data, error } = await supabaseAdmin()
    .from('messenger_config')
    .select('page_id, app_secret')
    .not('app_secret', 'is', null)
    .in('page_id', pageIds)
  if (error) {
    console.error('[meta-account-secrets] messenger_config lookup failed:', error)
    return null
  }

  const trusted = idsSignedByOwnSecret(
    ((data ?? []) as Array<{ page_id: string; app_secret: string }>).map((r) => ({
      ids: [r.page_id],
      appSecret: r.app_secret,
    })),
    rawBody,
    signature,
  )
  return trusted.size ? filterPageEntries(body, trusted) : null
}
