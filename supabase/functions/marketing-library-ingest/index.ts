// ============================================================================
// marketing-library-ingest — admin-only lawful document ingestion.
//
// Turns an APPROVED marketing_library_sources record into a stored document +
// bounded searchable chunks. Rights are enforced BEFORE any text is stored;
// duplicate documents (by content hash) are skipped; re-ingestion is idempotent.
// Full books are never returned to a caller — this function only stores chunks.
//
// Auth: staff JWT required; role must be admin/owner (read from public.profiles,
// never from editable user metadata). No service-role key is ever returned.
//
// Actions:
//   - 'status'  : report ingestion readiness for a source (rights + counts).
//   - 'ingest'  : ingest a provided document (segments) into a source.
//
// This function does NOT fetch external URLs itself: the lawful document text is
// supplied by a reviewed admin caller (who has verified rights + provenance).
// That keeps rights verification a human step and avoids blind server-side
// scraping.
// ============================================================================
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  chunkSegments,
  documentContentHash,
  evaluateIngestionRights,
  type SourceSegment,
} from './ingestionCore.ts'

const ADMIN_ROLES = ['owner', 'admin']
const MAX_SEGMENTS = 4000
const MAX_SEGMENT_CHARS = 20000

interface IngestBody {
  action?: string
  sourceId?: string
  document?: {
    title?: string
    edition?: string
    documentType?: string
    language?: string
    canonicalUrl?: string
    storagePath?: string
    extractionMethod?: string
    segments?: Array<{ section?: string | null; page?: number | null; text?: string }>
  }
}

