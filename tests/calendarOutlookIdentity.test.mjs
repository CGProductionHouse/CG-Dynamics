import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let reconcileCalendarLogicalItems
let buildMicrosoftReconciliation
let approveCalendarDuplicateAsSeparate
let getMicrosoftReviewedItems
let buildMicrosoftRecoveryPlan

const context = { clients: [], boards: [], buckets: [], packages: [], templates: [] }

function calendarEvent(overrides = {}) {
  return {
    id: 'event-native',
    title: 'MEETING - CG INTERNAL',
    start_at: '2026-08-24T06:00:00.000Z',
    end_at: '2026-08-24T07:00:00.000Z',
    all_day: false,
    linked_task_id: null,
    microsoft_calendar_id: null,
    microsoft_event_id: null,
    microsoft_last_synced_at: null,
    updated_at: '2026-07-06T18:32:29.886Z',
    ...overrides,
  }
}

function outlookSource(overrides = {}) {
  return {
    sourceType: 'outlook_event',
    sourceCalendarId: 'calendar-1',
    sourceEventId: 'outlook-event-24-aug',
    title: 'MEETING - CG INTERNAL',
    safeSummary: null,
    startDate: '2026-08-24T08:00:00+02:00',
    endDate: '2026-08-24T09:00:00+02:00',
    allDay: false,
    location: 'CG STUDIO',
    private: false,
    cancelled: false,
    assigneeMicrosoftIds: [],
    sourceModifiedAt: '2026-07-25T18:00:00Z',
    ...overrides,
  }
}

function snapshot(records) {
  return {
    format: 'cg-dynamics-microsoft-snapshot',
    version: 3,
    exportedAt: '2026-07-25T20:00:00Z',
    exportedBy: 'test',
    triggerType: 'admin',
    sources: [{
      sourceType: 'outlook_calendar',
      sourceId: 'calendar-1',
      sourceName: 'CG Calendar',
      complete: true,
      rangeStart: '2026-05-01T00:00:00Z',
      rangeEnd: '2026-12-01T00:00:00Z',
      recordCount: records.length,
      safeError: null,
    }],
    records,
    assigneeMap: {},
  }
}

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  ;({ reconcileCalendarLogicalItems } = await server.ssrLoadModule('/src/lib/calendarIdentity.ts'))
  ;({ buildMicrosoftReconciliation } = await server.ssrLoadModule('/src/lib/microsoftSync.ts'))
  ;({ approveCalendarDuplicateAsSeparate, getMicrosoftReviewedItems, buildMicrosoftRecoveryPlan } = await server.ssrLoadModule('/src/lib/microsoftRecovery.ts'))
})

after(async () => { await server.close() })

test('the same durable Outlook identity renders once', () => {
  const stale = calendarEvent({ id: 'outlook-stale', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'event-1', microsoft_last_synced_at: '2026-07-20T10:00:00Z' })
  const current = calendarEvent({ id: 'outlook-current', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'event-1', microsoft_last_synced_at: '2026-07-21T10:00:00Z' })

  const result = reconcileCalendarLogicalItems([stale, current], [])

  assert.deepEqual(result.events.map(event => event.id), ['outlook-current'])
  assert.equal(result.reviewCandidates.length, 0)
})

test('recurring occurrences with different immutable Outlook ids remain separate', () => {
  const first = calendarEvent({ id: 'occurrence-1', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'occurrence-id-1' })
  const second = calendarEvent({ id: 'occurrence-2', start_at: '2026-08-31T06:00:00Z', end_at: '2026-08-31T07:00:00Z', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'occurrence-id-2' })

  assert.equal(reconcileCalendarLogicalItems([first, second], []).events.length, 2)
})

test('native and Outlook lookalikes remain separate review candidates', () => {
  const native = calendarEvent()
  const outlook = calendarEvent({ id: 'event-outlook', location: 'CG STUDIO', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'outlook-event-24-aug' })

  const result = reconcileCalendarLogicalItems([native, outlook], [])

  assert.equal(result.events.length, 2)
  assert.equal(result.reviewCandidates.length, 1)
  assert.equal(result.reviewCandidates[0].nativeEvent.id, native.id)
  assert.equal(result.reviewCandidates[0].outlookEvent.id, outlook.id)
})

test('same-title events at different times are neither merged nor flagged', () => {
  const native = calendarEvent()
  const outlook = calendarEvent({ id: 'later-outlook', start_at: '2026-08-24T08:00:00Z', end_at: '2026-08-24T09:00:00Z', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'later-id' })

  const result = reconcileCalendarLogicalItems([native, outlook], [])

  assert.equal(result.events.length, 2)
  assert.equal(result.reviewCandidates.length, 0)
})

