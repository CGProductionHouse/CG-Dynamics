-- Backend acceptance hardening for Assistant, Calendar, reports, and durable jobs.
-- Additive/idempotent. Review in the Supabase SQL editor before production use.

-- Notifications are server-owned. Recipients may select their own rows and use
-- narrow mark-read RPCs, but cannot create notifications or rewrite content.
drop policy if exists "notifications read own" on public.notifications;
drop policy if exists "notifications update own" on public.notifications;
drop policy if exists "notifications: active recipient read" on public.notifications;
create policy "notifications: active recipient read"
  on public.notifications for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
    )
  );

revoke insert, update, delete on table public.notifications from public, anon, authenticated;
grant select on table public.notifications to authenticated;
revoke all on function public.create_notification(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then raise exception 'Active staff access required'; end if;
  update public.notifications notification
  set read_at = now()
  where notification.id = p_notification_id
    and notification.user_id = auth.uid()
    and notification.read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_updated integer;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then raise exception 'Active staff access required'; end if;
  update public.notifications notification
  set read_at = now()
  where notification.user_id = auth.uid()
    and notification.read_at is null;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_notification_read(uuid) from public, anon, authenticated;
revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- Assistant memory is personal AND limited to active workforce profiles.
drop policy if exists "assistant_memory own all" on public.assistant_memory;
drop policy if exists "assistant_memory: active staff own rows" on public.assistant_memory;
create policy "assistant_memory: active staff own rows"
  on public.assistant_memory for all to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
    )
  );

revoke all on table public.assistant_memory from public, anon, authenticated;
grant select, insert, update, delete on table public.assistant_memory to authenticated;
grant all on table public.assistant_memory to service_role;

-- Staff may create an unassigned Assistant task on a visible staff board.
-- Only active managers/admins may assign it; assignments are canonical rows.
create or replace function public.create_assistant_task(
  p_title text,
  p_assignee_name text default null,
  p_due_date date default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_notes text default null
) returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
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
  where profile.id = auth.uid()
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
    if v_actor.role not in ('admin', 'manager') then
      raise exception 'Only a manager can assign Planner tasks';
    end if;
    select count(*), (array_agg(profile.id order by profile.id))[1] into v_assignee_count, v_assignee_id
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
      and lower(btrim(profile.full_name)) = lower(btrim(p_assignee_name));
    if v_assignee_count <> 1 then raise exception 'Assignee must match one active workforce profile'; end if;
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
      v_task.id, array[v_assignee_id], auth.uid(), true, 'assistant_create'
    );
  end if;
  select * into v_task from public.planner_tasks where id = v_task.id;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', v_task.id, 'assistant_created', auth.uid(), v_actor.full_name,
    jsonb_build_object('title', v_task.title, 'assignee_profile_id', v_assignee_id, 'due_date', v_task.due_date));
  if v_assignee_id is not null and v_assignee_id <> auth.uid() then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
    values (v_assignee_id, 'task_assigned', 'New task assigned',
      coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_task.title,
      'planner_task', v_task.id);
  end if;
  return v_task;
end;
$$;

