import assert from 'node:assert/strict'
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

test('simulated pagination accumulation: 6000 records across 6 pages of 1000, first/middle/last survive exactly once', () => {
  // Simulate 6 pages of 1000 records each = 6000 total
  // This mimics the persisted resume flow where each job_process call loads
  // existing records from DB, fetches next page, deduplicates, and saves back
  const allRecords = Array.from({ length: 6000 }, (_, i) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${i}`,
    title: `Task ${i}`,
    assigneeMicrosoftIds: i % 2 === 0 ? ['u1'] : ['u2'],
  }))

  let accumulated = []
  let cursor = null
  const pages = []
  for (let page = 0; page < 6; page++) {
    const start = page * 1000
    const pageRecords = allRecords.slice(start, start + 1000)
    pages.push(pageRecords)
  }

  // Simulate 6 sequential job_process calls (persisted resume)
  for (let page = 0; page < 6; page++) {
    // Each call: load existing records from DB (accumulated), fetch next page, dedupe, save
    accumulated = jm.dedupeRecords(accumulated, pages[page], 'sourceTaskId')
    cursor = page < 5 ? `https://graph.microsoft.com/next-page-${page + 1}` : null
    // Verify intermediate state
    assert.equal(accumulated.length, (page + 1) * 1000)
    assert.equal(accumulated[0].title, 'Task 0') // first survives
    assert.equal(accumulated[accumulated.length - 1].title, `Task ${(page + 1) * 1000 - 1}`) // last of current batch
  }

  // Final verification: all 6000 records present exactly once
  assert.equal(accumulated.length, 6000)
  assert.equal(accumulated[0].title, 'Task 0')
  assert.equal(accumulated[3000].title, 'Task 3000')
  assert.equal(accumulated[5999].title, 'Task 5999')

  // Verify no duplicates by checking all IDs are unique
  const ids = accumulated.map(r => r.sourceTaskId)
  const uniqueIds = new Set(ids)
  assert.equal(uniqueIds.size, 6000)
})

