import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strategyArtifactSandbox } from './helpers/strategyArtifactSandbox.mjs'

const readArtifact = strategyArtifactSandbox(['build-client-strategy-dossiers', 'build-neshora-strategy-readiness-dry-run'])
const plan = JSON.parse(readArtifact('neshora-strategy-readiness-dry-run.json'))

test('Neshora dry-run is exact-client, zero-write, and does not alter the reviewed fleet plan', () => {
  assert.equal(plan.issue, 513)
  assert.equal(plan.mode, 'dry_run')
  assert.equal(plan.write_count, 0)
  assert.equal(plan.preserves_reviewed_plan_hash, '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b')
  assert.equal(plan.rows.length, 2)
  assert.deepEqual(plan.rows.map(row => row.strategy_month), ['2026-09-01', '2026-10-01'])
  assert.ok(plan.rows.every(row => row.client_id === '3c20fae1-8e91-41d5-98eb-1c331600e6e3'))
  assert.ok(plan.rows.every(row => row.disposition === 'ready_for_draft_creation'))
  assert.equal(plan.counts.blocked, 0)
  assert.equal(plan.counts.ready_for_draft_creation, 2)
})

test('Neshora dry-run carries confirmed scope, reviewed sources and a bounded draft proposal', () => {
  for (const row of plan.rows) {
    assert.deepEqual(row.package, {
      professional_videos_per_month: 1,
      photo_posts_per_month: 4,
      design_posters_per_month: 4,
    })
    assert.ok(row.unavailable_evidence.includes('monthly_strategies'))
    assert.equal(row.unavailable_evidence.includes('client_guides'), false)
    assert.ok(row.reviewed_intelligence_sources.some(source => source.includes('Neshora Oxygen/Brand Identity')))
    assert.match(row.safe_next_action, /existing monthly strategy contract/)
    assert.equal(typeof row.proposed_strategy_data?.goldStandard?.objective, 'string')
    assert.equal(row.proposed_strategy_data.actionPlan.professional_video.enabled, true)
    assert.equal(row.proposed_strategy_data.actionPlan.photo_content.enabled, true)
    assert.equal(row.proposed_strategy_data.actionPlan.design_poster.enabled, true)
    assert.equal(row.proposed_strategy_data.actionPlan.reels.enabled, false)
    assert.match(row.proposed_strategy_data.goldStandard.mustAvoid, /clinical outcomes|diagnoses|medical\/safety advice/)
  }
})
