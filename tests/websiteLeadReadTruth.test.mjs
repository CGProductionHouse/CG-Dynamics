import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, supabase, originalRpc, db, response
const clientId = '11111111-1111-4111-8111-111111111111'
const from = '2026-10-01', to = '2026-11-01'
const metrics = (overrides = {}) => ({
  clientId, state: 'available', period: { from, to, timezone: 'Africa/Johannesburg' },
  total: 0, new: 0, contacted: 0, qualified: 0, won: 0, closedLost: 0,
  lost: 0, good: 0, poor: 0, unreviewed: 0, qualificationRate: null, ...overrides,
})
const lead = {
  enquiry_id: 'enquiry', receipt_id: 'receipt', accepted_at: '2026-10-02T08:00:00Z',
  website_editor_website_id: 'website', form_schema_key: 'contact', form_schema_version: 1,
  contact_name: null, contact_email: null, contact_phone: null, fields: [], attribution: {},
  status: 'new', quality: null, poor_reason: null, poor_note: null, lifecycle_updated_at: null,
}
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  ;({ supabase } = await server.ssrLoadModule('/src/lib/supabase.ts'))
  db = await server.ssrLoadModule('/src/lib/db/websiteLeads.ts')
  originalRpc = supabase.rpc
  supabase.rpc = async () => response
})
after(async () => { if (supabase) supabase.rpc = originalRpc; await server?.close() })

test('missing/non-array inbox responses are unavailable, never a verified empty inbox', async () => {
  for (const data of [null, undefined, {}, 'invalid', 1]) {
    response = { data, error: null }
    assert.equal((await db.listWebsiteLeads()).state, 'error', JSON.stringify(data))
  }
  response = { data: [], error: null }
  assert.deepEqual(await db.listWebsiteLeads(), { state: 'ready', data: [] })
})

test('malformed lead identity/date is rejected before it can crash the rendered inbox', async () => {
  for (const row of [null, [], { ...lead, enquiry_id: null }, { ...lead, receipt_id: '' },
    { ...lead, accepted_at: 'invalid' }, { ...lead, accepted_at: '2026-02-30T08:00:00Z' },
    { ...lead, form_schema_version: '1' }, { ...lead, website_editor_website_id: undefined }]) {
    response = { data: [row], error: null }
    assert.equal((await db.listWebsiteLeads()).state, 'error')
  }
  response = { data: [lead], error: null }
  const result = await db.listWebsiteLeads()
  assert.equal(result.state, 'ready')
  assert.equal(result.data[0].acceptedAt, lead.accepted_at)
  assert.equal(result.data[0].contactName, null)
})

test('metrics enforce their exact client/period and numeric contract, not an object cast', async () => {
  for (const data of [null, [], {}, metrics({ state: 'unknown' }), metrics({ clientId: 'foreign' }),
    metrics({ period: { from: '2026-09-01', to, timezone: 'Africa/Johannesburg' } }),
    metrics({ period: { from, to, timezone: 'UTC' } }), metrics({ total: -1 }),
    metrics({ total: '0' }), metrics({ total: Number.MAX_SAFE_INTEGER + 1 }),
    metrics({ qualified: Number.NaN }), metrics({ poor: 0.5 }), metrics({ won: 1 }),
    metrics({ total: 1, new: 1, unreviewed: 1, qualificationRate: null }),
    metrics({ total: 1, qualified: 1, good: 1, qualificationRate: 0 }),
    metrics({ total: 1, qualified: 1, good: 0, qualificationRate: 1 }),
    metrics({ qualificationRate: 0 }), metrics({ qualificationRate: Number.POSITIVE_INFINITY })]) {
    response = { data, error: null }
    assert.equal((await db.getWebsiteLeadMetrics(clientId, from, to)).state, 'error', JSON.stringify(data))
  }
})

test('verified zero, disconnected history, rounded qualification and no-PII projection survive', async () => {
  for (const payload of [metrics(), metrics({ state: 'not_connected' }),
    metrics({ total: 3, new: 1, qualified: 1, good: 1, won: 1, closedLost: 1, poor: 1, unreviewed: 1, qualificationRate: 0.3333 }),
    metrics({ total: 1, qualified: 1, good: 1, lost: 1, closedLost: 1, qualificationRate: 1 }),
    metrics({ state: 'not_connected', total: 1, new: 1, unreviewed: 1, qualificationRate: 0 })]) {
    response = { data: { ...payload, internal_note: 'PRIVATE', contact_email: 'PRIVATE' }, error: null }
    const result = await db.getWebsiteLeadMetrics(clientId, from, to)
    assert.equal(result.state, 'ready')
    assert.equal(result.data.total, payload.total)
    assert.equal(result.data.qualificationRate, payload.qualificationRate)
    assert.doesNotMatch(JSON.stringify(result.data), /PRIVATE|clientId|internal_note|contact_email/)
  }
})

test('transport rejection cannot strand a lead read or expose its internal error', async () => {
  const stub = supabase.rpc
  supabase.rpc = async () => { throw new Error('PRIVATE transport details') }
  try {
    for (const read of [() => db.listWebsiteLeads(), () => db.getWebsiteLeadMetrics(clientId, from, to),
      () => db.getWebsiteLeadBreakdown(clientId, from, to, 'source')]) {
      const result = await read()
      assert.equal(result.state, 'error')
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE/)
    }
  } finally { supabase.rpc = stub }
})

test('missing rollout stays unavailable; denied reads stay errors; caller identity remains server pinned', async () => {
  const calls = [], stub = supabase.rpc
  supabase.rpc = async (name, args) => { calls.push([name, args]); return response }
  try {
    const readers = [() => db.listWebsiteLeads(), () => db.getWebsiteLeadMetrics(null, from, to),
      () => db.getWebsiteLeadBreakdown(null, from, to, 'source')]
    response = { data: null, error: { code: 'PGRST202' } }
    for (const read of readers) assert.equal((await read()).state, 'unavailable')
    response = { data: null, error: { code: '42501', message: 'PRIVATE denied details' } }
    for (const read of readers) {
      const result = await read()
      assert.equal(result.state, 'error')
      assert.doesNotMatch(JSON.stringify(result), /PRIVATE/)
    }
    assert.ok(calls.every(([, args]) => args.p_client_id === null))
    assert.ok(calls.every(([name]) => ['website_lead_inbox', 'website_lead_metrics', 'website_lead_breakdown'].includes(name)))
  } finally { supabase.rpc = stub }
})
