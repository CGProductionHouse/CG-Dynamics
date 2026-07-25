// ============================================================================
// Operations Hub — PR 4: Client Request + WhatsApp Approval Workflow
// Tests for request intake, package classification, approval states, safety.
// ============================================================================
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const COMMAND_CENTRE_SRC = read('../src/lib/commandCentre.ts')
const REQUEST_INTAKE_SRC = read('../src/components/operations/RequestIntake.tsx')
const REQUEST_APPROVAL_SRC = read('../src/components/operations/RequestApproval.tsx')
const DRAWER_SRC = read('../src/components/operations/TaskDetailDrawer.tsx')
const OPS_HUB_PAGE = read('../src/pages/admin/OpsHubPage.tsx')

let server, cc
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  cc = await server.ssrLoadModule('/src/lib/commandCentre.ts')
})
after(async () => { await server?.close() })

// ── 1. WhatsApp request capture ──────────────────────────────────────────────

test('WhatsApp request capture has message paste area', () => {
  assert.match(REQUEST_INTAKE_SRC, /textarea/, 'RequestIntake has textarea for message')
  assert.match(REQUEST_INTAKE_SRC, /Paste WhatsApp|placeholder/, 'RequestIntake has placeholder text')
})

test('source and priority defaults are correct for request intake', () => {
  // Source defaults to whatsapp_paste
  assert.match(REQUEST_INTAKE_SRC, /whatsapp_paste/, 'RequestIntake defaults to whatsapp_paste source')
  // Priority set to client_request
  assert.match(REQUEST_INTAKE_SRC, /priority.*client_request/, 'RequestIntake sets client_request priority')
  // Bucket defaults to Client Requests
  assert.match(REQUEST_INTAKE_SRC, /bucket.*Client Requests/, 'RequestIntake defaults to Client Requests bucket')
})

test('original message retention preserves full text', () => {
  assert.match(COMMAND_CENTRE_SRC, /whatsapp_source_text/, 'CommandCentreTask has whatsapp_source_text field')
  assert.match(REQUEST_INTAKE_SRC, /whatsapp_source_text/, 'RequestIntake preserves whatsapp_source_text')
})

test('create failure shows safe error', () => {
  assert.match(REQUEST_INTAKE_SRC, /Failed to capture request/, 'RequestIntake has safe error message on failure')
})

test('duplicate-submit prevention during save', () => {
  assert.match(REQUEST_INTAKE_SRC, /adding/, 'RequestIntake has adding state guard')
})

// ── 2. Duplicate detection ───────────────────────────────────────────────────

test('duplicate request warning shows for similar messages', () => {
  assert.match(COMMAND_CENTRE_SRC, /findDuplicateRequests/, 'commandCentre has findDuplicateRequests function')
  assert.match(REQUEST_INTAKE_SRC, /duplicate|Possible duplicate/, 'RequestIntake shows duplicate warning')
})

test('duplicate warning allows deliberate override', () => {
  assert.match(REQUEST_INTAKE_SRC, /Create anyway/, 'RequestIntake has Create anyway override')
})

// ── 3. Client identity uses real client ID ───────────────────────────────────

test('request intake requires client selection', () => {
  assert.match(REQUEST_INTAKE_SRC, /client_id/, 'RequestIntake passes client_id with message')
  assert.match(REQUEST_INTAKE_SRC, /Select client/, 'RequestIntake has client selector')
})

// ── 4. Request opens in drawer ───────────────────────────────────────────────

test('new request opens in the detail drawer', () => {
  assert.match(OPS_HUB_PAGE, /setSelectedTask\(task\)/, 'OpsHubPage opens new request in drawer')
})

test('drawer shows request state for client requests', () => {
  assert.match(DRAWER_SRC, /Request state:/, 'Drawer shows request state label')
  assert.match(DRAWER_SRC, /client_request/, 'Drawer checks for client_request priority')
})

// ── 5. Admin package classification ──────────────────────────────────────────

test('drawer has package classification section for admin users', () => {
  assert.match(DRAWER_SRC, /Package Classification/, 'Drawer has Package Classification heading')
  assert.match(DRAWER_SRC, /package_action/, 'Drawer has package_action control')
  assert.match(DRAWER_SRC, /PACKAGE_ACTIONS/, 'Drawer uses PACKAGE_ACTIONS constant')
})

