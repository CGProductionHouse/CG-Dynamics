-- Client Schedule acceptance hardening. monthly_deliverables remains the sole
-- schedule source of truth; this migration adds guarded workflows around it.

alter table public.client_schedule_change_requests
  add column if not exists baseline jsonb not null default '{}'::jsonb,
  add column if not exists target_updated_at timestamptz;

-- Capture the baseline on the server so callers cannot forge stale checks or
-- requester identity. Existing requests remain reviewable without a baseline.
create or replace function public.tg_cscr_capture_baseline()
returns trigger language plpgsql security definer set search_path = public as $$
declare target public.monthly_deliverables; requester_name text;
begin
  if jsonb_typeof(new.change) <> 'object'
    or new.change = '{}'::jsonb
    or new.change - array['scheduled_date','due_date','production_status','assigned_to_name','notes'] <> '{}'::jsonb
  then
    raise exception 'Client Schedule change contains unsupported fields';
  end if;

  select * into target from public.monthly_deliverables where id = new.deliverable_id;
  if target.id is null then raise exception 'Schedule item not found'; end if;
  select full_name into requester_name from public.profiles where id = auth.uid() and is_active is distinct from false;
  if requester_name is null then raise exception 'Active requester profile not found'; end if;

  new.requested_by := auth.uid();
  new.requested_by_name := requester_name;
  new.status := 'pending';
  new.target_updated_at := target.updated_at;
  new.baseline := jsonb_build_object(
    'scheduled_date', target.scheduled_date,
    'due_date', target.due_date,
    'production_status', target.production_status,
    'assigned_to_name', target.assigned_to_name,
    'notes', target.notes
  );
  return new;
end $$;

drop trigger if exists trg_cscr_capture_baseline on public.client_schedule_change_requests;
create trigger trg_cscr_capture_baseline before insert on public.client_schedule_change_requests
  for each row execute function public.tg_cscr_capture_baseline();

-- A permissive row policy cannot constrain which columns staff changed. Remove
-- direct staff UPDATE and expose only the assigned-status RPC below.
drop policy if exists "monthly_deliverables: staff production status update" on public.monthly_deliverables;

create or replace function public.update_assigned_client_schedule_status(
  p_deliverable_id uuid,
  p_expected_updated_at timestamptz,
  p_production_status text
) returns public.monthly_deliverables
language plpgsql security definer set search_path = public as $$
declare
  target public.monthly_deliverables;
  actor public.profiles;
  name_matches integer;
  is_primary boolean;
  is_helper boolean;
  before_row jsonb;
begin
  select * into actor from public.profiles where id = auth.uid() and is_active is true;
  if actor.id is null or actor.role not in ('staff','team') then
    raise exception 'Only active staff can use the assigned status action';
  end if;
  if p_production_status not in ('to_do','in_progress','ready_internal_review','ready_client_approval') then
    raise exception 'Status is not available to staff';
  end if;

  select * into target from public.monthly_deliverables where id = p_deliverable_id for update;
  if target.id is null then raise exception 'Schedule item not found'; end if;
  if target.updated_at is distinct from p_expected_updated_at then raise exception 'Schedule item changed; refresh and try again'; end if;

  select count(*) into name_matches from public.profiles
   where is_active is true
     and role in ('admin','manager','staff','team')
     and nullif(btrim(full_name), '') is not null
     and lower(btrim(full_name)) = lower(btrim(actor.full_name));
  is_primary := target.assigned_to_user_id = auth.uid()
    or (
      target.assigned_to_user_id is null
      and name_matches = 1
      and lower(btrim(coalesce(target.assigned_to_name, ''))) = lower(btrim(actor.full_name))
    );
  is_helper := name_matches = 1 and exists (
    select 1
    from unnest(coalesce(target.helper_names, '{}'::text[])) helper(name)
    where nullif(btrim(helper.name), '') is not null
      and lower(btrim(helper.name)) = lower(btrim(actor.full_name))
  );
  if not (is_primary or is_helper) then
    raise exception 'Schedule item is not assigned to this user';
  end if;

  before_row := to_jsonb(target);
  update public.monthly_deliverables
     set production_status = p_production_status,
         posted_at = case when p_production_status = 'posted' then now() else posted_at end
   where id = p_deliverable_id returning * into target;
  if before_row is distinct from to_jsonb(target) then
    insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
    values ('client_schedule', target.id, 'status_changed', auth.uid(), actor.full_name,
      jsonb_build_object('before', before_row, 'after', to_jsonb(target)));
  end if;
  return target;
