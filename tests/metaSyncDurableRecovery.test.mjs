import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Meta sync durable recovery — production blocker #161.
//
// Production reached 74 total / 4 completed / 0 running / 70 queued with no
// worker able to run and "Restart worker" unable to revive it. These lock in
// each link of the chain that failed.

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
// Several assertions below are "this pattern must NOT appear". The fix comments
// deliberately quote the old broken code, so those checks run against a
// comment-stripped copy — otherwise the explanation would fail the test.
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const worker = read('../supabase/functions/meta-sync-worker/index.ts')
const background = read('../supabase/functions/background-worker/index.ts')
const enqueue = read('../supabase/functions/meta-sync-enqueue/index.ts')
const page = read('../src/pages/admin/MetaIntegrationPage.tsx')
const durable = read('../supabase/migrations/20260804130000_meta_sync_durable_recovery.sql')
const hardening = read('../supabase/migrations/20260801170000_backend_acceptance_hardening.sql')
const watermark = read('../supabase/migrations/20260804140000_meta_sync_recovery_progress_watermark.sql')
const cooldown = read('../supabase/migrations/20260804150000_meta_sync_rate_limit_cooldown.sql')
const parallelSafety = read('../supabase/migrations/20260825180000_meta_sync_parallel_lane_safety.sql')
const fencing = read('../supabase/migrations/20260825190000_meta_sync_fencing_and_idempotency.sql')
const lanes = read('../supabase/functions/_shared/metaWorkerLanes.ts')
const dispatch = read('../supabase/functions/_shared/metaWorkerDispatch.ts')
const sharedMeta = read('../supabase/functions/_shared/meta.ts')

// ── Root cause 1: the only durable driver could die permanently ──────────────
test('a stalled batch is driven by the per-minute cron worker, not only by background_jobs', () => {
  // The background_jobs row for the stalled batch was status=failed with
  // attempts 3/3. Nothing could ever invoke a worker for it again.
  assert.match(background, /reapStalledMetaSyncBatches/)
  assert.match(background, /meta_sync_stalled_batches/)
  assert.match(background, /functions\/v1\/meta-sync-worker/)
  // The reaper must run on every tick, independent of the job queue result.
  const tail = background.slice(background.indexOf('const reaped = await reapStalledMetaSyncBatches'))
  assert.ok(tail.length > 0, 'reaper must run before the response is returned')
  assert.match(background, /reaped/)
})

test('the reaper only wakes batches with real work and no live worker', () => {
  assert.match(durable, /status in \('queued', 'running'\)/)
  assert.match(durable, /coalesce\(b\.worker_heartbeat_at, b\.created_at\) < now\(\) - make_interval/)
  assert.match(durable, /having count\(\*\) filter \(where i\.status = 'queued'\) > 0/)
})

test('the worker heartbeats durably so a live batch is never double-driven', () => {
  assert.match(fencing, /create or replace function public\.meta_sync_touch_item_lease/)
  assert.match(worker, /async function touchItemLease/)
  assert.match(worker, /await touchItemLease\(sb, item\.id, leaseGeneration\)/)
})

// ── Root cause 2: the self-continuation chain collapsed ─────────────────────
test('the worker hands off without holding the whole chain open', () => {
  // waitUntil kept every generation alive until all its descendants finished.
  // The nesting hit the platform ceiling after a couple of hops and the chain
  // died mid-flight, stranding the queue.
  const handoff = stripComments(worker).slice(stripComments(worker).indexOf('const workerUrl'))
  assert.doesNotMatch(handoff, /EdgeRuntime\.waitUntil/, 'must not keep ancestors alive for the whole chain')
  assert.match(dispatch, /AbortSignal\.timeout\(timeoutMs\)/)
  assert.match(worker, /selfTriggered = await dispatchMetaWorker/)
})

test('correctness does not depend on the hand-off surviving', () => {
  // Even with every hand-off lost, the cron reaper must finish the batch.
  assert.match(background, /reapStalledMetaSyncBatches/)
  assert.match(background, /meta_sync_stalled_batches/)
})

// ── Root cause 3: abandoned claims burned real retry attempts ───────────────
test('items claimed but never processed are released without consuming an attempt', () => {
  assert.match(fencing, /create or replace function public\.meta_sync_release_claims/)
  assert.match(fencing, /attempts = greatest\(0, item\.attempts - 1\)/)
  assert.match(worker, /const abandoned = \[\.\.\.claimedLeases\.entries\(\)\]/)
  assert.match(worker, /meta_sync_release_claims/)
})

test('supabase query builders are never given a .catch() handler', () => {
  // A builder is thenable but has no .catch(); calling it throws a TypeError
  // that kills the invocation and strands every item it holds. This regressed
  // once in production and must not return.
  // Only builders are unsafe. `res.json().catch(...)` is a real Promise and is
  // perfectly fine, so this targets the builder entry points specifically.
  for (const src of [stripComments(worker), stripComments(background)]) {
    assert.doesNotMatch(src, /\.rpc\([^)]*\)\s*\.catch\(/)
    assert.doesNotMatch(src, /\.(select|update|insert|delete|upsert)\([^)]*\)\s*\.catch\(/)
  }
})

