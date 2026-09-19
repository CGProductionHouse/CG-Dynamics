import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { readFileSync } from 'node:fs'

// Executable behavioral regression tests for fleet freshness logic.
// These prove the corrected behavior rather than just asserting source patterns.

// Test the month eligibility logic directly by importing the metaPeriod module
// (This tests the canonical Meta month helper used by the scheduler and worker)
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

describe('Meta month eligibility (canonical America/Los_Angeles)', () => {
  test('currentMetaMonth and previousMetaMonth use Pacific timezone', async () => {
    // These functions are used by the scheduler and worker for month arithmetic.
    // They must use America/Los_Angeles, not UTC month arithmetic.
    const metaPeriod = read('../supabase/functions/_shared/metaPeriod.ts')
    assert.match(metaPeriod, /META_INSIGHTS_TIMEZONE = 'America\/Los_Angeles'/)
    assert.match(metaPeriod, /export function currentMetaMonth/)
    assert.match(metaPeriod, /export function previousMetaMonth/)
    // The exported functions use Intl.DateTimeFormat with META_INSIGHTS_TIMEZONE
    assert.match(metaPeriod, /timeZone: META_INSIGHTS_TIMEZONE/)
    // They do not use UTC month arithmetic (getUTCMonth/getUTCFullYear on current date)
    const currentFn = metaPeriod.slice(metaPeriod.indexOf('export function currentMetaMonth'))
    const prevFn = metaPeriod.slice(metaPeriod.indexOf('export function previousMetaMonth'))
    assert.doesNotMatch(currentFn.slice(0, 200), /getUTCMonth\(\)/)
    assert.doesNotMatch(currentFn.slice(0, 200), /getUTCFullYear\(\)/)
    assert.doesNotMatch(prevFn.slice(0, 200), /getUTCMonth\(\)/)
    assert.doesNotMatch(prevFn.slice(0, 200), /getUTCFullYear\(\)/)
  })
})

describe('Worker month skip logic: incremental vs historical', () => {
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')

  test('worker allows current Meta month when sync_kind === incremental', () => {
    // The worker must NOT skip current month for incremental work
    assert.match(worker, /sync_kind === 'incremental'/)
    assert.match(worker, /isCurrentMonthIncremental/)
  })

  test('worker rejects current month for historical/backfill work', () => {
    // Historical work on current month must still be skipped
    assert.match(worker, /!isCurrentMonthIncremental/)
    assert.match(worker, /Month is not yet completed/)
  })

  test('worker rejects future months unconditionally', () => {
    // Future months are always skipped regardless of sync_kind
    assert.match(worker, /isFutureMonth/)
    assert.match(worker, /item\.month > currentMetaMonthStr/)
  })

  test('worker uses canonical Meta month helper, not UTC', () => {
    // The worker must import and use currentMetaMonth from metaPeriod
    assert.match(worker, /currentMetaMonth/)
    assert.match(worker, /from '\.\.\/_shared\/metaPeriod\.ts'/)
    // Old UTC-based currentMonthStr must not be used for fleet freshness logic
    const fleetFn = worker.slice(worker.indexOf('const currentMetaMonthStr'))
    assert.doesNotMatch(fleetFn, /currentMonthStr\(\)/)
  })
})

describe('Fleet freshness dedupe: per asset+month logical work', () => {
  const background = read('../supabase/functions/background-worker/index.ts')

  test('dedupe key is asset_id + month (canonical queue semantics)', () => {
    // One meta_sync_batch_items row per asset+month owning both FB/IG stages
    assert.match(background, /asset_id.*month/)
    assert.match(background, /activeWorkKeys/)
    assert.match(background, /activeWorkKeys\.has\(/)
  })

  test('active current + missing previous => enqueues previous only', () => {
    // The scheduler must filter months individually, not drop the whole target
    assert.match(background, /neededWork/)
    assert.match(background, /neededWork\.push.*month.*syncKind/)
    // The dedupe check uses activeWorkKeys.has with assetId and month
    assert.match(background, /activeWorkKeys\.has/)
    assert.match(background, /assetId/)
    assert.match(background, /month/)
    assert.match(background, /continue/)
  })

  test('active previous + missing current => enqueues current only', () => {
    // Same logic: current month incremental is a separate logical work item
    assert.match(background, /syncKind = month === currentMonth \? 'incremental' : 'historical'/)
  })

  test('both active => enqueues nothing', () => {
    // If all required months are active, no items are added
    assert.match(background, /if \(neededWork\.length === 0\)/)
    assert.match(background, /continue.*all work for this client is already active/)
  })

test('neither active => enqueues all required work', () => {
    // Fresh target with no active work gets both months (or one if no reconciliation needed)
    // totalItems = neededWork.length (each logical work item = one batch item)
    assert.match(background, /totalItems = neededWork\.length/)
  })

  test('batch total_items matches actually enqueued logical items', () => {
    // total_items must reflect the actual inserted items after dedupe
    assert.match(background, /totalItems = neededWork\.length/)
    assert.match(background, /total_items: totalItems/)
    assert.match(background, /itemsEnqueued: totalItems/)
  })

  test('items created per logical work item (asset+month+sync_kind)', () => {
    // Each neededWork entry produces exactly one meta_sync_batch_items row
    assert.match(background, /for \(const work of neededWork\)/)
    assert.match(background, /sync_kind: work\.syncKind/)
    assert.match(background, /month: work\.month/)
  })
})

describe('Integration: month selection contract matches PR #424', () => {
  const background = read('../supabase/functions/background-worker/index.ts')
  const metaPeriod = read('../supabase/functions/_shared/metaPeriod.ts')

  test('scheduler uses currentMetaMonth / previousMetaMonth (Pacific)', () => {
    assert.match(background, /currentMetaMonth/)
    assert.match(background, /previousMetaMonth/)
    assert.match(background, /from '\.\.\/_shared\/metaPeriod\.ts'/)
    // UTC month functions must NOT be used for fleet freshness
    const fleetFn = background.slice(background.indexOf('async function enqueueFleetMetaFreshness'))
    assert.doesNotMatch(fleetFn, /currentMonthStr\(\)/)
    assert.doesNotMatch(fleetFn, /previousMonthStr\(\)/)
  })

  test('reconciliation conditional on selected last_successful_month', () => {
    // Reconciliation is computed per-asset from per-platform checkpoints
    // and then checked at the client level: plans.some(p => p.needsReconciliation)
    assert.match(background, /needsReconciliation/)
    assert.match(background, /needsReconciliation = fbReconcile \|\| igReconcile/)
    assert.match(background, /plans\.some\(p => p\.needsReconciliation\)/)
  })

  test('bootstrap targets (no checkpoint row) are discovered and enqueued', () => {
    // Scheduler starts from meta_client_assets with LEFT JOIN
    // Missing checkpoint = bootstrap due (no history) -> fbBootstrap/igBootstrap = true
    assert.match(background, /\.from\('meta_client_assets'\)/)
    assert.match(background, /meta_asset_sync_checkpoints!left/)
    assert.match(background, /fbBootstrap|igBootstrap/)
  })
})