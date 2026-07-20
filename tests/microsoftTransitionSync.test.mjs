import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let previewPlannerTask
let buildMicrosoftReconciliation
let buildMicrosoftConflictBreakdown
let filterMicrosoftPreviewItems
let microsoftIncomingStatus
let summarizeMicrosoftCreateStatuses
let parseMicrosoftSnapshot

const context = {
  clients: [{ id: 'client-1', name: 'Acme' }],
  boards: [{ id: 'board-ops', slug: 'operations-todo' }, { id: 'board-social', slug: 'cg-socials' }],
  buckets: [
    { id: 'bucket-admin', boardId: 'board-ops', name: 'Admin / To Do' },
    { id: 'bucket-once', boardId: 'board-ops', name: 'Once-off' },
  ],
  packages: [{ id: 'package-1', clientId: 'client-1', status: 'active' }],
  templates: [{ id: 'template-dp1', packageId: 'package-1', code: 'DP1', deliverableType: 'dp', active: true }],
}

function plannerTask(overrides = {}) {
  return {
    sourceType: 'planner_task',
    sourcePlanId: 'plan-todo',
    sourcePlanName: 'To Do',
    sourceBucketId: 'ms-admin',
    sourceBucketName: 'ADMIN / TO DO',
    sourceTaskId: 'task-1',
    title: 'Prepare report',
    description: null,
    startDate: null,
    dueDate: '2026-07-20',
    assigneeMicrosoftIds: [],
    percentComplete: 0,
    completedDate: null,
    sourceModifiedAt: '2026-07-18T08:00:00Z',
    ...overrides,
  }
}

function snapshot(records, rangeStart = '2026-05-19T00:00:00+02:00') {
  const sources = [
    { sourceType: 'outlook_calendar', sourceId: 'calendar-1', sourceName: 'Operational Calendar', complete: true, rangeStart, rangeEnd: '2026-11-17T00:00:00+02:00', recordCount: 0, safeError: null },
  ]
  const plans = new Map()
  for (const record of records) {
    const current = plans.get(record.sourcePlanId) ?? { sourceType: 'planner_plan', sourceId: record.sourcePlanId, sourceName: record.sourcePlanName, complete: true, rangeStart: null, rangeEnd: null, recordCount: 0, safeError: null }
    current.recordCount += 1
    plans.set(record.sourcePlanId, current)
  }
  sources.push(...plans.values())
  return { format: 'cg-dynamics-microsoft-snapshot', version: 2, exportedAt: '2026-07-18T09:00:00Z', exportedBy: 'test', triggerType: 'admin', plannerCompletedCutoff: rangeStart.slice(0, 10), sources, records }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ previewPlannerTask } = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts'))
  ;({ buildMicrosoftReconciliation } = await server.ssrLoadModule('/src/lib/microsoftSync.ts'))
  ;({ buildMicrosoftConflictBreakdown, filterMicrosoftPreviewItems, microsoftIncomingStatus, summarizeMicrosoftCreateStatuses } = await server.ssrLoadModule('/src/lib/microsoftSyncPresentation.ts'))
  ;({ parseMicrosoftSnapshot } = await server.ssrLoadModule('/src/lib/microsoftSnapshot.ts'))
})

after(async () => { await server.close() })

test('historical completed operational tasks are skipped before the preview cutoff', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: '2026-05-18' })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'skipped')
  assert.equal(items[0].skipCode, 'historical_completed')
})

test('incomplete old operational tasks remain eligible', () => {
  const source = plannerTask({ dueDate: '2025-01-01', percentComplete: 50 })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(microsoftIncomingStatus(items[0]), 'in_progress')
})

test('completed tasks on the cutoff remain eligible as Completed', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: '2026-05-19' })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(microsoftIncomingStatus(items[0]), 'completed')
})

test('completed tasks without a completion date remain eligible conservatively', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: null, dueDate: '2025-01-01' })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(microsoftIncomingStatus(items[0]), 'completed')
})

