import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../supabase/phase-29c-meta-sync-worker-leases.sql', import.meta.url),
  'utf8',
)
const page = readFileSync(
  new URL('../src/pages/admin/MetaIntegrationPage.tsx', import.meta.url),
  'utf8',
)
const worker = readFileSync(
  new URL('../supabase/functions/meta-sync-worker/index.ts', import.meta.url),
  'utf8',
)

test('claim RPC requeues expired worker leases before claiming rows', () => {
  assert.match(migration, /i\.status = 'running'/)
  assert.match(migration, /i\.started_at < now\(\) - interval '5 minutes'/)
  assert.match(migration, /when i\.attempts >= 3 then 'failed' else 'queued'/)
  assert.match(migration, /for update skip locked/i)
})

test('claim retries are bounded and the RPC is service-role only', () => {
  assert.match(migration, /i\.attempts >= 3/)
  assert.match(
    migration,
    /revoke all on function public\.claim_sync_batch_items\(integer, uuid\) from public, anon, authenticated/i,
  )
  assert.match(
    migration,
    /grant execute on function public\.claim_sync_batch_items\(integer, uuid\) to service_role/i,
  )
})

test('Meta sync UI detects stale running workers and offers safe recovery', () => {
  assert.match(page, /\.select\('status, started_at'\)/)
  assert.match(page, /const staleBefore = Date\.now\(\) - 5 \* 60 \* 1000/)
  assert.match(page, /staleRunningCount === runningCount/)
  assert.match(page, /Restarting safely retries expired worker leases/)
})

test('worker restart sends the apikey header like the legacy sync path', () => {
  assert.match(page, /apikey: SUPABASE_PUBLISHABLE_KEY/)
  assert.match(page, /'Authorization': `Bearer \$\{session\.access_token\}`/)
  assert.match(page, /meta-sync-worker/)
})

test('worker restart surfaces HTTP errors instead of silently ignoring them', () => {
  assert.match(page, /await response\.text\(\)/)
  assert.match(page, /!response\.ok \|\| data\?\.ok === false/)
  assert.match(page, /Worker restart failed:/)
  assert.match(page, /redactForDisplay\(/)
})

test('worker restart is guarded against repeated clicks', () => {
  assert.match(page, /retryWorkerRef\.current/)
  assert.match(page, /retryWorkerRef\.current = true/)
  assert.match(page, /finally \{\s*retryWorkerRef\.current = false/)
})

test('worker stops claiming within a time budget to avoid stranded running items', () => {
  assert.match(worker, /MAX_WORK_MS = 40_000/)
  assert.match(worker, /Date\.now\(\) - startedAt > MAX_WORK_MS\) break/)
})

test('worker self-triggers while stale running leases remain, even with zero processed', () => {
  assert.match(worker, /\.eq\('status', 'running'\)/)
  assert.match(worker, /\.lt\('started_at', staleBefore\)/)
  assert.match(worker, /workRemaining = \(remaining \?\? 0\) > 0 \|\| \(staleRunning \?\? 0\) > 0/)
})

test('worker never self-amplifies when the claim RPC is failing', () => {
  assert.match(worker, /let claimFailed = false/)
  assert.match(worker, /claimFailed = true/)
  assert.match(worker, /!claimFailed && workRemaining/)
})
