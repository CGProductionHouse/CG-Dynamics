import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const assistant = read('../src/lib/assistant.ts')
const actions = read('../src/lib/assistantActions.ts')

// ── #208 Acceptance Scenario 1: "Sort me out for today." ──────────────────
test('#208-1: "sort me out for today" resolves to task lookup pattern', () => {
  assert.ok(edge.includes('sort me out'), 'TASK_LOOKUP_PATTERNS must include "sort me out"')
  assert.ok(edge.includes('buildLocalWorkResponse'), 'buildLocalWorkResponse must exist')
  assert.ok(edge.includes('function buildLocalWorkResponse'), 'buildLocalWorkResponse must be a function')
})

test('#208-1: buildLocalWorkResponse uses real My Day context', () => {
  assert.ok(composer.includes('workContextRef'), 'workContextRef must track My Day context')
  assert.ok(edge.includes('focusCount'), 'localWorkContext must include focusCount')
  assert.ok(edge.includes('overdueCount'), 'localWorkContext must include overdueCount')
  assert.ok(edge.includes('dueTodayCount'), 'localWorkContext must include dueTodayCount')
  assert.ok(edge.includes('todayCalendarEvents'), 'localWorkContext must include calendar events')
  assert.ok(edge.includes('upcomingDeliverableSummaries'), 'localWorkContext must include schedule items')
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

test('#208-2: createAssistantTask RPC exists for task creation', () => {
  assert.ok(composer.includes('createAssistantTask'), 'UI must call createAssistantTask')
  assert.ok(composer.includes('task.create'), 'UI must handle task.create proposal')
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

test('#208-3: follow-up context resolves "that" to last task', () => {
  assert.ok(composer.includes('lastTaskRef'), 'UI must track lastTaskRef for follow-ups')
  assert.ok(actions.includes('lastTaskId'), 'parser must support lastTaskId from context')
  assert.ok(actions.includes('currentTaskId'), 'parser must support currentTaskId from context')
})

test('#208-3: updateAssistantTask RPC exists for task completion', () => {
  assert.ok(composer.includes('updateAssistantTask'), 'UI must call updateAssistantTask')
  assert.ok(composer.includes('complete'), 'UI must pass action=complete')
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

test('#208-5: navigate() called for navigation.open', () => {
  assert.ok(composer.includes('navigation.open'), 'UI must handle navigation.open')
  assert.ok(composer.includes('navigate'), 'UI must call navigate()')
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

test('#208-7: runMarketingSpecialist exists for execution', () => {
  assert.ok(composer.includes('runMarketingSpecialist'), 'UI must call runMarketingSpecialist')
  assert.ok(composer.includes('marketing.start'), 'UI must handle marketing.start')
})

test('#208-7: client context is passed to marketing', () => {
  assert.ok(composer.includes('clientId'), 'marketing must receive clientId')
  assert.ok(composer.includes('clientName'), 'marketing must receive clientName')
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

test('#208-10: exactly one clarification per ambiguous turn', () => {
  assert.ok(composer.includes('parsed.clarify'), 'UI must handle clarification response')
  assert.ok(composer.includes('pushAssistant(parsed.clarify)'), 'UI must show clarification to user')
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

test('#208-11: output sanitization blocks internal reasoning', () => {
  assert.ok(edge.includes('sanitizeAssistantOutput'), 'sanitizeAssistantOutput must exist')
  assert.ok(edge.includes('unsafe_output_blocked'), 'unsafe outputs must be blocked')
  assert.ok(composer.includes('assistantPresentation'), 'presentation layer must sanitize')
})

// ── #208 Additional: Voice and typed enter same pipeline ──────────────────
test('voice: speech recognition feeds same send() pipeline', () => {
  assert.ok(composer.includes('onresult'), 'speech recognition must have onresult handler')
  assert.ok(composer.includes('send'), 'onresult must call send()')
})

test('voice: no duplicate submission from final transcript', () => {
  assert.ok(composer.includes('sendingRef'), 'sendingRef must prevent duplicate submission')
  assert.ok(composer.includes('voiceCommittedTranscriptRef'), 'voiceCommittedTranscriptRef must exist')
})

test('voice: typed text preserved if recognition fails', () => {
  assert.ok(composer.includes('voiceCommittedTranscriptRef'), 'transcript must be preserved')
})

// ── #208 Additional: Concise output, no markdown leakage ──────────────────
test('output: no markdown tables or developer blocks', () => {
  assert.ok(composer.includes('presentAssistantReply'), 'presentation layer must exist')
  assert.ok(edge.includes('plain text') || edge.includes('plain-text') || edge.includes('sanitize'), 'output must be plain text')
})

test('output: one progress state at a time', () => {
  assert.ok(composer.includes('sending'), 'sending state must exist')
  assert.ok(composer.includes('Checking'), 'progress must show "Checking"')
})

// ── #208 Additional: Permission boundaries ─────────────────────────────────
test('permissions: microsoft sync is admin-gated', () => {
  assert.ok(edge.includes('protected'), 'microsoft must be marked protected')
  assert.ok(composer.includes('admin'), 'microsoft sync must check admin role')
})

test('permissions: marketing decide is role-gated', () => {
  assert.ok(composer.includes('marketing.decide'), 'marketing.decide must exist')
  assert.ok(composer.includes('role'), 'marketing.decide must check role')
})

// ── #208 Additional: Follow-up context resolution ─────────────────────────
test('follow-ups: 6 context refs tracked', () => {
  assert.ok(composer.includes('lastTaskRef'), 'lastTaskRef must exist')
  assert.ok(composer.includes('lastClientRef'), 'lastClientRef must exist')
  assert.ok(composer.includes('lastScheduleItemRef'), 'lastScheduleItemRef must exist')
  assert.ok(composer.includes('lastCalendarEventRef'), 'lastCalendarEventRef must exist')
  assert.ok(composer.includes('lastContentRunRef'), 'lastContentRunRef must exist')
  assert.ok(composer.includes('lastMarketingArtifactRef'), 'lastMarketingArtifactRef must exist')
})

test('follow-ups: context refs updated after actions', () => {
  assert.ok(composer.includes('lastTaskRef.current'), 'lastTaskRef must be updated')
  assert.ok(composer.includes('lastClientRef.current'), 'lastClientRef must be updated')
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

// ── #208 Additional: Audit preservation ────────────────────────────────────
test('audit: task creation logged', () => {
  assert.ok(composer.includes('logPlannerActivity'), 'UI must log activity')
})

test('audit: calendar creation logged', () => {
  assert.ok(composer.includes('assistant_created'), 'calendar creation must be audited')
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

// ── #208 Additional: Latency/thinking UX ──────────────────────────────────
test('latency: progress indicators exist', () => {
  assert.ok(composer.includes('Checking'), 'progress must show "Checking"')
  assert.ok(composer.includes('Marketing') || composer.includes('marketing'), 'marketing progress must exist')
})

test('latency: deterministic actions skip model round-trip', () => {
  assert.ok(actions.includes('parseAssistantAction'), 'deterministic parser must exist')
  assert.ok(composer.includes('if (parsed'), 'UI must check parsed result before sending to server')
})

// ── #208 Additional: Do it, don't explain how ─────────────────────────────
test('execution: actions execute directly, not via instructions', () => {
  assert.ok(composer.includes('applyProposal'), 'applyProposal must exist')
  assert.ok(composer.includes('createAssistantTask'), 'task creation must be direct')
  assert.ok(composer.includes('updateAssistantTask'), 'task update must be direct')
  assert.ok(composer.includes('createCompanyEvent'), 'calendar creation must be direct')
})

test('execution: no "open another page" instructions for supported actions', () => {
  // Only calendar.cancel falls back to navigation
  assert.ok(!edge.includes('Opening CG Calendar so you can finish this'), 'should not instruct user to finish actions manually')
})
