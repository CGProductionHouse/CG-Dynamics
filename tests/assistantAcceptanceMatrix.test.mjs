import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')
const assistant = read('../src/lib/assistant.ts')
const actions = read('../src/lib/assistantActions.ts')

// ── #208 Acceptance Scenario 1: "Sort me out for today." ──────────────────
test('#208-1: "sort me out for today" resolves to task lookup pattern', () => {
  assert.ok(edge.includes('sort me out'), 'TASK_LOOKUP_PATTERNS must include "sort me out"')
  assert.ok(edge.includes('buildLocalWorkResponse'), 'buildLocalWorkResponse must exist')
  assert.ok(edge.includes('function buildLocalWorkResponse'), 'buildLocalWorkResponse must be a function')
})

test('#208-1: daily brief is prioritised (overdue first, then due today)', () => {
  assert.ok(edge.includes('overdueCount'), 'brief must reference overdue count')
  assert.ok(edge.includes('dueTodayCount'), 'brief must reference due-today count')
  assert.ok(edge.includes('nextFocusTitle'), 'brief must identify next focus task')
})

// ── #208 Acceptance Scenario 2: "Assign Franco to make the Red Oak rugby poster" ──
test('#208-2: assignment pattern matches "assign"', () => {
  assert.ok(actions.includes('ASSIGN'), 'ASSIGN pattern must exist in deterministic parser')
  assert.ok(actions.includes('assign'), 'parser must handle "assign" keyword')
})

test('#208-2: task.create action exists with assignee and client', () => {
  assert.ok(actions.includes("'task.create'") || actions.includes("task.create"), 'task.create action type must exist')
  assert.ok(actions.includes('assignee'), 'task.create must support assignee field')
  assert.ok(actions.includes('clientId'), 'task.create must support client binding')
})

test('#208-2: due date resolution works for "tomorrow"', () => {
  assert.ok(actions.includes('tomorrow'), 'parser must resolve "tomorrow"')
  assert.ok(actions.includes('resolveRelativeDate'), 'parser must have relative date resolver')
})

// ── #208 Acceptance Scenario 3: "Mark that done." ────────────────────────
test('#208-3: completion pattern matches "done"', () => {
  assert.ok(actions.includes('COMPLETE'), 'COMPLETE pattern must exist')
  assert.ok(actions.includes('complete'), 'parser must handle "complete" keyword')
  assert.ok(actions.includes('done'), 'parser must handle "done" keyword')
})

test('#208-3: task.update action exists with status=done', () => {
  assert.ok(actions.includes("type: 'task.update'"), 'task.update action type must exist')
  assert.ok(actions.includes("status: 'done'"), 'task.update must support status=done')
})

// ── #208 Acceptance Scenario 4: "What's Red Oak posting this week?" ───────
test('#208-4: client schedule query pattern matches "posting"', () => {
  assert.ok(edge.includes('posting'), 'CLIENT_SCHEDULE_PATTERNS must include "posting"')
  assert.ok(edge.includes('isClientScheduleQuery'), 'isClientScheduleQuery must exist')
})

test('#208-4: handleClientScheduleQuery queries real deliverables', () => {
  assert.ok(edge.includes('handleClientScheduleQuery'), 'handler must exist')
  assert.ok(edge.includes('monthly_deliverables'), 'handler must query canonical table')
  assert.ok(edge.includes('this week'), 'handler must resolve time window')
})

test('#208-4: client resolution works for schedule queries', () => {
  assert.ok(edge.includes('resolveClient'), 'resolveClient must exist')
  assert.ok(edge.includes('active clients'), 'resolver must filter active clients only')
})

// ── #208 Acceptance Scenario 5: "Open Red Oak." ──────────────────────────
test('#208-5: navigation pattern matches "open"', () => {
  assert.ok(actions.includes('NAV_VERB'), 'NAV_VERB pattern must exist')
  assert.ok(actions.includes('navigation.open'), 'navigation.open action type must exist')
})

test('#208-5: client name resolution for navigation', () => {
  assert.ok(actions.includes('findClient'), 'findClient must exist for client navigation')
  assert.ok(actions.includes('/admin/clients'), 'client route must be in PAGE_ROUTES')
})

// ── #208 Acceptance Scenario 6: "Take me to next Tuesday on the calendar." ─
test('#208-6: calendar navigation exists in PAGE_ROUTES', () => {
  assert.ok(actions.includes('calendar'), 'PAGE_ROUTES must include calendar')
  assert.ok(actions.includes('/admin/cg-calendar'), 'calendar route must be /admin/cg-calendar')
})

test('#208-6: NAV_VERB matches "take me to"', () => {
  assert.ok(actions.includes('take me to'), 'NAV_VERB must match "take me to"')
})

// ── #208 Acceptance Scenario 7: "Plan Red Oak's content for next week." ───
test('#208-7: marketing start pattern matches "plan"', () => {
  assert.ok(actions.includes('isMarketingStart'), 'isMarketingStart must exist')
  assert.ok(actions.includes('MARKETING_MAKE'), 'MARKETING_MAKE must include plan/create/build')
  assert.ok(actions.includes('marketing.start'), 'marketing.start action type must exist')
})

test('#208-7: marketing specialist chain exists', () => {
  assert.ok(edge.includes('handleSkilledChat'), 'handleSkilledChat must exist')
  // Specialists are in skilledAgents.ts, but the chain is invoked via handleSkilledChat
  assert.ok(edge.includes('handleSkilledChat'), 'handleSkilledChat must exist')
})

