-- Content Guideline document model
--
-- Permanent product rule:
-- One Content Run has one Content Guideline. A Content Guideline contains
-- multiple ordered videos. Each video has a name and script. The same guideline
-- is used by staff, calendar workflow and the client portal.
--
-- Access model:
-- - authenticated staff edit internal guideline documents and videos;
-- - clients never read these tables directly;
-- - clients read only their own published document through a narrow RPC;
-- - publication is document-level and requires every active video to have a
--   name and complete script;
-- - content_runs remains the run identity and company_calendar_events remains
--   the linked calendar identity;
-- - existing content_guide_ideas rows are evolved in place into video rows so
--   scripts are not duplicated across tables.

create table if not exists public.content_guidelines (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid not null references public.content_runs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null,
  month date,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'published', 'archived')),
  client_published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_guidelines_one_per_run unique (content_run_id)
);

comment on table public.content_guidelines is
  'Canonical Content Guideline document. Exactly one per Content Run; publication applies to the complete ordered video document.';

create index if not exists idx_content_guidelines_client_month
  on public.content_guidelines (client_id, month);
create index if not exists idx_content_guidelines_published
  on public.content_guidelines (client_id, client_published_at)
  where client_published_at is not null and status <> 'archived';

drop trigger if exists trg_content_guidelines_updated_at on public.content_guidelines;
create trigger trg_content_guidelines_updated_at
  before update on public.content_guidelines
  for each row execute function public.update_planner_updated_at();

alter table public.content_guide_ideas
  add column if not exists content_guideline_id uuid references public.content_guidelines(id) on delete set null,
  add column if not exists position integer,
  add column if not exists migration_review_reason text;

comment on column public.content_guide_ideas.content_guideline_id is
  'Parent Content Guideline document. A linked row is one ordered video, not a standalone guideline.';
comment on column public.content_guide_ideas.position is
  'One-based video order within the parent Content Guideline.';
comment on column public.content_guide_ideas.migration_review_reason is
  'Why a legacy video could not be linked deterministically during the parent-document migration.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_guide_ideas_position_check'
      and conrelid = 'public.content_guide_ideas'::regclass
  ) then
    alter table public.content_guide_ideas
      add constraint content_guide_ideas_position_check
      check (position is null or position > 0);
  end if;
end $$;

create index if not exists idx_content_guide_ideas_guideline
  on public.content_guide_ideas (content_guideline_id);
create unique index if not exists uniq_content_guideline_video_position
  on public.content_guide_ideas (content_guideline_id, position)
  where content_guideline_id is not null and status <> 'archived';

create or replace function public.validate_content_guideline_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.content_runs;
begin
  select * into v_run
  from public.content_runs
  where id = new.content_run_id
  for key share;

  if v_run.id is null then
    raise exception 'Content Run not found';
  end if;
  if v_run.client_id is null then
    raise exception 'Assign a client to the Content Run before creating its Content Guideline';
  end if;
  if new.client_id is distinct from v_run.client_id then
    raise exception 'Content Guideline and Content Run must belong to the same client';
  end if;
  if new.month is null and v_run.run_date is not null then
    new.month := date_trunc('month', v_run.run_date)::date;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_content_guideline_parent() from public, anon, authenticated;

drop trigger if exists trg_validate_content_guideline_parent on public.content_guidelines;
create trigger trg_validate_content_guideline_parent
  before insert or update of content_run_id, client_id, month
  on public.content_guidelines
  for each row execute function public.validate_content_guideline_parent();

create or replace function public.validate_content_run_guideline_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is distinct from old.client_id
    and exists (
      select 1
      from public.content_guidelines guideline
      where guideline.content_run_id = new.id
        and guideline.client_id is distinct from new.client_id
    )
  then
    raise exception 'Content Run client cannot change while its Content Guideline belongs to another client';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_content_run_guideline_client() from public, anon, authenticated;

drop trigger if exists trg_validate_content_run_guideline_client on public.content_runs;
create trigger trg_validate_content_run_guideline_client
  before update of client_id on public.content_runs
  for each row execute function public.validate_content_run_guideline_client();

