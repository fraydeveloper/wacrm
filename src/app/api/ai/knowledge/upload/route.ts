import { NextResponse } from 'next/server'
import { requireRole, toErrorResponse } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { loadEmbeddingsKey } from '@/lib/ai/config'
import { ingestDocument } from '@/lib/ai/knowledge'
import { extractTextFromFile } from '@/lib/ai/file-extract'
import { AiError } from '@/lib/ai/types'

const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15 MB — generous for a text-only KB doc

/**
 * POST /api/ai/knowledge/upload  (admin+)
 *
 * File-upload sibling of `POST /api/ai/knowledge` (JSON paste). Accepts
 * `multipart/form-data` with a `file` field (.md/.markdown/.txt/.pdf) and
 * an optional `title` (defaults to the filename). Extracts text server-side,
 * then reuses the exact same insert + ingest path as the JSON route so
 * both produce identical rows/warnings.
 */
export async function POST(request: Request) {
  try {
    const { supabase, accountId, userId } = await requireRole('admin')
    const limit = checkRateLimit(`ai-kb:${userId}`, RATE_LIMITS.adminAction)
    if (!limit.success) return rateLimitResponse(limit)

    const form = await request.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'file is empty' }, { status: 400 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `file is too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)` },
        { status: 400 },
      )
    }

    const titleField = form?.get('title')
    // Keep the extension in the default title (e.g. "faq.pdf", not "faq")
    // so the document list shows what kind of file was uploaded.
    const title = (typeof titleField === 'string' ? titleField.trim() : '') || file.name

    const buffer = Buffer.from(await file.arrayBuffer())
    let content: string
    try {
      content = (await extractTextFromFile(file.name, buffer)).trim()
    } catch (err) {
      if (err instanceof AiError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }

    if (!content) {
      return NextResponse.json(
        { error: 'No extractable text found in this file.' },
        { status: 400 },
      )
    }

    const { data: doc, error } = await supabase
      .from('ai_knowledge_documents')
      .insert({ account_id: accountId, created_by: userId, title, content, source_type: 'file' })
      .select('id')
      .single()
    if (error || !doc) {
      console.error('[ai/knowledge/upload] insert error:', error)
      return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
    }

    const { key: embeddingsApiKey, corrupt } = await loadEmbeddingsKey(supabase, accountId)
    try {
      await ingestDocument(supabase, accountId, { embeddingsApiKey }, doc.id, content)
    } catch (err) {
      const message = err instanceof AiError ? err.message : 'indexing failed'
      console.error('[ai/knowledge/upload] ingest error:', err)
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
    return NextResponse.json({ success: true, id: doc.id, title })
  } catch (err) {
    return toErrorResponse(err)
  }
}
