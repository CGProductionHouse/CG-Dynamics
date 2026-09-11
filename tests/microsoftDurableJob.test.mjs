import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, jm
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  jm = await server.ssrLoadModule('/supabase/functions/microsoft-transition-sync/job-machine.ts')
})
after(async () => { await server?.close() })

const manifest = {
  userId: 'user-1',
  calendar: { id: 'cal-1', name: 'CG Calendar' },
  plans: [
    { id: '1ZjZPTY4W02yLFfq1V7cYmUAAitG', name: '2025 CLIENTS SCHEDULE' },
    { id: 'p2', name: 'CG SOCIALS' },
    { id: 'p3', name: 'TO DO' },
  ],
}
const row = (o) => ({ position: 0, source_type: 'planner_plan', source_id: 'p', source_name: 'P', required: true, stage: 'queued', record_count: 0, complete: false, safe_error: null, records: [], pending_detail_ids: [], range_start: null, range_end: null, pagination_cursor: null, ...o })

test('PAGINATION_BATCH_SIZE constant is exported and reasonable', () => {
  assert.ok(jm.PAGINATION_BATCH_SIZE > 0 && jm.PAGINATION_BATCH_SIZE <= 5000)
})

test('JobSourceRow type includes pagination_cursor field', () => {
  const r = row({ pagination_cursor: 'https://graph.microsoft.com/next-page' })
  assert.equal(r.pagination_cursor, 'https://graph.microsoft.com/next-page')
})

test('every configured source is enumerated (Outlook + all plans), plans required', () => {
  const seeds = jm.enumerateJobSources(manifest, '2026-07-01', '2026-08-01')
  assert.equal(seeds.length, 4)
  assert.equal(seeds[0].source_type, 'outlook_calendar')
  assert.equal(seeds[0].range_start, '2026-07-01')
  const plan = seeds.find(s => s.source_name === '2025 CLIENTS SCHEDULE')
  assert.ok(plan && plan.required && plan.source_type === 'planner_plan')
  assert.equal(seeds.filter(s => s.source_type === 'planner_plan').length, 3)
})

test('detail batching splits a large pending list into bounded batches', () => {
  const pending = Array.from({ length: 4306 }, (_, i) => `t${i}`)
  const { batch, rest } = jm.nextDetailBatch(pending)
  assert.equal(batch.length, jm.DETAIL_BATCH_SIZE)
  assert.equal(rest.length, 4306 - jm.DETAIL_BATCH_SIZE)
  let remaining = pending, steps = 0
  while (remaining.length > 0) { remaining = jm.nextDetailBatch(remaining).rest; steps++ }
  assert.equal(steps, Math.ceil(4306 / jm.DETAIL_BATCH_SIZE))
})

test('pickNextSource finishes an in-progress detail fetch before starting new sources', () => {
  const rows = [
    row({ position: 0, stage: 'complete' }),
    row({ position: 1, stage: 'fetching_details', pending_detail_ids: ['a'] }),
    row({ position: 2, stage: 'queued' }),
  ]
  assert.equal(jm.pickNextSource(rows).position, 1)
  assert.equal(jm.pickNextSource([row({ position: 2, stage: 'queued' }), row({ position: 3, stage: 'complete' })]).position, 2)
  assert.equal(jm.pickNextSource([row({ stage: 'complete' }), row({ stage: 'failed' })]), null)
})

test('pickNextSource continues fetching_tasks before starting new sources', () => {
  const rows = [
    row({ position: 0, stage: 'complete' }),
    row({ position: 1, stage: 'fetching_tasks', pagination_cursor: 'cursor-1' }),
    row({ position: 2, stage: 'queued' }),
  ]
  assert.equal(jm.pickNextSource(rows).position, 1)
  assert.equal(jm.pickNextSource(rows).stage, 'fetching_tasks')
})

test('pickNextSource prefers fetching_details over fetching_tasks over queued', () => {
  const rows = [
    row({ position: 0, stage: 'fetching_tasks', pagination_cursor: 'cursor-1' }),
    row({ position: 1, stage: 'fetching_details', pending_detail_ids: ['a'] }),
    row({ position: 2, stage: 'queued' }),
  ]
  assert.equal(jm.pickNextSource(rows).position, 1)
  assert.equal(jm.pickNextSource(rows).stage, 'fetching_details')
})

