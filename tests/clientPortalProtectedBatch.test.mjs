import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260927143000_client_portal_provision_job.sql')
const worker = read('../supabase/functions/background-worker/index.ts')

test('portal job migration only extends the durable allowlist with client_portal_provision', () => {
  assert.match(migration, /'tiktok_analytics_refresh',[\s\S]*'client_portal_provision'/)
  assert.match(migration, /drop constraint background_jobs_allowed_type/)
  assert.match(migration, /add constraint background_jobs_allowed_type/)
  assert.doesNotMatch(migration, /create\s+(or\s+replace\s+)?function|grant\s+|revoke\s+|insert\s+into|update\s+public\.|delete\s+from/i)
})

test('background worker invokes only the existing portal access function for the exact job payload', () => {
  const start = worker.indexOf("case 'client_portal_provision':")
  const end = worker.indexOf("case 'content_autopilot':", start)
  assert.ok(start > 0 && end > start)
  const block = worker.slice(start, end)
  assert.match(block, /WORKER_INTERNAL_TOKEN/)
  assert.match(block, /X-Internal-Worker-Token/)
  assert.match(block, /\/functions\/v1\/client-portal-access/)
  assert.match(block, /client_id: clientId/)
  assert.match(block, /username/)
  assert.match(block, /action === 'link_existing'/)
  assert.match(block, /action === 'provision'/)
  assert.doesNotMatch(block, /password|auth\.admin|client_portal_access.*upsert/s)
})
