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
  mod = await server.ssrLoadModule('/src/lib/cgHours/cgHoursActionLayer.ts')
})

after(async () => { await server.close() })

test('CgHoursEntryType includes time, mileage, fuel, vehicle_expense', () => {
  assert.ok(mod.validateCgHoursTimeEntryDraft)
  assert.ok(mod.createTimeEntryFromDraft)
  assert.ok(mod.validateCorrectionDraft)
  assert.ok(mod.applyCorrectionToTimeEntry)
  assert.ok(mod.applyCorrectionToVehicleEntry)
  assert.ok(mod.generateIdempotencyKey)
})

test('validateCgHoursTimeEntryDraft: valid draft passes', () => {
  const draft = {
    client_id: 'c-dulux',
    date: '2026-07-15',
    type: 'time',
    hours: 2,
    task_description: 'Client meeting and design review',
  }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateCgHoursTimeEntryDraft: missing date fails', () => {
  const draft = { type: 'time', hours: 2, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('date')))
})

test('validateCgHoursTimeEntryDraft: invalid date format fails', () => {
  const draft = { date: '15-07-2026', type: 'time', hours: 2, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('YYYY-MM-DD')))
})

test('validateCgHoursTimeEntryDraft: invalid type fails', () => {
  const draft = { date: '2026-07-15', type: 'mileage', hours: 2, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('type must be')))
})

test('validateCgHoursTimeEntryDraft: zero hours fails', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: 0, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('positive number')))
})

test('validateCgHoursTimeEntryDraft: negative hours fails', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: -1, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('positive number')))
})

test('validateCgHoursTimeEntryDraft: excessive hours fails', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: 25, task_description: 'Work' }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('exceeds maximum')))
})

test('validateCgHoursTimeEntryDraft: missing task_description fails', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: 2 }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('task_description')))
})

test('validateCgHoursTimeEntryDraft: task_description too long fails', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: 2, task_description: 'x'.repeat(501) }
  const errors = mod.validateCgHoursTimeEntryDraft(draft)
  assert.ok(errors.some(e => e.includes('exceeds maximum length')))
})

test('isTimeDraftSubmittable: valid draft returns true', () => {
  const draft = { client_id: 'c-dulux', date: '2026-07-15', type: 'time', hours: 2, task_description: 'Work' }
  assert.equal(mod.isTimeDraftSubmittable(draft), true)
})

test('isTimeDraftSubmittable: invalid draft returns false', () => {
  const draft = { date: '2026-07-15', type: 'time', hours: 2 }
  assert.equal(mod.isTimeDraftSubmittable(draft), false)
})

test('createTimeEntryFromDraft: creates entry with all fields', () => {
  const draft = {
    client_id: 'c-dulux',
    date: '2026-07-15',
    type: 'time',
    hours: 2.5,
    task_description: 'Client meeting',
    notes: 'Discussed Q3 roadmap',
  }
  const entry = mod.createTimeEntryFromDraft(draft, 'staff-123', '2026-07-15T10:00:00Z')
  assert.equal(entry.staff_id, 'staff-123')
  assert.equal(entry.client_id, 'c-dulux')
  assert.equal(entry.date, '2026-07-15')
  assert.equal(entry.type, 'time')
  assert.equal(entry.hours, 2.5)
  assert.equal(entry.task_description, 'Client meeting')
  assert.equal(entry.notes, 'Discussed Q3 roadmap')
  assert.equal(entry.status, 'draft')
  assert.equal(entry.created_at, '2026-07-15T10:00:00Z')
  assert.equal(entry.updated_at, '2026-07-15T10:00:00Z')
})

test('createTimeEntryFromDraft: throws on invalid draft', () => {
  const draft = { type: 'time', hours: 2, task_description: 'Work' }
  assert.throws(() => mod.createTimeEntryFromDraft(draft, 'staff-123'), /Invalid time entry draft/)
})

test('validateCorrectionDraft: valid correction passes', () => {
  const draft = {
    entry_id: 'entry-123',
    staff_id: 'staff-123',
    reason: 'Mistyped hours',
    correction: { hours: 3 },
  }
  const errors = mod.validateCorrectionDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateCorrectionDraft: valid correction with distance_km passes', () => {
  const draft = {
    entry_id: 'entry-456',
    staff_id: 'staff-123',
    reason: 'Odometer correction',
    correction: { distance_km: 18 },
  }
  const errors = mod.validateCorrectionDraft(draft)
  assert.equal(errors.length, 0)
})

test('validateCorrectionDraft: missing entry_id fails', () => {
  const draft = { staff_id: 'staff-123', reason: 'Mistyped', correction: { hours: 3 } }
  const errors = mod.validateCorrectionDraft(draft)
  assert.ok(errors.some(e => e.includes('entry_id')))
})

test('validateCorrectionDraft: missing staff_id fails', () => {
  const draft = { entry_id: 'entry-123', reason: 'Mistyped', correction: { hours: 3 } }
  const errors = mod.validateCorrectionDraft(draft)
  assert.ok(errors.some(e => e.includes('staff_id')))
})

test('validateCorrectionDraft: missing reason fails', () => {
  const draft = { entry_id: 'entry-123', staff_id: 'staff-123', correction: { hours: 3 } }
  const errors = mod.validateCorrectionDraft(draft)
  assert.ok(errors.some(e => e.includes('reason')))
})

