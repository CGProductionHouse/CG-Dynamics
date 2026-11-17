import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
let server, read, update
before(async () => { server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' }); ({ readNolanViewState: read, updateNolanViewState: update } = await server.ssrLoadModule('/src/lib/nolanViewState.ts')) })
after(async () => { await server?.close() })
const month = '2026-11'
test('default URL preserves original Active work behavior', () => {
 assert.deepEqual(read(new URLSearchParams('tab=nolan'), month), { lane: 'work', month, query: '', status: 'All statuses' })
})
test('view and month roundtrip through navigation away and return', () => {
 const before = new URLSearchParams('tab=nolan&scope=all')
 const after = update(before, { lane: 'packages', month: '2027-02', query: 'client & poster', status: 'Awaiting approval' }, month)
 const returned = new URLSearchParams(after.toString())
 assert.deepEqual(read(returned, month), { lane: 'packages', month: '2027-02', query: 'client & poster', status: 'Awaiting approval' })
 assert.equal(returned.get('tab'), 'nolan')
 assert.equal(returned.get('scope'), 'all')
 assert.equal(before.toString(), 'tab=nolan&scope=all')
})
test('invalid route month and lane never become arbitrary reader parameters', () => {
 for (const invalid of ['0000-01', '2026-13', '2026-00', '2026-1', '2026-11-01', '../secret']) assert.equal(read(new URLSearchParams({ nolan_month: invalid }), month).month, month)
 assert.equal(read(new URLSearchParams('nolan_view=admin'), month).lane, 'work')
 assert.equal(read(new URLSearchParams({ nolan_query: 'x'.repeat(1000), nolan_status: 'x'.repeat(1000) }), month).query.length, 300)
 assert.equal(read(new URLSearchParams({ nolan_status: 'x'.repeat(1000) }), month).status.length, 120)
})
test('clear filters retains lane and month and removes filter parameters', () => {
 const initial = update(new URLSearchParams('tab=nolan'), { lane: 'videos', query: 'clip', status: 'Review' }, month)
 const cleared = update(initial, { query: '', status: 'All statuses' }, month)
 assert.equal(cleared.has('nolan_query'), false)
 assert.equal(cleared.has('nolan_status'), false)
 assert.equal(read(cleared, month).lane, 'videos')
 assert.equal(read(initial, month).query, 'clip')
})
test('native route is source of truth; text input replaces history and source reads stay bounded', () => {
 const page = readFileSync('src/pages/admin/NolanOverview.tsx', 'utf8')
 assert.ok(page.includes('readNolanViewState(searchParams, fallbackMonth)'))
 assert.ok(page.includes('changeView({ query: e.target.value }, true)'))
 assert.ok(page.includes("changeView({ lane: id, status: 'All statuses' })"))
 assert.ok(page.includes('Clear filters'))
 assert.ok(page.includes('}, [month, generation, scope, userId, profileId, profileRole])'))
 assert.ok(page.includes('rawSnapshot?.scope === scope'))
 assert.doesNotMatch(page, /localStorage|sessionStorage/)
})
