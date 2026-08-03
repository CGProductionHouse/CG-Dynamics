-- Personal daily Assistant capture, timeline and restrained in-app reminders.
-- Raw audio is never stored. The Edge Function stores only the transcript and
-- draft review. Confirmed tasks remain canonical planner_tasks with audit and
-- notifications. All personal rows are author-only through RLS.

create table if not exists public.assistant_day_captures (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  capture_date date not null default ((now() at time zone 'Africa/Johannesburg')::date),
  transcript text not null,
  transcript_hash text not null,
  detected_language text not null default 'unknown'
    check (detected_language in ('en', 'af', 'mixed', 'unknown')),
  summary text not null default '',
  calls jsonb not null default '[]'::jsonb,
  decisions jsonb not null default '[]'::jsonb,
  promises jsonb not null default '[]'::jsonb,
  unresolved jsonb not null default '[]'::jsonb,
  notes jsonb not null default '[]'::jsonb,
  mentions jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  source_context jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'applied', 'discarded')),
  applied_actions jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assistant_day_captures_user_hash_day_idx
  on public.assistant_day_captures (user_id, transcript_hash, capture_date);
create index if not exists assistant_day_captures_user_created_idx
  on public.assistant_day_captures (user_id, created_at desc);

drop trigger if exists trg_assistant_day_captures_updated_at on public.assistant_day_captures;
create trigger trg_assistant_day_captures_updated_at before update on public.assistant_day_captures
  for each row execute function public.update_planner_updated_at();

alter table public.assistant_day_captures enable row level security;
drop policy if exists "assistant day captures own read" on public.assistant_day_captures;
create policy "assistant day captures own read" on public.assistant_day_captures
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid()) and profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
    )
  );
revoke all on table public.assistant_day_captures from public, anon, authenticated;
grant select on table public.assistant_day_captures to authenticated;
grant all on table public.assistant_day_captures to service_role;

create table if not exists public.assistant_day_items (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.assistant_day_captures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('call', 'decision', 'promise', 'task', 'follow_up', 'note', 'question')),
  content text not null,
  client_id uuid references public.clients(id) on delete set null,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  due_date date,
  reminder_at timestamptz,
  planner_task_id uuid references public.planner_tasks(id) on delete set null,
  state text not null default 'open' check (state in ('open', 'completed', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assistant_day_items_user_created_idx
  on public.assistant_day_items (user_id, created_at desc);
create index if not exists assistant_day_items_user_open_idx
  on public.assistant_day_items (user_id, state, due_date) where state = 'open';

drop trigger if exists trg_assistant_day_items_updated_at on public.assistant_day_items;
create trigger trg_assistant_day_items_updated_at before update on public.assistant_day_items
  for each row execute function public.update_planner_updated_at();

alter table public.assistant_day_items enable row level security;
drop policy if exists "assistant day items own read" on public.assistant_day_items;
create policy "assistant day items own read" on public.assistant_day_items
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles profile
      where profile.id = (select auth.uid()) and profile.is_active
        and profile.role in ('admin', 'manager', 'staff', 'team')
    )
  );
revoke all on table public.assistant_day_items from public, anon, authenticated;
grant select on table public.assistant_day_items to authenticated;
grant all on table public.assistant_day_items to service_role;

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists snoozed_until timestamptz,
  add column if not exists dismissed_at timestamptz;
create unique index if not exists notifications_user_dedupe_key_idx
  on public.notifications (user_id, dedupe_key) where dedupe_key is not null;

create or replace function public.assistant_normalise_task_title(p_value text)
returns text language sql immutable set search_path = public as $$
  select regexp_replace(lower(coalesce(p_value, '')), '[^a-z0-9]+', '', 'g')
$$;
revoke all on function public.assistant_normalise_task_title(text) from public, anon, authenticated;
grant execute on function public.assistant_normalise_task_title(text) to service_role;

