import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

execFileSync(process.execPath, ['scripts/build-client-strategy-mutation-dry-run.mjs'], { stdio: 'pipe' })
execFileSync(process.execPath, ['scripts/build-issue-567-strategy-quality-readiness.mjs'], { stdio: 'pipe' })
const artifact = JSON.parse(readFileSync('artifacts/client-strategy-dossiers/issue-513/issue-567-sep-oct-strategy-quality-readiness.json', 'utf8'))

test('regenerates the complete 94-row quality/readiness matrix without writes or transitions', () => {
  assert.equal(artifact.mode, 'zero_write_strategy_quality_readiness')
  assert.equal(artifact.write_count, 0)
  assert.equal(artifact.rows.length, 94)
  assert.equal(new Set(artifact.rows.map(row => row.client_id)).size, 47)
  assert.equal(artifact.production_observation.approved, 0)
  assert.equal(artifact.production_observation.published, 0)
  assert.doesNotMatch(JSON.stringify(artifact), /target_status|idempotency_key/)
})

test('all reviewed proposals pass the strengthened client-copy quality gate', () => {
  assert.equal(artifact.counts.quality_review_passed, 94)
  assert.equal(artifact.counts.blocked, 0)
  assert.ok(artifact.rows.every(row => row.quality_errors.length === 0))
})

test('Piek remains a mandatory two-month readiness fixture and requires a separate canonical amendment', () => {
  const rows = artifact.rows.filter(row => row.client_name === 'Piek Group')
  assert.equal(rows.length, 2)
  assert.ok(rows.every(row => row.quality_status === 'quality_review_passed'))
  assert.ok(rows.every(row => row.canonical_readiness === 'requires_separate_canonical_amendment'))
})
