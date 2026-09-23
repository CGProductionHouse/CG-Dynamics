import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildFactualReflection, buildReconciliationPlan, buildReviewedSnapshot, isGenericStrategyCopy, reconcileClientMonth, summarizeReviewedSnapshot, verifiedEvidenceTimestamp, verifyReviewedSnapshot } from '../scripts/lib/report-truth-reconciliation.mjs'

const client = { id: 'client-1', name: 'Exact Client', active: true }
const report = { id: 'report-1', client_id: client.id, platform: null, period_start: '2026-09-01', status: 'draft', strategy_next_month: null, content_direction_next_month: null }
const post = { id: 'post-1', report_id: report.id, meta_post_id: 'provider-1', platform: 'facebook', publish_time: '2026-09-14T08:00:00Z', meta_post_type: 'PHOTO', created_at: '2026-09-15T10:00:00Z', raw: { source: 'meta_sync', synced_at: '2026-09-16T10:00:00Z' } }
const applyScript = readFileSync(new URL('../scripts/reconcile-client-report-truth.mjs', import.meta.url), 'utf8')

test('September is publishable only as explicit month-to-date evidence', () => {
  const result = reconcileClientMonth({ client, month: '2026-09', reports: [report], posts: [post], strategy: null })
  assert.equal(result.state, 'mutation_target')
  assert.equal(result.period_end, '2026-09-16')
  assert.match(result.report_title, /Month-to-Date Report \(as of 2026-09-16\)/)
  assert.match(result.previous_month_reflection, /does not infer campaign intent, performance causes or unavailable metrics/)
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

test('September cutoff uses verified provider sync and never arbitrary row creation time', () => {
  assert.equal(verifiedEvidenceTimestamp(post)?.toISOString(), '2026-09-16T10:00:00.000Z')
  const createdOnly = { ...post, raw: {}, created_at: '2026-09-23T10:00:00Z' }
  assert.equal(verifiedEvidenceTimestamp(createdOnly), null)
  assert.equal(reconcileClientMonth({ client, month: '2026-09', reports: [report], posts: [createdOnly], strategy: null }).reason, 'MISSING_SEPTEMBER_AS_OF_EVIDENCE')
})

test('a stronger reviewed client-visible reflection is preserved', () => {
  const reviewed = { ...report, previous_month_reflection: 'Reviewed exact-client reflection.' }
  const result = reconcileClientMonth({ client, month: '2026-09', reports: [reviewed], posts: [post], strategy: null })
  assert.equal(result.previous_month_reflection, 'Reviewed exact-client reflection.')
})

test('published status alone is not treated as already satisfied when client-visible truth is incomplete', () => {
  const publishedButIncomplete = {
    ...report,
    status: 'published',
    period_end: '2026-09-16',
    report_title: 'Exact Client September 2026 Month-to-Date Report (as of 2026-09-16)',
    previous_month_reflection: null,
  }
  const result = reconcileClientMonth({ client, month: '2026-09', reports: [publishedButIncomplete], posts: [post], strategy: null })
  assert.equal(result.state, 'mutation_target')
  assert.match(result.previous_month_reflection, /Published-content record:/)

  const fullySatisfied = { ...publishedButIncomplete, previous_month_reflection: result.previous_month_reflection }
  assert.equal(reconcileClientMonth({ client, month: '2026-09', reports: [fullySatisfied], posts: [post], strategy: null }).state, 'already_satisfied')
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
  assert.equal(plan.already_satisfied, 0)
  assert.equal(plan.mutation_targets, 1)
  assert.equal(plan.withheld, 2)
  assert.match(plan.plan_hash, /^[a-f0-9]{64}$/)
  assert.deepEqual(plan.by_month['2026-09'], { target: 1, safe_to_publish: 1, already_satisfied: 0, mutation_targets: 1, withheld: 0 })
})

test('plan hash is stable across generated time and publication satisfaction for safe resume', () => {
  const first = buildReconciliationPlan({ clients: [client], reports: [report], posts: [post] })
  const desired = first.rows.find(row => row.month === '2026-09')
  const published = {
    ...report,
    status: 'published',
    period_start: desired.period_start,
    period_end: desired.period_end,
    report_title: desired.report_title,
    previous_month_reflection: desired.previous_month_reflection,
  }
  const resumed = buildReconciliationPlan({ clients: [client], reports: [published], posts: [post] })
  assert.equal(resumed.plan_hash, first.plan_hash)
  assert.equal(resumed.already_satisfied, 1)
  assert.equal(resumed.mutation_targets, 0)
})

test('immutable snapshot freezes exact source evidence and derived client payload', () => {
  const snapshot = buildReviewedSnapshot({
    clients: [client], reports: [report], posts: [post], strategies: [],
    snapshotCutoff: '2026-09-17T00:00:00.000Z',
  })
  assert.equal(snapshot.snapshot_cutoff, '2026-09-17T00:00:00.000Z')
  assert.match(snapshot.snapshot_hash, /^[a-f0-9]{64}$/)
  assert.equal(snapshot.rows.length, 3)
  const september = snapshot.rows.find(row => row.month === '2026-09')
  assert.deepEqual(september.client, client)
  assert.equal(september.report.id, report.id)
  assert.match(september.report.source_version, /^[a-f0-9]{64}$/)
  assert.deepEqual(september.included_posts[0].verified_evidence, { kind: 'meta_sync_synced_at', value: '2026-09-16T10:00:00.000Z' })
  assert.equal(september.derived.period_end, '2026-09-16')
  assert.match(september.derived.report_title, /Month-to-Date/)
  assert.match(september.derived.previous_month_reflection, /Published-content record/)
  assert.equal(verifyReviewedSnapshot(snapshot, snapshot.snapshot_hash), snapshot.snapshot_hash)
  assert.deepEqual(summarizeReviewedSnapshot(snapshot).withheld_reasons, { MISSING_CANONICAL_REPORT: 2 })
})

test('snapshot integrity rejects tampering and excludes evidence beyond its cutoff', () => {
  const afterCutoff = { ...post, raw: { source: 'meta_sync', synced_at: '2026-09-18T00:00:00Z' } }
  const snapshot = buildReviewedSnapshot({
    clients: [client], reports: [report], posts: [afterCutoff], strategies: [],
    snapshotCutoff: '2026-09-17T00:00:00.000Z',
  })
  assert.equal(snapshot.rows.find(row => row.month === '2026-09').reason, 'NO_IN_MONTH_POST_EVIDENCE')
  const tampered = structuredClone(snapshot)
  tampered.rows[0].client.name = 'Changed after review'
  assert.throws(() => verifyReviewedSnapshot(tampered, snapshot.snapshot_hash), /Snapshot integrity mismatch/)
})

test('apply requires a reviewed immutable snapshot and conditional current row state', () => {
  assert.match(applyScript, /Live-plan apply is disabled/)
  assert.match(applyScript, /--apply-snapshot/)
  assert.match(applyScript, /--expected-snapshot-hash/)
  assert.match(applyScript, /verifyReviewedSnapshot\(snapshot, expectedSnapshotHash\)/)
  assert.match(applyScript, /No writes were attempted/)
  assert.match(applyScript, /duplicate or replaced canonical report/)
  assert.match(applyScript, /report source-version drift/)
  assert.match(applyScript, /\.eq\('status', row\.report\.status\)/)
  assert.match(applyScript, /updated_at/)
  assert.match(applyScript, /concurrent report change detected/)
  assert.match(applyScript, /snapshot_cutoff: snapshot\.snapshot_cutoff/)
})
