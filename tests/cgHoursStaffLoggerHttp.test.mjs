import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const STAFF_ID = '11111111-1111-4111-8111-111111111111'
const CLIENT_ID = '22222222-2222-4222-8222-222222222222'
const ENTRY_ID = '33333333-3333-4333-8333-333333333333'
const SECRET = 'test-only-secret-at-least-32-characters-long'
const ENDPOINT = 'https://cg-hours.example/api/staff-logger/invoke'
const INDEX = readFileSync(new URL('../supabase/functions/cg-dynamics-mcp/index.ts', import.meta.url), 'utf8')

let server, staffLogger, catalog
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  staffLogger = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/cgHoursStaffLogger.ts')
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
})
after(async () => { await server?.close() })

function decodeJwtPart(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
}

function decodeBase64UrlBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Buffer.from(padded, 'base64')
}

test('configuration requires the exact HTTPS staff-logger endpoint and a strong shared secret', () => {
  assert.equal(staffLogger.validateCgHoursStaffLoggerConfig(undefined, SECRET), null)
  assert.equal(staffLogger.validateCgHoursStaffLoggerConfig(ENDPOINT, 'short'), null)
  assert.equal(staffLogger.validateCgHoursStaffLoggerConfig('http://cg-hours.example/api/staff-logger/invoke', SECRET), null)
  assert.equal(staffLogger.validateCgHoursStaffLoggerConfig('https://cg-hours.example/api/other', SECRET), null)
  assert.deepEqual(staffLogger.validateCgHoursStaffLoggerConfig(ENDPOINT, SECRET), { endpoint: ENDPOINT, secret: SECRET })
})

test('capability contains only the locked HS256 staff claims and expires after five minutes', async () => {
  const token = await staffLogger.issueCgHoursStaffCapability(STAFF_ID, SECRET, {
    now: () => 1_800_000_000,
    randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })
  const [header, payload, signature] = token.split('.')
  assert.deepEqual(decodeJwtPart(header), { alg: 'HS256', typ: 'JWT' })
  assert.deepEqual(decodeJwtPart(payload), {
    iss: 'cg-dynamics',
    aud: 'cg-hours-staff-logger',
    sub: STAFF_ID,
    iat: 1_800_000_000,
    exp: 1_800_000_300,
    jti: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })
  assert.ok(signature.length > 20)
  assert.deepEqual(Object.keys(decodeJwtPart(payload)).sort(), ['aud', 'exp', 'iat', 'iss', 'jti', 'sub'])
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  assert.equal(await crypto.subtle.verify('HMAC', key, decodeBase64UrlBytes(signature), new TextEncoder().encode(`${header}.${payload}`)), true)
})