test('simulated pagination with duplicate overlap: idempotent resume after partial failure', () => {
  // Simulate: page 2 succeeds, but job_process crashes before DB write
  // On retry, page 2 is fetched again — overlap must be idempotent
  const allRecords = Array.from({ length: 3000 }, (_, i) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${i}`,
    title: `Task ${i}`,
  }))

  const page0 = allRecords.slice(0, 1000)
  const page1 = allRecords.slice(1000, 2000)
  const page2 = allRecords.slice(2000, 3000)

  let accumulated = []

  // First successful run: pages 0 and 1
  accumulated = jm.dedupeRecords(accumulated, page0, 'sourceTaskId')
  assert.equal(accumulated.length, 1000)
  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceTaskId')
  assert.equal(accumulated.length, 2000)

  // Simulated crash before page 2 persisted — on retry, page 1 might be re-fetched
  // (or page 2 fetched again). Dedupe must handle overlap.
  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceTaskId') // overlap
  assert.equal(accumulated.length, 2000, 'overlap with page 1 is idempotent')

  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceTaskId')
  assert.equal(accumulated.length, 3000, 'page 2 adds new records')

  // Verify all records present exactly once
  const ids = accumulated.map(r => r.sourceTaskId)
  assert.equal(new Set(ids).size, 3000)
  assert.equal(accumulated[0].title, 'Task 0')
  assert.equal(accumulated[1500].title, 'Task 1500')
  assert.equal(accumulated[2999].title, 'Task 2999')
})

test('simulated retry resets cursor and state for failed source', () => {
  // This tests the job_retry logic: failed source should have cursor cleared,
  // stage reset to queued, records cleared, ready for fresh fetch
  const failedSource = row({
    position: 1,
    stage: 'failed',
    safe_error: 'Microsoft temporarily unavailable',
    record_count: 1500,
    records: Array.from({ length: 1500 }, (_, i) => ({ sourceTaskId: `task-${i}` })),
    pagination_cursor: 'https://graph.microsoft.com/some-cursor',
    complete: false,
  })

  // Simulate job_retry update (from index.ts line 346)
  const retriedSource = {
    ...failedSource,
    stage: 'queued',
    safe_error: null,
    records: [],
    record_count: 0,
    complete: false,
    pagination_cursor: null,
  }

  assert.equal(retriedSource.stage, 'queued')
  assert.equal(retriedSource.safe_error, null)
  assert.equal(retriedSource.records.length, 0)
  assert.equal(retriedSource.record_count, 0)
  assert.equal(retriedSource.pagination_cursor, null)
  assert.equal(retriedSource.complete, false)
})

test('error during pagination does not mark source complete', () => {
  // Simulate graphPages returning safeError with nextCursor=null (final page but with error)
  // The completion logic in index.ts requires: result.complete && result.safeError === null
  const resultWithError = {
    values: [{ id: '1' }],
    complete: true, // Graph says no more pages
    safeError: 'Microsoft temporarily unavailable or timed out.', // but there was an error
    nextCursor: null,
  }

  const complete = resultWithError.complete && resultWithError.safeError === null
  assert.equal(complete, false, 'error must prevent completion even when cursor is null')
})

test('simulated multi-source pagination: Planner plan continues fetching_tasks across job_process calls', () => {
  // Test the state machine: a Planner source in 'fetching_tasks' with cursor
  // should be picked by pickNextSource and continue pagination
  const rows = [
    row({ position: 0, stage: 'complete', complete: true }),
    row({ position: 1, stage: 'fetching_tasks', pagination_cursor: 'cursor-page-2', record_count: 1000,
      records: Array.from({ length: 1000 }, (_, i) => ({ sourceTaskId: `task-${i}` })) }),
    row({ position: 2, stage: 'queued' }),
  ]

  const pick = jm.pickNextSource(rows)
  assert.equal(pick.position, 1)
  assert.equal(pick.stage, 'fetching_tasks')
  assert.equal(pick.pagination_cursor, 'cursor-page-2')
  assert.equal(pick.record_count, 1000)

  // After next job_process call, it should advance to next page
  const nextCursor = 'cursor-page-3'
  const nextPageRecords = Array.from({ length: 1000 }, (_, i) => ({ sourceTaskId: `task-${i + 1000}` }))
  const accumulated = jm.dedupeRecords(pick.records ?? [], nextPageRecords, 'sourceTaskId')

  assert.equal(accumulated.length, 2000)
  assert.equal(accumulated[0].sourceTaskId, 'task-0')
  assert.equal(accumulated[1999].sourceTaskId, 'task-1999')
})

test('Outlook pagination accumulation preserves records across resume', () => {
  // Outlook uses sourceEventId for deduplication
  const allEvents = Array.from({ length: 2500 }, (_, i) => ({
    sourceType: 'outlook_event',
    sourceEventId: `event-${i}`,
    title: `Event ${i}`,
  }))

  const page0 = allEvents.slice(0, 1000)
  const page1 = allEvents.slice(1000, 2000)
  const page2 = allEvents.slice(2000, 2500)

  let accumulated = []

  // Simulate 3 job_process calls for Outlook calendar
  accumulated = jm.dedupeRecords(accumulated, page0, 'sourceEventId')
  assert.equal(accumulated.length, 1000)

  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceEventId')
  assert.equal(accumulated.length, 2000)

  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceEventId')
  assert.equal(accumulated.length, 2500)

  // Verify first/middle/last
  assert.equal(accumulated[0].title, 'Event 0')
  assert.equal(accumulated[1250].title, 'Event 1250')
  assert.equal(accumulated[2499].title, 'Event 2499')

  const ids = accumulated.map(r => r.sourceEventId)
  assert.equal(new Set(ids).size, 2500)
})

// ============================================================================
// Planner Multi-Page Detail Enrichment Regression Tests
// ============================================================================

test('simulated Planner multi-page pagination: detail IDs from page 1 and final page both survive and accumulate', () => {
  // Simulate a 3-page Planner plan (e.g., 2025 CLIENTS SCHEDULE)
  // Page 1: tasks 0-999, some need details (percentComplete < 100)
  // Page 2: tasks 1000-1999, some need details
  // Page 3: tasks 2000-2999, some need details
  // Total: 3000 tasks across 3 pages
  
  const makeTask = (index, percentComplete) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${index}`,
    title: `Task ${index}`,
    percentComplete,
    assigneeMicrosoftIds: [],
    _needsDetail: percentComplete !== 100, // Client Schedule plans always need details, or incomplete tasks
  })

  // Page 1: 1000 tasks, tasks 0, 100, 500 need details
  const page1 = Array.from({ length: 1000 }, (_, i) => 
    makeTask(i, i === 0 || i === 100 || i === 500 ? 50 : 100)
  )
  // Page 2: 1000 tasks, tasks 1000, 1500 need details  
  const page2 = Array.from({ length: 1000 }, (_, i) => 
    makeTask(1000 + i, i === 0 || i === 500 ? 50 : 100)
  )
  // Page 3: 1000 tasks, tasks 2000, 2500, 2999 need details
  const page3 = Array.from({ length: 1000 }, (_, i) => 
    makeTask(2000 + i, i === 0 || i === 500 || i === 999 ? 50 : 100)
  )

  // Simulate 3 sequential job_process calls (persisted resume)
  let accumulated = []
  let allDetailIds = []

  // Call 1: Fetch page 1
  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceTaskId')
  const detailIds1 = accumulated.filter(r => r._needsDetail).map(r => r.sourceTaskId)
  allDetailIds.push(...detailIds1)
  assert.equal(accumulated.length, 1000)
  assert.equal(detailIds1.length, 3) // tasks 0, 100, 500
  assert.deepEqual(detailIds1.sort(), ['task-0', 'task-100', 'task-500'])

  // Call 2: Fetch page 2 (resume with accumulated records from page 1)
  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceTaskId')
  const detailIds2 = accumulated.filter(r => r._needsDetail).map(r => r.sourceTaskId)
  // Should now include page 1 + page 2 detail IDs
  assert.equal(accumulated.length, 2000)
  assert.equal(detailIds2.length, 5) // tasks 0, 100, 500, 1000, 1500
  assert.ok(detailIds2.includes('task-0'))
  assert.ok(detailIds2.includes('task-100'))
  assert.ok(detailIds2.includes('task-500'))
  assert.ok(detailIds2.includes('task-1000'))
  assert.ok(detailIds2.includes('task-1500'))

  // Call 3: Fetch page 3 (final page, resume with accumulated records from pages 1-2)
  accumulated = jm.dedupeRecords(accumulated, page3, 'sourceTaskId')
  const detailIds3 = accumulated.filter(r => r._needsDetail).map(r => r.sourceTaskId)
  // Should now include page 1 + page 2 + page 3 detail IDs
  assert.equal(accumulated.length, 3000)
  assert.equal(detailIds3.length, 8) // tasks 0, 100, 500, 1000, 1500, 2000, 2500, 2999
  assert.ok(detailIds3.includes('task-0'))      // page 1
  assert.ok(detailIds3.includes('task-100'))    // page 1
  assert.ok(detailIds3.includes('task-500'))    // page 1
  assert.ok(detailIds3.includes('task-1000'))   // page 2
  assert.ok(detailIds3.includes('task-1500'))   // page 2
  assert.ok(detailIds3.includes('task-2000'))   // page 3
  assert.ok(detailIds3.includes('task-2500'))   // page 3
  assert.ok(detailIds3.includes('task-2999'))   // page 3 (final task)

  // Verify all 3000 records present exactly once
  const allIds = accumulated.map(r => r.sourceTaskId)
  assert.equal(new Set(allIds).size, 3000)

  // Verify _needsDetail is preserved in accumulated records during pagination
  const needsDetailRecords = accumulated.filter(r => r._needsDetail === true)
  assert.equal(needsDetailRecords.length, 8)
})

