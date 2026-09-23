import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const worker = read('../supabase/functions/background-worker/index.ts')
const sync = read('../supabase/functions/tiktok-sync/index.ts')
const status = read('../supabase/functions/tiktok-connection-status/index.ts')
const migration = read('../supabase/migrations/20260922153348_extend_background_jobs_for_tiktok_freshness.sql')

const {
  classifyTiktokHealth,
  completeMetricSum,
  currentTiktokMonth,
  tiktokOperatingDate,
  tiktokRefreshIdempotencyKey,
} = await import('../supabase/functions/_shared/tiktokFreshness.ts')

const completedRun = overrides => ({
  status: 'success',
  health_state: 'verified',
  period_month: '2026-09',
  started_at: '2026-09-22T07:55:00.000Z',
  finished_at: '2026-09-22T08:00:00.000Z',
  summary: { paginationComplete: true },
  ...overrides,
})

describe('TikTok scheduler identity and cadence', () => {
  test('uses the Johannesburg operating day and month at the UTC boundary', () => {
    const instant = new Date('2026-08-31T22:30:00.000Z')
    assert.equal(tiktokOperatingDate(instant), '2026-09-01')
    assert.equal(currentTiktokMonth(instant), '2026-09')
  })

  test('deduplicates one exact connection per operating day', () => {
    assert.equal(
      tiktokRefreshIdempotencyKey('connection-a', '2026-09-22'),
      'tiktok-analytics-refresh:connection-a:2026-09-22',
    )
    assert.notEqual(
      tiktokRefreshIdempotencyKey('connection-a', '2026-09-22'),
      tiktokRefreshIdempotencyKey('connection-b', '2026-09-22'),
    )
  })

  test('reuses the existing durable queue and pages every discovery truth scan', () => {
    assert.match(worker, /ensureTiktokFreshnessJobs/)
    assert.match(worker, /TIKTOK_ANALYTICS_REFRESH_JOB_TYPE/)
    assert.match(worker, /max_attempts: 3/)
    assert.match(worker, /TIKTOK_FRESHNESS_MAX_ENQUEUES = 2/)
    for (const table of ['clients', 'tiktok_connections', 'tiktok_connection_tokens', 'platform_sync_runs', 'background_jobs']) {
      assert.match(worker, new RegExp(`fetchAllRows\\(\\(from, to\\) => supabase\\.from\\('${table}'\\)`))
    }
    assert.match(migration, /'tiktok_analytics_refresh'/)
  })

  test('only admits active exact client/account mappings with all read scopes and a token row', () => {
    assert.match(worker, /\.from\('clients'\)\.select\('id'\)\.eq\('active', true\)/)
    assert.match(worker, /\.eq\('status', 'connected'\)/)
    assert.match(worker, /\.not\('client_id', 'is', null\)/)
    assert.match(worker, /\.not\('tiktok_open_id', 'is', null\)/)
    assert.match(worker, /TIKTOK_READ_SCOPES\.every/)
    assert.match(worker, /tokenConnections\.has\(connectionId\)/)
  })
})

describe('TikTok missing-value and reporting truth', () => {
  test('accepts an explicit provider zero only when every observed value is numeric', () => {
    assert.equal(completeMetricSum([{ value: 0 }, { value: 2 }], row => row.value), 2)
  })

  test('makes the whole aggregate unavailable when any provider value is missing', () => {
    assert.equal(completeMetricSum([{ value: 4 }, { value: null }], row => row.value), null)
    assert.equal(completeMetricSum([{ value: 4 }, {}], row => row.value), null)
  })

  test('does not aggregate an incomplete provider listing or use nullish-zero coercion', () => {
    assert.match(sync, /paginationComplete \? completeMetricSum/)
    assert.doesNotMatch(sync, /v\.view_count \?\? 0/)
    assert.doesNotMatch(sync, /v\.like_count \?\? 0/)
    assert.match(sync, /if \(fact\.value === null\) continue/)
    assert.match(sync, /p_availability: 'partial'/)
  })
})

