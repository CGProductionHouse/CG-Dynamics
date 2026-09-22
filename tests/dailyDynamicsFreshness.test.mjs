import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server
let microsoftFreshnessEvidence
let metaFleetFreshnessEvidence
let planAutomaticSourceRecovery
let planAutomaticApplyRecovery
let fetchAllRows

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  ;({ microsoftFreshnessEvidence, metaFleetFreshnessEvidence } = await server.ssrLoadModule('/src/lib/dailyDynamicsFreshness.ts'))
  ;({ planAutomaticSourceRecovery, planAutomaticApplyRecovery } = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/job-machine.ts'))
  ;({ fetchAllRows } = await server.ssrLoadModule('/supabase/functions/_shared/paginatedRows.ts'))
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
})

test('applying recovery exhausts instead of remaining applying forever', () => {
  assert.equal(planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 3, recoveryAfter: null, now }).kind, 'exhausted')
  assert.equal(planAutomaticApplyRecovery({ status: 'completed', startedAt: '2026-09-21T07:00:00Z', recoveryCount: 0, recoveryAfter: null, now }).kind, 'terminal')
})

test('automatic apply recovery reuses the same run and serializes exact item keys', () => {
  const edge = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url), 'utf8')
  const automatic = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts', import.meta.url), 'utf8')
  const sql = readFileSync(new URL('../supabase/migrations/20260921120000_daily_dynamics_service_reconciliation.sql', import.meta.url), 'utf8')
  assert.match(edge, /claim_microsoft_automatic_apply_recovery/)
  assert.match(edge, /applyAutomaticMicrosoftMirrors\(sb, snapshot, jobId,[\s\S]*recoveryRunId\)/)
  assert.match(automatic, /existingRunId[\s\S]*id: existingRunId/)
  assert.match(automatic, /microsoftStableItemKey\(item\)/)
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_run_id::text \|\| ':' \|\| p_item_key, 451\)\)/)
  assert.match(sql, /unique \(run_id, item_key\)|claim_microsoft_automatic_apply_recovery/)
})

test('fleet pagination returns more than 100 active assets without truncation', async () => {
  const rows = Array.from({ length: 205 }, (_, id) => ({ id }))
  const result = await fetchAllRows(async (from, to) => ({ data: rows.slice(from, to + 1), error: null }), 100)
  assert.equal(result.data.length, 205)
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
