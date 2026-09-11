// Staff-Project writes from ChatGPT run through the CG Dynamics MCP with the service role, where
// auth.uid() is NULL. These tests pin the explicit-actor contract that makes them work without
// letting a signed-in user act as anyone else. The behaviour itself is proven on a real local
// database by tests/sql/mcp_staff_write_actor_acceptance.sql (scripts/local-db-acceptance.sh).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const MIGRATION = read('../supabase/migrations/20260911170000_mcp_staff_write_actor.sql')
const MCP = read('../supabase/functions/cg-dynamics-mcp/index.ts')
const code = MIGRATION.replace(/--[^\n]*/g, '')

const ACTOR_RULE = "v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;"

const OLD_SIGNATURES = {
  create_assistant_task: 'p_title text, p_assignee_name text, p_due_date date, p_client_id uuid, p_client_name text, p_notes text',
  update_assistant_task: 'p_task_id uuid, p_action text, p_assignee_name text, p_due_date date, p_comment text',
  update_planner_task_status: 'p_task_id uuid, p_status text',
  create_assistant_recurring_task: 'p_title text, p_recurrence_rule text, p_recurrence_until date, p_assignee_name text, p_client_id uuid, p_client_name text, p_notes text',
  save_my_staff_assistant_profile: 'p_responsibilities text[], p_recurring_duties text[], p_working_preferences text[], p_output_preferences text[], p_lead_research_criteria text[], p_repeated_corrections text[], p_common_task_types text[], p_chatgpt_project_name text, p_chatgpt_project_url text, p_project_instructions text, p_confirm_instructions_applied boolean',
}

function definition(name) {
  const start = code.search(new RegExp(`create or replace function public\\.${name}\\(`, 'i'))
  assert.ok(start >= 0, `${name} is redefined`)
  const end = code.indexOf(`revoke all on function public.${name}(`, start)
  assert.ok(end > start, `${name} is followed by its grants`)
  return code.slice(start, end)
}

test('every MCP staff-write RPC takes an explicit actor that only the service role can set', () => {
  for (const name of Object.keys(OLD_SIGNATURES)) {
    const body = definition(name)
    assert.match(body, /p_actor_profile_id uuid default null/i, `${name} accepts p_actor_profile_id`)
    assert.equal(body.split(ACTOR_RULE).length - 1, 1, `${name} derives its actor exactly once`)
    assert.equal(body.replace(ACTOR_RULE, '').includes('auth.uid()'), false, `${name} has no other auth.uid()`)
    assert.doesNotMatch(body, /public\.is_(staff|admin|manager|active_planner_manager)\(\)/, `${name} has no auth.uid()-bound helper`)
  }
})

test('old signatures are replaced; the app keeps access, the MCP gains it, anon never has it', () => {
  for (const [name, args] of Object.entries(OLD_SIGNATURES)) {
    assert.ok(code.includes(`drop function if exists public.${name}(${args});`), `${name} old signature dropped`)
    const newArgs = `${args}, p_actor_profile_id uuid`
    assert.ok(code.includes(`revoke all on function public.${name}(${newArgs}) from public, anon`), `${name} revoked from anon`)
    assert.ok(code.includes(`grant execute on function public.${name}(${newArgs}) to authenticated, service_role;`), `${name} granted`)
  }
})

test('staff may assign a task to themselves; assigning someone else stays manager-only', () => {
  const create = definition('create_assistant_task')
  assert.match(create, /v_assignee_id is distinct from v_actor\.id and v_actor\.role not in \('admin', 'manager'\)/)
  assert.match(create, /Only a manager can assign Planner tasks to someone else/)
  assert.doesNotMatch(create, /raise exception 'Only a manager can assign Planner tasks';/)
  assert.match(create, /set_planner_task_assignees_internal\(\s*v_task\.id, array\[v_assignee_id\], v_actor_id/)
})

test('complete and block pass the same actor into the status helper', () => {
  const update = definition('update_assistant_task')
  assert.match(update, /update_planner_task_status\(v_task\.id, 'done', v_actor_id\)/)
  assert.match(update, /update_planner_task_status\(v_task\.id, 'blocked', v_actor_id\)/)
  assert.match(update, /assignment\.profile_id = v_actor_id/)
  assert.match(update, /p_action in \('assign', 'reassign', 'due'\) and not v_is_manager/)
})

test('the status helper keeps its manager and assignee rules against that actor', () => {
  const status = definition('update_planner_task_status')
  assert.match(status, /where id = v_actor_id and is_active and role in \('admin', 'manager'\)/)
  assert.match(status, /assignment\.profile_id = v_actor_id/)
  assert.match(status, /Planner task is not assigned to this user/)
})

test('recurring templates are valid and placed where the materialiser expects them', () => {
  const recurring = definition('create_assistant_recurring_task')
  assert.match(recurring, /'rec-template-' \|\| gen_random_uuid\(\)::text/)
  assert.match(recurring, /'to_do'/)
  assert.doesNotMatch(recurring, /'pending'/)
  assert.match(recurring, /board\.slug = 'operations-todo'/)
  assert.match(recurring, /set_planner_task_assignees_internal\(\s*v_task\.id, array\[v_assignee_id\]/)
  assert.match(recurring, /Only a manager can assign Planner tasks to someone else/)
  assert.match(recurring, /set search_path = ''/)
})

test('the MCP passes its resolved staff subject as the actor to every staff-write RPC', () => {
  for (const rpc of ['create_assistant_task', 'update_assistant_task', 'create_assistant_recurring_task', 'save_my_staff_assistant_profile']) {
    const start = MCP.indexOf(`rpc('${rpc}', {`)
    assert.ok(start >= 0, `${rpc} is called`)
    const call = MCP.slice(start, MCP.indexOf('\n  })', start))
    assert.match(call, /p_actor_profile_id: staff\.profileId,/, `${rpc} receives the actor`)
  }
})

test('the migration is prepared only and touches no Microsoft data', () => {
  assert.match(MIGRATION, /Prepared only\. Do not apply to production without explicit CA approval\./)
  assert.doesNotMatch(code, /(insert\s+into|update|delete\s+from)\s+public\.microsoft_/i)
})
