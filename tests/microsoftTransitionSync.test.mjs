import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let previewPlannerTask
let resolveMicrosoftBucketMapping
let buildMicrosoftReconciliation
let buildMicrosoftConflictBreakdown
let filterMicrosoftPreviewItems
let microsoftIncomingStatus
let summarizeMicrosoftCreateStatuses
let parseMicrosoftSnapshot
let resolvePreviewAssignees

const context = {
  clients: [
    { id: 'client-1', name: 'Acme' },
    { id: 'client-ehrlich', name: 'Ehrlich Park Butchery' },
    { id: 'client-supa-bfn', name: 'Supa Quick BFN' },
    { id: 'client-supa-centurion', name: 'Supa Quick Centurion' },
  ],
  boards: [{ id: 'board-ops', slug: 'operations-todo' }, { id: 'board-social', slug: 'cg-socials' }],
  buckets: [
    { id: 'bucket-admin', boardId: 'board-ops', name: 'ADMIN / TO DO' },
    { id: 'bucket-once', boardId: 'board-ops', name: 'ONCE-OFF' },
    { id: 'bucket-guides', boardId: 'board-ops', name: 'CONTENT GUIDES' },
    { id: 'bucket-websites', boardId: 'board-ops', name: 'WEBSITES' },
    { id: 'bucket-design', boardId: 'board-ops', name: 'GRAPHIC DESIGN' },
    { id: 'bucket-requests', boardId: 'board-ops', name: 'CLIENT REQUESTS' },
    { id: 'bucket-recurring', boardId: 'board-ops', name: 'CG ADMIN - RECURRING' },
    { id: 'bucket-cg-schedule', boardId: 'board-social', name: 'CG Schedule' },
    { id: 'bucket-studio-schedule', boardId: 'board-social', name: 'CG Studio Schedule' },
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
  return { format: 'cg-dynamics-microsoft-snapshot', version: 3, exportedAt: '2026-07-18T09:00:00Z', exportedBy: 'test', triggerType: 'admin', sources, records, assigneeMap: {} }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ previewPlannerTask } = await server.ssrLoadModule('/src/lib/microsoftImportPreview.ts'))
  ;({ resolveMicrosoftBucketMapping } = await server.ssrLoadModule('/src/lib/microsoftImportMap.ts'))
  ;({ buildMicrosoftReconciliation } = await server.ssrLoadModule('/src/lib/microsoftSync.ts'))
  ;({ buildMicrosoftConflictBreakdown, filterMicrosoftPreviewItems, microsoftIncomingStatus, summarizeMicrosoftCreateStatuses } = await server.ssrLoadModule('/src/lib/microsoftSyncPresentation.ts'))
  ;({ parseMicrosoftSnapshot } = await server.ssrLoadModule('/src/lib/microsoftSnapshot.ts'))
  ;({ resolvePreviewAssignees } = await server.ssrLoadModule('/src/lib/microsoftAssigneeMapping.ts'))
})

after(async () => { await server.close() })

// ── Bucket and plan resolution (unchanged behaviour) ──────────────────────

test('all known To Do buckets resolve to approved operational buckets', () => {
  const expected = new Map([
    ['ONCE-OFF', 'ONCE-OFF'],
    ['CONTENT GUIDES', 'CONTENT GUIDES'],
    ['WEBSITES', 'WEBSITES'],
    ['ADMIN / TO DO', 'ADMIN / TO DO'],
    ['GRAPHIC DESIGN', 'GRAPHIC DESIGN'],
    ['CLIENT REQUESTS', 'CLIENT REQUESTS'],
    ['CG ADMIN - RECURRING', 'CG ADMIN - RECURRING'],
  ])

  for (const [sourceBucket, targetBucket] of expected) {
    assert.equal(resolveMicrosoftBucketMapping('To Do', sourceBucket).targetBucket, targetBucket)
    assert.equal(previewPlannerTask(plannerTask({ sourceBucketName: sourceBucket }), context).previewStatus, 'new')
  }
})

