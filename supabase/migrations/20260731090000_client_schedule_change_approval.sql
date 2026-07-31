-- CG Assistant: Client Schedule change-request approval queue.
-- APPLIED to production (migration: assistant_schedule_change_approval_and_audit).
-- Staff can only PROPOSE; only an admin-approved SECURITY DEFINER action applies
-- the change to monthly_deliverables. Every request/approval/rejection/apply is
-- audited into the canonical planner_activity_log. No privileged bypass, no
-- hidden AI store — a real approval queue over the canonical record.

create table if not exists public.client_schedule_change_requests (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references public.monthly_deliverables(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_by_name text,
  change jsonb not null default '{}'::jsonb,
  reason text,
  status text not null default 'pending' check (status in ('pending','applied','rejected','cancelled')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_by_name text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz
);

create index if not exists idx_cscr_status on public.client_schedule_change_requests(status);
create index if not exists idx_cscr_deliverable on public.client_schedule_change_requests(deliverable_id);
create index if not exists idx_cscr_requested_by on public.client_schedule_change_requests(requested_by);

alter table public.client_schedule_change_requests enable row level security;

drop policy if exists "cscr staff propose" on public.client_schedule_change_requests;
create policy "cscr staff propose" on public.client_schedule_change_requests
  for insert to authenticated
  with check (is_staff() and requested_by = auth.uid() and status = 'pending');

drop policy if exists "cscr read own or manager" on public.client_schedule_change_requests;
create policy "cscr read own or manager" on public.client_schedule_change_requests
  for select to authenticated
  using (requested_by = auth.uid() or is_admin() or is_manager());

-- No UPDATE/DELETE policies: transitions & apply happen only through the
-- admin-only RPCs below. Staff can never mutate the schedule directly and can
-- never approve their own request.

create or replace function public.tg_cscr_audit_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('client_schedule_change', new.deliverable_id, 'requested', new.requested_by, new.requested_by_name,
          jsonb_build_object('request_id', new.id, 'change', new.change, 'reason', new.reason));
  return new;
end $$;

drop trigger if exists trg_cscr_audit_insert on public.client_schedule_change_requests;
create trigger trg_cscr_audit_insert after insert on public.client_schedule_change_requests
  for each row execute function public.tg_cscr_audit_insert();

create or replace function public.apply_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare req public.client_schedule_change_requests; reviewer_name text;
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
  return req;
end $$;

create or replace function public.reject_client_schedule_change_request(p_request_id uuid, p_notes text default null)
returns public.client_schedule_change_requests
language plpgsql security definer set search_path = public as $$
declare req public.client_schedule_change_requests; reviewer_name text;
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
  return req;
end $$;

revoke all on function public.apply_client_schedule_change_request(uuid, text) from public;
revoke all on function public.reject_client_schedule_change_request(uuid, text) from public;
grant execute on function public.apply_client_schedule_change_request(uuid, text) to authenticated;
grant execute on function public.reject_client_schedule_change_request(uuid, text) to authenticated;