test('completed July Client Socials cards remain eligible and map to Scheduled', () => {
  const source = plannerTask({ sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026', sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'social-1', title: 'DP1 Launch', percentComplete: 100, completedDate: '2026-05-01' })
  const item = previewPlannerTask(source, context, '2026-05-19')
  assert.equal(item.previewStatus, 'new')
  assert.equal(item.destination, 'client_schedule')
  assert.equal(item.proposedPayload.production_status, 'scheduled')
})

test('historical linked incomplete tasks remain seen and reconcile to Complete', () => {
  const active = plannerTask()
  const created = buildMicrosoftReconciliation(snapshot([active]), context, [], new Set())[0]
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash, microsoftSourceRemovedAt: null,
    microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...created.proposedPayload },
  }
  const historical = plannerTask({ percentComplete: 100, completedDate: '2026-05-18' })
  const items = buildMicrosoftReconciliation(snapshot([historical]), context, [target], new Set())
  assert.deepEqual(items.map(item => item.reconciliationAction), ['complete'])
})

test('progress status breakdown distinguishes To do, In progress, Completed, and Scheduled', () => {
  const records = [
    plannerTask({ sourceTaskId: 'todo', percentComplete: 0 }),
    plannerTask({ sourceTaskId: 'progress', percentComplete: 50 }),
    plannerTask({ sourceTaskId: 'complete', percentComplete: 100, completedDate: '2026-07-10' }),
    plannerTask({ sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026', sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'scheduled', title: 'DP1 Launch', percentComplete: 100, completedDate: '2026-05-01' }),
  ]
  const items = buildMicrosoftReconciliation(snapshot(records), context, [], new Set())
  const counts = summarizeMicrosoftCreateStatuses(items)
  assert.equal(counts.to_do, 1)
  assert.equal(counts.in_progress, 1)
  assert.equal(counts.completed, 1)
  assert.equal(counts.scheduled, 1)
})

test('source-removed tasks reopen when they return', () => {
  const source = plannerTask()
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())[0]
  const target = { destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash, microsoftSourceRemovedAt: '2026-07-17T00:00:00Z', microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...created.proposedPayload } }
  assert.equal(buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set())[0].reconciliationAction, 'reopen')
})

test('bucket changes classify as move', () => {
  const oldSource = plannerTask({ sourceBucketId: 'ms-once', sourceBucketName: 'ONCE-OFF' })
  const old = buildMicrosoftReconciliation(snapshot([oldSource]), context, [], new Set())[0]
  const target = { destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: old.sourceHash, microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...old.proposedPayload } }
  assert.equal(buildMicrosoftReconciliation(snapshot([plannerTask()]), context, [target], new Set())[0].reconciliationAction, 'move')
})

test('conflict breakdown and combined filters use source and conflict code', () => {
  const conflictItems = [
    { sourceName: 'To Do', reconciliationAction: 'conflict', conflictCode: 'unsupported_bucket', proposedPayload: null },
    { sourceName: 'To Do', reconciliationAction: 'conflict', conflictCode: 'unsupported_bucket', proposedPayload: null },
    { sourceName: 'CG Socials', reconciliationAction: 'conflict', conflictCode: 'restricted_content', proposedPayload: null },
  ]
  const breakdown = buildMicrosoftConflictBreakdown(conflictItems)
  assert.equal(breakdown[0].count, 2)
  const filtered = filterMicrosoftPreviewItems(conflictItems, { source: 'CG Socials', action: 'conflict', status: 'none', conflict: 'restricted_content' })
  assert.equal(filtered.length, 1)
})

test('occupied Client Schedule slots are non-actionable conflicts', () => {
  const source = plannerTask({ sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026', sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'slot-conflict', title: 'DP1 Launch', percentComplete: 0 })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(['package-1|template-dp1|1|2026-07-01']))
  assert.equal(items[0].reconciliationAction, 'conflict')
  assert.equal(items[0].conflictCode, 'existing_deliverable_slot')
})

test('existing version 2 agent snapshots remain valid without a Planner cutoff', () => {
  const compatible = snapshot([plannerTask()])
  delete compatible.plannerCompletedCutoff
  const parsed = parseMicrosoftSnapshot(JSON.stringify(compatible))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.plannerCompletedCutoff, null)
})

test('invalid Planner cutoff dates are rejected', () => {
  const invalid = snapshot([plannerTask()])
  invalid.plannerCompletedCutoff = '2026-99-99'
  const parsed = parseMicrosoftSnapshot(JSON.stringify(invalid))
  assert.equal(parsed.snapshot, null)
  assert.match(parsed.errors[0], /plannerCompletedCutoff/)
})
