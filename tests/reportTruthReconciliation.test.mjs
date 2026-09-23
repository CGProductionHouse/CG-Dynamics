import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFactualReflection, buildReconciliationPlan, isGenericStrategyCopy, reconcileClientMonth } from '../scripts/lib/report-truth-reconciliation.mjs'

const client = { id: 'client-1', name: 'Exact Client', active: true }
const report = { id: 'report-1', client_id: client.id, platform: null, period_start: '2026-09-01', status: 'draft', strategy_next_month: null, content_direction_next_month: null }
const post = { id: 'post-1', report_id: report.id, meta_post_id: 'provider-1', platform: 'facebook', publish_time: '2026-09-14T08:00:00Z', meta_post_type: 'PHOTO', created_at: '2026-09-15T10:00:00Z', raw: {} }

test('September is publishable only as explicit month-to-date evidence', () => {
  const result = reconcileClientMonth({ client, month: '2026-09', reports: [report], posts: [post], strategy: null })
  assert.equal(result.state, 'safe_to_publish')
  assert.equal(result.period_end, '2026-09-15')
  assert.match(result.report_title, /Month-to-Date Report \(as of 2026-09-15\)/)
  assert.match(result.strategy_reflection, /does not infer campaign intent, performance causes or unavailable metrics/)
})

test('missing reports and missing post evidence remain withheld with exact reasons', () => {
  assert.equal(reconcileClientMonth({ client, month: '2026-07', reports: [], posts: [], strategy: null }).reason, 'MISSING_CANONICAL_REPORT')
  assert.equal(reconcileClientMonth({ client, month: '2026-08', reports: [{ ...report, period_start: '2026-08-01' }], posts: [], strategy: null }).reason, 'NO_IN_MONTH_POST_EVIDENCE')
})

test('unverified post identity and generic strategy copy fail closed', () => {
  assert.equal(reconcileClientMonth({ client, month: '2026-09', reports: [report], posts: [{ ...post, meta_post_id: null }], strategy: null }).reason, 'POST_IDENTITY_OR_DATE_UNVERIFIED')
  const genericReport = { ...report, strategy_next_month: 'Increase engagement and build brand awareness.' }
  assert.equal(reconcileClientMonth({ client, month: '2026-09', reports: [genericReport], posts: [post], strategy: { workflow_status: 'published' } }).reason, 'GENERIC_STRATEGY_COPY')
  assert.equal(isGenericStrategyCopy('Post consistently'), true)
})

test('factual reflection is deterministic and contains no performance claim', () => {
  const reflection = buildFactualReflection([post, { ...post, id: 'post-2', platform: 'instagram', meta_post_type: 'VIDEO' }])
  assert.equal(reflection, 'Published-content record: 2 posts (1 facebook, 1 instagram). Recorded formats: 1 photo, 1 video. This factual summary does not infer campaign intent, performance causes or unavailable metrics.')
})

test('plan covers every active client for all three required months', () => {
  const plan = buildReconciliationPlan({ clients: [client, { id: 'inactive', name: 'Inactive', active: false }], reports: [report], posts: [post] })
  assert.equal(plan.active_client_count, 1)
  assert.equal(plan.target_client_months, 3)
  assert.equal(plan.safe_to_publish, 1)
  assert.equal(plan.withheld, 2)
  assert.deepEqual(plan.by_month['2026-09'], { target: 1, safe_to_publish: 1, withheld: 0 })
})