test('normal staff cannot see package classification controls', () => {
  assert.match(DRAWER_SRC, /isAdmin/, 'Drawer conditionally shows admin controls based on isAdmin')
  assert.match(DRAWER_SRC, /isRequest && isAdmin/, 'Drawer requires both request AND admin')
})

test('exact deliverable linking is supported', () => {
  assert.match(DRAWER_SRC, /deliverableId/, 'Drawer has deliverableId field')
  assert.match(DRAWER_SRC, /clientDeliverables/, 'Drawer filters deliverables by client')
})

test('cross-client deliverable linking is prevented', () => {
  assert.match(DRAWER_SRC, /client_id === draft\.clientId/, 'Drawer only shows same-client deliverables')
})

test('duplicate deliverable linking is prevented', () => {
  assert.match(DRAWER_SRC, /selectedDeliverable/, 'Drawer shows selected deliverable info')
})

test('add-on and quote-needed behaviour exists', () => {
  assert.match(DRAWER_SRC, /quote_needed/, 'Drawer has quote_needed field')
  assert.match(DRAWER_SRC, /Quote needed/, 'Drawer has Quote needed label')
})

test('move-work safety is present', () => {
  assert.match(COMMAND_CENTRE_SRC, /move_work/, 'PACKAGE_ACTIONS includes move_work')
})

// ── 6. Unclassified queue ────────────────────────────────────────────────────

test('unclassified requests queue is displayed', () => {
  assert.match(OPS_HUB_PAGE, /unclassified|Unclassified/, 'ClientWorkView shows unclassified queue')
  assert.match(OPS_HUB_PAGE, /awaiting admin/, 'Unclassified section mentions admin review')
})

// ── 7. WhatsApp approval message ─────────────────────────────────────────────

test('approval message copy exists and does not claim WhatsApp was sent', () => {
  assert.match(COMMAND_CENTRE_SRC, /formatApprovalMessage/, 'commandCentre has formatApprovalMessage')
  assert.match(REQUEST_APPROVAL_SRC, /Copy approval message/, 'RequestApproval has copy button')
  assert.doesNotMatch(REQUEST_APPROVAL_SRC, /WhatsApp sent|Message delivered|Client read/i, 'RequestApproval does not falsely claim delivery')
})

test('sent/waiting/approved/changes states work', () => {
  assert.match(REQUEST_APPROVAL_SRC, /Mark as sent/, 'RequestApproval has Mark as sent')
  assert.match(REQUEST_APPROVAL_SRC, /Mark approved/, 'RequestApproval has Mark approved')
  assert.match(REQUEST_APPROVAL_SRC, /Changes requested/, 'RequestApproval has Changes requested')
})

test('no false WhatsApp sending claim in copy text', () => {
  assert.doesNotMatch(REQUEST_APPROVAL_SRC, /sent.*WhatsApp|WhatsApp.*sent|delivered|read/i, 'No false delivery claims')
})

// ── 8. Safety ────────────────────────────────────────────────────────────────

test('client users cannot access client request intake', () => {
  assert.doesNotMatch(OPS_HUB_PAGE, /RequireClient|client_only/, 'No client-only guard in OpsHubPage')
})

test('package_action is in ALLOWED_UPDATE_FIELDS for admin users', () => {
  assert.match(COMMAND_CENTRE_SRC, /'package_action'/, 'package_action is in whitelist')
  assert.match(COMMAND_CENTRE_SRC, /'deliverable_id'/, 'deliverable_id is in whitelist')
  assert.match(COMMAND_CENTRE_SRC, /'quote_needed'/, 'quote_needed is in whitelist')
  assert.match(COMMAND_CENTRE_SRC, /'admin_package_note'/, 'admin_package_note is in whitelist')
})

test('no duplicate monthly deliverable creation from requests', () => {
  assert.doesNotMatch(COMMAND_CENTRE_SRC, /createMonthlyDeliverable|create.*deliverable/i, 'commandCentre does not create deliverables')
})

