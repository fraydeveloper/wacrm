import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadEmbeddingsKey } from '@/lib/ai/config'
import { ingestDocument } from '@/lib/ai/knowledge'
import { AiError } from '@/lib/ai/types'
import { parseSpreadsheetId } from '@/lib/google/sheets'
import { fetchSheetAsText } from '@/lib/google/sync'

const DEFAULT_RANGE = 'Sheet1'

/**
 * POST /api/ai/knowledge/google-sheet  (admin+)
 *
 * Creates a knowledge-base document backed by a Google Sheet: fetches the
 * range once (first sync), stores the spreadsheet id/range on the
 * document so "Sync now" (`/api/ai/knowledge/[id]/sync-sheet`) can refresh
 * it later, then reuses the same insert + ingest path as manual/upload
 * documents.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-kb:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const body = await request.json().catch(() => null)
    const spreadsheetInput = typeof body?.spreadsheet_id_or_url === 'string' ? body.spreadsheet_id_or_url.trim() : ''
    const range = (typeof body?.sheet_range === 'string' ? body.sheet_range.trim() : '') || DEFAULT_RANGE
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    if (!spreadsheetInput || !title) {
      return NextResponse.json({ error: 'spreadsheet_id_or_url and title are required' }, { status: 400 })
    }

    let spreadsheetId: string
    try {
      spreadsheetId = parseSpreadsheetId(spreadsheetInput)
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'Invalid spreadsheet id/url'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    let content: string
    try {
      content = (await fetchSheetAsText(supabase, accountId, spreadsheetId, range)).trim()
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'Failed to read the sheet'
      const status = err instanceof AiError ? err.status : 502
      return NextResponse.json({ error: message }, { status })
    }
    if (!content) {
      return NextResponse.json(
        { error: `No data found in range "${range}". Check the tab name and that the header row has values.` },
        { status: 400 },
      )
    }

    const { data: doc, error } = await supabase
      .from('ai_knowledge_documents')
      .insert({
        account_id: accountId,
        created_by: userId,
        title,
        content,
        source_type: 'google_sheet',
        source_spreadsheet_id: spreadsheetId,
        source_sheet_range: range,
        last_synced_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error || !doc) {
      console.error('[ai/knowledge/google-sheet POST] insert error:', error)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    const { key: embeddingsApiKey, corrupt } = await loadEmbeddingsKey(supabase, accountId)
    try {
      await ingestDocument(supabase, accountId, { embeddingsApiKey }, doc.id, content)
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'indexing failed'
      console.error('[ai/knowledge/google-sheet POST] ingest error:', err)
      return NextResponse.json(
        {
          success: true,
          id: doc.id,
          warning: `Saved, but semantic indexing failed (${message}). Lexical search still works; use Reindex to retry.`,
        },
        { status: 200 },
      )
    }

    if (corrupt) {
      return NextResponse.json({
        success: true,
        id: doc.id,
        warning:
          'Saved with keyword search only — your embeddings key could not be decrypted (check ENCRYPTION_KEY, then re-enter the key).',
      })
    }
    return NextResponse.json({ success: true, id: doc.id })
  } catch (err) {
    return toErrorResponse(err)
  }
}
