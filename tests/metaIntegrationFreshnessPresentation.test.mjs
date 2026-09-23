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
