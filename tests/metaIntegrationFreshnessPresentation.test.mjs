import assert from 'node:assert/strict'
import { test } from 'node:test'
import { metaAssetRunLabel } from '../src/lib/metaAssetRunPresentation.ts'

test('missing or partial checkpoint evidence remains explicitly unavailable', () => {
  assert.equal(metaAssetRunLabel('Facebook', null), 'Facebook: no durable checkpoint recorded')
  assert.equal(
    metaAssetRunLabel('Instagram', { status: null, health_state: null }),
    'Instagram: no durable checkpoint recorded',
  )
})

test('checkpoint-free recovery is truthful and never dereferences absent states', () => {
  assert.equal(
    metaAssetRunLabel('Facebook', { retrying: true }),
    'Facebook: no durable checkpoint recorded · recovery in progress',
  )
})

test('complete checkpoint preserves kind, health, month and freshness', () => {
  const label = metaAssetRunLabel('Instagram', {
    run_type: 'scheduled',
    period_month: '2026-09',
    status: 'success',
    health_state: 'verified_partial',
    finished_at: '2026-09-22T08:00:00.000Z',
  }, new Date('2026-09-23T08:00:00.000Z').getTime())

  assert.match(label, /Instagram: .* · incremental · verified partial · current · 2026-09/)
})

test('invalid timestamps and missing enum fields fail closed without throwing', () => {
  assert.equal(
    metaAssetRunLabel('Facebook', { finished_at: 'not-a-date', run_type: undefined, health_state: undefined }),
    'Facebook: no durable checkpoint recorded',
  )

  const label = metaAssetRunLabel('Facebook', {
    finished_at: '2026-09-20T08:00:00.000Z',
    run_type: undefined,
    health_state: undefined,
  }, new Date('2026-09-23T08:00:00.000Z').getTime())
  assert.match(label, /sync kind unavailable · health unavailable · stale/)
})

test('non-string provider enum values cannot crash Meta status presentation or become trusted labels', () => {
  const now = Date.parse('2026-10-25T11:00:00Z')
  const base = { finished_at: '2026-10-25T10:00:00Z', run_type: 'scheduled', health_state: 'verified_partial', status: 'success' }
  for (const value of [undefined, null, false, 0, 7, {}, [], ['verified'], { trim() { throw new Error('Never call provider methods') } }]) {
    for (const platform of ['Facebook', 'Instagram']) {
      assert.match(metaAssetRunLabel(platform, { ...base, run_type: value }, now), /sync kind unavailable · verified partial · current/)
      assert.match(metaAssetRunLabel(platform, { ...base, health_state: value }, now), /incremental · health unavailable · current/)
    }
  }
})

test('blank enum strings remain unavailable and real failure/recovery state is preserved', () => {
  const base = { finished_at: '2026-10-25T10:00:00Z', run_type: '  ', health_state: '\t', status: 'failed', retrying: true }
  assert.match(metaAssetRunLabel('Facebook', base, Date.parse('2026-10-25T11:00:00Z')), /sync kind unavailable · health unavailable · needs attention/)
  assert.match(metaAssetRunLabel('Instagram', { ...base, run_type: ' targeted_backfill ', health_state: ' permission_blocked ' }), /targeted backfill · permission blocked · needs attention/)
})
