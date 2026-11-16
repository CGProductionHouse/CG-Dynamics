import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const actions = read('../src/lib/assistantActions.ts')
const edge = read('../supabase/functions/cg-assistant-chat/index.ts')

test('parser exposes the company_event target type for calendar cancel', () => {
  assert.match(actions, /'planner_task' \| 'content_run' \| 'company_event'/)
  assert.match(actions, /type: 'calendar\.cancel'[\s\S]*?target: followUpId[\s\S]*?type: 'company_event'/)
})

// ── Task notes through the canonical audited RPC ────────────────────────────
test('task.note is a first-class action type resolved like other task writes', () => {
  assert.match(actions, /\| 'task\.note'/)
  assert.match(actions, /type: 'task\.note'/)
})

// ── Capability truth matches the real actions ───────────────────────────────
test('TOOL_REGISTRY reflects cancel and task notes as available', () => {
  assert.ok(edge.includes('Query, create and cancel internal company calendar events.'))
  assert.ok(edge.includes('Create, assign, reschedule, complete, block, add notes to and query Planner tasks.'))
  assert.ok(edge.includes('- Query, create and cancel CG Calendar events.'))
})
