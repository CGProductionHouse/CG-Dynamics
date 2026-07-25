-- Access model:
-- - authenticated callers may invoke this RPC
-- - public.is_manager() remains the authoritative manager/admin gate
-- - monthly_deliverables is canonical and is only read/locked here
-- - task-to-deliverable links must stay within one client

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

comment on function public.admin_set_package_classification(
  uuid,
  text,
  uuid,
  boolean,
  text
) is 'Manager-only package classification with same-client and conflicting-link validation.';

revoke all on function public.admin_set_package_classification(
  uuid,
  text,
  uuid,
  boolean,
  text
) from public, anon, authenticated;

grant execute on function public.admin_set_package_classification(
  uuid,
  text,
  uuid,
  boolean,
  text
) to authenticated;
