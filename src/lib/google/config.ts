import type { SupabaseClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { parseServiceAccountKey, type ServiceAccountKey } from './sheets'

/**
 * Load + decrypt the account's Google Service Account key, ready to pass
 * to `getAccessToken`. Mirrors `loadEmbeddingsKey` (src/lib/ai/config.ts):
 * returns null (never throws) when there's no key or it can't be
 * decrypted/parsed, so callers can surface a clear "not connected" error
 * instead of a 500.
 */
export async function loadGoogleServiceAccount(
  db: SupabaseClient,
  accountId: string,
): Promise<ServiceAccountKey | null> {
  const { data, error } = await db
    .from('google_sheets_config')
    .select('service_account_json')
    .eq('account_id', accountId)
    .maybeSingle()
  if (error || !data?.service_account_json) return null
  try {
    const raw = decrypt(data.service_account_json)
    return parseServiceAccountKey(raw)
  } catch (err) {
    console.error(`[google config] service account for account ${accountId} could not be decrypted/parsed:`, err)
    return null
  }
}
