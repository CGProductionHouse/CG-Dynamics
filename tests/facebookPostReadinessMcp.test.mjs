import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { publicationCodecVite } from './fixtures/publicationCodecVite.mjs'

let server, adapter, policy, catalog
before(async () => {
  server = await createServer({ configFile: false, plugins: [publicationCodecVite], ssr: { external: ['jpeg-js'] }, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  adapter = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/facebookPostReadiness.ts')
  policy = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/projectContext.ts')
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
})
after(async () => server?.close())
const actor = '11111111-1111-4111-8111-111111111111', client = '22222222-2222-4222-8222-222222222222'
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
function fixture(count = 26) {
  const tables = { profiles: [{ id: actor, role: 'admin', is_active: true }], clients: [{ id: client, active: true }],
    content_review_versions: Array.from({ length: count }, (_, n) => ({ id: id(n + 1), client_id: client, deliverable_id: id(n + 100), state: 'approved', channels: ['facebook'], media_type: 'image/png', scheduled_at: '2099-01-01T10:00:00Z' })),
    monthly_deliverables: Array.from({ length: count }, (_, n) => ({ id: id(n + 100), client_id: client, archived_at: null, posted_at: null, production_status: 'not_started' })) }
  const calls = [], failures = new Set(), envReads = []
  const sb = { from(table) {
    const filters = [], orders = []
    const result = () => {
      calls.push(table)
      let data = tables[table].filter(row => filters.every(f => f(row)))
      for (const key of [...orders].reverse()) data = data.toSorted((a, b) => String(a[key]).localeCompare(String(b[key])))
      return { data: structuredClone(data), error: failures.has(table) ? { message: 'PRIVATE error' } : null }
    }
    const query = { select() { return query }, eq(k, v) { filters.push(r => r[k] === v); return query },
      contains(k, values) { filters.push(r => values.every(v => r[k]?.includes(v))); return query },
      gt(k, v) { filters.push(r => Date.parse(r[k]) > Date.parse(v)); return query }, in(k, values) { filters.push(r => values.includes(r[k])); return query },
      order(k) { orders.push(k); return query },
      async range(first, last) { const r = result(); return { ...r, data: r.data.slice(first, last + 1) } },
      async maybeSingle() { const r = result(); return { data: r.data.length === 1 ? r.data[0] : null, error: r.error || (r.data.length > 1 ? {} : null) } },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject) } }
    return query
  } }
  return { tables, calls, failures, envReads, read(input = { client_id: client }, env = {}) { return adapter.readFacebookPostReadiness(sb, actor, input, key => { envReads.push(key); return env[key] }) } }
}
test('candidate listing uses one exact client, pages explicitly, excludes scheduled work and never reads provider settings', async () => {
  const f = fixture(); f.tables.monthly_deliverables[0].production_status = 'scheduled'
  const first = await f.read()
  assert.equal(first.data_state, 'available'); assert.equal(first.candidates.length, 24)
  assert.equal(first.has_more, true); assert.equal(first.next_offset, 25)
  assert.equal(first.canConfirm, false); assert.equal(first.canPublish, false)
  const second = await f.read({ client_id: client, offset: first.next_offset })
  assert.equal(second.candidates.length, 1); assert.equal(second.has_more, false); assert.equal(second.next_offset, null)
  assert.deepEqual(f.envReads, []); assert.doesNotMatch(JSON.stringify(first), /asset_path|PRIVATE|access_token/)
})
test('bad inputs, foreign/inactive clients and non-manager actors cannot enumerate candidates', async () => {
  for (const input of [{ client_id: 'name' }, { client_id: client, offset: -1 }, { client_id: client, actorId: actor },
    { client_id: client, review_id: id(1), offset: 0 }, { client_id: id(999) }]) {
    const f = fixture(); assert.equal((await f.read(input)).data_state, 'unavailable')
  }
  for (const role of ['staff', 'team', 'client']) {
    const f = fixture(); f.tables.profiles[0].role = role
    assert.equal((await f.read()).code, 'ACTIVE_MANAGER_REQUIRED'); assert.deepEqual(f.calls, ['profiles'])
  }
  const f = fixture(); f.tables.clients[0].active = false
  assert.equal((await f.read()).data_state, 'unavailable')
})
test('query errors are unavailable, and a genuinely empty candidate page is scoped metadata only', async () => {
  for (const table of ['profiles', 'clients', 'content_review_versions', 'monthly_deliverables']) {
    const f = fixture(); f.failures.add(table)
    const r = await f.read(); assert.equal(r.data_state, 'unavailable'); assert.doesNotMatch(JSON.stringify(r), /PRIVATE/)
  }
  const f = fixture(0), r = await f.read()
  assert.deepEqual(r.candidates, []); assert.equal(r.scope, 'future_approved_facebook_photo_reviews'); assert.equal(r.canPublish, false)
})

