import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { businessDayBoundaryIso } from '../src/lib/businessTime.ts'

const page = readFileSync('src/pages/admin/CompanyCalendarPage.tsx', 'utf8')
const part = page.slice(page.indexOf('function eventEndTimestamp('), page.indexOf('function monthDates('))
const code = ts.transpileModule(part, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const occurs = new Function('businessDayBoundaryIso', `${code};return eventOccursOnDate`)(businessDayBoundaryIso)

test('actual calendar respects exclusive all-day end, not a duplicated next-day meeting', () => {
  const event = { start_at: '2026-10-19T22:00:00Z', end_at: '2026-10-20T22:00:00Z', all_day: true }
  assert.equal(occurs(event, '2026-10-19'), false)
  assert.equal(occurs(event, '2026-10-20'), true)
  assert.equal(occurs(event, '2026-10-21'), false)
})

test('multi-day all-day and cross-month timed meetings retain exact SAST overlap', () => {
  const allDay = { start_at: '2026-09-29T22:00:00Z', end_at: '2026-10-01T22:00:00Z', all_day: true }
  assert.equal(occurs(allDay, '2026-09-30'), true)
  assert.equal(occurs(allDay, '2026-10-01'), true)
  assert.equal(occurs(allDay, '2026-10-02'), false)
  const timed = { start_at: '2026-09-30T21:30:00Z', end_at: '2026-09-30T22:30:00Z', all_day: false }
  assert.equal(occurs(timed, '2026-09-30'), true)
  assert.equal(occurs(timed, '2026-10-01'), true)
  assert.equal(occurs(timed, '2026-10-02'), false)
})