-- Assignment changes use the canonical assignment model. Status changes use the
-- canonical status RPC, including done completion; completion never archives.
create or replace function public.update_assistant_task(
  p_task_id uuid,
  p_action text,
  p_assignee_name text default null,
  p_due_date date default null,
  p_comment text default null
) returns public.planner_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
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
  where profile.id = auth.uid()
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
      where assignment.task_id = v_task.id and assignment.profile_id = auth.uid()
    );
  else
    select coalesce(array_agg(profile.id order by profile.id), '{}'::uuid[]) into v_name_matches
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
      and nullif(btrim(v_actor.full_name), '') is not null
      and lower(btrim(profile.full_name)) = lower(btrim(v_actor.full_name));
    v_is_assignee := cardinality(v_name_matches) = 1
      and v_name_matches[1] = auth.uid()
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
      auth.uid(), true, 'assistant_assignment'
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
    select * into v_task from public.update_planner_task_status(v_task.id, 'done');
    v_changed := v_old_status is distinct from v_task.status;
  elsif p_action = 'block' then
    v_old_status := v_task.status;
    if v_task.status <> 'blocked' then
      select * into v_task from public.update_planner_task_status(v_task.id, 'blocked');
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
    values ('planner_task', v_task.id, 'assistant_' || p_action, auth.uid(), v_actor.full_name,
      jsonb_build_object('assignee_profile_id', v_assignee_id, 'due_date', v_task.due_date, 'comment', p_comment));
  end if;
  if v_changed and p_action in ('assign', 'reassign') and v_assignee_id is not null and v_assignee_id <> auth.uid() then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
    values (v_assignee_id, 'task_assigned', 'Task assigned to you',
      coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_task.title,
      'planner_task', v_task.id);
  end if;
  return v_task;
end;
$$;