test('lost response retries with a fresh single-use capability and the same backend idempotency key', async () => {
  const calls = []
  const uuids = [
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  ]
  const result = await staffLogger.invokeCgHoursStaffLogger(
    { endpoint: ENDPOINT, secret: SECRET },
    STAFF_ID,
    'add_my_time_entry',
    { date: '2026-09-17', client_id: CLIENT_ID, minutes: 60, idempotency_key: 'stable-key' },
    {
      now: () => 1_800_000_000,
      randomUUID: () => uuids.shift(),
      fetchImpl: async (_url, init) => {
        calls.push(init)
        if (calls.length === 1) throw new TypeError('response lost')
        return new Response(JSON.stringify({
          ok: true,
          message: 'That was already logged — nothing was duplicated.',
          data: { replayed: true, record_id: ENTRY_ID },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    },
  )

  assert.equal(result.ok, true)
  assert.equal(staffLogger.durableCgHoursRecordId(result), ENTRY_ID)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].body, calls[1].body)
  assert.equal(JSON.parse(calls[1].body).input.idempotency_key, 'stable-key')
  assert.notEqual(calls[0].headers['x-cg-staff-capability'], calls[1].headers['x-cg-staff-capability'])
  assert.equal(decodeJwtPart(calls[0].headers['x-cg-staff-capability'].split('.')[1]).sub, STAFF_ID)
})

test('backend refusal and missing durable identity never become claimed success', async () => {
  const refused = await staffLogger.invokeCgHoursStaffLogger(
    { endpoint: ENDPOINT, secret: SECRET }, STAFF_ID, 'edit_my_time_entry',
    { entry_id: ENTRY_ID, minutes: 30, idempotency_key: 'stable-key' },
    { randomUUID: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', fetchImpl: async () => new Response(JSON.stringify({ ok: false, message: 'That entry is not available.' }), { status: 200 }) },
  )
  assert.deepEqual(refused, { ok: false, error: 'CG_HOURS_REFUSED', message: 'That entry is not available.' })

  const missingReceipt = { ok: true, message: 'Done.', data: {} }
  assert.equal(staffLogger.durableCgHoursRecordId(missingReceipt), null)
})

test('backend gap handoff names the missing CG Hours main authority and unconfigured calls fail closed without fetch', async () => {
  const gap = staffLogger.CG_HOURS_BACKEND_GAP
  assert.equal(gap.status, 'BACKEND_GAP')
  assert.match(gap.missing_authority, /POST \/api\/staff-logger\/invoke/)
  assert.match(gap.missing_authority, /x-cg-staff-capability/)
  assert.equal(gap.authority_source, 'CGProductionHouse/CG-Hours PR #3')
  assert.match(gap.authority_head, /^[0-9a-f]{40}$/)
  assert.match(gap.cg_hours_main_checked, /^[0-9a-f]{40}$/)
  assert.match(gap.required_to_close, /CG_HOURS_STAFF_LOGGER_URL/)

  let fetched = 0
  const result = await staffLogger.invokeCgHoursStaffLogger(null, STAFF_ID, 'add_my_time_entry', { idempotency_key: 'k' }, {
    fetchImpl: async () => { fetched += 1; throw new Error('must never fetch without backend authority') },
  })
  assert.equal(fetched, 0)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'CG_HOURS_NOT_CONFIGURED')

  assert.match(INDEX, /backend_gap: CG_HOURS_BACKEND_GAP/)
})

test('four Dynamics tools match the closed PR #3 HTTP shapes and expose no reimbursement semantics', () => {
  const byName = name => catalog.CG_DYNAMICS_MCP_TOOLS.find(tool => tool.name === name)
  const ordinary = byName('log_ordinary_hours')
  assert.deepEqual(ordinary.inputSchema.required, ['date', 'hours', 'task_description', 'client_id', 'idempotency_key', 'context'])
  assert.ok(ordinary.inputSchema.properties.task_template_id)

  const km = byName('log_kilometre_entry')
  assert.deepEqual(km.inputSchema.required, ['entry_id', 'distance_km', 'idempotency_key', 'context'])
  assert.deepEqual(Object.keys(km.inputSchema.properties).sort(), ['context', 'destination', 'distance_km', 'entry_id', 'idempotency_key', 'notes', 'origin'])

  const correction = byName('correct_my_entry')
  assert.deepEqual(correction.inputSchema.properties.entry_type.enum, ['time', 'mileage'])
  const exposedProperties = JSON.stringify({
    ordinary: ordinary.inputSchema.properties,
    km: km.inputSchema.properties,
    correction: correction.inputSchema.properties.correction.properties,
  })
  assert.doesNotMatch(exposedProperties, /fuel|vehicle_expense|rate_per_km|cost_per_litre|amount|litres/i)
  assert.doesNotMatch(exposedProperties, /submit|approve|reopen|payroll/i)
})

test('MCP handlers use the capability HTTP caller and contain no obsolete cross-project Supabase RPC path', () => {
  assert.match(INDEX, /CG_HOURS_STAFF_LOGGER_URL/)
  assert.match(INDEX, /CG_HOURS_STAFF_LOGGER_SECRET/)
  assert.match(INDEX, /invokeCgHoursStaffLogger/)
  assert.match(INDEX, /'add_my_time_entry'/)
  assert.match(INDEX, /'add_my_travel_km'/)
  assert.match(INDEX, /'get_my_hours_today'/)
  assert.match(INDEX, /'get_my_travel_today'/)
  assert.match(INDEX, /'edit_my_time_entry'/)
  assert.match(INDEX, /'edit_my_travel_km'/)
  assert.doesNotMatch(INDEX, /CG_HOURS_SUPABASE_URL|CG_HOURS_SERVICE_ROLE_KEY/)
  assert.doesNotMatch(INDEX, /create_ordinary_hours_entry|create_vehicle_entry|read_ordinary_hours_entries|read_vehicle_entries|apply_ordinary_hours_correction|apply_vehicle_correction/)
  assert.match(INDEX, /CANONICAL_RECEIPT_REPLAY_TOOLS[\s\S]*?'log_ordinary_hours'[\s\S]*?'log_kilometre_entry'[\s\S]*?'correct_my_entry'/)
})