describe('TikTok Access / Coverage / Completeness / Freshness', () => {
  test('classifies a current complete refresh as fully available', () => {
    const run = completedRun({})
    const evidence = classifyTiktokHealth({
      connectionStatus: 'connected', missingScopes: [], tokenPresent: true,
      tokenExpired: false, tokenRefreshable: true, latestAttempt: run, latestSuccessful: run,
      now: new Date('2026-09-22T10:00:00.000Z'),
    })
    assert.deepEqual(
      [evidence.access, evidence.coverage, evidence.completeness, evidence.freshness, evidence.clientState],
      ['connected', 'complete', 'complete', 'fresh', 'available'],
    )
  })

  test('preserves last-success evidence while exposing a later provider failure', () => {
    const success = completedRun({})
    const failure = completedRun({
      status: 'failed', health_state: 'sync_error', finished_at: '2026-09-22T09:00:00.000Z',
      summary: { errors: ['Provider rate limit'] },
    })
    const evidence = classifyTiktokHealth({
      connectionStatus: 'connected', missingScopes: [], tokenPresent: true,
      tokenExpired: false, tokenRefreshable: true, latestAttempt: failure, latestSuccessful: success,
      now: new Date('2026-09-22T10:00:00.000Z'),
    })
    assert.equal(evidence.access, 'provider_error')
    assert.equal(evidence.freshness, 'fresh')
    assert.equal(evidence.clientState, 'partial')
    assert.match(evidence.staffDiagnostic, /Provider rate limit/)
    assert.doesNotMatch(evidence.clientMessage, /rate limit/i)
  })

  test('distinguishes missing permission, reconnect and stale facts', () => {
    const run = completedRun({ finished_at: '2026-09-19T00:00:00.000Z' })
    const permission = classifyTiktokHealth({
      connectionStatus: 'connected', missingScopes: ['video.list'], tokenPresent: true,
      tokenExpired: false, tokenRefreshable: true, latestAttempt: run, latestSuccessful: run,
      now: new Date('2026-09-22T10:00:00.000Z'),
    })
    assert.equal(permission.access, 'permission_required')
    assert.equal(permission.freshness, 'stale')
    assert.match(permission.staffDiagnostic, /video\.list/)

    const reconnect = classifyTiktokHealth({
      connectionStatus: 'connected', missingScopes: [], tokenPresent: false,
      tokenExpired: false, tokenRefreshable: false, latestAttempt: null, latestSuccessful: null,
      now: new Date('2026-09-22T10:00:00.000Z'),
    })
    assert.equal(reconnect.access, 'reconnect_required')
    assert.equal(reconnect.clientState, 'unavailable')
  })

  test('status reads latest attempt and last verified facts for the exact client and connection', () => {
    assert.match(status, /\.eq\('client_id', body\.clientId\)/)
    assert.match(status, /\.eq\('connection_id', latest\.id\)/)
    assert.match(status, /\.eq\('platform', 'tiktok'\)/)
    assert.match(status, /classifyTiktokHealth/)
  })
})

describe('TikTok automatic worker contract', () => {
  test('internal auth fails closed and cannot choose a different mapped account', () => {
    assert.match(sync, /configuredWorkerToken\.length >= 32/)
    assert.match(sync, /suppliedWorkerToken === configuredWorkerToken/)
    assert.match(sync, /body\.expectedConnectionId !== exactConnection\.id/)
    assert.match(sync, /body\.expectedTiktokOpenId !== exactConnection\.tiktok_open_id/)
    assert.match(sync, /\.eq\('client_id', body\.clientId\)/)
  })

  test('scheduled runs use the existing platform checkpoint and bounded queue retry', () => {
    assert.match(sync, /run_type: isInternalWorker \? 'scheduled' : 'manual'/)
    assert.match(worker, /body\?\.health !== 'verified'/)
    assert.match(worker, /fail_background_job/)
    assert.match(sync, /upsert_platform_metric_fact_preserving_verified/)
  })
})
