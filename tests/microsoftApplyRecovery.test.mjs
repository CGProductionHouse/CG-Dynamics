import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'vite'

let server
let buildMicrosoftRecoveryPlan
let getMicrosoftExecutableItems
let getMicrosoftReviewedItems
let microsoftRunFinalStatus
let microsoftSafeApplyError

function item(id, action, overrides = {}) {
  return {
    sourceType: 'planner_task',
    sourcePlanId: 'plan-1',
    sourceCalendarId: null,
    sourceBucketId: 'bucket-1',
    sourceTaskId: id,
    sourceEventId: null,
    sourceName: 'To Do',
    title: `Task ${id}`,
    description: null,
    startDate: null,
    endDate: null,
    dueDate: null,
    assigneeMicrosoftIds: [],
    destination: 'planner',
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: action === 'create' ? null : `target-${id}`,
    previewStatus: action === 'conflict' ? 'conflict' : action === 'create' ? 'new' : 'existing',
    conflictCode: action === 'conflict' ? 'existing_row_changed' : null,
    conflictReason: action === 'conflict' ? 'A newer CG edit exists.' : null,
    warnings: [],
    proposedPayload: null,
    reconciliationAction: action,
    expectedTargetUpdatedAt: action === 'create' ? null : '2026-07-27T18:00:00Z',
    sourceHash: `hash-${id}`,
    sourceComplete: true,
    requiresRemovalApproval: false,
    ...overrides,
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({
    buildMicrosoftRecoveryPlan,
    getMicrosoftExecutableItems,
    getMicrosoftReviewedItems,
    microsoftSafeApplyError,
  } = await server.ssrLoadModule('/src/lib/microsoftRecovery.ts'))
  ;({ microsoftRunFinalStatus } = await server.ssrLoadModule('/src/lib/microsoftApply.ts'))
})

after(async () => { await server?.close() })

test('Apply button count is the exact executable reviewed set', () => {
  const items = [
    item('create', 'create'),
    item('link', 'link_existing'),
    item('template', 'package_template_create'),
    item('complete', 'complete'),
    item('conflict', 'conflict'),
    item('unchanged', 'unchanged'),
    item('removal', 'archive', { requiresRemovalApproval: true }),
  ]
  assert.equal(getMicrosoftExecutableItems(items, false).length, 4)
  assert.equal(getMicrosoftExecutableItems(items, true).length, 5)
})

test('reviewed selections persist as stable Microsoft source identities', () => {
  const reviewed = getMicrosoftReviewedItems([item('one', 'create'), item('conflict', 'conflict')], false)
  assert.deepEqual(reviewed.map(entry => entry.key), ['planner_task:plan-1:one'])
  assert.equal(reviewed[0].action, 'create')
})

test('partial apply recovery retries only the failed action', () => {
  const original = [item('applied', 'create'), item('failed', 'complete')]
  const reviewed = getMicrosoftReviewedItems(original, false)
  const current = [item('applied', 'unchanged'), item('failed', 'complete')]
  const audit = [
    { key: reviewed[0].key, resultStatus: 'applied', safeError: null },
    { key: reviewed[1].key, resultStatus: 'failed', safeError: 'status rejected' },
  ]
  const plan = buildMicrosoftRecoveryPlan(reviewed, current, audit)
  assert.deepEqual(plan.retryItems.map(entry => entry.sourceTaskId), ['failed'])
  assert.deepEqual(plan.previouslyApplied.map(entry => entry.key), [reviewed[0].key])
  assert.equal(plan.failedBeforeRetry, 1)
})

test('idempotent retry recognises every prior success and writes nothing again', () => {
  const original = [item('one', 'create'), item('two', 'update')]
  const reviewed = getMicrosoftReviewedItems(original, false)
  const current = [item('one', 'unchanged'), item('two', 'unchanged')]
  const audit = reviewed.map(entry => ({ key: entry.key, resultStatus: 'failed', safeError: 'stale replay' }))
  const plan = buildMicrosoftRecoveryPlan(reviewed, current, audit)
  assert.equal(plan.retryItems.length, 0)
  assert.equal(plan.previouslyApplied.length, 2)
})

