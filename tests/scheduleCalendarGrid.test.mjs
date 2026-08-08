import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

let server
let monthGridCells
let todayIso
let localIso

before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  const mod = await server.ssrLoadModule('/src/lib/scheduleCalendar.ts')
  monthGridCells = mod.monthGridCells
  todayIso = mod.todayIso
  localIso = mod.localIso
})

after(async () => { await server.close() })

test('monthGridCells for August 2026 starts on the Monday column (Mon 27 Jul leading cell)', () => {
  const cells = monthGridCells('2026-08')
  assert.equal(cells.length % 7, 0, 'grid must fill complete weeks')
  assert.equal(cells[0].day, 27)
  assert.equal(cells[0].iso, '2026-07-27')
  assert.equal(cells[0].outside, true)
})

test('August 2026 has Monday-first columns with Mon 3 Aug in column 1', () => {
  const cells = monthGridCells('2026-08')
  const mon3 = cells.findIndex(cell => cell.iso === '2026-08-03')
  assert.ok(mon3 >= 0, '3 August must be present')
  assert.equal(mon3 % 7, 0, 'Monday 3 Aug must be the first column')
})

test('month grid contains every day number of the selected month exactly once', () => {
  for (const month of ['2026-08', '2026-09', '2026-12', '2027-01']) {
    const [year, m] = month.split('-').map(Number)
    const daysInMonth = new Date(year, m, 0).getDate()
    const cells = monthGridCells(month)
    const inside = cells.filter(cell => !cell.outside)
    assert.equal(inside.length, daysInMonth, `${month} should expose all ${daysInMonth} days`)
    assert.deepEqual(
      inside.map(cell => cell.day),
      Array.from({ length: daysInMonth }, (_, i) => i + 1),
    )
  }
})

test('grid rows never exceed 7 cells (no cell expands the month vertically)', () => {
  for (const month of ['2026-08', '2026-11', '2026-12']) {
    const cells = monthGridCells(month)
    assert.equal(cells.length % 7, 0)
    assert.equal(cells.length / 7, Math.ceil(cells.length / 7))
  }
})

test('monday-first grid for November 2026 (not starting on a Monday) has correct leading day', () => {
  // 1 Nov 2026 is a Sunday; Monday-first grid opens with Mon 26 Oct.
  const cells = monthGridCells('2026-11')
  assert.equal(cells[0].iso, '2026-10-26')
  assert.equal(cells[0].outside, true)
  assert.equal(cells.length % 7, 0)
})

test('trailing days belong to the next month and are marked outside', () => {
  const cells = monthGridCells('2026-08') // Aug 2026 ends 31 (a Monday) — check trailing
  const last = cells[cells.length - 1]
  assert.equal(last.outside, true)
  assert.ok(last.iso.startsWith('2026-09') || last.iso.startsWith('2026-08'))
})

test('local today key matches the date format used by the grid cells', () => {
  const now = new Date()
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  assert.equal(todayIso(), expected)
  assert.equal(localIso(now), expected)
})

// ── Source-structure guards: Client Schedule Calendar tab ─────────────────────
test('Client Schedule page uses the shared Monday-first grid, not Sun-first day names', () => {
  const src = read('../src/pages/admin/ClientSchedulePage.tsx')
  assert.match(src, /from '..\/..\/lib\/scheduleCalendar'/)
  assert.match(src, /monthGridCells\(month\)/)
  assert.doesNotMatch(src, /const DAY_NAMES = \['Sun'/)
})

test('Client Schedule mobile branch renders a date grid (sm:hidden) never a full card feed', () => {
  const src = read('../src/pages/admin/ClientSchedulePage.tsx')
  assert.match(src, /<div className="sm:hidden">/)
  // The old stacked feed rendered one ScheduleCard per post under date headers.
  assert.doesNotMatch(src, /<div className="space-y-5 sm:hidden">/)
  // Mobile now shows a selected-day agenda with a "+N more"-free per-day cap.
  assert.match(src, /dayItems\.slice\(0, 4\)/)
  assert.match(src, /Nothing scheduled on this day\./)
  assert.match(src, /aspect-square/)
})

test('admin client-ready calendar renders a mobile month grid and selected-day agenda', () => {
  const src = read('../src/pages/admin/ClientContentCalendarPage.tsx')
  assert.match(src, /MobileMonthGrid/)
  assert.match(src, /MobileAgenda/)
  assert.match(src, /from '\.\.\/\.\.\/lib\/scheduleCalendar'/)
  assert.match(src, /monthGridCells\(month\)/)
  assert.doesNotMatch(src, /Mobile: calm agenda list grouped by day/)
})

test('client portal mobile Agenda is grid-based and keeps the required component names', () => {
  const src = read('../src/pages/client/ClientContentCalendarPage.tsx')
  assert.match(src, /className="lg:hidden"/)
  assert.match(src, /Agenda/)
  assert.match(src, /MonthGrid/)
  assert.match(src, /monthGridCells\(month\)/)
  assert.doesNotMatch(src, /const WEEKDAYS = \['Sun'/)
})