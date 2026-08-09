-- Explicit client portal visibility contract.
-- Ownership and internal workflow state never imply client publication.
-- Existing rows remain hidden unless current evidence proves disclosure.

begin;

alter table public.company_calendar_events
  add column if not exists client_visible boolean not null default false,
  add column if not exists client_visibility_updated_at timestamptz,
  add column if not exists client_visibility_updated_by_profile_id uuid
    references public.profiles(id) on delete restrict;

comment on column public.company_calendar_events.client_visible is
  'CG-owned opt-in authority for inclusion in the client portal. Defaults false and is never set by Microsoft.';
comment on column public.company_calendar_events.client_visibility_updated_at is
  'Server timestamp of the latest explicit client-visibility decision.';
comment on column public.company_calendar_events.client_visibility_updated_by_profile_id is
  'Active manager/admin who made the latest explicit client-visibility decision.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_calendar_events_client_visibility_audit_complete'
      and conrelid = 'public.company_calendar_events'::regclass
  ) then
    alter table public.company_calendar_events
      add constraint company_calendar_events_client_visibility_audit_complete
      check (
        (client_visibility_updated_at is null and client_visibility_updated_by_profile_id is null)
        or
        (client_visibility_updated_at is not null and client_visibility_updated_by_profile_id is not null)
      );
  end if;
end;
$$;

create index if not exists company_calendar_events_client_visible_idx
  on public.company_calendar_events(client_id, start_at)
  where client_visible is true
    and superseded_by_event_id is null;

-- Browser CRUD remains unchanged, but the visibility authority is RPC-owned.
revoke update (
  client_visible,
  client_visibility_updated_at,
  client_visibility_updated_by_profile_id
) on public.company_calendar_events from authenticated;

-- Disclosure evidence belongs to the client that saw the deliverable. Relinking
-- the record fails closed rather than carrying old evidence to another client.
create or replace function public.clear_deliverable_client_evidence_on_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.client_id is distinct from new.client_id then
    new.sent_to_client_at := null;
    new.client_approved_at := null;
    new.posted_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_deliverable_client_evidence_on_owner_change
  on public.monthly_deliverables;
create trigger trg_clear_deliverable_client_evidence_on_owner_change
  before update of client_id on public.monthly_deliverables
  for each row execute function public.clear_deliverable_client_evidence_on_owner_change();

revoke all on function public.clear_deliverable_client_evidence_on_owner_change()
  from public, anon, authenticated;

-- A visible event must be re-approved if its client/type changes or it is
-- cancelled. Ordinary Outlook-owned title/time/location refreshes preserve it.
create or replace function public.clear_calendar_client_visibility_on_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.client_visible is true and (
    old.client_id is distinct from new.client_id
    or old.event_type is distinct from new.event_type
    or (old.status is distinct from new.status and new.status = 'cancelled')
  ) then
    new.client_visible := false;
    if auth.uid() is null then
      new.client_visibility_updated_at := null;
      new.client_visibility_updated_by_profile_id := null;
    else
      new.client_visibility_updated_at := now();
      new.client_visibility_updated_by_profile_id := auth.uid();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_calendar_client_visibility_on_scope_change
  on public.company_calendar_events;
create trigger trg_clear_calendar_client_visibility_on_scope_change
  before update of client_id, event_type, status on public.company_calendar_events
  for each row execute function public.clear_calendar_client_visibility_on_scope_change();

revoke all on function public.clear_calendar_client_visibility_on_scope_change()
  from public, anon, authenticated;

create or replace function public.client_portal_visibility_contract_version()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select profile.*
    into v_profile
    from public.profiles profile
   where profile.id = auth.uid()
     and profile.is_active;

  if not found
     or v_profile.role not in ('admin', 'manager', 'staff', 'team', 'client')
     or (v_profile.role = 'client' and v_profile.client_id is null) then
    raise exception 'Active portal access required' using errcode = '42501';
  end if;

  return 1;
end;
$$;

