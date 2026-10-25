import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { reviewPlannerCollisionEvidence } from '../scripts/lib/planner-collision-evidence.mjs'
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
function fixture() {
  const source_evidence = ['a', 'b'].map(task_id => ({ task_id, plan_id: 'oct', bucket_id: 'bucket', title: 'VIDEO 1', progress: 100, role: 'monthly' }))
  const review = { contract: 'teams_held_evidence_review_v1', writes: 0, apply_ready: false, reviews: [{ client_id: 'client', client: 'Exact Client', month: '2026-10',
    formats: [{ duplicate_slots: [{ slot: 'video/1', master_task_ids: ['m'], monthly_task_ids: ['a', 'b'] }] }], source_evidence }] }
  const rows = source_evidence.map(s => ({ expected: { id: s.task_id, plan_id: s.plan_id, bucket_id: s.bucket_id, title: s.title, progress: s.progress, client_id: 'client', client: 'Exact Client', role: s.role },
    observed_at: '2026-10-19T10:00:00Z', error: null, source: { id: s.task_id, plan_id: s.plan_id, bucket_id: s.bucket_id, title: s.title, percent_complete: 100, created_date_time: '2026-10-01T11:00:00Z', due_date_time: null } }))
  const metadata = { contract: 'planner_exact_task_metadata_readback_v1', source_review_sha256: hash(review), read_only: true, writes: 0, apply_ready: false, rows }
  return { review, metadata }
}
test('two exact same-title/completed/batch-created identities remain contested, not deduplicated', () => {
  const f = fixture(), before = structuredClone(f), r = reviewPlannerCollisionEvidence(f.review, f.metadata)
  assert.equal(r.groups[0].state, 'all_identities_verified_still_contested')
  assert.ok(r.rows.every(r => r.survivor === null && r.proposed_writes === 0))
  assert.equal(r.apply_ready, false); assert.deepEqual(f, before)
})
test('partial read and changed identity/progress hold exact groups without faking removal or approval', () => {
  for (const mutate of [f => { f.metadata.rows[0].error = 'read_failed'; f.metadata.rows[0].source = null },
    f => { f.metadata.rows[0].source.plan_id = 'foreign' }, f => { f.metadata.rows[0].source.percent_complete = 0 }]) {
    const f = fixture(); mutate(f); const r = reviewPlannerCollisionEvidence(f.review, f.metadata)
    assert.equal(r.groups[0].state, 'read_or_drift_held'); assert.equal(r.groups[0].survivor, null)
  }
})
test('retry failure stays held even if an earlier receipt succeeded; later failures are not concealed', () => {
  const f = fixture(); f.metadata.rows[0].retry = { observed_at: '2026-10-19T11:00:00Z', error: 'read_failed', source: null }
  assert.equal(reviewPlannerCollisionEvidence(f.review, f.metadata).rows[0].state, 'read_failed_held')
})

test('successful exact retry clears only the read hold, preserves old failures and never chooses a survivor', () => {
  const f = fixture(), original = structuredClone(f.metadata.rows[0])
  f.metadata.rows[0] = { ...original, error: 'read_failed', source: null,
    prior_retries: [{ observed_at: '2026-10-19T10:30:00Z', error: 'read_failed', source: null }],
    retry: { observed_at: '2026-10-19T11:00:00Z', error: null, source: original.source } }
  const before = structuredClone(f), result = reviewPlannerCollisionEvidence(f.review, f.metadata)
  assert.equal(result.rows[0].state, 'exact_metadata_match_still_contested')
  assert.equal(result.groups[0].state, 'all_identities_verified_still_contested')
  assert.ok(result.rows.every(r => r.survivor === null && r.proposed_writes === 0))
  assert.equal(result.apply_ready, false); assert.deepEqual(f, before)
})
test('wrong hash, foreign/missing/repeated members, changed expected text and cross-client metadata refuse', () => {
  for (const mutate of [f => f.metadata.source_review_sha256 = 'bad', f => f.metadata.rows.pop(),
    f => f.metadata.rows.push(f.metadata.rows[0]), f => f.metadata.rows[0].expected.title = 'Edited',
    f => f.metadata.rows[0].expected.client_id = 'foreign', f => f.review.reviews[0].month = '2026-11']) {
    const f = fixture(); mutate(f); assert.throws(() => reviewPlannerCollisionEvidence(f.review, f.metadata))
  }
})
