import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { auditCaption } from '../scripts/poster-studio/caption-guard.mjs'

const sha = text => createHash('sha256').update(text).digest('hex')
test('preserves real curly punctuation and accented client wording', () => {
  const text = 'We’ll help. Café.\n\nexample.co.za'
  assert.equal(auditCaption(Buffer.from(text), sha(text)).canonicalSha256, sha(text))
})
test('Windows line endings compare with allocated LF text without altering the file', () => {
  const text = 'One.\n\nTwo.'
  assert.equal(auditCaption(Buffer.from(text.replaceAll('\n', '\r\n')), sha(text)).lineEndingsNormalised, true)
})
test('rejects malformed UTF-8 instead of silently replacing it', () => {
  assert.throws(() => auditCaption(Buffer.from([0xc3, 0x28]), sha('x')))
})
test('rejects garbled punctuation even when its hash was accidentally recorded', () => {
  const text = 'Weâ€™ll help.'
  assert.throws(() => auditCaption(Buffer.from(text), sha(text)), /encoding corruption/)
})
test('rejects stale allocated copy and does not silently trim it', () => {
  assert.throws(() => auditCaption(Buffer.from('Changed'), sha('Original')), /allocated/)
  assert.throws(() => auditCaption(Buffer.from('Original\n'), sha('Original')), /allocated/)
})
test('rejects agent signatures but allows an ordinary in-sentence name', () => {
  for (const signature of ['- PICASSO', '— Nolan', 'picasso']) {
    const text = `Caption.\n\n${signature}`
    assert.throws(() => auditCaption(Buffer.from(text), sha(text)), /signature/)
  }
  const text = 'Discuss the draft with Nolan before approval.'
  assert.equal(auditCaption(Buffer.from(text), sha(text)).transportChecksPassed, true)
})
test('rejects BOM, controls, replacement characters and empty copy', () => {
  for (const text of ['\ufeffHello', 'Hello\u0000', 'Hello\ufffd', '   ']) {
    assert.throws(() => auditCaption(Buffer.from(text), sha(text)))
  }
})
