import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import {
  ensureGoogleAdsFreshnessJobs, googleAdsRefreshWindow, googleAdsRefreshKey,
  googleAdsRefreshWorkerAuthorized, validGoogleAdsRefreshPayload, runGoogleAdsRefreshJob,
  GOOGLE_ADS_REFRESH_ENABLED_FLAG,
} from '../supabase/functions/_shared/googleAdsFreshness.ts'
import { normalizeCustomerId, validateGoogleAdsDateRange, googleAdsCampaignQuery, validGoogleAdsDate } from '../supabase/functions/_shared/google-ads-policy.ts'
import { refreshGoogleAccessToken, searchStream } from '../supabase/functions/_shared/google-ads.ts'

const instant = new Date('2026-10-16T07:00:00Z')
const account = { id: '11111111-1111-4111-8111-111111111111', customer_id: '1234567890', time_zone: 'Africa/Johannesburg', account_mode: 'shared', is_active: true }
const client = { id: 'client-a', active: true }
const link = { id: 'link-a', google_ads_account_id: account.id, client_id: client.id, campaign_id: '123', is_active: true }
const payload = { accountIds: [account.id], expectedCustomerId: account.customer_id, expectedTimeZone: account.time_zone, ...googleAdsRefreshWindow(account.time_zone, instant) }
const token = 'fixture-worker-token-longer-than-thirty-two-characters'

function database(overrides = {}, failTable = null) {
  const rows = { google_ads_accounts: [account], clients: [client], google_ads_account_links: [], google_ads_campaign_links: [link], google_ads_sync_runs: [], google_ads_campaign_daily_metrics: [], background_jobs: [], ...overrides }
  const writes = [], reads = []
  return { writes, reads, rows, from(table) {
    const filters = []
    let mutation = null
    const query = {
      select() { return query }, order() { return query },
      eq(key, value) { filters.push(row => row[key] === value); return query },
      in(key, values) { filters.push(row => values.includes(row[key])); return query },
      gte(key, value) { filters.push(row => row[key] >= value); return query },
      lte(key, value) { filters.push(row => row[key] <= value); return query },
      lt(key, value) { filters.push(row => row[key] < value); return query },
      insert(values) { mutation = { insert: values }; return query },
      update(values) { mutation = { update: values }; return query },
      range(from, to) { return Promise.resolve(result(from, to)) },
      upsert(row, options) {
        writes.push({ table, row, options })
        if (!rows[table].some(item => item.idempotency_key === row.idempotency_key)) rows[table].push({ ...row, created_at: instant.toISOString() })
        return Promise.resolve({ error: table === failTable ? { message: 'private database diagnostic' } : null })
      },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) },
    }
    function result(from = 0, to = Infinity) {
      reads.push({ table, from, to })
      if (table === failTable) return { data: null, error: { message: 'private database diagnostic' } }
      if (mutation?.insert) {
        const inserted = mutation.insert.map(row => ({ ...row, id: '22222222-2222-4222-8222-222222222222' }))
        rows[table].push(...inserted)
        return { data: inserted, error: null }
      }
      if (mutation?.update) {
        if (overrides.failFinish && mutation.update.status === 'succeeded') return { data: null, error: { message: 'private database diagnostic' } }
        rows[table].filter(row => filters.every(filter => filter(row))).forEach(row => Object.assign(row, mutation.update))
        return { data: [], error: null }
      }
      return { data: rows[table].filter(row => filters.every(filter => filter(row))).slice(from, to + 1), error: null }
    }
    return query
  }, rpc: async () => ({ data: 0, error: null }) }
}

test('Google Ads participates in the existing durable daily worker', () => {
  const worker = readFileSync(new URL('../supabase/functions/background-worker/index.ts', import.meta.url), 'utf8')
  assert.match(worker, /ensureGoogleAdsFreshnessJobs/)
  assert.match(worker, /case GOOGLE_ADS_REFRESH_JOB_TYPE/)
})

test('daily window excludes the incomplete account-local day, including DST and year boundaries', () => {
  assert.deepEqual(googleAdsRefreshWindow('Africa/Johannesburg', new Date('2026-12-31T22:30:00Z')),
    { operatingDate: '2027-01-01', startDate: '2026-11-27', endDate: '2026-12-31' })
  assert.equal(googleAdsRefreshWindow('America/Los_Angeles', new Date('2026-10-16T01:00:00Z')).endDate, '2026-10-14')
  assert.equal(googleAdsRefreshWindow('America/New_York', new Date('2026-11-02T05:30:00Z')).endDate, '2026-11-01')
  assert.throws(() => googleAdsRefreshWindow('invalid-timezone', instant))
})

