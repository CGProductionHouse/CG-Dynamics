import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Unifying the existing CG Calendar Content Runs with the Content Workflow.
// Pure rules load through a Vite SSR server (no Supabase import, nothing hits
// the network). The migration and data-layer/UI contracts are validated by
// parsing the source files. No database is touched.

let server
let rules

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  rules = await server.ssrLoadModule('/src/lib/contentWorkflowRules.ts')
})
after(async () => { await server?.close() })

const SQL = readFileSync(new URL('../supabase/phase-19f-unify-content-runs.sql', import.meta.url), 'utf8')
const DATA = readFileSync(new URL('../src/lib/contentWorkflow.ts', import.meta.url), 'utf8')
const RUN_PAGE = readFileSync(new URL('../src/pages/admin/ContentWorkflowPage.tsx', import.meta.url), 'utf8')
const CAL_PAGE = readFileSync(new URL('../src/pages/admin/CompanyCalendarPage.tsx', import.meta.url), 'utf8')

// ── 1. Existing calendar runs backfill (once) into content_runs ───────────────

test('migration backfills existing non-cancelled content_run calendar events', () => {
  assert.match(SQL, /insert into public\.content_runs/)
  assert.match(SQL, /from public\.company_calendar_events e/)
  assert.match(SQL, /e\.event_type\s*=\s*'content_run'/)
  assert.match(SQL, /e\.status\s*<>\s*'cancelled'/)
  // Title -> name, assigned_to_name -> lead, and the calendar event is linked.
  assert.match(SQL, /e\.title/)
  assert.match(SQL, /e\.assigned_to_name/)
  assert.match(SQL, /calendar_event_id/)
})

test('backfill maps calendar status conservatively to the run lifecycle', () => {
  assert.match(SQL, /when 'planned'\s+then 'planning'/)
  assert.match(SQL, /when 'confirmed'\s+then 'ready'/)
  assert.match(SQL, /when 'completed'\s+then 'completed'/)
})

// ── 2. Migration rerun is idempotent (no duplicate runs) ──────────────────────

