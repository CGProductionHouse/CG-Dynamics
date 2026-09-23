import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-dossiers.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-client-strategy-mutation-dry-run.mjs'], { stdio: 'pipe' })
const plan = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/sep-oct-strategy-mutation-dry-run.json', 'utf8'))
const source = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/strategy-source-snapshot.json', 'utf8'))
const sourceByStrategy = new Map(source.rows.map(row => [row.strategy_id, row]))
const goldFields = [
  'objective', 'audienceAndIntent', 'coreMessage', 'formatsAndRationale',
  'testAndChange', 'pillarsAndHooks', 'mustAvoid', 'channelIntegration',
  'successSignals', 'nextMonthGamePlan',
]

test('is a deterministic v2 dry-run covering every exact Sep/Oct strategy row', () => {
  assert.equal(plan.schema_version, 2)
  assert.equal(plan.mode, 'dry_run')
  assert.equal(plan.write_count, 0)
  assert.equal(plan.rows.length, 112)
  assert.match(plan.plan_hash, /^[a-f0-9]{64}$/)
  assert.equal(new Set(plan.rows.map(row => row.strategy_id)).size, 112)
})

test('uses the exact #515/#516 client partition', () => {
  const clientNames = reason => new Set(plan.rows.filter(row => row.reason === reason).map(row => row.client_name))
  const eligible = new Set(plan.rows.filter(row => row.reason === 'EXACT_EVIDENCE_AND_CONFIRMED_SOCIAL_SCOPE' || row.reason === 'INSUFFICIENT_EXACT_STRATEGY_EVIDENCE').map(row => row.client_id))
  assert.equal(eligible.size, 46)
  assert.equal(clientNames('CONFIRMED_NO_RECURRING_SOCIAL_SERVICE_SCOPE').size, 10)
  assert.equal(clientNames('ISSUE_516_SERVICE_SCOPE_HELD').size, 0)
  assert.equal(plan.counts.ready, 92)
  assert.equal(plan.counts.non_applicable, 20)
  assert.equal(plan.counts.held, 0)
  assert.equal(plan.counts.blocked, 0)
})

test('ready proposals are evidence-linked and freeze both strategy and provenance preconditions', () => {
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    assert.match(row.source_evidence_hash, /^[a-f0-9]{64}$/)
    assert.equal(row.precondition.workflow_status, 'draft')
    assert.equal(row.precondition.staff_amended_at, null)
    assert.equal(row.precondition.approved_at, null)
    assert.equal(row.precondition.published_at, null)
    assert.ok(Number.isInteger(row.precondition.version))
    assert.ok(row.precondition.updated_at)
    assert.match(row.precondition.current_strategy_hash, /^[a-f0-9]{64}$/)
    assert.match(row.precondition.current_seed_context_hash, /^[a-f0-9]{64}$/)
    assert.ok(row.proposed_strategy_data.strategyDrivers.length > 0)
    assert.ok(row.proposed_strategy_data.strategyGoingForward.length > 20)
    assert.doesNotMatch(JSON.stringify(row.proposed_strategy_data), /increase engagement|build awareness|post consistently|connect with the audience/i)
    assert.equal(row.proposed_seed_context.client_id, row.client_id)
    assert.equal(row.proposed_seed_context.strategy_month, row.strategy_month)
    assert.equal(row.proposed_seed_context.sources.issue_515_service_scope, 'eligible')
    assert.equal(row.proposed_seed_context.sources.issue_513_evidence_hash, row.source_evidence_hash)
  }
})

test('ready proposals carry current confirmed-package provenance required by the approval gate', () => {
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    const live = sourceByStrategy.get(row.strategy_id)
    assert.ok(live)
    const verification = live.package_settings?.verification
    assert.equal(verification?.status, 'confirmed')
    assert.ok([1, 2].includes(Number(verification?.version)))
    assert.equal(row.proposed_seed_context.sources.package_verification_confirmed_at, verification.confirmed_at)
    assert.equal(row.proposed_seed_context.sources.package_verification_actor_id, verification.confirmed_by_profile_id)
    assert.deepEqual(row.proposed_seed_context.sources.package_source_references, verification.source_references)
    assert.equal(row.proposed_seed_context.sources.package_verification_version, verification.version)
    assert.equal(row.proposed_seed_context.source_coverage.client_package, 'confirmed')
  }
})

test('ready proposals contain a complete exact-client gold-standard brief', () => {
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    const gold = row.proposed_strategy_data.goldStandard
    assert.ok(gold && typeof gold === 'object')
    for (const field of goldFields) {
      assert.equal(typeof gold[field], 'string')
      assert.ok(gold[field].trim().length >= 20, `${row.client_name} ${row.strategy_month} missing ${field}`)
    }
    const evidence = row.proposed_strategy_data.strategyDrivers
      .map(value => String(value).replace(/[.;]+$/, '').trim())
      .find(value => value.length >= 10 && !/(client id|tier:|https?:\/\/|^[0-9a-f]{8}-)/i.test(value))
    if (evidence) assert.ok(JSON.stringify(gold).includes(evidence.slice(0, Math.min(30, evidence.length))))
  }
})

test('never enables unknown or zero package formats or campaign work', () => {
  const mapping = {
    professional_video: 'professional_videos_per_month',
    reels: 'reels_per_month',
    photo_content: 'photo_posts_per_month',
    design_poster: 'design_posters_per_month',
    animated_poster: 'animated_posters_per_month',
  }
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    const live = sourceByStrategy.get(row.strategy_id)
    const action = row.proposed_strategy_data.actionPlan
    assert.equal(action.campaign_recommendation.enabled, false)
    for (const [key, field] of Object.entries(mapping)) {
      const quantity = live.package_settings[field]
      assert.equal(action[key].enabled, Number.isInteger(quantity) && quantity > 0)
      if (!action[key].enabled) assert.deepEqual(action[key].items, [])
    }
  }
})

test('blocked and non-applicable rows have no mutation payload', () => {
  for (const row of plan.rows.filter(row => row.disposition !== 'ready')) {
    assert.equal('proposed_strategy_data' in row, false)
    assert.equal('proposed_seed_context' in row, false)
  }
})
