import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'
import ts from 'typescript'
import { fetchAllRows } from '../supabase/functions/_shared/paginatedRows.ts'
import { currentMetaMonth, previousMetaMonth, currentMonthHasIncrementalWindow } from '../supabase/functions/_shared/metaPeriod.ts'

const now = '2026-10-02T16:10:00Z'
const permissionError = "Error: Mapped Page access failed (HTTP 400, code: 10): (#10) This endpoint requires the 'pages_read_engagement' permission."
const asset = { id: 'asset-a', client_id: 'client-a', is_active: true, facebook_page_id: '111', instagram_account_id: null, updated_at: '2026-07-02T16:29:28Z', meta_asset_sync_checkpoints: [] }
const failure = { id: 'item-a', batch_id: 'batch-old', asset_id: asset.id, client_id: asset.client_id, month: '2026-10', status: 'failed', error: permissionError, facebook_sync_state: 'pending', instagram_sync_state: 'pending', finished_at: '2026-10-02T16:08:07Z', cooldown_until: null, meta_sync_batches: { summary: { via: 'fleet_freshness' } } }
let server, metaTerminalAccessBlocks, META_TERMINAL_ACCESS_COOLDOWN_MS, metaFleetFreshnessEvidence
before(async () => {
  server = await createServer({ root: process.cwd(), optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true }, appType: 'custom' })
  ;({ metaTerminalAccessBlocks, META_TERMINAL_ACCESS_COOLDOWN_MS } = await server.ssrLoadModule('/supabase/functions/_shared/metaFleetTerminalBackoff.ts'))
  ;({ metaFleetFreshnessEvidence } = await server.ssrLoadModule('/src/lib/dailyDynamicsFreshness.ts'))
})
after(async () => { await server.close() })

// Execute the real scheduler body with only its I/O boundary replaced. This
// catches missing production wiring, empty batches and pagination regressions.
const source = readFileSync(new URL('../supabase/functions/background-worker/index.ts', import.meta.url), 'utf8')
const body = source.slice(source.indexOf('async function enqueueFleetMetaFreshness'), source.indexOf('// Runs one job to its real completion'))
const javascript = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText

async function schedule({ assets = [asset], failures = [failure], active = [], connections = [], failTable = null, dependencies = {} } = {}) {
  const writes = []
  const reads = []
  const database = { from(table) {
    const filters = []
    let inserted = null
    const query = {
      select() { return query }, eq(k, v) { filters.push(r => r[k] === v); return query },
      in(k, v) { filters.push(r => v.includes(r[k])); return query },
      gte(k, v) { filters.push(r => r[k] >= v); return query }, order() { return query },
      limit() { return query },
      insert(rows) { inserted = rows; writes.push({ table, rows }); return query },
      single() { return Promise.resolve({ data: { id: 'batch-new' }, error: null }) },
      range(from, to) { return Promise.resolve(result(from, to)) },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
    }
    function result(from = 0, to = Infinity) {
      if (inserted) return { data: null, error: null }
      reads.push(table)
      if (table === failTable) return { data: null, error: { message: 'test read failure' } }
      const rows = table === 'meta_client_assets' ? assets
        : table === 'meta_sync_batch_items' ? [...active, ...failures]
        : table === 'clients' ? assets.map(a => ({ id: a.client_id, name: a.client_id }))
        : table === 'meta_connections' ? connections : []
      return { data: rows.filter(r => filters.every(filter => filter(r))).slice(from, to + 1), error: null }
    }
    return query
  } }
  const names = { fetchAllRows, currentMetaMonth, previousMetaMonth, currentMonthHasIncrementalWindow,
    metaTerminalAccessBlocks, META_TERMINAL_ACCESS_COOLDOWN_MS,
    META_FLEET_FRESHNESS_MAX_BATCHES: 2, Deno: { env: { get: () => 'test-worker-secret' } },
    fetch: async () => new Response('{}'), setTimeout: resolve => resolve(), ...dependencies }
  const run = new Function(...Object.keys(names), `${javascript}; return enqueueFleetMetaFreshness`)(...Object.values(names))
  const result = await run(database, 'https://example.supabase.co')
  return { result, writes, reads }
}

