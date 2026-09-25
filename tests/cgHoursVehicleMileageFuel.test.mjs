import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let mod

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
  })
  mod = await server.ssrLoadModule('/src/lib/cgHours/vehicleMileageFuel.ts')
})

after(async () => { await server.close() })

test('VEHICLE_ENTRY_TYPES contains exactly three types', () => {
  assert.deepEqual([...mod.VEHICLE_ENTRY_TYPES].sort(), ['fuel', 'mileage', 'vehicle_expense'])
})

test('validateVehicleMileageFuelDraft: valid mileage draft passes', () => {
  const draft = {
    client_id: 'c-dulux',
    date: '2026-07-15',
    type: 'mileage',
    distance_km: 120,
    rate_per_km: 4.5,
    notes: 'Client site visit',
  }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateVehicleMileageFuelDraft: valid fuel draft passes', () => {
  const draft = {
    client_id: null,
    date: '2026-07-15',
    type: 'fuel',
    litres: 45,
    cost_per_litre: 22.5,
    receipt_url: 'https://example.com/receipt.pdf',
  }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateVehicleMileageFuelDraft: valid vehicle_expense draft passes', () => {
  const draft = {
    client_id: 'c-braize',
    date: '2026-07-15',
    type: 'vehicle_expense',
    description: 'Parking at client office',
    amount: 50,
  }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateVehicleMileageFuelDraft: missing date fails', () => {
  const draft = { type: 'mileage', distance_km: 100, rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('date')))
})

test('validateVehicleMileageFuelDraft: invalid date format fails', () => {
  const draft = { date: '15-07-2026', type: 'mileage', distance_km: 100, rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('YYYY-MM-DD')))
})

test('validateVehicleMileageFuelDraft: invalid type fails', () => {
  const draft = { date: '2026-07-15', type: 'taxi', distance_km: 100, rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('type must be one of')))
})

test('validateVehicleMileageFuelDraft: mileage missing distance_km fails', () => {
  const draft = { date: '2026-07-15', type: 'mileage', rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('distance_km')))
})

test('validateVehicleMileageFuelDraft: mileage missing rate_per_km fails', () => {
  const draft = { date: '2026-07-15', type: 'mileage', distance_km: 100 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('rate_per_km')))
})

test('validateVehicleMileageFuelDraft: fuel missing litres fails', () => {
  const draft = { date: '2026-07-15', type: 'fuel', cost_per_litre: 22.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('litres')))
})

test('validateVehicleMileageFuelDraft: fuel missing cost_per_litre fails', () => {
  const draft = { date: '2026-07-15', type: 'fuel', litres: 45 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('cost_per_litre')))
})

test('validateVehicleMileageFuelDraft: vehicle_expense missing description fails', () => {
  const draft = { date: '2026-07-15', type: 'vehicle_expense', amount: 50 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('description')))
})

test('validateVehicleMileageFuelDraft: vehicle_expense missing amount fails', () => {
  const draft = { date: '2026-07-15', type: 'vehicle_expense', description: 'Toll fee' }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('amount')))
})

test('validateVehicleMileageFuelDraft: negative distance_km fails', () => {
  const draft = { date: '2026-07-15', type: 'mileage', distance_km: -10, rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('non-negative')))
})

test('validateVehicleMileageFuelDraft: excessive distance_km fails', () => {
  const draft = { date: '2026-07-15', type: 'mileage', distance_km: 2500, rate_per_km: 4.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('exceeds reasonable daily maximum')))
})

test('validateVehicleMileageFuelDraft: excessive litres fails', () => {
  const draft = { date: '2026-07-15', type: 'fuel', litres: 250, cost_per_litre: 22.5 }
  const errors = mod.validateVehicleMileageFuelDraft(draft)
  assert.ok(errors.some(e => e.includes('exceeds reasonable single-fill maximum')))
})

test('calculateMileageAmount: basic calculation', () => {
  assert.equal(mod.calculateMileageAmount(100, 4.5), 450)
  assert.equal(mod.calculateMileageAmount(120.5, 4.5), 542.25)
})