test('Planner projection is suppressed only by an explicit linked task id', () => {
  const linkedEvent = calendarEvent({ linked_task_id: 'task-linked' })
  const tasks = [
    { id: 'task-linked', title: 'Different title' },
    { id: 'task-unlinked', title: linkedEvent.title },
  ]

  const withEventLayer = reconcileCalendarLogicalItems([linkedEvent], tasks)
  const taskLayerOnly = reconcileCalendarLogicalItems([], tasks)

  assert.deepEqual(withEventLayer.tasks.map(task => task.id), ['task-unlinked'])
  assert.deepEqual(taskLayerOnly.tasks.map(task => task.id), ['task-linked', 'task-unlinked'])
})

test('a new Outlook create is blocked when a native lookalike requires review', () => {
  const source = outlookSource()
  const nativeRows = [{
    id: 'event-native',
    updatedAt: '2026-07-06T18:32:29.886Z',
    title: source.title,
    startAt: source.startDate,
    endAt: source.endDate,
    allDay: false,
  }]

  const item = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), undefined, new Map(), nativeRows)[0]

  assert.equal(item.reconciliationAction, 'conflict')
  assert.equal(item.conflictCode, 'possible_calendar_duplicate')
  assert.equal(item.existingTargetId, 'event-native')
  assert.match(item.sourceHash, /^fnv1a-/)
})

test('an exact Outlook source target takes precedence and repeat sync stays unchanged', () => {
  const source = outlookSource()
  const created = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set())[0]
  const target = {
    destination: 'cg_calendar',
    id: 'event-outlook',
    updatedAt: '2026-07-25T20:35:58.566Z',
    microsoftLastSyncedAt: '2026-07-25T20:00:00Z',
    microsoftSourceHash: created.sourceHash,
    microsoftSourceRemovedAt: null,
    microsoftCalendarId: source.sourceCalendarId,
    microsoftEventId: source.sourceEventId,
    payload: created.proposedPayload,
  }
  const nativeRows = [{ id: 'event-native', updatedAt: '2026-07-06T18:32:29.886Z', title: source.title, startAt: source.startDate, endAt: source.endDate, allDay: false }]

  const item = buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set(), undefined, new Map(), nativeRows)[0]

  assert.equal(item.reconciliationAction, 'unchanged')
  assert.equal(item.existingTargetId, 'event-outlook')
})

test('explicit separate-event approval survives failed-action recovery', () => {
  const source = outlookSource()
  const nativeRows = [{ id: 'event-native', updatedAt: '2026-07-06T18:32:29.886Z', title: source.title, startAt: source.startDate, endAt: source.endDate, allDay: false }]
  const conflict = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), undefined, new Map(), nativeRows)[0]
  const approved = approveCalendarDuplicateAsSeparate(conflict)
  const reviewed = getMicrosoftReviewedItems([approved], false)
  const audit = [{ key: reviewed[0].key, resultStatus: 'failed', safeError: 'Temporary failure' }]

  const recovery = buildMicrosoftRecoveryPlan(reviewed, [conflict], audit)

  assert.equal(reviewed[0].calendarDuplicateReviewed, true)
  assert.equal(recovery.blocked.length, 0)
  assert.equal(recovery.retryItems[0].reconciliationAction, 'create')
  assert.equal(recovery.retryItems[0].calendarDuplicateReviewed, true)
})

test('the repair migration is manager-only, audited, and non-destructive', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260809120000_calendar_outlook_identity.sql', import.meta.url), 'utf8')

  assert.match(sql, /if not public\.is_manager\(\)/)
  assert.match(sql, /superseded_by_profile_id = auth\.uid\(\)/)
  assert.match(sql, /superseded_at = now\(\)/)
  assert.match(sql, /revoke insert, update on public\.company_calendar_events from authenticated/)
  assert.match(sql, /manager update[\s\S]+superseded_by_event_id is null/)
  assert.match(sql, /manager delete[\s\S]+superseded_by_event_id is null/)
  assert.match(sql, /alter view public\.planner_tasks_canonical set \(security_invoker = true\)/)
  assert.match(sql, /guideline_row_key text/)
  assert.match(sql, /Africa\/Johannesburg/)
  assert.doesNotMatch(sql, /delete\s+from\s+public\.company_calendar_events/i)
})
