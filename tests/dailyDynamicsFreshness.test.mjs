import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server
let microsoftFreshnessEvidence
let metaFleetFreshnessEvidence
let planAutomaticSourceRecovery
let planAutomaticApplyRecovery
let automaticApplyLeaseDeadline
let fetchAllRows
let fetchAllRowsByIdChunks

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ microsoftFreshnessEvidence, metaFleetFreshnessEvidence } = await server.ssrLoadModule('/src/lib/dailyDynamicsFreshness.ts'))
  ;({ planAutomaticSourceRecovery, planAutomaticApplyRecovery, automaticApplyLeaseDeadline } = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/job-machine.ts'))
  ;({ fetchAllRows, fetchAllRowsByIdChunks } = await server.ssrLoadModule('/supabase/functions/_shared/paginatedRows.ts'))
})
after(async () => { await server?.close() })

const now = '2026-09-21T08:00:00.000Z'

test('Microsoft PASS requires a recent full applied reconciliation', () => {
  assert.equal(microsoftFreshnessEvidence({ now, connected: true, lastJobStartedAt: now, lastJobCompletedAt: now, lastSuccessfulReconciliationAt: '2026-09-21T07:00:00.000Z', requiredSources: [{ name: 'Outlook', complete: true, error: null }], applyStatus: 'completed' }).verdict, 'PASS')
})

test('Microsoft source failure is PARTIAL and never inferred fresh from a completed cron', () => {
  const evidence = microsoftFreshnessEvidence({ now, connected: true, lastJobStartedAt: now, lastJobCompletedAt: now, lastSuccessfulReconciliationAt: '2026-09-21T07:00:00.000Z', requiredSources: [{ name: 'MASTER CLIENT TO DO', complete: false, error: 'throttled' }], applyStatus: 'completed' })
  assert.equal(evidence.verdict, 'PARTIAL')
  assert.deepEqual(evidence.incomplete, ['MASTER CLIENT TO DO'])
})

test('Microsoft stale, failed and unavailable remain distinct', () => {
  const base = { now, lastJobStartedAt: null, lastJobCompletedAt: null, lastSuccessfulReconciliationAt: null, requiredSources: [] }
  assert.equal(microsoftFreshnessEvidence({ ...base, connected: true, applyStatus: null }).verdict, 'STALE')
  assert.equal(microsoftFreshnessEvidence({ ...base, connected: true, applyStatus: 'failed' }).verdict, 'FAILED')
  assert.equal(microsoftFreshnessEvidence({ ...base, connected: false, applyStatus: null }).verdict, 'UNAVAILABLE')
})

test('Meta fleet truth is derived dynamically per exact asset and platform', () => {
  const evidence = metaFleetFreshnessEvidence([
    { clientId: 'client-a', assetId: 'asset-a', platform: 'facebook', mapped: true, lastAttemptedAt: now, lastSuccessfulAt: now, lastSuccessfulMonth: '2026-09', highWatermarkAt: '2026-09-20', nextDueAt: '2026-09-22T00:00:00Z', status: 'complete', healthState: 'verified', errorCode: null, retrying: false },
    { clientId: 'client-b', assetId: 'asset-b', platform: 'instagram', mapped: true, lastAttemptedAt: null, lastSuccessfulAt: null, lastSuccessfulMonth: null, highWatermarkAt: null, nextDueAt: null, status: null, healthState: null, errorCode: null, retrying: false },
  ], now)
  assert.equal(evidence.mappedClients, 2)
  assert.equal(evidence.mappedAssets, 2)
  assert.equal(evidence.verdict, 'STALE')
  assert.equal(evidence.platforms[1].reason, 'Mapped platform has never completed its bootstrap checkpoint.')
})

