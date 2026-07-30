-- Phase 30a: post-Content-Run voice debrief and client-safe guideline links.
--
-- Additive and idempotent. Audio is transcribed inside an Edge Function and is
-- not stored here. The original transcript and reviewed proposal are retained
-- for audit. Clients never receive direct table access or internal record IDs.

begin;

create table if not exists public.content_run_debriefs (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid not null references public.content_runs(id) on delete restrict,
  content_guideline_id uuid not null references public.content_guidelines(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  transcript text not null,
  detected_language text not null default 'unknown'
    check (detected_language in ('en', 'af', 'mixed', 'unknown')),
  summary text not null default '',
  proposal jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'applied', 'discarded')),
  applied_actions jsonb,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.content_run_debriefs is
  'Staff-only audit record for a reviewed post-run transcript and its proposed/applied video workflow changes. Raw audio and provider secrets are never stored.';

create index if not exists idx_content_run_debriefs_run_created
  on public.content_run_debriefs (content_run_id, created_at desc);
create index if not exists idx_content_run_debriefs_actor_created
  on public.content_run_debriefs (created_by, created_at desc);

drop trigger if exists trg_content_run_debriefs_updated_at
  on public.content_run_debriefs;
create trigger trg_content_run_debriefs_updated_at
  before update on public.content_run_debriefs
  for each row execute function public.update_planner_updated_at();

alter table public.content_run_debriefs enable row level security;

-- Edge Functions own inserts. Staff can read debriefs for operational review,
-- but no browser role receives direct write grants.
drop policy if exists "content_run_debriefs: staff select"
  on public.content_run_debriefs;
create policy "content_run_debriefs: staff select"
  on public.content_run_debriefs for select to authenticated
  using ((select public.is_staff()));

revoke all on table public.content_run_debriefs from public, anon, authenticated;
grant select on table public.content_run_debriefs to authenticated;
grant insert, select, update on table public.content_run_debriefs to service_role;