revoke all on function public.create_assistant_task(text, text, date, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_assistant_task(text, text, date, uuid, text, text) to authenticated;
revoke all on function public.update_assistant_task(uuid, text, text, date, text) from public, anon, authenticated;
grant execute on function public.update_assistant_task(uuid, text, text, date, text) to authenticated;

-- Applying a debrief mutates a Calendar event, so it requires the same active
-- manager/admin authority as normal Calendar writes. There is no participant ACL.
create or replace function public.apply_meeting_debrief(
  p_debrief_id uuid,
  p_summary text,
  p_decisions jsonb,
  p_unresolved jsonb,
  p_tasks jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debrief public.meeting_debriefs;
  v_actor public.profiles;
  v_board uuid;
  v_bucket uuid;
  v_task jsonb;
  v_title text;
  v_assignee text;
  v_assignee_id uuid;
  v_assignee_count integer;
  v_due date;
  v_client_id uuid;
  v_client_name text;
  v_new public.planner_tasks;
  v_created integer := 0;
  v_notes_block text;
  v_line text;
  v_previous_audit_guard text;
  v_previous_projection_guard text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_active
    and profile.role in ('admin', 'manager');
  if v_actor.id is null then raise exception 'Active manager access required'; end if;

  select * into v_debrief from public.meeting_debriefs where id = p_debrief_id for update;
  if v_debrief.id is null then raise exception 'Debrief not found'; end if;
  if v_debrief.status <> 'draft' then raise exception 'This debrief has already been finalised'; end if;
  if jsonb_typeof(coalesce(p_tasks, '[]'::jsonb)) <> 'array' then raise exception 'Tasks must be an array'; end if;
  if jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) > 50 then raise exception 'Too many tasks in one debrief'; end if;

  select board.id into v_board from public.planner_boards board
  where board.slug = 'operations-todo'
    and board.archived_at is null
    and (board.visibility in ('public_internal', 'staff') or (board.visibility = 'admin_only' and v_actor.role = 'admin'))
  limit 1;
  if v_board is null and jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) > 0 then
    raise exception 'Planner board not found or not visible';
  end if;

  if v_debrief.calendar_event_id is not null then
    v_notes_block := E'\n\n- Debrief ' || to_char(now(), 'YYYY-MM-DD') || ' (' || coalesce(v_actor.full_name, 'CG Assistant') || ') -';
    if nullif(btrim(coalesce(p_summary, '')), '') is not null then v_notes_block := v_notes_block || E'\nBackground: ' || btrim(p_summary); end if;
    if jsonb_typeof(coalesce(p_decisions, '[]'::jsonb)) = 'array' then
      for v_line in select value from jsonb_array_elements_text(coalesce(p_decisions, '[]'::jsonb)) loop
        v_notes_block := v_notes_block || E'\nDecision: ' || v_line;
      end loop;
    end if;
    if jsonb_typeof(coalesce(p_unresolved, '[]'::jsonb)) = 'array' then
      for v_line in select value from jsonb_array_elements_text(coalesce(p_unresolved, '[]'::jsonb)) loop
        v_notes_block := v_notes_block || E'\nUnresolved: ' || v_line;
      end loop;
    end if;
    update public.company_calendar_events
    set notes = coalesce(notes, '') || v_notes_block, updated_at = now()
    where id = v_debrief.calendar_event_id;
    if not found then raise exception 'Calendar event not found'; end if;
  end if;

  for v_task in select value from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) loop
    v_title := btrim(coalesce(v_task ->> 'title', ''));
    if v_title = '' then continue; end if;
    v_assignee := nullif(btrim(coalesce(v_task ->> 'assignee_name', '')), '');
    v_assignee_id := null;
    if v_assignee is not null then
      select count(*), (array_agg(profile.id order by profile.id))[1] into v_assignee_count, v_assignee_id
      from public.profiles profile
      where profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
        and lower(btrim(profile.full_name)) = lower(v_assignee);
      if v_assignee_count <> 1 then raise exception 'Assignee must match one active workforce profile'; end if;
    end if;
    v_due := case when coalesce(v_task ->> 'due_date', '') ~ '^\d{4}-\d{2}-\d{2}$' then (v_task ->> 'due_date')::date else null end;
    v_client_id := case when coalesce(v_task ->> 'client_id', '') ~* '^[0-9a-f-]{36}$' then (v_task ->> 'client_id')::uuid else v_debrief.client_id end;
    if v_client_id is not null then
      select client.name into v_client_name from public.clients client where client.id = v_client_id;
      if v_client_name is null then raise exception 'Planner client not found'; end if;
    else
      v_client_name := null;
    end if;

    select bucket.id into v_bucket from public.planner_buckets bucket
    where bucket.board_id = v_board and bucket.archived_at is null
      and upper(bucket.name) = case when v_client_id is not null then 'CLIENT REQUESTS' else 'ADMIN / TO DO' end
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
      v_board, v_bucket, v_title, v_client_id, v_client_name, null,
      '{}'::text[], '{}'::text[], v_due,
      'From meeting debrief' || case when v_debrief.meeting_title is not null then ': ' || v_debrief.meeting_title else '' end,
      'to_do', 'normal', 'cg_assistant_meeting', 'cgm-' || gen_random_uuid()::text, '[]'::jsonb
    ) returning * into v_new;
    perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
    perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_projection_guard, ''), true);
    if v_assignee_id is not null then
      perform public.set_planner_task_assignees_internal(v_new.id, array[v_assignee_id], auth.uid(), true, 'meeting_debrief');
    end if;
    insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
    values ('planner_task', v_new.id, 'assistant_created', auth.uid(), v_actor.full_name,
      jsonb_build_object('title', v_new.title, 'assignee_profile_id', v_assignee_id, 'due_date', v_new.due_date, 'via', 'meeting_debrief'));
    if v_assignee_id is not null and v_assignee_id <> auth.uid() then
      insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
      values (v_assignee_id, 'task_assigned', 'New task from meeting',
        coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_new.title,
        'planner_task', v_new.id);
    end if;
    v_created := v_created + 1;
  end loop;

  update public.meeting_debriefs set
    status = 'applied', applied_at = now(), summary = coalesce(p_summary, summary),
    decisions = coalesce(p_decisions, decisions), unresolved = coalesce(p_unresolved, unresolved),
    tasks = coalesce(p_tasks, tasks),
    applied_actions = jsonb_build_object('tasks_created', v_created, 'notes_saved', v_debrief.calendar_event_id is not null)
  where id = v_debrief.id;
  return jsonb_build_object('tasks_created', v_created, 'notes_saved', v_debrief.calendar_event_id is not null);
end;
$$;

