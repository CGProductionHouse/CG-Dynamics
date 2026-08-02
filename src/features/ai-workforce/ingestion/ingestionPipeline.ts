// ============================================================================
// AI Workforce — lawful document ingestion pipeline (deterministic core)
//
// Pure, reusable logic for turning an APPROVED source into stored documents +
// bounded searchable chunks. It is NOT Hopkins-specific: it ingests public-domain
// books, openly licensed documents, official documentation/reports, CG-owned
// notes, and page/image-sequence citations. All rights enforcement, hashing,
// deduplication, chunk-boundary preservation and confidence recording live here
// so they are unit-testable and shared by the ingestion edge function and any
// admin tooling.
//
// Non-negotiables enforced here:
//  - rights permit the requested operation BEFORE any text is stored;
//  - a document/chunk hash prevents duplicate ingestion and enables safe
//    re-ingestion (same content → same hash → no duplicate);
//  - chunks preserve section + printed-page / scan-image sequence;
//  - full books are never emitted as a single blob for a prompt — chunks are
//    bounded; the caller decides how many chunks (never the whole book) to load.
// ============================================================================

export type RightsStatus =
  | 'public_domain' | 'open_license' | 'official_reference' | 'user_owned'
  | 'research_only' | 'bibliographic_only' | 'rights_unknown' | 'prohibited'

export type AccessMode =
  | 'full_text_allowed' | 'excerpt_only' | 'metadata_and_link_only'
  | 'internal_notes_only' | 'do_not_ingest'

export type ExtractionMethod =
  | 'machine_readable_text'   // clean digital text (Gutenberg/Wikisource-grade)
  | 'publisher_provided'      // official machine-readable document
  | 'ocr_scan'                // OCR of a scan — lower confidence
  | 'manual_transcription'    // human-typed
  | 'cg_authored'             // CG-owned notes

export interface IngestSourceRef {
  id: string
  rightsStatus: RightsStatus | string | null
  accessMode: AccessMode | string | null
  sourceType: string | null
}

export interface RightsDecision {
  allowed: boolean
  operation: 'full_text' | 'excerpt' | 'none'
  reason: string
}

// A raw segment handed to the chunker: a contiguous piece of text with its
// section label and printed-page (or scan-image) position preserved.
export interface SourceSegment {
  section: string | null
  page: number | null          // printed page OR scan-image sequence number
  text: string
}

export interface DocumentChunk {
  index: number
  section: string | null
  pageStart: number | null
  pageEnd: number | null
  body: string
  contentHash: string
  extractionConfidence: number // 0..1
  verificationState: 'unverified' | 'human_verified'
}

const NON_AUTHORITATIVE = new Set(['ai_generated', 'unsourced_blog'])
const RIGHTS_BLOCKED = new Set<string>(['research_only', 'bibliographic_only', 'rights_unknown', 'prohibited'])

// Default confidence by extraction method. OCR is deliberately low so its chunks
// stay 'unverified' and are never treated as verbatim quotations without review.
const METHOD_CONFIDENCE: Record<ExtractionMethod, number> = {
  machine_readable_text: 0.95,
  publisher_provided: 0.95,
  manual_transcription: 0.9,
  cg_authored: 0.9,
  ocr_scan: 0.55,
}

export const MAX_CHUNK_CHARS = 2200
export const MIN_CHUNK_CHARS = 400

// ── Rights gate ─────────────────────────────────────────────────────────────
// Decide whether a source may be ingested, and at what scope. This runs before
// any text is fetched or stored.
export function evaluateIngestionRights(source: IngestSourceRef): RightsDecision {
  if (source.sourceType && NON_AUTHORITATIVE.has(source.sourceType)) {
    return { allowed: false, operation: 'none', reason: 'Source type is never authoritative (AI-generated or unsourced blog).' }
  }
  if (source.accessMode === 'do_not_ingest') {
    return { allowed: false, operation: 'none', reason: 'Access mode is do_not_ingest.' }
  }
  if (source.rightsStatus && RIGHTS_BLOCKED.has(source.rightsStatus)) {
    return { allowed: false, operation: 'none', reason: `Rights status "${source.rightsStatus}" does not permit full-text storage.` }
  }
  if (source.accessMode === 'metadata_and_link_only') {
    return { allowed: false, operation: 'none', reason: 'Access mode permits metadata + link only, not text storage.' }
  }
  if (source.accessMode === 'internal_notes_only') {
    return { allowed: true, operation: 'excerpt', reason: 'Internal notes may be stored.' }
  }
  if (source.accessMode === 'excerpt_only') {
    return { allowed: true, operation: 'excerpt', reason: 'Excerpt storage permitted.' }
  }
  if (source.accessMode === 'full_text_allowed') {
    return { allowed: true, operation: 'full_text', reason: 'Full-text storage permitted.' }
  }
  return { allowed: false, operation: 'none', reason: 'Access mode is unset or unrecognised; refusing by default.' }
}

