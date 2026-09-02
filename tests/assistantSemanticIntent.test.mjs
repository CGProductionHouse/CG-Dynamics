import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')

// ── Semantic intent extraction schema validation ───────────────────────────
test('semantic intent schema: valid task_create action', () => {
  const validAction = {
    action_type: 'task_create',
    task_title: 'Red Oak poster',
    assignee: 'Franco',
    due_date: '2026-09-02',
    client_name: 'Red Oak',
    confidence: 0.9,
  }
  assert.ok(edge.includes('VALID_SEMANTIC_ACTION_TYPES'))
  assert.ok(edge.includes("'task_create'"))
  assert.ok(edge.includes("'task_assign'"))
  assert.ok(edge.includes("'task_due_date'"))
  assert.ok(edge.includes("'task_complete'"))
  assert.ok(edge.includes("'task_block'"))
  assert.ok(edge.includes("'calendar_create'"))
  assert.ok(edge.includes("'navigation_open'"))
  assert.ok(edge.includes("'client_lookup'"))
})

test('semantic intent schema: confidence threshold is 0.5', () => {
  assert.ok(edge.includes('obj.confidence < 0.5'))
})

test('semantic intent schema: follow_up_reference validation', () => {
  assert.ok(edge.includes("'last_task'"))
  assert.ok(edge.includes("'last_client'"))
})

test('semantic intent extraction: only triggers for instructions', () => {
  assert.ok(edge.includes('isInstruction'))
  assert.ok(edge.includes('(add|create|make|assign|give|move|mark|complete|block|open|show|take|chuck|put|set|schedule|book|reschedule|continue|start|film|shot|video)'))
})

test('semantic intent extraction: skips questions', () => {
  assert.ok(edge.includes('isQuestion'))
  assert.ok(edge.includes('(what|how|why|when|where|who|can|could|would|should|do|does|is|are|was|were)'))
})

test('semantic intent extraction: skips greetings', () => {
  assert.ok(edge.includes('isGreeting'))
  assert.ok(edge.includes('(hi|hello|hey|good morning|good afternoon|goeie|hallo)'))
})

test('semantic intent extraction: loads clients from database', () => {
  assert.ok(edge.includes(".from('clients')"))
  assert.ok(edge.includes(".eq('active', true)"))
})

test('semantic intent extraction: loads staff from profiles', () => {
  assert.ok(edge.includes(".from('profiles')"))
  assert.ok(edge.includes(".not('full_name', 'is', null)"))
})

test('semantic intent extraction: loads tasks from planner_tasks', () => {
  assert.ok(edge.includes(".from('planner_tasks')"))
  assert.ok(edge.includes(".is('completed_at', null)"))
  assert.ok(edge.includes(".is('blocked_at', null)"))
})

test('semantic intent extraction: uses routeAiChat for model call', () => {
  assert.ok(edge.includes('routeAiChat'))
  assert.ok(edge.includes('aiRequestContext'))
})

test('semantic intent extraction: parses JSON from model output', () => {
  assert.ok(edge.includes('JSON.parse(cleaned)'))
  assert.ok(edge.includes('```json'))
})

test('semantic intent extraction: validates output against schema', () => {
  assert.ok(edge.includes('isValidSemanticIntent(parsed)'))
})

test('semantic intent extraction: returns null for "none" action_type', () => {
  assert.ok(edge.includes("parsed.action_type === 'none'"))
})

test('semantic intent extraction: audits with semantic_intent status', () => {
  assert.ok(edge.includes("responseStatus: 'semantic_intent'"))
  assert.ok(edge.includes("promptCategory: 'semantic_intent'"))
})

test('buildActionFromIntent: resolves client name to ID', () => {
  assert.ok(edge.includes('const resolveClient'))
  assert.ok(edge.includes('c.name.toLowerCase() === lower'))
})

test('buildActionFromIntent: resolves staff name', () => {
  assert.ok(edge.includes('const resolveStaff'))
  assert.ok(edge.includes('s.toLowerCase() === lower'))
})

test('buildActionFromIntent: resolves task from follow-up reference', () => {
  assert.ok(edge.includes('const resolveTask'))
  assert.ok(edge.includes("followUp === 'last_task'"))
})

