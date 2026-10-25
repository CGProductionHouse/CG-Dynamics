-- Code-only native Planner lifecycle hardening. DO NOT APPLY WITHOUT CA RELEASE APPROVAL.
-- Replaces existing canonical bodies/signatures, not another task or assignment store.
-- Preserves explicit service-role actor resolution, real profile/board/assignee guards,
-- audit and grants. Lifecycle checks execute AFTER SELECT FOR UPDATE, atomically.

CREATE OR REPLACE FUNCTION public.update_assistant_task(p_task_id uuid, p_action text, p_assignee_name text DEFAULT NULL::text, p_due_date date DEFAULT NULL::date, p_comment text DEFAULT NULL::text, p_actor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS planner_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_task public.planner_tasks;
  v_actor public.profiles;
  v_assignee_id uuid;
  v_assignee_count integer;
  v_is_manager boolean;
  v_is_assignee boolean;
  v_has_canonical_assignees boolean;
  v_name_matches uuid[];
  v_changed boolean := false;
  v_old_status text;
  v_previous_audit_guard text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = v_actor_id
    and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  v_is_manager := v_actor.role in ('admin', 'manager');

  select * into v_task from public.planner_tasks where id = p_task_id for update;
  if v_task.id is null then raise exception 'Planner task not found'; end if;
  if v_task.archived_at is not null then raise exception 'Archived Planner tasks cannot be updated'; end if;

  -- Hold the canonical row lock while refusing history; a prior HTTP read is not sufficient.
  if v_task.archived_at is not null or v_task.superseded_by_task_id is not null
    or v_task.microsoft_source_removed_at is not null then
    raise exception 'Historical Planner tasks cannot be updated';
  end if;

  if not exists (
    select 1 from public.planner_boards board
    where board.id = v_task.board_id
      and board.archived_at is null
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and v_actor.role = 'admin')
      )
  ) then raise exception 'Planner board not visible'; end if;

  select exists (
    select 1 from public.planner_task_assignees assignment where assignment.task_id = v_task.id
  ) into v_has_canonical_assignees;
  if v_has_canonical_assignees then
    v_is_assignee := exists (
      select 1 from public.planner_task_assignees assignment
      where assignment.task_id = v_task.id and assignment.profile_id = v_actor_id
    );
  else
    select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[]) into v_name_matches
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
      and nullif(btrim(v_actor.full_name), '') is not null
      and lower(btrim(profile.full_name)) = lower(btrim(v_actor.full_name));
    v_is_assignee := cardinality(v_name_matches) = 1
      and v_name_matches[1] = v_actor_id
      and (
        lower(btrim(coalesce(v_task.assigned_to_name, ''))) = lower(btrim(v_actor.full_name))
        or exists (
          select 1 from unnest(coalesce(v_task.helper_names, '{}'::text[])) helper(name)
          where lower(btrim(helper.name)) = lower(btrim(v_actor.full_name))
        )
      );
  end if;

  if p_action in ('assign', 'reassign', 'due') and not v_is_manager then
    raise exception 'Only a manager can assign or reschedule Planner tasks';
  end if;
  if p_action in ('complete', 'comment', 'block') and not (v_is_manager or v_is_assignee) then
    raise exception 'Only a manager or canonical assignee can update this task';
  end if;

  if p_action in ('assign', 'reassign') then
    if nullif(btrim(coalesce(p_assignee_name, '')), '') is not null then
      select count(*), (array_agg(profile.id order by profile.id))[1] into v_assignee_count, v_assignee_id
      from public.profiles profile
      where profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
        and lower(btrim(profile.full_name)) = lower(btrim(p_assignee_name));
      if v_assignee_count <> 1 then raise exception 'Assignee must match one active workforce profile'; end if;
    end if;
    select public.set_planner_task_assignees_internal(
      v_task.id,
      case when v_assignee_id is null then '{}'::uuid[] else array[v_assignee_id] end,
      v_actor_id, true, 'assistant_assignment'
    ) into v_changed;
    if not v_changed then return v_task; end if;
  elsif p_action = 'due' then
    if v_task.due_date is not distinct from p_due_date then return v_task; end if;
    v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
    perform set_config('app.planner_task_audit_write', 'on', true);
    update public.planner_tasks set due_date = p_due_date where id = v_task.id returning * into v_task;
    perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
    v_changed := true;
  elsif p_action = 'complete' then
    if v_task.status = 'done' then return v_task; end if;
    v_old_status := v_task.status;
    select * into v_task from public.update_planner_task_status(v_task.id, 'done', v_actor_id);
    v_changed := v_old_status is distinct from v_task.status;
  elsif p_action = 'block' then
    v_old_status := v_task.status;
    if v_task.status <> 'blocked' then
      select * into v_task from public.update_planner_task_status(v_task.id, 'blocked', v_actor_id);
    end if;
    if nullif(btrim(coalesce(p_comment, '')), '') is not null then
      v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
      perform set_config('app.planner_task_audit_write', 'on', true);
      update public.planner_tasks
      set notes = coalesce(notes, '') || E'\n[BLOCKED] ' || btrim(p_comment) || ' - ' || coalesce(v_actor.full_name, '')
      where id = v_task.id returning * into v_task;
      perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
    end if;
    v_changed := v_old_status is distinct from v_task.status or nullif(btrim(coalesce(p_comment, '')), '') is not null;
  elsif p_action = 'comment' then
    if nullif(btrim(coalesce(p_comment, '')), '') is null then raise exception 'Comment required'; end if;
    v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
    perform set_config('app.planner_task_audit_write', 'on', true);
    update public.planner_tasks
    set notes = coalesce(notes, '') || E'\n' || coalesce(v_actor.full_name, '') || ': ' || btrim(p_comment)
    where id = v_task.id returning * into v_task;
    perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
    v_changed := true;
  else
    raise exception 'Unknown task action: %', p_action;
  end if;

  select * into v_task from public.planner_tasks where id = v_task.id;
  if v_changed then
    insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
    values ('planner_task', v_task.id, 'assistant_' || p_action, v_actor_id, v_actor.full_name,
      jsonb_build_object('assignee_profile_id', v_assignee_id, 'due_date', v_task.due_date, 'comment', p_comment));
  end if;
  if v_changed and p_action in ('assign', 'reassign') and v_assignee_id is not null and v_assignee_id <> v_actor_id then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
    values (v_assignee_id, 'task_assigned', 'Task assigned to you',
      coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_task.title,
      'planner_task', v_task.id);
  end if;
  return v_task;
