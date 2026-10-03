import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { strategyArtifactSandbox } from './helpers/strategyArtifactSandbox.mjs'

function snapshot(directory) {
  return readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? snapshot(path) : [[path, createHash('sha256').update(readFileSync(path)).digest('hex')]]
  })
}

test('all strategy generators execute without modifying any frozen reviewed evidence', () => {
  const directory = 'artifacts/client-strategy-dossiers/issue-513'
  const before = snapshot(directory)
  const readArtifact = strategyArtifactSandbox([
    'build-client-strategy-dossiers', 'build-client-strategy-mutation-dry-run',
    'build-neshora-strategy-readiness-dry-run', 'build-issue-567-strategy-quality-readiness',
  ])
  assert.equal(JSON.parse(readArtifact('index.json')).active_client_count, 57)
  const readiness = JSON.parse(readArtifact('issue-567-sep-oct-strategy-quality-readiness.json'))
  assert.equal(readiness.rows.length, 94)
  const piek = readiness.rows.filter(row => row.client_name === 'Piek Group')
  assert.equal(piek.length, 2)
  assert.ok(piek.every(row => row.quality_status === 'blocked' && row.canonical_readiness === 'blocked'))
  assert.ok(piek.every(row => row.reviewed_strategy_hash === null))
  assert.deepEqual(snapshot(directory), before)
})