function sanitizeSegments(raw: unknown): SourceSegment[] {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, MAX_SEGMENTS).map((s) => {
    const o = (s ?? {}) as Record<string, unknown>
    return {
      section: typeof o.section === 'string' ? o.section.slice(0, 200) : null,
      page: typeof o.page === 'number' && Number.isFinite(o.page) ? Math.trunc(o.page) : null,
      text: typeof o.text === 'string' ? o.text.slice(0, MAX_SEGMENT_CHARS) : '',
    }
  }).filter((s) => s.text.trim().length > 0)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)

  const sb = createClient(supabaseUrl, serviceRoleKey)
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '')
  const { data: { user }, error: authError } = await sb.auth.getUser(token)
  if (authError || !user) return jsonResponse({ ok: false, error: 'Authentication required.' }, 401)

  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  const role = typeof profile?.role === 'string' ? profile.role : 'staff'
  if (!ADMIN_ROLES.includes(role)) return jsonResponse({ ok: false, error: 'Admin access required.' }, 403)

  let body: IngestBody
  try { body = await req.json() } catch { return jsonResponse({ ok: false, error: 'Invalid request body.' }, 400) }

  const sourceId = typeof body.sourceId === 'string' ? body.sourceId : ''
  if (!sourceId) return jsonResponse({ ok: false, error: 'sourceId is required.' }, 400)

  const { data: source, error: srcErr } = await sb
    .from('marketing_library_sources')
    .select('id, title, rights_status, access_mode, source_type, canonical_url, edition, language, ingestion_status')
    .eq('id', sourceId)
    .single()
  if (srcErr || !source) return jsonResponse({ ok: false, error: 'Source not found.' }, 404)

  const rights = evaluateIngestionRights({
    id: source.id as string,
    rightsStatus: (source.rights_status as string) ?? null,
    accessMode: (source.access_mode as string) ?? null,
    sourceType: (source.source_type as string) ?? null,
  })

  const action = body.action === 'ingest' ? 'ingest' : 'status'

  if (action === 'status') {
    const { count: docCount } = await sb.from('marketing_library_documents')
      .select('id', { head: true, count: 'exact' }).eq('source_id', sourceId)
    return jsonResponse({
      ok: true,
      source: { id: source.id, title: source.title, ingestionStatus: source.ingestion_status },
      rights,
      documents: docCount ?? 0,
    })
  }

  // action === 'ingest'
  if (!rights.allowed) {
    return jsonResponse({ ok: false, error: `Ingestion refused: ${rights.reason}`, rights }, 403)
  }

  const doc = body.document ?? {}
  const segments = sanitizeSegments(doc.segments)
  if (segments.length === 0) return jsonResponse({ ok: false, error: 'No usable document segments supplied.' }, 400)

  const method = typeof doc.extractionMethod === 'string' ? doc.extractionMethod : 'manual_transcription'
  const chunks = await chunkSegments(segments, method)
  if (chunks.length === 0) return jsonResponse({ ok: false, error: 'No chunks produced.' }, 400)
  const contentHash = await documentContentHash(chunks)

  // Duplicate document guard: same source + same content hash → skip (idempotent).
  const { data: existingDoc } = await sb.from('marketing_library_documents')
    .select('id').eq('source_id', sourceId).eq('content_hash', contentHash).maybeSingle()
  if (existingDoc) {
    return jsonResponse({ ok: true, duplicate: true, documentId: existingDoc.id, message: 'Identical document already ingested; nothing to do.' })
  }

  const pages = chunks.map((c) => c.pageEnd ?? c.pageStart ?? 0)
  const pageCount = pages.length ? Math.max(...pages) : null

  const { data: insertedDoc, error: docErr } = await sb.from('marketing_library_documents').insert({
    source_id: sourceId,
    title: typeof doc.title === 'string' ? doc.title.slice(0, 300) : (source.title as string),
    edition: typeof doc.edition === 'string' ? doc.edition.slice(0, 200) : (source.edition as string) ?? null,
    document_type: typeof doc.documentType === 'string' ? doc.documentType.slice(0, 60) : 'book',
    language: typeof doc.language === 'string' ? doc.language.slice(0, 20) : (source.language as string) ?? 'en',
    canonical_url: typeof doc.canonicalUrl === 'string' ? doc.canonicalUrl.slice(0, 500) : (source.canonical_url as string) ?? null,
    storage_path: typeof doc.storagePath === 'string' ? doc.storagePath.slice(0, 500) : null,
    ingestion_status: 'ingested',
    extraction_method: method,
    content_hash: contentHash,
    page_count: pageCount,
    text_human_verified: false,
    rights_status: source.rights_status,
    access_mode: source.access_mode,
  }).select('id').single()

  if (docErr || !insertedDoc) return jsonResponse({ ok: false, error: 'Failed to store document.' }, 500)
  const documentId = insertedDoc.id as string

  const rows = chunks.map((c) => ({
    document_id: documentId,
    section: c.section,
    page_start: c.pageStart,
    page_end: c.pageEnd,
    body: c.body,
    content_hash: c.contentHash,
    extraction_confidence: c.extractionConfidence,
    verification_state: c.verificationState,
  }))

  // Insert chunks in batches; skip any chunk whose hash already exists for this
  // document (safe re-ingestion). Unique (document_id, content_hash) is the guard.
  let inserted = 0
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200)
    const { error: chunkErr, count } = await sb.from('marketing_library_chunks')
      .upsert(batch, { onConflict: 'document_id,content_hash', ignoreDuplicates: true, count: 'exact' })
    if (chunkErr) return jsonResponse({ ok: false, error: `Chunk insert failed: ${chunkErr.message}`, documentId }, 500)
    inserted += count ?? batch.length
  }

  await sb.from('marketing_library_sources')
    .update({ ingestion_status: 'ingested', full_text_storage: true, updated_at: new Date().toISOString() })
    .eq('id', sourceId)

  return jsonResponse({
    ok: true,
    documentId,
    chunks: inserted,
    pageCount,
    extractionMethod: method,
    contentHash,
    note: 'Chunks stored as unverified. Human verification is required before any chunk is quoted verbatim.',
  })
})
