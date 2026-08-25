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
const sharedMeta = readFileSync(
  new URL('../supabase/functions/_shared/meta.ts', import.meta.url),
  'utf8',
)
const hardeningMigration = readFileSync(
  new URL('../supabase/migrations/20260801170000_backend_acceptance_hardening.sql', import.meta.url),
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
  assert.match(worker, /invocationDeadline = startedAt \+ MAX_WORK_MS/)
  assert.match(worker, /Date\.now\(\) >= invocationDeadline - PAGE_FETCH_RESERVE_MS/)
  assert.match(worker, /remainingMs < MIN_PAGE_REQUEST_BUDGET_MS \+ PAGE_FETCH_RESERVE_MS/)
  assert.match(worker, /assertWorkBudget\(invocationDeadline, 'Facebook post upserts'\)/)
  assert.match(worker, /assertWorkBudget\(invocationDeadline, 'Instagram account facts'\)/)
})

test('shared account facts stop resumably between probes and cap every retry to remaining time', () => {
  assert.match(sharedMeta, /export class MetaSyncDeadlineError extends Error/)
  assert.match(sharedMeta, /readonly resumable = true/)
  assert.match(sharedMeta, /deadline\?: number/)
  assert.match(sharedMeta, /shouldCancel\?: \(\) => boolean/)
  assert.match(sharedMeta, /for \(const spec of specs\) \{[\s\S]*assertMetaSyncActive[\s\S]*probeMetric\([\s\S]*control\)/)
  assert.match(sharedMeta, /for \(let attempt = 0; attempt <= backoff\.length; attempt\+\+\) \{[\s\S]*assertMetaSyncActive/)
  assert.match(sharedMeta, /Math\.min\(requestedTimeoutMs, control\.deadline - Date\.now\(\)\)/)
  assert.match(sharedMeta, /if \(e instanceof MetaSyncDeadlineError\) throw e/)
})

test('worker passes its safe deadline and requeues the distinct connector deadline', () => {
  assert.match(worker, /deadline: invocationDeadline - PAGE_FETCH_RESERVE_MS/g)
  assert.match(worker, /e instanceof MetaSyncDeadlineError[\s\S]*throw new RetryableIncompleteError\(e\.message\)/)
  assert.match(worker, /e instanceof RetryableIncompleteError && \(item\.attempts < 3 \|\| isMetaRateLimitError[\s\S]*itemStatus = 'queued'/)
})

test('worker resumes from safe per-platform cursors and clears them on page completion', () => {
  assert.match(hardeningMigration, /facebook_next_cursor text/)
  assert.match(hardeningMigration, /instagram_next_cursor text/)
  assert.match(hardeningMigration, /length\(facebook_next_cursor\) between 1 and 4096/)
  assert.match(worker, /requestUrl\.searchParams\.set\('after', nextCursor\)/)
  assert.match(worker, /savePlatformState\('facebook', complete \? 'facts_pending' : 'pending', cursor, pagePostsSynced\)/)
  assert.match(worker, /savePlatformState\('instagram', complete \? 'facts_pending' : 'pending', cursor, pagePostsSynced\)/)
  assert.match(worker, /processPage[\s\S]*checkpoint\(candidateCursor, !nextUrl, pagePostsSynced\)/)
})

test('posts_synced advances atomically only with a completed page checkpoint', () => {
  assert.match(worker, /const pagePostsSynced = await processPage[\s\S]*await checkpoint\(candidateCursor, !nextUrl, pagePostsSynced\)/)
  assert.match(worker, /const checkpointedPostsSynced = postsSynced \+ completedPagePosts[\s\S]*posts_synced: checkpointedPostsSynced/)
  assert.match(worker, /if \(error\) throw new Error[\s\S]*postsSynced = checkpointedPostsSynced/)
  assert.doesNotMatch(worker, /postsSynced\+\+/)
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