test('candidate listing includes original JPEG alongside PNG, excluding WebP and unapproved or scheduled work', async () => {
  const f = fixture(5)
  f.tables.content_review_versions[1].media_type = 'image/jpeg'
  f.tables.content_review_versions[2].media_type = 'image/webp'
  f.tables.content_review_versions[3].state = 'client_review'
  f.tables.monthly_deliverables[4].production_status = 'scheduled'
  const result = await f.read()
  assert.deepEqual(result.candidates.map(r => r.review_id), [id(1), id(2)])
  assert.equal(result.scope, 'future_approved_facebook_photo_reviews')
  assert.equal(result.has_more, false); assert.equal(result.canPublish, false)
  assert.deepEqual(f.envReads, [])
})
test('exact inspection refuses a different client review and stays off without its own read-only gate', async () => {
  const f = fixture(); assert.equal((await f.read({ client_id: client, review_id: id(1) })).code, 'PUBLICATION_INSPECTION_DISABLED')
  f.tables.content_review_versions[0].client_id = id(999)
  assert.equal((await f.read({ client_id: client, review_id: id(1) })).code, 'CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
})
test('account-only inspection does not require an approved review and retains its explicit read-only gate', async () => {
  const f = fixture(0), result = await f.read({ client_id: client, account_only: true })
  assert.equal(result.code, 'PUBLICATION_INSPECTION_DISABLED')
  assert.equal(result.canConfirm, false); assert.equal(result.canPublish, false)
  assert.equal(f.calls.includes('content_review_versions'), false)
})

test('account-only returns a safe unknown-expiry blocker without reaching Page or publication APIs', async () => {
  const f = fixture(0), connection = id(700), tokenStorage = await server.ssrLoadModule('/supabase/functions/_shared/metaTokenStorage.ts')
  const env = { SOCIAL_FACEBOOK_PHOTO_INSPECTION_ENABLED: 'true', META_GRAPH_VERSION: 'v27.0', META_APP_ID: '789', META_APP_SECRET: 'fixture-app-secret',
    SUPABASE_URL: 'https://fixture.supabase.co', META_TOKEN_ENCRYPTION_KEY_B64: Buffer.alloc(32, 7).toString('base64'), META_TOKEN_ENCRYPTION_KEY_VERSION: 'v1' }
  f.tables.meta_client_assets = [{ id: id(701), client_id: client, connection_id: connection, facebook_page_id: '123', is_active: true }]
  f.tables.meta_connections = [{ id: connection, status: 'connected' }]
  f.tables.meta_connection_tokens = [{ connection_id: connection, encrypted_access_token:
    await tokenStorage.encryptMetaStoredToken('fixture-user-token', connection, env.META_TOKEN_ENCRYPTION_KEY_B64, 'v1') }]
  const fetchBefore = globalThis.fetch, requests = []
  globalThis.fetch = async (raw, init) => {
    const url = new URL(raw); requests.push({ path: url.pathname, method: init?.method ?? 'GET' })
    assert.equal(url.origin, 'https://graph.facebook.com'); assert.equal(url.pathname, '/v27.0/debug_token')
    return Response.json({ data: { app_id: '789', is_valid: true, type: 'USER', expires_at: 0,
      data_access_expires_at: Math.floor(Date.now() / 1000) + 3600, scopes: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'] } })
  }
  try {
    const result = await f.read({ client_id: client, account_only: true }, env)
    assert.equal(result.code, 'META_PUBLISHING_TOKEN_EXPIRY_UNVERIFIED')
    assert.equal(result.data_state, 'unavailable'); assert.equal(result.canPublish, false); assert.equal(result.canConfirm, false)
    assert.doesNotMatch(JSON.stringify(result), /fixture-user-token|fixture-app-secret|access_token|encrypted_access_token/)
    assert.deepEqual(requests, [{ path: '/v27.0/debug_token', method: 'GET' }])
    assert.equal(f.calls.includes('content_review_versions'), false)
  } finally { globalThis.fetch = fetchBefore }
})

test('account-only rejects overrides, wrong types and conflicting modes; false keeps ordinary metadata listing', async () => {
  for (const change of [{ account_only: 'true' }, { account_only: null }, { account_only: 1 }, { account_only: true, offset: 0 },
    { account_only: true, review_id: id(1) }, { account_only: true, account_id: '999' }, { account_only: true, connection_id: id(2) }]) {
    const f = fixture(0), result = await f.read({ client_id: client, ...change })
    assert.equal(result.code, 'READINESS_INPUT_INVALID'); assert.deepEqual(f.calls, []); assert.deepEqual(f.envReads, [])
  }
  const f = fixture(0), result = await f.read({ client_id: client, account_only: false })
  assert.equal(result.data_state, 'available'); assert.deepEqual(result.candidates, []); assert.deepEqual(f.envReads, [])
})

test('actual catalog and operating-context policy expose a closed read-only company-admin tool only', () => {
  const tool = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_facebook_post_readiness')
  assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.inputSchema.additionalProperties, false)
  assert.equal(tool.inputSchema.properties.account_only.type, 'boolean')
  assert.deepEqual(tool.inputSchema.required, ['client_id', 'context'])
  assert.equal(policy.assertToolAllowedInContext(tool.name, 'company_admin').allowed, true)
  for (const context of ['staff', 'client']) assert.equal(policy.assertToolAllowedInContext(tool.name, context).allowed, false)
  assert.match(readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8'), /get_facebook_post_readiness: \(staff, input\) => readFacebookPostReadiness\(staff.supabase, staff.profileId/)
})
