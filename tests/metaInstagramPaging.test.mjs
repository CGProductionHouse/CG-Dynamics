import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  InstagramMediaTimestampError,
  classifyInstagramMediaPage,
} from '../supabase/functions/_shared/metaInstagramPaging.ts'

const start = '2026-07-01T00:00:00.000Z'
const end = '2026-08-01T00:00:00.000Z'
const media = (id, timestamp) => ({ id, timestamp })
const worker = readFileSync(new URL('../supabase/functions/meta-sync-worker/index.ts', import.meta.url), 'utf8')

test('verified descending mixed page keeps the full month window and continues', () => {
  const result = classifyInstagramMediaPage([
    media('new', '2026-08-02T00:00:00Z'),
    media('in-1', '2026-07-20T00:00:00Z'),
    media('in-2', '2026-07-01T00:00:00Z'),
    media('old', '2026-06-30T23:59:59Z'),
  ], start, end, null, true, false)
  assert.deepEqual(result.windowItems.map(item => item.id), ['in-1', 'in-2'])
  assert.equal(result.boundaryReached, false)
  assert.equal(result.orderingMalformed, false)
})

test('verified descending page stops only when every item is older than the month', () => {
  const result = classifyInstagramMediaPage([
    media('old-1', '2026-06-30T23:59:59Z'),
    media('old-2', '2026-06-01T00:00:00Z'),
  ], start, end, '2026-07-01T00:00:00Z', true, false)
  assert.equal(result.boundaryReached, true)
})

test('upper bound is exclusive and lower bound is inclusive', () => {
  const result = classifyInstagramMediaPage([
    media('upper', end),
    media('lower', start),
  ], start, end, null, true, false)
  assert.deepEqual(result.windowItems.map(item => item.id), ['lower'])
})

test('equal timestamps preserve descending-order validity', () => {
  const result = classifyInstagramMediaPage([
    media('a', '2026-07-10T12:00:00Z'),
    media('b', '2026-07-10T12:00:00Z'),
  ], start, end, '2026-07-10T12:00:00Z', true, false)
  assert.equal(result.orderingMalformed, false)
})

test('cross-page ordering increase disables boundary termination', () => {
  const result = classifyInstagramMediaPage([
    media('unexpected-newer', '2026-07-20T00:00:00Z'),
    media('old', '2026-06-01T00:00:00Z'),
  ], start, end, '2026-07-10T00:00:00Z', true, false)
  assert.equal(result.orderingMalformed, true)
  assert.equal(result.boundaryReached, false)
})

test('within-page ordering increase disables boundary termination', () => {
  const result = classifyInstagramMediaPage([
    media('old-first', '2026-06-01T00:00:00Z'),
    media('newer-later', '2026-07-10T00:00:00Z'),
  ], start, end, null, true, false)
  assert.equal(result.orderingMalformed, true)
  assert.equal(result.boundaryReached, false)
  assert.deepEqual(result.windowItems.map(item => item.id), ['newer-later'])
})

test('worker fails closed instead of traversing malformed ordering indefinitely', () => {
  assert.match(worker, /if \(pageResult\.orderingMalformed\) \{[\s\S]*refusing to traverse unbounded history/)
})

test('unverified Graph version never stops at an observed boundary', () => {
  const result = classifyInstagramMediaPage([
    media('old', '2026-06-01T00:00:00Z'),
  ], start, end, null, false, false)
  assert.equal(result.boundaryReached, false)
})

test('sticky malformed ordering forces exhaustive traversal', () => {
  const result = classifyInstagramMediaPage([
    media('old', '2026-06-01T00:00:00Z'),
  ], start, end, null, true, true)
  assert.equal(result.orderingMalformed, true)
  assert.equal(result.boundaryReached, false)
})

test('missing or invalid timestamps fail before checkpointing', () => {
  assert.throws(
    () => classifyInstagramMediaPage([{ id: 'missing' }], start, end, null, true, false),
    InstagramMediaTimestampError,
  )
  assert.throws(
    () => classifyInstagramMediaPage([media('invalid', 'not-a-date')], start, end, null, true, false),
    InstagramMediaTimestampError,
  )
})

test('independent month windows do not share an account-global watermark', () => {
  const july = classifyInstagramMediaPage([
    media('july', '2026-07-15T00:00:00Z'),
    media('june', '2026-06-15T00:00:00Z'),
  ], start, end, null, true, false)
  const june = classifyInstagramMediaPage([
    media('july', '2026-07-15T00:00:00Z'),
    media('june', '2026-06-15T00:00:00Z'),
    media('may', '2026-05-15T00:00:00Z'),
  ], '2026-06-01T00:00:00Z', start, null, true, false)
  assert.deepEqual(july.windowItems.map(item => item.id), ['july'])
  assert.deepEqual(june.windowItems.map(item => item.id), ['june'])
})