// ── Bounded recovery: fail loudly, but only when truly stuck ────────────────
test('recovery budget only counts attempts that achieved nothing', () => {
  assert.match(watermark, /recovery_watermark/)
  assert.match(watermark, /if v_settled > v_watermark then/)
  assert.match(watermark, /set recovery_attempts = 0/)
})

test('an unrecoverable batch fails loudly with diagnostics instead of looping', () => {
  assert.match(watermark, /exhausted', true/)
  assert.match(watermark, /status = 'failed'/)
  assert.match(watermark, /Sync could not be recovered/)
  assert.match(watermark, /recovery attempts with no progress/)
})

// ── Rate limiting is a wait, not a failure ──────────────────────────────────
test('a Meta rate limit backs off instead of failing the remaining clients', () => {
  assert.match(cooldown, /cooldown_until/)
  assert.match(cooldown, /b\.cooldown_until is null or b\.cooldown_until <= now\(\)/)
  // Waiting must not spend the no-progress budget.
  assert.match(cooldown, /recovery_attempts = 0/)
  assert.match(worker, /const rateLimited = processed\.some/)
  assert.match(worker, /meta_sync_begin_lane_cooldown/)
})

test('a client failed only because of throttling is requeued, not left failed', () => {
  assert.match(worker, /isMetaRateLimitError/)
  assert.match(worker, /p_refund_attempt: refundAttempt/)
  assert.match(fencing, /p_refund_attempt then greatest\(0, attempts - 1\)/)
})

// ── Restart must confirm a worker actually ran ──────────────────────────────
test('the worker reports what it actually did', () => {
  assert.match(worker, /workerRan: claimCount > 0/)
  assert.match(worker, /workRemaining,/)
  assert.match(worker, /handedOff: selfTriggered/)
  assert.match(worker, /rateLimited,/)
})

test('Restart worker reports honestly when no worker actually ran', () => {
  const fn = page.slice(page.indexOf('async function handleRetryWorker'), page.indexOf('const loadLinkedAssets'))
  assert.match(fn, /const workerRan = data\?\.workerRan === true \|\| Number\(data\?\.chunksProcessed \?\? 0\) > 0/)
  assert.match(fn, /claimed no items/)
  assert.match(fn, /Worker restarted: processed/)
})

// ── The endless restoring state ─────────────────────────────────────────────
test('"Restoring sync progress..." is replaced once restoration produces real data', () => {
  // It used to be set once and never cleared.
  assert.match(page, /Restoration is finished the moment we have real counts/)
  assert.match(page, /Syncing \$\{doneCount \+ failedCount\} of \$\{totalCount\}/)
})

// ── No duplicate batches or reports ─────────────────────────────────────────
test('recovery resumes the existing batch and never creates another', () => {
  // The reaper only ever POSTs an existing batchId; it has no insert path.
  const start = background.indexOf('async function reapStalledMetaSyncBatches')
  const reaper = background.slice(start, background.lastIndexOf('return out'))
  assert.match(reaper, /dispatchMetaWorker[\s\S]*batchId: row\.batch_id/)
  assert.doesNotMatch(reaper, /\.insert\(/, 'the reaper must never create a batch')
})

test('claiming stays atomic so two workers cannot take the same item', () => {
  assert.match(worker, /claim_sync_batch_items/)
  // The claim RPC locks with FOR UPDATE SKIP LOCKED — the guarantee against
  // duplicate reports when the reaper and a hand-off overlap.
  assert.match(worker, /p_batch_id: body\.batchId \?\? null/)
})

test('healthy batches use bounded flat worker lanes instead of serial or recursive fan-out', () => {
  assert.match(lanes, /DEFAULT_META_WORKER_LANES = 4/)
  assert.match(lanes, /MAX_META_WORKER_LANES = 6/)
  assert.match(worker, /startsLaneSet/)
  assert.match(worker, /Array\.from\(\{ length: workerLanes - 1 \}/)
  assert.match(worker, /dispatchMetaWorker\(workerUrl, workerSecret/)
  assert.match(lanes, /Math\.min\(requested, MAX_META_WORKER_LANES\)/)
  // Atomic SKIP LOCKED claiming remains the duplicate-protection boundary.
  assert.match(hardening, /for update skip locked/i)
})

test('only initial durable drivers create a lane set', () => {
  assert.match(enqueue, /JSON\.stringify\(\{ batchId, maxItems: 1, startLanes: true \}\)/)
  assert.match(background, /JSON\.stringify\(\{ batchId, startLanes: true \}\)/)
  assert.match(background, /dispatchMetaWorker[\s\S]*batchId: row\.batch_id/)
  assert.doesNotMatch(worker, /startLanes:\s*true/, 'child continuations must never start another lane set')
  assert.match(worker, /meta_sync_begin_lane_set/)
  assert.match(worker, /batchLaneSetAlreadyStarted/)
  assert.match(worker, /if \(!mayStartLaneSet\) \{[\s\S]*laneSetAlreadyStarted: true/)
  assert.ok(worker.indexOf('laneSetAlreadyStarted: true') < worker.indexOf('while (claimCount < MAX_CHUNKS)'),
    'a denied repeated root must return before claiming work')
  assert.ok(worker.indexOf('await batchLaneSetAlreadyStarted') < worker.indexOf('Fetch page token map once per invocation'),
    'already-started roots must return before repeating page-token discovery')
  assert.match(parallelSafety, /parallel_lanes_started_at/)
  assert.match(parallelSafety, /not \(coalesce\(batch\.summary, '\{\}'::jsonb\) \? 'parallel_lanes_started_at'\)/)
})

test('lane inputs, missing secrets, and child responses fail closed', () => {
  assert.match(lanes, /workerLane must be an integer when provided/)
  assert.match(lanes, /workerLanes must be an integer when provided/)
  assert.match(lanes, /A child lane cannot start another lane set/)
  assert.match(dispatch, /if \(!workerSecret\.trim\(\)\) return false/)
  assert.match(dispatch, /return response\.ok/)
})

test('active cooldown stops new claims and lane handoffs', () => {
  assert.match(worker, /await batchIsCoolingDown\(sb, body\.batchId\)/)
  assert.match(worker, /workRemaining && !waitingForRateLimit/)
  assert.match(worker, /waitingForRateLimit,/)
})

test('rate-limited facts stay resumable without resetting unrelated platform failures', () => {
  assert.match(sharedMeta, /MetaFactRetryableError/)
  assert.match(sharedMeta, /p_terminal: terminal/)
  assert.match(fencing, /completed_metric_keys/)
  assert.doesNotMatch(fencing.slice(fencing.indexOf('create or replace function public.meta_sync_settle_item')),
    /facebook_sync_state\s*=|instagram_sync_state\s*=/)
})

test('parallel batch recalculation is serialized on the parent row', () => {
  assert.match(parallelSafety, /from public\.meta_sync_batches[\s\S]*for update/)
  assert.match(parallelSafety, /create or replace function public\.recalculate_batch_status/)
})

test('the reaper cannot stampede: it is bounded and skips live batches', () => {
  assert.match(background, /p_limit: 2/)
  assert.match(background, /META_SYNC_STALE_SECONDS = 120/)
})

test('a missing worker secret surfaces on the batch instead of failing silently', () => {
  assert.match(background, /META_SYNC_WORKER_SECRET is not configured, so the recovery worker cannot authorise/)
  assert.match(background, /missing_secret/)
})

// ── The original trigger: an abort escaping as a bare platform 500 ──────────
test('a page-token fetch timeout is handled, not fatal', () => {
  // metaFetch aborts on its own timeout and an abort THROWS. Nothing caught it,
  // so when Meta was slow — exactly what it is while throttling — the whole
  // invocation died as a bare 500. Three of those exhausted the driver job's
  // attempts and stranded 70 items. Reproduced live: HTTP 500,
  // "The signal has been aborted"; after the fix, HTTP 200 + rateLimited.
  const block = worker.slice(worker.indexOf('Fetch page token map once per invocation'), worker.indexOf('Process items in chunks'))
  assert.match(block, /try \{\s*res = await metaFetch\(url, requestTimeoutMs\)/)
  assert.match(block, /\['TimeoutError', 'AbortError'\]\.includes\(error\.name\)/)
  assert.match(block, /pageTokenRateLimited = true/)
})

test('the handler can never return a bare 500 with no diagnostics', () => {
  const handler = worker.slice(worker.indexOf('Deno.serve(async (req)'))
  assert.match(handler, /\} catch \(error\) \{/)
  assert.match(handler, /Meta sync worker failed: \$\{detail\}/)
  // A crash must hand back whatever it was holding, or the items are stranded.
  assert.match(handler, /const stranded = \[\.\.\.claimedLeases\.entries\(\)\]/)
  assert.match(handler, /crashClient\.rpc\('meta_sync_release_claims'/)
})

test('a throttled page-token request processes NOTHING rather than failing every client', () => {
  // When the page-token request is throttled the token map is empty, so every
  // client's Facebook stage fails for want of a token. Without this guard the
  // worker chewed through the queue marking clients failed — 25 were wrongly
  // failed this way in production for what was only a temporary throttle.
  const guard = worker.slice(worker.indexOf('Do not process anything without page tokens'), worker.indexOf('Process items in chunks'))
  assert.match(guard, /if \(pageTokenRateLimited\) \{/)
  assert.match(guard, /meta_sync_begin_lane_cooldown/)
  assert.match(worker, /res\.status === 429/)
  assert.match(guard, /waitingForRateLimit: true/)
  assert.match(guard, /workerRan: false/)
  // Crucially it returns BEFORE the claim loop, so nothing is claimed at all.
  assert.ok(worker.indexOf('waitingForRateLimit') < worker.indexOf('claim_sync_batch_items'),
    'the guard must return before any item is claimed')
})