test('disabled refresh makes no database reads or writes', async () => {
  const db = database()
  assert.deepEqual(await ensureGoogleAdsFreshnessJobs(db, false, instant), { state: 'disabled' })
  assert.equal(db.reads.length, 0)
  assert.equal(db.writes.length, 0)
})

test('one mapped account produces one exact daily job; completed and failed daily keys cannot be renewed', async () => {
  const db = database()
  const first = await ensureGoogleAdsFreshnessJobs(db, true, instant)
  assert.equal(first.enqueued, 1)
  assert.deepEqual(db.writes[0].row.payload, payload)
  assert.equal(db.writes[0].row.max_attempts, 3)
  assert.equal(db.writes[0].row.idempotency_key, googleAdsRefreshKey(account.id, payload.operatingDate))
  for (const status of ['queued', 'running', 'succeeded', 'failed']) {
    db.rows.background_jobs[0].status = status
    assert.equal((await ensureGoogleAdsFreshnessJobs(db, true, instant)).enqueued, 0)
  }
  assert.deepEqual(db.writes[0].options, { onConflict: 'idempotency_key', ignoreDuplicates: true })
})

test('inventory is paginated and capped jobs drain without starving later mapped accounts', async () => {
  const accounts = Array.from({ length: 5 }, (_, i) => ({ ...account, id: `${i + 1}1111111-1111-4111-8111-111111111111` }))
  const clients = [...Array.from({ length: 1000 }, (_, i) => ({ id: `filler-${i}`, active: true })), client]
  const db = database({ google_ads_accounts: accounts, clients, google_ads_campaign_links: accounts.map(a => ({ ...link, google_ads_account_id: a.id })) })
  assert.equal((await ensureGoogleAdsFreshnessJobs(db, true, instant)).enqueued, 2)
  assert.equal((await ensureGoogleAdsFreshnessJobs(db, true, instant)).enqueued, 2)
  assert.equal((await ensureGoogleAdsFreshnessJobs(db, true, instant)).enqueued, 1)
  assert.equal(db.rows.background_jobs.length, 5)
  assert.ok(db.reads.some(read => read.table === 'clients' && read.from === 1000))
})

test('unreadable inventory, missing mappings, inactive clients and mode/campaign conflicts admit no provider work', async () => {
  for (const table of ['google_ads_accounts', 'clients', 'google_ads_account_links', 'google_ads_campaign_links', 'google_ads_sync_runs', 'background_jobs']) {
    const db = database({}, table)
    assert.equal((await ensureGoogleAdsFreshnessJobs(db, true, instant)).state, 'unavailable')
    assert.equal(db.writes.length, 0)
  }
  for (const changes of [
    { clients: [] }, { google_ads_campaign_links: [] },
    { google_ads_account_links: [{ ...link }] },
    { google_ads_campaign_links: [link, { ...link, id: 'conflict', client_id: 'client-b' }] },
    { google_ads_accounts: [{ ...account, time_zone: 'invalid-zone' }] },
    { google_ads_accounts: [{ ...account, customer_id: null }] },
  ]) {
    const db = database(changes)
    await ensureGoogleAdsFreshnessJobs(db, true, instant)
    assert.equal(db.writes.length, 0)
  }
})

test('dedicated accounts need one active client; recent manual coverage and active runs suppress duplicate work', async () => {
  const direct = { google_ads_accounts: [{ ...account, account_mode: 'dedicated' }], google_ads_account_links: [link], google_ads_campaign_links: [] }
  assert.equal((await ensureGoogleAdsFreshnessJobs(database(direct), true, instant)).enqueued, 1)
  assert.equal((await ensureGoogleAdsFreshnessJobs(database({ ...direct, google_ads_account_links: [link, { ...link, id: 'duplicate' }] }), true, instant)).enqueued, 0)
  const run = { id: 'run', google_ads_account_id: account.id, status: 'succeeded', period_start: payload.startDate, period_end: payload.endDate,
    updated_at: instant.toISOString(), finished_at: instant.toISOString(), created_at: instant.toISOString() }
  assert.equal((await ensureGoogleAdsFreshnessJobs(database({ google_ads_sync_runs: [run] }), true, instant)).fresh, 1)
  assert.equal((await ensureGoogleAdsFreshnessJobs(database({ google_ads_sync_runs: [{ ...run, period_start: payload.endDate }] }), true, instant)).enqueued, 1)
  assert.equal((await ensureGoogleAdsFreshnessJobs(database({ google_ads_sync_runs: [{ ...run, status: 'running' }] }), true, instant)).running, 1)
  assert.equal((await ensureGoogleAdsFreshnessJobs(database({ google_ads_sync_runs: [{ ...run, status: 'failed' }] }), true, instant)).enqueued, 1)
})

