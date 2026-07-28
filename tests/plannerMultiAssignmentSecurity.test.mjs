import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/20260728180000_planner_multi_assignment.sql',
    import.meta.url,
  ),
  'utf8',
)

test('adds active/avatar profile fields and canonical ordered assignment schema', () => {
  assert.match(migration, /add column if not exists is_active boolean not null default true/)
  assert.match(migration, /add column if not exists avatar_url text/)
  assert.match(migration, /profiles_avatar_url_safe[\s\S]*\^https:\/\//)
  assert.match(migration, /unresolved_assignee_names text\[\] not null default '\{\}'/)
  assert.match(migration, /create table if not exists public\.planner_task_assignees/)
  assert.match(migration, /task_id uuid not null references public\.planner_tasks\(id\) on delete cascade/)
  assert.match(migration, /profile_id uuid not null references public\.profiles\(id\) on delete restrict/)
  assert.match(migration, /position integer not null check \(position >= 0\)/)
  assert.match(migration, /primary key \(task_id, profile_id\)/)
  assert.match(migration, /unique \(task_id, position\)/)
  assert.match(migration, /create index if not exists planner_task_assignees_task_idx/)
  assert.match(migration, /create index if not exists planner_task_assignees_profile_idx/)
})

test('backfill preserves legacy identities, resolves exact workforce matches, and records ambiguity', () => {
  const backfillEnd = migration.indexOf('create or replace function public.guard_planner_assignment_projections')
  const backfill = migration.slice(0, backfillEnd)
  assert.match(backfill, /lower\(btrim\(p\.full_name\)\) = lower\(btrim\(legacy\.legacy_name\)\)/)
  assert.match(backfill, /p\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(backfill, /where match_count = 1/)
  assert.match(backfill, /select distinct on \(task_id, profile_ids\[1\]\)/)
  assert.match(backfill, /row_number\(\) over[\s\S]*::integer - 1 as position/)
  assert.match(backfill, /from positioned_profiles\s+on conflict do nothing;/)
  assert.doesNotMatch(backfill, /on conflict \(task_id, profile_id\) do nothing/)
  assert.match(backfill, /select distinct on \(task_id, lower\(btrim\(legacy_name\)\)\)/)
  assert.match(backfill, /array_agg\(legacy_name order by origin_order, source_order, name_order\)/)
  assert.match(backfill, /set unresolved_assignee_names = unresolved\.names/)
  assert.doesNotMatch(backfill, /unresolved_assignee_names\s*\|\|/)
  assert.doesNotMatch(backfill, /set\s+(assigned_to_name|helper_names)\s*=/i)
})

test('assignment tables are visible by board but have no direct mutation privilege', () => {
  assert.match(migration, /alter table public\.planner_task_assignees enable row level security/)
  assert.match(migration, /planner_task_assignees: staff select visible boards[\s\S]*public\.is_staff\(\)[\s\S]*board\.visibility/)
  assert.doesNotMatch(migration, /create policy "planner_task_assignees:[^"]+"[\s\S]{0,80}for (?:insert|update|delete)/i)
  assert.match(migration, /revoke all on table public\.planner_task_assignees from public, anon, authenticated;/)
  assert.match(migration, /grant select on table public\.planner_task_assignees to authenticated;/)
  assert.match(migration, /drop policy if exists "planner_task_assignees: staff select visible boards"/)
})

test('safe directory excludes inactive and non-workforce profiles without broadening profiles RLS', () => {
  assert.match(migration, /function public\.list_planner_assignment_directory\(\)/)
  assert.match(migration, /profile\.id::uuid as result_profile_id/)
  assert.match(migration, /profile\.full_name::text as result_full_name/)
  assert.match(migration, /profile\.role::text as result_role/)
  assert.match(migration, /profile\.avatar_url::text as result_avatar_url/)
  assert.match(migration, /where profile\.is_active[\s\S]*profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(migration, /nullif\(btrim\(profile\.full_name\), ''\) is not null/)
  assert.doesNotMatch(migration, /create policy "profiles:/)
  assert.match(migration, /revoke all on function public\.list_planner_assignment_directory\(\) from public, anon, authenticated;/)
})

test('recurring instances inherit canonical and unresolved assignments server-side only', () => {
  const start = migration.indexOf('create or replace function public.inherit_recurring_planner_task_assignments')
  const end = migration.indexOf('create or replace function public.audit_direct_planner_task_write')
  const inheritance = migration.slice(start, end)
  assert.match(inheritance, /security definer[\s\S]*set search_path = public/)
  assert.match(inheritance, /new\.recurrence_parent_id is null or new\.source is distinct from 'recurring'/)
  assert.match(inheritance, /if not public\.is_active_planner_manager\(\) or not exists/)
  assert.match(inheritance, /parent\.recurrence_rule is not null/)
  assert.match(inheritance, /parent\.board_id = new\.board_id/)
  assert.match(inheritance, /admin_only'[\s\S]*public\.is_admin\(\)/)
  assert.match(inheritance, /Recurring parent must be on the same visible Planner board/)
  assert.match(inheritance, /assigned_to_name = parent\.assigned_to_name/)
  assert.match(inheritance, /helper_names = parent\.helper_names/)
  assert.match(inheritance, /unresolved_assignee_names = parent\.unresolved_assignee_names/)
  assert.match(inheritance, /set_config\('app\.planner_assignment_projection_write', 'on', true\)/)
  assert.match(inheritance, /select new\.id, assignment\.profile_id, assignment\.position, assignment\.assigned_by/)
  assert.match(inheritance, /where assignment\.task_id = new\.recurrence_parent_id/)
  assert.match(inheritance, /when \(new\.recurrence_parent_id is not null and new\.source = 'recurring'\)/)
  assert.match(inheritance, /revoke all on function public\.inherit_recurring_planner_task_assignments\(\)[\s\S]*from public, anon, authenticated;/)
  assert.doesNotMatch(inheritance, /grant execute on function public\.inherit_recurring_planner_task_assignments/)
  assert.doesNotMatch(inheritance, /planner_activity_log|assignment_changed|created/)
})

test('admin_only Planner visibility never grants manager access', () => {
  assert.doesNotMatch(migration, /admin_only' and public\.is_manager\(\)/)
  assert.match(migration, /visibility = 'admin_only' and public\.is_admin\(\)/)
  for (const marker of [
    'planner_boards: staff select visible',
    'planner_buckets: staff select visible',
    'planner_tasks: staff select visible boards',
    'planner_task_assignees: staff select visible boards',
    'create or replace function public.list_planner_board_assignments',
    'planner_activity_log: visible planner task select',
  ]) {
    const start = migration.indexOf(marker)
    const scope = migration.slice(start, start + 1800)
    assert.match(scope, /admin_only'[\s\S]*public\.is_admin\(\)/, `${marker} uses admin gate`)
  }
})

test('recreated policies are dropped first for safe reruns', () => {
  for (const policy of [
    'planner_boards: staff select visible',
    'planner_buckets: staff select visible',
    'planner_tasks: staff select visible boards',
    'planner_task_assignees: staff select visible boards',
    'planner_activity_log: visible planner task select',
    'planner_tasks: active manager insert',
    'planner_tasks: active manager update',
  ]) {
    const drop = migration.indexOf(`drop policy if exists "${policy}"`)
    const create = migration.indexOf(`create policy "${policy}"`)
    assert.ok(drop >= 0, `drop exists for ${policy}`)
    assert.ok(create > drop, `drop precedes create for ${policy}`)
  }
})

test('active manager predicate gates direct writes and manager RPCs', () => {
  assert.match(migration, /function public\.is_active_planner_manager\(\)[\s\S]*public\.is_manager\(\)[\s\S]*profile\.is_active/)
  const insertStart = migration.indexOf('create policy "planner_tasks: active manager insert"')
  const updateStart = migration.indexOf('create policy "planner_tasks: active manager update"')
  const policyEnd = migration.indexOf('-- admin_only remains owner/admin visibility')
  const insertPolicy = migration.slice(insertStart, updateStart)
  const updatePolicy = migration.slice(updateStart, policyEnd)
  assert.match(insertPolicy, /with check \([\s\S]*is_active_planner_manager\(\)[\s\S]*board\.id = planner_tasks\.board_id/)
  assert.match(insertPolicy, /board\.visibility in \('public_internal', 'staff'\)[\s\S]*admin_only'[\s\S]*is_admin\(\)/)
  assert.match(updatePolicy, /using \([\s\S]*is_active_planner_manager\(\)[\s\S]*board\.id = planner_tasks\.board_id/)
  assert.match(updatePolicy, /with check \([\s\S]*is_active_planner_manager\(\)[\s\S]*board\.id = planner_tasks\.board_id/)
  assert.equal((updatePolicy.match(/board\.visibility in \('public_internal', 'staff'\)/g) ?? []).length, 2)
  assert.equal((updatePolicy.match(/visibility = 'admin_only' and public\.is_admin\(\)/g) ?? []).length, 2)
  for (const name of [
    'create_planner_task_with_assignees',
    'set_planner_task_assignees',
    'update_planner_task_with_assignees',
    'list_planner_workload_summary',
    'list_planner_workload_tasks',
  ]) {
    const start = migration.indexOf(`create or replace function public.${name}(`)
    assert.match(migration.slice(start, start + 2500), /if not public\.is_active_planner_manager\(\)/, `${name} is active-manager gated`)
  }
  assert.match(migration, /list_planner_assignment_directory[\s\S]*profile\.id = auth\.uid\(\)[\s\S]*profile\.is_active/)
})

test('direct Planner hard delete has no authenticated policy', () => {
  assert.match(migration, /drop policy if exists "planner_tasks: manager delete"/)
  assert.match(migration, /drop policy if exists "planner_tasks: admin delete"/)
  assert.match(migration, /drop policy if exists "planner_tasks: active manager delete"/)
  assert.doesNotMatch(migration, /create policy "planner_tasks:[^"]*delete"/i)
})

test('migration-owned assignment triggers are removed before rerun backfill', () => {
  const backfill = migration.indexOf('with legacy_names as (')
  for (const trigger of [
    'planner_tasks_guard_assignment_projections',
    'planner_tasks_sync_microsoft_assignees',
    'planner_tasks_sync_legacy_assignees',
    'planner_tasks_audit_direct_write',
    'planner_tasks_inherit_recurring_assignments',
  ]) {
    const drop = migration.indexOf(`drop trigger if exists ${trigger}`)
    assert.ok(drop >= 0 && drop < backfill, `${trigger} is dropped before backfill`)
  }
})

test('historical assignment reader returns inactive state only on visible boards', () => {
  assert.match(migration, /function public\.list_planner_board_assignments\(p_board_id uuid default null\)/)
  assert.match(migration, /assignment\.task_id::uuid as result_task_id/)
  assert.match(migration, /profile\.role::text as result_role/)
  assert.match(migration, /profile\.avatar_url::text as result_avatar_url/)
  assert.match(migration, /assignment\.position::integer as result_position/)
  assert.match(migration, /"position" integer/)
  assert.match(migration, /profile\.is_active::boolean as result_is_active/)
  assert.match(migration, /where public\.is_staff\(\)[\s\S]*caller\.id = auth\.uid\(\)[\s\S]*caller\.is_active/)
  assert.match(migration, /p_board_id is null or task\.board_id = p_board_id/)
})

test('table-returning RPCs drop exact signatures and cast every returned shape', () => {
  const contracts = [
    ['list_planner_assignment_directory', ''],
    ['list_planner_board_assignments', 'uuid'],
    ['list_planner_workload_summary', ''],
    ['list_planner_workload_tasks', ''],
  ]
  for (const [name, signature] of contracts) {
    const drop = migration.indexOf(`drop function if exists public.${name}(${signature});`)
    const create = migration.indexOf(`create or replace function public.${name}(`)
    assert.ok(drop >= 0 && create > drop, `${name} drops its exact signature before recreation`)
  }

  const summaryStart = migration.indexOf('create or replace function public.list_planner_workload_summary')
  const tasksStart = migration.indexOf('create or replace function public.list_planner_workload_tasks')
  const grantsStart = migration.indexOf('revoke all on function public.list_planner_assignment_directory')
  const summary = migration.slice(summaryStart, tasksStart)
  const tasks = migration.slice(tasksStart, grantsStart)
  assert.match(summary, /profile\.id::uuid as result_profile_id/)
  assert.match(summary, /profile\.role::text as result_role/)
  assert.match(summary, /count\(task\.id\)::bigint as result_active_task_count/)
  assert.match(summary, /unassigned\.total::bigint as result_unassigned_total/)
  assert.match(tasks, /task\.status::text as result_status/)
  assert.match(tasks, /task\.priority::text as result_priority/)
  assert.match(tasks, /board\.name::text as result_board_name/)
  assert.match(tasks, /bucket\.name::text as result_bucket_name/)
  assert.match(tasks, /active_assignees\.profile_ids::uuid\[\] as result_assignee_profile_ids/)
  assert.match(tasks, /::boolean as result_is_unassigned/)
})

test('manager task creation validates relationships, active workforce, dedupes, and uses manual identity', () => {
  const start = migration.indexOf('create or replace function public.create_planner_task_with_assignees')
  const end = migration.indexOf('create or replace function public.set_planner_task_assignees(\n')
  const rpc = migration.slice(start, end)
  assert.match(rpc, /if not public\.is_active_planner_manager\(\)/)
  assert.match(rpc, /bucket\.board_id = p_board_id/)
  assert.match(rpc, /set_planner_task_assignees_internal\([\s\S]*p_assignee_profile_ids/)
  assert.match(rpc, /Planner board not found or not visible/)
  assert.match(rpc, /assigned_to_name,[\s\S]*helper_names,[\s\S]*unresolved_assignee_names/)
  assert.match(rpc, /'manual',[\s\S]*'manual-' \|\| gen_random_uuid/)
  assert.match(rpc, /'created'[\s\S]*'create_rpc'/)
  assert.match(rpc, /if not v_assignment_changed[\s\S]*p_unresolved_assignee_names[\s\S]*'assignment_changed'/)
})

test('reassignment is active-only, ordered, and preserves timestamps and audit on no-op', () => {
  const start = migration.indexOf('create or replace function public.set_planner_task_assignees_internal')
  const end = migration.indexOf('create or replace function public.sync_planner_task_legacy_assignees')
  const helper = migration.slice(start, end)
  assert.match(helper, /for update;/)
  assert.match(helper, /min\(ordinality\) as first_ordinal/)
  assert.match(helper, /profile\.is_active[\s\S]*active named workforce profiles/)
  const noOp = helper.indexOf('if v_old_assignee_ids = v_assignee_ids then')
  const deletion = helper.indexOf('delete from public.planner_task_assignees')
  const audit = helper.indexOf("'assignment_changed'")
  assert.ok(noOp >= 0 && deletion > noOp && audit > noOp)
  assert.match(helper.slice(noOp, deletion), /return false;/)
  assert.doesNotMatch(helper.slice(0, noOp), /assigned_at|delete from|assignment_changed/)
  assert.match(helper, /set assigned_to_name = v_primary_name,[\s\S]*helper_names = v_helper_names/)
  assert.doesNotMatch(helper, /set[\s\S]{0,100}unresolved_assignee_names\s*=/)
  assert.match(helper, /'old_profile_ids'[\s\S]*'new_profile_ids'/)
  assert.match(helper, /revoke all on function public\.set_planner_task_assignees_internal\([\s\S]*from public, anon, authenticated;/)
})

test('direct and Microsoft legacy names canonicalize with a truthful neutral audit origin', () => {
  const start = migration.indexOf('create or replace function public.sync_planner_task_legacy_assignees')
  const end = migration.indexOf('create or replace function public.inherit_recurring_planner_task_assignments')
  const sync = migration.slice(start, end)
  assert.match(sync, /if new\.source = 'recurring' and new\.recurrence_parent_id is not null then[\s\S]*return new/)
  assert.match(sync, /profile\.is_active/)
  assert.match(sync, /lower\(btrim\(profile\.full_name\)\) = lower\(btrim\(legacy\.legacy_name\)\)/)
  assert.match(sync, /cardinality\(match\.profile_ids\) as match_count/)
  assert.match(sync, /where match_count = 1/)
  assert.match(sync, /where match_count <> 1/)
  assert.match(sync, /array_agg\(profile_id order by name_order, profile_id\)/)
  assert.match(sync, /v_old_assignee_ids is distinct from v_new_assignee_ids[\s\S]*delete from public\.planner_task_assignees/)
  assert.match(sync, /set unresolved_assignee_names = v_unresolved_names/)
  assert.match(sync, /'origin', 'legacy_projection_sync'/)
  assert.match(sync, /after insert or update of assigned_to_name, helper_names/)
  assert.match(sync, /revoke all on function public\.sync_planner_task_legacy_assignees\(\)[\s\S]*from public, anon, authenticated;/)
  assert.doesNotMatch(sync, /(insert\s+into|update|delete\s+from)\s+public\.microsoft_/i)
  assert.doesNotMatch(migration, /'origin', 'microsoft_sync'/)
})

test('legacy projection guard permits synchronized manager/provider paths and blocks unresolved divergence', () => {
  const start = migration.indexOf('create or replace function public.guard_planner_assignment_projections')
  const end = migration.indexOf('create or replace function public.set_planner_task_assignees_internal')
  const guard = migration.slice(start, end)
  assert.match(guard, /before update of assigned_to_name, helper_names, unresolved_assignee_names/)
  assert.match(guard, /unresolved_assignee_names is not distinct from old\.unresolved_assignee_names[\s\S]*public\.is_active_planner_manager\(\)/)
  assert.match(guard, /new\.microsoft_task_id is not null[\s\S]*service_role/)
  assert.match(guard, /current_user = v_table_owner/)
  assert.match(guard, /current_setting\('app\.planner_assignment_projection_write', true\) = 'on'/)
  assert.match(guard, /must be changed through a canonical assignment RPC/)
  assert.match(guard, /revoke all on function public\.guard_planner_assignment_projections/)
})

test('direct Planner writes canonicalize and audit without duplicating guarded RPC events', () => {
  const start = migration.indexOf('create or replace function public.audit_direct_planner_task_write')
  const end = migration.indexOf('alter table public.planner_task_assignees enable row level security')
  const audit = migration.slice(start, end)
  assert.match(audit, /tg_op = 'INSERT'[\s\S]*'created'[\s\S]*'origin', 'direct_write'/)
  assert.match(audit, /new\.title is distinct from old\.title[\s\S]*new\.checklist is distinct from old\.checklist/)
  assert.match(audit, /new\.archived_at is distinct from old\.archived_at/)
  assert.match(audit, /'task_updated'[\s\S]*'origin', 'direct_write'/)
  assert.match(audit, /current_setting\('app\.planner_task_audit_write', true\) = 'on'/)
  assert.match(audit, /tg_op = 'INSERT'[\s\S]*new\.source = 'recurring'[\s\S]*new\.recurrence_parent_id is not null[\s\S]*return new/)
  assert.match(audit, /revoke all on function public\.audit_direct_planner_task_write\(\)/)
  assert.match(migration, /create trigger planner_tasks_sync_legacy_assignees[\s\S]*after insert or update of assigned_to_name, helper_names/)
  assert.match(migration, /create_planner_task_with_assignees[\s\S]*set_config\('app\.planner_task_audit_write', 'on', true\)[\s\S]*insert into public\.planner_tasks/)
  assert.match(migration, /update_planner_task_status[\s\S]*set_config\('app\.planner_task_audit_write', 'on', true\)[\s\S]*update public\.planner_tasks/)
})

test('drawer update RPC keeps p_profile_ids contract, nullable bucket, atomic core and assignees', () => {
  const start = migration.indexOf('create or replace function public.update_planner_task_with_assignees')
  const end = migration.indexOf('create or replace function public.update_planner_task_status')
  const rpc = migration.slice(start, end)
  assert.match(rpc, /p_profile_ids uuid\[\] default '\{\}'::uuid\[\]/)
  assert.match(rpc, /if not public\.is_active_planner_manager\(\)/)
  assert.match(rpc, /for update;/)
  assert.match(rpc, /if p_bucket_id is not null and not exists \([\s\S]*bucket\.board_id = v_task\.board_id/)
  assert.match(rpc, /jsonb_typeof\(p_checklist\) <> 'array'/)
  assert.match(rpc, /p_client_id is not null[\s\S]*public\.clients[\s\S]*Planner client not found/)
  assert.match(rpc, /v_core_changed :=[\s\S]*title[\s\S]*client_id[\s\S]*bucket_id[\s\S]*status[\s\S]*priority[\s\S]*checklist/)
  assert.match(rpc, /if v_core_changed then[\s\S]*'task_updated'/)
  assert.match(rpc, /set_config\('app\.planner_task_audit_write', 'on', true\)[\s\S]*update public\.planner_tasks/)
  assert.match(rpc, /set_planner_task_assignees_internal\([\s\S]*'update_rpc'/)
  assert.match(migration, /revoke all on function public\.update_planner_task_with_assignees\(/)
  assert.match(migration, /grant execute on function public\.update_planner_task_with_assignees\(/)
})

test('status authorization prefers canonical IDs and narrows legacy fallback', () => {
  const start = migration.indexOf('create or replace function public.update_planner_task_status')
  const end = migration.indexOf('drop policy if exists "planner_activity_log: staff insert"')
  const rpc = migration.slice(start, end)
  assert.match(rpc, /Planner board not visible/)
  assert.match(rpc, /assignment\.profile_id = auth\.uid\(\)/)
  assert.match(rpc, /profile\.is_active[\s\S]*Active staff access required/)
  assert.match(rpc, /if exists \([\s\S]*public\.planner_task_assignees[\s\S]*\) then[\s\S]*if not exists/)
  assert.match(rpc, /elsif nullif\(btrim\(v_profile_name\), ''\) is null/)
  assert.match(rpc, /cardinality\(v_name_matches\) <> 1/)
  assert.match(rpc, /v_name_matches\[1\] is distinct from auth\.uid\(\)/)
  assert.match(rpc, /where profile\.is_active[\s\S]*lower\(btrim\(profile\.full_name\)\) = lower\(btrim\(v_profile_name\)\)/)
  assert.match(rpc, /assigned_to_name[\s\S]*helper_names/)
  assert.match(rpc, /'status_changed'[\s\S]*'old_status'[\s\S]*'new_status'/)
})

test('activity writes are server-owned and staff reads are scoped to visible planner tasks', () => {
  assert.match(migration, /drop policy if exists "planner_activity_log: staff insert"/)
  assert.match(migration, /revoke insert, update, delete on table public\.planner_activity_log[\s\S]*from public, anon, authenticated;/)
  assert.match(migration, /planner_activity_log: visible planner task select[\s\S]*entity_type = 'planner_task'[\s\S]*admin_only'[\s\S]*public\.is_admin\(\)/)
  assert.match(migration, /entity_type <> 'planner_task'[\s\S]*public\.is_manager\(\)/)
  assert.match(migration, /planner_activity_log\.entity_id/)
})

test('workload summary and details share scope and inactive-assignee semantics', () => {
  const summaryStart = migration.indexOf('create or replace function public.list_planner_workload_summary')
  const detailsStart = migration.indexOf('create or replace function public.list_planner_workload_tasks')
  const grantsStart = migration.indexOf('revoke all on function public.list_planner_assignment_directory')
  const summary = migration.slice(summaryStart, detailsStart)
  const details = migration.slice(detailsStart, grantsStart)
  for (const rpc of [summary, details]) {
    assert.match(rpc, /if not public\.is_active_planner_manager\(\)/)
    assert.match(rpc, /task\.archived_at is null/)
    assert.match(rpc, /task\.recurrence_rule is null/)
    assert.match(rpc, /task\.status not in \('approved', 'scheduled', 'done'\)/)
    assert.match(rpc, /join public\.planner_boards board on board\.id = task\.board_id/)
    assert.match(rpc, /board\.archived_at is null/)
    assert.match(rpc, /board\.board_type <> 'client_schedule'/)
    assert.match(rpc, /board\.visibility in \('public_internal', 'staff'\)[\s\S]*admin_only'[\s\S]*public\.is_admin\(\)/)
    assert.match(rpc, /assignee\.is_active/)
    assert.match(rpc, /assignee\.role in \('admin', 'manager', 'staff', 'team'\)/)
  }
  assert.match(summary, /left join public\.planner_task_assignees assignment on assignment\.profile_id = profile\.id/)
  assert.match(summary, /count\(task\.id\).*filter \(where task\.status = 'blocked'\)/s)
  assert.match(summary, /where not exists \([\s\S]*join public\.profiles assignee[\s\S]*assignee\.is_active/)
  assert.match(summary, /nullif\(btrim\(profile\.full_name\), ''\) is not null/)
  assert.match(details, /board_name text[\s\S]*bucket_name text[\s\S]*assignee_profile_ids uuid\[\][\s\S]*is_unassigned boolean/)
  assert.match(details, /array_agg\(assignment\.profile_id order by assignment\.position\)/)
  assert.match(details, /cardinality\(active_assignees\.profile_ids\) = 0/)
  assert.match(migration, /revoke all on function public\.list_planner_workload_tasks\(\) from public, anon, authenticated;/)
  assert.match(migration, /grant execute on function public\.list_planner_workload_tasks\(\) to authenticated;/)
})

test('functions have fixed paths, privileged entry points are definers, and Microsoft stays read-only', () => {
  const functionCount = (migration.match(/create or replace function public\./g) ?? []).length
  const definerCount = (migration.match(/security definer/g) ?? []).length
  const pathCount = (migration.match(/set search_path = public/g) ?? []).length
  assert.equal(functionCount, 14)
  assert.equal(definerCount, functionCount - 1, 'projection guard intentionally observes invoker current_user')
  assert.equal(pathCount, functionCount)
  assert.match(migration, /revoke all on function public\.update_planner_task_status\(uuid, text\) from public, anon, authenticated;/)
  assert.match(migration, /grant execute on function public\.list_planner_workload_summary\(\) to authenticated;/)
  assert.doesNotMatch(migration, /(insert\s+into|update|delete\s+from)\s+public\.microsoft_/i)
  assert.doesNotMatch(migration, /graph\.microsoft|write.?back|service[_-]?role key/i)
})
