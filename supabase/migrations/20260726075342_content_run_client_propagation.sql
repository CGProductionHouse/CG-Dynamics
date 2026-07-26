-- Keep every canonical Content Run aligned with its CG Calendar event.
--
-- The original linkage trigger intentionally handled Microsoft-owned events
-- only. Imported legacy/seeded CG Calendar content runs use the same canonical
-- relationship but were therefore left with a client_name and no client_id.
-- This replacement preserves the existing event/run model and extends it to
-- all content_run events. It never creates clients or guesses an ID.

create or replace function public.sync_microsoft_content_run_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_status text;
begin
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

-- Repair only missing canonical ownership from an already explicitly linked
-- Calendar event. Existing Content Run client links are never overwritten.
update public.content_runs run
set
  client_id = event.client_id,
  client_name = event.client_name
from public.company_calendar_events event
where run.calendar_event_id = event.id
  and event.event_type = 'content_run'
  and run.client_id is null
  and event.client_id is not null;