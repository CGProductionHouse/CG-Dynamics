import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260801090000_durable_background_jobs.sql')
const lib = read('../src/lib/backgroundJobs.ts')
const worker = read('../supabase/functions/background-worker/index.ts')

test('durable queue: RLS own-or-manager, no direct write policy, idempotency key unique', () => {
  assert.match(sql, /enable row level security/)
  assert.match(sql, /for select to authenticated\s+using \(requested_by = auth\.uid\(\) or is_admin\(\) or is_manager\(\)\)/)
  assert.doesNotMatch(sql, /for (insert|update|delete) to /i)
  assert.match(sql, /idempotency_key text unique/)
})

test('worker claims atomically, treats empty-queue null-id as done, retries via fail RPC', () => {
  assert.match(worker, /claim_next_background_job/)
  assert.match(worker, /if \(!job \|\| !job\.id\) break/)
  assert.match(worker, /complete_background_job/)
  assert.match(worker, /fail_background_job/)
  // Bounded run so a scheduled invocation never runs unbounded.
  assert.match(worker, /MAX_RUNTIME_MS/)
  assert.match(worker, /MAX_JOBS_PER_RUN/)
})

test('client enqueues via the RLS-safe RPC and reads via the table (no direct insert)', () => {
  assert.match(lib, /rpc\('enqueue_background_job'/)
  assert.match(lib, /from\('background_jobs'\)\s*\.select/)
  assert.doesNotMatch(lib, /from\('background_jobs'\)\s*\.insert/)
})
