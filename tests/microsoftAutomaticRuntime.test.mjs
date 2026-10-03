import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { performance } from 'node:perf_hooks'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, jm, details, reconcile, automatic, applyMirrors, freshness
before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  jm = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/job-machine.ts')
  details = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/planner-details.ts')
  ;({ buildMicrosoftReconciliation: reconcile } = await server.ssrLoadModule('/src/lib/microsoftSync.ts'))
  automatic = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/automatic-snapshot.ts')
  ;({ applyAutomaticMicrosoftMirrors: applyMirrors } = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/automatic-reconciliation.ts'))
  ;({ microsoftFreshnessEvidence: freshness } = await server.ssrLoadModule('/src/lib/dailyDynamicsFreshness.ts'))
})
after(async () => { await server?.close() })

const now = '2026-10-02T15:00:00.000Z'
function fleet() {
  const names = ['Default operational Calendar', 'To Do', 'MASTER CLIENT TO DO', 'CG Socials', 'Client Socials - July 2026', '2025 CLIENTS SCHEDULE']
  const sizes = [150, 800, 200, 500, 350, 5500]
  return names.map((name, position) => ({
    position, source_type: position === 0 ? 'outlook_calendar' : 'planner_plan', source_id: `source-${position}`,
    source_name: name, required: true, stage: 'complete', complete: true, safe_error: null,
    record_count: sizes[position], pending_detail_ids: [], pagination_cursor: null,
    range_start: position === 0 ? '2026-09-01T00:00:00Z' : null,
    range_end: position === 0 ? '2027-09-01T00:00:00Z' : null,
    records: Array.from({ length: sizes[position] }, (_, i) => position === 0 ? {
      sourceType: 'outlook_event', sourceCalendarId: 'source-0', sourceEventId: `event-${i}`,
      title: `Internal meeting ${i}`, safeSummary: null, startDate: '2026-10-03T08:00:00Z', endDate: '2026-10-03T09:00:00Z',
      allDay: false, location: null, cancelled: i === 0, assigneeMicrosoftIds: [], sourceModifiedAt: now,
    } : {
      sourceType: 'planner_task', sourcePlanId: `source-${position}`, sourcePlanName: name,
      sourceBucketId: `bucket-${position}`, sourceBucketName: position === 1 ? 'ONCE OFF' : position === 3 ? 'CG Studio Schedule' : 'Fixture Client',
      sourceTaskId: `task-${position}-${i}`, title: position >= 4 ? `DP1 Campaign ${i}` : `Operational task ${i}`,
      description: null, startDate: null, dueDate: null, percentComplete: position === 1 && i < 18 ? 100 : 0,
      completedDate: null, assigneeMicrosoftIds: [`person-${position}-${i}`], sourceModifiedAt: now,
    }),
  }))
}
const context = {
  clients: [{ id: 'fixture-client', name: 'Fixture Client', active: true }],
  boards: [{ id: 'todo-board', slug: 'operations-todo' }, { id: 'social-board', slug: 'cg-socials' }, { id: 'schedule-board', slug: 'client-schedule' }],
  buckets: [{ id: 'once-bucket', boardId: 'todo-board', name: 'ONCE-OFF' }, { id: 'client-bucket', boardId: 'todo-board', name: 'CLIENT REQUESTS' }, { id: 'cg-bucket', boardId: 'social-board', name: 'CG Studio Schedule' }],
  packages: [], templates: [],
}
function snapshot(rows) { return { ...jm.assembleSnapshot(rows, {}, now), plannerCompletedCutoff: null } }