test('Meta failed attempt preserves last verified state as PARTIAL instead of zero or success', () => {
  const evidence = metaFleetFreshnessEvidence([
    { clientId: 'client-a', assetId: 'asset-a', platform: 'facebook', mapped: true, lastAttemptedAt: now, lastSuccessfulAt: '2026-09-20T08:00:00Z', lastSuccessfulMonth: '2026-09', highWatermarkAt: '2026-09-19', nextDueAt: now, status: 'failed', healthState: 'verified', errorCode: 'rate_limited', retrying: true },
  ], now)
  assert.equal(evidence.verdict, 'PARTIAL')
  assert.equal(evidence.recoveryInProgress, true)
  assert.equal(evidence.platforms[0].lastSuccessfulAt, '2026-09-20T08:00:00Z')
  assert.equal(evidence.failed, 0)
})

test('Meta terminal failure without prior success is FAILED and counted', () => {
  const evidence = metaFleetFreshnessEvidence([
    { clientId: 'client-a', assetId: 'asset-a', platform: 'instagram', mapped: true, lastAttemptedAt: now, lastSuccessfulAt: null, lastSuccessfulMonth: null, highWatermarkAt: null, nextDueAt: null, status: 'failed', healthState: null, errorCode: 'permission', retrying: false },
  ], now)
  assert.equal(evidence.verdict, 'FAILED')
  assert.equal(evidence.failed, 1)
})

test('automatic Microsoft retry is bounded, persisted and cooldown-aware', () => {
  const retry = planAutomaticSourceRecovery({ failedRequired: 1, retryCount: 0, retryAfter: null, now })
  assert.equal(retry.kind, 'retry')
  assert.equal(retry.nextRetryCount, 1)
  assert.equal(planAutomaticSourceRecovery({ failedRequired: 1, retryCount: 1, retryAfter: retry.retryAfter, now }).kind, 'wait')
  assert.equal(planAutomaticSourceRecovery({ failedRequired: 1, retryCount: 3, retryAfter: null, now }).kind, 'exhausted')
})

test('fresh applying Microsoft run is not double-driven', () => {
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:55:00Z', recoveryCount: 0, recoveryAfter: null, now }).kind, 'fresh')
})

test('stale crashed applying run is recovered with a bounded lease', () => {
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 0, recoveryAfter: null, now }).kind, 'recover')
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 1, recoveryAfter: '2026-09-21T08:05:00Z', now }).kind, 'fresh')
  assert.equal(automaticApplyLeaseDeadline(now), '2026-09-21T08:10:00.000Z')
})

test('applying recovery exhausts instead of remaining applying forever', () => {
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 3, recoveryAfter: '2026-09-21T08:05:00Z', now }).kind, 'fresh')
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 3, recoveryAfter: null, now }).kind, 'exhausted')
  assert.equal(planAutomaticApplyRecovery({ status: 'completed', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 0, recoveryAfter: null, now }).kind, 'terminal')
})

test('last verified Microsoft mirror remains authoritative while applying recovery is unresolved', () => {
  const evidence = microsoftFreshnessEvidence({
    now,
    connected: true,
    lastJobStartedAt: now,
    lastJobCompletedAt: now,
    lastSuccessfulReconciliationAt: '2026-09-21T06:30:00.000Z',
    requiredSources: [{ name: 'Outlook', complete: true, error: null }],
    applyStatus: 'applying',
    recoveryInProgress: true,
  })
  assert.equal(evidence.verdict, 'PARTIAL')
  assert.equal(evidence.lastSuccessfulAt, '2026-09-21T06:30:00.000Z')
  assert.equal(evidence.recoveryInProgress, true)
})

