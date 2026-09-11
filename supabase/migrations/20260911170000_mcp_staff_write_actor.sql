-- CG Dynamics MCP: staff-Project writes under the service-role connection.
--
-- Prepared only. Do not apply to production without explicit CA approval.
--
-- The CG Dynamics MCP connects to the database with the service role, so auth.uid() is NULL
-- inside every RPC it calls. Five functions derived their actor ONLY from auth.uid(), so every
-- staff-Project write from ChatGPT failed — verified on a local database built from this repo:
--   create_task            -> create_assistant_task           "Active staff access required"
--   update_task            -> update_assistant_task           "Active staff access required"
--     (complete / block)   -> update_planner_task_status      "Active staff access required"
--   create_recurring_task  -> create_assistant_recurring_task "Active staff profile required"
--   update_my_preferences  -> save_my_staff_assistant_profile "Active staff profile required"
-- The same calls made as a signed-in user succeeded, so the app never noticed.
--
-- Fix, identical in every function: an optional p_actor_profile_id that is honoured ONLY when the
-- caller is the service role and there is no signed-in user. For a signed-in user nothing changes:
-- auth.uid() is still the actor and a supplied p_actor_profile_id is ignored, so no user can act
-- as someone else. The MCP passes the exact staff subject its Project context resolved (#319).
-- update_planner_task_status also gated on is_staff() / is_admin() / is_active_planner_manager(),
-- which read auth.uid(); those checks are inlined against the same actor (identical for a
-- signed-in user). Bodies are otherwise the current effective definitions, unchanged.
--
-- Two behaviour corrections, both flagged for review:
--   * create_assistant_task: a staff member may assign a task to THEMSELVES. Assigning someone
--     else is still manager-only. Previously any assignee at all required a manager, so the MCP's
--     "create a task for me" (assignee = the staff member) could never succeed for staff.
--   * create_assistant_recurring_task never worked, for anyone: it omitted the NOT NULL
--     import_hash and used a status ('pending') the status check rejects. It now creates a valid
--     template on the Operations board (where the app's materialiser expects it), with an exact
--     assignee under the same self-or-manager rule instead of a free-text name.
--
-- Each function is dropped and recreated because its argument list grows; existing callers keep
-- working because the new argument is optional and last.

-- ── create_assistant_task (4 auth.uid() uses replaced) ──

drop function if exists public.create_assistant_task(p_title text, p_assignee_name text, p_due_date date, p_client_id uuid, p_client_name text, p_notes text);

CREATE OR REPLACE FUNCTION public.create_assistant_task(p_title text, p_assignee_name text DEFAULT NULL::text, p_due_date date DEFAULT NULL::date, p_client_id uuid DEFAULT NULL::uuid, p_client_name text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_actor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS planner_tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_task public.planner_tasks;
  v_board uuid;
  v_bucket uuid;
  v_actor public.profiles;
  v_assignee_id uuid;
  v_assignee_count integer;
  v_client_name text;
  v_previous_audit_guard text;
  v_previous_projection_guard text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = v_actor_id
    and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'Task title required'; end if;

  select board.id into v_board
  from public.planner_boards board
  where board.slug = 'operations-todo'
    and board.archived_at is null
    and (
      board.visibility in ('public_internal', 'staff')
      or (board.visibility = 'admin_only' and v_actor.role = 'admin')
    )
  limit 1;
  if v_board is null then raise exception 'Planner board not found or not visible'; end if;

  if nullif(btrim(coalesce(p_assignee_name, '')), '') is not null then
    select count(*), (array_agg(profile.id order by profile.id))[1] into v_assignee_count, v_assignee_id
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
      and lower(btrim(profile.full_name)) = lower(btrim(p_assignee_name));
    if v_assignee_count <> 1 then raise exception 'Assignee must match one active workforce profile'; end if;
    -- Putting your own task on your own list is not assigning work to anyone: any active staff
    -- member may do it. Assigning someone else remains a manager action.
    if v_assignee_id is distinct from v_actor.id and v_actor.role not in ('admin', 'manager') then
      raise exception 'Only a manager can assign Planner tasks to someone else';
    end if;
  end if;

  if p_client_id is not null then
    select client.name into v_client_name from public.clients client where client.id = p_client_id;
    if v_client_name is null then raise exception 'Planner client not found'; end if;
  else
    v_client_name := nullif(btrim(coalesce(p_client_name, '')), '');
  end if;

  select bucket.id into v_bucket
  from public.planner_buckets bucket
  where bucket.board_id = v_board
    and bucket.archived_at is null
    and upper(bucket.name) = case when p_client_id is not null then 'CLIENT REQUESTS' else 'ADMIN / TO DO' end
  limit 1;
  if v_bucket is null then
    select bucket.id into v_bucket from public.planner_buckets bucket
    where bucket.board_id = v_board and bucket.archived_at is null
    order by bucket.sort_order, bucket.id limit 1;
  end if;
  if v_bucket is null then raise exception 'Planner board has no active bucket'; end if;

  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  v_previous_projection_guard := current_setting('app.planner_assignment_projection_write', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  insert into public.planner_tasks(
    board_id, bucket_id, title, client_id, client_name, assigned_to_name,
    helper_names, unresolved_assignee_names, due_date, notes, status, priority,
    source, import_hash, checklist
  ) values (
    v_board, v_bucket, btrim(p_title), p_client_id, v_client_name, null,
    '{}'::text[], '{}'::text[], p_due_date, p_notes, 'to_do', 'normal',
    'cg_assistant', 'cga-' || gen_random_uuid()::text, '[]'::jsonb
  ) returning * into v_task;
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
  perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_projection_guard, ''), true);

  if v_assignee_id is not null then
    perform public.set_planner_task_assignees_internal(
      v_task.id, array[v_assignee_id], v_actor_id, true, 'assistant_create'
    );
  end if;
  select * into v_task from public.planner_tasks where id = v_task.id;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', v_task.id, 'assistant_created', v_actor_id, v_actor.full_name,
    jsonb_build_object('title', v_task.title, 'assignee_profile_id', v_assignee_id, 'due_date', v_task.due_date));
  if v_assignee_id is not null and v_assignee_id <> v_actor_id then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
    values (v_assignee_id, 'task_assigned', 'New task assigned',
      coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_task.title,
      'planner_task', v_task.id);
  end if;
  return v_task;
end;
$function$;

revoke all on function public.create_assistant_task(p_title text, p_assignee_name text, p_due_date date, p_client_id uuid, p_client_name text, p_notes text, p_actor_profile_id uuid) from public, anon, authenticated;
grant execute on function public.create_assistant_task(p_title text, p_assignee_name text, p_due_date date, p_client_id uuid, p_client_name text, p_notes text, p_actor_profile_id uuid) to authenticated, service_role;

-- ── update_assistant_task (6 auth.uid() uses replaced) ──

drop function if exists public.update_assistant_task(p_task_id uuid, p_action text, p_assignee_name text, p_due_date date, p_comment text);

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

revoke all on function public.update_assistant_task(p_task_id uuid, p_action text, p_assignee_name text, p_due_date date, p_comment text, p_actor_profile_id uuid) from public, anon, authenticated;
grant execute on function public.update_assistant_task(p_task_id uuid, p_action text, p_assignee_name text, p_due_date date, p_comment text, p_actor_profile_id uuid) to authenticated, service_role;

-- ── update_planner_task_status (4 auth.uid() uses replaced) ──

drop function if exists public.update_planner_task_status(p_task_id uuid, p_status text);

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
  if p_status not in (
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

  if not exists (
    select 1
    from public.planner_boards board
    where board.id = v_task.board_id
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

revoke all on function public.update_planner_task_status(p_task_id uuid, p_status text, p_actor_profile_id uuid) from public, anon;
grant execute on function public.update_planner_task_status(p_task_id uuid, p_status text, p_actor_profile_id uuid) to authenticated, service_role;

-- ── save_my_staff_assistant_profile (3 auth.uid() uses replaced) ──

drop function if exists public.save_my_staff_assistant_profile(p_responsibilities text[], p_recurring_duties text[], p_working_preferences text[], p_output_preferences text[], p_lead_research_criteria text[], p_repeated_corrections text[], p_common_task_types text[], p_chatgpt_project_name text, p_chatgpt_project_url text, p_project_instructions text, p_confirm_instructions_applied boolean);

CREATE OR REPLACE FUNCTION public.save_my_staff_assistant_profile(p_responsibilities text[] DEFAULT '{}'::text[], p_recurring_duties text[] DEFAULT '{}'::text[], p_working_preferences text[] DEFAULT '{}'::text[], p_output_preferences text[] DEFAULT '{}'::text[], p_lead_research_criteria text[] DEFAULT '{}'::text[], p_repeated_corrections text[] DEFAULT '{}'::text[], p_common_task_types text[] DEFAULT '{}'::text[], p_chatgpt_project_name text DEFAULT NULL::text, p_chatgpt_project_url text DEFAULT NULL::text, p_project_instructions text DEFAULT ''::text, p_confirm_instructions_applied boolean DEFAULT false, p_actor_profile_id uuid DEFAULT NULL::uuid)
 RETURNS staff_assistant_profiles
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_profile public.profiles%rowtype;
  v_existing public.staff_assistant_profiles%rowtype;
  v_result public.staff_assistant_profiles%rowtype;
  v_project_url text := nullif(btrim(coalesce(p_chatgpt_project_url, '')), '');
  v_project_name text := nullif(btrim(coalesce(p_chatgpt_project_name, '')), '');
  v_instructions text := btrim(coalesce(p_project_instructions, ''));
  v_version integer := 1;
begin
  select * into v_profile from public.profiles where id = v_actor_id;
  if v_profile.id is null or v_profile.is_active is not true
     or v_profile.role not in ('admin', 'manager', 'staff', 'team') then
    raise exception 'Active staff profile required';
  end if;

  if v_project_url is not null and v_project_url !~ '^https://chatgpt\.com/(g/|project/|projects/)' then
    raise exception 'Only a ChatGPT Project URL can be linked';
  end if;
  if char_length(v_instructions) > 12000 then
    raise exception 'Project Instructions are too long';
  end if;

  select * into v_existing
  from public.staff_assistant_profiles
  where profile_id = v_actor_id
  for update;

  if v_existing.profile_id is not null then
    v_version := case
      when v_existing.project_instructions is distinct from v_instructions
        then v_existing.instructions_version + 1
      else v_existing.instructions_version
    end;
  end if;

  insert into public.staff_assistant_profiles (
    profile_id, responsibilities, recurring_duties, working_preferences,
    output_preferences, lead_research_criteria, repeated_corrections,
    common_task_types, chatgpt_project_name, chatgpt_project_url,
    project_instructions, instructions_version, instructions_refreshed_at,
    instructions_applied_at, profile_verified_at, updated_at
  ) values (
    v_actor_id, coalesce(p_responsibilities, '{}'), coalesce(p_recurring_duties, '{}'),
    coalesce(p_working_preferences, '{}'), coalesce(p_output_preferences, '{}'),
    coalesce(p_lead_research_criteria, '{}'), coalesce(p_repeated_corrections, '{}'),
    coalesce(p_common_task_types, '{}'), v_project_name, v_project_url,
    v_instructions, v_version, now(),
    case when p_confirm_instructions_applied then now() else null end,
    now(), now()
  )
  on conflict (profile_id) do update set
    responsibilities = excluded.responsibilities,
    recurring_duties = excluded.recurring_duties,
    working_preferences = excluded.working_preferences,
    output_preferences = excluded.output_preferences,
    lead_research_criteria = excluded.lead_research_criteria,
    repeated_corrections = excluded.repeated_corrections,
    common_task_types = excluded.common_task_types,
    chatgpt_project_name = excluded.chatgpt_project_name,
    chatgpt_project_url = excluded.chatgpt_project_url,
    project_instructions = excluded.project_instructions,
    instructions_version = excluded.instructions_version,
    instructions_refreshed_at = case
      when public.staff_assistant_profiles.project_instructions is distinct from excluded.project_instructions
        then now()
      else public.staff_assistant_profiles.instructions_refreshed_at
    end,
    instructions_applied_at = case
      when p_confirm_instructions_applied then now()
      when public.staff_assistant_profiles.project_instructions is distinct from excluded.project_instructions then null
      else public.staff_assistant_profiles.instructions_applied_at
    end,
    profile_verified_at = now(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$function$;

revoke all on function public.save_my_staff_assistant_profile(p_responsibilities text[], p_recurring_duties text[], p_working_preferences text[], p_output_preferences text[], p_lead_research_criteria text[], p_repeated_corrections text[], p_common_task_types text[], p_chatgpt_project_name text, p_chatgpt_project_url text, p_project_instructions text, p_confirm_instructions_applied boolean, p_actor_profile_id uuid) from public, anon;
grant execute on function public.save_my_staff_assistant_profile(p_responsibilities text[], p_recurring_duties text[], p_working_preferences text[], p_output_preferences text[], p_lead_research_criteria text[], p_repeated_corrections text[], p_common_task_types text[], p_chatgpt_project_name text, p_chatgpt_project_url text, p_project_instructions text, p_confirm_instructions_applied boolean, p_actor_profile_id uuid) to authenticated, service_role;

-- ── create_assistant_recurring_task (2 auth.uid() uses replaced) ──

drop function if exists public.create_assistant_recurring_task(p_title text, p_recurrence_rule text, p_recurrence_until date, p_assignee_name text, p_client_id uuid, p_client_name text, p_notes text);

create or replace function public.create_assistant_recurring_task(
  p_title text,
  p_recurrence_rule text,
  p_recurrence_until date default null,
  p_assignee_name text default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_notes text default null,
  p_actor_profile_id uuid default null
)
returns public.planner_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := case when auth.uid() is null and auth.role() = 'service_role' then p_actor_profile_id else auth.uid() end;
  v_profile public.profiles%rowtype;
  v_task public.planner_tasks%rowtype;
  v_actor_name text;
  v_board uuid;
  v_bucket uuid;
  v_client_name text;
  v_assignee_id uuid;
  v_assignee_count integer;
  v_previous_audit_guard text;
  v_previous_projection_guard text;
begin
  select * into v_profile from public.profiles where id = v_actor_id;
  if v_profile.id is null or v_profile.is_active is not true
     or v_profile.role not in ('admin', 'manager', 'staff', 'team') then
    raise exception 'Active staff profile required';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;
  if p_recurrence_rule is null or length(btrim(p_recurrence_rule)) = 0 then
    raise exception 'Recurrence rule is required';
  end if;
  if p_recurrence_until is not null and p_recurrence_until < current_date then
    raise exception 'Recurrence end date must not be in the past';
  end if;

  v_actor_name := coalesce(v_profile.full_name, v_profile.id::text);

  -- The assignee is an exact active person: the named one, or the creator by default.
  -- Assigning someone else is a manager action, exactly as for one-off tasks.
  if nullif(btrim(coalesce(p_assignee_name, '')), '') is null then
    v_assignee_id := v_profile.id;
  else
    select count(*), (array_agg(profile.id order by profile.id))[1] into v_assignee_count, v_assignee_id
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
      and lower(btrim(profile.full_name)) = lower(btrim(p_assignee_name));
    if v_assignee_count <> 1 then raise exception 'Assignee must match one active workforce profile'; end if;
  end if;
  if v_assignee_id is distinct from v_profile.id and v_profile.role not in ('admin', 'manager') then
    raise exception 'Only a manager can assign Planner tasks to someone else';
  end if;

  if p_client_id is not null then
    select client.name into v_client_name from public.clients client where client.id = p_client_id;
    if v_client_name is null then raise exception 'Planner client not found'; end if;
  else
    v_client_name := nullif(btrim(coalesce(p_client_name, '')), '');
  end if;

  -- Placed exactly as create_assistant_task places work. The app's materialiser copies the
  -- template's board and bucket onto every instance, so a template without them would spawn
  -- instances that appear on no board.
  select board.id into v_board
  from public.planner_boards board
  where board.slug = 'operations-todo'
    and board.archived_at is null
    and (
      board.visibility in ('public_internal', 'staff')
      or (board.visibility = 'admin_only' and v_profile.role = 'admin')
    )
  limit 1;
  if v_board is null then raise exception 'Planner board not found or not visible'; end if;

  select bucket.id into v_bucket
  from public.planner_buckets bucket
  where bucket.board_id = v_board
    and bucket.archived_at is null
    and upper(bucket.name) = case when p_client_id is not null then 'CLIENT REQUESTS' else 'ADMIN / TO DO' end
  limit 1;
  if v_bucket is null then
    select bucket.id into v_bucket from public.planner_buckets bucket
    where bucket.board_id = v_board and bucket.archived_at is null
    order by bucket.sort_order, bucket.id limit 1;
  end if;
  if v_bucket is null then raise exception 'Planner board has no active bucket'; end if;

  -- Same guards and projection columns as create_assistant_task: the canonical assignee is set
  -- below through set_planner_task_assignees_internal, never through the legacy name column.
  v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
  v_previous_projection_guard := current_setting('app.planner_assignment_projection_write', true);
  perform set_config('app.planner_task_audit_write', 'on', true);
  perform set_config('app.planner_assignment_projection_write', 'on', true);
  insert into public.planner_tasks (
    board_id, bucket_id, title, client_id, client_name, assigned_to_name,
    helper_names, unresolved_assignee_names, due_date, notes, status, priority,
    source, import_hash, checklist, recurrence_rule, recurrence_until
  ) values (
    v_board, v_bucket, btrim(p_title), p_client_id, v_client_name, null,
    '{}'::text[], '{}'::text[], current_date, nullif(btrim(coalesce(p_notes, '')), ''), 'to_do', 'normal',
    'recurring', 'rec-template-' || gen_random_uuid()::text, '[]'::jsonb,
    btrim(p_recurrence_rule), p_recurrence_until
  )
  returning * into v_task;
  perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
  perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_projection_guard, ''), true);

  perform public.set_planner_task_assignees_internal(
    v_task.id, array[v_assignee_id], v_profile.id, true, 'assistant_create_recurring'
  );
  select * into v_task from public.planner_tasks where id = v_task.id;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', v_task.id, 'assistant_created_recurring', v_profile.id, v_actor_name,
    jsonb_build_object('title', v_task.title, 'assignee_profile_id', v_assignee_id,
      'recurrence_rule', v_task.recurrence_rule, 'recurrence_until', v_task.recurrence_until));

  return v_task;
end;
$$;

revoke all on function public.create_assistant_recurring_task(p_title text, p_recurrence_rule text, p_recurrence_until date, p_assignee_name text, p_client_id uuid, p_client_name text, p_notes text, p_actor_profile_id uuid) from public, anon;
grant execute on function public.create_assistant_recurring_task(p_title text, p_recurrence_rule text, p_recurrence_until date, p_assignee_name text, p_client_id uuid, p_client_name text, p_notes text, p_actor_profile_id uuid) to authenticated, service_role;