test('not-attempted reviewed actions are retryable without another approval', () => {
  const current = item('not-attempted', 'update')
  const reviewed = getMicrosoftReviewedItems([current], false)
  const plan = buildMicrosoftRecoveryPlan(reviewed, [current], [])
  assert.equal(plan.notAttemptedBeforeRetry, 1)
  assert.equal(plan.retryItems.length, 1)
})

test('conflicts and newer CG edits remain excluded from retry', () => {
  const original = item('edited', 'update')
  const reviewed = getMicrosoftReviewedItems([original], false)
  const current = item('edited', 'conflict')
  const plan = buildMicrosoftRecoveryPlan(reviewed, [current], [
    { key: reviewed[0].key, resultStatus: 'failed', safeError: 'Destination changed after preview' },
  ])
  assert.equal(plan.retryItems.length, 0)
  assert.equal(plan.blocked.length, 1)
  assert.match(plan.blocked[0].reason, /newer CG edit/i)
})

test('a reviewed action cannot drift into a different write on retry', () => {
  const original = item('drift', 'update')
  const reviewed = getMicrosoftReviewedItems([original], false)
  const current = item('drift', 'complete')
  const plan = buildMicrosoftRecoveryPlan(reviewed, [current], [
    { key: reviewed[0].key, resultStatus: 'failed', safeError: 'failed before write' },
  ])
  assert.equal(plan.retryItems.length, 0)
  assert.match(plan.blocked[0].reason, /changed from update to complete/i)
})

test('removal retry requires the originally preserved removal approval', () => {
  const removal = item('removed', 'archive', { requiresRemovalApproval: true })
  assert.equal(getMicrosoftReviewedItems([removal], false).length, 0)
  const reviewed = getMicrosoftReviewedItems([removal], true)
  assert.equal(reviewed[0].removalApproved, true)
  const plan = buildMicrosoftRecoveryPlan(reviewed, [removal], [
    { key: reviewed[0].key, resultStatus: 'failed', safeError: 'failed before write' },
  ])
  assert.equal(plan.retryItems.length, 1)
})

test('failed-run diagnostics translate database constraints into safe explanations', () => {
  assert.match(microsoftSafeApplyError('duplicate key value violates unique constraint "planner_tasks_import_hash_key"'), /already exists/i)
  assert.match(microsoftSafeApplyError('new row violates check constraint "planner_tasks_status_check"'), /completion status/i)
  assert.match(microsoftSafeApplyError('Destination changed after preview'), /not overwritten/i)
})

test('mixed action outcomes are PARTIAL while zero safe writes are FAILED', () => {
  assert.equal(microsoftRunFinalStatus(1, 1, 0), 'partial')
  assert.equal(microsoftRunFinalStatus(0, 1, 0), 'failed')
  assert.equal(microsoftRunFinalStatus(1, 0, 0), 'completed')
})

test('recovery migration preserves reviewed metadata and repairs Planner done status', async () => {
  const sql = await readFile('supabase/migrations/20260728123000_microsoft_apply_recovery.sql', 'utf8')
  assert.match(sql, /preview_job_id uuid/i)
  assert.match(sql, /retry_of_run_id uuid/i)
  assert.match(sql, /reviewed_items jsonb/i)
  assert.match(sql, /set preview_job_id = j\.id/i)
  assert.match(sql, /set reviewed_items = reviewed\.items/i)
  assert.match(sql, /i\.result_status = 'applied' and i\.action in \('cancel', 'archive'\)/i)
  assert.match(sql, /'done'/)
  assert.match(sql, /microsoft_sync_recovery_version/i)
})

test('recovery UI uses preserved approval and reports all outcome classes', async () => {
  const page = await readFile('src/pages/admin/MicrosoftImportPage.tsx', 'utf8')
  assert.match(page, /Retry failed changes/)
  assert.match(page, /No new approval checkbox is required/)
  assert.match(page, /Previously applied/)
  assert.match(page, /Not attempted/)
  assert.match(page, /Conflicts untouched/)
  assert.match(page, /setJob\(null\)/)
  assert.match(page, /prepare interrupted-run recovery/i)
})

test('durable preview result keeps its original exported timestamp', async () => {
  const edge = await readFile('supabase/functions/microsoft-transition-sync/index.ts', 'utf8')
  assert.match(edge, /job\.exported_at as string \| null\) \?\? new Date\(\)\.toISOString\(\)/)
  assert.match(edge, /if \(!job\.exported_at\)/)
})