test('harmless To Do bucket variations resolve deterministically', () => {
  assert.equal(resolveMicrosoftBucketMapping('To Do', '  Admin - To Do  ').targetBucket, 'ADMIN / TO DO')
  assert.equal(resolveMicrosoftBucketMapping('To Do', 'Once Off').targetBucket, 'ONCE-OFF')
  assert.equal(resolveMicrosoftBucketMapping('To Do', 'CG Admin – Recurring').targetBucket, 'CG ADMIN - RECURRING')
})

test('unknown To Do buckets fail closed as unsupported', () => {
  const item = previewPlannerTask(plannerTask({ sourceBucketName: 'UNREVIEWED BUCKET' }), context)
  assert.equal(item.previewStatus, 'conflict')
  assert.equal(item.conflictCode, 'unsupported_bucket')
  assert.match(item.conflictReason, /no approved deterministic mapping/i)
})

test('MASTER CLIENT TO DO resolves client aliases into the shared Client Requests bucket', () => {
  const item = previewPlannerTask(plannerTask({
    sourcePlanId: 'plan-master',
    sourcePlanName: 'MASTER CLIENT TO DO',
    sourceBucketName: 'EHRLICH PARK',
  }), context)
  assert.equal(item.previewStatus, 'new')
  assert.equal(item.mappedClientId, 'client-ehrlich')
  assert.equal(item.mappedClientName, 'Ehrlich Park Butchery')
  assert.equal(item.proposedPayload.bucket_id, 'bucket-requests')
  assert.equal(item.proposedPayload.original_plan_name, 'MASTER CLIENT TO DO')
  assert.equal(item.proposedPayload.original_bucket_name, 'EHRLICH PARK')
})

test('ambiguous MASTER CLIENT TO DO aliases remain conflicts', () => {
  const item = previewPlannerTask(plannerTask({
    sourcePlanId: 'plan-master',
    sourcePlanName: 'MASTER CLIENT TO DO',
    sourceBucketName: 'SUPA QUICK',
  }), context)
  assert.equal(item.previewStatus, 'conflict')
  assert.equal(item.conflictCode, 'ambiguous_client_match')
})

test('unresolved MASTER CLIENT TO DO clients remain conflicts', () => {
  const item = previewPlannerTask(plannerTask({
    sourcePlanId: 'plan-master',
    sourcePlanName: 'MASTER CLIENT TO DO',
    sourceBucketName: 'UNKNOWN CLIENT',
  }), context)
  assert.equal(item.previewStatus, 'conflict')
  assert.equal(item.conflictCode, 'unresolved_client')
})

test('CG Socials source buckets map to the CG Socials board', () => {
  const schedule = previewPlannerTask(plannerTask({
    sourcePlanId: 'plan-cg-socials',
    sourcePlanName: 'CG Socials',
    sourceBucketName: 'CG SECHEDULE (NEW)',
  }), context)
  const studio = previewPlannerTask(plannerTask({
    sourcePlanId: 'plan-cg-socials',
    sourcePlanName: 'CG Socials',
    sourceBucketName: 'CG STUDIO SCHEDULE',
  }), context)

  assert.equal(schedule.previewStatus, 'new')
  assert.equal(schedule.proposedPayload.board_id, 'board-social')
  assert.equal(schedule.proposedPayload.bucket_id, 'bucket-cg-schedule')
  assert.equal(studio.previewStatus, 'new')
  assert.equal(studio.proposedPayload.bucket_id, 'bucket-studio-schedule')
})

test('restricted operational content remains blocked before destination mapping', () => {
  const item = previewPlannerTask(plannerTask({ title: 'Review payroll figures' }), context)
  assert.equal(item.previewStatus, 'conflict')
  assert.equal(item.conflictCode, 'restricted_content')
  assert.equal(item.proposedPayload, null)
})

// ── Destination-aware progress mapping (A, B) ─────────────────────────────

