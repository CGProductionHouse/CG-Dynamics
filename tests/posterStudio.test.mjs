import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

test('Poster Studio renders provenance and proves an isolated text amendment', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cg-poster-test-'))
  const engine = resolve(import.meta.dirname, '..', 'scripts', 'poster-studio', 'poster-studio.mjs')
  const asset = resolve(root, 'pixel.svg')
  writeFileSync(asset, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="red"/></svg>')

  const base = {
    schemaVersion: 1,
    document: { id: 'proof-v1', title: 'Proof' },
    canvas: { width: 100, height: 100 },
    layers: [
      { id: 'photo', type: 'image', role: 'source-photo', asset: './pixel.svg', x: 0, y: 0, width: 100, height: 100 },
      { id: 'headline', type: 'text', x: 10, y: 50, text: 'Before', fontFamily: 'Arial', fontSize: 20, fill: '#fff' },
    ],
  }
  const amended = structuredClone(base)
  amended.document.id = 'proof-v2'
  amended.layers[1].text = 'After'
  const v1 = resolve(root, 'v1.json')
  const v2 = resolve(root, 'v2.json')
  const receipt = resolve(root, 'receipt.json')
  writeFileSync(v1, JSON.stringify(base))
  writeFileSync(v2, JSON.stringify(amended))

  const render = spawnSync(process.execPath, [engine, 'render', v1, '--out', root, '--no-preview'], { encoding: 'utf8' })
  assert.equal(render.status, 0, render.stderr)
  const manifest = JSON.parse(readFileSync(resolve(root, 'proof-v1', 'proof-v1.manifest.json')))
  const svg = readFileSync(resolve(root, 'proof-v1', 'proof-v1.svg'), 'utf8')
  assert.equal(manifest.assets.length, 1)
  assert.equal(manifest.layers.length, 2)
  assert.equal(manifest.outputs.png, null)
  assert.equal(manifest.previewScale, 1)
  assert.match(svg, /preserveAspectRatio="xMidYMid slice"/)
  assert.doesNotMatch(svg, /preserve-aspect-ratio=/)
  assert.match(svg, /href="data:image\/svg\+xml;base64,/)
  assert.match(svg, /data-source-sha256="[a-f0-9]{64}"/)
  assert.doesNotMatch(svg, /file:\/\//)

  const compare = spawnSync(process.execPath, [engine, 'compare', v1, v2, '--out', receipt], { encoding: 'utf8' })
  assert.equal(compare.status, 0, compare.stderr)
  const diff = JSON.parse(readFileSync(receipt))
  assert.equal(diff.changedLayerCount, 1)
  assert.equal(diff.unchangedLayerCount, 1)
  assert.deepEqual(diff.changes.map((change) => change.id), ['headline'])
  assert.deepEqual(diff.changedResourceGroups, [])
})

test('Portable font bytes and licence travel with live type; stale hashes and missing rights fail', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'cg-poster-font-test-'))
  const engine = resolve(import.meta.dirname, '..', 'scripts', 'poster-studio', 'poster-studio.mjs')
  // Synthetic container prefix tests transport/provenance, not real font rendering.
  // A real licensed face is exercised separately by the private visual proof.
  const bytes = Buffer.from('000100000000000000000000', 'hex')
  const hash = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(resolve(root, 'synthetic.ttf'), bytes)
  writeFileSync(resolve(root, 'licence.txt'), 'Synthetic test notice <not-markup>')
  const base = {
    schemaVersion: 1,
    document: { id: 'font-proof', title: 'Font proof' },
    canvas: { width: 100, height: 100 },
    fonts: [{ family: 'Exact Face', asset: './synthetic.ttf', licenceAsset: './licence.txt', expectedSha256: hash }],
    layers: [{ id: 'headline', type: 'text', text: 'Live', x: 10, y: 50, fontFamily: 'Exact Face', fontSize: 20, fill: '#fff' }],
  }
  const path = resolve(root, 'scene.json')
  const run = (scene) => {
    writeFileSync(path, JSON.stringify(scene))
    return spawnSync(process.execPath, [engine, 'render', path, '--out', root, '--no-preview'], { encoding: 'utf8' })
  }
  const good = run(base)
  assert.equal(good.status, 0, good.stderr)
  const svg = readFileSync(resolve(root, 'font-proof', 'font-proof.svg'), 'utf8')
  const manifest = JSON.parse(readFileSync(resolve(root, 'font-proof', 'font-proof.manifest.json')))
  assert.match(svg, /data:font\/ttf;base64,AAEAAAAAAAAAAAAA/)
  assert.match(svg, /<text[^>]+font-family="Exact Face"/)
  assert.match(svg, /Synthetic test notice &lt;not-markup&gt;/)
  assert.equal(manifest.fonts[0].sha256, hash)
  assert.equal(manifest.fonts[0].licence.sha256, createHash('sha256').update('Synthetic test notice <not-markup>').digest('hex'))
  assert.doesNotMatch(svg, /src:url\(["']?https?:|file:\/\//)

  const stale = structuredClone(base)
  stale.fonts[0].expectedSha256 = '0'.repeat(64)
  assert.match(run(stale).stderr, /Font hash mismatch/)
  const missing = structuredClone(base)
  delete missing.fonts[0].licenceAsset
  assert.match(run(missing).stderr, /licenceAsset is required/)
  const remote = structuredClone(base)
  remote.fonts[0].asset = 'https://example.invalid/font.ttf'
  assert.match(run(remote).stderr, /job-local file paths/)
  const outside = structuredClone(base)
  outside.fonts[0].licenceAsset = '../unrelated-private-file.txt'
  assert.match(run(outside).stderr, /inside the scene job directory/)
  writeFileSync(path, JSON.stringify(base))
  const oversized = spawnSync(process.execPath, [engine, 'render', path, '--out', root, '--scale', '999', '--no-preview'], { encoding: 'utf8' })
  assert.match(oversized.stderr, /--scale must be an integer from 1 to 4/)

  const before = resolve(root, 'before.json')
  const after = resolve(root, 'after.json')
  const changedFace = structuredClone(base)
  changedFace.fonts[0].family = 'Other Face'
  writeFileSync(before, JSON.stringify(base))
  writeFileSync(after, JSON.stringify(changedFace))
  const comparison = spawnSync(process.execPath, [engine, 'compare', before, after], { encoding: 'utf8' })
  assert.equal(comparison.status, 0, comparison.stderr)
  assert.deepEqual(JSON.parse(comparison.stdout).changedResourceGroups, ['fonts'])
})
