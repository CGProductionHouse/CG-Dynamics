-- CG Dynamics hardening pass — server-side fixes from the mobile-staff audit.
--
-- 1. Client Schedule change requests now actually notify: the proposal trigger
--    notifies admins (the queue owners) and the apply/reject RPCs notify the
--    requester. The assistant_notifications migration documented this behaviour
--    but the RPCs/trigger never wired it up — the requester was never told the
--    outcome. Fixes are additive and idempotent (create or replace / drop
--    policy), safe to apply on top of production.
-- 2. meeting_debriefs + content_run_debriefs SELECT tightened from
--    "any staff member" to author-or-manager, matching the author/manager gate
--    already enforced by apply_meeting_debrief / apply_content_run_debrief.
--    Raw transcripts contain client meeting content; staff-wide horizontal
--    read access was a genuine cross-user leak.
-- 3. update_assistant_task "block" now sets status='blocked' (it previously only
--    appended a note, so blocked tasks never surfaced on the board), and the
--    assignee gate honours canonical multi-assignment (planner_task_assignees)
--    in addition to the legacy assigned_to_name.

-- ── 1. Client Schedule change-request notifications ─────────────────────────

-- Extend the insert trigger: audit (as before) AND notify every admin that a
-- new change request is awaiting approval.
create or replace function public.tg_cscr_audit_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', new.deliverable_id, 'requested', new.requested_by, new.requested_by_name,
          jsonb_build_object('request_id', new.id, 'change', new.change, 'reason', new.reason));
  insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
  select p.id, 'schedule_change_proposed', 'Client Schedule change requested',
         coalesce(new.requested_by_name, 'A staff member') || ' requested a Client Schedule change',
         'client_schedule_change_request', new.id
    from public.profiles p
   where p.role = 'admin';
  return new;
end $$;

drop trigger if exists trg_cscr_audit_insert on public.client_schedule_change_requests;
create trigger trg_cscr_audit_insert after insert on public.client_schedule_change_requests
  for each row execute function public.tg_cscr_audit_insert();

-- Apply: notify the requester of the outcome.
create or replace function public.apply_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare req public.client_schedule_change_requests; reviewer_name text; target_title text;
begin
  if not is_admin() then raise exception 'Only an admin can approve Client Schedule changes'; end if;
  select * into req from public.client_schedule_change_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Change request not found'; end if;
  if req.status <> 'pending' then raise exception 'Change request is not pending'; end if;

  -- Strict whitelist. Never assigns client_id (no cross-client moves).
  update public.monthly_deliverables d set
    scheduled_date    = case when req.change ? 'scheduled_date'    then nullif(req.change->>'scheduled_date','')::date else d.scheduled_date end,
    due_date          = case when req.change ? 'due_date'          then nullif(req.change->>'due_date','')::date else d.due_date end,
    production_status  = case when req.change ? 'production_status' then req.change->>'production_status' else d.production_status end,
    assigned_to_name   = case when req.change ? 'assigned_to_name'  then nullif(req.change->>'assigned_to_name','') else d.assigned_to_name end,
    notes              = case when req.change ? 'notes'             then req.change->>'notes' else d.notes end,
    updated_at = now()
  where d.id = req.deliverable_id;

  select full_name into reviewer_name from public.profiles where id = auth.uid();
  update public.client_schedule_change_requests set
    status='applied', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name,
    review_notes=p_notes, applied_at=now(), updated_at=now()
  where id = p_request_id returning * into req;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', req.deliverable_id, 'applied', auth.uid(), reviewer_name,
          jsonb_build_object('request_id', req.id, 'change', req.change, 'notes', p_notes));

  select title into target_title from public.monthly_deliverables where id = req.deliverable_id;
  if req.requested_by is not null then
    perform public.create_notification(
      req.requested_by, 'schedule_change_applied', 'Client Schedule change approved',
      'Your requested change to "' || coalesce(target_title, 'a schedule item') || '" was approved and applied.',
      'client_schedule_change_request', req.id, null);
  end if;
  return req;
end $$;

create or replace function public.reject_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare req public.client_schedule_change_requests; reviewer_name text; target_title text;
begin
  if not is_admin() then raise exception 'Only an admin can reject Client Schedule changes'; end if;
  select full_name into reviewer_name from public.profiles where id = auth.uid();
  update public.client_schedule_change_requests set
    status='rejected', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name, review_notes=p_notes, updated_at=now()
  where id = p_request_id and status='pending' returning * into req;
  if req.id is null then raise exception 'Change request not found or not pending'; end if;
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', req.deliverable_id, 'rejected', auth.uid(), reviewer_name,
          jsonb_build_object('request_id', req.id, 'notes', p_notes));

  select title into target_title from public.monthly_deliverables where id = req.deliverable_id;
  if req.requested_by is not null then
    perform public.create_notification(
      req.requested_by, 'schedule_change_rejected', 'Client Schedule change declined',
      'Your requested change to "' || coalesce(target_title, 'a schedule item') || '" was declined' ||
        case when nullif(p_notes,'') is not null then ': ' || p_notes else '.' end,
      'client_schedule_change_request', req.id, null);
  end if;
  return req;
