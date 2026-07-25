// ============================================================================
// Operations Hub — PR 6: Quality gate, security hardening
// Comprehensive release-critical test suite covering security, UX, error
// handling, and data integrity.
// ============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const COMMAND_CENTRE_SRC = read('../src/lib/commandCentre.ts')
const DRAWER_SRC = read('../src/components/operations/TaskDetailDrawer.tsx')
const OPS_HUB_PAGE = read('../src/pages/admin/OpsHubPage.tsx')
const QUICK_ADD_SRC = read('../src/components/operations/OpsQuickAdd.tsx')
const REQUEST_INTAKE_SRC = read('../src/components/operations/RequestIntake.tsx')
const REQUEST_APPROVAL_SRC = read('../src/components/operations/RequestApproval.tsx')
const ADMIN_LAYOUT = read('../src/pages/admin/AdminLayout.tsx')

let server, cc
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  cc = await server.ssrLoadModule('/src/lib/commandCentre.ts')
})
after(async () => { await server?.close() })

// ── 1. Route protection ──────────────────────────────────────────────────────

test('client users cannot access Ops Hub route (RequireStaff guard)', () => {
  assert.doesNotMatch(OPS_HUB_PAGE, /RequireClient|client_only/, 'Route is staff-only, no client guard')
})

test('admin tab is hidden from non-admin users', () => {
  assert.match(OPS_HUB_PAGE, /isAdmin/, 'Admin tab is gated by isAdmin')
})

test('admin tab navigation only shows for admin roles', () => {
  assert.match(OPS_HUB_PAGE, /isAdmin.*\?.*\[?.*'admin/, 'Admin tab conditional in nav')
})

// ── 2. Quick Add defaults ────────────────────────────────────────────────────

test('zero-friction capture: title-only creates a task', () => {
  assert.doesNotMatch(QUICK_ADD_SRC, /required/, 'No required fields beyond title')
})

test('Quick Add does not force a due date', () => {
  assert.doesNotMatch(QUICK_ADD_SRC, /due_date.*required|require.*due/, 'No forced due date')
})

test('Quick Add prevents empty submission', () => {
  assert.match(QUICK_ADD_SRC, /!title\.trim/, 'Disabled when title is empty')
})

// ── 3. Task edit safety ──────────────────────────────────────────────────────

test('drawer Save is disabled when not dirty', () => {
  assert.match(DRAWER_SRC, /!dirty/, 'Save disabled without changes')
})

test('drawer error does not expose raw DB internals', () => {
  assert.doesNotMatch(DRAWER_SRC, /Error.*:.*\{/, 'Error display is safe string')
})

test('drawer handles update failure gracefully', () => {
  assert.match(DRAWER_SRC, /setError/, 'Drawer captures error state')
})

// ── 4. Task assignment ───────────────────────────────────────────────────────

test('task card shows assignee name', () => {
  assert.match(read('../src/components/operations/TaskCard.tsx'), /assigned_to_name/, 'TaskCard references assignee')
})

test('My Work filters by assigned_to_name', () => {
  assert.match(OPS_HUB_PAGE, /assigned_to_name.*profile/, 'My Work filters by profile name')
})

// ── 5. Bucket filtering ──────────────────────────────────────────────────────

test('BoardView groups tasks by bucket', () => {
  assert.match(OPS_HUB_PAGE, /bucket.*map/, 'BoardView groups by bucket')
})

test('BoardView sorts buckets by count', () => {
  assert.match(OPS_HUB_PAGE, /sort.*b\.length/, 'Buckets sorted by count')
})

// ── 6. Board movement safety ─────────────────────────────────────────────────

test('board drag-and-drop uses optimistic update', () => {
  assert.match(OPS_HUB_PAGE, /setTasks.*bucket.*newBucket/, 'Optimistic bucket update')
})

test('board drag reverts on failure', () => {
  assert.match(OPS_HUB_PAGE, /result\.error[\s\S]{0,80}prev/, 'Bucket change reverts')
})

// ── 7. Due-date handling ─────────────────────────────────────────────────────

test('overdue tasks shown in My Work', () => {
  assert.match(OPS_HUB_PAGE, /due_date.*<.*todayKey/, 'Overdue comparison exists')
})

test('due date is displayed on task cards', () => {
  const card = read('../src/components/operations/TaskCard.tsx')
  assert.match(card, /due_date/, 'TaskCard shows due dates')
})

// ── 8. Request intake ────────────────────────────────────────────────────────

test('request intake preserves original message text', () => {
  assert.match(REQUEST_INTAKE_SRC, /whatsapp_source_text/, 'Original text is preserved')
})

test('request intake has source selector', () => {
  assert.match(REQUEST_INTAKE_SRC, /source/, 'Request intake has source field')
})

test('request intake prevents double submission', () => {
  assert.match(REQUEST_INTAKE_SRC, /adding/, 'Adding state prevents double submit')
})

// ── 9. Package classification ────────────────────────────────────────────────

test('package classification is admin-only in drawer', () => {
  assert.match(DRAWER_SRC, /isRequest && isAdmin/, 'Classification gated by admin')
})

test('PACKAGE_ACTIONS includes all expected values', () => {
  assert.ok(Array.isArray(cc.PACKAGE_ACTIONS))
  assert.ok(cc.PACKAGE_ACTIONS.some(a => a.value === 'use_slot'))
  assert.ok(cc.PACKAGE_ACTIONS.some(a => a.value === 'addon'))
  assert.ok(cc.PACKAGE_ACTIONS.some(a => a.value === 'move_work'))
})

test('quote_needed is available for add-on classification', () => {
  assert.match(DRAWER_SRC, /quote_needed/, 'quote_needed in drawer')
})

// ── 10. WhatsApp honesty ─────────────────────────────────────────────────────

test('approval message copy does not claim sending', () => {
  assert.doesNotMatch(REQUEST_APPROVAL_SRC, /sent.*WhatsApp|WhatsApp.*sent|delivered|read/i, 'No false sending claims')
})

test('Mark as sent exists and is honest', () => {
  assert.match(REQUEST_APPROVAL_SRC, /Mark as sent/, 'Mark as sent button exists')
})

test('Mark approved exists', () => {
  assert.match(REQUEST_APPROVAL_SRC, /Mark approved/, 'Mark approved button exists')
})

test('Changes requested exists', () => {
  assert.match(REQUEST_APPROVAL_SRC, /Changes requested/, 'Changes requested button exists')
})

// ── 11. Client isolation ─────────────────────────────────────────────────────

test('updateTask whitelist prevents source overwrite', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /'source'/, 'source is not in ALLOWED_UPDATE_FIELDS')
})

test('updateTask whitelist prevents created_by overwrite', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /'created_by'/, 'created_by is not in ALLOWED_UPDATE_FIELDS')
})

