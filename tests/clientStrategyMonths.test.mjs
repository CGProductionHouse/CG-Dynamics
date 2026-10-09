import assert from 'node:assert/strict'
import { test } from 'node:test'

const { clientStrategyMonths, selectClientStrategyMonth } = await import('../src/lib/clientStrategyMonths.ts')

test('client strategy exposes only Johannesburg current and next month, including year rollover', () => {
  const octoberBoundary = new Date('2026-09-30T22:00:00.000Z')
  assert.deepEqual(clientStrategyMonths(octoberBoundary), ['2026-10', '2026-11'])
  assert.equal(selectClientStrategyMonth('2026-09', octoberBoundary), '2026-10')
  assert.equal(selectClientStrategyMonth('2026-10', octoberBoundary), '2026-10')
  assert.equal(selectClientStrategyMonth('2026-11', octoberBoundary), '2026-11')
  assert.equal(selectClientStrategyMonth('2026-12', octoberBoundary), '2026-10')
  assert.deepEqual(clientStrategyMonths(new Date('2026-12-31T22:00:00.000Z')), ['2027-01', '2027-02'])
})

test('missing and malformed strategy deep links canonicalize to the current business month', () => {
  const now = new Date('2026-10-09T12:00:00.000Z')
  for (const month of [null, '', '2026-13', '2026-10-02', '2030-01', '../2026-11']) {
    assert.equal(selectClientStrategyMonth(month, now), '2026-10')
  }
})
