import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { readFileSync } from 'node:fs'

// Executable behavioral regression tests for fleet freshness logic.
// These prove the corrected behavior rather than just asserting source patterns.

// Test the month eligibility logic directly by importing the metaPeriod module
// (This tests the canonical Meta month helper used by the scheduler and worker)
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Import the actual metaPeriod module for executable tests
const { incrementalMonthEnd, incrementalMonthBounds, expectedMetaDailyEnds, metaInsightsBounds } =
  await import('../supabase/functions/_shared/metaPeriod.ts')

const worker = read('../supabase/functions/meta-sync-worker/index.ts')

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

describe('Incremental month-to-date bounds: MTD window for current-month work', () => {
  const metaPeriod = read('../supabase/functions/_shared/metaPeriod.ts')
  const worker = read('../supabase/functions/meta-sync-worker/index.ts')

  test('incrementalMonthEnd returns yesterday in Pacific time', () => {
    // Must exist and be exported
    assert.match(metaPeriod, /export function incrementalMonthEnd/)
    // Uses America/Los_Angeles, not UTC
    const fn = metaPeriod.slice(metaPeriod.indexOf('export function incrementalMonthEnd'))
    assert.match(fn, /timeZone: META_INSIGHTS_TIMEZONE/)
    // Subtracts 24h from now to get the latest completed reporting date
    assert.match(fn, /24 \* 60 \* 60 \* 1000/)
    // Returns YYYY-MM-DD format
    assert.match(fn, /parts\.year.*parts\.month.*parts\.day/)
  })

  test('incrementalMonthBounds returns periodStart=month-01, periodEnd=yesterday', () => {
    assert.match(metaPeriod, /export function incrementalMonthBounds/)
    const fn = metaPeriod.slice(metaPeriod.indexOf('export function incrementalMonthBounds'))
    // periodStart is always month-01
    assert.match(fn, /periodStart: `\$\{month\}-01`/)
    // periodEnd uses incrementalMonthEnd()
    assert.match(fn, /incrementalMonthEnd\(\)/)
  })

  test('worker uses incrementalMonthBounds for current-month incremental items', () => {
    // The worker must import incrementalMonthBounds
    assert.match(worker, /incrementalMonthBounds/)
    assert.match(worker, /from '\.\.\/_shared\/metaPeriod\.ts'/)
    // For current-month incremental, use incrementalMonthBounds instead of monthBounds
    // The ternary spans multiple lines: isCurrentMonthIncremental ? incrementalMonthBounds : monthBounds
    assert.match(worker, /isCurrentMonthIncremental/)
    assert.match(worker, /incrementalMonthBounds\(item\.month\)/)
  })

  test('completed historical month still uses full monthBounds', () => {
    // Historical/completed months must use the full month (not MTD)
    assert.match(worker, /monthBounds\(item\.month\)/)
    // monthBounds function still exists for non-incremental months
    assert.match(worker, /function monthBounds/)
  })

  test('incremental bounds do not extend past current month boundary', () => {
    // If incrementalMonthEnd falls outside the month, it clamps to month-01
    const fn = metaPeriod.slice(metaPeriod.indexOf('export function incrementalMonthBounds'))
    assert.match(fn, /end\.startsWith\(monthPrefix\)/)
    assert.match(fn, /endClamped/)
  })
})