create or replace function public.apply_content_run_debrief(
  p_debrief_id uuid,
  p_actions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debrief public.content_run_debriefs;
  v_run public.content_runs;
  v_action jsonb;
  v_video public.content_guide_ideas;
  v_action_name text;
  v_note text;
  v_video_id uuid;
  v_next_month date;
  v_next_status text;
  v_applied integer := 0;
  v_skipped integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;
  if jsonb_typeof(coalesce(p_actions, '[]'::jsonb)) <> 'array' then
    raise exception 'Debrief actions must be an array';
  end if;
  if jsonb_array_length(coalesce(p_actions, '[]'::jsonb)) > 100 then
    raise exception 'Too many debrief actions';
  end if;

  select * into v_debrief
  from public.content_run_debriefs
  where id = p_debrief_id
  for update;

  if v_debrief.id is null then
    raise exception 'Debrief not found';
  end if;
  if v_debrief.status <> 'draft' then
    raise exception 'This debrief has already been finalised';
  end if;
  if v_debrief.created_by <> auth.uid() and not public.is_manager() then
    raise exception 'Only the author or a manager can apply this debrief';
  end if;

  select * into v_run
  from public.content_runs
  where id = v_debrief.content_run_id
    and client_id = v_debrief.client_id
  for key share;

  if v_run.id is null then
    raise exception 'Content Run ownership changed; review the debrief again';
  end if;
  if not exists (
    select 1
    from public.content_guidelines guideline
    where guideline.id = v_debrief.content_guideline_id
      and guideline.content_run_id = v_run.id
      and guideline.client_id = v_debrief.client_id
  ) then
    raise exception 'Content Guideline ownership changed; review the debrief again';
  end if;

  for v_action in
    select value from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb))
  loop
    v_action_name := lower(coalesce(v_action ->> 'action', ''));
    v_note := nullif(trim(coalesce(v_action ->> 'note', '')), '');

    if coalesce(v_action ->> 'videoId', '') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then
      raise exception 'Invalid video identifier in debrief action';
    end if;
    v_video_id := (v_action ->> 'videoId')::uuid;

    select * into v_video
    from public.content_guide_ideas
    where id = v_video_id
      and content_guideline_id = v_debrief.content_guideline_id
      and client_id = v_debrief.client_id
      and status <> 'archived'
    for update;

    if v_video.id is null then
      raise exception 'A proposed video no longer belongs to this Content Guideline';
    end if;

    if v_action_name in ('no_change', 'uncertain') then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if v_action_name in ('shot', 'changed') then
      v_next_status := case
        when v_video.production_status = 'not_shot'
          and coalesce(v_video.onedrive_footage_url, '') ~* '^https://'
          then 'ready_to_edit'
        when v_video.production_status = 'not_shot' then 'shot'
        else v_video.production_status
      end;

      update public.content_guide_ideas
      set
        production_status = v_next_status,
        production_note = case
          when v_note is null then production_note
          when nullif(trim(coalesce(production_note, '')), '') is null then v_note
          else production_note || E'\n\nPost-run debrief: ' || v_note
        end,
        production_status_updated_at = case
          when production_status is distinct from v_next_status then now()
          else production_status_updated_at
        end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    if v_action_name = 'not_approved' then
      if v_video.production_status <> 'not_shot' then
        raise exception 'Video % has already moved beyond Not shot; review it manually', v_video.video_number;
      end if;
      update public.content_guide_ideas
      set production_note = case
        when v_note is null then 'Not approved on site.'
        when nullif(trim(coalesce(production_note, '')), '') is null then v_note
        else production_note || E'\n\nPost-run debrief: ' || v_note
      end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    if v_action_name = 'move_next_month' then
      if v_video.production_status not in ('not_shot', 'shot') then
        raise exception 'Video % is already in production and cannot be moved automatically', v_video.video_number;
      end if;
      v_next_month := (
        date_trunc(
          'month',
          coalesce(v_video.month, v_run.run_date, current_date)::timestamp
        ) + interval '1 month'
      )::date;
      update public.content_guide_ideas
      set
        month = v_next_month,
        deliverable_id = null,
        production_status = 'not_shot',
        production_status_updated_at = now(),
        production_note = case
          when v_note is null then 'Moved to next month after the Content Run. Client Schedule link requires confirmation.'
          when nullif(trim(coalesce(production_note, '')), '') is null then
            v_note || E'\nClient Schedule link requires confirmation.'
          else
            production_note || E'\n\nPost-run debrief: ' || v_note ||
            E'\nClient Schedule link requires confirmation.'
        end
      where id = v_video.id;
      v_applied := v_applied + 1;
      continue;
    end if;

    raise exception 'Unsupported debrief action: %', v_action_name;
  end loop;

  update public.content_run_debriefs
  set
    status = 'applied',
    applied_actions = coalesce(p_actions, '[]'::jsonb),
    applied_at = now()
  where id = v_debrief.id;

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped);
end;
$$;

revoke all on function public.apply_content_run_debrief(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.apply_content_run_debrief(uuid, jsonb)
  to authenticated;

-- Extend the safe client event projection with an opaque published-guideline
-- key. No internal guideline, run, calendar, or deliverable ID is returned.
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
    select case
      when public.is_staff() then p_client_id
      else public.my_client_id()
    end as allowed_client_id
  ), bounds as (
    select
      (date_trunc('month', p_month)::date::timestamp at time zone 'Africa/Johannesburg') as month_start,
      ((date_trunc('month', p_month) + interval '1 month')::date::timestamp at time zone 'Africa/Johannesburg') as next_month_start
  )
  select
    'event-' || substr(md5(event.id::text), 1, 16) as row_key,
    event.title,
    event.event_type,
    event.start_at as start_time,
    event.end_at as end_time,
    event.all_day,
    event.location,
    case
      when guideline.status = 'published'
        and guideline.client_published_at is not null
        then md5(guideline.id::text)
      else null
    end as guideline_row_key
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
    and event.start_at >= b.month_start
    and event.start_at < b.next_month_start
  order by event.start_at, event.title;
$$;

revoke all on function public.client_portal_month_ahead_events(uuid, date)
  from public, anon;
grant execute on function public.client_portal_month_ahead_events(uuid, date)
  to authenticated;

notify pgrst, 'reload schema';

commit;