create or replace function public.apply_assistant_day_capture(
  p_capture_id uuid,
  p_summary text,
  p_calls jsonb,
  p_decisions jsonb,
  p_promises jsonb,
  p_unresolved jsonb,
  p_notes jsonb,
  p_suggestions jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_capture public.assistant_day_captures;
  v_actor public.profiles;
  v_board uuid;
  v_bucket uuid;
  v_suggestion jsonb;
  v_suggestion_id text;
  v_kind text;
  v_title text;
  v_detail text;
  v_selected boolean;
  v_client_id uuid;
  v_client_name text;
  v_assignee_id uuid;
  v_due date;
  v_reminder timestamptz;
  v_existing_task_id uuid;
  v_task public.planner_tasks;
  v_new public.planner_tasks;
  v_item_kind text;
  v_created integer := 0;
  v_updated integer := 0;
  v_linked integer := 0;
  v_notes_saved integer := 0;
  v_entry text;
  v_previous_audit_guard text;
  v_previous_projection_guard text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;

  select * into v_capture from public.assistant_day_captures capture
  where capture.id = p_capture_id and capture.user_id = auth.uid() for update;
  if v_capture.id is null then raise exception 'Daily capture not found'; end if;
  if v_capture.status <> 'draft' then raise exception 'This daily capture has already been finalised'; end if;
  if jsonb_typeof(coalesce(p_suggestions, '[]'::jsonb)) <> 'array' then
    raise exception 'Suggestions must be an array';
  end if;
  if jsonb_array_length(coalesce(p_suggestions, '[]'::jsonb)) > 50 then
    raise exception 'Too many suggestions in one capture';
  end if;

  select board.id into v_board from public.planner_boards board
  where board.slug = 'operations-todo' and board.archived_at is null
    and (board.visibility in ('public_internal', 'staff')
      or (board.visibility = 'admin_only' and v_actor.role = 'admin'))
  limit 1;

  for v_suggestion in select value from jsonb_array_elements(coalesce(p_suggestions, '[]'::jsonb)) loop
    v_selected := lower(coalesce(v_suggestion ->> 'selected', 'false')) = 'true';
    if not v_selected then continue; end if;
    v_suggestion_id := nullif(btrim(coalesce(v_suggestion ->> 'id', '')), '');
    v_kind := lower(btrim(coalesce(v_suggestion ->> 'kind', 'note')));
    v_title := left(btrim(coalesce(v_suggestion ->> 'title', '')), 500);
    v_detail := left(btrim(coalesce(v_suggestion ->> 'detail', '')), 4000);
    if v_title = '' then continue; end if;
    if v_kind not in ('create_task', 'update_task', 'follow_up', 'note') then
      raise exception 'Unsupported daily capture item type';
    end if;

    v_client_id := null;
    v_client_name := null;
    if coalesce(v_suggestion ->> 'client_id', '') ~* '^[0-9a-f-]{36}$' then
      v_client_id := (v_suggestion ->> 'client_id')::uuid;
      select client.name into v_client_name from public.clients client
      where client.id = v_client_id and client.active;
      if v_client_name is null then raise exception 'Selected client is not active'; end if;
    end if;

    v_assignee_id := null;
    if coalesce(v_suggestion ->> 'assignee_profile_id', '') ~* '^[0-9a-f-]{36}$' then
      v_assignee_id := (v_suggestion ->> 'assignee_profile_id')::uuid;
      if not exists (
        select 1 from public.profiles profile where profile.id = v_assignee_id
          and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
      ) then raise exception 'Selected assignee is not an active staff member'; end if;
      if v_actor.role not in ('admin', 'manager') and v_assignee_id <> auth.uid() then
        raise exception 'Only a manager can assign work to another staff member';
      end if;
    end if;

    v_due := case when coalesce(v_suggestion ->> 'due_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      then (v_suggestion ->> 'due_date')::date else null end;
    begin
      v_reminder := nullif(btrim(coalesce(v_suggestion ->> 'reminder_at', '')), '')::timestamptz;
    exception when others then
      raise exception 'Reminder time is invalid';
    end;
    v_existing_task_id := case when coalesce(v_suggestion ->> 'existing_task_id', '') ~* '^[0-9a-f-]{36}$'
      then (v_suggestion ->> 'existing_task_id')::uuid else null end;
    v_task := null;
    v_new := null;

    if v_existing_task_id is not null then
      select task.* into v_task from public.planner_tasks task
      join public.planner_boards board on board.id = task.board_id
      where task.id = v_existing_task_id and task.archived_at is null
        and task.status not in ('done', 'completed', 'approved', 'scheduled', 'scheduled_posted', 'moved_to_tomorrow')
        and (board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and v_actor.role = 'admin'))
      for update of task;
      if v_task.id is null then raise exception 'Selected existing task is not available'; end if;
      if v_client_id is not null and v_task.client_id is distinct from v_client_id then
        raise exception 'Selected task belongs to a different client';
      end if;
      if v_client_id is null then
        v_client_id := v_task.client_id;
        v_client_name := v_task.client_name;
      end if;
      if v_actor.role not in ('admin', 'manager') and not exists (
        select 1 from public.planner_task_assignees assignment
        where assignment.task_id = v_task.id and assignment.profile_id = auth.uid()
      ) then raise exception 'Only a manager or assigned staff member can update this task'; end if;
    elsif v_kind in ('create_task', 'follow_up') then
      select task.* into v_task from public.planner_tasks task
      join public.planner_boards board on board.id = task.board_id
      where task.archived_at is null
        and task.status not in ('done', 'completed', 'approved', 'scheduled', 'scheduled_posted', 'moved_to_tomorrow')
        and task.created_at >= now() - interval '45 days'
        and public.assistant_normalise_task_title(task.title) = public.assistant_normalise_task_title(v_title)
        and task.client_id is not distinct from v_client_id
        and (board.visibility in ('public_internal', 'staff')
          or (board.visibility = 'admin_only' and v_actor.role = 'admin'))
      order by task.updated_at desc limit 1;
    end if;

    if v_kind in ('create_task', 'follow_up') and v_task.id is null then
      if v_board is null then raise exception 'Planner board not found or not visible'; end if;
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
        'From personal CG Assistant capture' || case when v_detail <> '' then E'\n' || v_detail else '' end,
        'to_do', 'normal', 'cg_assistant_daily',
        'cgad-' || p_capture_id::text || '-' || coalesce(v_suggestion_id, gen_random_uuid()::text), '[]'::jsonb
      ) returning * into v_new;
      perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
      perform set_config('app.planner_assignment_projection_write', coalesce(v_previous_projection_guard, ''), true);
      if v_assignee_id is not null then
        perform public.set_planner_task_assignees_internal(
          v_new.id, array[v_assignee_id], auth.uid(), true, 'assistant_daily_capture'
        );
      end if;
      select * into v_task from public.planner_tasks where id = v_new.id;
      insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
      values ('planner_task', v_task.id, 'assistant_daily_created', auth.uid(), v_actor.full_name,
        jsonb_build_object('capture_id', p_capture_id, 'assignee_profile_id', v_assignee_id,
          'client_id', v_client_id, 'due_date', v_due));
      if v_assignee_id is not null and v_assignee_id <> auth.uid() then
        insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link, dedupe_key)
        values (v_assignee_id, 'task_assigned', 'New task from a voice note',
          coalesce(v_actor.full_name, 'CG Assistant') || ' assigned you: ' || v_task.title,
          'planner_task', v_task.id, '/admin/work?tab=board', 'assistant-daily-assignment:' || v_task.id::text)
        on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
      end if;
      v_created := v_created + 1;
    elsif v_task.id is not null then
      if v_existing_task_id is not null and v_detail <> '' then
        v_previous_audit_guard := current_setting('app.planner_task_audit_write', true);
        perform set_config('app.planner_task_audit_write', 'on', true);
        update public.planner_tasks task
        set notes = coalesce(task.notes, '') || E'\nVoice-note update: ' || v_detail
        where task.id = v_task.id returning * into v_task;
        perform set_config('app.planner_task_audit_write', coalesce(v_previous_audit_guard, ''), true);
        insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
        values ('planner_task', v_task.id, 'assistant_daily_updated', auth.uid(), v_actor.full_name,
          jsonb_build_object('capture_id', p_capture_id));
        v_updated := v_updated + 1;
      else
        v_linked := v_linked + 1;
      end if;
    end if;

    v_item_kind := case when v_kind = 'follow_up' then 'follow_up'
      when v_kind in ('create_task', 'update_task') then 'task' else 'note' end;
    insert into public.assistant_day_items(
      capture_id, user_id, kind, content, client_id, assignee_profile_id,
      due_date, reminder_at, planner_task_id, metadata
    ) values (
      p_capture_id, auth.uid(), v_item_kind, v_title, v_client_id, v_assignee_id,
      v_due, v_reminder, v_task.id,
      jsonb_build_object('suggestion_id', v_suggestion_id, 'detail', v_detail,
        'deduplicated', v_task.id is not null and v_new.id is null)
    );
  end loop;

  for v_entry in select value from jsonb_array_elements_text(coalesce(p_calls, '[]'::jsonb)) loop
    insert into public.assistant_day_items(capture_id, user_id, kind, content)
    values (p_capture_id, auth.uid(), 'call', left(v_entry, 4000));
    v_notes_saved := v_notes_saved + 1;
  end loop;
  for v_entry in select value from jsonb_array_elements_text(coalesce(p_decisions, '[]'::jsonb)) loop
    insert into public.assistant_day_items(capture_id, user_id, kind, content, state, completed_at)
    values (p_capture_id, auth.uid(), 'decision', left(v_entry, 4000), 'completed', now());
    v_notes_saved := v_notes_saved + 1;
  end loop;
  for v_entry in select value from jsonb_array_elements_text(coalesce(p_promises, '[]'::jsonb)) loop
    insert into public.assistant_day_items(capture_id, user_id, kind, content)
    values (p_capture_id, auth.uid(), 'promise', left(v_entry, 4000));
    v_notes_saved := v_notes_saved + 1;
  end loop;
  for v_entry in select value from jsonb_array_elements_text(coalesce(p_unresolved, '[]'::jsonb)) loop
    insert into public.assistant_day_items(capture_id, user_id, kind, content)
    values (p_capture_id, auth.uid(), 'question', left(v_entry, 4000));
    v_notes_saved := v_notes_saved + 1;
  end loop;
  for v_entry in select value from jsonb_array_elements_text(coalesce(p_notes, '[]'::jsonb)) loop
    insert into public.assistant_day_items(capture_id, user_id, kind, content, state, completed_at)
    values (p_capture_id, auth.uid(), 'note', left(v_entry, 4000), 'completed', now());
    v_notes_saved := v_notes_saved + 1;
  end loop;

  update public.assistant_day_captures set status = 'applied', applied_at = now(),
    summary = left(coalesce(p_summary, summary), 4000), calls = coalesce(p_calls, calls),
    decisions = coalesce(p_decisions, decisions), promises = coalesce(p_promises, promises),
    unresolved = coalesce(p_unresolved, unresolved), notes = coalesce(p_notes, notes),
    suggestions = coalesce(p_suggestions, suggestions),
    applied_actions = jsonb_build_object('tasks_created', v_created, 'tasks_updated', v_updated,
      'existing_tasks_linked', v_linked, 'timeline_notes_saved', v_notes_saved)
  where id = p_capture_id;

  return jsonb_build_object('tasks_created', v_created, 'tasks_updated', v_updated,
    'existing_tasks_linked', v_linked, 'timeline_notes_saved', v_notes_saved);
