import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-dossiers.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-neshora-strategy-readiness-dry-run.mjs'], { stdio: 'pipe' })

const plan = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/neshora-strategy-readiness-dry-run.json', 'utf8'))

test('Neshora dry-run is exact-client, zero-write, and does not alter the reviewed fleet plan', () => {
  assert.equal(plan.issue, 513)
  assert.equal(plan.mode, 'dry_run')
  assert.equal(plan.write_count, 0)
  assert.equal(plan.preserves_reviewed_plan_hash, '4f84133b981aa449b0805fc11424c06f8acb2ec73b72cedcc0795a83502fef6b')
  assert.equal(plan.rows.length, 2)
  assert.deepEqual(plan.rows.map(row => row.strategy_month), ['2026-09-01', '2026-10-01'])
  assert.ok(plan.rows.every(row => row.client_id === '3c20fae1-8e91-41d5-98eb-1c331600e6e3'))
  assert.ok(plan.rows.every(row => row.disposition === 'blocked'))
})

test('Neshora dry-run carries only confirmed package facts and honest unavailable evidence', () => {
  for (const row of plan.rows) {
    assert.deepEqual(row.package, {
      professional_videos_per_month: 1,
      photo_posts_per_month: 4,
      design_posters_per_month: 4,
    })
    assert.ok(row.unavailable_evidence.includes('monthly_strategies'))
    assert.ok(row.unavailable_evidence.includes('client_guides'))
    assert.match(row.safe_next_action, /existing monthly strategy contract/)
    assert.equal('proposed_strategy_data' in row, false)
  }
})