test('baseline hotspots reproduce blanket schedule hydration and full pre-apply work', t => {
  const rows = fleet()
  assert.equal(rows.reduce((n, s) => n + s.record_count, 0), 7500)
  const protectedDetails = rows.slice(4).flatMap(s => s.records).filter(r => details.shouldFetchPlannerTaskDetails(r.sourcePlanName, r.percentComplete))
  assert.equal(protectedDetails.length, 5850)
  const completeProtected = rows[5].records.filter(() => details.shouldFetchPlannerTaskDetails('2025 CLIENTS SCHEDULE', 100))
  assert.equal(completeProtected.length, 5500)
  const started = performance.now()
  const input = snapshot(rows)
  const preview = reconcile(input, context, [], new Set())
  assert.equal(input.records.length, 7500)
  assert.equal(input.assigneeLookup.requested, 7350)
  assert.equal(preview.filter(i => i.destination === 'client_schedule').length, 5850)
  t.diagnostic(`BASELINE: 7500 snapshot/preview records; 7350 assignee references; 5850 protected detail requests; ${(performance.now() - started).toFixed(1)}ms local assembly + reconciliation (not hosted Edge CPU proof)`)
})

test('automatic 7500/5500 fixture scopes enrichment and preparation without losing six-source evidence', t => {
  const rows = fleet()
  const started = performance.now()
  const scoped = automatic.assembleAutomaticSnapshot(rows, {}, now)
  const preview = reconcile(scoped, context, [], new Set(), items => items, new Map(), [], true)
  assert.equal(scoped.records.length, 1650)
  assert.equal(scoped.sources.length, 6)
  assert.equal(scoped.sources.reduce((n, s) => n + s.recordCount, 0), 7500)
  assert.equal(scoped.sources.every(s => s.complete), true)
  assert.equal(scoped.assigneeLookup.requested, 1500)
  assert.equal(rows.flatMap(s => automatic.plannerAssigneeIds(s, true)).length, 1500)
  assert.equal(rows.flatMap(s => automatic.plannerAssigneeIds(s)).length, 7350)
  assert.equal(preview.some(i => i.destination === 'client_schedule'), false)
  assert.equal(rows.slice(4).flatMap(s => s.records).filter(r => details.shouldFetchPlannerTaskDetails(r.sourcePlanName, r.percentComplete, true)).length, 0)
  assert.equal(details.shouldFetchPlannerTaskDetails('To Do', 0, true), true)
  assert.equal(details.shouldFetchPlannerTaskDetails('To Do', 100, true), false)
  const elapsed = performance.now() - started
  // Generous local guard, not a promise about hosted I/O or CPU accounting.
  assert.ok(elapsed < 2000, `Automatic pure preparation exceeded 2s locally: ${elapsed}ms`)
  t.diagnostic(`REPAIRED: 1650 mirror records; all 7500/6-source counts; 1500 assignee references; 0 protected detail requests; ${elapsed.toFixed(1)}ms local assembly + cached reconciliation`)
})

test('manual/admin defaults retain full records, details and reconciliation parity', () => {
  const rows = fleet()
  assert.equal(snapshot(rows).records.length, 7500)
  for (const name of ['2025 CLIENTS SCHEDULE', 'Client Socials - July 2026']) {
    for (const percent of [0, 50, 100, null]) assert.equal(details.shouldFetchPlannerTaskDetails(name, percent), true)
  }
  const small = rows.map(s => ({ ...s, records: s.records.slice(0, 3), record_count: 3 }))
  const full = snapshot(small)
  assert.deepEqual(reconcile(full, context, [], new Set()), reconcile(full, context, [], new Set(), items => items, new Map(), [], false))
})

test('resume skips only proven unnecessary old protected hydration, never incomplete enumeration/error', () => {
  const source = { ...fleet()[5], stage: 'fetching_details', complete: false, pending_detail_ids: ['task-5-0'] }
  assert.equal(automatic.canFinishAutomaticProtectedDetails(source), true)
  for (const patch of [{ stage: 'fetching_tasks' }, { safe_error: 'detail fetch failed' }, { pagination_cursor: 'next-page' }, { record_count: 5501 }, { source_name: 'To Do' }]) {
    assert.equal(automatic.canFinishAutomaticProtectedDetails({ ...source, ...patch }), false)
  }
})

