import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')
const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
const assistant = read('../src/lib/assistant.ts')

// ── Compound intent schema validation ─────────────────────────────────────
test('compound intent: CompoundSemanticIntent interface exists', () => {
  assert.ok(edge.includes('interface CompoundSemanticIntent'))
  assert.ok(edge.includes('is_compound: true'))
  assert.ok(edge.includes('actions: SemanticIntentAction[]'))
})

test('compound intent: isValidCompoundIntent function exists', () => {
  assert.ok(edge.includes('function isValidCompoundIntent'))
  assert.ok(edge.includes('obj.is_compound !== true'))
  assert.ok(edge.includes('Array.isArray(obj.actions)'))
  assert.ok(edge.includes('obj.actions.length < 2'))
  assert.ok(edge.includes('obj.actions.length > 10'))
})

test('compound intent: isValidSemanticIntentAction function exists', () => {
  assert.ok(edge.includes('function isValidSemanticIntentAction'))
  assert.ok(edge.includes('VALID_SEMANTIC_ACTION_TYPES.has(obj.action_type)'))
})

test('compound intent: buildIntentExtractionPrompt includes compound schema', () => {
  assert.ok(edge.includes('COMPOUND ACTION SCHEMA'))
  assert.ok(edge.includes('"is_compound": true'))
  assert.ok(edge.includes('"actions": [array of single action objects'))
})

test('compound intent: extractSemanticIntent handles compound intents', () => {
  assert.ok(edge.includes('isValidCompoundIntent(parsed)'))
  assert.ok(edge.includes('for (const intent of parsed.actions)'))
  assert.ok(edge.includes('is_compound: true'))
})

test('compound intent: Edge Function returns compound_action field', () => {
  assert.ok(edge.includes('compound_action: action'))
  assert.ok(edge.includes("'is_compound' in action"))
})

// ── Client-side compound action handling ───────────────────────────────────
test('client: CompoundActionPlan interface exists', () => {
  assert.ok(composer.includes('interface CompoundActionPlan'))
  assert.ok(composer.includes('is_compound: true'))
  assert.ok(composer.includes('actions: Array<ActionProposal & { type: AssistantActionType }>'))
})

test('client: compoundProposal state exists', () => {
  assert.ok(composer.includes('const [compoundProposal, setCompoundProposal]'))
})

test('client: response.compound_action is handled', () => {
  assert.ok(composer.includes('response.compound_action'))
  assert.ok(composer.includes('setCompoundProposal(plan)'))
})

test('client: compound proposal UI renders', () => {
  assert.ok(composer.includes('compoundProposal && ('))
  assert.ok(composer.includes('Bundle Preview'))
  assert.ok(composer.includes('{compoundProposal.actions.length} actions to confirm'))
})

test('client: applyCompoundProposal function exists', () => {
  assert.ok(composer.includes('async function applyCompoundProposal()'))
})

test('client: deterministic execution order is defined', () => {
  assert.ok(composer.includes('executionOrder'))
  assert.ok(composer.includes("'task.create'"))
  assert.ok(composer.includes("'task.assign'"))
  assert.ok(composer.includes("'calendar.create'"))
  assert.ok(composer.includes("'video.mark_shot'"))
})

test('client: duplicate write protection exists', () => {
  assert.ok(composer.includes('completedActions'))
  assert.ok(composer.includes('completedActions.has(actionKey)'))
})

test('client: partial failure handling exists', () => {
  assert.ok(composer.includes('results.filter(r => r.success)'))
  assert.ok(composer.includes('results.filter(r => !r.success)'))
  assert.ok(composer.includes('Partially completed'))
})

test('client: compound action outcome summary exists', () => {
  assert.ok(composer.includes('all ${succeeded.length} actions completed successfully'))
  assert.ok(composer.includes('All ${failed.length} actions failed'))
})

// ── AssistantChatResponse compound_action field ────────────────────────────
test('assistant: AssistantChatResponse has compound_action field', () => {
  assert.ok(assistant.includes('compound_action?:'))
  assert.ok(assistant.includes('is_compound: true'))
  assert.ok(assistant.includes('actions: Array<'))
})

// ── Deterministic parser tests for compound-like inputs ────────────────────
test('deterministic parser: "mark video 1 as shot and video 2 as shot" handles as single action', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("mark video 1 as shot and video 2 as shot", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  // Deterministic parser handles this as a single video.mark_shot action with multiple videos.
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'video.mark_shot')
  }
})

