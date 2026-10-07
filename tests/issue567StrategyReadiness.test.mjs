import assert from 'node:assert/strict'
import { test } from 'node:test'
import { strategyArtifactSandbox } from './helpers/strategyArtifactSandbox.mjs'
import { buildReadiness, qualityErrors } from '../scripts/build-issue-567-strategy-quality-readiness.mjs'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const readArtifact = strategyArtifactSandbox(['build-client-strategy-mutation-dry-run', 'build-issue-567-strategy-quality-readiness'])
const artifact = JSON.parse(readArtifact('issue-567-sep-oct-strategy-quality-readiness.json'))

test('regenerates the complete 94-row quality/readiness matrix without writes or transitions', () => {
  assert.equal(artifact.mode, 'zero_write_strategy_quality_readiness')
  assert.equal(artifact.write_count, 0)
  assert.equal(artifact.rows.length, 94)
  assert.equal(new Set(artifact.rows.map(row => row.client_id)).size, 47)
  assert.equal(artifact.source_observation.counts.approved, 0)
  assert.equal(artifact.source_observation.counts.published, 0)
  assert.equal(artifact.source_observation.freshness, 'historical_input_not_live_verification')
  assert.doesNotMatch(JSON.stringify(artifact), /target_status|idempotency_key/)
})

test('copy-only screening never claims semantic review or current production verification', () => {
  assert.equal(artifact.counts.copy_screen_passed_requires_semantic_review, 94)
  assert.equal(artifact.counts.semantic_review_passed, 0)
  assert.equal(artifact.counts.blocked, 0)
  assert.ok(artifact.rows.every(row => row.quality_errors.length === 0))
})

test('Piek remains a mandatory two-month readiness fixture and requires a separate canonical amendment', () => {
  const rows = artifact.rows.filter(row => row.client_name === 'Piek Group')
  assert.equal(rows.length, 2)
  assert.ok(rows.every(row => row.quality_status === 'copy_screen_passed_requires_semantic_review'))
  assert.ok(rows.every(row => row.canonical_readiness === 'requires_separate_canonical_amendment'))
})

function inputs() {
  const read = name => JSON.parse(readArtifact(name))
  return { fleet: read('sep-oct-strategy-mutation-dry-run.json'), neshora: read('neshora-strategy-readiness-dry-run.json'), current: read('sep-oct-approval-publication-manifest.json'), generatedAt: '2026-10-07T08:00:00Z' }
}

test('blank strategy fails closed; regex-clean guardrails are not a semantic strategy pass', () => {
  assert.deepEqual(qualityErrors(null), ['MISSING_STRATEGY_COPY'])
  assert.deepEqual(qualityErrors({ direction: 'Keep captions concise. Use natural language.' }), [])
  const result = buildReadiness(inputs())
  assert.ok(result.rows.every(row => row.semantic_review_status === 'not_established_by_this_screen'))
  assert.doesNotMatch(JSON.stringify(result), /quality_review_passed|ready_for_human_approval|target_status/)
})

test('duplicate identity and missing clock are rejected instead of silently losing a row', () => {
  const input = inputs()
  input.current.rows.push(input.current.rows[0])
  assert.throws(() => buildReadiness(input), /Duplicate exact/)
  assert.throws(() => buildReadiness({ ...inputs(), generatedAt: undefined }), /timestamp/)
})

test('missing current evidence remains unknown, never invented draft or null-hash match', () => {
  const input = inputs()
  input.current.rows = []
  const result = buildReadiness(input)
  assert.ok(result.rows.every(row => row.current_status === null && row.current_strategy_id === null))
  assert.equal(result.counts.current_copy_matches_proposal, 0)
  assert.equal(result.counts.current_evidence_unavailable, 94)
})

test('missing proposal and missing observation counts stay unavailable, not passed or zero', () => {
  const input = inputs()
  const proposal = input.fleet.rows.find(row => row.disposition === 'ready')
  delete proposal.proposed_strategy_data
  delete proposal.proposed_strategy_hash
  delete input.current.counts
  const result = buildReadiness(input)
  const row = result.rows.find(row => row.client_id === proposal.client_id && row.strategy_month === proposal.strategy_month)
  assert.equal(row.quality_status, 'blocked')
  assert.ok(row.quality_errors.includes('MISSING_STRATEGY_COPY'))
  assert.deepEqual(result.source_observation.counts, { canonical_sep_oct_rows: null, approved: null, published: null })
})

test('altered proposal copy cannot retain a matching historical hash', () => {
  const input = inputs()
  const proposal = input.fleet.rows.find(row => row.disposition === 'ready')
  proposal.proposed_strategy_data.direction = 'Later unreviewed staff copy'
  const result = buildReadiness(input)
  const row = result.rows.find(row => row.client_id === proposal.client_id && row.strategy_month === proposal.strategy_month)
  assert.ok(row.quality_errors.includes('PROPOSAL_HASH_MISMATCH'))
  assert.equal(row.canonical_readiness, 'blocked')
})

test('default command refuses to overwrite frozen reviewed evidence', () => {
  const path = 'artifacts/client-strategy-dossiers/issue-513/issue-567-sep-oct-strategy-quality-readiness.json'
  const before = readFileSync(path, 'utf8')
  const env = { ...process.env }
  delete env.CG_STRATEGY_ARTIFACT_DIR
  assert.throws(() => execFileSync(process.execPath, ['scripts/build-issue-567-strategy-quality-readiness.mjs'], { env, stdio: 'pipe' }), /isolated CG_STRATEGY_ARTIFACT_DIR/)
  assert.equal(readFileSync(path, 'utf8'), before)
})