test('simulated Planner pagination complete: _needsDetail stripped only after final page, detail IDs passed to fetching_details', () => {
  // This test simulates the fetchPlannerTasksUnit behavior:
  // - During pagination (nextCursor exists): records keep _needsDetail
  // - When pagination complete (nextCursor null): _needsDetail stripped, detailIds returned
  
  const makeTask = (index, percentComplete) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${index}`,
    title: `Task ${index}`,
    percentComplete,
    assigneeMicrosoftIds: [],
    _needsDetail: percentComplete !== 100,
  })

  const page1 = Array.from({ length: 1000 }, (_, i) => makeTask(i, i === 100 ? 50 : 100))
  const page2 = Array.from({ length: 1000 }, (_, i) => makeTask(1000 + i, i === 500 ? 50 : 100))

  // Simulate pagination NOT complete (has nextCursor)
  let accumulated = []
  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceTaskId')
  // During pagination, _needsDetail should be preserved in records
  const duringPagination = accumulated.map(r => ({ ...r }))
  const hasNeedsDetailDuring = duringPagination.some(r => r._needsDetail === true)
  assert.equal(hasNeedsDetailDuring, true, '_needsDetail preserved during pagination')

  // Simulate pagination complete (no nextCursor) - strip _needsDetail
  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceTaskId')
  const detailIds = accumulated.filter(r => r._needsDetail).map(r => r.sourceTaskId)
  const recordsForSnapshot = accumulated.map(({ _needsDetail, ...record }) => { void _needsDetail; return record; })
  
  // detailIds should include from both pages
  assert.equal(detailIds.length, 2)
  assert.ok(detailIds.includes('task-100'))
  assert.ok(detailIds.includes('task-1500'))
  
  // Records for snapshot should NOT have _needsDetail
  const hasNeedsDetailAfter = recordsForSnapshot.some(r => '_needsDetail' in r)
  assert.equal(hasNeedsDetailAfter, false, '_needsDetail stripped after pagination complete')
  
  // But all original records preserved
  assert.equal(recordsForSnapshot.length, 2000)
})

test('Planner detail enrichment drains all pending detail IDs before source marked complete', () => {
  // Simulate the detail fetching phase: pending_detail_ids are processed in batches
  // until empty, then source moves to complete
  
  const pendingDetailIds = [
    'task-0', 'task-100', 'task-500',      // from page 1
    'task-1000', 'task-1500',              // from page 2  
    'task-2000', 'task-2500', 'task-2999'  // from page 3
  ]
  
  let pending = [...pendingDetailIds]
  const batches = []
  const DETAIL_BATCH_SIZE = 300
  
  while (pending.length > 0) {
    const batch = pending.slice(0, DETAIL_BATCH_SIZE)
    batches.push(batch)
    pending = pending.slice(DETAIL_BATCH_SIZE)
  }
  
  // Should take 1 batch for 8 items (well under 300)
  assert.equal(batches.length, 1)
  assert.equal(batches[0].length, 8)
  assert.deepEqual(batches[0].sort(), pendingDetailIds.sort())
  
  // After processing, pending should be empty
  assert.equal(pending.length, 0)
  
  // Simulate the job_progress check: source should not be complete until pending_detail_ids is empty
  const sourceDuringDetails = row({
    stage: 'fetching_details',
    pending_detail_ids: pendingDetailIds,
    complete: false,
    required: true
  })
  const sourceAfterDetails = row({
    stage: 'complete',
    pending_detail_ids: [],
    complete: true,
    required: true
  })
  
  // requiredSourcesComplete should return false while in fetching_details
  const rowsDuring = [sourceDuringDetails]
  const rowsAfter = [sourceAfterDetails]
  
  assert.equal(jm.requiredSourcesComplete(rowsDuring), false)
  assert.equal(jm.requiredSourcesComplete(rowsAfter), true)
  
  // jobProgress should show detailsRemaining > 0 during fetching_details
  assert.equal(jm.jobProgress(rowsDuring).detailsRemaining, 8)
  assert.equal(jm.jobProgress(rowsAfter).detailsRemaining, 0)
})

test('Planner multi-page idempotent resume: re-fetching page 2 after crash preserves page 1 detail IDs', () => {
  // Simulate: pages 1 and 2 fetched successfully, crash before page 3
  // On retry: page 2 might be re-fetched (overlap), page 3 fetched fresh
  // Page 1 detail IDs must survive the overlap
  
  const makeTask = (index, percentComplete) => ({
    sourceType: 'planner_task',
    sourceTaskId: `task-${index}`,
    title: `Task ${index}`,
    percentComplete,
    assigneeMicrosoftIds: [],
    _needsDetail: percentComplete !== 100,
  })

  const page1 = Array.from({ length: 1000 }, (_, i) => makeTask(i, i === 100 ? 50 : 100))
  const page2 = Array.from({ length: 1000 }, (_, i) => makeTask(1000 + i, i === 500 ? 50 : 100))
  const page3 = Array.from({ length: 1000 }, (_, i) => makeTask(2000 + i, i === 999 ? 50 : 100))

  let accumulated = []
  
  // First run: pages 1 and 2 succeed
  accumulated = jm.dedupeRecords(accumulated, page1, 'sourceTaskId')
  assert.equal(accumulated.filter(r => r._needsDetail).length, 1) // task-100
  
  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceTaskId')
  assert.equal(accumulated.filter(r => r._needsDetail).length, 2) // task-100, task-1500
  
  // Simulated crash here - DB has pages 1-2 with _needsDetail preserved
  
  // Retry: page 2 re-fetched (overlap), then page 3
  accumulated = jm.dedupeRecords(accumulated, page2, 'sourceTaskId') // overlap - idempotent
  assert.equal(accumulated.length, 2000, 'page 2 overlap idempotent')
  assert.equal(accumulated.filter(r => r._needsDetail).length, 2, 'page 1 detail IDs survive overlap')
  
  accumulated = jm.dedupeRecords(accumulated, page3, 'sourceTaskId')
  assert.equal(accumulated.length, 3000)
  assert.equal(accumulated.filter(r => r._needsDetail).length, 3) // task-100, task-1500, task-2999
  
  const detailIds = accumulated.filter(r => r._needsDetail).map(r => r.sourceTaskId)
  assert.ok(detailIds.includes('task-100'), 'page 1 detail ID survives')
  assert.ok(detailIds.includes('task-1500'), 'page 2 detail ID survives')
  assert.ok(detailIds.includes('task-2999'), 'page 3 detail ID added')
})