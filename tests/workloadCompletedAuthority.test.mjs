import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { isActiveWorkTask } from '../src/lib/taskLifecycle.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const migration = read('../supabase/migrations/20260809090000_planner_workload_completed_authority.sql')
const canonicalMigration = read('../supabase/migrations/20260805110000_canonical_task_authority.sql')
const assistant = read('../src/components/assistant/GlobalAssistantComposer.tsx')

function rpc(name, nextMarker) {
  const start = migration.indexOf(`create or replace function public.${name}()`)
  const end = migration.indexOf(nextMarker, start)
  assert.ok(start >= 0 && end > start, `${name} definition must be present`)
  return migration.slice(start, end)
}

const summary = rpc('list_planner_workload_summary', 'create or replace function public.list_planner_workload_tasks()')
const tasks = rpc('list_planner_workload_tasks', 'revoke all on function public.list_planner_workload_summary()')

function activeScope(sql) {
  const start = sql.indexOf('where task.recurrence_rule is null')
  const end = sql.indexOf('\n  )', start)
  assert.ok(start >= 0 && end > start)
  return sql.slice(start, end).replace(/\s+/g, ' ').trim()
}

function returnSchema(sql) {
  const match = sql.match(/returns table \(([\s\S]*?)\n\)/)
  assert.ok(match)
  return match[1].split(',').map(field => field.trim().replace(/\s+/g, ' '))
}

test('both workload RPCs read the canonical active task authority', () => {
  for (const sql of [summary, tasks]) {
    assert.match(sql, /from public\.planner_tasks_canonical task/)
    assert.doesNotMatch(sql, /from public\.planner_tasks task/)
    assert.match(sql, /task\.recurrence_rule is null/)
    assert.match(sql, /board\.archived_at is null/)
    assert.match(sql, /board\.board_type <> 'client_schedule'/)
    assert.match(sql, /board\.visibility in \('public_internal', 'staff'\)[\s\S]*admin_only'[\s\S]*public\.is_admin\(\)/)
  }
})

test('summary and details share done-only operational completion semantics', () => {
  for (const sql of [summary, tasks]) {
    assert.match(sql, /task\.status not in \('done', 'completed'\)/)
    assert.doesNotMatch(sql, /status not in \('approved', 'scheduled', 'done'\)/)
  }
  for (const active of ['approved', 'scheduled', 'ready_internal_review', 'waiting_client', 'blocked', 'to_do', 'in_progress', 'moved_to_tomorrow']) {
    assert.equal(isActiveWorkTask(active), true, `${active} remains active in the shared lifecycle`)
  }
  for (const completed of ['done', 'completed']) assert.equal(isActiveWorkTask(completed), false)
  assert.equal(activeScope(summary), activeScope(tasks), 'summary and task details must use one active universe')
})

test('archived and superseded rows are excluded structurally by the canonical view', () => {
  assert.match(canonicalMigration, /create or replace view public\.planner_tasks_canonical as[\s\S]*t\.archived_at is null[\s\S]*t\.superseded_by_task_id is null/)
  for (const sql of [summary, tasks]) {
    assert.doesNotMatch(sql, /task\.archived_at is null|task\.superseded_by_task_id is null/)
  }
})

test('summary metrics keep deferred work active but outside today-axis counts', () => {
  const activeCte = summary.slice(summary.indexOf('with active_tasks as ('), summary.indexOf('), unassigned as ('))
  assert.doesNotMatch(activeCte, /moved_to_tomorrow/)
  assert.match(summary, /count\(task\.id\) filter \(\s*where task\.status <> 'moved_to_tomorrow'\s*and task\.due_date < current_date/)
  assert.match(summary, /count\(task\.id\) filter \(\s*where task\.status <> 'moved_to_tomorrow'\s*and task\.due_date = current_date/)
  assert.match(summary, /count\(task\.id\) filter \(where task\.status = 'blocked'\)/)
  assert.match(summary, /task\.due_date > current_date[\s\S]*task\.due_date <= current_date \+ 7/)
})

test('canonical active tasks with no verified active assignee count as unassigned', () => {
  for (const sql of [summary, tasks]) {
    assert.match(sql, /assignee\.is_active/)
    assert.match(sql, /assignee\.role in \('admin', 'manager', 'staff', 'team'\)/)
  }
  assert.match(summary, /where not exists \([\s\S]*public\.planner_task_assignees/)
  assert.match(tasks, /cardinality\(active_assignees\.profile_ids\) = 0/)
})

test('workload RPC access contracts and return schemas remain unchanged', () => {
  for (const sql of [summary, tasks]) {
    assert.match(sql, /if not public\.is_active_planner_manager\(\)/)
    assert.match(sql, /security definer/)
    assert.match(sql, /set search_path = public/)
  }
  assert.deepEqual(returnSchema(summary), [
    'profile_id uuid', 'full_name text', 'role text', 'avatar_url text',
    'active_task_count bigint', 'overdue_count bigint', 'blocked_count bigint',
    'due_today_count bigint', 'due_next_7_days_count bigint', 'unassigned_total bigint',
  ])
  assert.deepEqual(returnSchema(tasks), [
    'task_id uuid', 'title text', 'status text', 'priority text', 'start_date date',
    'due_date date', 'client_name text', 'board_id uuid', 'board_name text',
    'bucket_id uuid', 'bucket_name text', 'assignee_profile_ids uuid[]', 'is_unassigned boolean',
  ])
  assert.match(migration, /revoke all on function public\.list_planner_workload_summary\(\) from public, anon, authenticated;/)
  assert.match(migration, /revoke all on function public\.list_planner_workload_tasks\(\) from public, anon, authenticated;/)
  assert.match(migration, /grant execute on function public\.list_planner_workload_summary\(\) to authenticated;/)
  assert.match(migration, /grant execute on function public\.list_planner_workload_tasks\(\) to authenticated;/)
})

test('management Assistant consumes corrected workload metrics without a frontend status authority', () => {
  const management = assistant.slice(assistant.indexOf('listPlannerWorkloadSummary().then'), assistant.indexOf('// Ownership review state'))
  assert.match(management, /listPlannerWorkloadSummary\(\)/)
  for (const metric of ['overdue_count', 'blocked_count', 'unassigned_total', 'active_task_count']) assert.match(management, new RegExp(metric))
  assert.match(management, /busiest/)
  assert.doesNotMatch(management, /approved|scheduled|ready_internal_review|status not in|status ===/)
})
