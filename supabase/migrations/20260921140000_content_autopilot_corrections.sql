-- Content Production Autopilot corrections (#450, supervisor review on PR #455).
-- PREPARED ONLY. Do not apply to production without explicit CA approval.
--
-- Three additions, all additive:
--   1. an EXACT Microsoft (calendar, event) -> Content Run ensure path, so an Outlook
--      content-run event can never again exist without its Dynamics mirror;
--   2. a staff-safe per-video production-folder projection, so the browser can read
--      folder truth without the table being exposed and without raw Graph IDs;
--   3. a same-client deliverable link helper whose provenance rules live in the
--      database, so the autopilot cannot link across clients even by mistake.
--
-- monthly_deliverables is never written here. No rename/move/delete exists here.

begin;

-- 1. Exact Microsoft event -> Content Run ensure ─────────────────────────────
--
-- Identity is the durable calendar event row (and its Microsoft ids), never a title.
-- The existing sync_microsoft_content_run_event() trigger already mirrors events as
-- they are written; this is the idempotent repair/ensure path for an event that was
-- reviewed into Dynamics before the trigger existed, or whose mirror was removed.

create or replace function public.ensure_content_run_for_calendar_event(
  p_calendar_event_id uuid
)
returns table (content_run_id uuid, created boolean, client_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.company_calendar_events;
  v_run_id uuid;
  v_status text;
begin
  select * into v_event
  from public.company_calendar_events
  where id = p_calendar_event_id;

  if not found then
    raise exception 'Calendar event not found.' using errcode = '22023';
  end if;

  -- An ordinary meeting never becomes a Content Run.
  if v_event.event_type is distinct from 'content_run' then
    raise exception 'That calendar event is not a content run.' using errcode = '22023';
  end if;

  -- Exact client identity is required: a run is never created for an unresolved client,
  -- and a client is never inferred from the event title.
  if v_event.client_id is null then
    raise exception 'That content-run event has no exact client.' using errcode = '22023';
  end if;

  if v_event.status = 'cancelled' then
    raise exception 'That content-run event is cancelled.' using errcode = '22023';
  end if;

  -- Durable identity: one run per calendar event row.
  select r.id into v_run_id
  from public.content_runs r
  where r.calendar_event_id = v_event.id;

  if v_run_id is not null then
    return query select v_run_id, false, v_event.client_id;
    return;
  end if;

  v_status := case v_event.status
    when 'planned' then 'planning'
    when 'confirmed' then 'ready'
    when 'completed' then 'completed'
    else 'planning'
  end;

  insert into public.content_runs (
    calendar_event_id, client_id, client_name, name, run_date, start_time,
    location, lead_name, status
  ) values (
    v_event.id, v_event.client_id, v_event.client_name, v_event.title,
    (v_event.start_at at time zone 'Africa/Johannesburg')::date,
    (v_event.start_at at time zone 'Africa/Johannesburg')::time,
    v_event.location, v_event.assigned_to_name, v_status
  )
  returning id into v_run_id;

  return query select v_run_id, true, v_event.client_id;
end;
$$;

comment on function public.ensure_content_run_for_calendar_event(uuid) is
  'Idempotent exact-identity ensure of the Content Run mirroring one Microsoft-owned content-run calendar event (#450). Matched by the durable calendar event row only — never by title, never across clients, never for an ordinary meeting or a cancelled event.';

revoke all on function public.ensure_content_run_for_calendar_event(uuid) from public, anon, authenticated;
grant execute on function public.ensure_content_run_for_calendar_event(uuid) to service_role;

-- 2. Staff-safe per-video production folder projection ───────────────────────
--
-- content_guide_video_onedrive_folders stays revoked from authenticated. Staff need
-- the TRUTH (is this video's folder mapped, and what does its evidence say), not the
-- Graph identifiers, so this returns the canonical folder name and states only.

create or replace function public.content_run_video_folder_states(p_content_run_id uuid)
returns table (
  content_guide_idea_id uuid,
  folder_name text,
  mapping_origin text,
  upload_status text,
  upload_verified_at timestamptz,
  last_verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active is true
  ) then
    raise exception 'Active staff access required.' using errcode = '42501';
  end if;

  return query
  select f.content_guide_idea_id, f.folder_name, f.mapping_origin,
         f.upload_status, f.upload_verified_at, f.last_verified_at
  from public.content_guide_video_onedrive_folders f
  where f.content_run_id = p_content_run_id;
end;
$$;

comment on function public.content_run_video_folder_states(uuid) is
  'Staff-safe per-video production folder truth for one content run (#450): canonical folder name plus mapping and upload states. Deliberately returns no drive_id or folder_item_id.';

revoke all on function public.content_run_video_folder_states(uuid) from public, anon;
grant execute on function public.content_run_video_folder_states(uuid) to authenticated, service_role;

-- 3. Exact same-client deliverable link ──────────────────────────────────────
--
-- The autopilot may link a guideline video to a real Client Schedule slot when the
-- provenance is unambiguous. The Client Schedule row itself is never written, and the
-- link is refused unless both sides belong to the same exact client.

create or replace function public.link_content_guide_video_deliverable(
  p_content_guide_idea_id uuid,
  p_deliverable_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_video_client uuid;
  v_deliverable_client uuid;
  v_type text;
  v_existing uuid;
begin
  select idea.client_id, idea.deliverable_id
  into v_video_client, v_existing
  from public.content_guide_ideas idea
  where idea.id = p_content_guide_idea_id and idea.status <> 'archived';

  if v_video_client is null then
    raise exception 'Guideline video not found, archived, or has no exact client.' using errcode = '22023';
  end if;

  -- Never move a link a human already set.
  if v_existing is not null then
    return false;
  end if;

  select d.client_id, d.deliverable_type
  into v_deliverable_client, v_type
  from public.monthly_deliverables d
  where d.id = p_deliverable_id;

  if v_deliverable_client is null then
    raise exception 'Client Schedule slot not found.' using errcode = '22023';
  end if;

  if v_deliverable_client <> v_video_client then
    raise exception 'A guideline video can only link to a slot of its own client.' using errcode = '42501';
  end if;

  if v_type not in ('video', 'reel') then
    raise exception 'Only a video or reel slot can hold a guideline video.' using errcode = '22023';
  end if;

  -- The slot must be free: one active video per deliverable (existing unique index).
  if exists (
    select 1 from public.content_guide_ideas other
    where other.deliverable_id = p_deliverable_id
      and other.status <> 'archived'
      and other.id <> p_content_guide_idea_id
  ) then
    return false;
  end if;

  update public.content_guide_ideas
  set deliverable_id = p_deliverable_id
  where id = p_content_guide_idea_id;

  return true;
end;
$$;

comment on function public.link_content_guide_video_deliverable(uuid, uuid) is
  'Link one guideline video to one existing same-client Client Schedule video/reel slot (#450). Returns false rather than moving a link a human already set or stealing an occupied slot. Never writes monthly_deliverables.';

revoke all on function public.link_content_guide_video_deliverable(uuid, uuid) from public, anon, authenticated;
grant execute on function public.link_content_guide_video_deliverable(uuid, uuid) to service_role;

commit;
