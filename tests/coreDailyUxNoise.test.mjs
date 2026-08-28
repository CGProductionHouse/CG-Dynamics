import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const states = read('../src/components/ui/States.tsx')
const hub = read('../src/pages/admin/CgHubPage.tsx')
const work = read('../src/pages/admin/MyWorkPage.tsx')
const opsHub = read('../src/pages/admin/OpsHubPage.tsx')
const planner = read('../src/pages/admin/PlannerPage.tsx')
const commandCentre = read('../src/pages/admin/CommandCentrePage.tsx')
const calendar = read('../src/pages/admin/CompanyCalendarPage.tsx')
const schedule = read('../src/pages/admin/ClientSchedulePage.tsx')
const taskDrawer = read('../src/components/operations/TaskDetailDrawer.tsx')

test('ordinary no-result states can use the compact shared treatment', () => {
  assert.match(states, /compact\?: boolean/)
  assert.match(states, /compact \? 'px-4 py-3'/)
  for (const source of [work, planner, commandCentre, calendar, schedule]) {
    assert.match(source, /<EmptyState[\s\S]*?\bcompact\b/)
  }
})

test('Hub does not repeat Today Focus metrics above the same work cards', () => {
  assert.doesNotMatch(hub, /HubMetricCard/)
  assert.doesNotMatch(hub, /What needs your attention/)
  assert.doesNotMatch(hub, /Package deliverables and schedule/)
  assert.match(hub, /title="Today Focus"/)
  assert.match(hub, /title="Production Schedule"/)
})

test('Work and Planner remove duplicate framing and internal import terminology', () => {
  assert.doesNotMatch(work, /Daily workflow/)
  assert.doesNotMatch(work, /Active Planner work across visible boards/)
  assert.doesNotMatch(opsHub, /Focused operations workspace/)
  assert.doesNotMatch(planner, /Imported identity:/)
  assert.match(planner, /Assignment review:/)
})

test('Daily Tasks keeps actions and ownership truth without a duplicate metric band', () => {
  assert.doesNotMatch(commandCentre, /function StatCard/)
  assert.doesNotMatch(commandCentre, /Today's work list/)
  assert.match(commandCentre, /Capture client request/)
  assert.match(commandCentre, /Morning List Import/)
  assert.match(commandCentre, /need assignment review/)
  assert.match(commandCentre, /assignment conflict/)
})

test('Calendar removes ordinary framing but preserves status and Outlook review evidence', () => {
  assert.doesNotMatch(calendar, /Meetings, shoots, content runs and internal events/)
  assert.doesNotMatch(calendar, /Tap a date to view its events/)
  assert.match(calendar, /CalendarDiagnostics/)
  assert.match(calendar, /possible duplicate/)
  assert.match(calendar, /Use Outlook record/)
  assert.match(calendar, /supersessionMigrationNeeded/)
})

test('Calendar status never renders raw backend errors or implementation diagnostics', () => {
  for (const rawError of ['eventError', 'taskError', 'recurrenceError']) {
    assert.doesNotMatch(calendar, new RegExp(`<p[^>]*>[^<]*\\{${rawError}\\}<\\/p>`))
  }
  for (const oldCopy of ['query error', 'materialisation error', 'Calendar diagnostics', 'Empty layer this month']) {
    assert.ok(!calendar.includes(oldCopy), `${oldCopy} must not return to rendered Calendar copy`)
  }
  assert.match(calendar, /Calendar status/)
  assert.match(calendar, /Calendar events could not be loaded\./)
  assert.match(calendar, /Dated tasks could not be loaded\./)
  assert.match(calendar, /Recurring tasks could not be refreshed\./)
  assert.match(calendar, /No calendar events this month\./)
  assert.match(calendar, /No dated tasks this month\./)
})

test('ordinary rendered copy hides implementation setup mechanisms', () => {
  assert.doesNotMatch(hub, /CG Calendar setup needed\. Run phase-/)
  assert.match(hub, /CG Calendar setup is required\./)

  assert.doesNotMatch(planner, /Planner tables not set up yet/)
  assert.doesNotMatch(planner, /Run the Planner migrations/)
  assert.doesNotMatch(planner, /Create or seed a Planner board/)
  assert.match(planner, /title=\{tableMissing \? 'Work setup required'/)
  assert.match(planner, /message=\{tableMissing \? 'Planner is not available yet\.'/)

  assert.doesNotMatch(schedule, /July shadow-run/)
  assert.match(schedule, /Some dates were imported from Teams and still need review\./)

  assert.doesNotMatch(commandCentre, /Run the phase-[^']+/)
  assert.doesNotMatch(commandCentre, /After migration/)
  assert.doesNotMatch(commandCentre, /request linking is migrated/)
  assert.match(commandCentre, /Daily Tasks is not available yet\./)

  assert.doesNotMatch(calendar, /Company calendar SQL not applied/)
  assert.doesNotMatch(calendar, /Apply `supabase\/phase-/)
  assert.doesNotMatch(calendar, /supersession migration is applied/)
  assert.match(calendar, /Calendar duplicate resolution is not available yet\./)

  assert.doesNotMatch(opsHub, /Database-protected/)
  assert.match(opsHub, /Only admin and manager roles can view or edit these records\./)
})

test('Client Schedule hides implementation terms while preserving all operational views and review', () => {
  assert.doesNotMatch(schedule, /· monthly_deliverables/)
  assert.doesNotMatch(schedule, /Calendar shows all/)
  assert.doesNotMatch(schedule, /Year overview shows all/)
  assert.doesNotMatch(schedule, /Schedule date is when a post is planned/)
  for (const label of ['Grid', 'Calendar', 'Board', 'Charts', 'Year overview']) {
    assert.ok(schedule.includes(label), `${label} view must remain available`)
  }
  assert.match(schedule, /ScheduleReviewSection/)
  assert.match(schedule, /hasLegacyDates/)
})

test('task drawer keeps the unsaved warning and request state without redundant detail', () => {
  assert.match(taskDrawer, /Unsaved changes/)
  assert.match(taskDrawer, /Keep editing/)
  assert.match(taskDrawer, /Discard/)
  assert.match(taskDrawer, /Request state:/)
  assert.doesNotMatch(taskDrawer, /What would you like to do/)
  assert.doesNotMatch(taskDrawer, /task\.source &&/)
})