test('calculateMileageAmount: zero values return zero', () => {
  assert.equal(mod.calculateMileageAmount(0, 4.5), 0)
  assert.equal(mod.calculateMileageAmount(100, 0), 0)
})

test('calculateMileageAmount: negative values return zero', () => {
  assert.equal(mod.calculateMileageAmount(-10, 4.5), 0)
  assert.equal(mod.calculateMileageAmount(100, -4.5), 0)
})

test('calculateFuelAmount: basic calculation', () => {
  assert.equal(mod.calculateFuelAmount(40, 22.5), 900)
  assert.equal(mod.calculateFuelAmount(45.5, 22.5), 1023.75)
})

test('calculateFuelAmount: zero values return zero', () => {
  assert.equal(mod.calculateFuelAmount(0, 22.5), 0)
  assert.equal(mod.calculateFuelAmount(40, 0), 0)
})

test('calculateFuelAmount: negative values return zero', () => {
  assert.equal(mod.calculateFuelAmount(-10, 22.5), 0)
  assert.equal(mod.calculateFuelAmount(40, -22.5), 0)
})

test('isDraftSubmittable: valid drafts return true', () => {
  assert.equal(mod.isDraftSubmittable({ date: '2026-07-15', type: 'mileage', distance_km: 100, rate_per_km: 4.5 }), true)
  assert.equal(mod.isDraftSubmittable({ date: '2026-07-15', type: 'fuel', litres: 40, cost_per_litre: 22.5 }), true)
  assert.equal(mod.isDraftSubmittable({ date: '2026-07-15', type: 'vehicle_expense', description: 'Parking', amount: 50 }), true)
})

test('isDraftSubmittable: invalid drafts return false', () => {
  assert.equal(mod.isDraftSubmittable({ type: 'mileage', distance_km: 100, rate_per_km: 4.5 }), false)
  assert.equal(mod.isDraftSubmittable({ date: '2026-07-15', type: 'fuel', litres: 40 }), false)
  assert.equal(mod.isDraftSubmittable({ date: '2026-07-15', type: 'vehicle_expense', description: 'Parking' }), false)
})

test('createEntryFromDraft: mileage creates entry with calculated amount', () => {
  const draft = { client_id: 'c-dulux', date: '2026-07-15', type: 'mileage', distance_km: 100, rate_per_km: 4.5 }
  const entry = mod.createEntryFromDraft(draft, 'staff-123', '2026-07-15T10:00:00Z')
  assert.equal(entry.staff_id, 'staff-123')
  assert.equal(entry.client_id, 'c-dulux')
  assert.equal(entry.date, '2026-07-15')
  assert.equal(entry.type, 'mileage')
  assert.equal(entry.distance_km, 100)
  assert.equal(entry.rate_per_km, 4.5)
  assert.equal(entry.amount, 450)
  assert.equal(entry.status, 'draft')
  assert.equal(entry.created_at, '2026-07-15T10:00:00Z')
  assert.equal(entry.updated_at, '2026-07-15T10:00:00Z')
})

test('createEntryFromDraft: fuel creates entry with calculated amount', () => {
  const draft = { client_id: null, date: '2026-07-15', type: 'fuel', litres: 40, cost_per_litre: 22.5 }
  const entry = mod.createEntryFromDraft(draft, 'staff-123', '2026-07-15T10:00:00Z')
  assert.equal(entry.type, 'fuel')
  assert.equal(entry.litres, 40)
  assert.equal(entry.cost_per_litre, 22.5)
  assert.equal(entry.amount, 900)
})

test('createEntryFromDraft: vehicle_expense uses provided amount', () => {
  const draft = { client_id: 'c-braize', date: '2026-07-15', type: 'vehicle_expense', description: 'Toll', amount: 75 }
  const entry = mod.createEntryFromDraft(draft, 'staff-123', '2026-07-15T10:00:00Z')
  assert.equal(entry.type, 'vehicle_expense')
  assert.equal(entry.description, 'Toll')
  assert.equal(entry.amount, 75)
})

test('createEntryFromDraft: throws on invalid draft', () => {
  const draft = { type: 'mileage', distance_km: 100, rate_per_km: 4.5 }
  assert.throws(() => mod.createEntryFromDraft(draft, 'staff-123'), /Invalid draft/)
})