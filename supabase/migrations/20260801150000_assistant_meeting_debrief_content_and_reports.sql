-- CG Assistant final four — server objects.
--
-- 1. meeting_debriefs + apply_meeting_debrief: post-meeting voice debrief.
--    Audio is transcribed in an Edge Function (never stored). The reviewed,
--    edited sections (background notes / decisions / unresolved / tasks) are
--    applied here: notes append to the matched meeting, and tasks become
--    CANONICAL planner_tasks (same operations board, audit and notification as
--    create_assistant_task). Missing due dates stay null.
-- 2. assistant_update_video: direct Content Run video actions (shot / changed /
--    not approved / move) through one audited SECURITY DEFINER RPC, reusing the
--    proven post-run debrief transition rules. No page routing.
-- 3. prepare_monthly_reports: the real report-prep handler — idempotent
--    find-or-create of the previous-month master draft report per active client.
--    Callable headlessly by the durable worker (service role) and by staff.
--
-- Additive + idempotent. Staff/manager gating throughout; clients excluded.

-- ── 1. Post-meeting voice debrief ───────────────────────────────────────────
create table if not exists public.meeting_debriefs (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid references public.company_calendar_events(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  meeting_title text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  transcript text not null,
  detected_language text not null default 'unknown'
    check (detected_language in ('en','af','mixed','unknown')),
  summary text not null default '',
  decisions jsonb not null default '[]'::jsonb,
  unresolved jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','applied','discarded')),
  applied_actions jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meeting_debriefs is
  'Staff-only audit record of a reviewed post-meeting transcript and the notes/decisions/tasks it produced. Raw audio and provider secrets are never stored.';

create index if not exists idx_meeting_debriefs_event_created
  on public.meeting_debriefs (calendar_event_id, created_at desc);
create index if not exists idx_meeting_debriefs_actor_created
  on public.meeting_debriefs (created_by, created_at desc);

drop trigger if exists trg_meeting_debriefs_updated_at on public.meeting_debriefs;
create trigger trg_meeting_debriefs_updated_at
  before update on public.meeting_debriefs
  for each row execute function public.update_planner_updated_at();

alter table public.meeting_debriefs enable row level security;

drop policy if exists "meeting_debriefs: staff select" on public.meeting_debriefs;
create policy "meeting_debriefs: staff select"
  on public.meeting_debriefs for select to authenticated
  using ((select public.is_staff()));

revoke all on table public.meeting_debriefs from public, anon, authenticated;
grant select on table public.meeting_debriefs to authenticated;
grant insert, select, update on table public.meeting_debriefs to service_role;

-- Apply the reviewed, edited debrief: append notes to the meeting and create
-- canonical tasks. Everything is the FINAL edited content from the one
-- confirmation screen, so the reviewer stays in control.
create or replace function public.apply_meeting_debrief(
  p_debrief_id uuid,
  p_summary text,
  p_decisions jsonb,
  p_unresolved jsonb,
  p_tasks jsonb
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_debrief public.meeting_debriefs;
  v_board uuid; v_bucket uuid;
  v_task jsonb; v_title text; v_assignee text; v_due date;
  v_client_id uuid; v_client_name text;
  v_new public.planner_tasks; assignee_id uuid; actor_name text;
  v_created int := 0; v_notes_block text; v_line text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select full_name into actor_name from public.profiles where id = auth.uid();

  select * into v_debrief from public.meeting_debriefs where id = p_debrief_id for update;
  if v_debrief.id is null then raise exception 'Debrief not found'; end if;
  if v_debrief.status <> 'draft' then raise exception 'This debrief has already been finalised'; end if;
  if v_debrief.created_by <> auth.uid() and not public.is_manager() then
    raise exception 'Only the author or a manager can apply this debrief';
  end if;
  if jsonb_typeof(coalesce(p_tasks,'[]'::jsonb)) <> 'array' then raise exception 'Tasks must be an array'; end if;
  if jsonb_array_length(coalesce(p_tasks,'[]'::jsonb)) > 50 then raise exception 'Too many tasks in one debrief'; end if;

  -- Board + bucket for canonical task creation (same as create_assistant_task).
  select id into v_board from public.planner_boards where slug = 'operations-todo' and archived_at is null limit 1;

  -- Append the reviewed notes to the matched meeting (background + decisions +
  -- unresolved), preserving anything already on the event.
  if v_debrief.calendar_event_id is not null then
    v_notes_block := E'\n\n— Debrief ' || to_char(now(),'YYYY-MM-DD') || ' (' || coalesce(actor_name,'CG Assistant') || ') —';
    if coalesce(btrim(p_summary),'') <> '' then v_notes_block := v_notes_block || E'\nBackground: ' || btrim(p_summary); end if;
    if jsonb_typeof(coalesce(p_decisions,'[]'::jsonb)) = 'array' and jsonb_array_length(p_decisions) > 0 then
      v_notes_block := v_notes_block || E'\nDecisions:';
      for v_line in select value from jsonb_array_elements_text(p_decisions) loop
        v_notes_block := v_notes_block || E'\n  - ' || v_line;
      end loop;
    end if;
    if jsonb_typeof(coalesce(p_unresolved,'[]'::jsonb)) = 'array' and jsonb_array_length(p_unresolved) > 0 then
      v_notes_block := v_notes_block || E'\nUnresolved:';
      for v_line in select value from jsonb_array_elements_text(p_unresolved) loop
        v_notes_block := v_notes_block || E'\n  - ' || v_line;
      end loop;
    end if;
    update public.company_calendar_events
      set notes = coalesce(notes,'') || v_notes_block, updated_at = now()
      where id = v_debrief.calendar_event_id;
  end if;

  -- Create canonical tasks. Missing due dates stay null.
  for v_task in select value from jsonb_array_elements(coalesce(p_tasks,'[]'::jsonb)) loop
    v_title := btrim(coalesce(v_task ->> 'title',''));
    if v_title = '' then continue; end if;
    v_assignee := nullif(btrim(coalesce(v_task ->> 'assignee_name','')),'');
    v_due := case when coalesce(v_task ->> 'due_date','') ~ '^\d{4}-\d{2}-\d{2}$' then (v_task ->> 'due_date')::date else null end;
    v_client_id := case when coalesce(v_task ->> 'client_id','') ~* '^[0-9a-f-]{36}$' then (v_task ->> 'client_id')::uuid else v_debrief.client_id end;
    v_client_name := nullif(btrim(coalesce(v_task ->> 'client_name','')),'');
    if v_client_name is null and v_client_id is not null then
      select name into v_client_name from public.clients where id = v_client_id;
    end if;

    select bk.id into v_bucket from public.planner_buckets bk
      where bk.board_id = v_board and bk.archived_at is null
        and upper(bk.name) = case when v_client_id is not null then 'CLIENT REQUESTS' else 'ADMIN / TO DO' end
      limit 1;
    if v_bucket is null then
      select id into v_bucket from public.planner_buckets where board_id = v_board and archived_at is null order by sort_order limit 1;
    end if;

    insert into public.planner_tasks(board_id, bucket_id, title, client_id, client_name, assigned_to_name, due_date, notes, status, priority, source, import_hash, checklist)
    values (v_board, v_bucket, v_title, v_client_id, v_client_name, v_assignee, v_due,
            'From meeting debrief' || case when v_debrief.meeting_title is not null then ': ' || v_debrief.meeting_title else '' end,
            'to_do','normal','cg_assistant_meeting','cgm-' || gen_random_uuid()::text,'[]'::jsonb)
    returning * into v_new;

    insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
    values ('planner_task', v_new.id, 'assistant_created', auth.uid(), actor_name,
            jsonb_build_object('title', v_new.title, 'assignee', v_new.assigned_to_name, 'due_date', v_new.due_date, 'via', 'meeting_debrief'));

    if v_new.assigned_to_name is not null then
      select id into assignee_id from public.profiles where lower(full_name) = lower(v_new.assigned_to_name) and coalesce(role,'') <> 'client' limit 1;
      if assignee_id is not null and assignee_id <> auth.uid() then
        insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
        values (assignee_id, 'task_assigned', 'New task from meeting', coalesce(actor_name,'CG Assistant') || ' assigned you: ' || v_new.title, 'planner_task', v_new.id);
      end if;
    end if;
    v_created := v_created + 1;
  end loop;

  update public.meeting_debriefs
    set status = 'applied', applied_at = now(),
        summary = coalesce(p_summary, summary),
        decisions = coalesce(p_decisions, decisions),
        unresolved = coalesce(p_unresolved, unresolved),
        tasks = coalesce(p_tasks, tasks),
        applied_actions = jsonb_build_object('tasks_created', v_created, 'notes_saved', v_debrief.calendar_event_id is not null)
    where id = v_debrief.id;

  return jsonb_build_object('tasks_created', v_created, 'notes_saved', v_debrief.calendar_event_id is not null);
end $function$;

revoke all on function public.apply_meeting_debrief(uuid, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.apply_meeting_debrief(uuid, text, jsonb, jsonb, jsonb) to authenticated;

-- ── 2. Direct Content Run video actions ─────────────────────────────────────
create or replace function public.assistant_update_video(
  p_run_id uuid,
  p_video_number int,
  p_action text,
  p_note text default null,
  p_scheduled_month date default null
) returns public.content_guide_ideas
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run public.content_runs; v_guideline_id uuid; v_video public.content_guide_ideas;
  v_next_status text; v_next_month date; actor_name text;
begin
  if not public.is_staff() then raise exception 'Staff access required'; end if;
  select full_name into actor_name from public.profiles where id = auth.uid();

  select * into v_run from public.content_runs where id = p_run_id for key share;
  if v_run.id is null then raise exception 'Content Run not found'; end if;

  select id into v_guideline_id from public.content_guidelines
    where content_run_id = v_run.id and (v_run.client_id is null or client_id = v_run.client_id)
    order by created_at desc limit 1;
  if v_guideline_id is null then raise exception 'This Content Run has no guideline yet'; end if;

  select * into v_video from public.content_guide_ideas
    where content_guideline_id = v_guideline_id and video_number = p_video_number and status <> 'archived'
    for update;
  if v_video.id is null then raise exception 'Video % was not found in this Content Run', p_video_number; end if;

  if p_action in ('shot','changed') then
    v_next_status := case
      when v_video.production_status = 'not_shot' and coalesce(v_video.onedrive_footage_url,'') ~* '^https://' then 'ready_to_edit'
      when v_video.production_status = 'not_shot' then 'shot'
      else v_video.production_status end;
    update public.content_guide_ideas
      set production_status = v_next_status,
          production_note = case when p_note is null then production_note
            when nullif(trim(coalesce(production_note,'')),'') is null then p_note
            else production_note || E'\n\nCG Assistant: ' || p_note end,
          production_status_updated_at = case when production_status is distinct from v_next_status then now() else production_status_updated_at end
      where id = v_video.id returning * into v_video;
  elsif p_action = 'not_approved' then
    if v_video.production_status <> 'not_shot' then raise exception 'Video % has moved beyond Not shot; review it manually', p_video_number; end if;
    update public.content_guide_ideas
      set production_note = case when p_note is null then 'Not approved.'
        when nullif(trim(coalesce(production_note,'')),'') is null then p_note
        else production_note || E'\n\nCG Assistant: ' || p_note end
      where id = v_video.id returning * into v_video;
  elsif p_action in ('move_next_month','move_to_month') then
    if v_video.production_status not in ('not_shot','shot') then raise exception 'Video % is already in production and cannot be moved automatically', p_video_number; end if;
    v_next_month := case
      when p_action = 'move_to_month' and p_scheduled_month is not null then date_trunc('month', p_scheduled_month)::date
      else (date_trunc('month', coalesce(v_video.month, v_run.run_date, current_date)::timestamp) + interval '1 month')::date end;
    update public.content_guide_ideas
      set month = v_next_month, deliverable_id = null,
          production_status = 'not_shot', production_status_updated_at = now(),
          production_note = case when p_note is null then 'Moved via CG Assistant. Client Schedule link requires confirmation.'
            else coalesce(production_note || E'\n\n','') || 'CG Assistant: ' || p_note || E'\nClient Schedule link requires confirmation.' end
      where id = v_video.id returning * into v_video;
  else
    raise exception 'Unsupported video action: %', p_action;
  end if;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('content_guide_idea', v_video.id, 'assistant_video_' || p_action, auth.uid(), actor_name,
          jsonb_build_object('run_id', p_run_id, 'video_number', p_video_number, 'note', p_note, 'month', v_video.month));

  return v_video;
end $function$;

revoke all on function public.assistant_update_video(uuid, int, text, text, date) from public, anon;
grant execute on function public.assistant_update_video(uuid, int, text, text, date) to authenticated;

-- ── 3. Real report-prep handler (idempotent) ────────────────────────────────
create or replace function public.prepare_monthly_reports(p_month date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_month date; v_start date; v_end date; v_next date; v_label text;
  c record; v_exists uuid; v_created int := 0; v_reused int := 0;
begin
  -- Staff (browser) or the durable worker (service role → auth.uid() is null).
  if not public.is_staff() and auth.uid() is not null then raise exception 'Staff access required'; end if;

  v_month := date_trunc('month', coalesce(p_month, (current_date - interval '1 month')))::date;
  if v_month >= date_trunc('month', current_date)::date then
    raise exception 'Report prep only runs for a completed month';
  end if;
  v_start := v_month;
  v_next := (v_month + interval '1 month')::date;
  v_end := (v_next - interval '1 day')::date;
  v_label := to_char(v_month, 'FMMonth YYYY');

  for c in select id, name from public.clients where active = true loop
    select id into v_exists from public.reports
      where client_id = c.id and platform is null and period_end >= v_start and period_end < v_next
      order by created_at desc limit 1;
    if v_exists is not null then
      v_reused := v_reused + 1;
    else
      insert into public.reports(client_id, platform, period_start, period_end, status, report_title)
      values (c.id, null, v_start, v_end, 'draft', c.name || ' ' || v_label || ' Report');
      v_created := v_created + 1;
    end if;
    v_exists := null;
  end loop;

  return jsonb_build_object('month', to_char(v_month,'YYYY-MM'), 'created', v_created, 'reused', v_reused);
end $function$;

revoke all on function public.prepare_monthly_reports(date) from public, anon;
grant execute on function public.prepare_monthly_reports(date) to authenticated, service_role;

notify pgrst, 'reload schema';