test('automatic apply recovery reuses the same run and serializes exact item keys', () => {
  const edge = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url), 'utf8')
  const automatic = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts', import.meta.url), 'utf8')
  const sql = readFileSync(new URL('../supabase/migrations/20260921120000_daily_dynamics_service_reconciliation.sql', import.meta.url), 'utf8')
  assert.match(edge, /claim_microsoft_automatic_apply_recovery/)
  assert.match(edge, /applyAutomaticMicrosoftMirrors\(sb, snapshot, jobId,[\s\S]*recoveryRunId, recoveryGeneration\)/)
  assert.match(automatic, /existingRunId[\s\S]*id: existingRunId/)
  assert.match(automatic, /microsoftStableItemKey\(item\)/)
  assert.match(automatic, /eq\('automatic_recovery_count', recoveryGeneration\)/)
  assert.match(automatic, /automatic_recovery_after: automaticApplyLeaseDeadline/)
  assert.match(automatic, /finalized\.error \|\| !finalized\.data/)
  assert.match(automatic, /runError\?\.code === '23505'[\s\S]*eq\('preview_job_id', previewJobId\)[\s\S]*status: 'applying'/)
  assert.match(edge, /recoveryGeneration = Number\(existing\.automatic_recovery_count \?\? 0\) \+ 1/)
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_run_id::text \|\| ':' \|\| p_item_key, 451\)\)/)
  assert.match(sql, /unique index if not exists microsoft_sync_runs_one_automatic_per_preview_idx[\s\S]*preview_job_id[\s\S]*trigger_type = 'agent'/)
  const base = readFileSync(new URL('../supabase/phase-17a-microsoft-transition-sync.sql', import.meta.url), 'utf8')
  assert.match(base, /unique \(run_id, item_key\)/)
})

test('fleet pagination returns more than 100 active assets without truncation', async () => {
  const rows = Array.from({ length: 205 }, (_, id) => ({ id }))
  const result = await fetchAllRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }), 100)
  assert.equal(result.data.length, 205)
})

test('Meta checkpoint and retry reads chunk large exact-asset populations without truncation', async () => {
  const ids = Array.from({ length: 1205 }, (_, id) => `asset-${id}`)
  const seen = []
  const result = await fetchAllRowsByIdChunks(ids, async (chunk, from, to) => {
    seen.push(chunk)
    return { data: chunk.slice(from, to + 1).map(id => ({ id })), error: null }
  }, 200, 1000)
  assert.equal(result.data.length, 1205)
  assert.equal(seen.length, 7)
  assert.ok(seen.every(chunk => chunk.length <= 200))
  assert.deepEqual(result.data.map(row => row.id), ids)
})

test('scheduled cycle advances Microsoft before Meta fleet freshness', () => {
  const worker = readFileSync(new URL('../supabase/functions/background-worker/index.ts', import.meta.url), 'utf8')
  assert.ok(worker.indexOf('advanceMicrosoftFreshness(url)') < worker.indexOf('enqueueFleetMetaFreshness(supabase, url)'))
  assert.match(worker, /DAILY_FRESHNESS_WORKER_SECRET/)
  assert.match(worker, /action: 'system_cycle'/)
})

test('automatic Microsoft mirror excludes Client Schedule and uses exact established reconciliation', () => {
  const automatic = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts', import.meta.url), 'utf8')
  assert.match(automatic, /buildMicrosoftReconciliation/)
  assert.match(automatic, /item\.destination === 'planner' \|\| item\.destination === 'cg_calendar'/)
  assert.doesNotMatch(automatic, /from\('monthly_deliverables'\)/)
  assert.match(automatic, /buildMicrosoftApplyRpcArgs/)
  assert.match(automatic, /microsoftStableItemKey/)
})

test('system reconciliation is fail-closed behind exact worker secret and identity', () => {
  const edge = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url), 'utf8')
  assert.match(edge, /expectedSystemSecret\.length >= 32/)
  assert.match(edge, /MICROSOFT_SYNC_SYSTEM_USER_ID/)
  assert.match(edge, /eq\('created_by', user\.id\)/)
  assert.match(edge, /Date\.now\(\) - lastSuccess < 3 \* 60 \* 60 \* 1000/)
})

test('service reconciliation activation remains an explicit protected migration', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260921120000_daily_dynamics_service_reconciliation.sql', import.meta.url), 'utf8')
  assert.match(sql, /DO NOT APPLY IN PRODUCTION WITHOUT CA APPROVAL/)
  assert.match(sql, /auth\.role\(\) <> 'service_role'/)
  assert.match(sql, /grant execute on function public\.apply_microsoft_sync_item_automatic.*to service_role/s)
  assert.match(sql, /revoke all on function public\.apply_microsoft_sync_item_automatic.*authenticated/s)
  assert.doesNotMatch(sql, /create or replace function public\.is_admin/)
  assert.doesNotMatch(sql, /monthly_deliverables/)
})
