import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'
import { encrypt } from '@/lib/whatsapp/encryption'
import { parseServiceAccountKey } from '@/lib/google/sheets'
import { AiError } from '@/lib/ai/types'

/**
 * GET /api/ai/google-sheets/config
 *
 * Whether the account has a Service Account connected (any member) —
 * returns just the email, never the key.
 */
export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase
      .from('google_sheets_config')
      .select('service_account_email')
      .eq('account_id', accountId)
      .maybeSingle()
    if (error) {
      console.error('[google-sheets/config GET] error:', error)
      return NextResponse.json({ connected: false, error: 'Failed to load configuration' }, { status: 200 })
    }
    if (!data) return NextResponse.json({ connected: false })
    return NextResponse.json({ connected: true, service_account_email: data.service_account_email })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * POST /api/ai/google-sheets/config  (admin+)
 *
 * Save (or replace) the account's Service Account key. `service_account_json`
 * is the raw pasted JSON — parsed to shape-check + extract the email for
 * display, then stored whole (encrypted) since fetchSheetValues needs the
 * full key at sync time, not just the email.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const body = await request.json().catch(() => null)
    const raw = typeof body?.service_account_json === 'string' ? body.service_account_json.trim() : ''
    if (!raw) {
      return NextResponse.json({ error: 'service_account_json is required' }, { status: 400 })
    }

    let email: string
    try {
      email = parseServiceAccountKey(raw).client_email
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'Invalid service account key'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('google_sheets_config')
      .select('id')
      .eq('account_id', accountId)
      .maybeSingle()

    const row = {
      service_account_email: email,
      service_account_json: encrypt(raw),
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { error } = await supabase
        .from('google_sheets_config')
        .update(row)
        .eq('account_id', accountId)
      if (error) {
        console.error('[google-sheets/config POST] update error:', error)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    } else {
      const { error } = await supabase
        .from('google_sheets_config')
        .insert({ account_id: accountId, created_by: userId, ...row })
      if (error) {
        console.error('[google-sheets/config POST] insert error:', error)
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, service_account_email: email })
  } catch (err) {
    return toErrorResponse(err)
  }
}

/**
 * DELETE /api/ai/google-sheets/config  (admin+)
 *
 * Disconnects the Service Account. Existing sheet-backed documents keep
 * their already-ingested content — only future "Sync now" calls fail
 * until a new key is saved.
 */
export async function DELETE() {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const { error } = await supabase
      .from('google_sheets_config')
      .delete()
      .eq('account_id', accountId)
    if (error) {
      console.error('[google-sheets/config DELETE] error:', error)
      return NextResponse.json({ error: 'Failed to delete configuration' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