test('5500 protected tasks enumerate/checkpoint/dedupe completely without automatic hydration', () => {
  const source = fleet()[5]
  let records = []
  for (let offset = 0; offset < source.records.length; offset += 1000) {
    const incoming = source.records.slice(offset, offset + 1000).map(r => ({ ...r, _needsDetail: details.shouldFetchPlannerTaskDetails(source.source_name, r.percentComplete, true) }))
    const page = { values: incoming, complete: offset + 1000 >= source.records.length, safeError: null, nextCursor: offset + 1000 < source.records.length ? `page-${offset + 1000}` : null }
    const accumulated = jm.accumulatePlannerPage(records, incoming, page, { complete: true, safeError: null })
    const replay = jm.accumulatePlannerPage(records, incoming, page, { complete: true, safeError: null })
    assert.deepEqual(replay, accumulated)
    records = accumulated.records
    assert.equal(accumulated.detailIds.length, 0)
    const transition = jm.planSourceUpdate(accumulated, offset / 1000 + 1)
    assert.equal(transition.stage, page.complete ? 'complete' : 'fetching_tasks')
  }
  assert.equal(records.length, 5500)
  assert.equal(records[0].sourceTaskId, 'task-5-0')
  assert.equal(records[2750].sourceTaskId, 'task-5-2750')
  assert.equal(records.at(-1).sourceTaskId, 'task-5-5499')
  const badBuckets = jm.accumulatePlannerPage([], [], { complete: true, safeError: null, nextCursor: null }, { complete: false, safeError: 'bucket permission failure' })
  assert.equal(jm.planSourceUpdate(badBuckets, 1).stage, 'failed')
  const unreadable = { ...source, get records() { throw new Error('protected assignees must not be inspected') } }
  assert.deepEqual(automatic.plannerAssigneeIds(unreadable, true), [])
})

test('writable exact-client mappings and same-ID different-plan identities do not borrow protected clients', () => {
  const rows = fleet()
  const master = rows[2].records.slice(0, 2).map((r, i) => ({ ...r, sourceBucketName: i === 0 ? 'Client Alpha' : 'Client Beta' }))
  const source = { ...rows[2], records: master, record_count: 2 }
  const input = automatic.assembleAutomaticSnapshot([source], {}, now)
  const exactContext = { ...context, clients: [{ id: 'alpha', name: 'Client Alpha', active: true }, { id: 'beta', name: 'Client Beta', active: true }] }
  const preview = reconcile(input, exactContext, [], new Set(), items => items, new Map(), [], true)
  assert.deepEqual(preview.map(i => i.proposedPayload.client_id), ['alpha', 'beta'])
  const ambiguousInput = { ...input, records: input.records.map((r, i) => i === 0 ? { ...r, sourceBucketName: 'Client Alpha and Client Beta' } : r) }
  assert.equal(reconcile(ambiguousInput, exactContext, [], new Set(), items => items, new Map(), [], true)[0].reconciliationAction, 'conflict')
  const sameTaskId = { ...rows[1].records[0], sourceTaskId: master[0].sourceTaskId }
  const otherSource = { ...rows[1], records: [sameTaskId], record_count: 1 }
  const both = reconcile(automatic.assembleAutomaticSnapshot([source, otherSource], {}, now), exactContext, [], new Set(), items => items, new Map(), [], true)
  assert.equal(both.some(i => i.conflictCode === 'duplicate_source_key'), false)
})

test('automatic projection refuses incomplete, missing payload and forged exact source identity', () => {
  const rows = fleet()
  for (const patch of [{ complete: false }, { safe_error: 'provider failure' }, { pagination_cursor: 'next' }]) {
    assert.throws(() => automatic.assembleAutomaticSnapshot(rows.map((s, i) => i === 5 ? { ...s, ...patch } : s), {}, now), /incomplete/)
  }
  assert.throws(() => automatic.assembleAutomaticSnapshot(rows.map((s, i) => i === 1 ? { ...s, records: [] } : s), {}, now), /coverage/)
  rows[1].records[0].sourcePlanId = 'source-5'
  assert.throws(() => automatic.assembleAutomaticSnapshot(rows, {}, now), /exact source/)
})

