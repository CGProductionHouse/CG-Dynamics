-- REVIEW ONLY. Outside automatic migrations; no production application authorized.
-- Bounded source read/write guard, not a global account revocation fix.
-- Existing permissive ownership/role policies remain authoritative and unchanged.
begin;

-- Reject drift rather than overwrite a newer RPC implementation. Accepted
-- bodies are the canonical replay version or this idempotent guarded version.
do $$
begin
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='update_command_centre_task_status' and md5(p.prosrc) in ('e5b56c7ad6fad0ea5b97d716fbfce5cf','e54b222f3dd26d04b251be76211511d3')) <> 1 then
    raise exception 'Review changed RPC body before applying draft: update_command_centre_task_status';
  end if;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_set_package_classification' and md5(p.prosrc) in ('e84b4ee3182447c30f796a6d9b3b1c32','fafdd051bbece27a82d0b1bdb324f8a1')) <> 1 then
    raise exception 'Review changed RPC body before applying draft: admin_set_package_classification';
  end if;
end;
$$;

create or replace function public.nolan_source_reader_active()
returns boolean
language sql stable security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active is true
  );
$$;
alter function public.nolan_source_reader_active() owner to postgres;
revoke all on function public.nolan_source_reader_active() from public, anon, authenticated, service_role;
grant execute on function public.nolan_source_reader_active() to authenticated;

-- A restrictive policy is ANDed with the existing permissive-policy OR result.
-- No extra permissive path, role grant, or service-role policy is introduced.
do $$
declare target text;
begin
  foreach target in array array[
    'command_centre_tasks','planner_tasks','planner_task_assignees',
    'planner_activity_log','planner_boards','planner_buckets',
    'clients','client_aliases','content_guide_ideas','monthly_deliverables'
  ] loop
    if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=target and c.relrowsecurity) then
      raise exception 'Required RLS source missing: %',target;
    end if;
    execute format('drop policy if exists nolan_active_source_read on public.%I',target);
    execute format('create policy nolan_active_source_read on public.%I as restrictive for all to authenticated using (public.nolan_source_reader_active()) with check (public.nolan_source_reader_active())',target);
  end loop;
end;
$$;

-- Preserve self-read so inactive callers can discover revocation. This does
-- not grant self-read: the existing permissive policy must also permit it.
drop policy if exists nolan_active_directory_read on public.profiles;
create policy nolan_active_directory_read on public.profiles
as restrictive for select to authenticated
using (id = auth.uid() or public.nolan_source_reader_active());

-- Inactive admins must not use the legacy admin UPDATE policy to reactivate
-- themselves or another profile. Self-read above is deliberately SELECT-only.
drop policy if exists nolan_active_profile_insert on public.profiles;
create policy nolan_active_profile_insert on public.profiles
as restrictive for insert to authenticated
with check (public.nolan_source_reader_active());
drop policy if exists nolan_active_profile_update on public.profiles;
create policy nolan_active_profile_update on public.profiles
as restrictive for update to authenticated
using (public.nolan_source_reader_active()) with check (public.nolan_source_reader_active());
drop policy if exists nolan_active_profile_delete on public.profiles;
create policy nolan_active_profile_delete on public.profiles
as restrictive for delete to authenticated
using (public.nolan_source_reader_active());

-- Fail closed rather than silently accepting an owner-bypassing canonical view.
do $$
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='planner_tasks_canonical'
      and c.relkind='v' and 'security_invoker=true'=any(c.reloptions)) then
    raise exception 'Canonical Planner security-invoker view prerequisite missing';
  end if;
end;
$$;
-- These two legacy mutation RPCs return full source rows as SECURITY DEFINER.
-- Add only the active-caller precondition; preserve existing role, assignment,
-- same-client, duplicate-link and status checks. Other RPCs are not redefined.
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
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
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
set search_path = ''
as $$
declare
  v_task public.command_centre_tasks;
  v_deliverable public.monthly_deliverables;
begin
  if not public.nolan_source_reader_active() then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  if not public.is_manager() then
    raise exception 'Manager access required for package classification';
  end if;

  if p_package_action is not null
    and p_package_action not in ('use_slot', 'addon', 'move_work')
  then
    raise exception 'Invalid package_action value';
  end if;

  select *
  into v_task
  from public.command_centre_tasks
  where id = p_task_id
  for update;

  if v_task.id is null then
    raise exception 'Task not found';
  end if;

  if p_deliverable_id is not null then
    select *
    into v_deliverable
    from public.monthly_deliverables
    where id = p_deliverable_id
    for update;

    if v_deliverable.id is null then
      raise exception 'Deliverable not found';
    end if;

    if v_task.client_id is distinct from v_deliverable.client_id then
      raise exception 'Task and deliverable must belong to the same client';
    end if;

    perform 1
    from public.command_centre_tasks
    where deliverable_id = p_deliverable_id
      and id <> p_task_id
    limit 1;

    if found then
      raise exception 'Deliverable is already linked to another task';
    end if;
  end if;

  update public.command_centre_tasks
  set
    package_action = coalesce(p_package_action, package_action),
    deliverable_id = coalesce(p_deliverable_id, deliverable_id),
    quote_needed = coalesce(p_quote_needed, quote_needed),
    admin_package_note = coalesce(p_admin_package_note, admin_package_note)
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$;

commit;