create or replace function public.validate_content_guideline_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_client_id uuid;
  v_parent_status text;
  v_deliverable_client_id uuid;
begin
  if new.content_guideline_id is null then
    return new;
  end if;

  select client_id, status into v_parent_client_id, v_parent_status
  from public.content_guidelines
  where id = new.content_guideline_id
  for key share;

  if v_parent_client_id is null then
    raise exception 'Content Guideline not found';
  end if;

  if new.client_id is not null and new.client_id is distinct from v_parent_client_id then
    raise exception 'Video and Content Guideline must belong to the same client';
  end if;
  new.client_id := v_parent_client_id;

  if v_parent_status = 'published' and new.status = 'archived' then
    raise exception 'Unpublish the Content Guideline before archiving a video';
  end if;
  if v_parent_status = 'published'
    and (nullif(trim(new.title), '') is null or nullif(trim(new.script), '') is null)
  then
    raise exception 'Published Content Guideline videos require a name and complete script';
  end if;
  if new.status <> 'archived' and new.position is null then
    raise exception 'Content Guideline videos require an order position';
  end if;
  if new.deliverable_id is not null then
    select client_id into v_deliverable_client_id
    from public.monthly_deliverables
    where id = new.deliverable_id
    for key share;

    if v_deliverable_client_id is null then
      raise exception 'Monthly deliverable not found';
    end if;
    if v_deliverable_client_id is distinct from v_parent_client_id then
      raise exception 'Video deliverable and Content Guideline must belong to the same client';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_content_guideline_video() from public, anon, authenticated;

drop trigger if exists trg_validate_content_guideline_video on public.content_guide_ideas;
create trigger trg_validate_content_guideline_video
  before insert or update
  on public.content_guide_ideas
  for each row execute function public.validate_content_guideline_video();

-- Deterministic legacy backfill. Only videos linked to exactly one run, where
-- both rows already have the same non-null client, are grouped automatically.
with legacy_candidates as (
  select
    i.run_id,
    g.client_id,
    min(g.month) as month,
    min(g.created_by::text)::uuid as created_by
  from public.content_guide_ideas g
  join public.content_run_items i on i.guide_idea_id = g.id
  join public.content_runs r on r.id = i.run_id
  where r.client_id is not null
    and g.client_id = r.client_id
    and (
      select count(*)
      from public.content_run_items links
      where links.guide_idea_id = g.id
    ) = 1
  group by i.run_id, g.client_id
)
insert into public.content_guidelines (
  content_run_id,
  client_id,
  title,
  month,
  status,
  created_by
)
select
  candidate.run_id,
  candidate.client_id,
  'CONTENT GUIDELINE - ' || coalesce(client.name, run.client_name, 'CLIENT') ||
    case
      when coalesce(candidate.month, date_trunc('month', run.run_date)::date) is not null
      then ' - ' || upper(to_char(coalesce(candidate.month, date_trunc('month', run.run_date)::date), 'FMMonth YYYY'))
      else ''
    end,
  coalesce(candidate.month, date_trunc('month', run.run_date)::date),
  'draft',
  candidate.created_by
from legacy_candidates candidate
join public.content_runs run on run.id = candidate.run_id
left join public.clients client on client.id = candidate.client_id
on conflict (content_run_id) do nothing;

with ranked as (
  select
    g.id as video_id,
    parent.id as guideline_id,
    row_number() over (
      partition by parent.id
      order by coalesce(i.sort_order, g.video_number, 2147483647), g.created_at, g.id
    )::integer as position
  from public.content_guide_ideas g
  join public.content_run_items i on i.guide_idea_id = g.id
  join public.content_runs r on r.id = i.run_id
  join public.content_guidelines parent on parent.content_run_id = r.id
  where r.client_id is not null
    and g.client_id = r.client_id
    and (
      select count(*)
      from public.content_run_items links
      where links.guide_idea_id = g.id
    ) = 1
)
update public.content_guide_ideas video
set
  content_guideline_id = ranked.guideline_id,
  position = ranked.position,
  video_number = coalesce(video.video_number, ranked.position),
  migration_review_reason = null
from ranked
where video.id = ranked.video_id
  and video.content_guideline_id is null;

