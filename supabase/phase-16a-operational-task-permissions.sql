-- ============================================================
-- Phase 16a: operational task permissions and status alignment
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
-- Managers may manage operational work. Staff may update status only on work
-- assigned to them by user ID, primary display name, or helper display name.
-- ============================================================

alter table public.command_centre_tasks
  drop constraint if exists command_centre_tasks_bucket_check;

alter table public.command_centre_tasks
  add constraint command_centre_tasks_bucket_check check (bucket in (
    'Client Requests', 'Graphic Design', 'Video', 'Websites', 'Admin / To Do',
    'Content Guides', 'Once-off', 'Daily', 'Weekly', 'Monthly', 'Recurring',
    'CG Socials', 'Client Schedules'
  ));

alter table public.planner_tasks
  drop constraint if exists planner_tasks_status_check;

alter table public.planner_tasks
  add constraint planner_tasks_status_check check (status in (
    'to_do', 'in_progress', 'blocked', 'waiting_client',
    'ready_internal_review', 'approved', 'scheduled', 'done'
  ));

drop policy if exists "planner_tasks: admin insert" on public.planner_tasks;
drop policy if exists "planner_tasks: admin update" on public.planner_tasks;
drop policy if exists "planner_tasks: admin delete" on public.planner_tasks;

create policy "planner_tasks: manager insert"
on public.planner_tasks for insert
with check (public.is_manager());

create policy "planner_tasks: manager update"
on public.planner_tasks for update
using (public.is_manager())
with check (public.is_manager());

create policy "planner_tasks: manager delete"
on public.planner_tasks for delete
using (public.is_manager());

drop policy if exists "command_centre_tasks: staff update" on public.command_centre_tasks;
drop policy if exists "command_centre_tasks: admin delete" on public.command_centre_tasks;

create policy "command_centre_tasks: manager update"
on public.command_centre_tasks for update
using (public.is_manager())
with check (public.is_manager());

create policy "command_centre_tasks: manager delete"
on public.command_centre_tasks for delete
using (public.is_manager());

create or replace function public.update_command_centre_task_status(p_task_id uuid, p_status text)
returns public.command_centre_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_row public.command_centre_tasks;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_status not in ('to_do', 'in_progress', 'done', 'blocked', 'waiting_client', 'moved_to_tomorrow') then
    raise exception 'Unsupported task status';
  end if;
  select full_name into v_profile_name from public.profiles where id = auth.uid();
  select * into v_row from public.command_centre_tasks where id = p_task_id;
  if v_row.id is null then raise exception 'Task not found'; end if;
  if not public.is_manager()
     and v_row.assigned_to_user_id is distinct from auth.uid()
     and lower(coalesce(v_row.assigned_to_name, '')) <> lower(coalesce(v_profile_name, ''))
     and not exists (select 1 from unnest(coalesce(v_row.helper_names, array[]::text[])) helper where lower(helper) = lower(coalesce(v_profile_name, '')))
  then raise exception 'Task is not assigned to this user'; end if;
  update public.command_centre_tasks
  set status = p_status,
      completed_at = case when p_status = 'done' then now() else null end
  where id = p_task_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_planner_task_status(p_task_id uuid, p_status text)
returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_name text;
  v_row public.planner_tasks;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  if p_status not in ('to_do', 'in_progress', 'blocked', 'waiting_client', 'ready_internal_review', 'approved', 'scheduled', 'done') then
    raise exception 'Unsupported Planner status';
  end if;
  select full_name into v_profile_name from public.profiles where id = auth.uid();
  select * into v_row from public.planner_tasks where id = p_task_id;
  if v_row.id is null then raise exception 'Task not found'; end if;
  if not public.is_manager()
     and lower(coalesce(v_row.assigned_to_name, '')) <> lower(coalesce(v_profile_name, ''))
     and not exists (select 1 from unnest(coalesce(v_row.helper_names, array[]::text[])) helper where lower(helper) = lower(coalesce(v_profile_name, '')))
  then raise exception 'Task is not assigned to this user'; end if;
  update public.planner_tasks set status = p_status where id = p_task_id returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.update_command_centre_task_status(uuid, text) from public;
revoke all on function public.update_planner_task_status(uuid, text) from public;
grant execute on function public.update_command_centre_task_status(uuid, text) to authenticated;
grant execute on function public.update_planner_task_status(uuid, text) to authenticated;
