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
let readCompanyEventsWithSupersessionFallback
let resolveMicrosoftCalendarRowsWithFallback

const context = { clients: [], boards: [], buckets: [], packages: [], templates: [] }

function calendarEvent(overrides = {}) {
  return {
    id: 'event-native',
    title: 'MEETING - CG INTERNAL',
    start_at: '2026-08-24T06:00:00.000Z',
    end_at: '2026-08-24T07:00:00.000Z',
    all_day: false,
    status: 'planned',
    location: null,
    client_id: null,
    client_name: null,
    notes: null,
    assigned_to_name: null,
    linked_deliverable_id: null,
    linked_task_id: null,
    microsoft_calendar_id: null,
    microsoft_event_id: null,
    microsoft_last_synced_at: null,
    updated_at: '2026-07-06T18:32:29.886Z',
    ...overrides,
  }
}

function unlinkedCalendarRow(source = outlookSource(), overrides = {}) {
  return {
    id: 'event-native',
    updatedAt: '2026-07-06T18:32:29.886Z',
    title: source.title,
    startAt: source.startDate,
    endAt: null,
    allDay: false,
    status: 'planned',
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
  ;({ readCompanyEventsWithSupersessionFallback } = await server.ssrLoadModule('/src/lib/companyCalendar.ts'))
  ;({ resolveMicrosoftCalendarRowsWithFallback } = await server.ssrLoadModule('/src/lib/microsoftImportData.ts'))
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

test('different immutable Outlook ids at the same title and time never collapse', () => {
  const first = calendarEvent({ id: 'outlook-1', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'immutable-1' })
  const second = calendarEvent({ id: 'outlook-2', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'immutable-2' })

  const result = reconcileCalendarLogicalItems([first, second], [])

  assert.equal(result.events.length, 2)
  assert.equal(result.reviewCandidates.length, 0)
})

test('native and Outlook lookalikes remain separate review candidates', () => {
  const native = calendarEvent({ end_at: null })
  const outlook = calendarEvent({ id: 'event-outlook', location: 'CG STUDIO', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'outlook-event-24-aug' })

  const result = reconcileCalendarLogicalItems([native, outlook], [])

  assert.equal(result.events.length, 2)
  assert.equal(result.reviewCandidates.length, 1)
  assert.equal(result.reviewCandidates[0].nativeEvent.id, native.id)
  assert.equal(result.reviewCandidates[0].outlookEvent.id, outlook.id)
  assert.equal(result.reviewCandidates[0].nativeEvent.end_at, null)
  assert.equal(result.reviewCandidates[0].outlookEvent.end_at, '2026-08-24T07:00:00.000Z')
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
  const nativeRows = [unlinkedCalendarRow(source)]

  const item = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), undefined, new Map(), nativeRows)[0]

  assert.equal(item.reconciliationAction, 'conflict')
  assert.equal(item.conflictCode, 'possible_calendar_duplicate')
  assert.equal(item.existingTargetId, 'event-native')
  assert.match(item.sourceHash, /^fnv1a-/)
})

test('cancelled native history does not block an active Outlook create', () => {
  const source = outlookSource()
  const item = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), undefined, new Map(), [unlinkedCalendarRow(source, { status: 'cancelled' })])[0]

  assert.equal(item.reconciliationAction, 'create')
  assert.equal(item.conflictCode, null)
})

test('cancelled Outlook history is not a replacement candidate for an active native event', () => {
  const native = calendarEvent()
  const cancelledOutlook = calendarEvent({ id: 'cancelled-outlook', status: 'cancelled', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'cancelled-id' })
  const logical = reconcileCalendarLogicalItems([native, cancelledOutlook], [])
  const source = outlookSource({ cancelled: true })
  const imported = buildMicrosoftReconciliation(snapshot([source]), context, [], new Set(), undefined, new Map(), [unlinkedCalendarRow(source)])[0]

  assert.equal(logical.events.length, 2)
  assert.equal(logical.reviewCandidates.length, 0)
  assert.equal(imported.conflictCode, null)
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
  const nativeRows = [unlinkedCalendarRow(source)]

  const item = buildMicrosoftReconciliation(snapshot([source]), context, [target], new Set(), undefined, new Map(), nativeRows)[0]

  assert.equal(item.reconciliationAction, 'unchanged')
  assert.equal(item.existingTargetId, 'event-outlook')
})