test('0% operational task creates as to_do', () => {
  const source = plannerTask({ percentComplete: 0 })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(items[0].proposedPayload.status, 'to_do')
  assert.equal(microsoftIncomingStatus(items[0]), 'to_do')
})

test('50% operational task creates as in_progress', () => {
  const source = plannerTask({ percentComplete: 50 })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(items[0].proposedPayload.status, 'in_progress')
  assert.equal(microsoftIncomingStatus(items[0]), 'in_progress')
})

test('new 100% operational task is skipped (completed_operational_not_imported)', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: '2026-05-18' })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'skipped')
  assert.equal(items[0].skipCode, 'completed_operational_not_imported')
})

test('new 100% operational task without completedDate is also skipped', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: null })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'skipped')
  assert.equal(items[0].skipCode, 'completed_operational_not_imported')
})

test('existing linked task at 50% now at 100% reconciles to complete', () => {
  const active = plannerTask({ percentComplete: 50 })
  const created = buildMicrosoftReconciliation(snapshot([active]), context, [], new Set())[0]
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash, microsoftSourceRemovedAt: null,
    microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...created.proposedPayload },
  }
  const completed = plannerTask({ percentComplete: 100, completedDate: '2026-07-19' })
  const items = buildMicrosoftReconciliation(snapshot([completed]), context, [target], new Set())
  assert.equal(items[0].reconciliationAction, 'complete')
})

test('existing done task reopened to 50% reconciles to reopen', () => {
  const inProgress = plannerTask({ percentComplete: 50 })
  const created = buildMicrosoftReconciliation(snapshot([inProgress]), context, [], new Set())[0]
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash, microsoftSourceRemovedAt: null,
    microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...created.proposedPayload },
  }
  const done = plannerTask({ percentComplete: 100, completedDate: '2026-07-19' })
  const completed = buildMicrosoftReconciliation(snapshot([done]), context, [target], new Set())[0]
  assert.equal(completed.reconciliationAction, 'complete')
  const doneTarget = { ...target, microsoftSourceHash: completed.sourceHash, payload: { ...completed.proposedPayload } }
  const reopened = plannerTask({ percentComplete: 50, completedDate: null })
  const items = buildMicrosoftReconciliation(snapshot([reopened]), context, [doneTarget], new Set())
  assert.equal(items[0].reconciliationAction, 'reopen')
})

test('existing task unchanged at same progress reconciles to unchanged', () => {
  const source = plannerTask({ percentComplete: 50 })
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())[0]
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z', microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash, microsoftSourceRemovedAt: null,
    microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1', payload: { ...created.proposedPayload },
  }
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set())
  assert.equal(items[0].reconciliationAction, 'unchanged')
})

test('a source ID written before a failed or partial run is not created again', () => {
  const source = plannerTask({ sourceTaskId: 'partial-run-task', percentComplete: 50 })
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())[0]
  const existingWrittenTarget = {
    destination: 'planner', id: 'written-before-failure', updatedAt: '2026-07-18T08:30:00Z',
    microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'partial-run-task',
    payload: { ...created.proposedPayload },
  }
  const rerun = buildMicrosoftReconciliation(snapshot([source]), context, [existingWrittenTarget], new Set())
  assert.equal(rerun[0].reconciliationAction, 'unchanged')
  assert.notEqual(rerun[0].reconciliationAction, 'create')
})

test('0% Client Socials creates as to_do in client schedule', () => {
  const source = plannerTask({
    sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026',
    sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'social-todo',
    title: 'DP1 Launch', percentComplete: 0,
  })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(items[0].destination, 'client_schedule')
  assert.equal(items[0].proposedPayload.production_status, 'to_do')
})

test('100% Client Socials creates as scheduled (never skipped)', () => {
  const source = plannerTask({
    sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026',
    sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'social-done',
    title: 'DP1 Launch', percentComplete: 100, completedDate: '2026-05-01',
  })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(items[0].destination, 'client_schedule')
  assert.equal(items[0].proposedPayload.production_status, 'scheduled')
  assert.equal(items[0].skipCode, undefined)
})