test('buildActionFromIntent: returns null for unsupported action types', () => {
  assert.ok(edge.includes('default:'))
  assert.ok(edge.includes('return null'))
})

test('semantic intent: client-side handles action response', () => {
  const composer = read('../src/components/assistant/GlobalAssistantComposer.tsx')
  assert.ok(composer.includes('response.action'))
  assert.ok(composer.includes('setProposal(proposal)'))
})

test('semantic intent: AssistantChatResponse has action field', () => {
  const assistant = read('../src/lib/assistant.ts')
  assert.ok(assistant.includes('action?:'))
  assert.ok(assistant.includes('type: string'))
  assert.ok(assistant.includes('title: string'))
})

// ── Conversational variant tests (deterministic parser) ────────────────────
// These test that the deterministic parser handles natural language variants.
// When deterministic parsing returns null, the semantic intent extractor takes over.

test('deterministic parser: "chuck this on Franco\'s list" is handled', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("chuck this on Franco's list for tomorrow", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: ['Franco'],
    tasks: [{ id: 't1', title: 'Poster design', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  // This should be handled by deterministic parser (TASK_CREATE_DIRECTION or ASSIGN matches)
  assert.ok(r !== null)
  if (r && 'type' in r) {
    // Could be task.create or task.assign depending on which pattern matches first
    assert.ok(r.type === 'task.create' || r.type === 'task.assign')
  }
})

test('deterministic parser: "assign this to Sydney" uses follow-up context', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("assign this to Sydney", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: ['Sydney'],
    tasks: [{ id: 't1', title: 'Poster design', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.assign')
  }
})

test('deterministic parser: "take me to what I need to work on" navigates to work', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("take me to what I need to work on", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  // "take me to" matches NAV_VERB, then "work" matches the work route
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'navigation.open')
  }
})

test('deterministic parser: "move the Red Oak poster deadline to Friday" handles due date', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("move the Red Oak poster deadline to Friday", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Red Oak poster', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Red Oak poster',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.due_date')
  }
})

test('deterministic parser: "add a meeting with Dulux tomorrow at 10" creates calendar event', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("add a meeting with Dulux tomorrow at 10", {
    today: '2026-09-01',
    clients: [{ id: 'c2', name: 'Dulux' }],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'calendar.create')
  }
})

test('deterministic parser: "actually give it to Sydney" falls through to semantic intent', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("actually give it to Sydney", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: ['Sydney'],
    tasks: [{ id: 't1', title: 'Poster design', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
    lastTaskId: 't1',
    lastTaskName: 'Poster design',
  })
  // "give it to" is not in the ASSIGN regex, so this falls through to semantic intent
  assert.equal(r, null)
})

test('deterministic parser: "open Red Oak" navigates to client', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("open Red Oak", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'navigation.open')
  }
})

test('deterministic parser: "show me the calendar" navigates to CG Calendar', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("show me the calendar", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'navigation.open')
  }
})

test('deterministic parser: "mark that done" uses follow-up context', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("mark that done", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Poster design', clientId: null, clientName: null, dueDate: null }],
    role: 'admin',
    lastTaskId: 't1',
    lastTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.update')
  }
})

test('deterministic parser: "this is blocked" marks task blocked', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("this is blocked", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Poster design', clientId: null, clientName: null, dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.update')
  }
})

// ── Conversational/filler/paraphrase tests ──────────────────────────────────
// These test that the deterministic parser handles natural language variations
// with filler words, paraphrases, and conversational phrasing.

test('deterministic parser: "can you please add a task to call Dulux" handles task creation', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("can you please add a task to call Dulux", {
    today: '2026-09-01',
    clients: [{ id: 'c2', name: 'Dulux' }],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.create')
  }
})

test('deterministic parser: "hey, open the Red Oak client" navigates to client', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("hey, open the Red Oak client", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'navigation.open')
  }
})

test('deterministic parser: "thanks, mark that as done" completes task', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("thanks, mark that as done", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Poster design', clientId: null, clientName: null, dueDate: null }],
    role: 'admin',
    lastTaskId: 't1',
    lastTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.update')
  }
})