end;
$function$;

revoke all on function public.update_assistant_task(uuid,text,text,date,text,uuid) from public, anon;
grant execute on function public.update_assistant_task(uuid,text,text,date,text,uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_planner_task_status(p_task_id uuid, p_status text, p_actor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS planner_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_profile_name text;
  v_profile_active boolean;
  v_name_matches uuid[];
  v_task public.planner_tasks;
  v_old_status text;
  v_previous_audit_guard text;
begin
  if not exists (select 1 from public.profiles where id = v_actor_id and role in ('admin', 'manager', 'staff', 'team')) then
    raise exception 'Staff access required';
  end if;
  if p_status is null or p_status not in (
    'to_do', 'in_progress', 'blocked', 'waiting_client',
    'ready_internal_review', 'approved', 'scheduled', 'done'
  ) then
    raise exception 'Unsupported Planner status';
  end if;

  select profile.full_name, profile.is_active
  into v_profile_name, v_profile_active
  from public.profiles profile
  where profile.id = v_actor_id
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if not found or not coalesce(v_profile_active, false) then
    raise exception 'Active staff access required';
  end if;

  select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[])
  into v_name_matches
  from public.profiles profile
  where profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team')
    and nullif(btrim(v_profile_name), '') is not null
    and lower(btrim(profile.full_name)) = lower(btrim(v_profile_name));

  select * into v_task
  from public.planner_tasks
  where id = p_task_id
  for update;
  if v_task.id is null then
    raise exception 'Planner task not found';
  end if;


  -- Hold the canonical row lock while refusing history; a prior HTTP read is not sufficient.
  if v_task.archived_at is not null or v_task.superseded_by_task_id is not null
    or v_task.microsoft_source_removed_at is not null then
    raise exception 'Historical Planner tasks cannot be updated';
  end if;

  if not exists (
    select 1
    from public.planner_boards board
    where board.id = v_task.board_id
      and board.archived_at is null
      and (
        board.visibility in ('public_internal', 'staff')
        or (board.visibility = 'admin_only' and exists (select 1 from public.profiles where id = v_actor_id and role = 'admin'))
      )
  ) then
    raise exception 'Planner board not visible';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor_id and is_active and role in ('admin', 'manager')) then
    if exists (
      select 1
      from public.planner_task_assignees assignment
      where assignment.task_id = p_task_id
    ) then
      if not exists (
        select 1
        from public.planner_task_assignees assignment
        where assignment.task_id = p_task_id
          and assignment.profile_id = v_actor_id
      ) then
        raise exception 'Planner task is not assigned to this user';
      end if;
    elsif nullif(btrim(v_profile_name), '') is null
      or cardinality(v_name_matches) <> 1
      or v_name_matches[1] is distinct from v_actor_id
      or (
        lower(btrim(coalesce(v_task.assigned_to_name, ''))) <> lower(btrim(v_profile_name))
        and not exists (
          select 1
          from unnest(coalesce(v_task.helper_names, '{}'::text[])) helper(name)
          where lower(btrim(helper.name)) = lower(btrim(v_profile_name))
        )
      )
    then
      raise exception 'Planner task is not assigned to this user';
    end if;
  end if;

  if v_task.status is not distinct from p_status then return v_task; end if;
  v_old_status := v_task.status;
  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  update public.planner_tasks
  set status = p_status
  where id = p_task_id
  returning * into v_task;
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);

  if v_old_status is distinct from p_status then
    insert into public.planner_activity_log (
      entity_type, entity_id, action, actor_user_id, actor_name, metadata
    ) values (
      'planner_task', p_task_id, 'status_changed', v_actor_id, v_profile_name,
      jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
    );
  end if;

  return v_task;
end;
$function$;

revoke all on function public.update_planner_task_status(uuid,text,uuid) from public, anon;
grant execute on function public.update_planner_task_status(uuid,text,uuid) to authenticated, service_role;