test('recent exact Page preflight permission failure stops the next minute bootstrap batch', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const failures = [failure, { ...failure, id: 'item-sep', month: '2026-09' }]
  const result = await schedule({ failures })
  assert.equal(result.writes.length, 0, 'failed work must not generate another doomed batch')
})

test('initial bootstrap still enqueues both exact months', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const { writes } = await schedule({ failures: [] })
  assert.equal(writes[0].rows.total_items, 2)
  assert.deepEqual(writes[1].rows.map(row => [row.asset_id, row.month]), [['asset-a', '2026-10'], ['asset-a', '2026-09']])
})

test('repeated minute ticks do not renew cooldown or create empty batches', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  for (let minute = 0; minute < 55; minute++) {
    t.mock.timers.setTime(Date.parse(now) + minute * 60_000)
    const { writes, result } = await schedule({ failures: [failure, { ...failure, month: '2026-09' }] })
    assert.equal(writes.length, 0)
    assert.match(result[0].detail, /permission\/access blocked.*17:08:07/)
  }
})

test('expiry at exact one-hour boundary permits the next bootstrap attempt', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-02T17:08:07Z') })
  assert.equal((await schedule({ failures: [failure, { ...failure, month: '2026-09' }] })).writes.length, 2)
})

test('mapping recovery permits retry; successful checkpoint supersedes older terminal history', () => {
  assert.equal(metaTerminalAccessBlocks({ ...asset, updated_at: '2026-10-02T16:09:00Z' }, '2026-10', [failure], now).length, 0)
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [failure], now, '2026-10-02T16:09:00Z').length, 0)
  assert.equal(metaTerminalAccessBlocks({ ...asset, meta_asset_sync_checkpoints: [{ platform: 'facebook', client_id: asset.client_id, last_successful_at: '2026-10-02T16:09:00Z', last_status: 'complete' }] }, '2026-10', [failure], now).length, 0)
})

test('terminal evidence is exact client/asset/month and automatic batch source only', () => {
  for (const change of [{ client_id: 'other' }, { asset_id: 'other' }, { month: '2026-09' }, { status: 'queued' }, { meta_sync_batches: { summary: { via: 'manual' } } }, { finished_at: null }, { finished_at: 'invalid' }, { finished_at: '2026-10-03T00:00:00Z' }]) {
    assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [{ ...failure, ...change }], now).length, 0)
  }
})

test('transient timeout/rate-limit and schema/contract failures do not acquire access cooldown', () => {
  for (const error of ['AbortError: The signal has been aborted', 'Meta provider request timed out on request attempt 3', 'HTTP 429 rate limit', 'Mapped Page access failed (HTTP 400, code: 4): rate limit', 'Malformed collection data envelope.', 'Meta configuration error.', 'HTTP 403 unknown', 'Facebook posts fetch failed (HTTP 400): unsupported metric']) {
    assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [{ ...failure, error }], now).length, 0, error)
  }
  const newer = { ...failure, id: 'newer', finished_at: '2026-10-02T16:09:00Z', error: 'AbortError: The signal has been aborted' }
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [failure, newer], now).length, 0)
})

test('failed Facebook stage cannot suppress healthy due Instagram on the same asset', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const exact = { ...asset, instagram_account_id: '222' }
  const fbFailure = { ...failure, facebook_sync_state: 'failed', instagram_sync_state: 'complete', error: 'Facebook posts fetch failed (HTTP 403): MissingPermissions, code: 200' }
  assert.deepEqual(metaTerminalAccessBlocks(exact, '2026-10', [fbFailure], now).map(block => block.platform), ['facebook'])
  assert.equal((await schedule({ assets: [exact], failures: [fbFailure] })).writes.length, 2)
})

