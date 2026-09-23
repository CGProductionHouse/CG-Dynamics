import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const runbook = readFileSync('docs/ops/WEBSITE-M1-RED-OAK-ACCEPTANCE.md', 'utf8')
const migration = readFileSync('supabase/migrations/20260918140000_website_report_snapshots.sql', 'utf8')
const periodContract = readFileSync('supabase/migrations/20260923160000_website_snapshot_period_contract.sql', 'utf8')

test('acceptance runbook pins the exact Red Oak identity and forbids repeat writes', () => {
  assert.match(runbook, /cdb11a82-339e-4b46-9b09-bde1a23efeaf/)
  assert.match(runbook, /Builder Website ID: `7`/)
  assert.match(runbook, /www\.redoakgroup\.co\.za/)
  assert.match(runbook, /Do not click \*\*Save to monthly report draft\*\*/)
  assert.match(runbook, /Do not publish or republish/)
})

test('remaining UI proof is read-only and cross-client', () => {
  assert.match(runbook, /existing exact Red Oak client portal account/)
  assert.match(runbook, /sign in as one other mapped client/)
  assert.match(runbook, /cannot retrieve or display the Red Oak/)
  assert.match(runbook, /do not mutate either client's report or portal access/)
})

test('underlying SQL still enforces immutable exact-client published projection', () => {
  assert.match(migration, /Website report snapshots are immutable/)
  assert.match(migration, /report\.client_id = public\.my_client_id\(\)/)
  assert.match(migration, /report\.status = 'published'/)
  assert.match(migration, /revoke all on public\.website_report_snapshots from public, anon, authenticated/)
  assert.match(periodContract, /v_inclusive_period_end := p_period_end - 1/)
  assert.doesNotMatch(periodContract, /update public\.reports\s+set period_(start|end)/)
})
