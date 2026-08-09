-- Issue #176: canonical completed-task authority for Team Work workload RPCs.
--
-- Access model: both functions remain active manager/admin-only SECURITY
-- DEFINER RPCs. Board visibility remains public_internal/staff for managers and
-- additionally admin_only for admins. Clients and ordinary staff cannot call
-- either function.
--
-- planner_tasks_canonical owns archival/supersession filtering. Operational
-- completion excludes only done/legacy completed; scheduling states remain
-- active. Legacy moved_to_tomorrow stays unfinished overall but is outside the
-- overdue/due-today axis.

create or replace function public.list_planner_workload_summary()
returns table (
  profile_id uuid,
  full_name text,
  role text,
  avatar_url text,
  active_task_count bigint,
  overdue_count bigint,
  blocked_count bigint,
  due_today_count bigint,
  due_next_7_days_count bigint,
  unassigned_total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;

  return query
  with active_tasks as (
    select task.id, task.status, task.due_date
    from public.planner_tasks_canonical task
    join public.planner_boards board on board.id = task.board_id
    where task.recurrence_rule is null
      and task.status not in ('done', 'completed')
      and board.archived_at is null
      and board.board_type <> 'client_schedule'
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  ), unassigned as (
    select count(*)::bigint as total
    from active_tasks task
    where not exists (
      select 1
      from public.planner_task_assignees assignment
      join public.profiles assignee on assignee.id = assignment.profile_id
      where assignment.task_id = task.id
        and assignee.is_active
        and assignee.role in ('admin', 'manager', 'staff', 'team')
    )
  )
  select
    profile.id::uuid as result_profile_id,
    profile.full_name::text as result_full_name,
    profile.role::text as result_role,
    profile.avatar_url::text as result_avatar_url,
    count(task.id)::bigint as result_active_task_count,
    count(task.id) filter (
      where task.status <> 'moved_to_tomorrow'
        and task.due_date < current_date
    )::bigint as result_overdue_count,
    count(task.id) filter (where task.status = 'blocked')::bigint as result_blocked_count,
    count(task.id) filter (
      where task.status <> 'moved_to_tomorrow'
        and task.due_date = current_date
    )::bigint as result_due_today_count,
    count(task.id) filter (
      where task.due_date > current_date
        and task.due_date <= current_date + 7
    )::bigint as result_due_next_7_days_count,
    unassigned.total::bigint as result_unassigned_total
  from public.profiles profile
  cross join unassigned
  left join public.planner_task_assignees assignment on assignment.profile_id = profile.id
  left join active_tasks task on task.id = assignment.task_id
  where profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team')
    and nullif(btrim(profile.full_name), '') is not null
  group by profile.id, profile.full_name, profile.role, profile.avatar_url, unassigned.total
  order by lower(profile.full_name) nulls last, profile.id;
end;
$$;

create or replace function public.list_planner_workload_tasks()
returns table (
  task_id uuid,
  title text,
  status text,
  priority text,
  start_date date,
  due_date date,
  client_name text,
  board_id uuid,
  board_name text,
  bucket_id uuid,
  bucket_name text,
  assignee_profile_ids uuid[],
  is_unassigned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_active_planner_manager() then
    raise exception 'Manager access required';
  end if;

  return query
  with active_tasks as (
    select task.*
    from public.planner_tasks_canonical task
    join public.planner_boards board on board.id = task.board_id
    where task.recurrence_rule is null
      and task.status not in ('done', 'completed')
      and board.archived_at is null
      and board.board_type <> 'client_schedule'
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and public.is_admin())
      )
  )
  select
    task.id::uuid as result_task_id,
    task.title::text as result_title,
    task.status::text as result_status,
    task.priority::text as result_priority,
    task.start_date::date as result_start_date,
    task.due_date::date as result_due_date,
    task.client_name::text as result_client_name,
    board.id::uuid as result_board_id,
    board.name::text as result_board_name,
    bucket.id::uuid as result_bucket_id,
    bucket.name::text as result_bucket_name,
    active_assignees.profile_ids::uuid[] as result_assignee_profile_ids,
    (cardinality(active_assignees.profile_ids) = 0)::boolean as result_is_unassigned
  from active_tasks task
  join public.planner_boards board on board.id = task.board_id
  left join public.planner_buckets bucket on bucket.id = task.bucket_id
  cross join lateral (
    select coalesce(
      array_agg(assignment.profile_id order by assignment.position)
        filter (where assignee.id is not null),
      '{}'::uuid[]
    ) as profile_ids
    from public.planner_task_assignees assignment
    join public.profiles assignee
      on assignee.id = assignment.profile_id
      and assignee.is_active
      and assignee.role in ('admin', 'manager', 'staff', 'team')
    where assignment.task_id = task.id
  ) active_assignees
  order by task.due_date nulls last, task.created_at, task.id;
end;
$$;

revoke all on function public.list_planner_workload_summary() from public, anon, authenticated;
revoke all on function public.list_planner_workload_tasks() from public, anon, authenticated;
grant execute on function public.list_planner_workload_summary() to authenticated;
grant execute on function public.list_planner_workload_tasks() to authenticated;

notify pgrst, 'reload schema';
