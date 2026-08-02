import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, pipe
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  pipe = await server.ssrLoadModule('/src/features/ai-workforce/ingestion/ingestionPipeline.ts')
})
after(async () => { await server?.close() })

const src = o => ({ id: 's1', rightsStatus: 'public_domain', accessMode: 'full_text_allowed', sourceType: 'book', ...o })

// ── Rights gate ──────────────────────────────────────────────────────────────
test('rights gate: public-domain full-text source is accepted for full_text', () => {
  const d = pipe.evaluateIngestionRights(src())
  assert.equal(d.allowed, true)
  assert.equal(d.operation, 'full_text')
})

test('rights gate: prohibited source is rejected', () => {
  assert.equal(pipe.evaluateIngestionRights(src({ rightsStatus: 'prohibited' })).allowed, false)
})

test('rights gate: research-only full text is rejected', () => {
  const d = pipe.evaluateIngestionRights(src({ rightsStatus: 'research_only', accessMode: 'metadata_and_link_only' }))
  assert.equal(d.allowed, false)
})

test('rights gate: metadata_and_link_only cannot store text', () => {
  assert.equal(pipe.evaluateIngestionRights(src({ accessMode: 'metadata_and_link_only' })).allowed, false)
})

test('rights gate: do_not_ingest and AI-generated are rejected', () => {
  assert.equal(pipe.evaluateIngestionRights(src({ accessMode: 'do_not_ingest' })).allowed, false)
  assert.equal(pipe.evaluateIngestionRights(src({ sourceType: 'ai_generated' })).allowed, false)
})

test('rights gate: excerpt_only permits excerpt operation only', () => {
  const d = pipe.evaluateIngestionRights(src({ accessMode: 'excerpt_only' }))
  assert.equal(d.allowed, true)
  assert.equal(d.operation, 'excerpt')
})

test('rights gate: unset access mode is refused by default', () => {
  assert.equal(pipe.evaluateIngestionRights(src({ accessMode: null })).allowed, false)
})

// ── Hashing + dedup ───────────────────────────────────────────────────────────
test('hash is stable across trivial whitespace differences', async () => {
  const a = await pipe.sha256Hex('Advertising is  salesmanship.\r\n\r\n')
  const b = await pipe.sha256Hex('Advertising is salesmanship.')
  assert.equal(a, b)
})

test('re-ingesting identical content yields no new chunks (idempotent)', async () => {
  const segs = [{ section: 'Ch 1', page: 1, text: 'Advertising is salesmanship. '.repeat(20) }]
  const chunks = await pipe.chunkSegments(segs, 'machine_readable_text')
  const hashes = new Set(chunks.map(c => c.contentHash))
  assert.equal(pipe.filterNewChunks(chunks, hashes).length, 0)
  // A genuinely new chunk is detected.
  const more = await pipe.chunkSegments([{ section: 'Ch 2', page: 2, text: 'Different content entirely here.' }], 'machine_readable_text')
  assert.equal(pipe.filterNewChunks(more, hashes).length, 1)
})

// ── Chunking: section + page preservation, bounds ─────────────────────────────
test('chunks never merge across a section boundary', async () => {
  const segs = [
    { section: 'Ch 1', page: 1, text: 'Alpha.' },
    { section: 'Ch 2', page: 2, text: 'Beta.' },
  ]
  const chunks = await pipe.chunkSegments(segs, 'machine_readable_text')
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0].section, 'Ch 1')
  assert.equal(chunks[1].section, 'Ch 2')
})

test('page start/end are preserved across merged segments', async () => {
  const segs = [
    { section: 'Ch 1', page: 3, text: 'Short a.' },
    { section: 'Ch 1', page: 4, text: 'Short b.' },
    { section: 'Ch 1', page: 5, text: 'Short c.' },
  ]
  const [chunk] = await pipe.chunkSegments(segs, 'machine_readable_text')
  assert.equal(chunk.pageStart, 3)
  assert.equal(chunk.pageEnd, 5)
})

test('oversize segment is split so no chunk exceeds the bound', async () => {
  const big = 'This is a sentence. '.repeat(400) // ~8000 chars
  const chunks = await pipe.chunkSegments([{ section: 'Big', page: 1, text: big }], 'machine_readable_text')
  assert.ok(chunks.length > 1)
  for (const c of chunks) assert.ok(c.body.length <= pipe.MAX_CHUNK_CHARS, `chunk ${c.index} within bound`)
})

test('OCR extraction yields lower confidence and unverified state', async () => {
  const [c] = await pipe.chunkSegments([{ section: 'Scan', page: 1, text: 'Scanned text.' }], 'ocr_scan')
  assert.ok(c.extractionConfidence < 0.7)
  assert.equal(c.verificationState, 'unverified')
})

// ── Whole-book guard ──────────────────────────────────────────────────────────
test('bounded selection never returns the whole book to a prompt', () => {
  const many = Array.from({ length: 200 }, (_, i) => i)
  assert.ok(pipe.boundedChunkSelection(many, 100).length <= 12)
  assert.equal(pipe.boundedChunkSelection(many, 5).length, 5)
})

test('document content hash changes when chunk content changes', async () => {
  const a = await pipe.chunkSegments([{ section: 'A', page: 1, text: 'One.' }], 'machine_readable_text')
  const b = await pipe.chunkSegments([{ section: 'A', page: 1, text: 'Two.' }], 'machine_readable_text')
  const ha = await pipe.documentContentHash(a)
  const hb = await pipe.documentContentHash(b)
  assert.notEqual(ha, hb)
})