with link_quality as (
  select
    g.id,
    count(i.id) as link_count,
    count(i.id) filter (where r.client_id is null) as null_run_client_count,
    count(i.id) filter (where g.client_id is null or g.client_id is distinct from r.client_id) as mismatch_count
  from public.content_guide_ideas g
  left join public.content_run_items i on i.guide_idea_id = g.id
  left join public.content_runs r on r.id = i.run_id
  where g.content_guideline_id is null
  group by g.id
)
update public.content_guide_ideas video
set migration_review_reason = case
  when quality.link_count = 0 then 'unlinked_legacy_video'
  when quality.link_count > 1 then 'multiple_run_links'
  when quality.null_run_client_count > 0 then 'run_client_missing'
  when quality.mismatch_count > 0 then 'client_mismatch_or_missing'
  else 'legacy_link_requires_review'
end
from link_quality quality
where video.id = quality.id
  and video.content_guideline_id is null;

alter table public.content_guidelines enable row level security;

drop policy if exists "content_guidelines: staff select" on public.content_guidelines;
create policy "content_guidelines: staff select"
  on public.content_guidelines for select to authenticated
  using ((select public.is_staff()));
drop policy if exists "content_guidelines: staff insert" on public.content_guidelines;
create policy "content_guidelines: staff insert"
  on public.content_guidelines for insert to authenticated
  with check ((select public.is_staff()));
drop policy if exists "content_guidelines: staff update" on public.content_guidelines;
create policy "content_guidelines: staff update"
  on public.content_guidelines for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

revoke all on table public.content_guidelines from anon;
grant select, insert, update on table public.content_guidelines to authenticated;

create or replace function public.get_or_create_content_guideline(p_run_id uuid)
returns public.content_guidelines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.content_runs;
  v_guideline public.content_guidelines;
  v_client_name text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_run
  from public.content_runs
  where id = p_run_id
  for update;

  if v_run.id is null then
    raise exception 'Content Run not found';
  end if;
  if v_run.client_id is null then
    raise exception 'Assign a client to the Content Run before creating its Content Guideline';
  end if;

  select * into v_guideline
  from public.content_guidelines
  where content_run_id = p_run_id;

  if v_guideline.id is not null then
    return v_guideline;
  end if;

  select name into v_client_name
  from public.clients
  where id = v_run.client_id;

  insert into public.content_guidelines (
    content_run_id,
    client_id,
    title,
    month,
    created_by
  ) values (
    v_run.id,
    v_run.client_id,
    'CONTENT GUIDELINE - ' || coalesce(v_client_name, v_run.client_name, 'CLIENT') ||
      case when v_run.run_date is not null
        then ' - ' || upper(to_char(v_run.run_date, 'FMMonth YYYY'))
        else '' end,
    case when v_run.run_date is not null then date_trunc('month', v_run.run_date)::date else null end,
    auth.uid()
  )
  on conflict (content_run_id) do nothing;

  select * into v_guideline
  from public.content_guidelines
  where content_run_id = p_run_id;

  return v_guideline;
end;
$$;

revoke all on function public.get_or_create_content_guideline(uuid) from public, anon, authenticated;
grant execute on function public.get_or_create_content_guideline(uuid) to authenticated;