test('blocked asset/client does not poison independent bootstrap assets', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const { writes } = await schedule({ assets: [asset, { ...asset, id: 'asset-b', client_id: 'client-b' }], failures: [failure, { ...failure, month: '2026-09' }] })
  assert.equal(writes.length, 2)
  assert.ok(writes[1].rows.every(row => row.asset_id === 'asset-b' && row.client_id === 'client-b'))
})

test('active retry work remains deduplicated without inspecting its transient cooldown', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const { writes } = await schedule({ failures: [], active: ['2026-09', '2026-10'].map(month => ({ asset_id: asset.id, month, status: 'queued', cooldown_until: '2026-10-02T16:25:00Z' })) })
  assert.equal(writes.length, 0)
})

test('unavailable queue evidence holds enqueue instead of inventing no failures', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  for (const failTable of ['meta_sync_batch_items', 'meta_connections']) {
    const { writes, result } = await schedule({ failTable })
    assert.equal(writes.length, 0)
    assert.match(result[0].detail, /evidence unavailable/)
  }
})

test('existing cooldown can shorten but never extend the bounded retry window', () => {
  const short = { ...failure, cooldown_until: '2026-10-02T16:09:00Z' }
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [short], now).length, 0)
  const long = { ...failure, cooldown_until: '2026-10-04T00:00:00Z' }
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [long], now)[0].retryAt, '2026-10-02T17:08:07.000Z')
})

test('suppression never mutates original facts/checkpoints or makes missing evidence PASS', () => {
  const original = structuredClone(asset)
  metaTerminalAccessBlocks(asset, '2026-10', [failure], now)
  assert.deepEqual(asset, original)
  const fleet = metaFleetFreshnessEvidence([], now, [{ clientId: asset.client_id, assetId: asset.id, facebookMapped: true, instagramMapped: false }])
  assert.equal(fleet.verdict, 'STALE')
  assert.equal(fleet.platforms[0].lastSuccessfulAt, null)
})

test('failure evidence beyond the first database page still suppresses doomed work', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const unrelated = Array.from({ length: 1200 }, (_, i) => ({ ...failure, id: `other-${i}`, asset_id: 'other', client_id: 'other' }))
  const { writes, reads } = await schedule({ failures: [...unrelated, failure, { ...failure, month: '2026-09' }] })
  assert.equal(writes.length, 0)
  assert.ok(reads.filter(table => table === 'meta_sync_batch_items').length >= 3)
})

test('source recovery permits only the exact linked connection; unrelated reconnect does not release it', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const assets = [{ ...asset, connection_id: 'connection-a' }]
  const failures = [failure, { ...failure, month: '2026-09' }]
  assert.equal((await schedule({ assets, failures, connections: [{ id: 'connection-b', last_connected_at: '2026-10-02T16:09:00Z' }] })).writes.length, 0)
  assert.equal((await schedule({ assets, failures, connections: [{ id: 'connection-a', last_connected_at: '2026-10-02T16:09:00Z' }] })).writes.length, 2)
})

test('a single suppressed month does not remove the other required month', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse(now) })
  const { writes } = await schedule()
  assert.equal(writes[0].rows.total_items, 1)
  assert.equal(writes[1].rows[0].month, '2026-09')
})