create or replace function public.set_company_calendar_event_client_visibility(
  p_event_id uuid,
  p_visible boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.company_calendar_events%rowtype;
begin
  if p_event_id is null or p_visible is null then
    raise exception 'Event and visibility are required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager')
  ) then
    raise exception 'Active manager access required' using errcode = '42501';
  end if;

  select event.*
    into v_event
    from public.company_calendar_events event
   where event.id = p_event_id
   for update;

  if not found then
    raise exception 'Calendar event not found' using errcode = 'P0002';
  end if;
  if v_event.superseded_by_event_id is not null then
    raise exception 'Superseded events cannot change client visibility' using errcode = '22023';
  end if;

  if p_visible then
    if v_event.client_id is null then
      raise exception 'A linked client is required' using errcode = '22023';
    end if;
    if v_event.event_type not in ('shoot', 'content_run', 'client_event') then
      raise exception 'This event type cannot be published to clients' using errcode = '22023';
    end if;
    if v_event.status = 'cancelled' then
      raise exception 'Cancelled events cannot be published to clients' using errcode = '22023';
    end if;
  end if;

  update public.company_calendar_events
     set client_visible = p_visible,
         client_visibility_updated_at = now(),
         client_visibility_updated_by_profile_id = auth.uid()
   where id = p_event_id;
end;
$$;

-- A reviewed native -> Outlook supersession keeps prior explicit publication.
-- Microsoft-owned identity, times and location are not changed here.
create or replace function public.preserve_calendar_client_visibility_on_supersession()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.superseded_by_event_id is null
     and new.superseded_by_event_id is not null
     and old.client_visible is true then
    update public.company_calendar_events target
       set client_visible = true,
           client_visibility_updated_at = old.client_visibility_updated_at,
           client_visibility_updated_by_profile_id = old.client_visibility_updated_by_profile_id
     where target.id = new.superseded_by_event_id
       and target.client_visible is false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_preserve_calendar_client_visibility_on_supersession
  on public.company_calendar_events;
create trigger trg_preserve_calendar_client_visibility_on_supersession
  before update of superseded_by_event_id on public.company_calendar_events
  for each row execute function public.preserve_calendar_client_visibility_on_supersession();

revoke all on function public.preserve_calendar_client_visibility_on_supersession()
  from public, anon, authenticated;

