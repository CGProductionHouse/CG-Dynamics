-- Issue #177: preserve duplicate calendar rows as audit evidence while allowing
-- a manager to explicitly supersede a native row with its Outlook-backed row.
-- Microsoft remains read-only upstream; this changes CG Dynamics only.

alter table public.company_calendar_events
  add column if not exists superseded_by_event_id uuid references public.company_calendar_events(id) on delete restrict,
  add column if not exists superseded_at timestamptz,
  add column if not exists superseded_by_profile_id uuid references public.profiles(id) on delete restrict;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_calendar_events_not_self_superseded'
      and conrelid = 'public.company_calendar_events'::regclass
  ) then
    alter table public.company_calendar_events
      add constraint company_calendar_events_not_self_superseded
      check (superseded_by_event_id is null or superseded_by_event_id <> id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_calendar_events_supersession_audit_complete'
      and conrelid = 'public.company_calendar_events'::regclass
  ) then
    alter table public.company_calendar_events
      add constraint company_calendar_events_supersession_audit_complete
      check (
        (superseded_by_event_id is null and superseded_at is null and superseded_by_profile_id is null)
        or
        (superseded_by_event_id is not null and superseded_at is not null and superseded_by_profile_id is not null)
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_calendar_events_outlook_identity_complete'
      and conrelid = 'public.company_calendar_events'::regclass
  ) then
    alter table public.company_calendar_events
      add constraint company_calendar_events_outlook_identity_complete
      check ((microsoft_calendar_id is null) = (microsoft_event_id is null)) not valid;
  end if;
end;
$$;

create index if not exists company_calendar_events_superseded_by_event_idx
  on public.company_calendar_events(superseded_by_event_id)
  where superseded_by_event_id is not null;

