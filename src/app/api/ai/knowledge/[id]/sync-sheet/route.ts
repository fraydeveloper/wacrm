import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadEmbeddingsKey } from '@/lib/ai/config'
import { ingestDocument } from '@/lib/ai/knowledge'
import { AiError } from '@/lib/ai/types'
import { fetchSheetAsText } from '@/lib/google/sync'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/ai/knowledge/[id]/sync-sheet  (admin+)
 *
 * The "Sync now" button — re-fetches the document's Google Sheet range
 * on demand (no cron; per the account's own choice) and re-runs the
 * exact same ingest path as every other write to this table.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-kb:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const { id } = await params
    const { data: doc, error: fetchErr } = await supabase
      .from('ai_knowledge_documents')
      .select('id, source_type, source_spreadsheet_id, source_sheet_range')
      .eq('account_id', accountId)
      .eq('id', id)
      .maybeSingle()
    if (fetchErr) {
      console.error('[knowledge/[id]/sync-sheet] fetch error:', fetchErr)
      return NextResponse.json({ error: 'Failed to load document' }, { status: 500 })
    }
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (doc.source_type !== 'google_sheet' || !doc.source_spreadsheet_id || !doc.source_sheet_range) {
      return NextResponse.json({ error: 'This document is not backed by a Google Sheet' }, { status: 400 })
    }

    let content: string
    try {
      content = (
        await fetchSheetAsText(supabase, accountId, doc.source_spreadsheet_id, doc.source_sheet_range)
      ).trim()
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'Failed to read the sheet'
      const status = err instanceof AiError ? err.status : 502
      return NextResponse.json({ error: message }, { status })
    }
    if (!content) {
      return NextResponse.json(
        { error: `No data found in range "${doc.source_sheet_range}" anymore.` },
        { status: 400 },
      )
    }

    const { error: updateErr } = await supabase
      .from('ai_knowledge_documents')
      .update({ content, last_synced_at: new Date().toISOString() })
      .eq('account_id', accountId)
      .eq('id', id)
    if (updateErr) {
      console.error('[knowledge/[id]/sync-sheet] update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 })
    }

    const { key: embeddingsApiKey, corrupt } = await loadEmbeddingsKey(supabase, accountId)
    try {
      await ingestDocument(supabase, accountId, { embeddingsApiKey }, id, content)
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'indexing failed'
      console.error('[knowledge/[id]/sync-sheet] ingest error:', err)
      return NextResponse.json(
        {
          success: true,
          warning: `Synced, but semantic indexing failed (${message}). Lexical search still works; use Reindex to retry.`,
        },
        { status: 200 },
      )
    }

    if (corrupt) {
      return NextResponse.json({
        success: true,
        warning:
          'Synced with keyword search only — your embeddings key could not be decrypted (check ENCRYPTION_KEY, then re-enter the key).',
      })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    return toErrorResponse(err)
  }
}