end $$;

create or replace function public.save_client_schedule_deliverable(
  p_deliverable_id uuid,
  p_expected_updated_at timestamptz,
  p_production_status text,
  p_scheduled_date date,
  p_client_id uuid,
  p_assigned_to_name text
) returns public.monthly_deliverables
language plpgsql security definer set search_path = public as $$
declare
  target public.monthly_deliverables;
  actor_name text;
  before_row jsonb;
  assignee_name text;
  assignee_id uuid;
  assignee_count integer;
begin
  if not public.is_manager() or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  ) then raise exception 'Only an active manager or admin can save Client Schedule operations'; end if;
  if p_production_status not in ('to_do','in_progress','ready_internal_review','internal_changes','ready_client_approval','waiting_client','client_changes','approved','scheduled','posted','blocked','moved') then
    raise exception 'Invalid production status';
  end if;
  if p_client_id is not null and not exists (select 1 from public.clients where id = p_client_id) then
    raise exception 'Client not found';
  end if;
  assignee_name := nullif(btrim(p_assigned_to_name), '');
  if assignee_name is not null then
    select count(*), (array_agg(profile.id order by profile.id))[1]
      into assignee_count, assignee_id
    from public.profiles profile
    where profile.is_active
      and profile.role in ('admin','manager','staff','team')
      and lower(btrim(profile.full_name)) = lower(assignee_name);
    if assignee_count <> 1 then
      raise exception 'Assignee must match one active workforce profile';
    end if;
    select full_name into assignee_name from public.profiles where id = assignee_id;
  end if;

  select * into target from public.monthly_deliverables where id = p_deliverable_id for update;
  if target.id is null then raise exception 'Schedule item not found'; end if;
  if target.updated_at is distinct from p_expected_updated_at then raise exception 'Schedule item changed; refresh and try again'; end if;
  before_row := to_jsonb(target);
  select full_name into actor_name from public.profiles where id = auth.uid();

  update public.monthly_deliverables
     set production_status = p_production_status,
         scheduled_date = p_scheduled_date,
         client_id = p_client_id,
          assigned_to_user_id = assignee_id,
          assigned_to_name = assignee_name,
         posted_at = case when p_production_status = 'posted' and target.production_status <> 'posted' then now() else posted_at end
   where id = p_deliverable_id returning * into target;
  if before_row is distinct from to_jsonb(target) then
    insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
    values ('client_schedule', target.id, 'schedule_saved', auth.uid(), actor_name,
      jsonb_build_object('before', before_row, 'after', to_jsonb(target)));
  end if;
  return target;
end $$;

-- Compare every proposed field with the server-captured baseline. This permits
-- unrelated edits while rejecting an approval that would overwrite newer work.
create or replace function public.apply_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare
  req public.client_schedule_change_requests;
  target public.monthly_deliverables;
  reviewer_name text;
  before_row jsonb;
  assignee_name text;
  assignee_id uuid;
  assignee_count integer;
