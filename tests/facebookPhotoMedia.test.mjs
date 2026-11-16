import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { createHash } from 'node:crypto'
import { deflateSync } from 'node:zlib'

let server, media
before(async () => {
  server = await createServer({ logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: 'custom' })
  media = await server.ssrLoadModule('/supabase/functions/_shared/facebookPhotoMedia.ts')
})
after(async () => { await server?.close() })
const target = { route: 'facebook_page', accountId: '123' }
const NOW = Date.parse('2026-11-16T10:00:00Z')
function crc(b) { let c = -1; for (const v of b) { c ^= v; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1 } return (c ^ -1) >>> 0 }
function chunk(type, data = Buffer.alloc(0)) {
  const result = Buffer.alloc(data.length + 12); result.writeUInt32BE(data.length); result.write(type, 4); data.copy(result, 8)
  result.writeUInt32BE(crc(result.subarray(4, -4)), result.length - 4); return result
}
function png({ width = 2, height = 2, depth = 8, color = 6, interlace = 0, raw, compressed, extra = [], trailing = Buffer.alloc(0) } = {}) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = depth; header[9] = color; header[12] = interlace
  const data = compressed ?? deflateSync(raw ?? Buffer.alloc((width * ({ 0: 1, 2: 3, 4: 2, 6: 4 }[color] ?? 4) + 1) * height))
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), ...extra, chunk('IDAT', data), chunk('IEND'), trailing])
}
const snapshot = bytes => ({ bytes: Uint8Array.from(bytes), byteLength: bytes.length, mediaType: 'image/png', assetSha256: createHash('sha256').update(bytes).digest('hex') })
const run = (b, t = target) => media.verifyFacebookPhotoMedia(snapshot(b), t, () => NOW)

test('fully validates original static PNG pixels without provider/upload/transform or token output', async () => {
  for (const color of [0, 2, 4, 6]) {
    const b = png({ color }), before = Buffer.from(b), result = await run(b)
    assert.deepEqual(result, { verified: true, profile: 'facebook_static_png_8bit_v1', checkedAt: new Date(NOW).toISOString() })
    assert.deepEqual(b, before)
  }
})

for (const [name, bytes] of [
  ['signature only', () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ['bad CRC', () => { const b = png(); b[29] ^= 1; return b }],
  ['bad zlib with valid CRC', () => png({ compressed: Buffer.from('not zlib') })],
  ['truncated pixel stream', () => png({ raw: Buffer.alloc(3) })],
  ['expanded pixel overflow', () => png({ raw: Buffer.alloc(100_000) })],
  ['invalid scanline filter', () => png({ raw: Buffer.from([5, ...Array(17).fill(0)]) })],
  ['APNG', () => png({ extra: [chunk('acTL', Buffer.alloc(8))] })],
  ['palette', () => png({ color: 3 })],
  ['16-bit profile', () => png({ depth: 16 })],
  ['interlaced profile', () => png({ interlace: 1 })],
  ['dimension bomb', () => png({ width: 4097, height: 1, raw: Buffer.alloc(1) })],
  ['zero dimensions', () => png({ width: 0, raw: Buffer.alloc(1) })],
  ['trailing payload', () => png({ trailing: Buffer.from('private payload') })],
  ['unreviewed compressed metadata', () => png({ extra: [chunk('iCCP', Buffer.from('compressed profile'))] })],
]) test(`rejects ${name} rather than passing signature-only qualification`, async () => { await assert.rejects(run(bytes()), /qualification unavailable/) })

test('rejects changed hash/byte length/MIME/route and nonfinite clocks', async () => {
  const b = png(), s = snapshot(b)
  for (const change of [{ assetSha256: 'a'.repeat(64) }, { byteLength: s.byteLength + 1 }, { mediaType: 'image/jpeg' }]) {
    await assert.rejects(media.verifyFacebookPhotoMedia({ ...s, ...change }, target))
  }
  await assert.rejects(run(b, { ...target, route: 'instagram_login' }))
  await assert.rejects(media.verifyFacebookPhotoMedia(s, target, () => NaN))
})

test('accepts real filter variants and contiguous split IDAT, rejects duplicate header and interrupted IDAT', async () => {
  const rows = Buffer.from([0, 1, 2, 3, 4].flatMap(f => [f, ...Array(8).fill(255)]))
  const b = png({ height: 5, raw: rows }), s = snapshot(b)
  assert.equal((await media.verifyFacebookPhotoMedia(s, target)).verified, true)
  const base = png(), header = base.subarray(8, 33), z = deflateSync(Buffer.alloc(18)), signature = base.subarray(0, 8)
  const split = Buffer.concat([signature, header, chunk('IDAT', z.subarray(0, 3)), chunk('IDAT', z.subarray(3)), chunk('IEND')])
  assert.equal((await run(split)).verified, true)
  await assert.rejects(run(Buffer.concat([signature, header, header, base.subarray(33)])))
  await assert.rejects(run(Buffer.concat([signature, header, chunk('IDAT', z.subarray(0, 3)), chunk('sRGB', Buffer.from([0])), chunk('IDAT', z.subarray(3)), chunk('IEND')])))
})