function database(rows = fleet()) {
  const tables = {
    clients: context.clients.map(c => ({ ...c })), client_aliases: [],
    planner_boards: context.boards, planner_buckets: context.buckets.map(b => ({ id: b.id, board_id: b.boardId, name: b.name })),
    planner_tasks: [], company_calendar_events: [], microsoft_sync_runs: [],
    microsoft_sync_jobs: [{ id: 'job', assignee_map: {}, exported_at: now }],
    microsoft_sync_job_sources: rows.map(s => ({ ...s, id: `row-${s.position}`, job_id: 'job' })),
  }
  const calls = [], audit = new Set()
  let mutations = 0, crashAfter = null, loseLease = false, failRead = null
  const db = {
    tables, calls, audit,
    get mutations() { return mutations },
    set crashAfter(value) { crashAfter = value },
    set loseLease(value) { loseLease = value },
    set failRead(value) { failRead = value },
    from(table) {
      assert.notEqual(table, 'monthly_deliverables')
      const filters = []; let mode = 'read', patch, single = false, columns = '', range = [0, 999], inserted
      const query = {
        select(value) { columns = value; return query }, eq(key, value) { filters.push(r => r[key] === value); return query },
        in(key, values) { filters.push(r => values.includes(r[key])); return query },
        is() { return query }, not() { return query }, order() { return query }, range(from, to) { range = [from, to]; return query },
        insert(value) { mode = 'insert'; inserted = { ...value, id: `run-${tables[table].length}` }; return query },
        update(value) { mode = 'update'; patch = value; return query },
        single() { single = true; return query }, maybeSingle() { single = true; return query }, limit() { return query },
        then(resolve, reject) {
          try {
            if (failRead === table && mode === 'read') return Promise.resolve({ data: null, error: { message: 'read failed' } }).then(resolve, reject)
            if (mode === 'insert' && table === 'microsoft_sync_runs' && typeof inserted.snapshot_exported_by !== 'string') {
              return Promise.resolve({ data: null, error: { code: '23502', message: 'snapshot_exported_by violates not-null constraint' } }).then(resolve, reject)
            }
            if (mode === 'insert') tables[table].push(inserted)
            let selected = tables[table].filter(r => filters.every(f => f(r))).slice(range[0], range[1] + 1)
            if (mode === 'update') {
              if (loseLease) selected = []
              else selected.forEach(r => Object.assign(r, patch))
            }
            calls.push({ table, mode, columns, rows: selected.length, ids: selected.map(r => r.id), range })
            const data = selected.map(r => Object.fromEntries(columns.split(',').map(key => [key, r[key]])))
            return Promise.resolve({ data: single ? data[0] ?? null : data, error: null }).then(resolve, reject)
          } catch (error) { return Promise.reject(error).then(resolve, reject) }
        },
      }
      return query
    },
    async rpc(name, args) {
      assert.equal(name, 'apply_microsoft_sync_item_automatic')
      assert.ok(['planner', 'cg_calendar'].includes(args.p_destination))
      calls.push({ rpc: name, args })
      if (crashAfter !== null && audit.size >= crashAfter) throw new Error('simulated crash')
      if (!audit.has(args.p_item_key)) {
        audit.add(args.p_item_key)
        if (args.p_should_apply) mutations++
      }
      return { data: { duplicate: true }, error: null }
    },
  }
  return db
}

test('automatic apply persists canonical exporter and approved system attribution required by production', async () => {
  const rows = fleet().map(s => ({ ...s, records: s.records.slice(0, 1), record_count: 1 }))
  const input = automatic.assembleAutomaticSnapshot(rows, {}, now)
  const db = database(rows)
  const result = await applyMirrors(db, input, 'job', 'system-user')
  assert.equal(result.status, 'completed')
  assert.equal(db.tables.microsoft_sync_runs.length, 1)
  const run = db.tables.microsoft_sync_runs[0]
  assert.equal(run.snapshot_exported_by, input.exportedBy)
  assert.equal(run.snapshot_exported_at, input.exportedAt)
  assert.equal(run.requested_by, 'system-user')
  assert.equal(run.preview_job_id, 'job')
  assert.equal(run.trigger_type, 'agent')
  assert.deepEqual(run.source_completeness, input.sources)
  assert.equal(result.clientScheduleExcluded, 2)
})