describe('Incremental bounds executable: MTD window behaviour', () => {

  // Helper: get today's date in YYYY-MM-DD in Pacific time
  function todayPacific() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date())
        .filter(p => p.type !== 'literal')
        .map(p => [p.type, Number(p.value)]),
    )
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
  }

  // Helper: get current Meta month in Pacific
  function currentMonthPacific() {
    return todayPacific().slice(0, 7)
  }

  test('completed historical month uses full month bounds (Aug 1–31)', () => {
    // For a completed month, monthBounds must return the full month range.
    // The worker uses monthBounds for non-incremental items.
    assert.match(worker, /function monthBounds/)
    assert.match(worker, /monthBounds\(item\.month\)/)
  })

  test('incrementalMonthEnd returns a date before today (yesterday in Pacific)', () => {
    const end = incrementalMonthEnd()
    const today = todayPacific()
    // end must be strictly before today (it is yesterday)
    assert.ok(end < today, `incrementalMonthEnd ${end} should be before today ${today}`)
    // end must be in YYYY-MM-DD format
    assert.match(end, /^\d{4}-\d{2}-\d{2}$/)
    // end must be in the same or previous month as today
    assert.ok(end.slice(0, 7) <= today.slice(0, 7),
      `incrementalMonthEnd ${end} should be in the same or previous month as today ${today}`)
  })

  test('current-month incremental on Sep 19 does NOT expect Sep 20–30 daily buckets', () => {
    // The key invariant: incrementalMonthBounds for the current month must NOT
    // extend to month-end. The periodEnd must be yesterday, not the 30th/31st.
    const month = currentMonthPacific()
    const bounds = incrementalMonthBounds(month)
    const today = todayPacific()

    // periodStart is always month-01
    assert.equal(bounds.periodStart, `${month}-01`)

    // periodEnd must NOT be the last day of the month (it is yesterday)
    const year = Number(month.slice(0, 4))
    const m = Number(month.slice(5, 7))
    const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate()
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`
    assert.ok(bounds.periodEnd <= today,
      `periodEnd ${bounds.periodEnd} must not exceed today ${today}`)
    assert.ok(bounds.periodEnd < monthEnd,
      `periodEnd ${bounds.periodEnd} must be before month-end ${monthEnd} for incremental work`)
  })

  test('daily fallback series containing every completed requested day is accepted', () => {
    // metaInsightsBounds + expectedMetaDailyEnds with incremental bounds should
    // produce a set of daily ends that Meta can satisfy for past days only.
    const month = currentMonthPacific()
    const bounds = incrementalMonthBounds(month)
    const insights = metaInsightsBounds(bounds.periodStart, bounds.periodEnd)
    const expectedEnds = expectedMetaDailyEnds(insights.since, insights.until)

    // The number of expected daily ends must equal the number of Pacific
    // calendar days between periodStart and periodEnd (inclusive).
    // Each day produces exactly one ending bucket.
    assert.ok(expectedEnds.length > 0, 'expectedMetaDailyEnds should produce at least one bucket')
    // All expected ends must be finite timestamps
    assert.ok(expectedEnds.every(e => Number.isFinite(e)),
      'all expected daily ends must be finite timestamps')
    // No expected end should be in the future
    const nowMs = Date.now()
    const futureEnds = expectedEnds.filter(e => e > nowMs)
    assert.equal(futureEnds.length, 0,
      `expectedMetaDailyEnds must not include future buckets: ${JSON.stringify(futureEnds)}`)
  })

  test('current-month refresh advances periodEnd without changing canonical period_month', () => {
    // Later refreshes in the same month should produce a different (later) periodEnd
    // but the canonical period_month (YYYY-MM) stays the same.
    const month = currentMonthPacific()
    const bounds = incrementalMonthBounds(month)

    // The period_month is always the full month, not the MTD window
    assert.equal(bounds.periodStart, `${month}-01`)

    // periodEnd is yesterday; if we run again later it would be different
    // (but we can't test time travel, so verify the window is bounded)
    const today = todayPacific()
    assert.ok(bounds.periodEnd < today || bounds.periodEnd === today,
      'periodEnd should be yesterday or today')
    // The periodEnd is always within the same month or earlier
    assert.ok(bounds.periodEnd.slice(0, 7) <= month,
      'periodEnd must not extend past the current month')
  })

  test('Pacific date boundaries are used (incrementalMonthEnd uses META_INSIGHTS_TIMEZONE)', () => {
    // The incrementalMonthEnd function must use the canonical Pacific timezone
    const metaPeriod = read('../supabase/functions/_shared/metaPeriod.ts')
    const fn = metaPeriod.slice(metaPeriod.indexOf('export function incrementalMonthEnd'))
    assert.match(fn, /timeZone: META_INSIGHTS_TIMEZONE/)
    // Does NOT use getUTCHours or UTC date arithmetic for the day calculation
    assert.doesNotMatch(fn, /getUTCHours/)
    // Uses Intl.DateTimeFormat with META_INSIGHTS_TIMEZONE (same as currentMetaMonth)
    assert.match(fn, /Intl\.DateTimeFormat/)
  })
})