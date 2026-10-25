import assert from 'node:assert/strict'
import test from 'node:test'
import { changedCompanyEventFields } from '../src/lib/companyCalendarDraft.ts'

const event = {
  id: 'synthetic-event', title: '  Existing title  ', notes: 'Staff note', location: '',
  start_at: '2026-10-20T08:00:45.123Z', end_at: null, all_day: false,
  assigned_to_name: '  Existing staff  ', microsoft_event_id: 'source-event',
}

test('notes-only patch cannot alter minute-truncated source time, null end or untouched staff fields', () => {
  const before = JSON.stringify(event)
  const patch = changedCompanyEventFields(event, {
    title: 'Existing title', location: null, assigned_to_name: 'Existing staff',
    start_at: '2026-10-20T08:00:00.000Z', end_at: null, notes: 'Amended note',
  }, { notes: true })
  assert.deepEqual(patch, { notes: 'Amended note' })
  assert.equal(JSON.stringify(event), before)
})

test('explicit time changes are permitted without adding unchanged fields or source identities', () => {
  assert.deepEqual(changedCompanyEventFields(event, {
    start_at: '2026-10-20T09:00:00Z', end_at: '2026-10-20T10:00:00Z', notes: event.notes,
  }, { start_at: true, end_at: true }), { start_at: '2026-10-20T09:00:00Z', end_at: '2026-10-20T10:00:00Z' })
  assert.deepEqual(changedCompanyEventFields(event, { notes: event.notes }, { notes: true }), {})
})