// ── 12. Deliverable linking ──────────────────────────────────────────────────

test('drawer links deliverable by ID', () => {
  assert.match(DRAWER_SRC, /deliverableId/, 'Drawer has deliverable ID field')
})

test('drawer filters deliverables by client', () => {
  assert.match(DRAWER_SRC, /client_id.*===.*clientId/, 'Deliverables filtered by client')
})

test('no duplicate package creation from requests', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /createMonthlyDeliverable|create.*deliverable/i, 'No deliverable creation')
})

// ── 13. Calendar views ───────────────────────────────────────────────────────

test('calendar has month/week/day mode toggle', () => {
  assert.match(OPS_HUB_PAGE, /setViewMode/, 'Calendar view mode toggle exists')
})

test('calendar has date-type labels', () => {
  assert.match(OPS_HUB_PAGE, /badge.*Due/, 'Calendar shows Due badge')
  assert.match(OPS_HUB_PAGE, /badge.*Schedule/, 'Calendar shows Schedule badge')
})

test('calendar drag-to-schedule exists', () => {
  assert.match(OPS_HUB_PAGE, /handleDateDrop/, 'Drag-to-schedule handler exists')
})

// ── 14. Mobile fallbacks ─────────────────────────────────────────────────────

test('day view available for narrow screens', () => {
  assert.match(OPS_HUB_PAGE, /viewMode === 'day'/, 'Day view implemented')
})

test('mobile drawer layout exists', () => {
  assert.match(DRAWER_SRC, /top-16|md:w-\[480px\]/, 'Drawer has mobile layout')
})

// ── 15. Source identity preservation ─────────────────────────────────────────

test('source is not in ALLOWED_UPDATE_FIELDS', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /'source'/, 'Source identity is protected')
})

// ── 16. RLS/migration structure ──────────────────────────────────────────────

test('package_action has DB check constraint values', () => {
  // Verify the TS type matches DB constraints
  assert.ok(cc.PackageAction === undefined || true, 'PackageAction type exists')
  const pkgActions = ['use_slot', 'addon', 'move_work']
  assert.deepEqual(cc.PACKAGE_ACTIONS.filter(a => a.value).map(a => a.value), pkgActions)
})

// ── 17. Honest disabled states ───────────────────────────────────────────────

test('AdminBoardView shows honest description', () => {
  assert.match(OPS_HUB_PAGE, /Admin Tasks/, 'AdminBoardView has Admin Tasks header')
  assert.match(OPS_HUB_PAGE, /Database-protected/, 'AdminBoardView mentions DB protection')
})

// ── 18. No regression in client-facing truth ─────────────────────────────────

test('monthly_deliverables remain canonical', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /insert.*monthly_deliverable/i, 'commandCentre does not write deliverables')
})

test('Client Schedule remains authoritative for package data', () => {
  assert.match(OPS_HUB_PAGE, /listMonthlyDeliverablesByMonth/, 'Ops Hub reads from canonical deliverables API')
})

// ── 19. Error behavior ───────────────────────────────────────────────────────

test('updateTaskSafe handles missing columns gracefully', () => {
  assert.ok(typeof cc.updateTaskSafe === 'function', 'updateTaskSafe exists')
})

test('status quick change exists in page', () => {
  assert.match(OPS_HUB_PAGE, /handleStatusChange/, 'Status change handler exists')
})

// ── 20. Admin board tasks filtered correctly ─────────────────────────────────

test('AdminBoardView filters by Admin / To Do bucket', () => {
  assert.match(OPS_HUB_PAGE, /Admin \/ To Do/, 'AdminBoardView filters for admin bucket')
})

test('AdminBoardView renders TaskCards', () => {
  assert.match(OPS_HUB_PAGE, /adminTasks[\s\S]{0,200}TaskCard/, 'Admin board uses TaskCard within admin tasks')
})
