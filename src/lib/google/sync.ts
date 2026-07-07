import type { SupabaseClient } from '@supabase/supabase-js'
import { loadGoogleServiceAccount } from './config'
import { getAccessToken, fetchSheetValues, sheetValuesToText } from './sheets'
import { AiError } from '@/lib/ai/types'

/**
 * Fetch one range of a Google Sheet and flatten it into the plain-text
 * shape the knowledge base chunker expects. Throws `AiError` (never a
 * raw error) so API routes can map it straight to a JSON response.
 */
export async function fetchSheetAsText(
  db: SupabaseClient,
  accountId: string,
  spreadsheetId: string,
  range: string,
): Promise<string> {
  const key = await loadGoogleServiceAccount(db, accountId)
  if (!key) {
    throw new AiError(
      'Google Sheets is not connected for this account. Add a Service Account key first.',
      { code: 'google_not_connected', status: 400 },
    )
  }
  const accessToken = await getAccessToken(key)
  const values = await fetchSheetValues({ accessToken, spreadsheetId, range })
  return sheetValuesToText(values)
}