end $$;

revoke all on function public.apply_client_schedule_change_request(uuid, text) from public;
revoke all on function public.reject_client_schedule_change_request(uuid, text) from public;
grant execute on function public.apply_client_schedule_change_request(uuid, text) to authenticated;
grant execute on function public.reject_client_schedule_change_request(uuid, text) to authenticated;

-- ── 2. Debrief transcript RLS: author-or-manager (no staff-wide horizontal read) ─

drop policy if exists "meeting_debriefs: staff select" on public.meeting_debriefs;
create policy "meeting_debriefs: author or manager"
  on public.meeting_debriefs for select to authenticated
  using (created_by = auth.uid() or public.is_manager());

drop policy if exists "content_run_debriefs: staff select" on public.content_run_debriefs;
create policy "content_run_debriefs: author or manager"
  on public.content_run_debriefs for select to authenticated
  using (created_by = auth.uid() or public.is_manager());

-- ── 3. Assistant block honours status + canonical multi-assignment ──────────

create or replace function public.update_assistant_task(
  p_task_id uuid,
  p_action text,
  p_assignee_name text default null,
  p_due_date date default null,
  p_comment text default null
) returns public.planner_tasks
language plpgsql
security definer
set search_path to 'public'
as $function$
declare t public.planner_tasks; actor_name text; assignee_id uuid; is_assignee boolean;
begin
  if not is_staff() then raise exception 'Not authorised'; end if;
  select full_name into actor_name from public.profiles where id = auth.uid();
  select * into t from public.planner_tasks where id = p_task_id for update;
  if t.id is null then raise exception 'Task not found'; end if;
  -- Canonical multi-assignment (planner_task_assignees) OR the legacy single
  -- assignee name; either makes the actor "the assignee".
  is_assignee := exists (select 1 from public.planner_task_assignees a where a.task_id = t.id and a.profile_id = auth.uid())
    or (t.assigned_to_name is not null and lower(t.assigned_to_name) = lower(coalesce(actor_name,'')));
  if p_action in ('reassign','assign','due') and not is_manager() then raise exception 'Only a manager can reassign or reschedule tasks'; end if;
  if p_action in ('complete','comment','block') and not (is_manager() or is_assignee) then raise exception 'Only a manager or the assignee can update this task'; end if;
  if p_action = 'reassign' or p_action = 'assign' then
    update public.planner_tasks set assigned_to_name = nullif(btrim(coalesce(p_assignee_name,'')),''), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'due' then
    update public.planner_tasks set due_date = p_due_date, updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'complete' then
    update public.planner_tasks set archived_at = now(), archived_by_name = actor_name, archive_reason = coalesce(p_comment,'Completed via CG Assistant'), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'block' then
    update public.planner_tasks set status = 'blocked', notes = coalesce(notes,'') || E'\n[BLOCKED] ' || coalesce(p_comment,'') || ' - ' || coalesce(actor_name,''), updated_at = now() where id = p_task_id returning * into t;
  elsif p_action = 'comment' then
    update public.planner_tasks set notes = coalesce(notes,'') || E'\n' || coalesce(actor_name,'') || ': ' || coalesce(p_comment,''), updated_at = now() where id = p_task_id returning * into t;
  else raise exception 'Unknown task action: %', p_action; end if;
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', t.id, 'assistant_' || p_action, auth.uid(), actor_name, jsonb_build_object('assignee', t.assigned_to_name, 'due_date', t.due_date, 'comment', p_comment));
  if p_action in ('reassign','assign') and t.assigned_to_name is not null then
    select id into assignee_id from public.profiles where lower(full_name) = lower(t.assigned_to_name) and coalesce(role,'') <> 'client' limit 1;
    if assignee_id is not null and assignee_id <> auth.uid() then
      insert into public.notifications(user_id, type, title, body, entity_type, entity_id)
      values (assignee_id, 'task_assigned', 'Task assigned to you', coalesce(actor_name,'CG Assistant') || ' assigned you: ' || t.title, 'planner_task', t.id);
    end if;
  end if;
  return t;
end $function$;

notify pgrst, 'reload schema';
