import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DEFAULT_META_WORKER_LANES,
  MAX_META_WORKER_LANES,
  normalizeMetaWorkerLanes,
} from '../supabase/functions/_shared/metaWorkerLanes.ts'

test('worker lanes default to four and are hard-capped at six', () => {
  assert.equal(DEFAULT_META_WORKER_LANES, 4)
  assert.equal(MAX_META_WORKER_LANES, 6)
  assert.deepEqual(normalizeMetaWorkerLanes({}), { workerLane: 0, workerLanes: 4, startsLaneSet: false })
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 1000 }).workerLanes, 6)
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 0 }).workerLanes, 1)
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: -5 }).workerLanes, 1)
})

test('worker lane is clamped into the accepted lane set', () => {
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 4, workerLane: 3 }).workerLane, 3)
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 4, workerLane: 99 }).workerLane, 3)
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 4, workerLane: -2 }).workerLane, 0)
})

test('malformed lane values fail closed', () => {
  for (const value of [null, '4', 1.5, {}, false]) {
    assert.throws(() => normalizeMetaWorkerLanes({ workerLanes: value }), RangeError)
  }
  for (const value of [null, '0', 1.5, {}, false]) {
    assert.throws(() => normalizeMetaWorkerLanes({ workerLane: value }), RangeError)
  }
})

test('child lanes cannot recursively request another lane set', () => {
  assert.throws(
    () => normalizeMetaWorkerLanes({ workerLane: 0, workerLanes: 4, startLanes: true }),
    /cannot start another lane set/,
  )
  assert.equal(normalizeMetaWorkerLanes({ workerLanes: 4, startLanes: true }).startsLaneSet, true)
})
