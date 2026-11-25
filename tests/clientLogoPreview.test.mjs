import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { verifiedClientPreview } from '../server/clientLogoPreview.js'
import { createGuidelinePreviewHandler } from '../server/guidelinePreview.js'
import { previewBackground } from '../scripts/build-client-preview-logos.mjs'
import { decodePng } from '../scripts/sync-client-logos.mjs'

const manifest = JSON.parse(readFileSync('public/client-preview-logos/manifest.json', 'utf8'))
const read = path => readFileSync(`public${path}`)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('every existing public PNG has an exact-source opaque preview; raw artwork is unchanged', async () => {
  const originals = readdirSync('public/client-logos').filter(name => name.endsWith('.png'))
  assert.equal(Object.keys(manifest.assets).length, originals.length)
  for (const name of originals) {
    const source = `/client-logos/${name}`, asset = manifest.assets[source]
    assert.equal(asset.sourceSha256, hash(read(source)), name)
    assert.equal(await verifiedClientPreview(source, manifest, read), asset.path, name)
    const png = decodePng(read(asset.path))
    assert.equal(png.width, 1200, name); assert.equal(png.height, 630, name)
    for (let p = 3; p < png.rgba.length; p += 4) assert.equal(png.rgba[p], 255, name)
  }
})

test('RC white artwork has a dark solid canvas, padding and legible original white pixels', () => {
  const asset = manifest.assets['/client-logos/rc-polypipe.png'], png = decodePng(read(asset.path))
  assert.deepEqual(asset.background, [8, 20, 16])
  assert.deepEqual([...png.rgba.subarray(0, 4)], [8, 20, 16, 255])
  let white = 0
  for (let p = 0; p < png.rgba.length; p += 4) if (png.rgba[p] > 240 && png.rgba[p + 1] > 240 && png.rgba[p + 2] > 240) white++
  assert.ok(white > 10_000)
})

test('white and black marks choose contrasting canvases; empty artwork is refused', () => {
  assert.deepEqual(previewBackground({ rgba: Buffer.from([255,255,255,255]) }), [8,20,16])
  assert.deepEqual(previewBackground({ rgba: Buffer.from([0,0,0,255]) }), [248,249,247])
  assert.throws(() => previewBackground({ rgba: Buffer.from([255,255,255,0]) }), /empty/)
  assert.deepEqual(manifest.assets['/client-logos/first-tech.png'].background, [8,20,16], 'small white wording must remain visible too')
})

test('missing/stale/corrupt/foreign previews fail closed with no arbitrary file read', async () => {
  const source = '/client-logos/rc-polypipe.png', original = manifest.assets[source]
  for (const changed of [null, { ...manifest, version: 2 }, { version: 3, assets: {} },
    { version: 3, assets: { [source]: { ...original, path: '/client-preview-logos/foreign-0123456789abcdef.png' } } },
    { version: 3, assets: { [source]: { ...original, path: '/private/secrets' } } }]) {
    let reads = 0
    assert.equal(await verifiedClientPreview(source, changed, () => { reads++; return Buffer.alloc(0) }), null)
    assert.equal(reads, 0)
  }
  assert.equal(await verifiedClientPreview(source, manifest, () => Buffer.from('changed')), null)
  assert.equal(await verifiedClientPreview(source, manifest, p => p === source ? read(p) : Buffer.from('corrupt')), null)
  assert.equal(await verifiedClientPreview(source, manifest, () => { throw Error('unavailable') }), null)
  assert.equal(await verifiedClientPreview('https://private/logo.png', manifest, read), null)
})

test('raw transparent logos are never emitted even if a resolver offers one', async () => {
  const handler = createGuidelinePreviewHandler({ loadTemplate: async () => '<head><title>CG</title></head>',
    fetchSnapshot: async () => ({ client: { name: 'RC-Polypipe' }, guide: { videos: [{}], published_at: '2026-11-24T10:00:00Z' } }),
    logoForClient: () => '/client-logos/rc-polypipe.png' })
  const html = await (await handler(new Request('https://local/guidelines/rc-polypipe-content-guideline/' + 'a'.repeat(64)))).text()
  assert.match(html, /RC-Polypipe/); assert.doesNotMatch(html, /og:image|twitter:image|summary_large_image/)
})