test('Client Socials resolves reviewed client bucket aliases without guessing IDs', () => {
  const aliases = [
    ['BRAIZE PROMOTIONS', 'Braize'],
    ['HMHI ATTORNEYS', 'HMH Attorneys'],
    ['HUMAN AUTO FORD', 'Human Auto'],
    ['RC POLYPIPE', 'RC-Polypipe'],
    ['THE STAFFORDHIRE PUB', 'The Staffy'],
  ]
  const clients = aliases.map(([, name], index) => ({ id: `alias-client-${index}`, name }))
  const packages = clients.map((client, index) => ({ id: `alias-package-${index}`, clientId: client.id, status: 'active' }))
  const templates = packages.map((item, index) => ({ id: `alias-template-${index}`, packageId: item.id, code: 'DP1', deliverableType: 'dp', active: true }))
  const aliasContext = { ...context, clients, packages, templates }

  for (const [sourceBucketName, expectedClientName] of aliases) {
    const item = previewPlannerTask(plannerTask({
      sourcePlanId: 'plan-july',
      sourcePlanName: 'Client Socials - July 2026',
      sourceBucketId: `bucket-${sourceBucketName}`,
      sourceBucketName,
      sourceTaskId: `task-${sourceBucketName}`,
      title: 'DP1 Launch',
    }), aliasContext)
    assert.equal(item.previewStatus, 'new')
    assert.equal(item.mappedClientName, expectedClientName)
    assert.equal(item.proposedPayload.client_id, clients.find(client => client.name === expectedClientName).id)
  }
})

// ── Status grouping ───────────────────────────────────────────────────────

test('progress status breakdown correctly groups by destination-aware mapping', () => {
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
  assert.equal(counts.completed, 0)
  assert.equal(counts.scheduled, 1)
})

test('completed incoming status still renders for existing linked tasks', () => {
  const source = plannerTask({ percentComplete: 100, completedDate: '2026-07-10' })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].skipCode, 'completed_operational_not_imported')
  assert.equal(microsoftIncomingStatus(items[0]), 'completed')
})

// ── Reconciliation semantics ──────────────────────────────────────────────

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

test('idempotent rerun of same snapshot produces same actions', () => {
  const sources = [
    plannerTask({ sourceTaskId: 'todo', percentComplete: 0 }),
    plannerTask({ sourceTaskId: 'progress', percentComplete: 50 }),
    plannerTask({ sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026', sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'social-1', title: 'DP1 Launch', percentComplete: 100, completedDate: '2026-05-01' }),
  ]
  const first = buildMicrosoftReconciliation(snapshot(sources), context, [], new Set())
  const second = buildMicrosoftReconciliation(snapshot(sources), context, [], new Set())
  assert.equal(first.length, second.length)
  for (let index = 0; index < first.length; index += 1) {
    assert.equal(first[index].reconciliationAction, second[index].reconciliationAction)
    assert.equal(first[index].skipCode, second[index].skipCode)
  }
})

// ── Snapshot backward compatibility (E) ───────────────────────────────────

test('v3 snapshots with empty assigneeMap parse correctly', () => {
  const raw = snapshot([plannerTask()])
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.version, 3)
  assert.deepEqual(parsed.snapshot.assigneeMap, {})
})

test('v2 snapshots with plannerCompletedCutoff remain parseable', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 2
  raw.plannerCompletedCutoff = '2026-06-01'
  delete raw.assigneeMap
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.plannerCompletedCutoff, '2026-06-01')
})

test('v2 snapshots without plannerCompletedCutoff parse with null cutoff', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 2
  delete raw.plannerCompletedCutoff
  delete raw.assigneeMap
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.plannerCompletedCutoff, null)
})

test('v1 legacy snapshots parse with incomplete sources', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 1
  delete raw.sources
  delete raw.plannerCompletedCutoff
  delete raw.assigneeMap
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.ok(parsed.snapshot.sources.length > 0)
  assert.equal(parsed.snapshot.sources[0].complete, false)
})

