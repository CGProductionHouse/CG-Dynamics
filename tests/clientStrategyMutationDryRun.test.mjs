import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-dossiers.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-client-strategy-mutation-dry-run.mjs'], { stdio: 'pipe' })
const plan = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/sep-oct-strategy-mutation-dry-run.json', 'utf8'))

test('is a deterministic dry-run covering every exact Sep/Oct strategy row', () => {
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
  assert.equal(clientNames('CONFIRMED_NO_RECURRING_SOCIAL_SERVICE_SCOPE').size, 5)
  assert.equal(clientNames('ISSUE_516_SERVICE_SCOPE_HELD').size, 5)
  assert.equal(plan.counts.ready, 92)
  assert.equal(plan.counts.non_applicable, 10)
  assert.equal(plan.counts.held, 10)
  assert.equal(plan.counts.blocked, 0)
})

test('ready proposals are evidence-linked and preserve safe concurrency preconditions', () => {
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    assert.match(row.source_evidence_hash, /^[a-f0-9]{64}$/)
    assert.equal(row.precondition.workflow_status, 'draft')
    assert.equal(row.precondition.staff_amended_at, null)
    assert.ok(Number.isInteger(row.precondition.version))
    assert.ok(row.precondition.updated_at)
    assert.ok(row.proposed_strategy_data.strategyDrivers.length > 0)
    assert.ok(row.proposed_strategy_data.strategyGoingForward.length > 20)
    assert.doesNotMatch(JSON.stringify(row.proposed_strategy_data), /increase engagement|build awareness|post consistently|connect with the audience/i)
    assert.equal(row.proposed_seed_context.sources.issue_515_service_scope, 'eligible')
  }
})

test('never enables unconfirmed package formats or campaign work', () => {
  for (const row of plan.rows.filter(row => row.disposition === 'ready')) {
    const action = row.proposed_strategy_data.actionPlan
    assert.equal(action.campaign_recommendation.enabled, false)
    for (const value of Object.values(action)) {
      if (!value.enabled) assert.deepEqual(value.items, [])
    }
  }
})

test('blocked and non-applicable rows have no mutation payload', () => {
  for (const row of plan.rows.filter(row => row.disposition !== 'ready')) {
    assert.equal('proposed_strategy_data' in row, false)
    assert.equal('proposed_seed_context' in row, false)
  }
})
