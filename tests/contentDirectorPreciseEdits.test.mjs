import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, modes, edits, workflow
const writes = []
let stored
const target = {
  id: 'video-a', position: 1, title: 'A customer decision', objective: 'Explain the verified service',
  hook: 'Keep this hook', notes: '15 seconds. Text-only: no spoken dialogue.',
  platform: 'Instagram Reels', format: 'text-only', targetMonth: '2026-10', deliverableLabel: null,
  updatedAt: '2026-10-07T09:00:00.123456+00:00', script: 'Original on-screen script',
  shotBreakdown: '1. Door\n2. Product', cta: 'Original CTA',
}
before(async () => {
  server = await createServer({ configFile: false, plugins: [{ name: 'exact-revision-fixture', enforce: 'pre',
    transform(_code, id) { if (id.replaceAll('\\', '/').endsWith('/lib/supabase.ts')) return 'export const supabase=globalThis.__directorDbFixture' },
  }], optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  globalThis.__directorDbFixture = { from(table) {
    assert.equal(table, 'content_guide_ideas')
    const filters = {}, query = { update(patch) { writes.push({ patch, filters }); return query },
      eq(field, value) { filters[field] = value; return query }, select() { return query },
      async single() {
        if (stored.id !== filters.id || stored.updated_at !== filters.updated_at) return { data: null, error: { code: 'PGRST116' } }
        stored = { ...stored, ...writes.at(-1).patch, updated_at: '2026-10-07T09:00:01.123456+00:00' }
        return { data: { ...stored }, error: null }
      } }
    return query
  } }
  modes = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
  edits = await server.ssrLoadModule('/src/lib/contentDirectorEdits.ts')
  workflow = await server.ssrLoadModule('/src/lib/contentWorkflow.ts')
})
after(async () => { await server?.close(); delete globalThis.__directorDbFixture })

test('saved 15-second text-only brief is authoritative, not a 30–75-second spoken default', () => {
  const prompt = modes.buildDevelopPrompt({ clientName: 'Fixture', guideExcerpt: 'Verified service only',
    targets: [target], marketingKnowledge: [] })
  assert.doesNotMatch(prompt.system, /30-75 seconds/)
  assert.match(prompt.user, /Instagram Reels/)
  assert.match(prompt.user, /text-only/)
  assert.match(prompt.user, /15 seconds/)
  assert.match(prompt.system, /duration.*staff/i)
})

test('CTA-only proposals need no script and discard unrequested model fields', () => {
  const [proposal] = modes.parseDevelopments(JSON.stringify({ developments: [{ videoId: target.id,
    cta: 'Ask about the verified service', script: 'REPLACE SCRIPT', shotBreakdown: 'REORDER',
    baseUpdatedAt: 'model invented' }] }), [target], ['cta'])
  assert.ok(proposal)
  assert.equal(proposal.cta, 'Ask about the verified service')
  assert.equal(proposal.script, '')
  assert.equal(proposal.shotBreakdown, '')
  assert.equal(proposal.baseUpdatedAt, target.updatedAt)
  assert.deepEqual(proposal.targetFields, ['cta'])
})

test('CTA-only prompt carries current script and shots but forbids rewriting them', () => {
  const prompt = modes.buildDevelopPrompt({ clientName: 'Fixture', guideExcerpt: 'Service',
    targets: [target], marketingKnowledge: [], targetFields: ['cta'] })
  assert.match(prompt.system, /ONLY.*cta/)
  assert.match(prompt.user, /Original on-screen script/)
  assert.match(prompt.user, /1\. Door/)
  assert.match(prompt.user, /Original CTA/)
})

test('unknown video, blank CTA and invalid fields fail closed', () => {
  assert.deepEqual(modes.parseDevelopments('{"developments":[{"videoId":"other","cta":"No"}]}', [target], ['cta']), [])
  assert.deepEqual(modes.parseDevelopments('{"developments":[{"videoId":"video-a","cta":" "}]}', [target], ['cta']), [])
  assert.deepEqual(modes.parseDevelopments('{"developments":[{"videoId":"video-a","script":"Bad"}]}', [target], ['hook']), [])
})

test('accept CTA only, reload: original hook, script, shot order, receipt and brief survive', async () => {
  stored = { id: target.id, updated_at: target.updatedAt, hook: target.hook, script: target.script,
    shot_breakdown: target.shotBreakdown, cta: target.cta, notes: 'Trusted receipt',
    platform: target.platform, format: target.format, requirements: '15 seconds' }
  const original = { ...stored }
  const proposal = { videoId: target.id, baseUpdatedAt: target.updatedAt, targetFields: ['cta'],
    cta: 'Ask about the service', script: 'Unrequested' }
  const prepared = edits.developmentPatch(stored, proposal, 'replace')
  assert.deepEqual(prepared.patch, { cta: 'Ask about the service' })
  const result = await workflow.updateGuidelineVideo(target.id, prepared.patch, proposal.baseUpdatedAt)
  assert.equal(result.error, null)
  const reloaded = JSON.parse(JSON.stringify(stored))
  for (const field of ['hook', 'script', 'shot_breakdown', 'notes', 'platform', 'format', 'requirements']) assert.equal(reloaded[field], original[field])
  assert.equal(reloaded.cta, 'Ask about the service')
  assert.equal(writes.at(-1).filters.updated_at, target.updatedAt, 'microseconds are not truncated')
  const duplicate = await workflow.updateGuidelineVideo(target.id, prepared.patch, proposal.baseUpdatedAt)
  assert.match(duplicate.error, /changed|accessible/)
  assert.deepEqual(stored, reloaded)
})

test('concurrent human update between proposal and acceptance is denied atomically', async () => {
  stored = { id: target.id, updated_at: '2026-10-07T10:00:00Z', cta: 'Newer human CTA', script: 'Newer human script' }
  const snapshot = { ...stored }
  const result = await workflow.updateGuidelineVideo(target.id, { cta: 'Old AI draft' }, target.updatedAt)
  assert.match(result.error, /Reload/)
  assert.deepEqual(stored, snapshot)
})

test('wrong identity, missing revision, stale revision and unexpected fields cannot form an accepted patch', () => {
  const video = { id: target.id, updated_at: target.updatedAt }
  const good = { videoId: target.id, baseUpdatedAt: target.updatedAt, cta: 'Proposed', targetFields: ['cta'] }
  for (const bad of [{ videoId: 'other' }, { baseUpdatedAt: null }, { baseUpdatedAt: '2026-10-07T10:00:00Z' },
    { targetFields: ['hook'] }, { targetFields: [] }, { targetFields: ['cta', 'cta'] }]) {
    const result = edits.developmentPatch(video, { ...good, ...bad }, 'replace')
    assert.ok(result.error); assert.deepEqual(result.patch, {})
  }
})

test('missing or malformed CAS token rejects before a database request', async () => {
  const before = writes.length
  for (const token of ['', 'garbage', '2026-10-07']) assert.ok((await workflow.updateGuidelineVideo(target.id, { cta: 'No' }, token)).error)
  assert.equal(writes.length, before)
})

test('fill-empty preserves explicit human CTA', () => {
  const result = edits.developmentPatch({ id: target.id, updated_at: target.updatedAt, cta: 'Human chosen CTA' },
    { videoId: target.id, baseUpdatedAt: target.updatedAt, targetFields: ['cta'], cta: 'AI CTA' }, 'fill')
  assert.deepEqual(result.patch, {})
  assert.ok(result.error)
})