test('worker requires both server credentials; malformed/stale/broad jobs are rejected before fetch', async () => {
  const auth = { serviceKey: 'fixture-service-key', bearer: 'Bearer fixture-service-key', workerToken: token, suppliedToken: token }
  assert.equal(googleAdsRefreshWorkerAuthorized(auth), true)
  for (const changes of [{ bearer: 'Bearer staff-jwt' }, { serviceKey: '' }, { suppliedToken: '' }, { workerToken: 'short', suppliedToken: 'short' }]) {
    assert.equal(googleAdsRefreshWorkerAuthorized({ ...auth, ...changes }), false)
  }
  for (const changes of [{ accountIds: [] }, { accountIds: [account.id, account.id] }, { expectedCustomerId: null },
    { expectedTimeZone: 'invalid-zone' }, { clientId: client.id }, { mappingIds: [] }, { startDate: '2026-01-01' }, { operatingDate: '2026-10-15' }]) {
    assert.equal(validGoogleAdsRefreshPayload({ ...payload, ...changes }, instant), false)
  }
  let calls = 0
  const options = { payload, enabled: false, url: 'https://fixture.supabase.co', serviceKey: 'fixture-service-key', workerToken: token }
  assert.deepEqual(await runGoogleAdsRefreshJob(options, async () => { calls++ }, instant), { ok: true, state: 'disabled' })
  await assert.rejects(runGoogleAdsRefreshJob({ ...options, enabled: true, payload: { ...payload, accountIds: [] } }, async () => { calls++ }, instant))
  assert.equal(calls, 0)
})

test('exact-account success, including verified no-row result, completes; partial/HTTP-only or foreign success fails', async () => {
  const body = { ok: true, status: 'success', totalAccounts: 1, completedAccounts: 1, failedAccounts: 0, skippedAccounts: 0,
    runIds: ['22222222-2222-4222-8222-222222222222'], period: { startDate: payload.startDate, endDate: payload.endDate },
    results: [{ accountId: account.id, customerId: account.customer_id, status: 'success', rows: 0 }] }
  const options = { payload, enabled: true, url: 'https://fixture.supabase.co', serviceKey: 'fixture-service-key', workerToken: token }
  let request
  const result = await runGoogleAdsRefreshJob(options, async (url, init) => {
    request = { url, init }
    return Response.json(body)
  }, instant)
  assert.equal(result.rows, 0)
  assert.equal(request.url, 'https://fixture.supabase.co/functions/v1/google-ads-sync')
  assert.equal(request.init.headers['X-Internal-Worker-Token'], token)
  assert.deepEqual(JSON.parse(request.init.body), payload)
  for (const changes of [{ ok: false }, { status: 'partial' }, { failedAccounts: 1 }, { completedAccounts: 0 }, { runIds: [] },
    { results: [{ accountId: 'foreign', status: 'success' }] }, { period: { startDate: 'wrong', endDate: payload.endDate } },
    { runIds: [null] }, { results: [null] }, { results: [{ ...body.results[0], rows: null }] },
    { results: [{ ...body.results[0], customerId: 'foreign' }] }]) {
    await assert.rejects(runGoogleAdsRefreshJob(options, async () => Response.json({ ...body, ...changes }), instant), /did not complete/)
  }
  await assert.rejects(runGoogleAdsRefreshJob(options, async () => new Response('unavailable', { status: 503 }), instant), /did not complete/)
})

test('scheduled provider requests use one short attempt, leaving retry/backoff to the durable queue', async t => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('{}', { status: 429 }) })
  const config = { clientId: 'fixture', clientSecret: 'fixture', refreshToken: 'fixture', developerToken: 'fixture', loginCustomerId: account.customer_id }
  await assert.rejects(refreshGoogleAccessToken(config, { attempts: 1, timeoutMs: 10_000 }))
  assert.equal(calls, 1)
  await assert.rejects(searchStream(config, 'fixture-access', account.customer_id, 'fixture-query', { attempts: 1, timeoutMs: 10_000 }))
  assert.equal(calls, 2)
})