test('migration is idempotent and never creates duplicate runs on rerun', () => {
  assert.match(SQL, /add column if not exists calendar_event_id/)
  assert.match(SQL, /create unique index if not exists uniq_content_run_calendar_event/)
  // The backfill is guarded so a second run inserts nothing.
  assert.match(SQL, /not exists\s*\(\s*select 1 from public\.content_runs cr\s*where cr\.calendar_event_id = e\.id/)
})

test('the FK is on delete set null so removing an event never hard-deletes a run', () => {
  assert.match(SQL, /calendar_event_id uuid\s*\n?\s*references public\.company_calendar_events\(id\) on delete set null/)
})

// ── 3. Existing (July) calendar events surface via the Johannesburg day ───────

test('run_date and start_time use the Johannesburg business day/time', () => {
  assert.match(SQL, /\(e\.start_at at time zone 'Africa\/Johannesburg'\)::date/)
  assert.match(SQL, /\(e\.start_at at time zone 'Africa\/Johannesburg'\)::time/)
})

test('a calendar event links to at most one non-cancelled run (unique partial index)', () => {
  assert.match(SQL, /on public\.content_runs \(calendar_event_id\)\s*\n?\s*where calendar_event_id is not null and status <> 'cancelled'/)
})

// ── 4 & 5. Creating a workflow run creates exactly one linked calendar event ──

test('creating a CG run also creates one linked content_run calendar event', () => {
  assert.match(DATA, /export async function createRunWithCalendarEvent/)
  assert.match(DATA, /createCompanyEvent\(\{[\s\S]*?event_type:\s*'content_run'/)
  // The run is linked to the created event.
  assert.match(DATA, /createRun\(\{\s*\.\.\.input,\s*calendar_event_id:\s*eventResult\.data\.id\s*\}\)/)
  // On run-insert failure the event is cancelled (not left as a duplicate, not hard-deleted).
  assert.match(DATA, /updateCompanyEvent\(eventResult\.data\.id,\s*\{\s*status:\s*'cancelled'\s*\}\)/)
})

test('the run create page uses the linked-event create path, not a bare createRun', () => {
  assert.match(RUN_PAGE, /createRunWithCalendarEvent/)
  assert.doesNotMatch(RUN_PAGE, /\bcreateRun\b(?!WithCalendarEvent)/)
})

// ── 6. Microsoft-owned calendar fields are protected ──────────────────────────

test('isMicrosoftOwnedEvent detects Outlook-sourced events', () => {
  assert.equal(rules.isMicrosoftOwnedEvent({ microsoft_source_type: 'outlook_event' }), true)
  assert.equal(rules.isMicrosoftOwnedEvent({ microsoft_event_id: 'abc' }), true)
  assert.equal(rules.isMicrosoftOwnedEvent({ microsoft_source_type: null, microsoft_event_id: null }), false)
  assert.equal(rules.isMicrosoftOwnedEvent(null), false)
})

test('calendar-owned fields are read-only for Microsoft-owned runs', () => {
  const ms = { microsoft_source_type: 'outlook_event' }
  for (const field of ['name', 'run_date', 'start_time', 'location', 'client_id', 'status']) {
    assert.equal(rules.canEditRunFieldInWorkflow(field, ms), false, `${field} must be read-only for Microsoft events`)
  }
})

test('the data layer never writes calendar fields back to a Microsoft-owned event', () => {
  assert.match(DATA, /export async function updateRunLinked/)
  assert.match(DATA, /isMicrosoftOwnedEvent\(event\)/)
  // When the event is Microsoft-owned, the run is updated but the calendar is untouched.
  assert.match(DATA, /if \(!event \|\| isMicrosoftOwnedEvent\(event\)\) return runResult/)
})

// ── 7. Operational fields remain editable ─────────────────────────────────────

test('operational fields stay editable regardless of calendar ownership', () => {
  const ms = { microsoft_source_type: 'outlook_event' }
  for (const field of ['lead_name', 'lead_user_id', 'helper_names', 'internal_notes']) {
    assert.equal(rules.canEditRunFieldInWorkflow(field, ms), true, `${field} must stay editable`)
  }
})

// ── 8. Calendar filtering/counts are unchanged ────────────────────────────────

test('CG Calendar still counts and filters content_run events unchanged', () => {
  assert.match(CAL_PAGE, /content_run:\s*active\.filter\(e => e\.event_type === 'content_run'\)\.length/)
  assert.match(CAL_PAGE, /active\.filter\(e => e\.event_type === filter\)/)
})

test('the Open Content Run link deep-links to the runs tab by calendar event id', () => {
  assert.match(CAL_PAGE, /event\.event_type === 'content_run'/)
  assert.match(CAL_PAGE, /\/admin\/content-workflow\?tab=runs&event=\$\{event\.id\}/)
})

// ── Status mapping round-trips ────────────────────────────────────────────────

test('run/calendar status maps are consistent both ways', () => {
  assert.equal(rules.mapCalendarStatusToRun('planned'), 'planning')
  assert.equal(rules.mapCalendarStatusToRun('confirmed'), 'ready')
  assert.equal(rules.mapCalendarStatusToRun('completed'), 'completed')
  assert.equal(rules.mapCalendarStatusToRun('cancelled'), 'cancelled')
  assert.equal(rules.mapRunStatusToCalendar('planning'), 'planned')
  assert.equal(rules.mapRunStatusToCalendar('ready'), 'confirmed')
  assert.equal(rules.mapRunStatusToCalendar('in_progress'), 'confirmed')
  assert.equal(rules.mapRunStatusToCalendar('captured'), 'confirmed')
  assert.equal(rules.mapRunStatusToCalendar('processing'), 'confirmed')
  assert.equal(rules.mapRunStatusToCalendar('completed'), 'completed')
  assert.equal(rules.mapRunStatusToCalendar('cancelled'), 'cancelled')
})