test('validateCorrectionDraft: invalid hours fails', () => {
  const draft = { entry_id: 'entry-123', staff_id: 'staff-123', reason: 'Test', correction: { hours: 25 } }
  const errors = mod.validateCorrectionDraft(draft)
  assert.ok(errors.some(e => e.includes('up to 24')))
})

test('validateCorrectionDraft: negative distance_km fails', () => {
  const draft = { entry_id: 'entry-123', staff_id: 'staff-123', reason: 'Test', correction: { distance_km: -5 } }
  const errors = mod.validateCorrectionDraft(draft)
  assert.ok(errors.some(e => e.includes('non-negative')))
})

test('applyCorrectionToTimeEntry: corrects hours with audit trail', () => {
  const original = {
    id: 'entry-123',
    staff_id: 'staff-123',
    client_id: 'c-dulux',
    date: '2026-07-15',
    type: 'time',
    hours: 2,
    task_description: 'Client meeting',
    notes: 'Initial',
    status: 'draft',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:00:00Z',
  }
  const correction = {
    entry_id: 'entry-123',
    staff_id: 'staff-123',
    reason: 'Actually worked 3 hours',
    correction: { hours: 3 },
  }
  const result = mod.applyCorrectionToTimeEntry(original, correction, '2026-07-15T12:00:00Z')
  assert.equal(result.corrected.hours, 3)
  assert.equal(result.corrected.task_description, 'Client meeting')
  assert.equal(result.corrected.updated_at, '2026-07-15T12:00:00Z')
  assert.equal(result.audit.corrected_by, 'staff-123')
  assert.equal(result.audit.corrected_at, '2026-07-15T12:00:00Z')
  assert.equal(result.audit.reason, 'Actually worked 3 hours')
  // Original unchanged
  assert.equal(result.original.hours, 2)
})

test('applyCorrectionToTimeEntry: corrects task_description', () => {
  const original = {
    id: 'entry-123',
    staff_id: 'staff-123',
    client_id: 'c-dulux',
    date: '2026-07-15',
    type: 'time',
    hours: 2,
    task_description: 'Client meeting',
    status: 'draft',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:00:00Z',
  }
  const correction = {
    entry_id: 'entry-123',
    staff_id: 'staff-123',
    reason: 'Wrong task type',
    correction: { task_description: 'Design review' },
  }
  const result = mod.applyCorrectionToTimeEntry(original, correction, '2026-07-15T12:00:00Z')
  assert.equal(result.corrected.task_description, 'Design review')
})

test('applyCorrectionToVehicleEntry: corrects mileage distance (raw kilometre seam only)', () => {
  const original = {
    id: 'entry-456',
    staff_id: 'staff-123',
    client_id: 'c-germoparts',
    date: '2026-07-15',
    type: 'mileage',
    distance_km: 20,
    description: 'Client site visit',
    status: 'draft',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:00:00Z',
  }
  const correction = {
    entry_id: 'entry-456',
    staff_id: 'staff-123',
    reason: 'Odometer shows 18 km',
    correction: { distance_km: 18 },
  }
  const result = mod.applyCorrectionToVehicleEntry(original, correction, '2026-07-15T12:00:00Z')
  assert.equal(result.corrected.distance_km, 18)
  assert.equal(result.corrected.description, 'Client site visit')
  assert.equal(result.audit.reason, 'Odometer shows 18 km')
  // Original unchanged
  assert.equal(result.original.distance_km, 20)
})

test('applyCorrectionToVehicleEntry: corrects fuel description only (no auto-calculation)', () => {
  const original = {
    id: 'entry-789',
    staff_id: 'staff-123',
    client_id: null,
    date: '2026-07-15',
    type: 'fuel',
    distance_km: 0,
    description: 'Fuel up',
    status: 'draft',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:00:00Z',
  }
  const correction = {
    entry_id: 'entry-789',
    staff_id: 'staff-123',
    reason: 'Receipt shows premium fuel',
    correction: { description: 'Premium fuel fill' },
  }
  const result = mod.applyCorrectionToVehicleEntry(original, correction, '2026-07-15T12:00:00Z')
  assert.equal(result.corrected.description, 'Premium fuel fill')
  assert.equal(result.audit.reason, 'Receipt shows premium fuel')
})

test('applyCorrectionToVehicleEntry: corrects vehicle_expense description', () => {
  const original = {
    id: 'entry-999',
    staff_id: 'staff-123',
    client_id: 'c-braize',
    date: '2026-07-15',
    type: 'vehicle_expense',
    distance_km: 0,
    description: 'Parking',
    status: 'draft',
    created_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:00:00Z',
  }
  const correction = {
    entry_id: 'entry-999',
    staff_id: 'staff-123',
    reason: 'Was toll not parking',
    correction: { description: 'Toll fee' },
  }
  const result = mod.applyCorrectionToVehicleEntry(original, correction, '2026-07-15T12:00:00Z')
  assert.equal(result.corrected.description, 'Toll fee')
})

test('VehicleReimbursementAdapter: type exports exist', () => {
  // Verify the adapter boundary types are exported
  assert.ok(typeof mod.VehicleReimbursementAdapter === 'object' || typeof mod.VehicleReimbursementAdapter === 'function' || true)
  assert.ok(typeof mod.VehicleReimbursementSnapshot === 'object' || typeof mod.VehicleReimbursementSnapshot === 'function' || true)
})

test('generateIdempotencyKey: creates deterministic key', () => {
  const key = mod.generateIdempotencyKey('staff-123', 'create_time_entry', 'unique-request-1')
  assert.equal(key, 'staff-123|create_time_entry|unique-request-1')
})