// Execute the actual HTTP entrypoint, substituting only external I/O.
function syncHandler(db, enabled = true) {
  let handler, manualCalls = 0
  const providerPolicies = []
  const source = readFileSync(new URL('../supabase/functions/google-ads-sync/index.ts', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"]\s*$/gm, '')
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service-key', WORKER_INTERNAL_TOKEN: token,
    [GOOGLE_ADS_REFRESH_ENABLED_FLAG]: String(enabled) }
  const args = {
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn } },
    requireAdminOrManager: async () => { manualCalls++; return { ok: false, status: 403, error: 'Manager required' } },
    createClient: () => db, GOOGLE_ADS_REFRESH_ENABLED_FLAG, googleAdsRefreshWorkerAuthorized, validGoogleAdsRefreshPayload,
    corsHeaders: {}, jsonResponse: (body, status = 200) => Response.json(body, { status }), googleAdsConfig: () => ({}),
    normalizeCustomerId, validateGoogleAdsDateRange, googleAdsCampaignQuery, validGoogleAdsDate,
    refreshGoogleAccessToken: async (_config, policy) => { providerPolicies.push(policy); return 'fixture-access' },
    searchStream: async (_config, _token, _customer, _query, policy) => { providerPolicies.push(policy); return [] },
    safeGoogleAdsError: () => ({ error: 'Safe provider diagnostic.' }),
  }
  new Function(...Object.keys(args), javascript)(...Object.values(args))
  return { handler, providerPolicies, manualCalls: () => manualCalls }
}

test('HTTP entrypoint rejects credential downgrade and rechecks the durable account identity before provider access', async () => {
  const currentPayload = { ...payload, ...googleAdsRefreshWindow(account.time_zone) }
  const request = (headers = {}, changes = {}) => new Request('https://fixture.supabase.co/functions/v1/google-ads-sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-service-key', 'X-Internal-Worker-Token': token, ...headers },
    body: JSON.stringify({ ...currentPayload, ...changes }),
  })
  const fixture = syncHandler(database())
  assert.equal((await fixture.handler(request({ 'X-Internal-Worker-Token': 'wrong' }))).status, 401)
  assert.equal(fixture.manualCalls(), 0)
  assert.equal((await fixture.handler(request({ Authorization: 'Bearer staff-jwt' }))).status, 401)
  assert.equal((await syncHandler(database(), false).handler(request())).status, 503)
  assert.equal((await fixture.handler(request({}, { expectedCustomerId: '9999999999' }))).status, 409)
  assert.equal((await fixture.handler(request({}, { accountIds: [] }))).status, 400)
  const manual = new Request('https://fixture.supabase.co/functions/v1/google-ads-sync', { method: 'POST', body: '{}' })
  assert.equal((await fixture.handler(manual)).status, 403)
  assert.equal(fixture.manualCalls(), 1)
})

test('actual sync path records exact success only after its canonical receipt; a receipt write failure cannot PASS', async () => {
  const currentPayload = { ...payload, ...googleAdsRefreshWindow(account.time_zone) }
  const request = () => new Request('https://fixture.supabase.co/functions/v1/google-ads-sync', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fixture-service-key', 'X-Internal-Worker-Token': token },
    body: JSON.stringify(currentPayload),
  })
  const db = database()
  const fixture = syncHandler(db)
  const body = await (await fixture.handler(request())).json()
  assert.equal(body.ok, true)
  assert.equal(body.completedAccounts, 1)
  assert.equal(db.rows.google_ads_sync_runs[0].status, 'succeeded')
  assert.deepEqual(fixture.providerPolicies, [{ attempts: 1, timeoutMs: 10_000 }, { attempts: 1, timeoutMs: 10_000 }])
  const failedDb = database({ failFinish: true })
  const failed = await (await syncHandler(failedDb).handler(request())).json()
  assert.equal(failed.ok, false)
  assert.equal(failed.failedAccounts, 1)
  assert.equal(failedDb.rows.google_ads_sync_runs[0].status, 'failed')
  assert.doesNotMatch(JSON.stringify(failed), /private database diagnostic/)
})