revoke all on function public.apply_meeting_debrief(uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_meeting_debrief(uuid, text, jsonb, jsonb, jsonb) to authenticated;

-- Report preparation is operational management, including direct RPC calls.
create or replace function public.prepare_monthly_reports(p_month date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month date;
  v_start date;
  v_end date;
  v_next date;
  v_label text;
  v_client record;
  v_exists uuid;
  v_created integer := 0;
  v_reused integer := 0;
begin
  if auth.role() is distinct from 'service_role' and not public.is_active_planner_manager() then
    raise exception 'Active manager access required';
  end if;
  v_month := date_trunc('month', coalesce(p_month, current_date - interval '1 month'))::date;
  if v_month >= date_trunc('month', current_date)::date then raise exception 'Report prep only runs for a completed month'; end if;
  v_start := v_month;
  v_next := (v_month + interval '1 month')::date;
  v_end := (v_next - interval '1 day')::date;
  v_label := to_char(v_month, 'FMMonth YYYY');
  for v_client in select id, name from public.clients where active = true loop
    select report.id into v_exists from public.reports report
    where report.client_id = v_client.id and report.platform is null
      and report.period_end >= v_start and report.period_end < v_next
    order by report.created_at desc limit 1;
    if v_exists is null then
      insert into public.reports(client_id, platform, period_start, period_end, status, report_title)
      values (v_client.id, null, v_start, v_end, 'draft', v_client.name || ' ' || v_label || ' Report');
      v_created := v_created + 1;
    else
      v_reused := v_reused + 1;
    end if;
    v_exists := null;
  end loop;
  return jsonb_build_object('month', to_char(v_month, 'YYYY-MM'), 'created', v_created, 'reused', v_reused);
end;
$$;

revoke all on function public.prepare_monthly_reports(date) from public, anon, authenticated;
grant execute on function public.prepare_monthly_reports(date) to authenticated, service_role;

-- Meta collection progress is checkpointed with opaque cursors, never provider
-- paging URLs (which can contain access tokens). Per-platform state also keeps a
-- retry from repeating a completed platform or terminating before both finish.
alter table public.meta_sync_batch_items
  add column if not exists facebook_next_cursor text,
  add column if not exists instagram_next_cursor text,
  add column if not exists facebook_sync_state text not null default 'pending',
  add column if not exists instagram_sync_state text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.meta_sync_batch_items'::regclass
      and conname = 'meta_sync_batch_items_safe_facebook_cursor'
  ) then
    alter table public.meta_sync_batch_items
      add constraint meta_sync_batch_items_safe_facebook_cursor check (
        facebook_next_cursor is null or (
          length(facebook_next_cursor) between 1 and 4096
          and facebook_next_cursor !~ '[[:cntrl:]]'
        )
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.meta_sync_batch_items'::regclass
      and conname = 'meta_sync_batch_items_safe_instagram_cursor'
  ) then
    alter table public.meta_sync_batch_items
      add constraint meta_sync_batch_items_safe_instagram_cursor check (
        instagram_next_cursor is null or (
          length(instagram_next_cursor) between 1 and 4096
          and instagram_next_cursor !~ '[[:cntrl:]]'
        )
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.meta_sync_batch_items'::regclass
      and conname = 'meta_sync_batch_items_facebook_state'
  ) then
    alter table public.meta_sync_batch_items
      add constraint meta_sync_batch_items_facebook_state check (
        facebook_sync_state in ('pending', 'facts_pending', 'complete', 'failed', 'not_applicable')
      ) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.meta_sync_batch_items'::regclass
      and conname = 'meta_sync_batch_items_instagram_state'
  ) then
    alter table public.meta_sync_batch_items
      add constraint meta_sync_batch_items_instagram_state check (
        instagram_sync_state in ('pending', 'facts_pending', 'complete', 'failed', 'not_applicable')
      ) not valid;
  end if;
end;
$$;

