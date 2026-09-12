// #224: every guideline video is named "Video XX - Descriptive Name" from its ordered place.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let m

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })
  m = await server.ssrLoadModule('/src/lib/contentGuidelineNaming.ts')
})

after(async () => {
  await server?.close()
})

test('the number is the two-digit ordered position', () => {
  assert.equal(m.guidelineVideoNumber(1), 'Video 01')
  assert.equal(m.guidelineVideoNumber(9), 'Video 09')
  assert.equal(m.guidelineVideoNumber(12), 'Video 12')
  assert.equal(m.guidelineVideoNumber(0), 'Video 00')
  assert.equal(m.guidelineVideoNumber(2.5), 'Video 00')
})

test('names are "Video XX - Descriptive Name"', () => {
  assert.equal(m.guidelineVideoName(1, 'Colour-matching at the counter'), 'Video 01 - Colour-matching at the counter')
  assert.equal(m.guidelineVideoName(3, '  Primer before paint  '), 'Video 03 - Primer before paint')
})

test('legacy number prefixes are replaced by the current order', () => {
  assert.equal(m.guidelineVideoName(2, 'VIDEO 1 - DULUX'), 'Video 02 - DULUX')
  assert.equal(m.guidelineVideoName(5, 'Video 02 — Kitchen refresh'), 'Video 05 - Kitchen refresh')
  assert.equal(m.guidelineVideoName(4, 'Video #7: Weekend project'), 'Video 04 - Weekend project')
  assert.equal(m.guidelineVideoName(1, 'video 3'), 'Video 01')
})

test('a number that is part of the real name is kept', () => {
  assert.equal(m.guidelineVideoName(1, 'Video 10 Tips for Painters'), 'Video 01 - Video 10 Tips for Painters')
  assert.equal(m.guidelineVideoName(2, 'Videography behind the scenes'), 'Video 02 - Videography behind the scenes')
})

test('an empty name still shows the number', () => {
  assert.equal(m.guidelineVideoName(6, ''), 'Video 06')
  assert.equal(m.guidelineVideoName(6, null), 'Video 06')
  assert.equal(m.stripVideoNumberPrefix(undefined), '')
})

test('the editor, Shoot Mode and client portal all use the shared name', async () => {
  const editor = await readFile(new URL('../src/pages/admin/ContentGuidelineDocumentEditor.tsx', import.meta.url), 'utf8')
  const guideline = await readFile(new URL('../src/pages/admin/contentGuideline.tsx', import.meta.url), 'utf8')
  const portal = await readFile(new URL('../src/pages/client/ClientContentGuidesPage.tsx', import.meta.url), 'utf8')
  for (const [label, source] of [['editor', editor], ['shoot mode', guideline], ['client portal', portal]]) {
    assert.match(source, /guidelineVideoName\(/, `${label} renders the shared name`)
  }
})

test('the Edge Function copy of the prefix rule does not drift from the app', async () => {
  const app = await readFile(new URL('../src/lib/contentGuidelineNaming.ts', import.meta.url), 'utf8')
  const fn = await readFile(new URL('../supabase/functions/suggest-content-videos/directorModes.ts', import.meta.url), 'utf8')
  const rule = source => source.match(/const NUMBER_PREFIX = (\/.*\/i)/)?.[1]
  assert.ok(rule(app), 'app defines the prefix rule')
  assert.equal(rule(fn), rule(app), 'the Edge Function uses the same rule')
})

test('both copies strip the same prefixes', async () => {
  const modes = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
  for (const title of ['VIDEO 1 - DULUX', 'Video 02 — Kitchen refresh', 'Video 10 Tips for Painters', 'Colour matching']) {
    assert.equal(modes.cleanIdeaTitle(title), m.stripVideoNumberPrefix(title), title)
  }
})
