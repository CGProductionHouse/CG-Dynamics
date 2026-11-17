import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { publicationCodecVite } from './fixtures/publicationCodecVite.mjs'

let server, qualify
before(async () => {
  server = await createServer({ configFile: false, plugins: [publicationCodecVite], server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  qualify = (await server.ssrLoadModule('/supabase/functions/_shared/facebookPublicationMedia.ts')).verifyFacebookPublicationMedia
})
after(async () => server?.close())
const original = readFileSync('tests/fixtures/publication-baseline-320.jpg'), target = { route: 'facebook_page', accountId: '123' }
const snapshot = bytes => ({ bytes: Uint8Array.from(bytes), byteLength: bytes.length, mediaType: 'image/jpeg', assetSha256: createHash('sha256').update(bytes).digest('hex') })
const frame = b => { const i = b.indexOf(Buffer.from([255, 192])); assert.ok(i > 0); return i }

test('Facebook dispatch uses the actual approved decoder and preserves original bytes/hash/MIME', async () => {
  const source = snapshot(original), proof = await qualify(source, target)
  assert.equal(proof.verified, true); assert.equal(proof.profile, 'facebook_baseline_jpeg_v1')
  assert.deepEqual(Buffer.from(source.bytes), original); assert.equal(source.mediaType, 'image/jpeg')
  assert.equal(snapshot(original).assetSha256, source.assetSha256)
  assert.equal(JSON.stringify(proof).includes('bytes'), false)
})

for (const [name, change] of [
  ['EXIF', b => Buffer.concat([b.subarray(0, 2), Buffer.from([255, 225, 0, 8, 69, 120, 105, 102, 0, 0]), b.subarray(2)])],
  ['ICC', b => Buffer.concat([b.subarray(0, 2), Buffer.from([255, 226, 0, 4, 0, 0]), b.subarray(2)])],
  ['progressive', b => { b[frame(b) + 1] = 194; return b }],
  ['decode bomb dimensions', b => { const i = frame(b); b.writeUInt16BE(4000, i + 5); b.writeUInt16BE(4000, i + 7); return b }],
  ['trailing second file', b => Buffer.concat([b, b])],
  ['missing end marker', b => b.subarray(0, -2)],
  ['header-only corrupt entropy', b => {
    const i = b.indexOf(Buffer.from([255, 218])); assert.ok(i > 0)
    return Buffer.concat([b.subarray(0, i + 2 + b.readUInt16BE(i + 2)), Buffer.from([0, 255, 217])])
  }],
]) test(`Facebook actual JPEG qualification rejects ${name}`, async () => {
  await assert.rejects(qualify(snapshot(change(Buffer.from(original))), target), /^Error: Original publication JPEG qualification unavailable\.$/)
})

test('Facebook dispatch refuses MIME spoof, changed hash and foreign routes', async () => {
  await assert.rejects(qualify({ ...snapshot(original), mediaType: 'image/png' }, target))
  await assert.rejects(qualify({ ...snapshot(original), mediaType: 'image/webp' }, target))
  await assert.rejects(qualify({ ...snapshot(original), assetSha256: 'a'.repeat(64) }, target))
  await assert.rejects(qualify(snapshot(original), { ...target, route: 'instagram_login' }))
})