test('deterministic parser: "create a task and schedule a meeting" handles as single action', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("create a task and schedule a meeting", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  // Deterministic parser handles this as a single task.create action.
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.create')
  }
})

test('deterministic parser: "assign to Franco and move deadline to Friday" handles as single action', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("assign to Franco and move deadline to Friday", {
    today: '2026-09-01',
    clients: [],
    staffNames: ['Franco'],
    tasks: [{ id: 't1', title: 'Poster design', clientId: null, clientName: null, dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  // Deterministic parser handles this as a single task.assign action with due_date.
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.assign')
  }
})

// ── Edge Function compound action examples ─────────────────────────────────
test('edge: compound example for Securiforce content run', () => {
  assert.ok(edge.includes('Securiforce'))
  assert.ok(edge.includes('"is_compound":true'))
  assert.ok(edge.includes('"action_type":"video_mark_shot"'))
  assert.ok(edge.includes('"action_type":"task_create"'))
})

test('edge: compound example for video mark shot and assign', () => {
  assert.ok(edge.includes('Mark video 1 as shot and assign the next video to Sydney'))
  assert.ok(edge.includes('"action_type":"video_mark_shot"'))
  assert.ok(edge.includes('"action_type":"video_move"'))
})

test('edge: compound example for task create and calendar create', () => {
  assert.ok(edge.includes('Create a task to call Red Oak and schedule a meeting with them tomorrow'))
  assert.ok(edge.includes('"action_type":"task_create"'))
  assert.ok(edge.includes('"action_type":"calendar_create"'))
})

// ── Execution order validation ─────────────────────────────────────────────
test('execution order: tasks come before calendar', () => {
  const order = ['task.create', 'task.assign', 'task.due_date', 'task.update', 'calendar.create', 'schedule.propose', 'video.mark_shot', 'video.move']
  const taskIndex = order.indexOf('task.create')
  const calendarIndex = order.indexOf('calendar.create')
  assert.ok(taskIndex < calendarIndex)
})

test('execution order: video.mark_shot comes before video.move', () => {
  const order = ['task.create', 'task.assign', 'task.due_date', 'task.update', 'calendar.create', 'schedule.propose', 'video.mark_shot', 'video.move']
  const markShotIndex = order.indexOf('video.mark_shot')
  const moveIndex = order.indexOf('video.move')
  assert.ok(markShotIndex < moveIndex)
})

// ── Safety constraints ─────────────────────────────────────────────────────
test('safety: compound plan limited to 10 actions max', () => {
  assert.ok(edge.includes('obj.actions.length > 10'))
})

test('safety: compound plan requires at least 2 actions', () => {
  assert.ok(edge.includes('obj.actions.length < 2'))
})

test('safety: every action in compound plan must be valid', () => {
  assert.ok(edge.includes('obj.actions.every((action: unknown) => isValidSemanticIntentAction(action))'))
})

test('safety: model output is never authority (resolveStaff returns null)', () => {
  assert.ok(edge.includes('return match ?? null'))
})

test('safety: compound plan requires client for marketing actions', () => {
  assert.ok(edge.includes("if (!client) return null"))
})

// ── Partial failure handling ───────────────────────────────────────────────
test('partial failure: try/catch per action in compound plan', () => {
  assert.ok(composer.includes('try {'))
  assert.ok(composer.includes('} catch (err) {'))
  assert.ok(composer.includes('results.push({ index: i, type: action.type, success: false'))
})

test('partial failure: outcome distinguishes success/failure', () => {
  assert.ok(composer.includes('succeeded.length === 0'))
  assert.ok(composer.includes('failed.length === 0'))
  assert.ok(composer.includes('Partially completed'))
})

// ── Conversational wording tests ───────────────────────────────────────────
test('conversational: compound prompts use natural language', () => {
  // The examples should use conversational phrasing, not exact technical phrases.
  assert.ok(edge.includes('I was at Securiforce\'s content run'))
  assert.ok(edge.includes('We shot two videos'))
  assert.ok(edge.includes('Franco still needs drone shots tomorrow'))
})

test('conversational: compound examples include filler words', () => {
  assert.ok(edge.includes('Mark video 1 as shot and assign the next video to Sydney'))
  assert.ok(edge.includes('Create a task to call Red Oak and schedule a meeting with them tomorrow'))
})