test('progress + completeness gate: apply blocked until every required source completes', () => {
  const partial = [row({ position: 0, stage: 'complete', complete: true }), row({ position: 1, stage: 'fetching_details', pending_detail_ids: ['x', 'y'] })]
  const p = jm.jobProgress(partial)
  assert.equal(p.allRequiredComplete, false)
  assert.equal(p.detailsRemaining, 2)
  assert.equal(jm.requiredSourcesComplete(partial), false)

  const failed = [row({ position: 0, stage: 'complete' }), row({ position: 1, stage: 'failed' })]
  assert.equal(jm.jobProgress(failed).finished, true)
  assert.equal(jm.jobProgress(failed).anyFailed, true)
  assert.equal(jm.requiredSourcesComplete(failed), false)

  const done = [row({ position: 0, stage: 'complete' }), row({ position: 1, stage: 'complete' })]
  assert.equal(jm.requiredSourcesComplete(done), true)
  assert.equal(jm.jobProgress(done).allRequiredComplete, true)
})

test('a non-required source that failed does not block completeness', () => {
  const rows = [row({ position: 0, stage: 'complete', required: true }), row({ position: 1, stage: 'failed', required: false })]
  assert.equal(jm.requiredSourcesComplete(rows), true)
})

test('assembleSnapshot flattens records in source order and reports completeness + assignee lookup', () => {
  const rows = [
    row({ position: 1, source_type: 'planner_plan', source_id: 'p1', source_name: '2025 CLIENTS SCHEDULE', stage: 'complete', complete: true, record_count: 2,
      records: [{ sourceType: 'planner_task', title: 'F1 - STAFFY', assigneeMicrosoftIds: ['u1'] }, { sourceType: 'planner_task', title: 'DP4 STAFFY', assigneeMicrosoftIds: ['u1', 'u2'] }] }),
    row({ position: 0, source_type: 'outlook_calendar', source_id: 'cal', source_name: 'CG Calendar', stage: 'complete', complete: true, record_count: 1,
      records: [{ sourceType: 'outlook_event', title: 'Shoot' }] }),
  ]
  const snap = jm.assembleSnapshot(rows, { u1: { displayName: 'A' } }, '2026-07-26T00:00:00.000Z')
  assert.equal(snap.version, 3)
  assert.equal(snap.records.length, 3)
  assert.equal(snap.records[0].title, 'Shoot')
  assert.equal(snap.records[1].title, 'F1 - STAFFY')
  assert.equal(snap.sources.length, 2)
  assert.equal(snap.sources.every(s => s.complete), true)
  assert.equal(snap.assigneeLookup.requested, 3)
  assert.equal(snap.assigneeLookup.resolved, 1)
  assert.equal(snap.assigneeLookup.unresolved, 2)
})

test('assembleSnapshot does not deduplicate - deduplication happens at fetch time', () => {
  const rows = [
    row({
      position: 0, source_type: 'planner_plan', source_id: 'p1', source_name: 'Plan',
      stage: 'complete', complete: true, record_count: 3,
      records: [
        { sourceType: 'planner_task', sourceTaskId: 't1', title: 'Task 1' },
        { sourceType: 'planner_task', sourceTaskId: 't2', title: 'Task 2' },
        { sourceType: 'planner_task', sourceTaskId: 't1', title: 'Task 1 duplicate' },
      ]
    }),
  ]
  const snap = jm.assembleSnapshot(rows, {}, '2026-07-26T00:00:00.000Z')
  assert.equal(snap.records.length, 3)
  assert.equal(snap.sources[0].recordCount, 3)
})

test('jobProgress counts fetching_tasks as in-progress', () => {
  const rows = [
    row({ position: 0, stage: 'complete' }),
    row({ position: 1, stage: 'fetching_tasks', pagination_cursor: 'cursor' }),
    row({ position: 2, stage: 'queued' }),
  ]
  const p = jm.jobProgress(rows)
  assert.equal(p.fetching, 1)
  assert.equal(p.queued, 1)
  assert.equal(p.finished, false)
})

test('requiredSourcesComplete returns false when any required source is in fetching_tasks', () => {
  const rows = [
    row({ position: 0, stage: 'complete', required: true }),
    row({ position: 1, stage: 'fetching_tasks', required: true, pagination_cursor: 'cursor' }),
  ]
  assert.equal(jm.requiredSourcesComplete(rows), false)
})

