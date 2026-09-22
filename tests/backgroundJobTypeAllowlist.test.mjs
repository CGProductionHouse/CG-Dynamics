import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

function allowedJobTypes(sql) {
  const match = sql.match(/check\s*\(\s*job_type\s+in\s*\(([^)]+)\)\s*\)\s*not valid/i)
  assert.ok(match, 'migration must install a NOT VALID job_type allowlist')
  return [...match[1].matchAll(/'([^']+)'/g)].map(result => result[1])
}

test('background job constraint has exactly the approved four-type allowlist', () => {
  assert.deepEqual(allowedJobTypes(migration), [
    'meta_sync',
    'report_prep',
    'monthly_strategy_autopilot',
    'content_autopilot',
  ])
})

test('background job constraint rejects unrelated job types by omission', () => {
  const allowed = new Set(allowedJobTypes(migration))

  for (const unrelated of ['web_push_delivery', 'microsoft_sync', 'instagram_sync', 'arbitrary_job']) {
    assert.equal(allowed.has(unrelated), false, `${unrelated} must remain outside the database allowlist`)
  }
})

test('migration changes only the named check constraint', () => {
  assert.match(migration, /alter table public\.background_jobs\s+drop constraint background_jobs_allowed_type/i)
  assert.match(migration, /alter table public\.background_jobs\s+add constraint background_jobs_allowed_type/i)
  assert.doesNotMatch(migration, /create\s+(or\s+replace\s+)?function|create\s+policy|alter\s+policy|grant\s+|revoke\s+|cron\.|net\.http|insert\s+into|update\s+public\.|delete\s+from/i)
})