-- Replace the old status-based client post projection. Status never grants
-- visibility; an evidence timestamp is mandatory, and labels follow evidence.
drop function if exists public.client_portal_month_ahead_posts_v2(uuid, date);
create function public.client_portal_month_ahead_posts_v2(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  schedule_date date,
  title text,
  post_type text,
  client_safe_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_allowed_client_id uuid;
begin
  if p_month is null then
    raise exception 'Month is required' using errcode = '22023';
  end if;

  select profile.*
    into v_profile
    from public.profiles profile
   where profile.id = auth.uid()
     and profile.is_active;

  if not found or v_profile.role not in ('admin', 'manager', 'staff', 'team', 'client') then
    raise exception 'Active portal access required' using errcode = '42501';
  end if;

  if v_profile.role = 'client' then
    if v_profile.client_id is null or p_client_id is distinct from v_profile.client_id then
      raise exception 'Client access denied' using errcode = '42501';
    end if;
    v_allowed_client_id := v_profile.client_id;
  else
    if p_client_id is null then
      raise exception 'Client is required' using errcode = '22023';
    end if;
    v_allowed_client_id := p_client_id;
  end if;

  return query
  select
    'post-' || substr(md5(deliverable.id::text), 1, 16),
    coalesce(deliverable.scheduled_date, deliverable.due_date),
    deliverable.title,
    deliverable.deliverable_type::text,
    case
      when deliverable.posted_at is not null then 'posted'
      when deliverable.client_approved_at is not null and deliverable.scheduled_date is not null then 'scheduled'
      when deliverable.client_approved_at is not null then 'approved'
      else 'awaiting_approval'
    end
  from public.monthly_deliverables deliverable
  where deliverable.client_id = v_allowed_client_id
    and deliverable.archived_at is null
    and deliverable.month = date_trunc('month', p_month)::date
    and deliverable.deliverable_type in ('dp', 'photo', 'video', 'reel')
    and (
      deliverable.sent_to_client_at is not null
      or deliverable.client_approved_at is not null
      or deliverable.posted_at is not null
    )
  order by coalesce(deliverable.scheduled_date, deliverable.due_date, date '9999-12-31'), deliverable.title;
end;
$$;

-- Migration-first compatibility for a cached/previous frontend. The legacy
-- vocabulary cannot distinguish Approved, Scheduled and Posted, so fail closed
-- by returning only the exact Awaiting approval state. The capability-gated
-- frontend uses v2 for the complete truthful hierarchy.
drop function if exists public.client_portal_month_ahead_posts(uuid, date);
create function public.client_portal_month_ahead_posts(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  schedule_date date,
  title text,
  post_type text,
  client_safe_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select post.row_key, post.schedule_date, post.title, post.post_type, post.client_safe_status
  from public.client_portal_month_ahead_posts_v2(p_client_id, p_month) post
  where post.client_safe_status = 'awaiting_approval';
$$;

-- Replace the latest event projection shape. Explicit event publication is
-- required independently from client ownership, event type and status.
drop function if exists public.client_portal_month_ahead_events(uuid, date);
create function public.client_portal_month_ahead_events(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  title text,
  event_type text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean,
  location text,
  guideline_row_key text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_allowed_client_id uuid;
  v_month_start timestamptz;
  v_next_month_start timestamptz;
begin
  if p_month is null then
    raise exception 'Month is required' using errcode = '22023';
  end if;

  select profile.*
    into v_profile
    from public.profiles profile
   where profile.id = auth.uid()
     and profile.is_active;

  if not found or v_profile.role not in ('admin', 'manager', 'staff', 'team', 'client') then
    raise exception 'Active portal access required' using errcode = '42501';
  end if;

  if v_profile.role = 'client' then
    if v_profile.client_id is null or p_client_id is distinct from v_profile.client_id then
      raise exception 'Client access denied' using errcode = '42501';
    end if;
    v_allowed_client_id := v_profile.client_id;
  else
    if p_client_id is null then
      raise exception 'Client is required' using errcode = '22023';
    end if;
    v_allowed_client_id := p_client_id;
  end if;

  v_month_start := date_trunc('month', p_month)::date::timestamp at time zone 'Africa/Johannesburg';
  v_next_month_start := (date_trunc('month', p_month) + interval '1 month')::date::timestamp at time zone 'Africa/Johannesburg';

  return query
  select
    'event-' || substr(md5(event.id::text), 1, 16),
    event.title,
    event.event_type::text,
    event.start_at,
    event.end_at,
    event.all_day,
    event.location,
    case
      when guideline.status = 'published' and guideline.client_published_at is not null
        then md5(guideline.id::text)
      else null
    end
  from public.company_calendar_events event
  left join public.content_runs run
    on run.calendar_event_id = event.id
   and run.client_id = event.client_id
  left join public.content_guidelines guideline
    on guideline.content_run_id = run.id
   and guideline.client_id = event.client_id
  where event.client_id = v_allowed_client_id
    and event.client_visible is true
    and event.event_type in ('shoot', 'content_run', 'client_event')
    and event.status <> 'cancelled'
    and event.superseded_by_event_id is null
    and event.start_at >= v_month_start
    and event.start_at < v_next_month_start
  order by event.start_at, event.title;
end;
$$;

-- Reconfirm that clients have no direct base-table path.
drop policy if exists "monthly_deliverables: client reads own"
  on public.monthly_deliverables;
drop policy if exists "company_calendar_events: client reads own"
  on public.company_calendar_events;

revoke all on function public.client_portal_visibility_contract_version()
  from public, anon, authenticated;
revoke all on function public.set_company_calendar_event_client_visibility(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.client_portal_month_ahead_posts(uuid, date)
  from public, anon, authenticated;
revoke all on function public.client_portal_month_ahead_posts_v2(uuid, date)
  from public, anon, authenticated;
revoke all on function public.client_portal_month_ahead_events(uuid, date)
  from public, anon, authenticated;

grant execute on function public.client_portal_visibility_contract_version()
  to authenticated;
grant execute on function public.set_company_calendar_event_client_visibility(uuid, boolean)
  to authenticated;
grant execute on function public.client_portal_month_ahead_posts(uuid, date)
  to authenticated;
grant execute on function public.client_portal_month_ahead_posts_v2(uuid, date)
  to authenticated;
grant execute on function public.client_portal_month_ahead_events(uuid, date)
  to authenticated;

notify pgrst, 'reload schema';

commit;