test('null plannerCompletedCutoff in v2 is accepted', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 2
  raw.plannerCompletedCutoff = null
  delete raw.assigneeMap
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.plannerCompletedCutoff, null)
})

// ── Assignment persistence (PR #32) ────────────────────────────────────────

test('one resolved assignee populates planner assigned_to_name on payload', () => {
  const source = plannerTask({ assigneeMicrosoftIds: ['user-alice'] })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(),
    mapped => resolvePreviewAssignees(mapped, assigneeMap, storedMappings, profiles))
  assert.equal(items.length, 1)
  assert.equal(items[0].assigneeMicrosoftIds.length, 1)
  assert.equal(items[0].proposedPayload.destination, 'planner')
  assert.equal(items[0].proposedPayload.assigned_to_name, 'Alice Smith')
})

test('one resolved assignee populates client schedule assigned_to_user_id and assigned_to_name on payload', () => {
  const source = plannerTask({
    sourcePlanId: 'plan-july', sourcePlanName: 'Client Socials - July 2026',
    sourceBucketId: 'ms-acme', sourceBucketName: 'Acme', sourceTaskId: 'social-assign',
    title: 'DP1 Launch', assigneeMicrosoftIds: ['user-alice'],
  })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(),
    mapped => resolvePreviewAssignees(mapped, assigneeMap, storedMappings, profiles))
  assert.equal(items.length, 1)
  assert.equal(items[0].proposedPayload.destination, 'client_schedule')
  assert.equal(items[0].proposedPayload.assigned_to_user_id, 'profile-alice')
  assert.equal(items[0].proposedPayload.assigned_to_name, 'Alice Smith')
  assert.equal(items[0].proposedPayload.helper_names, null)
})

test('multiple assignees produce primary and helpers in planner payload', () => {
  const source = plannerTask({ assigneeMicrosoftIds: ['user-alice', 'user-bob', 'user-carol'] })
  const map = {
    ...assigneeMap,
    'user-bob': { displayName: 'Bob Jones', mail: 'bob@example.com', userPrincipalName: null },
    'user-carol': { displayName: 'Carol King', mail: 'carol@example.com', userPrincipalName: null },
  }
  const staff = [
    ...profiles,
    { id: 'profile-bob', email: 'bob@example.com', full_name: 'Bob Jones' },
    { id: 'profile-carol', email: 'carol@example.com', full_name: 'Carol King' },
  ]
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(),
    mapped => resolvePreviewAssignees(mapped, map, storedMappings, staff))
  const item = items[0]
  assert.equal(item.assigneeMicrosoftIds.length, 3)
  assert.equal(item.proposedPayload.destination, 'planner')
  assert.equal(item.proposedPayload.assigned_to_name, 'Alice Smith')
  assert.deepEqual(item.proposedPayload.helper_names, ['Bob Jones', 'Carol King'])
})

test('genuinely unassigned item remains valid and assignable', () => {
  const source = plannerTask({ assigneeMicrosoftIds: [] })
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())
  assert.equal(items[0].reconciliationAction, 'create')
  assert.equal(items[0].proposedPayload.assigned_to_name, null)
  assert.equal(items[0].previewStatus, 'new')
})

test('unchanged assignments remain idempotent', () => {
  const source = plannerTask({ assigneeMicrosoftIds: [] })
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())[0]
  const oldPayload = { ...created.proposedPayload, assigned_to_name: null, helper_names: null }
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z',
    microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1',
    payload: oldPayload,
  }
  const items = buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set())
  assert.equal(items[0].reconciliationAction, 'unchanged')
})

