import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

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
  assert.match(svg, /preserveAspectRatio="xMidYMid slice"/)
  assert.doesNotMatch(svg, /preserve-aspect-ratio=/)

  const compare = spawnSync(process.execPath, [engine, 'compare', v1, v2, '--out', receipt], { encoding: 'utf8' })
  assert.equal(compare.status, 0, compare.stderr)
  const diff = JSON.parse(readFileSync(receipt))
  assert.equal(diff.changedLayerCount, 1)
  assert.equal(diff.unchangedLayerCount, 1)
  assert.deepEqual(diff.changes.map((change) => change.id), ['headline'])
})
