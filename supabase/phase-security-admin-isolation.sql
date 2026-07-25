-- ============================================================
-- Phase: Operations Hub Security Hardening
--
-- Idempotent migration — safe to run on production.
--
-- 1. Creates is_manager() if missing (from phase-14a/14b)
-- 2. Replaces command_centre_tasks: staff select to isolate Admin/To Do
-- 3. Restricts INSERT INTO Admin / To Do to managers
-- 4. Restricts UPDATE bucket TO Admin / To Do to managers
-- 5. Adds staff-production-status-update RPC
-- 6. Adds admin-only package classification RPC
-- 7. Updates is_staff() to include 'staff' role if missing
-- ============================================================

-- ── 1. Role helpers (idempotent) ──────────────────────────────

-- Replaces is_staff() to include 'staff' role if the DB still uses the
-- schema.sql version that only has admin/team.
create or replace function public.is_staff()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager', 'staff', 'team')
  );
$$;

-- Creates is_manager() if it doesn't exist (from phase-14a/14b).
-- If it already exists, this is a no-op replacement with the same body.
create or replace function public.is_manager()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

-- is_admin() already exists in base schema; this just ensures it matches.
create or replace function public.is_admin()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ── 2. command_centre_tasks: SELECT isolation ─────────────────

-- Drop the old permissive staff SELECT policy
drop policy if exists "command_centre_tasks: staff select" on public.command_centre_tasks;

-- Managers (admin + manager) can SELECT all tasks, including Admin / To Do
create policy "command_centre_tasks: manager select all"
  on public.command_centre_tasks for select
  using (is_manager());

-- Non-manager staff can SELECT all tasks EXCEPT those in the Admin / To Do bucket
create policy "command_centre_tasks: staff select operational"
  on public.command_centre_tasks for select
  using (
    is_staff()
    and bucket is distinct from 'Admin / To Do'
  );

-- Client users cannot SELECT any command_centre_tasks (no explicit policy for them)

-- ── 3. command_centre_tasks: INSERT restriction ───────────────

drop policy if exists "command_centre_tasks: staff insert" on public.command_centre_tasks;

-- Any staff can insert operational tasks
create policy "command_centre_tasks: staff insert operational"
  on public.command_centre_tasks for insert
  with check (
    is_staff()
    and bucket is distinct from 'Admin / To Do'
  );

-- Only managers can insert Admin / To Do tasks
create policy "command_centre_tasks: manager insert admin"
  on public.command_centre_tasks for insert
  with check (
    is_manager()
    and bucket = 'Admin / To Do'
  );

-- ── 4. command_centre_tasks: UPDATE restriction ───────────────

-- Drop old update policies
drop policy if exists "command_centre_tasks: staff update" on public.command_centre_tasks;
drop policy if exists "command_centre_tasks: manager update" on public.command_centre_tasks;

-- Managers can update any task
create policy "command_centre_tasks: manager update"
  on public.command_centre_tasks for update
  using (is_manager())
  with check (is_manager());

-- Non-manager staff can update operational tasks they are assigned to
-- (or unassigned tasks), but must not change the bucket to Admin / To Do
create policy "command_centre_tasks: staff update operational"
  on public.command_centre_tasks for update
  using (
    is_staff()
    and (
      assigned_to_user_id is null
      or assigned_to_user_id = auth.uid()
    )
  )
  with check (
    is_staff()
    and bucket is distinct from 'Admin / To Do'
    and (
      assigned_to_user_id is null
      or assigned_to_user_id = auth.uid()
    )
  );

-- ── 5. command_centre_tasks: DELETE (unchanged, manager-only) ─

drop policy if exists "command_centre_tasks: admin delete" on public.command_centre_tasks;
drop policy if exists "command_centre_tasks: manager delete" on public.command_centre_tasks;

create policy "command_centre_tasks: manager delete"
  on public.command_centre_tasks for delete
  using (is_manager());

-- ── 6. Staff status-update RPC (with assignment verification) ──
-- Wraps status changes so staff can only update tasks assigned to them,
-- and only to allowed statuses. Managers bypass assignment restrictions.

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

revoke all on function public.update_command_centre_task_status(uuid, text) from public;
grant execute on function public.update_command_centre_task_status(uuid, text) to authenticated;

-- ── 7. Admin-only package classification RPC ───────────────────
-- Enforces server-side that only managers can set package_action,
-- quote_needed, admin_package_note, and deliverable_id.

create or replace function public.admin_set_package_classification(
  p_task_id uuid,
  p_package_action text default null,
  p_deliverable_id uuid default null,
  p_quote_needed boolean default null,
  p_admin_package_note text default null
)
returns public.command_centre_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.command_centre_tasks;
begin
  if not public.is_manager() then
    raise exception 'Manager access required for package classification';
  end if;

  if p_package_action is not null and p_package_action not in ('use_slot', 'addon', 'move_work') then
    raise exception 'Invalid package_action value';
  end if;

  update public.command_centre_tasks
  set
    package_action = coalesce(p_package_action, package_action),
    deliverable_id = coalesce(p_deliverable_id, deliverable_id),
    quote_needed = coalesce(p_quote_needed, quote_needed),
    admin_package_note = coalesce(p_admin_package_note, admin_package_note)
  where id = p_task_id
  returning * into v_row;

  if v_row.id is null then raise exception 'Task not found'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_set_package_classification(uuid, text, uuid, boolean, text) from public;
grant execute on function public.admin_set_package_classification(uuid, text, uuid, boolean, text) to authenticated;

-- ── 8. monthly_deliverables: staff production status RLS ──────
-- (From phase-6f, if not already applied)

drop policy if exists "monthly_deliverables: staff production status update" on public.monthly_deliverables;

create policy "monthly_deliverables: staff production status update"
  on public.monthly_deliverables for update
  using (is_staff())
  with check (
    is_staff()
    and production_status in (
      'to_do',
      'in_progress',
      'ready_internal_review',
      'ready_client_approval'
    )
  );
