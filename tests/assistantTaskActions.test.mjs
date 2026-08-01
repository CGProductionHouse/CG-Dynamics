import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260801120000_assistant_task_actions_and_memory.sql')
const tasksLib = read('../src/lib/assistantTasks.ts')
const memoryLib = read('../src/lib/assistantMemory.ts')

test('per-user memory is own-only via RLS (no cross-user/client leakage)', () => {
  assert.match(sql, /alter table public\.assistant_memory enable row level security/)
  assert.match(sql, /for all\s+using \(user_id = auth\.uid\(\)\)\s+with check \(user_id = auth\.uid\(\)\)/)
})

test('both task RPCs are SECURITY DEFINER and gate on is_staff()', () => {
  for (const fn of ['create_assistant_task', 'update_assistant_task']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}`))
    assert.match(body, /security definer/)
    assert.match(body, /if not is_staff\(\) then raise exception/)
  }
})

test('reassign/assign/due require a manager; complete/comment/block require manager OR assignee', () => {
  const body = sql.slice(sql.indexOf('function public.update_assistant_task'))
  assert.match(body, /p_action in \('reassign','assign','due'\) and not is_manager\(\) then raise exception/)
  assert.match(body, /p_action in \('complete','comment','block'\) and not \(is_manager\(\) or is_assignee\) then raise exception/)
})

test('created tasks are canonical (real board + source cg_assistant), not a hidden store', () => {
  const body = sql.slice(sql.indexOf('function public.create_assistant_task'))
  assert.match(body, /planner_boards where slug = 'operations-todo'/)
  assert.match(body, /insert into public\.planner_tasks/)
  assert.match(body, /'cg_assistant'/)
})

test('every action writes an audit row and notifies the assignee', () => {
  assert.match(sql, /insert into public\.planner_activity_log[\s\S]*'assistant_created'/)
  assert.match(sql, /'assistant_' \|\| p_action/)
  assert.match(sql, /insert into public\.notifications/)
})

test('client libs call the audited RPCs — no direct planner_tasks writes', () => {
  assert.match(tasksLib, /rpc\('create_assistant_task'/)
  assert.match(tasksLib, /rpc\('update_assistant_task'/)
  assert.doesNotMatch(tasksLib, /from\('planner_tasks'\)/)
})

test('memory lib is scoped to the current user on write', () => {
  assert.match(memoryLib, /from\('assistant_memory'\)/)
  assert.match(memoryLib, /insert\(\{ user_id: userId/)
})