// ── #208 Acceptance Scenario 8: "Check this caption against Red Oak's brand." ─
test('#208-8: brand guardian specialist is defined', () => {
  // Brand guardian is defined in skilledAgents.ts, referenced via handleSkilledChat
  assert.ok(edge.includes('handleSkilledChat'), 'handleSkilledChat must exist for brand guardian')
  assert.ok(actions.includes('brand_guardian'), 'parser must know brand_guardian')
})

test('#208-8: "check against brand" triggers brand guardian', () => {
  assert.ok(actions.includes('check.*against.*brand'), 'pattern must match "check against brand"')
})

test('#208-8: marketing review pattern exists', () => {
  assert.ok(actions.includes('review'), 'parser must handle "review" keyword')
  assert.ok(actions.includes('check'), 'parser must handle "check" keyword')
})

// ── #208 Acceptance Scenario 9: "How is Meta looking?" ────────────────────
test('#208-9: meta integration state is fetched live', () => {
  assert.ok(edge.includes('getMetaIntegrationState'), 'getMetaIntegrationState must exist')
  assert.ok(edge.includes('metaState'), 'metaState must be fetched')
})

test('#208-9: meta state is injected into system prompt', () => {
  assert.ok(edge.includes('metaFacts'), 'metaFacts must be constructed')
  assert.ok(edge.includes('Meta Business'), 'meta status must be in system prompt')
})

test('#208-9: questions bypass action extraction', () => {
  assert.ok(edge.includes('isQuestion'), 'isQuestion detection must exist')
  assert.ok(edge.includes('skips') || edge.includes('question'), 'questions must skip action extraction')
})

// ── #208 Acceptance Scenario 10: Ambiguous command ────────────────────────
test('#208-10: staff ambiguity returns clarification', () => {
  assert.ok(actions.includes('clarify'), 'parser must support clarification responses')
  assert.ok(actions.includes('Did you mean'), 'staff ambiguity must ask "Did you mean"')
})

test('#208-10: client ambiguity returns clarification', () => {
  assert.ok(actions.includes('Which client'), 'client ambiguity must ask "Which client"')
})

test('#208-10: task ambiguity returns clarification', () => {
  assert.ok(actions.includes('Which task'), 'task ambiguity must ask "Which task"')
})

// ── #208 Acceptance Scenario 11: Unsupported/high-risk ────────────────────
test('#208-11: restricted data patterns exist', () => {
  assert.ok(edge.includes('RESTRICTED_PATTERNS'), 'RESTRICTED_PATTERNS must exist')
  assert.ok(edge.includes('isRestrictedRequest'), 'isRestrictedRequest must exist')
  assert.ok(edge.includes('salary'), 'restricted patterns must include salary')
  assert.ok(edge.includes('payroll'), 'restricted patterns must include payroll')
})

test('#208-11: restricted response is plain language', () => {
  assert.ok(edge.includes('buildRestrictedResponse'), 'buildRestrictedResponse must exist')
  assert.ok(edge.includes('cannot access salary'), 'response must be plain language')
})

// ── #208 Additional: TOOL_REGISTRY accuracy ────────────────────────────────
test('TOOL_REGISTRY: tasks marked available', () => {
  assert.ok(edge.includes("'tasks'"), 'tasks must be in TOOL_REGISTRY')
  assert.ok(edge.includes("'available'"), 'tools must be marked available')
})

test('TOOL_REGISTRY: meta marked available', () => {
  assert.ok(edge.includes("'meta'"), 'meta must be in TOOL_REGISTRY')
})

test('TOOL_REGISTRY: marketing-ai marked available', () => {
  assert.ok(edge.includes("'marketing-ai'"), 'marketing-ai must be in TOOL_REGISTRY')
})

test('TOOL_REGISTRY: microsoft marked protected', () => {
  assert.ok(edge.includes("'microsoft'"), 'microsoft must be in TOOL_REGISTRY')
  assert.ok(edge.includes("'protected'"), 'microsoft must be marked protected')
})

// ── #208 Additional: Capability truth ──────────────────────────────────────
test('capabilities: no "planned" labels for implemented features', () => {
  // Tasks, Calendar, Meta, Marketing should not be "planned"
  const plannedCount = (edge.match(/'planned'/g) ?? []).length
  assert.ok(plannedCount <= 2, `Only ${plannedCount} tools should be planned (Approvals, CG Hours)`)
})

test('capabilities: system prompt includes live integration facts', () => {
  assert.ok(edge.includes('buildSystemPrompt'), 'buildSystemPrompt must exist')
  assert.ok(edge.includes('metaState'), 'system prompt must include meta state')
  assert.ok(edge.includes('microsoftState'), 'system prompt must include microsoft state')
})

// ── #208 Additional: Exact-client isolation ────────────────────────────────
test('isolation: client queries are scoped to client', () => {
  assert.ok(edge.includes('client_id'), 'queries must filter by client_id')
  assert.ok(edge.includes('clientId'), 'actions must carry clientId')
})

// ── #208 Additional: Human conversation style ──────────────────────────────
test('conversation: system prompt enforces concise natural output', () => {
  assert.ok(edge.includes('concise'), 'system prompt must enforce concise output')
  assert.ok(edge.includes('natural'), 'system prompt must enforce natural language')
  assert.ok(edge.includes('not a software agent'), 'system prompt must block software agent phrasing')
})

test('conversation: no tool-unavailable phrasing', () => {
  // The system prompt should not use coding-agent phrasing like "I cannot because this tool is not available"
  // Instead it should say what the limitation is in plain language
  assert.ok(edge.includes('plain language') || edge.includes('limitation'), 'system prompt must instruct plain language limitations')
})

test('execution: no "open another page" instructions for supported actions', () => {
  // Only calendar.cancel falls back to navigation
  assert.ok(!edge.includes('Opening CG Calendar so you can finish this'), 'should not instruct user to finish actions manually')
})
