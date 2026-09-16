import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { beforeEach, test } from 'node:test'
import {
  CG_HOURS_NOT_CONFIGURED, CG_HOURS_REQUIRED_ACTIONS, createCgHoursAcceptanceHarness,
  createContractFixtureBackend, requireDurableReceipt,
} from './fixtures/cgHoursE2EContract.mjs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const CATALOG = read('../supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
const ROUTER = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const FRANKU = { context_kind: 'staff', staff_profile_id: 'staff-franku', role: 'staff' }
const SYDNEY = { context_kind: 'staff', staff_profile_id: 'staff-sydney', role: 'team' }
const CLIENTS = [{ id: 'client-germoparts', name: 'Germoparts', active: true }]
const TRIP = { client_name: 'Germoparts', distance_km: 20, driving_context: 'city', classification: 'business', idempotency_key: 'voice-turn-1' }

let backend, harness
beforeEach(() => {
  backend = createContractFixtureBackend()
  harness = createCgHoursAcceptanceHarness({ backend, clients: CLIENTS })
})

test('current main truth: the real MCP has no CG Hours action route and is NOT_CONFIGURED', async () => {
  for (const action of CG_HOURS_REQUIRED_ACTIONS) {
    assert.doesNotMatch(CATALOG, new RegExp(`name:\\s*['\"]${action}['\"]`))
    assert.doesNotMatch(ROUTER, new RegExp(`${action}:\\s*handle`))
  }
  const disconnected = createCgHoursAcceptanceHarness({ backend: null, clients: CLIENTS })
  assert.deepEqual(await disconnected.createTrip(FRANKU, TRIP), CG_HOURS_NOT_CONFIGURED)
})

test('1. Franku trip creates one exact business record with a durable receipt', async () => {
  const result = await harness.createTrip(FRANKU, TRIP)
  assert.deepEqual(
    [result.ok, result.staff_id, result.client_id, result.distance_km, result.driving_context, result.classification],
    [true, 'staff-franku', 'client-germoparts', 20, 'city', 'business'],
  )
  assert.ok(result.entry_id && result.receipt)
  assert.equal(backend.entries.size, 1)
})

test('2. exact retry returns the original durable ID and no duplicate', async () => {
  const first = await harness.createTrip(FRANKU, TRIP)
  const retry = await harness.createTrip(FRANKU, TRIP)
  assert.deepEqual([retry.entry_id, retry.receipt], [first.entry_id, first.receipt])
  assert.equal(backend.entries.size, 1)
})

test('3. Sydney team-role request is Sydney, never Franku', async () => {
  await harness.createTrip(FRANKU, TRIP)
  const result = await harness.createTrip(SYDNEY, { ...TRIP, idempotency_key: 'voice-turn-sydney' })
  assert.equal(result.staff_id, 'staff-sydney')
  assert.notEqual(result.staff_id, 'staff-franku')
  assert.equal(backend.entries.size, 2)
})

test('4. prompt attempt to log as Franku from Sydney context is denied', async () => {
  const result = await harness.createTrip(SYDNEY, { ...TRIP, staff_id: 'staff-franku' })
  assert.equal(result.code, 'STAFF_SCOPE_MISMATCH')
  assert.equal(backend.entries.size, 0)
})

test('5. wrong client injection is denied and ambiguous exact names fail closed', async () => {
  assert.equal((await harness.createTrip(FRANKU, { ...TRIP, client_id: 'client-other' })).code, 'CLIENT_SCOPE_MISMATCH')
  const ambiguous = createCgHoursAcceptanceHarness({
    backend, clients: [...CLIENTS, { id: 'client-duplicate', name: 'Germoparts', active: true }],
  })
  assert.equal((await ambiguous.createTrip(FRANKU, TRIP)).code, 'AMBIGUOUS_CLIENT')
  assert.equal(backend.entries.size, 0)
})

