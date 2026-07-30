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