drop function if exists public.supersede_native_calendar_event(uuid, uuid, timestamptz);
create function public.supersede_native_calendar_event(
  p_native_event_id uuid,
  p_outlook_event_id uuid,
  p_expected_native_updated_at timestamptz,
  p_expected_outlook_updated_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_native public.company_calendar_events%rowtype;
  v_outlook public.company_calendar_events%rowtype;
begin
  if not public.is_active_planner_manager() then
    raise exception 'Active manager access required';
  end if;
  if p_native_event_id = p_outlook_event_id then
    raise exception 'An event cannot supersede itself';
  end if;

  select * into v_native
    from public.company_calendar_events
   where id = p_native_event_id
   for update;
  select * into v_outlook
    from public.company_calendar_events
   where id = p_outlook_event_id
   for update;

  if not found or v_native.id is null or v_outlook.id is null then
    raise exception 'Calendar event not found';
  end if;
  if v_native.superseded_by_event_id is not null or v_outlook.superseded_by_event_id is not null then
    raise exception 'A superseded calendar event cannot be resolved again';
  end if;
  if v_native.updated_at is distinct from p_expected_native_updated_at then
    raise exception 'The native calendar event changed; reload before resolving';
  end if;
  if v_outlook.updated_at is distinct from p_expected_outlook_updated_at then
    raise exception 'The Outlook calendar event changed; reload before resolving';
  end if;
  if v_native.status = 'cancelled' or v_outlook.status = 'cancelled' then
    raise exception 'Cancelled calendar history cannot be used for duplicate resolution';
  end if;
  if v_native.microsoft_calendar_id is not null or v_native.microsoft_event_id is not null then
    raise exception 'Only a native calendar event can be superseded';
  end if;
  if v_native.event_type = 'content_run' or v_outlook.event_type = 'content_run' then
    raise exception 'Content Run calendar events require manual relationship review before supersession';
  end if;
  if v_native.linked_deliverable_id is not null or v_native.linked_task_id is not null
     or v_outlook.linked_deliverable_id is not null or v_outlook.linked_task_id is not null then
    raise exception 'Linked calendar events require manual relationship review';
  end if;
  if exists (select 1 from public.content_runs where calendar_event_id in (v_native.id, v_outlook.id)) then
    raise exception 'Linked Content Run requires manual relationship review before this calendar event can be superseded.';
  end if;
  if exists (select 1 from public.meeting_debriefs where calendar_event_id in (v_native.id, v_outlook.id)) then
    raise exception 'Linked meeting debrief requires manual relationship review before this calendar event can be superseded.';
  end if;
  if v_outlook.microsoft_calendar_id is null or v_outlook.microsoft_event_id is null then
    raise exception 'The canonical event must have a complete Outlook identity';
  end if;
  if upper(regexp_replace(btrim(v_native.title), '\s+', ' ', 'g'))
       is distinct from upper(regexp_replace(btrim(v_outlook.title), '\s+', ' ', 'g'))
     or v_native.start_at is distinct from v_outlook.start_at
     or v_native.all_day is distinct from v_outlook.all_day then
    raise exception 'The events no longer match the reviewed title, start time and all-day state';
  end if;

  -- Preserve simple CG-owned metadata only where the Outlook row is empty.
  -- Conflicting values fail closed for manual review; Microsoft identity, time,
  -- end time and location remain untouched.
  if v_native.client_id is not null and v_outlook.client_id is not null
     and v_native.client_id is distinct from v_outlook.client_id then
    raise exception 'Conflicting client links require manual review';
  end if;
  if nullif(btrim(v_native.client_name), '') is not null
     and nullif(btrim(v_outlook.client_name), '') is not null
     and nullif(btrim(v_native.client_name), '') is distinct from nullif(btrim(v_outlook.client_name), '') then
    raise exception 'Conflicting client names require manual review';
  end if;
  if v_native.client_id is not null and v_outlook.client_id is null
     and nullif(btrim(v_outlook.client_name), '') is not null
     and nullif(btrim(v_native.client_name), '') is null then
    raise exception 'An existing Outlook client name conflicts with the native client link';
  end if;
  if v_native.client_id is null and nullif(btrim(v_native.client_name), '') is not null
     and v_outlook.client_id is not null and nullif(btrim(v_outlook.client_name), '') is null then
    raise exception 'A native client name cannot be safely applied to a different linked client';
  end if;
  if nullif(btrim(v_native.notes), '') is not null
     and nullif(btrim(v_outlook.notes), '') is not null
     and v_native.notes is distinct from v_outlook.notes then
    raise exception 'Conflicting calendar notes require manual review';
  end if;
  if nullif(btrim(v_native.assigned_to_name), '') is not null
     and nullif(btrim(v_outlook.assigned_to_name), '') is not null
     and v_native.assigned_to_name is distinct from v_outlook.assigned_to_name then
    raise exception 'Conflicting calendar assignees require manual review';
  end if;
  if v_native.event_type is distinct from v_outlook.event_type then
    raise exception 'Conflicting calendar event types require manual review';
  end if;
  if v_native.status is distinct from v_outlook.status then
    raise exception 'Conflicting calendar statuses require manual review';
  end if;

  if (v_outlook.client_id is null and v_native.client_id is not null)
     or (nullif(btrim(v_outlook.client_name), '') is null and nullif(btrim(v_native.client_name), '') is not null)
     or (nullif(btrim(v_outlook.notes), '') is null and nullif(btrim(v_native.notes), '') is not null)
     or (nullif(btrim(v_outlook.assigned_to_name), '') is null and nullif(btrim(v_native.assigned_to_name), '') is not null) then
    update public.company_calendar_events
       set client_id = coalesce(v_outlook.client_id, v_native.client_id),
           client_name = case when nullif(btrim(v_outlook.client_name), '') is null then v_native.client_name else v_outlook.client_name end,
           notes = case when nullif(btrim(v_outlook.notes), '') is null then v_native.notes else v_outlook.notes end,
           assigned_to_name = case when nullif(btrim(v_outlook.assigned_to_name), '') is null then v_native.assigned_to_name else v_outlook.assigned_to_name end
     where id = v_outlook.id;
  end if;

  update public.company_calendar_events
     set superseded_by_event_id = v_outlook.id,
         superseded_at = now(),
         superseded_by_profile_id = auth.uid()
   where id = v_native.id;

  return v_native.id;
end;
$$;

revoke all on function public.supersede_native_calendar_event(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.supersede_native_calendar_event(uuid, uuid, timestamptz, timestamptz) to authenticated;

-- Direct browser writes retain normal event management but cannot forge or
-- clear supersession audit evidence. The security-definer RPC owns those fields.
revoke insert, update on public.company_calendar_events from authenticated;
grant insert (
  title, event_type, client_id, client_name, start_at, end_at, all_day, location,
  notes, assigned_to_name, status, linked_deliverable_id, linked_task_id
) on public.company_calendar_events to authenticated;
grant update (
  title, event_type, client_id, client_name, start_at, end_at, all_day, location,
  notes, assigned_to_name, status, linked_deliverable_id, linked_task_id
) on public.company_calendar_events to authenticated;

-- Superseded rows are retained audit evidence, not editable calendar records.
drop policy if exists "company_calendar_events: manager update" on public.company_calendar_events;
create policy "company_calendar_events: manager update"
  on public.company_calendar_events for update
  using (public.is_active_planner_manager() and superseded_by_event_id is null)
  with check (public.is_active_planner_manager() and superseded_by_event_id is null);

drop policy if exists "company_calendar_events: manager delete" on public.company_calendar_events;
create policy "company_calendar_events: manager delete"
  on public.company_calendar_events for delete
  using (public.is_active_planner_manager() and superseded_by_event_id is null);

-- The canonical Planner authority must execute with caller RLS. Without this,
-- a view-owner query could expose restricted boards through Calendar overlays.
alter view public.planner_tasks_canonical set (security_invoker = true);

-- Client-safe reads use the same active-row authority as internal calendar views.
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
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select case when public.is_staff() then p_client_id else public.my_client_id() end as allowed_client_id
  ), bounds as (
    select
      (date_trunc('month', p_month)::date::timestamp at time zone 'Africa/Johannesburg') as month_start,
      ((date_trunc('month', p_month) + interval '1 month')::date::timestamp at time zone 'Africa/Johannesburg') as next_month_start
  )
  select
    'event-' || substr(md5(event.id::text), 1, 16),
    event.title,
    event.event_type,
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
    cross join caller c
    cross join bounds b
    left join public.content_runs run
      on run.calendar_event_id = event.id
     and run.client_id = event.client_id
    left join public.content_guidelines guideline
      on guideline.content_run_id = run.id
     and guideline.client_id = event.client_id
   where c.allowed_client_id is not null
     and event.client_id = c.allowed_client_id
     and event.event_type in ('shoot', 'content_run', 'client_event')
     and event.status <> 'cancelled'
     and event.superseded_by_event_id is null
     and event.start_at >= b.month_start
     and event.start_at < b.next_month_start
   order by event.start_at, event.title;
$$;

revoke all on function public.client_portal_month_ahead_events(uuid, date) from public, anon;
grant execute on function public.client_portal_month_ahead_events(uuid, date) to authenticated;