drop function if exists public.claim_sync_batch_items(integer, uuid);
create function public.claim_sync_batch_items(
  p_limit integer default 5,
  p_batch_id uuid default null
)
returns table (
  id uuid, batch_id uuid, client_id uuid, client_name text, month text,
  status text, attempts int, posts_synced int, reports_created int,
  reports_reused int, reports_updated int, warnings jsonb, error text,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz,
  facebook_next_cursor text, instagram_next_cursor text,
  facebook_sync_state text, instagram_sync_state text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.meta_sync_batch_items item set
    status = case when item.attempts >= 3 then 'failed' else 'queued' end,
    error = case when item.attempts >= 3
      then 'Sync worker timed out repeatedly. Retry this client after checking the Meta connection.'
      else null end,
    started_at = null,
    finished_at = case when item.attempts >= 3 then now() else null end,
    facebook_sync_state = case
      when item.attempts >= 3 and item.facebook_sync_state not in ('complete', 'failed', 'not_applicable') then 'failed'
      else item.facebook_sync_state end,
    instagram_sync_state = case
      when item.attempts >= 3 and item.instagram_sync_state not in ('complete', 'failed', 'not_applicable') then 'failed'
      else item.instagram_sync_state end,
    facebook_next_cursor = case when item.attempts >= 3 then null else item.facebook_next_cursor end,
    instagram_next_cursor = case when item.attempts >= 3 then null else item.instagram_next_cursor end
  where item.status = 'running'
    and item.started_at < now() - interval '5 minutes'
    and (p_batch_id is null or item.batch_id = p_batch_id);

  return query
  with claimed as (
    select item.id
    from public.meta_sync_batch_items item
    where item.status = 'queued'
      and (p_batch_id is null or item.batch_id = p_batch_id)
    order by item.created_at, item.id
    limit greatest(1, least(coalesce(p_limit, 5), 10))
    for update skip locked
  )
  update public.meta_sync_batch_items item set
    status = 'running', attempts = item.attempts + 1,
    started_at = now(), finished_at = null, error = null
  from claimed
  where item.id = claimed.id
  returning item.id, item.batch_id, item.client_id, item.client_name,
    item.month, item.status, item.attempts, item.posts_synced,
    item.reports_created, item.reports_reused, item.reports_updated,
    item.warnings, item.error, item.started_at, item.finished_at,
    item.created_at, item.facebook_next_cursor, item.instagram_next_cursor,
    item.facebook_sync_state, item.instagram_sync_state;
end;
$$;

revoke all on function public.claim_sync_batch_items(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_sync_batch_items(integer, uuid) to service_role;

-- Durable queue definitions were previously referenced but not committed.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.background_jobs'::regclass
      and conname = 'background_jobs_allowed_type'
  ) then
    alter table public.background_jobs add constraint background_jobs_allowed_type
      check (job_type in ('meta_sync', 'report_prep')) not valid;
  end if;
end;
$$;

drop policy if exists "bgjobs read own or manager" on public.background_jobs;
drop policy if exists "bgjobs: active requester or manager read" on public.background_jobs;
create policy "bgjobs: active requester or manager read"
  on public.background_jobs for select to authenticated
  using (
    exists (
      select 1 from public.profiles profile
      where profile.id = auth.uid()
        and profile.is_active
        and profile.role in ('admin', 'manager')
        and (background_jobs.requested_by = auth.uid() or profile.role in ('admin', 'manager'))
    )
  );

revoke all on table public.background_jobs from public, anon, authenticated;
grant select on table public.background_jobs to authenticated;
grant all on table public.background_jobs to service_role;

create or replace function public.enqueue_background_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_idempotency_key text default null,
  p_max_attempts integer default 3
) returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.profiles;
  v_job public.background_jobs;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid()
    and profile.is_active
    and profile.role in ('admin', 'manager');
  if v_actor.id is null then raise exception 'Active manager access required'; end if;
  if p_job_type not in ('meta_sync', 'report_prep') then raise exception 'Unsupported background job type'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Job payload must be an object'; end if;
  if p_max_attempts < 1 or p_max_attempts > 10 then raise exception 'max_attempts must be between 1 and 10'; end if;

  insert into public.background_jobs(
    job_type, payload, idempotency_key, max_attempts, requested_by, requested_by_name
  ) values (
    p_job_type, p_payload, nullif(btrim(coalesce(p_idempotency_key, '')), ''),
    p_max_attempts, auth.uid(), v_actor.full_name
  )
  on conflict (idempotency_key) do nothing
  returning * into v_job;

  if v_job.id is null and nullif(btrim(coalesce(p_idempotency_key, '')), '') is not null then
    select * into v_job from public.background_jobs job
    where job.idempotency_key = nullif(btrim(p_idempotency_key), '');
    if v_job.requested_by is distinct from auth.uid() or v_job.job_type is distinct from p_job_type then
      raise exception 'Idempotency key is already in use';
    end if;
  end if;
  return v_job;
