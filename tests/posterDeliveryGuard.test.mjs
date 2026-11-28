import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { auditDelivery } from '../scripts/poster-studio/delivery-guard.mjs'

const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'picasso-delivery-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const caption = 'A fresh January idea.\n\nAsk us about your project.'
  writeFileSync(join(root, 'poster.png'), png)
  writeFileSync(join(root, 'caption.txt'), caption)
  const entry = { poster: 'DP01', pageId: 'page-one', png: 'poster.png', sha256: sha(png),
    dimensions: [1, 1], caption: 'caption.txt', captionSha256: sha(caption) }
  const manifest = { clientId: 'synthetic-client', designId: 'synthetic-design', recipient: 'Internal review', entries: [entry] }
  return { root, manifest, entry, caption }
}

test('an unrecorded transport pass is never creative approval or send permission', t => {
  const { root, manifest } = fixture(t)
  const result = auditDelivery(manifest, root)
  assert.equal(result.transportChecksPassed, true)
  assert.equal(result.unrecordedCount, 1)
  assert.equal(result.automaticSendAllowed, false)
})

test('Delivered, Sent and ambiguous message witnesses all prevent blind replay', t => {
  const { root, manifest, entry } = fixture(t)
  for (const status of ['Delivered', 'Sent', 'unknown']) {
    entry.messageId = 'observed-message'
    entry.deliveryStatus = status
    assert.equal(auditDelivery(manifest, root).entries[0].state, 'already-recorded')
  }
})

test('a new workbench/page name cannot hide a matching prior payload', t => {
  const { root, manifest, entry } = fixture(t)
  const old = { ...manifest, designId: 'earlier-workbench', entries: [{ ...entry, pageId: 'old-page', messageId: 'prior-send' }] }
  assert.deepEqual(auditDelivery(manifest, root, [old]).entries[0].messageIds, ['prior-send'])
})

test('same-page artwork with a new caption still requires review of its earlier send', t => {
  const { root, manifest, entry } = fixture(t)
  const old = { ...manifest, entries: [{ ...entry, captionSha256: sha('Previous caption'), messageId: 'prior-send' }] }
  assert.equal(auditDelivery(manifest, root, [old]).alreadyRecordedCount, 1)
})

test('other clients or destinations do not masquerade as this delivery witness', t => {
  const { root, manifest, entry } = fixture(t)
  const sent = { ...entry, messageId: 'elsewhere' }
  const result = auditDelivery(manifest, root, [
    { ...manifest, clientId: 'another-client', entries: [sent] },
    { ...manifest, recipient: 'Different group', entries: [sent] },
  ])
  assert.equal(result.unrecordedCount, 1)
})

test('a status without a message ID is held, not treated as unsent', t => {
  const { root, manifest, entry } = fixture(t)
  entry.deliveryStatus = 'Delivered'
  assert.equal(auditDelivery(manifest, root).holdCount, 1)
})

test('changed artwork bytes and false dimensions invalidate the selected export', t => {
  const { root, manifest, entry } = fixture(t)
  entry.dimensions = [2160, 2700]
  assert.match(auditDelivery(manifest, root).entries[0].findings.join(), /dimensions/)
  entry.dimensions = [1, 1]
  writeFileSync(join(root, 'poster.png'), Buffer.concat([png, Buffer.from('changed')]))
  assert.match(auditDelivery(manifest, root).entries[0].findings.join(), /bytes differ/)
})

test('allocated captions retain Unicode and CRLF, while signatures and stale copy fail', t => {
  const { root, manifest, entry } = fixture(t)
  const text = 'We’ll help. Café.\n\nJanuary.'
  entry.captionSha256 = sha(text)
  writeFileSync(join(root, 'caption.txt'), text.replaceAll('\n', '\r\n'))
  assert.equal(auditDelivery(manifest, root).transportChecksPassed, true)
  for (const bad of ['Changed caption.', `${text}\n\n— PICASSO`]) {
    writeFileSync(join(root, 'caption.txt'), bad)
    assert.equal(auditDelivery(manifest, root).holdCount, 1)
  }
})

test('duplicate selections and identical payloads are held even with different page names', t => {
  const { root, manifest, entry } = fixture(t)
  manifest.entries.push({ ...entry, pageId: 'second-page', poster: 'DP02' })
  assert.match(auditDelivery(manifest, root).entries[1].findings.join(), /Duplicate artwork/)
  manifest.entries[1].pageId = entry.pageId
  assert.match(auditDelivery(manifest, root).entries[1].findings.join(), /Duplicate poster\/page/)
})

test('private file escapes and malformed histories cannot silently pass', t => {
  const { root, manifest, entry } = fixture(t)
  const outside = join(root, '..', `outside-${root.split(/[\\/]/).pop()}.png`)
  writeFileSync(outside, png)
  t.after(() => rmSync(outside, { force: true }))
  entry.png = `../${outside.split(/[\\/]/).pop()}`
  assert.match(auditDelivery(manifest, root).entries[0].findings.join(), /escapes/)
  assert.throws(() => auditDelivery(manifest, root, [{}]), /Malformed/)
})

test('CLI refuses replay and cannot overwrite its manifest, artwork or an existing receipt', t => {
  const { root, manifest, entry } = fixture(t)
  entry.messageId = 'observed-message'
  entry.deliveryStatus = 'Delivered'
  const input = join(root, 'manifest.json')
  const output = join(root, 'receipt.json')
  writeFileSync(input, JSON.stringify(manifest))
  const run = out => spawnSync(process.execPath, ['scripts/poster-studio/delivery-guard.mjs', input, '--out', out], { encoding: 'utf8' })
  assert.equal(run(output).status, 1)
  assert.equal(JSON.parse(readFileSync(output, 'utf8')).alreadyRecordedCount, 1)
  const before = readFileSync(output)
  assert.equal(run(output).status, 1)
  assert.deepEqual(readFileSync(output), before)
  assert.equal(run(input).status, 1)
  assert.deepEqual(JSON.parse(readFileSync(input, 'utf8')), manifest)
  assert.equal(run(join(root, 'poster.png')).status, 1)
  assert.deepEqual(readFileSync(join(root, 'poster.png')), png)
})