create or replace function public.reorder_content_guideline_videos(
  p_guideline_id uuid,
  p_video_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_count integer;
  v_distinct_count integer;
  v_index integer;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  perform 1 from public.content_guidelines where id = p_guideline_id for update;
  if not found then
    raise exception 'Content Guideline not found';
  end if;

  select count(*) into v_expected_count
  from public.content_guide_ideas
  where content_guideline_id = p_guideline_id and status <> 'archived';

  select count(distinct video_id) into v_distinct_count
  from unnest(coalesce(p_video_ids, array[]::uuid[])) as video_id;

  if cardinality(coalesce(p_video_ids, array[]::uuid[])) <> v_expected_count
    or v_distinct_count <> v_expected_count
    or exists (
      select 1
      from unnest(coalesce(p_video_ids, array[]::uuid[])) as requested(video_id)
      left join public.content_guide_ideas video
        on video.id = requested.video_id
       and video.content_guideline_id = p_guideline_id
       and video.status <> 'archived'
      where video.id is null
    )
  then
    raise exception 'Video order must include each active video exactly once';
  end if;

  update public.content_guide_ideas
  set position = position + 1000000
  where content_guideline_id = p_guideline_id and status <> 'archived';

  if v_expected_count > 0 then
    for v_index in 1..v_expected_count loop
      update public.content_guide_ideas
      set position = v_index,
          video_number = v_index
      where id = p_video_ids[v_index]
        and content_guideline_id = p_guideline_id;
    end loop;
  end if;
end;
$$;

revoke all on function public.reorder_content_guideline_videos(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_content_guideline_videos(uuid, uuid[]) to authenticated;

create or replace function public.set_content_guideline_publication(
  p_guideline_id uuid,
  p_publish boolean
)
returns public.content_guidelines
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guideline public.content_guidelines;
  v_video_count integer;
  v_incomplete_count integer;
begin
  if not public.is_staff() then
    raise exception 'Staff access required';
  end if;

  select * into v_guideline
  from public.content_guidelines
  where id = p_guideline_id
  for update;

  if v_guideline.id is null then
    raise exception 'Content Guideline not found';
  end if;

  if p_publish then
    select
      count(*),
      count(*) filter (
        where nullif(trim(title), '') is null
           or nullif(trim(script), '') is null
      )
    into v_video_count, v_incomplete_count
    from public.content_guide_ideas
    where content_guideline_id = p_guideline_id
      and status <> 'archived';

    if v_video_count = 0 then
      raise exception 'Add at least one video before publishing';
    end if;
    if v_incomplete_count > 0 then
      raise exception 'Every video needs a name and complete script before publishing';
    end if;
  end if;

  update public.content_guidelines
  set
    client_published_at = case when p_publish then now() else null end,
    status = case when p_publish then 'published' else 'ready' end
  where id = p_guideline_id
  returning * into v_guideline;

  return v_guideline;
end;
$$;

revoke all on function public.set_content_guideline_publication(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_content_guideline_publication(uuid, boolean) to authenticated;

create or replace function public.client_portal_published_content_guidelines(
  p_client_id uuid default null,
  p_month date default null
)
returns table (
  row_key text,
  title text,
  month date,
  run_name text,
  filming_date date,
  published_at timestamptz,
  videos jsonb
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  if public.is_staff() then
    v_client_id := p_client_id;
  else
    v_client_id := public.my_client_id();
  end if;

  if v_client_id is null then
    return;
  end if;

  return query
  select
    md5(guideline.id::text) as row_key,
    guideline.title,
    guideline.month,
    run.name as run_name,
    run.run_date as filming_date,
    guideline.client_published_at as published_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'position', video.position,
          'title', video.title,
          'script', video.script,
          'objective', video.objective,
          'hook', video.hook,
          'shot_breakdown', video.shot_breakdown,
          'cta', video.cta,
          'visual_notes', video.visual_notes,
          'platform', video.platform,
          'format', video.format
        ) order by video.position, video.created_at
      ) filter (where video.id is not null),
      '[]'::jsonb
    ) as videos
  from public.content_guidelines guideline
  join public.content_runs run on run.id = guideline.content_run_id
  left join public.content_guide_ideas video
    on video.content_guideline_id = guideline.id
   and video.status <> 'archived'
  where guideline.client_id = v_client_id
    and guideline.client_published_at is not null
    and guideline.status = 'published'
    and (p_month is null or guideline.month = date_trunc('month', p_month)::date)
  group by guideline.id, run.id
  order by guideline.month desc nulls last, run.run_date desc nulls last, guideline.created_at desc;
end;
$$;

comment on function public.client_portal_published_content_guidelines(uuid, date) is
  'Client-safe projection of the signed-in client own published Content Guideline documents and ordered videos. Internal notes, production fields and IDs are excluded.';

revoke all on function public.client_portal_published_content_guidelines(uuid, date) from public, anon, authenticated;
grant execute on function public.client_portal_published_content_guidelines(uuid, date) to authenticated;

notify pgrst, 'reload schema';