// ── Hashing (dedup + safe re-ingestion) ─────────────────────────────────────
// Normalise text before hashing so trivial whitespace differences do not create
// spurious "new" content. Uses Web Crypto SHA-256 (available in Deno + Node 18+).
export function normaliseForHash(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(normaliseForHash(text))
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Chunking (section + page preserving, bounded) ───────────────────────────
// Group contiguous segments into bounded chunks. Never merges across a section
// boundary. Preserves page_start/page_end. Splits oversize single segments on
// paragraph/sentence boundaries so a chunk never exceeds MAX_CHUNK_CHARS.
export async function chunkSegments(segments: SourceSegment[], method: ExtractionMethod): Promise<DocumentChunk[]> {
  const confidence = METHOD_CONFIDENCE[method] ?? 0.5
  const chunks: DocumentChunk[] = []
  let buf: SourceSegment[] = []
  let bufLen = 0

  const flush = async () => {
    if (buf.length === 0) return
    const body = buf.map(s => s.text.trim()).filter(Boolean).join('\n\n').trim()
    if (!body) { buf = []; bufLen = 0; return }
    const pages = buf.map(s => s.page).filter((p): p is number => typeof p === 'number')
    chunks.push({
      index: chunks.length,
      section: buf[0].section ?? null,
      pageStart: pages.length ? Math.min(...pages) : null,
      pageEnd: pages.length ? Math.max(...pages) : null,
      body,
      contentHash: await sha256Hex(body),
      extractionConfidence: confidence,
      verificationState: 'unverified',
    })
    buf = []
    bufLen = 0
  }

  for (const seg of segments) {
    const text = (seg.text ?? '').trim()
    if (!text) continue
    // Section change forces a boundary.
    if (buf.length > 0 && buf[0].section !== seg.section) await flush()

    // Oversize single segment: split on paragraph/sentence boundaries.
    if (text.length > MAX_CHUNK_CHARS) {
      await flush()
      for (const piece of splitOversize(text)) {
        buf = [{ section: seg.section, page: seg.page, text: piece }]
        bufLen = piece.length
        await flush()
      }
      continue
    }

    if (bufLen + text.length > MAX_CHUNK_CHARS && bufLen >= MIN_CHUNK_CHARS) await flush()
    buf.push(seg)
    bufLen += text.length
  }
  await flush()
  return chunks
}

function splitOversize(text: string): string[] {
  const paras = text.split(/\n{2,}/)
  const out: string[] = []
  let cur = ''
  const push = () => { if (cur.trim()) out.push(cur.trim()); cur = '' }
  for (const para of paras) {
    if (para.length > MAX_CHUNK_CHARS) {
      push()
      const sentences = para.split(/(?<=[.!?])\s+/)
      for (const s of sentences) {
        if (cur.length + s.length > MAX_CHUNK_CHARS) push()
        cur += (cur ? ' ' : '') + s
      }
      push()
      continue
    }
    if (cur.length + para.length > MAX_CHUNK_CHARS) push()
    cur += (cur ? '\n\n' : '') + para
  }
  push()
  return out
}

// ── Duplicate / re-ingestion detection ──────────────────────────────────────
// Given the set of chunk hashes already stored for a document, return only the
// genuinely new chunks. Re-ingesting identical content yields an empty list.
export function filterNewChunks(chunks: DocumentChunk[], existingHashes: Set<string>): DocumentChunk[] {
  return chunks.filter(c => !existingHashes.has(c.contentHash))
}

// Whole-document dedup key: hash of the ordered chunk hashes. Same document
// content → same key → skip.
export async function documentContentHash(chunks: DocumentChunk[]): Promise<string> {
  return sha256Hex(chunks.map(c => c.contentHash).join('|'))
}

// Guard used by the assistant layer: a retrieval must never load the whole book.
// Given a document's chunk count and a requested slice, cap it.
export function boundedChunkSelection<T>(chunks: T[], limit: number): T[] {
  const cap = Math.max(1, Math.min(limit, 12))
  return chunks.slice(0, cap)
}
