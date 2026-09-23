import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// Focused regression tests for the four fleet freshness blockers identified
// in PR #425 supervisor review (comment 5732536948).

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const background = read('../supabase/functions/background-worker/index.ts')
const metaPeriod = read('../supabase/functions/_shared/metaPeriod.ts')

// 1. Missing-checkpoint assets are bootstrapped
test('fleet freshness bootstraps assets with no checkpoint row', () => {
  // The scheduler MUST start from meta_client_assets (the source of truth for
  // active linked targets) and LEFT JOIN checkpoints, so assets without any
  // checkpoint row are discovered and treated as due (bootstrap).
  assert.match(background, /\.from\('meta_client_assets'\)/)
  assert.match(background, /meta_asset_sync_checkpoints!left/)
  // Bootstrap targets must have fbBootstrap or igBootstrap = true
  assert.match(background, /fbBootstrap/)
  assert.match(background, /igBootstrap/)
  // Due = bootstrap OR nextDueAt <= now
  assert.match(background, /fbDue/)
  assert.match(background, /igDue/)
})

// 2. last_successful_month is selected and typed
test('fleet freshness selects and uses last_successful_month', () => {
  // The PostgREST select must include last_successful_month from checkpoints.
  assert.match(background, /last_successful_month/)
  // The reconciliation decision must read the selected field explicitly.
  assert.match(background, /lastSuccessfulMonth/)
  assert.match(background, /needsReconciliation/)
  // Per-asset reconciliation is computed from per-platform results.
  assert.match(background, /needsReconciliation = fbReconcile \|\| igReconcile/)
  // Client-level check uses plans.some().
  assert.match(background, /plans\.some\(p => p\.needsReconciliation\)/)
})

// 3. Month selection uses America/Los_Angeles (canonical Meta period contract)
test('fleet freshness uses America/Los_Angeles month arithmetic', () => {
  // Must import and use currentMetaMonth / previousMetaMonth from metaPeriod.
  assert.match(background, /currentMetaMonth/)
  assert.match(background, /previousMetaMonth/)
  assert.match(background, /from '\.\.\/_shared\/metaPeriod\.ts'/)
  // The canonical Meta period contract uses America/Los_Angeles timezone.
  assert.match(metaPeriod, /META_INSIGHTS_TIMEZONE = 'America\/Los_Angeles'/)
  assert.match(metaPeriod, /currentMetaMonth\(\)/)
  assert.match(metaPeriod, /previousMetaMonth\(/)
  // UTC month arithmetic must NOT be used for Meta scheduling.
  // The old currentMonthStr/previousMonthStr must not be called for fleet freshness.
  const fleetFn = background.slice(background.indexOf('async function enqueueFleetMetaFreshness'))
  assert.doesNotMatch(fleetFn, /currentMonthStr\(\)/)
  assert.doesNotMatch(fleetFn, /previousMonthStr\(\)/)
})

// 4. No duplicate active work across cron ticks (cross-batch dedupe)
test('fleet freshness deduplicates active asset+month work across batches', () => {
  // Before enqueue, the scheduler must check for existing queued/running
  // meta_sync_batch_items for the same asset+month combination.
  assert.match(background, /activeWorkKeys/)
  assert.match(background, /meta_sync_batch_items/)
  assert.match(background, /\.in\('status', \['queued', 'running'\]\)/)
  assert.match(background, /activeWorkKeys\.has\(/)
  // Skip logic prevents duplicate enqueue.
  assert.match(background, /continue.*all work for this client is already active/)
  // Dedupe key is asset_id + month.
  assert.match(background, /\$\{plan\.assetId\}:\$\{month\}/)
})

// 5. Integration: complete flow produces correct batch structure
test('fleet freshness creates batches with correct sync_kind and months', () => {
  const fleetFn = background.slice(background.indexOf('async function enqueueFleetMetaFreshness'))
  // Current period = incremental, reconciliation = historical
  assert.match(fleetFn, /incremental/)
  assert.match(fleetFn, /historical/)
  assert.match(fleetFn, /month === currentMonth \? 'incremental' : 'historical'/)
  // Bounded to max batches per invocation
  assert.match(fleetFn, /META_FLEET_FRESHNESS_MAX_BATCHES/)
  assert.match(fleetFn, /batchesCreated \>= META_FLEET_FRESHNESS_MAX_BATCHES/)
  // Uses existing queue/checkpoint architecture (no new tables/RPCs)
  assert.match(fleetFn, /meta_sync_batches/)
  assert.match(fleetFn, /meta_sync_batch_items/)
  assert.match(fleetFn, /via: 'fleet_freshness'/)
})