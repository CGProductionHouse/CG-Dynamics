import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-dossiers.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-neshora-strategy-readiness-dry-run.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-neshora-strategy-amendment-dry-run.mjs'], { stdio: 'pipe' })

const readinessPlan = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/neshora-strategy-readiness-dry-run.json', 'utf8'))
const amendmentPlan = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/neshora-strategy-amendment-dry-run.json', 'utf8'))

test('Neshora readiness dry-run is exact-client, zero-write, and does not alter the reviewed fleet plan', () => {
  assert.equal(readinessPlan.issue, 513)
  assert.equal(readinessPlan.mode, 'dry_run')
  assert.equal(readinessPlan.write_count, 0)
  assert.equal(readinessPlan.preserves_reviewed_plan_hash, '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b')
  assert.equal(readinessPlan.rows.length, 2)
  assert.deepEqual(readinessPlan.rows.map(row => row.strategy_month), ['2026-09-01', '2026-10-01'])
  assert.ok(readinessPlan.rows.every(row => row.client_id === '3c20fae1-8e91-41d5-98eb-1c331600e6e3'))
  assert.ok(readinessPlan.rows.every(row => row.disposition === 'ready_for_draft_creation'))
  assert.equal(readinessPlan.counts.blocked, 0)
  assert.equal(readinessPlan.counts.ready_for_draft_creation, 2)
})

test('Neshora readiness dry-run carries confirmed scope, reviewed sources and a bounded draft proposal', () => {
  for (const row of readinessPlan.rows) {
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

test('Neshora amendment dry-run targets exact production strategy IDs and uses guarded atomic RPC contract', () => {
  assert.equal(amendmentPlan.issue, 513)
  assert.equal(amendmentPlan.mode, 'dry_run')
  assert.equal(amendmentPlan.write_count, 0)
  assert.equal(amendmentPlan.preserves_reviewed_plan_hash, '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b')
  assert.equal(amendmentPlan.rows.length, 2)
  assert.deepEqual(amendmentPlan.rows.map(row => row.strategy_month), ['2026-09-01', '2026-10-01'])
  assert.ok(amendmentPlan.rows.every(row => row.client_id === '3c20fae1-8e91-41d5-98eb-1c331600e6e3'))
  assert.ok(amendmentPlan.rows.every(row => row.disposition === 'ready_for_amendment'))
  assert.equal(amendmentPlan.counts.blocked, 0)
  assert.equal(amendmentPlan.counts.ready_for_amendment, 2)

  // Exact production strategy IDs from auto-seeding
  assert.equal(amendmentPlan.rows[0].strategy_id, '345ff5dc-a669-4e71-8312-e11472a3494f')
  assert.equal(amendmentPlan.rows[1].strategy_id, 'c4db3ace-ceed-4c8f-99cb-2841edf12613')
})

test('Neshora amendment dry-run preconditions match auto-seeded draft v1 state', () => {
  for (const row of amendmentPlan.rows) {
    assert.equal(row.precondition.workflow_status, 'draft')
    assert.equal(row.precondition.version, 1)
    assert.equal(row.precondition.staff_amended_at, null)
    assert.equal(row.precondition.approved_at, null)
    assert.equal(row.precondition.published_at, null)
    assert.equal(row.precondition.internal_notes, null)
    // Current strategy/seed context hashes are stale auto-seeded placeholders
    assert.match(row.precondition.current_strategy_hash, /AUTO_SEEDED_STALE/)
    assert.match(row.precondition.current_seed_context_hash, /AUTO_SEEDED_STALE/)
  }
})

test('Neshora amendment dry-run carries package verification provenance in seed_context', () => {
  for (const row of amendmentPlan.rows) {
    const ctx = row.proposed_seed_context
    assert.equal(ctx.version, 2)
    assert.equal(ctx.origin, 'issue-513-reviewed-amendment')
    assert.equal(ctx.client_id, '3c20fae1-8e91-41d5-98eb-1c331600e6e3')
    assert.equal(ctx.strategy_month, row.strategy_month)
    assert.equal(ctx.sources.package_verification_confirmed_at, '2026-09-23T19:03:12.585396+00:00')
    assert.deepEqual(ctx.sources.package_source_references, [
      'https://github.com/CGProductionHouse/CG-Dynamics/issues/516#issuecomment-5801092086',
    ])
    assert.ok(ctx.sources.package_verification_actor_id === null || typeof ctx.sources.package_verification_actor_id === 'string')
    assert.equal(ctx.blockers.length, 0)
    assert.equal(ctx.source_coverage.client_package, 'confirmed')
    assert.equal(ctx.source_coverage.previous_monthly_strategy, 'auto_seeded_stale')
  }
})

test('Neshora amendment dry-run proposed payloads have deterministic hashes and internal notes', () => {
  for (const row of amendmentPlan.rows) {
    assert.equal(typeof row.proposed_strategy_hash, 'string')
    assert.equal(row.proposed_strategy_hash.length, 64)
    assert.equal(typeof row.proposed_seed_context_hash, 'string')
    assert.equal(row.proposed_seed_context_hash.length, 64)
    assert.match(row.proposed_internal_notes, /Amendment from auto-seeded stale draft/)
    assert.match(row.proposed_internal_notes, /Issue #513/)
    assert.match(row.safe_next_action, /amend_monthly_client_strategy_with_context/)
    assert.match(row.safe_next_action, /idempotency key/)
  }
})

test('Neshora amendment dry-run goldStandard briefs are complete and package-bounded', () => {
  for (const row of amendmentPlan.rows) {
    const gs = row.proposed_strategy_data.goldStandard
    const required = ['objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale', 'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration', 'successSignals', 'nextMonthGamePlan']
    for (const field of required) {
      assert.ok(typeof gs[field] === 'string' && gs[field].length > 0, `goldStandard.${field} must be non-empty string`)
    }
    assert.match(gs.mustAvoid, /clinical outcomes|diagnoses|medical\/safety advice|device specifications/)
    assert.match(gs.formatsAndRationale, /1 video.*4 photo.*4 poster|confirmed monthly capacity/)
    assert.match(gs.channelIntegration, /authorised social channels|TikTok.*Instagram.*operational state/)
  }
})
