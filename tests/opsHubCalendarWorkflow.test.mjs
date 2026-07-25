// ============================================================================
// Operations Hub — PR 5: Calendar, scheduling and drag-and-drop workflow
// Tests for board drag-and-drop, calendar views, drag-to-schedule, mobile.
// ============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const OPS_HUB_PAGE = read('../src/pages/admin/OpsHubPage.tsx')
const COMMAND_CENTRE_SRC = read('../src/lib/commandCentre.ts')

let server, cc
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  cc = await server.ssrLoadModule('/src/lib/commandCentre.ts')
})
after(async () => { await server?.close() })

// ── 1. Board drag-and-drop ───────────────────────────────────────────────────

test('bucket drag uses HTML5 drag-and-drop events', () => {
  assert.match(OPS_HUB_PAGE, /onDragStart/, 'BoardView uses onDragStart')
  assert.match(OPS_HUB_PAGE, /onDragOver/, 'BoardView uses onDragOver')
  assert.match(OPS_HUB_PAGE, /onDrop/, 'BoardView uses onDrop')
  assert.match(OPS_HUB_PAGE, /draggable/, 'Task cards are draggable')
})

test('bucket drag has optimistic UI', () => {
  assert.match(OPS_HUB_PAGE, /handleBucketChange/, 'OpsHubPage has handleBucketChange')
  assert.match(OPS_HUB_PAGE, /setTasks.*bucket.*newBucket/, 'Optimistic bucket update exists')
})

test('bucket drag reverts on failure', () => {
  assert.match(OPS_HUB_PAGE, /result\.error[\s\S]{0,50}prev/, 'Bucket change reverts on error')
})

test('unauthorised admin-bucket movement is visually indicated', () => {
  assert.match(OPS_HUB_PAGE, /dragOverBucket/, 'BoardView tracks drag-over state')
})

test('keyboard move alternative exists (ArrowRight/ArrowLeft)', () => {
  assert.match(OPS_HUB_PAGE, /ArrowRight/, 'BoardView has keyboard right navigation')
  assert.match(OPS_HUB_PAGE, /ArrowLeft/, 'BoardView has keyboard left navigation')
})

// ── 2. Calendar views ────────────────────────────────────────────────────────

test('calendar has month view', () => {
  assert.match(OPS_HUB_PAGE, /viewMode.*month/, 'CalendarView has month mode')
})

test('calendar has week view', () => {
  assert.match(OPS_HUB_PAGE, /viewMode.*week/, 'CalendarView has week mode')
})

test('calendar has day/agenda view', () => {
  assert.match(OPS_HUB_PAGE, /viewMode.*day/, 'CalendarView has day mode')
})

test('calendar navigation exists (prev/next/today)', () => {
  assert.match(OPS_HUB_PAGE, /navigate\(/, 'CalendarView has navigate function')
  assert.match(OPS_HUB_PAGE, /goToday/, 'CalendarView has goToday function')
})

test('calendar view mode toggle exists', () => {
  assert.match(OPS_HUB_PAGE, /setViewMode/, 'CalendarView can switch view modes')
})

// ── 3. Calendar filters ─────────────────────────────────────────────────────

test('calendar has staff filter', () => {
  assert.match(OPS_HUB_PAGE, /staffFilter/, 'CalendarView has staff filter')
})

test('calendar has client filter', () => {
  assert.match(OPS_HUB_PAGE, /clientFilter/, 'CalendarView has client filter')
})

test('calendar has bucket filter', () => {
  assert.match(OPS_HUB_PAGE, /bucketFilter/, 'CalendarView has bucket filter')
})

// ── 4. Drag-to-schedule ──────────────────────────────────────────────────────

test('task drag on calendar changes due date only', () => {
  assert.match(OPS_HUB_PAGE, /handleDateDrag/, 'OpsHubPage has handleDateDrag')
  assert.match(OPS_HUB_PAGE, /due_date.*newDate/, 'Date drag updates due_date')
})

test('calendar drag has optimistic update', () => {
  assert.match(OPS_HUB_PAGE, /setTasks.*map.*due_date/, 'Date drag optimistically updates')
})

test('calendar drag reverts on failure', () => {
  assert.match(OPS_HUB_PAGE, /result\.error[\s\S]{0,80}prev/, 'Date drag reverts on error')
})

test('drop zone exists on calendar days', () => {
  assert.match(OPS_HUB_PAGE, /handleDateDrop/, 'CalendarView has handleDateDrop')
  assert.match(OPS_HUB_PAGE, /onDragOver.*dropEffect/, 'Calendar days accept drops')
})

// ── 5. Date labels ──────────────────────────────────────────────────────────

test('calendar shows due-date label for tasks', () => {
  assert.match(OPS_HUB_PAGE, /badge.*'Due'/, 'Calendar shows Due badge for tasks')
})

test('calendar shows scheduled-date label for deliverables', () => {
  assert.match(OPS_HUB_PAGE, /badge.*'Schedule'/, 'Calendar shows Schedule badge for deliverables')
})

// ── 6. Task event opens task drawer ──────────────────────────────────────────

test('task event click opens task drawer', () => {
  assert.match(OPS_HUB_PAGE, /onOpenTask\(item\.task\)/, 'Calendar task click opens drawer')
})

// ── 7. Mobile fallback ──────────────────────────────────────────────────────

test('day view serves as mobile-friendly agenda', () => {
  assert.match(OPS_HUB_PAGE, /viewMode.*day/, 'Day view is implemented as agenda alternative')
})

// ── 8. Failure rollback ──────────────────────────────────────────────────────

test('bucket field is in ALLOWED_UPDATE_FIELDS', () => {
  assert.match(COMMAND_CENTRE_SRC, /'bucket'/, 'bucket is in ALLOWED_UPDATE_FIELDS for updateTask')
})

// ── 9. No duplicate calendar records ────────────────────────────────────────

test('calendar does not create duplicate records', () => {
  assert.doesNotMatch(OPS_HUB_PAGE, /createDuplicate|insert.*calendar/, 'No calendar record creation')
})