end;
$$;

create or replace function public.claim_next_background_job(p_worker text)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.background_jobs;
  v_failed_job public.background_jobs;
begin
  if nullif(btrim(coalesce(p_worker, '')), '') is null then raise exception 'Worker identity required'; end if;

  for v_failed_job in
    update public.background_jobs job set
      status = 'failed',
      error = 'Worker lease expired after maximum attempts',
      locked_by = null,
      locked_at = null,
      finished_at = now(),
      updated_at = now()
    where job.status = 'running'
      and job.locked_at < now() - interval '5 minutes'
      and job.attempts >= job.max_attempts
    returning job.*
  loop
    if v_failed_job.requested_by is not null then
      insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link)
      values (v_failed_job.requested_by, 'background_job_failed', 'Background job failed',
        replace(initcap(replace(v_failed_job.job_type, '_', ' ')), 'Meta Sync', 'Meta sync') ||
          ' job failed after ' || v_failed_job.attempts || ' attempt' ||
          case when v_failed_job.attempts = 1 then ' because its worker lease expired.' else 's because its worker lease expired.' end,
        'background_job', v_failed_job.id,
        case when v_failed_job.job_type = 'meta_sync' then '/admin/integrations/meta'
             when v_failed_job.job_type = 'report_prep' then '/admin/reports' else null end);
    end if;
  end loop;

  update public.background_jobs job set
    status = 'queued',
    locked_by = null,
    locked_at = null,
    run_after = now(),
    finished_at = null,
    updated_at = now()
  where job.status = 'running'
    and job.locked_at < now() - interval '5 minutes'
    and job.attempts < job.max_attempts;

  with candidate as (
    select job.id from public.background_jobs job
    where job.status = 'queued'
      and job.run_after <= now()
      and job.attempts < job.max_attempts
    order by job.created_at, job.id
    limit 1
    for update skip locked
  )
  update public.background_jobs job set
    status = 'running', attempts = job.attempts + 1,
    locked_by = btrim(p_worker), locked_at = now(), error = null, updated_at = now()
  from candidate where job.id = candidate.id returning job.* into v_job;
  return v_job;
end;
$$;

drop function if exists public.update_background_job_progress(uuid, integer);
create or replace function public.update_background_job_progress(p_id uuid, p_locked_by text, p_progress integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_locked_by, '')), '') is null then raise exception 'Lease owner required'; end if;
  update public.background_jobs set
    progress = greatest(progress, least(99, greatest(0, p_progress))),
    locked_at = now(),
    updated_at = now()
  where id = p_id and status = 'running' and locked_by = btrim(p_locked_by);
  if not found then raise exception 'Running background job lease not found'; end if;
end;
$$;

