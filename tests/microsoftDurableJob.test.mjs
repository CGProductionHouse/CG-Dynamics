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