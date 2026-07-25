-- Keep Microsoft Outlook Content Runs and Client Schedule video links canonical.
--
-- Access model:
-- - Microsoft remains read-only; this trigger responds only to Outlook-owned
--   rows already reviewed and written into CG Dynamics.
-- - content_runs remains staff-only under its existing RLS policies.
-- - clients continue to read only the published guideline projection RPC.
-- - monthly_deliverables remains canonical and is never updated here.

create or replace function public.sync_microsoft_content_run_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_status text;
begin
  if new.microsoft_event_id is null then
    return new;
  end if;

  if new.event_type <> 'content_run' then
    if tg_op = 'UPDATE' and old.event_type = 'content_run' then
      update public.content_runs
      set status = 'cancelled'
      where calendar_event_id = new.id
        and status <> 'cancelled';
    end if;
    return new;
  end if;

  v_run_status := case new.status
    when 'planned' then 'planning'
    when 'confirmed' then 'ready'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else 'planning'
  end;

  update public.content_runs
  set
    client_id = new.client_id,
    client_name = new.client_name,
    name = new.title,
    run_date = (new.start_at at time zone 'Africa/Johannesburg')::date,
    start_time = (new.start_at at time zone 'Africa/Johannesburg')::time,
    location = new.location,
    lead_name = new.assigned_to_name,
    status = v_run_status
  where calendar_event_id = new.id;

  if not found and new.status <> 'cancelled' then
    insert into public.content_runs (
      calendar_event_id,
      client_id,
      client_name,
      name,
      run_date,
      start_time,
      location,
      lead_name,
      status
    )
    values (
      new.id,
      new.client_id,
      new.client_name,
      new.title,
      (new.start_at at time zone 'Africa/Johannesburg')::date,
      (new.start_at at time zone 'Africa/Johannesburg')::time,
      new.location,
      new.assigned_to_name,
      v_run_status
    );
  end if;

  return new;
end;
$$;

revoke all on function public.sync_microsoft_content_run_event() from public, anon, authenticated;

drop trigger if exists trg_sync_microsoft_content_run_event on public.company_calendar_events;
create trigger trg_sync_microsoft_content_run_event
  after insert or update of
    event_type,
    client_id,
    client_name,
    title,
    start_at,
    location,
    assigned_to_name,
    status,
    microsoft_event_id
  on public.company_calendar_events
  for each row
  execute function public.sync_microsoft_content_run_event();

-- Backfill Microsoft Content Runs imported before this trigger was installed.
insert into public.content_runs (
  calendar_event_id,
  client_id,
  client_name,
  name,
  run_date,
  start_time,
  location,
  lead_name,
  status
)
select
  event.id,
  event.client_id,
  event.client_name,
  event.title,
  (event.start_at at time zone 'Africa/Johannesburg')::date,
  (event.start_at at time zone 'Africa/Johannesburg')::time,
  event.location,
  event.assigned_to_name,
  case event.status
    when 'planned' then 'planning'
    when 'confirmed' then 'ready'
    when 'completed' then 'completed'
    else 'planning'
  end
from public.company_calendar_events event
where event.microsoft_event_id is not null
  and event.event_type = 'content_run'
  and event.status <> 'cancelled'
  and not exists (
    select 1
    from public.content_runs run
    where run.calendar_event_id = event.id
  );

create unique index if not exists uniq_active_content_guide_idea_deliverable
  on public.content_guide_ideas(deliverable_id)
  where deliverable_id is not null and status <> 'archived';

create or replace function public.validate_content_guideline_deliverable_link()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.deliverable_id is null or new.status = 'archived' then
    return new;
  end if;

  if exists (
    select 1
    from public.content_guide_ideas other
    where other.deliverable_id = new.deliverable_id
      and other.id is distinct from new.id
      and other.status <> 'archived'
  ) then
    raise exception 'This Client Schedule deliverable is already linked to another active Content Guideline video';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_content_guideline_deliverable_link() from public, anon, authenticated;

drop trigger if exists trg_validate_content_guideline_deliverable_link on public.content_guide_ideas;
create trigger trg_validate_content_guideline_deliverable_link
  before insert or update of deliverable_id, status
  on public.content_guide_ideas
  for each row
  execute function public.validate_content_guideline_deliverable_link();
