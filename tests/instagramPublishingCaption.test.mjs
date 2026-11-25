import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, captions
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  captions = await server.ssrLoadModule('/supabase/functions/_shared/instagramPublishingCaption.ts')
})
after(async () => { await server?.close() })
const tags = (prefix, count) => Array.from({ length: count }, (_, n) => `${prefix}tag${n}`).join(' ')

for (const [name, value, blocker] of [
  ['exact character bound', 'x'.repeat(2200), null], ['over character bound', 'x'.repeat(2201), 'INSTAGRAM_CAPTION_TOO_LONG'],
  ['exact hashtag bound', tags('#', 30), null], ['over hashtag bound', tags('#', 31), 'INSTAGRAM_HASHTAG_LIMIT'],
  ['exact mention bound', tags('@', 20), null], ['over mention bound', tags('@', 21), 'INSTAGRAM_MENTION_LIMIT'],
  ['Unicode hashtags', '#café_za '.repeat(31), 'INSTAGRAM_HASHTAG_LIMIT'],
  ['Unicode scalar pairs inside pilot unit bound', '🛠'.repeat(1100), null],
  ['Unicode scalar pairs over pilot unit bound', '🛠'.repeat(1101), 'INSTAGRAM_CAPTION_TOO_LONG'],
  ['literal hash and at symbols', '# @ / R# @ ', null],
]) test(name, () => { assert.equal(captions.instagramCaptionBlocker(value), blocker) })

test('business email addresses do not consume mention slots or alter the original text', () => {
  const original = `Approved café copy\r\n${tags('@', 20)}\nContact sales+job@client.co.za / info@client.co.za.  `
  assert.equal(captions.instagramCaptionBlocker(original), null)
  captions.requireInstagramPublishingCaption(original)
  assert.equal(original.endsWith('.  '), true)
})

test('invalid UTF-16 and missing text fail with fixed codes, never private caption text', () => {
  for (const value of [null, undefined, 5, {}, '', '  \n\t', '\ud800', '\udc00', 'PRIVATE\ud800x', 'PRIVATE\0x']) {
    assert.equal(captions.instagramCaptionBlocker(value), 'INSTAGRAM_CAPTION_INVALID')
    assert.throws(() => captions.requireInstagramPublishingCaption(value), /^Error: INSTAGRAM_CAPTION_INVALID$/)
  }
})

test('duplicate tag occurrences are not silently removed to squeeze unapproved copy through the limit', () => {
  assert.equal(captions.instagramCaptionBlocker('#same '.repeat(31)), 'INSTAGRAM_HASHTAG_LIMIT')
  assert.equal(captions.instagramCaptionBlocker('@same '.repeat(21)), 'INSTAGRAM_MENTION_LIMIT')
})