test('explicit separate-event approval survives failed-action recovery', () => {
  const source = outlookSource()
  const nativeRows = [unlinkedCalendarRow(source)]
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

test('calendar reads use the canonical supersession filter when the migration exists', async () => {
  const rows = [calendarEvent()]
  let legacyReads = 0
  const result = await readCompanyEventsWithSupersessionFallback(
    async () => ({ data: rows, error: null }),
    async () => { legacyReads += 1; return { data: [], error: null } },
  )

  assert.equal(result.tableMissing, false)
  assert.equal(result.supersessionMigrationNeeded, false)
  assert.deepEqual(result.data, rows)
  assert.equal(legacyReads, 0)
})

test('missing supersession column falls back to legacy events without blanking Calendar', async () => {
  const rows = [calendarEvent()]
  const result = await readCompanyEventsWithSupersessionFallback(
    async () => ({ data: null, error: { code: '42703', message: 'column company_calendar_events.superseded_by_event_id does not exist' } }),
    async () => ({ data: rows, error: null }),
  )

  assert.equal(result.tableMissing, false)
  assert.equal(result.error, null)
  assert.equal(result.supersessionMigrationNeeded, true)
  assert.deepEqual(result.data, rows)
})

test('an actually missing company calendar table retains tableMissing behavior', async () => {
  let legacyReads = 0
  const result = await readCompanyEventsWithSupersessionFallback(
    async () => ({ data: null, error: { code: '42P01', message: 'relation public.company_calendar_events does not exist' } }),
    async () => { legacyReads += 1; return { data: [], error: null } },
  )

  assert.equal(result.tableMissing, true)
  assert.equal(result.supersessionMigrationNeeded, false)
  assert.equal(legacyReads, 0)
})

test('Microsoft identity preview retains legacy calendar rows while migration-gated', async () => {
  const rows = [{ id: 'outlook-existing', microsoft_calendar_id: 'calendar-1', microsoft_event_id: 'immutable-1', status: 'planned' }]
  const resolved = await resolveMicrosoftCalendarRowsWithFallback(
    { data: [], error: { code: 'PGRST204', message: "Could not find the 'superseded_by_event_id' column in the schema cache" } },
    async () => ({ data: rows, error: null }),
  )

  assert.equal(resolved.migrationNeeded, true)
  assert.deepEqual(resolved.result.data, rows)
})

test('Microsoft fallback does not disguise an actually missing calendar table', async () => {
  let legacyReads = 0
  const error = { code: '42P01', message: 'relation public.company_calendar_events does not exist' }
  const resolved = await resolveMicrosoftCalendarRowsWithFallback(
    { data: [], error },
    async () => { legacyReads += 1; return { data: [], error: null } },
  )

  assert.equal(resolved.migrationNeeded, false)
  assert.equal(resolved.result.error, error)
  assert.equal(legacyReads, 0)
})

test('the repair migration is manager-only, audited, and non-destructive', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20260809120000_calendar_outlook_identity.sql', import.meta.url), 'utf8')
  const calendarPage = await readFile(new URL('../src/pages/admin/CompanyCalendarPage.tsx', import.meta.url), 'utf8')
  const calendarData = await readFile(new URL('../src/lib/companyCalendar.ts', import.meta.url), 'utf8')

  assert.match(sql, /if not public\.is_active_planner_manager\(\)/)
  assert.match(sql, /superseded_by_profile_id = auth\.uid\(\)/)
  assert.match(sql, /superseded_at = now\(\)/)
  assert.match(sql, /p_expected_outlook_updated_at timestamptz/)
  assert.match(sql, /v_outlook\.updated_at is distinct from p_expected_outlook_updated_at/)
  assert.match(sql, /v_native\.status = 'cancelled' or v_outlook\.status = 'cancelled'/)
  assert.doesNotMatch(sql, /v_native\.end_at is distinct from v_outlook\.end_at/)
  assert.match(sql, /v_native\.event_type = 'content_run' or v_outlook\.event_type = 'content_run'/)
  assert.match(sql, /public\.content_runs where calendar_event_id in \(v_native\.id, v_outlook\.id\)/)
  assert.match(sql, /Linked Content Run requires manual relationship review/)
  assert.match(sql, /public\.meeting_debriefs where calendar_event_id in \(v_native\.id, v_outlook\.id\)/)
  assert.match(sql, /v_native\.linked_deliverable_id is not null or v_native\.linked_task_id is not null[\s\S]+v_outlook\.linked_deliverable_id is not null or v_outlook\.linked_task_id is not null/)
  assert.match(sql, /set client_id = coalesce\(v_outlook\.client_id, v_native\.client_id\)/)
  assert.match(sql, /Conflicting client links require manual review/)
  assert.match(sql, /Conflicting calendar notes require manual review/)
  assert.match(sql, /Conflicting calendar assignees require manual review/)
  assert.match(sql, /Conflicting calendar event types require manual review/)
  assert.match(sql, /Conflicting calendar statuses require manual review/)
  assert.match(sql, /revoke insert, update on public\.company_calendar_events from authenticated/)
  assert.match(sql, /manager update[\s\S]+superseded_by_event_id is null/)
  assert.match(sql, /manager delete[\s\S]+superseded_by_event_id is null/)
  assert.match(sql, /alter view public\.planner_tasks_canonical set \(security_invoker = true\)/)
  assert.match(sql, /guideline_row_key text/)
  assert.match(sql, /Africa\/Johannesburg/)
  assert.doesNotMatch(sql, /delete\s+from\s+public\.company_calendar_events/i)
  assert.match(calendarPage, /disabled=\{supersessionMigrationNeeded \|\| resolvingCandidateId/)
  assert.match(calendarPage, /Calendar events are available in legacy mode/)
  assert.match(calendarData, /query = query\.is\('superseded_by_event_id', null\)/)
  assert.match(calendarData, /readCompanyEventsWithSupersessionFallback\(\(\) => read\(true\), \(\) => read\(false\)\)/)
})
