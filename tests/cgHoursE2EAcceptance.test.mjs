import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CG_HOURS_NOT_CONFIGURED,
  CG_HOURS_REQUIRED_ACTIONS,
  requireDurableReceipt,
} from './fixtures/cgHoursE2EContract.mjs'

test('checkpoint: the acceptance contract names the four narrow CG Hours actions', () => {
  assert.deepEqual(CG_HOURS_REQUIRED_ACTIONS, [
    'create_time_entry',
    'create_trip_entry',
    'list_my_entries',
    'correct_my_entry',
  ])
})

test('checkpoint: missing canonical persistence fails closed instead of claiming Logged', () => {
  assert.deepEqual(requireDurableReceipt(null), CG_HOURS_NOT_CONFIGURED)
  assert.equal(requireDurableReceipt({ ok: true }).code, 'CG_HOURS_MISSING_RECEIPT')
  assert.deepEqual(
    requireDurableReceipt({ ok: true, entry_id: 'cg-hours-entry-1' }),
    { ok: true, entry_id: 'cg-hours-entry-1' },
  )
})