test('deterministic parser: "actually, can you move the deadline to next week" changes due date', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("actually, can you move the deadline to next week", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Poster design', clientId: null, clientName: null, dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.due_date')
  }
})

test('deterministic parser: "please assign the Red Oak task to Franco" assigns task', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("please assign the Red Oak task to Franco", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: ['Franco'],
    tasks: [{ id: 't1', title: 'Red Oak poster', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    // Could be task.assign or task.create depending on which pattern matches first
    assert.ok(r.type === 'task.assign' || r.type === 'task.create')
  }
})

test('deterministic parser: "show me what I need to do today" returns null (question)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("show me what I need to do today", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  // "show me" matches NAV_VERB, but "what I need to do today" doesn't match a known page
  // This should fall through to semantic intent
  assert.equal(r, null)
})

test('deterministic parser: "add a meeting with Red Oak tomorrow at 2pm" creates calendar event', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("add a meeting with Red Oak tomorrow at 2pm", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'calendar.create')
  }
})

test('deterministic parser: "put this on Franco\'s list for Friday" creates task', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("put this on Franco's list for Friday", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: ['Franco'],
    tasks: [{ id: 't1', title: 'Poster design', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
    currentTaskId: 't1',
    currentTaskName: 'Poster design',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.ok(r.type === 'task.create' || r.type === 'task.assign')
  }
})

test('deterministic parser: "hey, can you show me the calendar" navigates to calendar', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("hey, can you show me the calendar", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'navigation.open')
  }
})

test('deterministic parser: "please complete the Red Oak task" completes task', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("please complete the Red Oak task", {
    today: '2026-09-01',
    clients: [{ id: 'c1', name: 'Red Oak' }],
    staffNames: [],
    tasks: [{ id: 't1', title: 'Red Oak poster', clientId: 'c1', clientName: 'Red Oak', dueDate: null }],
    role: 'admin',
  })
  assert.ok(r !== null)
  if (r && 'type' in r) {
    assert.equal(r.type, 'task.update')
  }
})

test('deterministic parser: "thanks, that\'s all" returns null (no action)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("thanks, that's all", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  assert.equal(r, null)
})

test('deterministic parser: "what can you help with?" returns null (question)', async () => {
  const { parseAssistantAction } = await import('../src/lib/assistantActions.ts')
  const r = parseAssistantAction("what can you help with?", {
    today: '2026-09-01',
    clients: [],
    staffNames: [],
    role: 'admin',
  })
  assert.equal(r, null)
})

test('semantic intent: new action types are defined', () => {
  assert.ok(edge.includes("'schedule_move'"))
  assert.ok(edge.includes("'video_mark_shot'"))
  assert.ok(edge.includes("'video_move'"))
  assert.ok(edge.includes("'marketing_start'"))
  assert.ok(edge.includes("'marketing_continue'"))
})

test('semantic intent: new follow-up references are defined', () => {
  assert.ok(edge.includes("'last_schedule_item'"))
  assert.ok(edge.includes("'last_calendar_event'"))
  assert.ok(edge.includes("'last_content_run'"))
  assert.ok(edge.includes("'last_marketing_artifact'"))
})

test('semantic intent: resolveScheduleItem function exists', () => {
  assert.ok(edge.includes('const resolveScheduleItem'))
})

test('semantic intent: resolveCalendarEvent function exists', () => {
  assert.ok(edge.includes('const resolveCalendarEvent'))
})

test('semantic intent: resolveContentRun function exists', () => {
  assert.ok(edge.includes('const resolveContentRun'))
})

test('semantic intent: model output is never authority (resolveStaff returns null if not found)', () => {
  assert.ok(edge.includes('return match ?? null'))
})

test('semantic intent: schedule_move requires approval', () => {
  assert.ok(edge.includes('requiresApproval: true'))
  assert.ok(edge.includes('approvalNote:'))
})

test('semantic intent: video_mark_shot resolves content run target', () => {
  assert.ok(edge.includes("target: { type: 'content_run'"))
})

test('semantic intent: marketing_start requires client', () => {
  assert.ok(edge.includes("if (!client) return null"))
})

test('semantic intent: marketing_continue requires client', () => {
  assert.ok(edge.includes("if (!client) return null"))
})
