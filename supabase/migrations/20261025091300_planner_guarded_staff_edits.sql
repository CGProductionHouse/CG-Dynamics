-- LOCAL PREPARATION ONLY. Do not apply without a separately reviewed release.
-- Keep the existing atomic core/assignment RPC and its historical signature.
-- This additive browser path refuses stale checklist/core edits under one lock.
create or replace function public.update_planner_task_with_assignees_guarded(
  p_task_id uuid, p_title text, p_client_id uuid, p_client_name text,
  p_bucket_id uuid, p_status text, p_priority text, p_start_date date,
  p_due_date date, p_notes text, p_checklist jsonb, p_profile_ids uuid[],
  p_expected_updated_at timestamptz
)
returns public.planner_tasks
language plpgsql security definer set search_path = public as $$
declare v_task public.planner_tasks;
begin
  if auth.uid() is null or not public.is_active_planner_manager() then
    raise exception 'Active manager access required';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Reload the task before saving';
  end if;
  select task.* into v_task from public.planner_tasks task
  join public.planner_boards board on board.id = task.board_id
  where task.id = p_task_id and board.archived_at is null
    and (board.visibility in ('public_internal','staff') or (board.visibility = 'admin_only' and public.is_admin()))
  for update of task;
  if v_task.id is null then raise exception 'Planner task unavailable'; end if;
  if v_task.archived_at is not null or v_task.superseded_by_task_id is not null
    or v_task.microsoft_source_removed_at is not null then
    raise exception 'Historical Planner tasks cannot be updated';
  end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'Task changed. Reload before saving; staff edits were preserved';
  end if;
  select * into v_task from public.update_planner_task_with_assignees(
    p_task_id, p_title, p_client_id, p_client_name, p_bucket_id, p_status,
    p_priority, p_start_date, p_due_date, p_notes, p_checklist, p_profile_ids
  );
  return v_task;
end;
$$;
revoke all on function public.update_planner_task_with_assignees_guarded(
  uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.update_planner_task_with_assignees_guarded(
  uuid,text,uuid,text,uuid,text,text,date,date,text,jsonb,uuid[],timestamptz
) to authenticated;
