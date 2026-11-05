import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, summarize
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error',
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true } })
  const ops = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/opsActions.ts')
  summarize = ops.summarizeTiktokReportingHealth ?? ((response, error) => ops.summarizeProviderHealth('tiktok', response, error))
})
after(async () => { await server?.close() })

const now = '2026-11-05T06:00:00.000Z'
const response = (patch = {}) => ({ connected: true, status: 'connected', schemaReady: true,
  health: { access: 'connected', coverage: 'complete', completeness: 'complete',
    freshness: 'fresh', lastSuccessfulAt: '2026-11-05T03:00:00Z',
    lastAttemptedAt: '2026-11-05T03:00:00Z', staleAfterHours: 30 }, ...patch })

test('live needs_refresh response must not be reported as a healthy TikTok connection', () => {
  const r = summarize(response({ status: 'needs_refresh', connection: { tokenExpired: true } }), null, now)
  assert.equal(r.state, 'degraded')
  assert.equal(r.degraded, true)
  assert.match(r.detail, /refresh/i)
  assert.doesNotMatch(r.detail, /must reconnect|reconnect required/i)
})

test('OAuth presence without exact-account health is UNKNOWN, never PASS', () => {
  for (const health of [undefined, null, {}, [], { access: 'connected', freshness: 'fresh' }]) {
    const r = summarize(response({ health }), null, now)
    assert.equal(r.state, 'unavailable')
    assert.equal(r.degraded, true)
    assert.equal(r.reporting.verdict, 'UNAVAILABLE')
  }
})

test('partial coverage, failed access and stale data retain their reporting meaning', () => {
  for (const patch of [{ coverage: 'partial' }, { completeness: 'partial' }, { access: 'provider_error' }]) {
    const source = response()
    const r = summarize({ ...source, health: { ...source.health, ...patch } }, null, now)
    assert.equal(r.degraded, true)
    assert.equal(r.reporting.verdict, 'PARTIAL')
  }
  const source = response()
  const r = summarize({ ...source, health: { ...source.health, freshness: 'stale', lastSuccessfulAt: '2026-11-03T03:00:00Z' } }, null, now)
  assert.equal(r.reporting.verdict, 'STALE')
  assert.equal(r.degraded, true)
})

test('freshness is rechecked against timestamps, not a stale fresh badge', () => {
  const source = response()
  for (const value of [null, 'invalid', '2026-11-06T06:00:00Z']) {
    assert.equal(summarize({ ...source, health: { ...source.health, lastSuccessfulAt: value } }, null, now).reporting.verdict, 'UNAVAILABLE')
  }
  assert.equal(summarize({ ...source, health: { ...source.health, lastSuccessfulAt: '2026-11-03T03:00:00Z' } }, null, now).reporting.verdict, 'STALE')
})

test('only fresh, complete, readable exact-account reporting passes', () => {
  const r = summarize(response(), null, now)
  assert.equal(r.state, 'connected')
  assert.equal(r.degraded, false)
  assert.equal(r.reporting.verdict, 'PASS')
  assert.match(r.detail, /not.*every metric|not.*monthly/i)
  assert.equal(summarize(response({ connected: false }), null, now).state, 'not_connected')
  assert.equal(summarize(response(), 'timeout', now).state, 'unavailable')
  assert.equal(summarize(response({ schemaReady: false }), null, now).degraded, true)
  assert.equal(summarize(response({ ok: false }), null, now).reporting.verdict, 'UNAVAILABLE')
})

test('read-only reporting helper never changes targeted-sync admission or exposes raw status', () => {
  const index = readFileSync(new URL('../supabase/functions/cg-dynamics-mcp/index.ts', import.meta.url), 'utf8')
  const read = index.slice(index.indexOf('const handleGetProviderHealth'), index.indexOf('const handleRunProviderSync'))
  assert.match(read, /summarizeTiktokReportingHealth\(/)
  const sync = index.slice(index.indexOf('const handleRunProviderSync'), index.indexOf('const handleListCompanyTasks'))
  assert.match(sync, /summarizeProviderHealth\(/)
  assert.doesNotMatch(sync, /summarizeTiktokReportingHealth\(/)
  assert.doesNotMatch(read, /\.\.\.res\.data/)
})