test('request state helpers exist', () => {
  assert.match(COMMAND_CENTRE_SRC, /requestStateFromTask/, 'requestStateFromTask exists')
  assert.match(COMMAND_CENTRE_SRC, /requestStateLabel/, 'requestStateLabel exists')
})

// ── 9. Filters ───────────────────────────────────────────────────────────────

test('ClientWorkView has request filters', () => {
  assert.match(OPS_HUB_PAGE, /clientFilter|stateFilter|packageFilter/, 'ClientWorkView has filter state')
  assert.match(OPS_HUB_PAGE, /All clients/, 'ClientWorkView has client filter')
  assert.match(OPS_HUB_PAGE, /All states/, 'ClientWorkView has state filter')
  assert.match(OPS_HUB_PAGE, /All classification/, 'ClientWorkView has classification filter')
})

// ── 10. commandCentre exports ───────────────────────────────────────────────

test('PACKAGE_ACTIONS constant is exported', () => {
  assert.ok(Array.isArray(cc.PACKAGE_ACTIONS), 'PACKAGE_ACTIONS is exported array')
  const values = cc.PACKAGE_ACTIONS.map(a => a.value)
  assert.ok(values.includes('use_slot'), 'PACKAGE_ACTIONS includes use_slot')
  assert.ok(values.includes('addon'), 'PACKAGE_ACTIONS includes addon')
  assert.ok(values.includes('move_work'), 'PACKAGE_ACTIONS includes move_work')
})

test('formatApprovalMessage and formatApprovedMessage are exported', () => {
  assert.ok(typeof cc.formatApprovalMessage === 'function', 'formatApprovalMessage is exported')
  assert.ok(typeof cc.formatApprovedMessage === 'function', 'formatApprovedMessage is exported')
})

test('findDuplicateRequests is exported', () => {
  assert.ok(typeof cc.findDuplicateRequests === 'function', 'findDuplicateRequests is exported')
})

test('formatApprovalMessage produces expected output', () => {
  const task = { title: 'Test request', client_name: 'Test Client', notes: 'Please do the thing', due_date: '2026-08-01', package_action: 'addon', source: 'whatsapp_paste' }
  const msg = cc.formatApprovalMessage(task)
  assert.match(msg, /Test request/, 'Includes title')
  assert.match(msg, /Test Client/, 'Includes client')
  assert.match(msg, /Please do the thing/, 'Includes notes')
  assert.match(msg, /Add-on/, 'Includes package action label')
  assert.doesNotMatch(msg, /sent|delivered/, 'No false delivery language')
})

test('findDuplicateRequests returns matches for same client/text', () => {
  const tasks = [
    { id: '1', client_id: 'c1', notes: 'Please create a new poster for the campaign', created_at: new Date().toISOString() },
    { id: '2', client_id: 'c2', notes: 'Different client request', created_at: new Date().toISOString() },
  ]
  const matches = cc.findDuplicateRequests(tasks, 'c1', 'Please create a new poster')
  assert.equal(matches.length, 1, 'Finds duplicate for same client')
  assert.equal(matches[0].id, '1', 'Returns correct task')
})

test('findDuplicateRequests returns empty for different client', () => {
  const tasks = [
    { id: '1', client_id: 'c1', notes: 'Some request', created_at: new Date().toISOString() },
  ]
  const matches = cc.findDuplicateRequests(tasks, 'c2', 'Some request')
  assert.equal(matches.length, 0, 'No match for different client')
})

test('requestStateLabel returns correct labels', () => {
  assert.equal(cc.requestStateLabel('captured'), 'Captured')
  assert.equal(cc.requestStateLabel('approved'), 'Approved')
  assert.equal(cc.requestStateLabel('changes_requested'), 'Changes Requested')
  assert.equal(cc.requestStateLabel('waiting_client'), 'Waiting for Client')
  assert.equal(cc.requestStateLabel('closed'), 'Closed')
  assert.equal(cc.requestStateLabel('scheduled'), 'Scheduled')
})

// ── 11. Capture Request button ──────────────────────────────────────────────

test('Capture Request button exists on Client Work tab', () => {
  assert.match(OPS_HUB_PAGE, /Capture Request/, 'OpsHubPage has Capture Request button')
  assert.match(OPS_HUB_PAGE, /showRequestIntake/, 'OpsHubPage toggles request intake')
})
