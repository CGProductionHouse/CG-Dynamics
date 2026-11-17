import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, adapter, policy, catalog
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
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
  return { tables, calls, failures, envReads, read(input = { client_id: client }) { return adapter.readFacebookPostReadiness(sb, actor, input, key => { envReads.push(key); return undefined }) } }
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
  assert.deepEqual(r.candidates, []); assert.equal(r.scope, 'future_approved_facebook_png_reviews'); assert.equal(r.canPublish, false)
})
test('exact inspection refuses a different client review and stays off without its own read-only gate', async () => {
  const f = fixture(); assert.equal((await f.read({ client_id: client, review_id: id(1) })).code, 'PUBLICATION_INSPECTION_DISABLED')
  f.tables.content_review_versions[0].client_id = id(999)
  assert.equal((await f.read({ client_id: client, review_id: id(1) })).code, 'CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
})
test('actual catalog and operating-context policy expose a closed read-only company-admin tool only', () => {
  const tool = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'get_facebook_post_readiness')
  assert.equal(tool.annotations.readOnlyHint, true); assert.equal(tool.inputSchema.additionalProperties, false)
  assert.deepEqual(tool.inputSchema.required, ['client_id', 'context'])
  assert.equal(policy.assertToolAllowedInContext(tool.name, 'company_admin').allowed, true)
  for (const context of ['staff', 'client']) assert.equal(policy.assertToolAllowedInContext(tool.name, context).allowed, false)
  assert.match(readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8'), /get_facebook_post_readiness: \(staff, input\) => readFacebookPostReadiness\(staff.supabase, staff.profileId/)
})
