import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = readFileSync('scripts/apply-reviewed-client-strategies.mjs', 'utf8')

test('requires an exact reviewed plan hash and schema-v2 partition', () => {
  assert.match(source, /--expected-plan-hash/)
  assert.match(source, /actualPlanHash !== plan\\.plan_hash/)
  assert.match(source, /expectedPlanHash !== actualPlanHash/)
  assert.match(source, /plan\\.schema_version !== 2/)
  assert.match(source, /ready\\.length !== 92/)
  assert.match(source, /nonApplicable\\.length !== 20/)
  assert.match(source, /held\\.length !== 0/)
  assert.match(source, /blocked\\.length !== 0/)
})

test('preflights exact live state before writes', () => {
  assert.match(source, /live\\.id === row\\.strategy_id/)
  assert.match(source, /live\\.client_id === row\\.client_id/)
  assert.match(source, /live\\.strategy_month === row\\.strategy_month/)
  assert.match(source, /live\\.updated_at === p\\.updated_at/)
  assert.match(source, /sha\\(live\\.strategy_data\\) === p\\.current_strategy_hash/)
  assert.match(source, /sha\\(live\\.seed_context\\) === p\\.current_seed_context_hash/)
  assert.match(source, /non-applicable row drifted from the reviewed snapshot/)
})

test('apply path uses only the guarded atomic RPC and remains resumable', () => {
  assert.match(source, /amend_monthly_client_strategy_with_context/)
  assert.match(source, /p_expected_version: row\\.precondition\\.version/)
  assert.match(source, /p_strategy_data: row\\.proposed_strategy_data/)
  assert.match(source, /p_seed_context: row\\.proposed_seed_context/)
  assert.match(source, /isAppliedState\\(row, live\\)/)
  assert.doesNotMatch(source, /transition_monthly_client_strategy/)
})

test('post-apply verification proves durable receipts and unchanged non-applicable rows', () => {
  assert.match(source, /monthly_client_strategy_revisions/)
  assert.match(source, /Missing durable #513 amendment receipt/)
  assert.match(source, /non-applicable row changed during apply/)
  assert.match(source, /verified_ready_rows: ready\\.length/)
  assert.match(source, /verified_non_applicable_unchanged: nonApplicable\\.length/)
  assert.match(source, /verified_revision_receipts: revisionCount/)
})