begin
  if not public.is_manager() or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  ) then raise exception 'Only an active manager or admin can approve Client Schedule changes'; end if;
  select * into req from public.client_schedule_change_requests where id = p_request_id for update;
  if req.id is null then raise exception 'Change request not found'; end if;
  if req.status <> 'pending' then raise exception 'Change request is not pending'; end if;
  select * into target from public.monthly_deliverables where id = req.deliverable_id for update;
  if target.id is null then raise exception 'Schedule item not found'; end if;

  if req.baseline <> '{}'::jsonb and exists (
    select 1 from jsonb_object_keys(req.change) field
    where (to_jsonb(target)->field) is distinct from (req.baseline->field)
  ) then raise exception 'Schedule item changed since this request; review and request a new change'; end if;
  if req.baseline = '{}'::jsonb and req.target_updated_at is not null and target.updated_at is distinct from req.target_updated_at then
    raise exception 'Schedule item changed since this request; review and request a new change';
  end if;

  if req.change ? 'assigned_to_name' then
    assignee_name := nullif(btrim(req.change->>'assigned_to_name'), '');
    if assignee_name is not null then
      select count(*), (array_agg(profile.id order by profile.id))[1]
        into assignee_count, assignee_id
      from public.profiles profile
      where profile.is_active
        and profile.role in ('admin','manager','staff','team')
        and lower(btrim(profile.full_name)) = lower(assignee_name);
      if assignee_count <> 1 then
        raise exception 'Assignee must match one active workforce profile';
      end if;
      select full_name into assignee_name from public.profiles where id = assignee_id;
    end if;
  end if;

  before_row := to_jsonb(target);
  update public.monthly_deliverables d set
    scheduled_date = case when req.change ? 'scheduled_date' then nullif(req.change->>'scheduled_date','')::date else d.scheduled_date end,
    due_date = case when req.change ? 'due_date' then nullif(req.change->>'due_date','')::date else d.due_date end,
    production_status = case when req.change ? 'production_status' then req.change->>'production_status' else d.production_status end,
    assigned_to_user_id = case when req.change ? 'assigned_to_name' then assignee_id else d.assigned_to_user_id end,
    assigned_to_name = case when req.change ? 'assigned_to_name' then assignee_name else d.assigned_to_name end,
    notes = case when req.change ? 'notes' then req.change->>'notes' else d.notes end
  where d.id = req.deliverable_id returning * into target;

  select full_name into reviewer_name from public.profiles where id = auth.uid();
  update public.client_schedule_change_requests set status='applied', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name,
    review_notes=nullif(btrim(p_notes), ''), applied_at=now(), updated_at=now()
  where id = p_request_id returning * into req;
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', req.deliverable_id, 'applied', auth.uid(), reviewer_name,
    jsonb_build_object('request_id', req.id, 'before', before_row, 'after', to_jsonb(target), 'notes', p_notes));
  if req.requested_by is not null then
    perform public.create_notification(req.requested_by, 'schedule_change_applied', 'Client Schedule change approved',
      'Your requested change to "' || coalesce(target.title, 'a schedule item') || '" was approved and applied.',
      'client_schedule_change_request', req.id, null);
  end if;
  return req;
end $$;

create or replace function public.reject_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare req public.client_schedule_change_requests; reviewer_name text; target_title text;
begin
  if not public.is_manager() or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  ) then raise exception 'Only an active manager or admin can reject Client Schedule changes'; end if;
  select full_name into reviewer_name from public.profiles where id = auth.uid();
  update public.client_schedule_change_requests set status='rejected', reviewed_by=auth.uid(), reviewed_by_name=reviewer_name,
    review_notes=nullif(btrim(p_notes), ''), updated_at=now()
  where id = p_request_id and status='pending' returning * into req;
  if req.id is null then raise exception 'Change request not found or not pending'; end if;
  select title into target_title from public.monthly_deliverables where id = req.deliverable_id;
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', req.deliverable_id, 'rejected', auth.uid(), reviewer_name,
    jsonb_build_object('request_id', req.id, 'change', req.change, 'notes', p_notes));
  if req.requested_by is not null then
    perform public.create_notification(req.requested_by, 'schedule_change_rejected', 'Client Schedule change declined',
      'Your requested change to "' || coalesce(target_title, 'a schedule item') || '" was declined' ||
        case when nullif(btrim(p_notes), '') is not null then ': ' || p_notes else '.' end,
      'client_schedule_change_request', req.id, null);
  end if;
  return req;
end $$;

revoke all on function public.update_assigned_client_schedule_status(uuid, timestamptz, text) from public;
revoke all on function public.save_client_schedule_deliverable(uuid, timestamptz, text, date, uuid, text) from public;
revoke all on function public.apply_client_schedule_change_request(uuid, text) from public;
revoke all on function public.reject_client_schedule_change_request(uuid, text) from public;
grant execute on function public.update_assigned_client_schedule_status(uuid, timestamptz, text) to authenticated;
grant execute on function public.save_client_schedule_deliverable(uuid, timestamptz, text, date, uuid, text) to authenticated;
grant execute on function public.apply_client_schedule_change_request(uuid, text) to authenticated;
grant execute on function public.reject_client_schedule_change_request(uuid, text) to authenticated;
