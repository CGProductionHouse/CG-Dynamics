import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

let server
let parseEnsureClientInput
let secretsMatch

const hoursClientId = '11111111-1111-4111-8111-111111111111'
const requestId = '22222222-2222-4222-8222-222222222222'

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({ parseEnsureClientInput, secretsMatch } = await server.ssrLoadModule('/supabase/functions/ensure-client-from-cg-hours/policy.ts'))
})

after(async () => { await server?.close() })

test('bridge input keeps exact UUID identity and trims only outer name whitespace', () => {
  assert.deepEqual(parseEnsureClientInput({ hoursClientId, requestId, exactName: '  Red Oak  ' }), {
    ok: true,
    value: { hoursClientId, requestId, exactName: 'Red Oak' },
  })
  assert.equal(parseEnsureClientInput({ hoursClientId, requestId, exactName: '' }).code, 'invalid_name')
  assert.equal(parseEnsureClientInput({ hoursClientId: 'red-oak', requestId, exactName: 'Red Oak' }).code, 'invalid_hours_client_id')
})

test('bridge authentication fails closed without a long matching server secret', async () => {
  const secret = 'test-only-bridge-secret-with-32-chars'
  assert.equal(await secretsMatch(secret, secret), true)
  assert.equal(await secretsMatch('wrong', secret), false)
  assert.equal(await secretsMatch(null, secret), false)
  assert.equal(await secretsMatch(secret, 'short'), false)
})

test('migration provides exact mapping, serialized idempotency and fail-closed collision handling', async () => {
  const migration = await readFile('supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql', 'utf8')
  assert.match(migration, /hours_client_id uuid not null unique/)
  assert.match(migration, /dynamics_client_id uuid primary key/)
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /where request_id = p_request_id/)
  assert.match(migration, /where hours_client_id = p_hours_client_id/)
  assert.match(migration, /lower\(btrim\(name\)\) = lower\(v_name\)/)
  assert.match(migration, /'code', 'name_collision'/)
  assert.doesNotMatch(migration, /similarity\s*\(|levenshtein\s*\(|soundex\s*\(/i)
})

test('new Dynamics clients use safe defaults and never invent a short code or rollout data', async () => {
  const migration = await readFile('supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql', 'utf8')
  assert.match(migration, /insert into public\.clients \(name, tier, active, package_settings, short_code\)/)
  assert.match(migration, /values \(v_name, 'standard', true, '\{\}'::jsonb, null\)/)
  assert.doesNotMatch(migration, /client_packages|monthly_deliverables|client_invites|auth\.users|onedrive/i)
})

test('the implementation contains no production backfill identities', async () => {
  const migration = await readFile('supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql', 'utf8')
  assert.doesNotMatch(migration, /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)
})