test('assignment change on core fields triggers update (not assignee)', () => {
  const oldSource = plannerTask({ title: 'Old title', assigneeMicrosoftIds: [] })
  const created = buildMicrosoftReconciliation(snapshot([oldSource]), context, [], new Set())[0]
  const oldPayload = { ...created.proposedPayload, assigned_to_name: null, helper_names: null }
  const target = {
    destination: 'planner', id: 'target-1', updatedAt: '2026-07-18T08:30:00Z',
    microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1',
    payload: oldPayload,
  }
  const newSource = plannerTask({ title: 'New title', assigneeMicrosoftIds: [] })
  const items = buildMicrosoftReconciliation(snapshot([newSource]), context, [target], new Set())
  assert.equal(items[0].reconciliationAction, 'update')
})

// ── Snapshot v3 validation ─────────────────────────────────────────────────

test('v3 snapshots preserve and validate sources', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 3
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.ok(parsed.snapshot.sources.length >= 2)
  assert.equal(parsed.snapshot.version, 3)
})

test('v3 snapshot source record-count mismatch is rejected', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 3
  raw.sources[1].recordCount = 99
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0], /declares 99 records but contains 1/i)
})

test('v3 snapshot with non-object assigneeMap is rejected', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 3
  raw.assigneeMap = 'not-an-object'
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0], /assigneeMap.*must be an object/i)
})

test('v3 snapshot with malformed assigneeMap entry is rejected', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 3
  raw.assigneeMap = { 'user-1': { displayName: 42 } }
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 1)
  assert.match(parsed.errors[0], /missing a required.*displayName.*string/i)
})

test('v3 snapshot with valid assigneeMap entries passes validation', () => {
  const raw = snapshot([plannerTask()])
  raw.version = 3
  raw.assigneeMap = {
    'user-alice': { displayName: 'Alice', mail: 'alice@example.com', userPrincipalName: 'alice@contoso.com' },
    'user-bob': { displayName: 'Bob', mail: null, userPrincipalName: null },
  }
  const parsed = parseMicrosoftSnapshot(JSON.stringify(raw))
  assert.equal(parsed.errors.length, 0)
  assert.equal(parsed.snapshot.assigneeMap['user-alice'].displayName, 'Alice')
  assert.equal(parsed.snapshot.assigneeMap['user-bob'].displayName, 'Bob')
})

// ── Resolve preview assignees ──────────────────────────────────────────────

function assignableItem(assigneeIds = []) {
  return {
    sourceType: 'planner_task',
    sourcePlanId: 'plan-todo',
    sourceCalendarId: null,
    sourceBucketId: 'ms-admin',
    sourceTaskId: 'task-assign',
    sourceEventId: null,
    sourceName: 'To Do',
    title: 'Assignable task',
    description: null,
    startDate: null,
    endDate: null,
    dueDate: '2026-07-20',
    assigneeMicrosoftIds: assigneeIds,
    destination: 'planner',
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: null,
    previewStatus: 'new',
    conflictCode: null,
    conflictReason: null,
    warnings: [],
    proposedPayload: { destination: 'planner', board_id: 'board-ops', bucket_id: 'bucket-admin', title: 'Assignable task', client_id: null, client_name: null, status: 'to_do', priority: 'normal', start_date: null, due_date: '2026-07-20', notes: null, source: 'microsoft_import', original_plan_name: 'To Do', original_bucket_name: 'ADMIN / TO DO', microsoft_source_type: 'planner_task', microsoft_plan_id: 'plan-todo', microsoft_bucket_id: 'ms-admin', microsoft_task_id: 'task-assign', microsoft_source_description: null, assigned_to_name: null, helper_names: null },
  }
}

const assigneeMap = { 'user-alice': { displayName: 'Alice Smith', mail: 'alice@example.com', userPrincipalName: 'alice@contoso.com' } }
const storedMappings = new Map()
const profiles = [{ id: 'profile-alice', email: 'alice@example.com', full_name: 'Alice Smith' }]

