import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const calendar = readFileSync(new URL('../src/pages/admin/CompanyCalendarPage.tsx', import.meta.url), 'utf8')
const schedule = readFileSync(new URL('../src/pages/admin/ClientSchedulePage.tsx', import.meta.url), 'utf8')

test('CG Calendar keeps the optional Planner layer and event-type filter together', () => {
  const controls = calendar.slice(calendar.indexOf('{/* Events are the default calendar.'), calendar.indexOf('{supersessionMigrationNeeded &&'))
  assert.match(controls, /checked=\{layers\.events\}/)
  assert.match(controls, /checked=\{layers\.tasks\}/)
  assert.match(controls, /value=\{filter\}/)
  assert.match(controls, /filterTabs\.map/)
  assert.match(calendar, /aria-pressed=\{viewMode === option\}/)
})

test('Client Schedule keeps its own deliverable views and client-ready calendar link', () => {
  assert.match(schedule, /aria-pressed=\{view === option\}/)
  assert.match(schedule, /\/admin\/client-calendar\?month=/)
  assert.doesNotMatch(calendar, /monthly_deliverables/)
})
