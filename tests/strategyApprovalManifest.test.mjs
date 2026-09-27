import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auditStrategyRow, buildManifest, sha } from '../scripts/audit-monthly-strategy-approval-manifest.mjs'

const client = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Exact Client',
  active: true,
  package_settings: {
    professional_videos_per_month: 1,
    reels_per_month: null,
    photo_posts_per_month: 0,
    design_posters_per_month: 4,
    animated_posters_per_month: null,
    campaign_management_included: false,
    verification: {
      status: 'confirmed', version: 2, confirmed_at: '2026-09-01T00:00:00Z',
      confirmed_by_profile_id: '22222222-2222-4222-8222-222222222222', source_references: ['issue:test'],
    },
  },
}
const gold = Object.fromEntries([
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale', 'testAndChange',
  'pillarsAndHooks', 'mustAvoid', 'channelIntegration', 'successSignals', 'nextMonthGamePlan',
].map(field => [field, `Exact Client evidence-backed ${field} direction with a concrete bounded action.`]))
const strategyData = {
  strategyDrivers: ['Exact Client evidence'], strategyGoingForward: 'Exact Client concrete direction', clientActionsRequired: [],
  actionPlan: {
    professional_video: { enabled: true, items: ['One'], notes: '' }, reels: { enabled: false, items: [], notes: '' },
    photo_content: { enabled: false, items: [], notes: '' }, design_poster: { enabled: true, items: ['One'], notes: '' },
    animated_poster: { enabled: false, items: [], notes: '' }, campaign_recommendation: { enabled: false, items: [], notes: '' },
  },
  goldStandard: gold,
}
const seedContext = {
  client_id: client.id,
  strategy_month: '2026-09-01',
  sources: {
    issue_513_evidence_hash: 'a'.repeat(64),
    package_verification_confirmed_at: client.package_settings.verification.confirmed_at,
    package_verification_actor_id: client.package_settings.verification.confirmed_by_profile_id,
    package_source_references: client.package_settings.verification.source_references,
  },
}
const liveRow = {
  id: '33333333-3333-4333-8333-333333333333', client_id: client.id, strategy_month: '2026-09-01', workflow_status: 'draft', version: 2,
  staff_amended_at: '2026-09-27T00:00:00Z', approved_at: null, published_at: null, published_strategy_data: null,
  strategy_data: strategyData, seed_context: seedContext,
}
const reviewed = {
  client_id: client.id, strategy_month: liveRow.strategy_month, strategy_hash: sha(strategyData), seed_context_hash: sha(seedContext),
  strategy_data: strategyData, strategy_match_mode: 'exact', source_evidence_hash: 'a'.repeat(64), reviewed_plan_hash: 'b'.repeat(64),
}

test('accepts an exact reviewed v2 draft while preserving zero and unknown package scope', () => {
  const result = auditStrategyRow({ row: liveRow, client, reviewed, allClients: [client] })
  assert.deepEqual(result.errors, [])
})

test('fails closed on foreign client evidence, generic filler and package overreach', () => {
  const other = { id: '44444444-4444-4444-8444-444444444444', name: 'Other Client' }
  const row = structuredClone(liveRow)
  row.seed_context.foreign_client = other.id
  row.strategy_data.goldStandard.objective = 'Increase engagement'
  row.strategy_data.actionPlan.reels.enabled = true
  const result = auditStrategyRow({ row, client, reviewed, allClients: [client, other] })
  assert.ok(result.errors.includes('GENERIC_FILLER_DETECTED'))
  assert.ok(result.errors.includes('PACKAGE_ACTION_MISMATCH:reels'))
  assert.ok(result.errors.some(error => error.startsWith('FOREIGN_CLIENT_IDS:')))
  assert.ok(result.errors.includes('REVIEWED_STRATEGY_HASH_MISMATCH'))
  assert.ok(result.errors.includes('REVIEWED_PROVENANCE_HASH_MISMATCH'))
})

test('manifest is read-only, deterministic apart from explicit audit time, and prepares separate transitions', () => {
  const fleetPlan = {
    plan_hash: 'b'.repeat(64),
    rows: [{ disposition: 'ready', client_id: client.id, client_name: client.name, strategy_id: liveRow.id, strategy_month: liveRow.strategy_month,
      proposed_strategy_hash: sha(strategyData), proposed_seed_context_hash: sha(seedContext), source_evidence_hash: 'a'.repeat(64) }],
  }
  const neshoraPlan = { plan_hash: 'c'.repeat(64), rows: [] }
  const manifest = buildManifest({ liveRows: [liveRow], clients: [client], fleetPlan, neshoraPlan, auditedAt: '2026-09-27T00:00:00Z' })
  assert.equal(manifest.write_count, 0)
  assert.equal(manifest.rows[0].approval_transition.target_status, 'approved')
  assert.equal(manifest.rows[0].publication_transition_after_separate_review.target_status, 'published')
  assert.equal(manifest.rows[0].approval_transition.expected_version, 2)
  assert.notEqual(manifest.rows[0].approval_transition.idempotency_key, manifest.rows[0].publication_transition_after_separate_review.idempotency_key)
  assert.ok(manifest.audit_errors.includes('REVIEWED_PARTITION_NOT_94_ROWS_47_CLIENTS'))
})