test('missing canonical exporter fails closed before any mirror application', async () => {
  const rows = fleet().map(s => ({ ...s, records: s.records.slice(0, 1), record_count: 1 }))
  const input = { ...automatic.assembleAutomaticSnapshot(rows, {}, now), exportedBy: null }
  const db = database(rows)
  const result = await applyMirrors(db, input, 'job', 'system-user')
  assert.equal(result.status, 'failed')
  assert.equal(result.runId, null)
  assert.match(result.error, /snapshot_exported_by/)
  assert.equal(db.tables.microsoft_sync_runs.length, 0)
  assert.equal(db.calls.some(c => c.rpc), false)
  assert.equal(db.mutations, 0)
})

test('actual automatic snapshot loader never reads protected payloads and preserves all source counts', async () => {
  const db = database()
  const prepared = await automatic.readAutomaticJobSnapshot(db, 'job', now)
  assert.equal(prepared.snapshot.records.length, 1650)
  const payloads = db.calls.filter(c => c.table === 'microsoft_sync_job_sources' && c.columns.includes('records'))
  assert.deepEqual(payloads.map(c => c.ids), [['row-0', 'row-1', 'row-2', 'row-3']])
  assert.equal(db.calls.some(c => c.mode !== 'read'), false)
  db.tables.microsoft_sync_job_sources[5].complete = false
  db.calls.length = 0
  await assert.rejects(automatic.readAutomaticJobSnapshot(db, 'job', now), /incomplete/)
  assert.equal(db.calls.some(c => c.columns.includes('records')), false)
})

test('completed upstream tasks apply done by exact IDs; cancellation, idempotency and crash replay stay safe', async t => {
  const rows = fleet()
  const current = automatic.assembleAutomaticSnapshot(rows, {}, now)
  const previous = { ...current, records: current.records.map(r => r.sourceType === 'planner_task' ? { ...r, percentComplete: 0 } : { ...r, cancelled: false }) }
  const baseline = reconcile(previous, context, [], new Set(), items => items, new Map(), [], true)
  const db = database(rows)
  for (const item of baseline.filter(i => i.sourcePlanId === 'source-1' && Number(i.sourceTaskId.split('-').at(-1)) < 18)) {
    const p = item.proposedPayload
    db.tables.planner_tasks.push({ ...p, id: `target-${item.sourceTaskId}`, updated_at: now, microsoft_source_hash: item.sourceHash, microsoft_last_synced_at: now, notes: p.microsoft_source_description })
  }
  const event = baseline.find(i => i.sourceEventId === 'event-0').proposedPayload
  const eventHash = baseline.find(i => i.sourceEventId === 'event-0').sourceHash
  db.tables.company_calendar_events.push({ ...event, id: 'target-event-0', updated_at: now, microsoft_source_hash: eventHash, microsoft_last_synced_at: now, notes: event.microsoft_source_description })
  const started = performance.now()
  db.crashAfter = 20
  await assert.rejects(applyMirrors(db, current, 'job', 'system-user'), /simulated crash/)
  const writesBeforeRecovery = db.mutations
  db.crashAfter = null
  const result = await applyMirrors(db, current, 'job', 'system-user', 'run-0', 0)
  assert.equal(result.status, 'completed')
  assert.equal(result.clientScheduleExcluded, 5850)
  const done = db.calls.filter(c => c.rpc && c.args.p_action === 'complete')
  assert.equal(new Set(done.map(c => c.args.p_destination_id)).size, 18)
  assert.ok(done.every(c => c.args.p_patch.status === 'done'))
  assert.ok(db.calls.some(c => c.rpc && c.args.p_action === 'cancel' && c.args.p_patch.status === 'cancelled'))
  assert.ok(db.mutations >= writesBeforeRecovery)
  const mutations = db.mutations
  const originalExporter = db.tables.microsoft_sync_runs[0].snapshot_exported_by
  const originalRequester = db.tables.microsoft_sync_runs[0].requested_by
  await applyMirrors(db, current, 'job', 'system-user', 'run-0', 0)
  assert.equal(db.tables.microsoft_sync_runs.length, 1)
  assert.equal(db.tables.microsoft_sync_runs[0].snapshot_exported_by, originalExporter)
  assert.equal(db.tables.microsoft_sync_runs[0].requested_by, originalRequester)
  assert.equal(db.mutations, mutations, 'exact audit item keys prevent duplicate application on replay')
  assert.ok(db.calls.filter(c => c.rpc).every(c => c.args.p_patch.client_id === undefined || c.args.p_patch.client_id === null || c.args.p_patch.client_id === 'fixture-client'))
  assert.equal(db.tables.microsoft_sync_runs[0].source_completeness.length, 6)
  t.diagnostic(`AUTOMATIC MOCK APPLY/CRASH/2 REPLAYS: ${(performance.now() - started).toFixed(1)}ms; ${db.audit.size} unique mirror audit keys; ${db.mutations} unique mutations; zero protected writes`)
})

