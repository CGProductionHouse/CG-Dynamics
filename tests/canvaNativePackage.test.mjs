import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { buildNativeCanvaPackage, verifyNativeBindings } from '../scripts/poster-studio/canva-native-package.mjs'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'cg-native-canva-'))
  writeFileSync(resolve(root, 'source.png'), png)
  return { root, scene: {
    schemaVersion: 1, status: 'internal-draft', title: 'Synthetic private import proof', canvas: { width: 1080, height: 1350 },
    brandScopes: [{ key: 'TEST', authority: 'verified-canva-kit', fonts: ['Anton', 'Barlow'], colours: ['#FFFFFF', '#0B1629'] }],
    pages: [{ id: 'january-01', label: 'In Progress', brandScope: 'TEST', notes: 'Internal only; not approved or scheduled.', background: '#0B1629', layers: [
      { id: 'original-photo', type: 'image', asset: './source.png', description: 'Synthetic fixture, no private client content', x: 0, y: 300, width: 1080, height: 900 },
      { id: 'headline', type: 'text', text: 'Before <script> & "offer"', fontFamily: 'Anton', fontSize: 120, colour: '#FFFFFF', x: 70, y: 80, width: 940, height: 160 },
      { id: 'logo', type: 'nativeAsset', assetId: 'MATEST_logo', bindingMode: 'delete-and-insert', x: 800, y: 1200, width: 200, height: 100 },
    ] }],
  } }
}

test('native package preserves source bytes and live text, then isolates an amendment', () => {
  const { root, scene } = fixture()
  const a = buildNativeCanvaPackage(scene, root)
  const changed = structuredClone(scene)
  changed.pages[0].layers[1].text = 'After'
  const b = buildNativeCanvaPackage(changed, root)
  assert.match(a.html, /data-document-role="page"/)
  assert.match(a.html, /data-speaker-notes="Internal only; not approved or scheduled\."/)
  assert.match(a.html, /font-family:'Anton'/)
  assert.match(a.html, /white-space:nowrap/)
  assert.match(a.html, /Before &lt;script&gt; &amp; &quot;offer&quot;/)
  assert.ok(a.html.includes(`data:image/png;base64,${png.toString('base64')}`))
  assert.deepEqual(a.manifest.pages[0].layers[0], b.manifest.pages[0].layers[0])
  assert.deepEqual(a.manifest.pages[0].layers[2], b.manifest.pages[0].layers[2])
  assert.notEqual(a.manifest.htmlSha256, b.manifest.htmlSha256)
  assert.equal(a.manifest.qualityApproval, false)
  assert.equal(a.manifest.publicHosting, false)
})

test('private packaging rejects path escapes, remote files, mismatched bytes and changed hashes', () => {
  const { root, scene } = fixture()
  for (const asset of ['../private.png', 'https://example.com/photo.jpg', resolve(root, 'source.png')]) {
    const copy = structuredClone(scene); copy.pages[0].layers[0].asset = asset
    assert.throws(() => buildNativeCanvaPackage(copy, root), /job-relative|escapes/)
  }
  writeFileSync(resolve(root, 'wrong.png'), '<html>not a photograph</html>')
  scene.pages[0].layers[0].asset = 'wrong.png'
  assert.throws(() => buildNativeCanvaPackage(scene, root), /bytes do not match/)
  scene.pages[0].layers[0].asset = 'source.png'
  scene.pages[0].layers[0].expectedSha256 = '0'.repeat(64)
  assert.throws(() => buildNativeCanvaPackage(scene, root), /hash changed/)
})

test('unverified brand tokens, unsupported layers and oversized imports fail rather than flatten', () => {
  const { root, scene } = fixture()
  const font = structuredClone(scene); font.pages[0].layers[1].fontFamily = 'Arial'
  assert.throws(() => buildNativeCanvaPackage(font, root), /Unverified font/)
  const colour = structuredClone(scene); colour.pages[0].background = '#FF00FF'
  assert.throws(() => buildNativeCanvaPackage(colour, root), /Unverified colour/)
  const layer = structuredClone(scene); layer.pages[0].layers[0].type = 'flatten-entire-poster'
  assert.throws(() => buildNativeCanvaPackage(layer, root), /do not flatten silently/)
  assert.throws(() => buildNativeCanvaPackage(scene, root, { maxBytes: 50 }), /budget|exceeds/)
  const duplicate = structuredClone(scene); duplicate.pages.push(duplicate.pages[0])
  assert.throws(() => buildNativeCanvaPackage(duplicate, root), /Duplicate page ID/)
})

test('review packaging blocks private image metadata while preserving clean source bytes', () => {
  const { root, scene } = fixture()
  const metadata = Buffer.from('GPSLocation\0private fixture only')
  const header = Buffer.alloc(8)
  header.writeUInt32BE(metadata.length)
  header.write('tEXt', 4, 'ascii')
  const contaminated = Buffer.concat([png.subarray(0, 33), header, metadata, Buffer.alloc(4), png.subarray(33)])
  writeFileSync(resolve(root, 'with-metadata.png'), contaminated)
  scene.pages[0].layers[0].asset = 'with-metadata.png'
  assert.throws(() => buildNativeCanvaPackage(scene, root), /Private EXIF/)
})

test('native logo binding requires exact scope, asset and position with no remaining placeholder', () => {
  const { root, scene } = fixture()
  const { manifest } = buildNativeCanvaPackage(scene, root)
  const fill = { page_index: 1, asset_id: 'MATEST_logo', containerElement: { position: { left: 800, top: 1200 }, dimension: { width: 200, height: 100 } } }
  assert.equal(verifyNativeBindings(manifest, { fills: [] }).passed, false)
  assert.equal(verifyNativeBindings(manifest, { fills: [{ ...fill, page_index: 2 }] }).passed, false)
  assert.equal(verifyNativeBindings(manifest, { fills: [fill] }).passed, true)
  assert.equal(verifyNativeBindings(manifest, { fills: [fill, { alt_text: { text: 'UNBOUND NATIVE ASSET MATEST_other' } }] }).passed, false)
  assert.equal(verifyNativeBindings(manifest, { fills: [fill, fill] }).passed, false)
  assert.equal(verifyNativeBindings(manifest, { fills: [{ ...fill, containerElement: { position: { left: 800, top: 1199.86 }, dimension: { width: 200, height: 100.269 } } }] }).passed, true)
  assert.equal(verifyNativeBindings(manifest, { fills: [{ ...fill, containerElement: { position: { left: 800, top: 1200 }, dimension: { width: 230, height: 100 } } }] }).passed, false)
})
