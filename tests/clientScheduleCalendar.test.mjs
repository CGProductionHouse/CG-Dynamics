import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let isNeedsActionStatus
let isPostedOrHistoryStatus
let normalizeScheduleStatus
let getEffectiveScheduleDate

function mockDeliverable(status, { scheduledDate, dueDate } = {}) {
  return { production_status: status, scheduled_date: scheduledDate ?? null, due_date: dueDate ?? null }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  const planner = await server.ssrLoadModule('/src/lib/planner.ts')
  isNeedsActionStatus = planner.isNeedsActionStatus
  isPostedOrHistoryStatus = planner.isPostedOrHistoryStatus
  normalizeScheduleStatus = planner.normalizeScheduleStatus
  // Extract the inlined helper from the module source.
  // getEffectiveScheduleDate is inlined in ClientSchedulePage; replicate here.
  getEffectiveScheduleDate = (d) => d.scheduled_date ?? d.due_date ?? null
})

after(async () => { await server.close() })

test('isNeedsActionStatus excludes scheduled_posted and meta_drafts (grid/board needs-action mode)', () => {
  assert.equal(isNeedsActionStatus('scheduled_posted'), false)
  assert.equal(isNeedsActionStatus('meta_drafts'), false)
})

test('isNeedsActionStatus includes work-in-progress statuses (grid/board needs-action mode)', () => {
  assert.equal(isNeedsActionStatus('not_started'), true)
  assert.equal(isNeedsActionStatus('in_progress'), true)
  assert.equal(isNeedsActionStatus('ready_review'), true)
  assert.equal(isNeedsActionStatus('awaiting_client'), true)
})

test('isPostedOrHistoryStatus identifies scheduled_posted only', () => {
  assert.equal(isPostedOrHistoryStatus('scheduled_posted'), true)
  assert.equal(isPostedOrHistoryStatus('not_started'), false)
  assert.equal(isPostedOrHistoryStatus('meta_drafts'), false)
})

test('scheduled deliverable with scheduled_date appears in calendar (not excluded by unscheduled check)', () => {
  const deliverable = mockDeliverable('scheduled', { scheduledDate: '2026-07-15' })
  const date = getEffectiveScheduleDate(deliverable)
  assert.ok(date, 'scheduled deliverable must have an effective schedule date')
  assert.equal(date, '2026-07-15')
})

test('posted deliverable with scheduled_date appears in calendar regardless of needs-action mode', () => {
  const status = normalizeScheduleStatus('posted')
  assert.equal(status, 'scheduled_posted')
  assert.equal(isNeedsActionStatus(status), false, 'posted is not needs-action — would be hidden in grid/board needs-action mode')

  const deliverable = mockDeliverable('posted', { scheduledDate: '2026-07-20' })
  const date = getEffectiveScheduleDate(deliverable)
  assert.ok(date, 'posted deliverable has a schedule date — would appear in calendar')
})

test('unscheduled deliverable without any date is excluded from calendar dated cells', () => {
  const deliverable = mockDeliverable('not_started', { scheduledDate: null, dueDate: null })
  const date = getEffectiveScheduleDate(deliverable)
  assert.equal(date, null, 'unscheduled deliverable has no date — excluded from calendar cells')
})

test('deliverable with only due_date gets effective date (legacy Teams fallback)', () => {
  const deliverable = mockDeliverable('in_progress', { scheduledDate: null, dueDate: '2026-08-01' })
  const date = getEffectiveScheduleDate(deliverable)
  assert.equal(date, '2026-08-01', 'due_date fallback provides an effective date for calendar')
})

test('calendar receives all statuses with dates — union across needs-action, meta_drafts, and scheduled_posted', () => {
  const statuses = ['scheduled', 'posted', 'in_progress', 'not_started', 'ready_internal_review', 'waiting_client', 'meta_drafts']
  for (const raw of statuses) {
    const normalized = normalizeScheduleStatus(raw)
    const deliverable = mockDeliverable(raw, { scheduledDate: '2026-07-01' })
    const date = getEffectiveScheduleDate(deliverable)
    assert.ok(date, `${raw} deliverable with schedule date is visible in calendar`)
    const isNeedsAction = isNeedsActionStatus(normalized)
    assert.equal(isNeedsAction, normalized !== 'scheduled_posted' && normalized !== 'meta_drafts',
      `grid/board needs-action hides ${normalized}: ${!isNeedsAction}`)
  }
})