test('lease fencing, paginated target reads, duplicate identities and inner failure remain fail closed', async () => {
  const rows = fleet()
  const input = automatic.assembleAutomaticSnapshot(rows, {}, now)
  const duplicate = input.records.find(r => r.sourceType === 'planner_task')
  const duplicates = { ...input, records: [...input.records, duplicate], sources: input.sources.map(s => s.sourceId === duplicate.sourcePlanId ? { ...s, recordCount: s.recordCount + 1 } : s) }
  const preview = reconcile(duplicates, context, [], new Set(), items => items, new Map(), [], true)
  assert.equal(preview.filter(i => i.sourceTaskId === duplicate.sourceTaskId).every(i => i.reconciliationAction === 'conflict'), true)
  const db = database(rows)
  db.tables.planner_tasks = Array.from({ length: 1501 }, (_, i) => ({ id: `old-${i}`, microsoft_plan_id: 'excluded-plan', microsoft_task_id: `old-${i}` }))
  db.loseLease = true
  const fenced = await applyMirrors(db, input, 'job', 'system-user')
  assert.equal(fenced.status, 'applying')
  assert.equal(db.mutations, 0)
  assert.ok(db.calls.some(c => c.table === 'planner_tasks' && c.range[0] === 1000 && c.rows === 501))
  db.failRead = 'planner_tasks'
  assert.equal((await applyMirrors(db, input, 'job', 'system-user')).status, 'failed')
  assert.notEqual(freshness({ now, connected: true, lastJobStartedAt: now, lastJobCompletedAt: now, lastSuccessfulReconciliationAt: null, requiredSources: input.sources.map(s => ({ name: s.sourceName, complete: s.complete, error: s.safeError })), applyStatus: 'failed' }).verdict, 'PASS')
})

test('system recovery selects only agent runs for exact preview; manual full-result path stays unchanged', () => {
  const edge = readFileSync('supabase/functions/microsoft-transition-sync/index.ts', 'utf8')
  assert.match(edge, /eq\('preview_job_id', jobId\)\.eq\('trigger_type', 'agent'\)/)
  assert.match(edge, /eq\('preview_job_id', latestSystemJob.id\)\.eq\('trigger_type', 'agent'\)/)
  assert.match(edge, /if \(action === 'job_result'\)[\s\S]*assembleSnapshot\(jobRows, \(job.assignee_map/)
  assert.doesNotMatch(edge, /ok: automatic.status !== 'failed'/)
  const sql = readFileSync('supabase/migrations/20260921120000_daily_dynamics_service_reconciliation.sql', 'utf8')
  assert.match(sql, /trigger_type = 'agent'/)
  assert.match(sql, /automatic_recovery_count/)
  assert.equal(jm.planAutomaticApplyRecovery({ status: 'applying', startedAt: now, recoveryCount: 0, recoveryAfter: '2026-10-02T15:10:00Z', now }).kind, 'fresh')
  assert.equal(jm.planAutomaticApplyRecovery({ status: 'applying', startedAt: '2026-07-20T00:00:00Z', recoveryCount: 3, recoveryAfter: null, now }).kind, 'exhausted')
})
