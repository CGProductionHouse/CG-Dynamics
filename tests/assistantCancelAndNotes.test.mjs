import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const actions = read('../src/lib/assistantActions.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')

// ── Calendar cancel executes directly (do it, don't explain how) ─────────────
test('calendar.cancel is executed in the composer, never routed to navigation', () => {
  assert.match(composer, /p\.type === 'calendar\.cancel'/)
  assert.ok(!composer.includes('Opening CG Calendar so you can finish this'), 'the navigation fallback must be gone')
})

test('cancel uses the canonical calendar service with a reversible status change, not a delete', () => {
  assert.match(composer, /updateCompanyEvent\(p\.target\.id, \{ status: 'cancelled' \}\)/)
  assert.ok(!composer.includes('deleteCompanyEvent'), 'the Assistant must not hard-delete calendar events')
})

test('cancel resolves the exact event before confirming (follow-up context or deterministic match)', () => {
  assert.match(composer, /resolveCalendarEventForCancel/)
  assert.match(composer, /getCompanyEvent\(followUpId\)/)
  assert.match(composer, /listCompanyEvents\(/)
  assert.match(composer, /target: \{ type: 'company_event', id: event\.id, label: event\.title \}/)
})

test('cancel preview names the exact event and date in the header, with no misleading editable fields', () => {
  assert.match(composer, /title: `Cancel "\$\{event\.title\}" on \$\{when\}`/)
  assert.match(composer, /if \(proposal\.type === 'calendar\.cancel'\) return false/)
})

test('cancel asks ONE small clarification when multiple events match equally', () => {
  assert.match(composer, /outcome\.ambiguous\.length > 1/)
  assert.match(composer, /Which one\?/)
})

test('cancel writes an audit row like calendar.create does', () => {
  assert.match(composer, /action: 'assistant_cancelled'/)
  assert.match(composer, /entity_type: 'company_calendar_event'/)
})

test('cancel respects the manager/admin boundary of the CG Calendar UI', () => {
  assert.match(composer, /Cancelling calendar events is restricted to managers and admins\./)
})

test('cancel never mutates Outlook-imported events (Microsoft stays read-only upstream)', () => {
  assert.match(composer, /current\.data\.microsoft_source_type === 'outlook_event'/)
  assert.match(composer, /That event is an Outlook import/)
})

test('parser exposes the company_event target type for calendar cancel', () => {
  assert.match(actions, /'planner_task' \| 'content_run' \| 'company_event'/)
  assert.match(actions, /type: 'calendar\.cancel'[\s\S]*?target: followUpId[\s\S]*?type: 'company_event'/)
})

// ── Task notes through the canonical audited RPC ────────────────────────────
test('task.note is a first-class action type resolved like other task writes', () => {
  assert.match(actions, /\| 'task\.note'/)
  assert.match(actions, /type: 'task\.note'/)
})

test('composer executes task notes through update_assistant_task comment action', () => {
  assert.match(composer, /p\.type === 'task\.note'/)
  assert.match(composer, /updateAssistantTask\(\{ taskId: p\.target\.id, action: 'comment', comment: note \}\)/)
})

test('task notes stay on the canonical RPC path — no direct table access from the composer', () => {
  // The RPC enforces manager-or-assignee access server-side and writes the
  // audit row itself; the composer never opens a direct data connection.
  assert.ok(!composer.includes('supabase.from('), 'the composer must not write through tables directly')
  assert.ok(!composer.includes('deleteCompanyEvent'), 'no destructive calendar writes either')
})

// ── Capability truth matches the real actions ───────────────────────────────
test('TOOL_REGISTRY reflects cancel and task notes as available', () => {
  assert.ok(edge.includes('Query, create and cancel internal company calendar events.'))
  assert.ok(edge.includes('Create, assign, reschedule, complete, block, add notes to and query Planner tasks.'))
  assert.ok(edge.includes('- Query, create and cancel CG Calendar events.'))
})