test('assembleSnapshot preserves first middle last records across large source', () => {
  const manyRecords = Array.from({ length: 6000 }, (_, i) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${i}`,
    title: `Task ${i}`,
    assigneeMicrosoftIds: i % 2 === 0 ? ['u1'] : ['u2'],
  }))
  const rows = [
    row({ position: 0, source_type: 'planner_plan', source_id: 'p1', source_name: 'Large Plan',
      stage: 'complete', complete: true, record_count: 6000, records: manyRecords }),
  ]
  const snap = jm.assembleSnapshot(rows, { u1: { displayName: 'A' }, u2: { displayName: 'B' } }, '2026-07-26T00:00:00.000Z')
  assert.equal(snap.records.length, 6000)
  assert.equal(snap.records[0].title, 'Task 0')
  assert.equal(snap.records[3000].title, 'Task 3000')
  assert.equal(snap.records[5999].title, 'Task 5999')
  assert.equal(snap.assigneeLookup.requested, 6000)
  assert.equal(snap.assigneeLookup.resolved, 2)
})

// ============================================================================
// Pagination / Accumulation Regression Tests (simulate >5000 records across
// persisted resumes, retries, errors)
// ============================================================================

test('dedupeRecords deduplicates by idKey and preserves order', () => {
  const existing = [
    { sourceTaskId: 't1', title: 'Task 1' },
    { sourceTaskId: 't2', title: 'Task 2' },
  ]
  const incoming = [
    { sourceTaskId: 't2', title: 'Task 2 duplicate' },
    { sourceTaskId: 't3', title: 'Task 3' },
  ]
  const result = jm.dedupeRecords(existing, incoming, 'sourceTaskId')
  assert.equal(result.length, 3)
  assert.equal(result[0].sourceTaskId, 't1')
  assert.equal(result[1].sourceTaskId, 't2')
  assert.equal(result[2].sourceTaskId, 't3')
  assert.equal(result[1].title, 'Task 2') // existing preserved, not overwritten
})

test('dedupeRecords with empty existing returns incoming', () => {
  const incoming = [{ sourceTaskId: 't1', title: 'Task 1' }, { sourceTaskId: 't2', title: 'Task 2' }]
  const result = jm.dedupeRecords([], incoming, 'sourceTaskId')
  assert.equal(result.length, 2)
  assert.deepEqual(result, incoming)
})

test('dedupeRecords with empty incoming returns existing', () => {
  const existing = [{ sourceTaskId: 't1', title: 'Task 1' }, { sourceTaskId: 't2', title: 'Task 2' }]
  const result = jm.dedupeRecords(existing, [], 'sourceTaskId')
  assert.equal(result.length, 2)
  assert.deepEqual(result, existing)
})

// ────────────────────────────────────────────────────────────────────────────
// The real pagination path.
//
// Everything below drives the production functions index.ts calls
// (paginateGraph → accumulatePlannerPage / accumulateOutlookPage →
// planSourceUpdate → retrySourceReset) against a fake Microsoft Graph, persisting
// each update into an in-memory source row exactly as job_process does between
// calls. Nothing here re-implements index.ts by hand; the last test asserts
// index.ts is actually wired to these functions.
// ────────────────────────────────────────────────────────────────────────────

const TASKS_URL = 'https://graph.microsoft.com/v1.0/planner/plans/big/tasks'
const describeFailure = status => (status === null ? 'Microsoft connector request failed.' : `Microsoft returned ${status}.`)
const bucketsOk = { values: [], complete: true, safeError: null, nextCursor: null }

// A fake Graph serving `pageSizes` pages. failAt: page index answering 403.
// repeatAt: page index whose nextLink points back at itself.
function fakeGraph(pageSizes, { failAt = -1, repeatAt = -1, idPrefix = 'task' } = {}) {
  const urls = pageSizes.map((_, index) => (index === 0 ? TASKS_URL : `${TASKS_URL}?$skiptoken=page-${index}`))
  const bodies = new Map()
  let offset = 0
  pageSizes.forEach((size, index) => {
    const value = Array.from({ length: size }, (_, n) => ({ id: `${idPrefix}-${offset + n}` }))
    offset += size
    const nextLink = index === repeatAt ? urls[index] : urls[index + 1]
    bodies.set(urls[index], nextLink ? { value, '@odata.nextLink': nextLink } : { value })
  })
  const fetched = []
  async function fetchPage(url) {
    fetched.push(url)
    if (urls.indexOf(url) === failAt) return { ok: false, status: 403, body: null }
    const body = bodies.get(url)
    return body ? { ok: true, status: 200, body } : { ok: false, status: 404, body: null }
  }
  return { fetchPage, fetched, urls, total: offset }
}

const plannerRow = (overrides = {}) => ({ ...row({ source_id: 'big', source_name: '2025 CLIENTS SCHEDULE' }), attempts: 0, ...overrides })

// One job_process fetch step for a Planner source, through the production functions.
async function plannerStep(source, graph, needsDetail) {
  const attempts = source.attempts + 1
  const taskResult = await jm.paginateGraph(source.pagination_cursor ?? TASKS_URL, graph.fetchPage, describeFailure, jm.PAGINATION_BATCH_SIZE)
  const incoming = taskResult.values.map(task => ({
    sourceType: 'planner_task',
    sourceTaskId: String(task.id),
    title: String(task.id),
    [jm.NEEDS_DETAIL_MARKER]: needsDetail.has(String(task.id)),
  }))
  const update = jm.planSourceUpdate(jm.accumulatePlannerPage(source.records, incoming, taskResult, bucketsOk), attempts)
  return { update, attempts }
}

// Drive a Planner source through job_process-equivalent calls until it leaves the
// fetch stage. crashBeforePersistAt discards that step, as if the Edge Function
// died after fetching but before its DB write.
async function runPlanner(graph, { needsDetail = new Set(), crashBeforePersistAt = -1, source = plannerRow() } = {}) {
  let steps = 0
  while ((source.stage === 'queued' || source.stage === 'fetching_tasks') && steps < 100) {
    steps += 1
    const { update, attempts } = await plannerStep(source, graph, needsDetail)
    if (steps === crashBeforePersistAt) continue
    source = { ...source, ...update, attempts }
  }
  return { source, steps }
}

const idsOf = records => records.map(record => record.sourceTaskId ?? record.sourceEventId)

function assertEachExactlyOnce(records, expectedIds) {
  const ids = idsOf(records)
  assert.equal(new Set(ids).size, ids.length, 'no record is duplicated')
  for (const id of expectedIds) assert.equal(ids.filter(value => value === id).length, 1, `${id} survives exactly once`)
}

test('a >5,000-task plan is fetched across bounded calls and every task survives exactly once', async () => {
  const graph = fakeGraph([900, 900, 900, 900, 900, 900, 900]) // 6,300 tasks over 7 Graph pages
  const { source, steps } = await runPlanner(graph)
  assert.equal(source.stage, 'complete')
  assert.equal(source.complete, true)
  assert.equal(source.pagination_cursor, null)
  assert.equal(source.records.length, 6300)
  assert.equal(source.record_count, 6300)
  assertEachExactlyOnce(source.records, ['task-0', 'task-3150', 'task-6299'])
  assert.ok(steps > 1, 'the plan must span several job_process calls, not one capped fetch')
  assert.deepEqual(graph.fetched, graph.urls, 'each Graph page is fetched exactly once, in order')
  assert.ok(source.records.every(record => !(jm.NEEDS_DETAIL_MARKER in record)), 'the internal marker never leaves the job')
})

test('detail work from page 1 and the final page survives resume and is drained before completion', async () => {
  const graph = fakeGraph([900, 900, 900, 900, 900, 900, 900])
  const needsDetail = new Set(['task-0', 'task-950', 'task-6299'])
  const { source } = await runPlanner(graph, { needsDetail })
  assert.equal(source.stage, 'fetching_details', 'detail work must run before the source can complete')
  assert.equal(source.complete, false)
  assert.deepEqual([...source.pending_detail_ids].sort(), [...needsDetail].sort(), 'page-1, middle and final-page detail ids all survive')
  assert.ok(source.records.every(record => !(jm.NEEDS_DETAIL_MARKER in record)))

  const drained = []
  let pending = source.pending_detail_ids
  while (pending.length > 0) {
    const { batch, rest } = jm.nextDetailBatch(pending, 2)
    drained.push(...batch)
    pending = rest
  }
  assert.deepEqual(drained.sort(), [...needsDetail].sort())
})

test('a Graph page larger than the batch is consumed whole and never re-fetched', async () => {
  const graph = fakeGraph([1500, 1500, 10])
  const { source } = await runPlanner(graph)
  assert.equal(source.stage, 'complete')
  assert.equal(source.records.length, 3010)
  assert.deepEqual(graph.fetched, graph.urls, 'checkpointing only on @odata.nextLink means no page is read twice')
})

test('a failing page fails the source instead of pinning the job in fetching_tasks', async () => {
  const { source } = await runPlanner(fakeGraph([900, 900, 900, 900], { failAt: 2 }))
  assert.equal(source.stage, 'failed')
  assert.equal(source.complete, false)
  assert.equal(source.pagination_cursor, null)
  assert.equal(source.safe_error, 'Microsoft returned 403.')

  // The job moves on and reports honestly instead of retrying the same page forever.
  const next = row({ position: 1, source_id: 'p2' })
  assert.equal(jm.pickNextSource([{ ...source, position: 0 }, next]), next)
  assert.equal(jm.jobProgress([source]).finished, true)
  assert.equal(jm.jobProgress([source]).anyFailed, true)
  assert.equal(jm.requiredSourcesComplete([source]), false, 'a failed required source still blocks apply')
})

test('job_retry re-queues a failed source and a fresh run completes', async () => {
  const failing = await runPlanner(fakeGraph([900, 900, 900, 900], { failAt: 2 }))
  const reset = { ...failing.source, ...jm.retrySourceReset() }
  assert.equal(reset.stage, 'queued')
  assert.deepEqual(reset.records, [])
  assert.equal(reset.pagination_cursor, null)
  assert.equal(reset.attempts, 0)
  assert.equal(jm.pickNextSource([reset]), reset)

  const { source } = await runPlanner(fakeGraph([900, 900, 900, 900]), { source: reset })
  assert.equal(source.stage, 'complete')
  assert.equal(source.records.length, 3600)
})

test('a step that crashes before persisting is replayed idempotently', async () => {
  const graph = fakeGraph([900, 900, 900, 900, 900, 900, 900])
  const { source } = await runPlanner(graph, { crashBeforePersistAt: 2 })
  assert.equal(source.stage, 'complete')
  assert.equal(source.records.length, 6300)
  assertEachExactlyOnce(source.records, ['task-0', 'task-1800', 'task-6299'])
  assert.ok(graph.fetched.length > graph.urls.length, 'the crashed step really was fetched again')
})

test('a repeating page link is refused rather than looped', async () => {
  const { source } = await runPlanner(fakeGraph([900, 900, 900], { repeatAt: 1 }))
  assert.equal(source.stage, 'failed')
  assert.match(source.safe_error, /repeating page link/)
})

test('a source that never stops paginating is bounded', () => {
  const stillPaging = { records: [], detailIds: [], complete: false, safeError: null, nextCursor: 'https://graph.example/next' }
  assert.equal(jm.planSourceUpdate(stillPaging, jm.MAX_PAGINATION_STEPS - 1).stage, 'fetching_tasks')
  const bounded = jm.planSourceUpdate(stillPaging, jm.MAX_PAGINATION_STEPS)
  assert.equal(bounded.stage, 'failed')
  assert.equal(bounded.complete, false)
})

test('Outlook pagination accumulates across resume through the real path', async () => {
  const graph = fakeGraph([700, 700, 700], { idPrefix: 'event' })
  let source = { ...row({ source_type: 'outlook_calendar', source_id: 'cal-1' }), attempts: 0 }
  let steps = 0
  while ((source.stage === 'queued' || source.stage === 'fetching_tasks') && steps < 20) {
    steps += 1
    const result = await jm.paginateGraph(source.pagination_cursor ?? TASKS_URL, graph.fetchPage, describeFailure, jm.PAGINATION_BATCH_SIZE)
    const incoming = result.values.map(event => ({ sourceType: 'outlook_event', sourceEventId: String(event.id) }))
    const attempts = source.attempts + 1
    source = { ...source, ...jm.planSourceUpdate(jm.accumulateOutlookPage(source.records, incoming, result), attempts), attempts }
  }
  assert.equal(source.stage, 'complete')
  assert.equal(source.complete, true)
  assert.equal(source.records.length, 2100)
  assertEachExactlyOnce(source.records, ['event-0', 'event-1050', 'event-2099'])
  assert.equal(steps, 2)
})

test('index.ts is wired to the tested functions and keeps status polls light', () => {
  const code = readFileSync(new URL('../supabase/functions/microsoft-transition-sync/index.ts', import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  for (const call of ['paginateGraph(', 'accumulatePlannerPage(', 'accumulateOutlookPage(', 'planSourceUpdate(', 'retrySourceReset(']) {
    assert.ok(code.includes(call), `index.ts must call ${call}`)
  }
  const sourceFields = code.match(/const SOURCE_FIELDS = '([^']*)'/)
  assert.ok(sourceFields, 'SOURCE_FIELDS must exist')
  assert.doesNotMatch(sourceFields[1], /\brecords\b/, 'status polls must not load every source payload')
  assert.match(code, /\.select\('records'\)\.eq\('id', dbId\)/, 'job_process loads only the source it fetches')
  assert.doesNotMatch(code, /nextCursor: next\b/, 'a failed page URL must never be handed back as a resume cursor')
  assert.match(code, /if \(rest\.length === 0\)[\s\S]{0,400}stage: 'complete'/, 'detail work completes the source only once drained')
})