drop function if exists public.complete_background_job(uuid, jsonb);
create or replace function public.complete_background_job(p_id uuid, p_locked_by text, p_result jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.background_jobs;
begin
  if nullif(btrim(coalesce(p_locked_by, '')), '') is null then raise exception 'Lease owner required'; end if;
  update public.background_jobs set
    status = 'succeeded', result = coalesce(p_result, '{}'::jsonb), progress = 100,
    error = null, locked_by = null, locked_at = null, finished_at = now(), updated_at = now()
  where id = p_id and status = 'running' and locked_by = btrim(p_locked_by) returning * into v_job;
  if v_job.id is null then raise exception 'Running background job lease not found'; end if;
  if v_job.requested_by is not null then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link)
    values (v_job.requested_by, 'background_job_succeeded', 'Background job finished',
      replace(initcap(replace(v_job.job_type, '_', ' ')), 'Meta Sync', 'Meta sync') || ' job finished successfully.',
      'background_job', v_job.id,
      case when v_job.job_type = 'meta_sync' then '/admin/integrations/meta'
           when v_job.job_type = 'report_prep' then '/admin/reports' else null end);
  end if;
end;
$$;

drop function if exists public.fail_background_job(uuid, text);
create or replace function public.fail_background_job(p_id uuid, p_locked_by text, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_job public.background_jobs;
begin
  if nullif(btrim(coalesce(p_locked_by, '')), '') is null then raise exception 'Lease owner required'; end if;
  update public.background_jobs job set
    status = case when job.attempts >= job.max_attempts then 'failed' else 'queued' end,
    error = left(coalesce(p_error, 'Background job failed'), 500),
    locked_by = null, locked_at = null,
    run_after = case when job.attempts >= job.max_attempts then job.run_after
      else now() + make_interval(mins => least(60, (power(2, greatest(0, job.attempts - 1)))::integer)) end,
    finished_at = case when job.attempts >= job.max_attempts then now() else null end,
    updated_at = now()
  where job.id = p_id and job.status = 'running' and job.locked_by = btrim(p_locked_by) returning * into v_job;
  if v_job.id is null then raise exception 'Running background job lease not found'; end if;
  if v_job.status = 'failed' and v_job.requested_by is not null then
    insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link)
    values (v_job.requested_by, 'background_job_failed', 'Background job failed',
      replace(initcap(replace(v_job.job_type, '_', ' ')), 'Meta Sync', 'Meta sync') ||
        ' job failed after ' || v_job.attempts || ' attempt' || case when v_job.attempts = 1 then '.' else 's.' end,
      'background_job', v_job.id,
      case when v_job.job_type = 'meta_sync' then '/admin/integrations/meta'
           when v_job.job_type = 'report_prep' then '/admin/reports' else null end);
  end if;
end;
$$;

create or replace function public.defer_background_job(
  p_id uuid,
  p_locked_by text,
  p_progress integer default 70,
  p_delay_seconds integer default 30
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(coalesce(p_locked_by, '')), '') is null then raise exception 'Lease owner required'; end if;
  update public.background_jobs job set
    status = 'queued',
    attempts = greatest(0, job.attempts - 1),
    progress = greatest(job.progress, least(99, greatest(0, p_progress))),
    locked_by = null,
    locked_at = null,
    run_after = now() + make_interval(secs => greatest(5, least(300, p_delay_seconds))),
    error = null,
    updated_at = now()
  where job.id = p_id and job.status = 'running' and job.locked_by = btrim(p_locked_by);
  if not found then raise exception 'Running background job lease not found'; end if;
end;
$$;

revoke all on function public.enqueue_background_job(text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.enqueue_background_job(text, jsonb, text, integer) to authenticated;
revoke all on function public.claim_next_background_job(text) from public, anon, authenticated;
revoke all on function public.update_background_job_progress(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_background_job(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_background_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.defer_background_job(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_next_background_job(text) to service_role;
grant execute on function public.update_background_job_progress(uuid, text, integer) to service_role;
grant execute on function public.complete_background_job(uuid, text, jsonb) to service_role;
grant execute on function public.fail_background_job(uuid, text, text) to service_role;
grant execute on function public.defer_background_job(uuid, text, integer, integer) to service_role;

notify pgrst, 'reload schema';
