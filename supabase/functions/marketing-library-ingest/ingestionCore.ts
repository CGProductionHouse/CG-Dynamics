// ============================================================================
// Deno-side ingestion core for marketing-library-ingest.
//
// This MIRRORS src/features/ai-workforce/ingestion/ingestionPipeline.ts (which
// is the unit-tested source of truth). Keep the two in sync; the algorithm is
// intentionally identical so behaviour matches the tests.
// ============================================================================

export interface IngestSourceRef {
  id: string
  rightsStatus: string | null
  accessMode: string | null
  sourceType: string | null
}

export interface RightsDecision {
  allowed: boolean
  operation: 'full_text' | 'excerpt' | 'none'
  reason: string
}

export interface SourceSegment { section: string | null; page: number | null; text: string }

export interface DocumentChunk {
  index: number
  section: string | null
  pageStart: number | null
  pageEnd: number | null
  body: string
  contentHash: string
  extractionConfidence: number
  verificationState: 'unverified' | 'human_verified'
}

const NON_AUTHORITATIVE = new Set(['ai_generated', 'unsourced_blog'])
const RIGHTS_BLOCKED = new Set(['research_only', 'bibliographic_only', 'rights_unknown', 'prohibited'])
const METHOD_CONFIDENCE: Record<string, number> = {
  machine_readable_text: 0.95, publisher_provided: 0.95, manual_transcription: 0.9,
  cg_authored: 0.9, ocr_scan: 0.55,
}
export const MAX_CHUNK_CHARS = 2200
export const MIN_CHUNK_CHARS = 400

export function evaluateIngestionRights(source: IngestSourceRef): RightsDecision {
  if (source.sourceType && NON_AUTHORITATIVE.has(source.sourceType))
    return { allowed: false, operation: 'none', reason: 'Source type is never authoritative.' }
  if (source.accessMode === 'do_not_ingest')
    return { allowed: false, operation: 'none', reason: 'Access mode is do_not_ingest.' }
  if (source.rightsStatus && RIGHTS_BLOCKED.has(source.rightsStatus))
    return { allowed: false, operation: 'none', reason: `Rights status "${source.rightsStatus}" does not permit full-text storage.` }
  if (source.accessMode === 'metadata_and_link_only')
    return { allowed: false, operation: 'none', reason: 'Access mode permits metadata + link only.' }
  if (source.accessMode === 'internal_notes_only')
    return { allowed: true, operation: 'excerpt', reason: 'Internal notes may be stored.' }
  if (source.accessMode === 'excerpt_only')
    return { allowed: true, operation: 'excerpt', reason: 'Excerpt storage permitted.' }
  if (source.accessMode === 'full_text_allowed')
    return { allowed: true, operation: 'full_text', reason: 'Full-text storage permitted.' }
  return { allowed: false, operation: 'none', reason: 'Access mode unset/unrecognised; refusing by default.' }
}

export function normaliseForHash(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(normaliseForHash(text))
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function chunkSegments(segments: SourceSegment[], method: string): Promise<DocumentChunk[]> {
  const confidence = METHOD_CONFIDENCE[method] ?? 0.5
  const chunks: DocumentChunk[] = []
  let buf: SourceSegment[] = []
  let bufLen = 0
  const flush = async () => {
    if (buf.length === 0) return
    const body = buf.map((s) => s.text.trim()).filter(Boolean).join('\n\n').trim()
    if (!body) { buf = []; bufLen = 0; return }
    const pages = buf.map((s) => s.page).filter((p): p is number => typeof p === 'number')
    chunks.push({
      index: chunks.length, section: buf[0].section ?? null,
      pageStart: pages.length ? Math.min(...pages) : null,
      pageEnd: pages.length ? Math.max(...pages) : null,
      body, contentHash: await sha256Hex(body),
      extractionConfidence: confidence, verificationState: 'unverified',
    })
    buf = []; bufLen = 0
  }
  for (const seg of segments) {
    const text = (seg.text ?? '').trim()
    if (!text) continue
    if (buf.length > 0 && buf[0].section !== seg.section) await flush()
    if (text.length > MAX_CHUNK_CHARS) {
      await flush()
      for (const piece of splitOversize(text)) { buf = [{ section: seg.section, page: seg.page, text: piece }]; bufLen = piece.length; await flush() }
      continue
    }
    if (bufLen + text.length > MAX_CHUNK_CHARS && bufLen >= MIN_CHUNK_CHARS) await flush()
    buf.push(seg); bufLen += text.length
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
      for (const s of para.split(/(?<=[.!?])\s+/)) { if (cur.length + s.length > MAX_CHUNK_CHARS) push(); cur += (cur ? ' ' : '') + s }
      push(); continue
    }
    if (cur.length + para.length > MAX_CHUNK_CHARS) push()
    cur += (cur ? '\n\n' : '') + para
  }
  push()
  return out
}

export async function documentContentHash(chunks: DocumentChunk[]): Promise<string> {
  return sha256Hex(chunks.map((c) => c.contentHash).join('|'))
}