test('6. ordinary hours persists exact staff/client/hours/purpose with receipt', async () => {
  const result = await harness.createTime(FRANKU, {
    client_name: 'Germoparts', hours: 2, purpose: 'client meeting', idempotency_key: 'hours-turn-1',
  })
  assert.deepEqual(
    [result.ok, result.kind, result.staff_id, result.client_id, result.hours, result.purpose],
    [true, 'time', 'staff-franku', 'client-germoparts', 2, 'client meeting'],
  )
  assert.ok(result.entry_id && result.receipt)
})

test('7. correction retains before/after audit evidence', async () => {
  const original = await harness.createTrip(FRANKU, TRIP)
  const corrected = await harness.correctMine(FRANKU, {
    entry_id: original.entry_id, distance_km: 18, reason: 'Odometer confirmed 18 km',
  })
  assert.equal(corrected.distance_km, 18)
  assert.deepEqual(corrected.audit, [{
    staff_id: 'staff-franku', reason: 'Odometer confirmed 18 km',
    before: { distance_km: 20 }, after: { distance_km: 18 },
  }])
})

test('8. today read is caller-only and cross-staff read/correct is denied', async () => {
  const franku = await harness.createTrip(FRANKU, TRIP)
  await harness.createTrip(SYDNEY, { ...TRIP, idempotency_key: 'voice-turn-sydney' })
  const mine = await harness.listMine(FRANKU, { date: '2026-09-16' })
  assert.deepEqual(mine.entries.map(entry => entry.staff_id), ['staff-franku'])
  assert.equal((await harness.listMine(SYDNEY, { staff_id: 'staff-franku' })).code, 'STAFF_SCOPE_MISMATCH')
  assert.equal((await harness.correctMine(SYDNEY, {
    entry_id: franku.entry_id, distance_km: 18, reason: 'cross-staff attempt',
  })).code, 'CG_HOURS_SOURCE_ERROR')
})

test('9. backend unavailable/failing is typed and never an empty success', async () => {
  const unavailable = createCgHoursAcceptanceHarness({ backend: null, clients: CLIENTS })
  assert.deepEqual(await unavailable.createTrip(FRANKU, TRIP), CG_HOURS_NOT_CONFIGURED)
  const failing = createCgHoursAcceptanceHarness({
    clients: CLIENTS, backend: { createEntry: async () => ({ data: null, error: { code: 'UPSTREAM_DOWN' } }) },
  })
  const result = await failing.createTrip(FRANKU, TRIP)
  assert.equal(result.code, 'CG_HOURS_SOURCE_ERROR')
  assert.doesNotMatch(JSON.stringify(result), /logged successfully/i)
})

test('10. successful canonical result containing error:null remains success', async () => {
  const result = await harness.createTrip(FRANKU, TRIP)
  assert.equal(result.ok, true)
  assert.ok(result.entry_id)
})

test('impossible kilometre and odometer values fail closed before persistence', async () => {
  assert.equal((await harness.createTrip(FRANKU, { ...TRIP, distance_km: -1 })).code, 'INVALID_KILOMETRES')
  assert.equal((await harness.createTrip(FRANKU, { ...TRIP, distance_km: 2001 })).code, 'INVALID_KILOMETRES')
  assert.equal((await harness.createTrip(FRANKU, {
    ...TRIP, odometer_start: 82168, odometer_end: 82140,
  })).code, 'INVALID_ODOMETER')
  assert.equal((await harness.createTrip(FRANKU, {
    ...TRIP, odometer_start: 82140, odometer_end: 82168,
  })).code, 'INVALID_ODOMETER')
  assert.equal(backend.entries.size, 0)
})

test('success without both durable ID and receipt is rejected', () => {
  assert.equal(requireDurableReceipt({ ok: true }).code, 'CG_HOURS_MISSING_RECEIPT')
  assert.equal(requireDurableReceipt({ ok: true, entry_id: 'entry-1' }).code, 'CG_HOURS_MISSING_RECEIPT')
  assert.equal(requireDurableReceipt({ ok: true, receipt: 'receipt-1' }).code, 'CG_HOURS_MISSING_RECEIPT')
})
