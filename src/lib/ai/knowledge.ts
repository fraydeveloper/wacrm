import type { SupabaseClient } from '@supabase/supabase-js'
import type { AiConfig } from './types'
import { chunkText } from './chunk'
import { embedTexts, toVectorLiteral } from './embeddings'

// ============================================================
// Knowledge base: ingest (chunk + optionally embed) and hybrid
// retrieve (semantic when an embeddings key is present, topped up with
// lexical full-text search).
// ============================================================

interface MatchRow {
  id: string
  content: string
}

// "Small knowledge base" thresholds for the whole-document short-circuit
// in `retrieveKnowledge`. A KB with at most this many chunks whose total
// text fits the char budget is injected in full rather than retrieved.
// ~24k chars ≈ 6k tokens — comfortable for gpt-4o-mini / haiku (both
// 100k+ context) on top of the conversation and reply. At the default
// 1200-char chunk size, 40 chunks caps this path near the budget anyway;
// the char check is the real guard. Tunable if KBs grow.
const FULL_KB_MAX_CHUNKS = 40
const FULL_KB_CHAR_BUDGET = 24_000

/**
 * (Re)build the chunks for one document. Deletes the document's
 * existing chunks, re-chunks the content, and — when the account has an
 * embeddings key — embeds each chunk. Runs under whatever client the
 * caller passes (service-role for ingest routes).
 *
 * Throws on embedding failure so the ingest route can report it; the
 * chunks are only written once embedding (if attempted) succeeds, so a
 * failed embed never leaves half-indexed rows.
 */
export async function ingestDocument(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  documentId: string,
  content: string,
): Promise<void> {
  const chunks = chunkText(content)

  // Replace, don't append — re-ingest must be idempotent.
  const { error: delErr } = await db
    .from('ai_knowledge_chunks')
    .delete()
    .eq('document_id', documentId)
  if (delErr) throw delErr

  if (chunks.length === 0) return

  // Embed if a key is set, but DON'T let an embedding failure stop the
  // chunks from being stored: a failed embed must still leave the
  // document searchable lexically. We record the error and rethrow it
  // AFTER inserting (embedding-less) rows, so the route can warn
  // "semantic indexing failed" — which is now truthful, because lexical
  // search really does still work.
  let embeddings: number[][] | null = null
  let embedError: unknown = null
  if (config.embeddingsApiKey) {
    try {
      embeddings = await embedTexts(config.embeddingsApiKey, chunks)
    } catch (err) {
      embedError = err
    }
  }

  const rows = chunks.map((content, i) => ({
    document_id: documentId,
    account_id: accountId,
    chunk_index: i,
    content,
    embedding: embeddings ? toVectorLiteral(embeddings[i]) : null,
  }))

  const { error: insErr } = await db.from('ai_knowledge_chunks').insert(rows)
  if (insErr) throw insErr

  if (embedError) throw embedError
}

/**
 * Retrieve up to `k` knowledge excerpts relevant to `queryText`.
 *
 * Semantic-primary when an embeddings key is configured (embed the
 * query → cosine-nearest chunks), then topped up with lexical full-text
 * matches to fill `k`. Lexical-only when there's no key. Best-effort:
 * any failure (no KB, embedding error, RPC error) degrades to fewer or
 * zero results and never throws into the draft / auto-reply path.
 */
export async function retrieveKnowledge(
  db: SupabaseClient,
  accountId: string,
  config: Pick<AiConfig, 'embeddingsApiKey'>,
  queryText: string,
  k = 5,
): Promise<string[]> {
  const query = queryText.trim()
  if (!query || k <= 0) return []

  // Skip everything when the account has no knowledge base — otherwise
  // every draft / auto-reply would pay for a query embedding + two RPCs
  // just to get []. One cheap indexed COUNT (head, no rows) instead of a
  // paid embeddings call on the hot path.
  let totalChunks = 0
  try {
    const { count, error } = await db
      .from('ai_knowledge_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
    if (error || !count) return []
    totalChunks = count
  } catch {
    return []
  }

  // Small knowledge base → feed the WHOLE thing, in document order,
  // instead of retrieving a handful of chunks. Lexical FTS (the only
  // path without an embeddings key) matches exact tokens only — no
  // stemming or synonyms — so a question phrased differently from the
  // document ("¿dónde están ubicados?" vs. a "Ubicaciones" heading,
  // "docentes" vs. "profesores") silently retrieves nothing and the bot
  // answers "no tengo esa información" even though the doc covers it.
  // When the KB is small enough to fit the prompt budget, this makes the
  // model read the entire document and answer regardless of phrasing —
  // exactly what a single uploaded FAQ/business doc needs, with no
  // embeddings key required. Larger KBs fall through to hybrid retrieval.
  if (totalChunks <= FULL_KB_MAX_CHUNKS) {
    try {
      const { data, error } = await db
        .from('ai_knowledge_chunks')
        .select('content')
        .eq('account_id', accountId)
        .order('document_id', { ascending: true })
        .order('chunk_index', { ascending: true })
        .limit(FULL_KB_MAX_CHUNKS)
      if (!error && Array.isArray(data) && data.length > 0) {
        const all = (data as { content: string }[]).map((r) => r.content)
        const totalChars = all.reduce((n, c) => n + c.length, 0)
        if (totalChars <= FULL_KB_CHAR_BUDGET) return all
        // Too large for the budget after all — fall through to retrieval.
      }
    } catch (err) {
      console.error('[ai knowledge] full-KB load failed, falling back to retrieval:', err)
    }
  }

  const picked = new Map<string, string>() // id → content, preserves order

  // Semantic path.
  if (config.embeddingsApiKey) {
    try {
      const [queryEmbedding] = await embedTexts(config.embeddingsApiKey, [query])
      if (queryEmbedding) {
        const { data, error } = await db.rpc('match_ai_knowledge_semantic', {
          p_account_id: accountId,
          p_query_embedding: toVectorLiteral(queryEmbedding),
          p_match_count: k,
        })
        if (!error && Array.isArray(data)) {
          for (const row of data as MatchRow[]) picked.set(row.id, row.content)
        }
      }
    } catch (err) {
      console.error('[ai knowledge] semantic retrieval failed, falling back to FTS:', err)
    }
  }

  // Lexical top-up (also the sole path when there's no embeddings key).
  if (picked.size < k) {
    try {
      const { data, error } = await db.rpc('match_ai_knowledge_fts', {
        p_account_id: accountId,
        p_query: query,
        p_match_count: k,
      })
      if (!error && Array.isArray(data)) {
        for (const row of data as MatchRow[]) {
          if (picked.size >= k) break
          if (!picked.has(row.id)) picked.set(row.id, row.content)
        }
      }
    } catch (err) {
      console.error('[ai knowledge] lexical retrieval failed:', err)
    }
  }

  return Array.from(picked.values()).slice(0, k)
}