end;
$$;

revoke all on function public.apply_assistant_day_capture(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_assistant_day_capture(uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to authenticated;

create or replace function public.refresh_my_assistant_day_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles;
  v_local_now timestamp;
  v_today date;
  v_hour integer;
  v_count integer;
  v_inserted integer := 0;
  v_slot text;
  v_title text;
  v_body text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  v_local_now := now() at time zone 'Africa/Johannesburg';
  v_today := v_local_now::date;
  v_hour := extract(hour from v_local_now);
  if v_hour < 7 or v_hour >= 19 then return 0; end if;

  if v_hour between 7 and 10 then
    v_slot := 'morning';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and (item.due_date is null or item.due_date <= v_today);
    v_title := 'Morning plan';
    v_body := case when v_count = 0 then 'Your captured commitments are clear. Open My Work for today''s plan.'
      else v_count || ' captured open loop' || case when v_count = 1 then '' else 's' end || ' need attention today.' end;
  elsif v_hour between 11 and 14 then
    v_slot := 'midday';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and (item.due_date is null or item.due_date <= v_today);
    if v_count = 0 then return 0; end if;
    v_title := 'Midday check';
    v_body := v_count || ' captured open loop' || case when v_count = 1 then ' remains.' else 's remain.' end;
  elsif v_hour between 16 and 18 then
    v_slot := 'end-of-day';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and item.kind in ('promise', 'task', 'follow_up', 'question');
    if v_count = 0 then return 0; end if;
    v_title := 'Before you finish today';
    v_body := v_count || ' promise or follow-up' || case when v_count = 1 then ' is' else 's are' end || ' still open.';
  else
    return 0;
  end if;

  insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
  values (auth.uid(), 'assistant_day', v_title, v_body, 'assistant_day',
    '/admin/work?tab=my-day', 'assistant-day:' || v_today::text || ':' || v_slot)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link, dedupe_key)
  select auth.uid(), 'assistant_reminder', 'Follow-up reminder', item.content,
    'assistant_day_item', item.id, '/admin/work?tab=my-day',
    'assistant-reminder:' || item.id::text || ':' || to_char(item.reminder_at at time zone 'Africa/Johannesburg', 'YYYYMMDDHH24MI')
  from public.assistant_day_items item
  where item.user_id = auth.uid() and item.state = 'open' and item.reminder_at is not null
    and item.reminder_at between now() - interval '15 minutes' and now() + interval '90 minutes'
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_inserted + v_count;
end;
$$;

create or replace function public.snooze_my_assistant_notification(p_notification_id uuid, p_minutes integer default 30)
returns public.notifications language plpgsql security definer set search_path = public as $$
declare v_notification public.notifications;
begin
  if p_minutes not between 5 and 1440 then raise exception 'Snooze must be between 5 minutes and 24 hours'; end if;
  update public.notifications notification
  set snoozed_until = now() + make_interval(mins => p_minutes), read_at = now(), dismissed_at = null
  where notification.id = p_notification_id and notification.user_id = auth.uid()
    and notification.type in ('assistant_day', 'assistant_reminder')
  returning * into v_notification;
  if v_notification.id is null then raise exception 'Notification not found'; end if;
  return v_notification;
end;
$$;

create or replace function public.dismiss_my_assistant_notification(p_notification_id uuid)
returns public.notifications language plpgsql security definer set search_path = public as $$
declare v_notification public.notifications;
begin
  update public.notifications notification set dismissed_at = now(), read_at = now(), snoozed_until = null
  where notification.id = p_notification_id and notification.user_id = auth.uid()
    and notification.type in ('assistant_day', 'assistant_reminder')
  returning * into v_notification;
  if v_notification.id is null then raise exception 'Notification not found'; end if;
  return v_notification;
end;
$$;

create or replace function public.complete_my_assistant_day_item(p_item_id uuid)
returns public.assistant_day_items language plpgsql security definer set search_path = public as $$
declare
  v_item public.assistant_day_items;
  v_task public.planner_tasks;
  v_actor public.profiles;
  v_can_complete boolean;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  select * into v_item from public.assistant_day_items item
  where item.id = p_item_id and item.user_id = auth.uid() for update;
  if v_item.id is null then raise exception 'Timeline item not found'; end if;
  if v_item.state = 'completed' then return v_item; end if;

  if v_item.planner_task_id is not null then
    select * into v_task from public.planner_tasks task
    where task.id = v_item.planner_task_id and task.archived_at is null;
    if v_task.id is not null and v_task.status <> 'done' then
      v_can_complete := v_actor.role in ('admin', 'manager') or exists (
        select 1 from public.planner_task_assignees assignment
        where assignment.task_id = v_task.id and assignment.profile_id = auth.uid()
      );
      if not v_can_complete then raise exception 'Only a manager or assigned staff member can complete the linked task'; end if;
      perform public.update_planner_task_status(v_task.id, 'done');
    end if;
  end if;
  update public.assistant_day_items item set state = 'completed', completed_at = now()
  where item.id = p_item_id returning * into v_item;
  update public.notifications notification set read_at = now(), dismissed_at = now()
  where notification.user_id = auth.uid() and notification.entity_type = 'assistant_day_item'
    and notification.entity_id = p_item_id;
  return v_item;
end;
$$;

revoke all on function public.refresh_my_assistant_day_notifications() from public, anon, authenticated;
revoke all on function public.snooze_my_assistant_notification(uuid, integer) from public, anon, authenticated;
revoke all on function public.dismiss_my_assistant_notification(uuid) from public, anon, authenticated;
revoke all on function public.complete_my_assistant_day_item(uuid) from public, anon, authenticated;
grant execute on function public.refresh_my_assistant_day_notifications() to authenticated;
grant execute on function public.snooze_my_assistant_notification(uuid, integer) to authenticated;
grant execute on function public.dismiss_my_assistant_notification(uuid) to authenticated;
grant execute on function public.complete_my_assistant_day_item(uuid) to authenticated;

comment on table public.assistant_day_captures is
  'Own-only staff daily voice/text captures. Audio is discarded; transcript and reviewed structured result are retained.';
comment on table public.assistant_day_items is
  'Own-only confirmed daily timeline entries and open loops linked to canonical Planner tasks when applicable.';