test('resolved assignments are hashed before reconciliation and remain idempotent', () => {
  const source = plannerTask({ assigneeMicrosoftIds: ['user-alice'] })
  const prepare = mapped => resolvePreviewAssignees(mapped, assigneeMap, storedMappings, profiles)
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), prepare)[0]
  const target = {
    destination: 'planner', id: 'assigned-target', updatedAt: '2026-07-18T08:30:00Z',
    microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1',
    payload: { ...created.proposedPayload },
  }
  const rerun = buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set(), prepare)
  assert.equal(rerun[0].reconciliationAction, 'unchanged')
})

test('resolved assignment changes produce an update instead of a false local-edit conflict', () => {
  const aliceSource = plannerTask({ assigneeMicrosoftIds: ['user-alice'] })
  const alicePrepare = mapped => resolvePreviewAssignees(mapped, assigneeMap, storedMappings, profiles)
  const created = buildMicrosoftReconciliation(snapshot([aliceSource]), context, [], new Set(), alicePrepare)[0]
  const target = {
    destination: 'planner', id: 'assigned-target', updatedAt: '2026-07-18T08:30:00Z',
    microsoftLastSyncedAt: '2026-07-18T08:00:00Z', microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null, microsoftPlanId: 'plan-todo', microsoftTaskId: 'task-1',
    payload: { ...created.proposedPayload },
  }
  const bobSource = plannerTask({ assigneeMicrosoftIds: ['user-bob'] })
  const bobMap = { 'user-bob': { displayName: 'Bob Jones', mail: 'bob@example.com', userPrincipalName: null } }
  const bobProfiles = [{ id: 'profile-bob', email: 'bob@example.com', full_name: 'Bob Jones' }]
  const changed = buildMicrosoftReconciliation(snapshot([bobSource]), context, [target], new Set(),
    mapped => resolvePreviewAssignees(mapped, bobMap, storedMappings, bobProfiles))
  assert.equal(changed[0].reconciliationAction, 'update')
  assert.equal(changed[0].conflictCode, null)
})

test('resolvePreviewAssignees populates assigned_to_name from email match', () => {
  const items = resolvePreviewAssignees([assignableItem(['user-alice'])], assigneeMap, storedMappings, profiles)
  assert.equal(items[0].resolvedAssignees.length, 1)
  assert.ok(items[0].resolvedAssignees[0].resolved)
  assert.equal(items[0].proposedPayload.assigned_to_name, 'Alice Smith')
})

test('resolvePreviewAssignees creates conflict for unresolved assignee', () => {
  const items = resolvePreviewAssignees([assignableItem(['user-unknown'])], assigneeMap, storedMappings, profiles)
  assert.equal(items[0].previewStatus, 'conflict')
  assert.equal(items[0].reconciliationAction, 'conflict')
  assert.equal(items[0].conflictCode, 'unresolved_assignee')
  assert.ok(items[0].conflictReason.includes('user-unknown'))
})

test('resolvePreviewAssignees creates helper_names for multiple resolved assignees', () => {
  const multiMap = {
    'user-alice': { displayName: 'Alice Smith', mail: 'alice@example.com', userPrincipalName: 'alice@contoso.com' },
    'user-bob': { displayName: 'Bob Jones', mail: 'bob@example.com', userPrincipalName: 'bob@contoso.com' },
  }
  const multiProfiles = [
    { id: 'profile-alice', email: 'alice@example.com', full_name: 'Alice Smith' },
    { id: 'profile-bob', email: 'bob@example.com', full_name: 'Bob Jones' },
  ]
  const items = resolvePreviewAssignees([assignableItem(['user-alice', 'user-bob'])], multiMap, storedMappings, multiProfiles)
  assert.equal(items[0].proposedPayload.assigned_to_name, 'Alice Smith')
  assert.deepEqual(items[0].proposedPayload.helper_names, ['Bob Jones'])
})

test('resolvePreviewAssignees leaves genuinely unassigned item unchanged', () => {
  const items = resolvePreviewAssignees([assignableItem([])], assigneeMap, storedMappings, profiles)
  assert.equal(items[0].previewStatus, 'new')
  assert.equal(items[0].proposedPayload.assigned_to_name, null)
})
