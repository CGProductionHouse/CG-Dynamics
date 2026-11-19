import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { META_CONNECTOR_VERSION, metaPostBounds, redact } from '../supabase/functions/_shared/meta.ts'

// Execute the real manual Edge handler. Only provider/DB transports and time
// are synthetic; the completion decision and persisted outer receipt are real.
const source = readFileSync(new URL('../supabase/functions/meta-sync/index.ts', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\r?\n/gm, '')
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText

async function run({ facebook = true, instagram = true, postElapsed = 0, finishes = {}, throws = null, role = 'admin' } = {}) {
  let handler
  let elapsed = 0
  const epoch = Date.parse('2026-11-17T10:00:00Z')
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [epoch + elapsed])) }
    static now() { return epoch + elapsed }
  }
  const factCalls = []
  const writes = []
  const clientId = '11111111-1111-4111-8111-111111111111'
  const rows = {
    profiles: { role },
    meta_connections: [{ id: 'connection' }],
    meta_connection_tokens: [{ encrypted_access_token: 'fixture-envelope' }],
    meta_client_assets: [{ id: 'asset', client_id: clientId, facebook_page_id: facebook ? 'page' : null,
      instagram_account_id: instagram ? 'ig' : null, instagram_connection_id: null }],
    clients: [{ id: clientId, name: 'Synthetic exact client' }],
  }
  const sb = {
    auth: { getUser: async () => ({ data: { user: { id: 'admin' } }, error: null }) },
    from(table) {
      const query = {
        select() { return query }, eq() { return query }, in() { return query }, order() { return query }, limit() { return query },
        single: async () => ({ data: rows[table], error: null }),
        insert(value) { writes.push({ table, value }); return query },
        then(resolve) { return Promise.resolve({ data: rows[table] ?? null, error: null }).then(resolve) },
      }
      return query
    },
    rpc: async (name, args) => {
      assert.equal(name, 'meta_sync_get_or_create_report')
      assert.equal(args.p_client_id, clientId)
      assert.equal(args.p_month, '2026-10-01')
      return { data: [{ report_id: 'report', created: false }], error: null }
    },
  }
  const dependencies = {
    Deno: { serve: fn => { handler = fn }, env: { get: name => ({
      SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fixture-only',
    })[name] } },
    Date: Clock, console: { error() {} }, corsHeaders: {},
    jsonResponse: (body, status = 200) => Response.json(body, { status }),
    createClient: () => sb,
    readMetaStoredToken: async () => ({ accessToken: 'fixture-token' }),
    resolveMetaGraphConfig: () => ({ baseUrl: 'https://provider.example/v25.0', version: 'v25.0' }),
    fetchPageTokens: async () => new Map([['page', 'fixture-page-token']]),
    resolveInstagramReportingCredential: async () => ({ token: 'fixture-page-token', connectionId: 'connection',
      baseUrl: 'https://provider.example/v25.0', apiVersion: 'v25.0', tokenClass: 'page' }),
    META_CONNECTOR_VERSION, metaPostBounds, redact,
    metaFetch: async () => ({ ok: true, json: async () => { elapsed = postElapsed; return { data: [] } } }),
    syncAccountFacts: async (_sb, input) => {
      factCalls.push(input.platform)
      if (finishes[input.platform] !== undefined) elapsed = finishes[input.platform]
      if (throws === input.platform) throw new Error('fixture provider or persistence failure')
      return { facts: { brand_views: { value: 8, availability: 'complete', sourceMetric: 'views' } } }
    },
  }
  new Function(...Object.keys(dependencies), javascript)(...Object.values(dependencies))
  const response = await handler(new Request('https://fixture.supabase.co/functions/v1/meta-sync', {
    method: 'POST', headers: { Authorization: 'Bearer fixture-admin', 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'previous_completed_month', clientId, month: '2026-10' }),
  }))
  return { http: response.status, body: await response.json(), factCalls, writes }
}

test('actual manual handler retains success when both mapped fact passes finish after the budget', async () => {
  const result = await run({ finishes: { facebook: 10, instagram: 70_001 } })
  assert.equal(result.http, 200)
  assert.deepEqual(result.factCalls, ['facebook', 'instagram'])
  assert.equal(result.body.status, 'success')
  assert.equal(result.body.clientsSucceeded, 1)
  assert.equal(result.body.clientsFailed, 0)
  assert.equal(result.writes.find(x => x.table === 'meta_sync_runs').value.status, 'success')
  assert.ok(!result.body.warnings.some(x => x.includes('time budget expired')))
})

test('actual manual handler accepts a completed single-platform pass after the budget', async () => {
  for (const platform of ['facebook', 'instagram']) {
    const result = await run({ facebook: platform === 'facebook', instagram: platform === 'instagram', finishes: { [platform]: 70_000 } })
    assert.deepEqual(result.factCalls, [platform])
    assert.equal(result.body.status, 'success')
  }
})

test('budget before fact work fails without claiming either mapped platform completed', async () => {
  const result = await run({ postElapsed: 70_001 })
  assert.deepEqual(result.factCalls, [])
  assert.equal(result.body.status, 'failed')
  assert.equal(result.writes.find(x => x.table === 'meta_sync_runs').value.status, 'failed')
  assert.ok(result.body.warnings.some(x => x.includes('time budget expired')))
})

test('finishing Facebook too late still fails when mapped Instagram was never attempted', async () => {
  const result = await run({ finishes: { facebook: 70_001 } })
  assert.deepEqual(result.factCalls, ['facebook'])
  assert.equal(result.body.status, 'failed')
  assert.equal(result.body.clientsSucceeded, 0)
})

test('provider or persistence failure remains failed even when all passes were attempted', async () => {
  const result = await run({ throws: 'instagram', finishes: { instagram: 70_001 } })
  assert.deepEqual(result.factCalls, ['facebook', 'instagram'])
  assert.equal(result.body.status, 'failed')
  assert.match(result.body.failedClients[0].error, /Normalized account facts failed/)
})

test('the real handler still refuses a client role before provider reads or writes', async () => {
  const result = await run({ role: 'client' })
  assert.equal(result.http, 403)
  assert.deepEqual(result.factCalls, [])
  assert.deepEqual(result.writes, [])
})