// Exercise the actual staff-safe status projection, not an alternate model.
function statusProjection(checkpoints = [], recoveryItems = [failure], errors = {}) {
  const source = readFileSync(new URL('../supabase/functions/meta-connection-status/index.ts', import.meta.url), 'utf8')
  const projection = source.slice(source.indexOf('  const recoveryByAsset'), source.lastIndexOf('  return jsonResponse'))
  const javascript = ts.transpileModule(projection, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const args = { recoveryItems, checkpoints, schemaReady: true, assetEvidenceError: null, checkpointEvidenceError: null, recoveryEvidenceError: null, activeAssets: [asset], now: Date.parse(now), latest: { id: 'connection-a', last_connected_at: null }, metaTerminalAccessBlocks, ...errors }
  return new Function(...Object.keys(args), `${javascript}; return assetHealth`)(...Object.values(args))
}

test('status projection exposes pre-checkpoint access blocker without fabricating success', () => {
  const row = statusProjection()[0].facebook
  assert.match(row.last_error_code, /Meta permission\/access blocked/)
  assert.equal(row.cooldown_until, '2026-10-02T17:08:07.000Z')
  assert.equal(row.last_successful_at, undefined)
  assert.equal(row.retrying, false)
  const fleet = metaFleetFreshnessEvidence([{ clientId: asset.client_id, assetId: asset.id, platform: 'facebook', mapped: true, lastAttemptedAt: null, lastSuccessfulAt: null, errorCode: row.last_error_code }], now)
  assert.equal(fleet.verdict, 'STALE')
  assert.match(fleet.platforms[0].reason, /permission\/access blocked/)
})

test('status keeps last verified facts and their original age PARTIAL during access cooldown', () => {
  const checkpoint = { asset_id: asset.id, client_id: asset.client_id, platform: 'facebook', last_status: 'complete', last_health_state: 'verified', last_successful_at: '2026-10-01T12:00:00Z', last_attempted_at: '2026-10-01T12:00:00Z', next_due_at: '2026-10-01T18:00:00Z', high_watermark_at: '2026-10-01T07:00:00Z' }
  const row = statusProjection([checkpoint])[0].facebook
  assert.equal(row.last_successful_at, checkpoint.last_successful_at)
  assert.equal(row.high_watermark_at, checkpoint.high_watermark_at)
  const fleet = metaFleetFreshnessEvidence([{ clientId: asset.client_id, assetId: asset.id, platform: 'facebook', mapped: true, lastAttemptedAt: row.created_at, lastSuccessfulAt: row.last_successful_at, errorCode: row.last_error_code }], now)
  assert.equal(fleet.verdict, 'PARTIAL')
})

test('new successful checkpoint wins over older failed queue history in the status projection', () => {
  const checkpoint = { asset_id: asset.id, client_id: asset.client_id, platform: 'facebook', last_status: 'complete', last_health_state: 'verified', last_successful_at: '2026-10-02T16:09:00Z', last_attempted_at: '2026-10-02T16:09:00Z' }
  const row = statusProjection([checkpoint], [{ ...failure, cooldown_until: '2026-10-02T17:08:07Z', facebook_sync_state: 'failed', error: 'Facebook posts fetch failed (HTTP 403, code: 200): MissingPermissions' }])[0].facebook
  assert.equal(row.status, 'success')
  assert.equal(row.last_error_code, null)
  assert.equal(row.last_successful_at, checkpoint.last_successful_at)
  assert.equal(row.cooldown_until, null)
})

test('unavailable queue/checkpoint/inventory evidence cannot become a healthy status projection', () => {
  for (const field of ['assetEvidenceError', 'checkpointEvidenceError', 'recoveryEvidenceError']) {
    assert.equal(statusProjection([], [], { [field]: { message: 'read failure' } }), null)
  }
})

test('durable batch source accepts exact singleton relationship only', () => {
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [{ ...failure, meta_sync_batches: [failure.meta_sync_batches] }], now).length, 1)
  assert.equal(metaTerminalAccessBlocks(asset, '2026-10', [{ ...failure, meta_sync_batches: [failure.meta_sync_batches, failure.meta_sync_batches] }], now).length, 0)
})

test('status recovery query uses real durable timestamps, not a nonexistent updated_at column', () => {
  const source = readFileSync(new URL('../supabase/functions/meta-connection-status/index.ts', import.meta.url), 'utf8')
  const query = source.slice(source.indexOf('const { data: recoveryItems,'), source.indexOf('const recoveryByAsset'))
  assert.doesNotMatch(query, /updated_at/)
  assert.match(query, /finished_at/)
  assert.match(query, /\.order\('id'\)/)
})
