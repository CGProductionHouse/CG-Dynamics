import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

let server, jpeg
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  jpeg = await server.ssrLoadModule('/supabase/functions/_shared/publicationJpeg.ts')
})
after(async () => { await server?.close() })
const original = readFileSync('tests/fixtures/publication-baseline-320.jpg'), target = { route: 'instagram_login', accountId: '123' }
const source = bytes => ({ bytes: Uint8Array.from(bytes), byteLength: bytes.length, mediaType: 'image/jpeg', assetSha256: createHash('sha256').update(bytes).digest('hex') })
function frameOffset(b) { const i = b.indexOf(Buffer.from([255, 192])); assert.ok(i > 0); return i }
const decoded = () => ({ width: 320, height: 320, data: new Uint8Array(320 * 320 * 4) })

test('original JPEG profile requires an actual private decoder with strict bounded options and does not transform bytes', async () => {
  let calls = 0
  const s = source(original), result = await jpeg.verifyPublicationJpeg(s, target, (bytes, options) => {
    calls++; assert.deepEqual(Buffer.from(bytes), original)
    assert.deepEqual(options, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 4, maxMemoryUsageInMB: 64 })
    assert.equal(Object.isFrozen(options), true); return decoded()
  }, () => Date.parse('2026-11-16T12:00:00Z'))
  assert.equal(calls, 1); assert.equal(result.profile, 'instagram_baseline_jpeg_v1'); assert.equal(result.width, 320)
  assert.deepEqual(Buffer.from(s.bytes), original); assert.equal(JSON.stringify(result).includes('bytes'), false)
  await assert.rejects(jpeg.verifyPublicationJpeg(s, target, undefined))
})

for (const [name, mutate] of [
  ['EXIF orientation/profile', b => Buffer.concat([b.subarray(0, 2), Buffer.from([255, 225, 0, 8, 69, 120, 105, 102, 0, 0]), b.subarray(2)])],
  ['ICC/MPO metadata', b => Buffer.concat([b.subarray(0, 2), Buffer.from([255, 226, 0, 4, 0, 0]), b.subarray(2)])],
  ['progressive profile', b => { b[frameOffset(b) + 1] = 194; return b }],
  ['oversized decoded dimensions', b => { const p = frameOffset(b); b.writeUInt16BE(4000, p + 5); b.writeUInt16BE(4000, p + 7); return b }],
  ['unsupported Instagram aspect', b => { b.writeUInt16BE(500, frameOffset(b) + 5); return b }],
  ['16-bit precision', b => { b[frameOffset(b) + 4] = 16; return b }],
  ['second embedded file', b => Buffer.concat([b, b])],
  ['missing EOI', b => b.subarray(0, -2)],
]) test(`${name} is rejected before invoking the codec`, async () => {
  let called = false
  await assert.rejects(jpeg.verifyPublicationJpeg(source(mutate(Buffer.from(original))), target, () => { called = true; return decoded() }))
  assert.equal(called, false)
})

test('decoder corruption, mismatched dimensions and malformed pixel receipts fail without raw diagnostic leakage', async () => {
  for (const decode of [() => { throw new Error('PRIVATE CODEC INPUT') }, () => ({ ...decoded(), width: 1 }), () => ({ ...decoded(), data: new Uint8Array(5) })]) {
    await assert.rejects(jpeg.verifyPublicationJpeg(source(original), target, decode), /^Error: Original publication JPEG qualification unavailable\.$/)
  }
  const wrong = { ...source(original), assetSha256: 'a'.repeat(64) }; let called = false
  await assert.rejects(jpeg.verifyPublicationJpeg(wrong, target, () => { called = true; return decoded() })); assert.equal(called, false)
})

test('byte/MIME bounds apply before copy/decode and Facebook/Instagram have distinct profiles', async () => {
  let copied = false
  await assert.rejects(jpeg.verifyPublicationJpeg({ bytes: { length: 8_000_001, slice() { copied = true } }, byteLength: 8_000_001, mediaType: 'image/jpeg' }, target, decoded))
  assert.equal(copied, false)
  await assert.rejects(jpeg.verifyPublicationJpeg({ ...source(original), mediaType: 'image/png' }, target, decoded))
  assert.equal((await jpeg.verifyPublicationJpeg(source(original), { route: 'facebook_page', accountId: '123' }, decoded)).profile, 'facebook_baseline_jpeg_v1')
})
