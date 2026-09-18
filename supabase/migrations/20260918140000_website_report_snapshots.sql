-- Website Growth #27 M1: immutable website snapshots attached to the existing
-- monthly report publication lifecycle. Applying this migration is a protected
-- production gate; the repository change does not apply it.

create table if not exists public.website_report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  website_id bigint not null check (website_id > 0),
  revision integer not null check (revision > 0),
  period_start date not null,
  period_end date not null,
  source_state text not null check (source_state in ('available', 'partial')),
  source_read_at timestamptz not null,
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint website_report_snapshot_period check (period_end > period_start),
  constraint website_report_snapshot_revision_unique unique (report_id, revision)
);

alter table public.reports
  add column if not exists website_report_snapshot_id uuid
  references public.website_report_snapshots(id) on delete set null;

create index if not exists website_report_snapshots_client_period_idx
  on public.website_report_snapshots (client_id, period_start, revision desc);

alter table public.website_report_snapshots enable row level security;
alter table public.website_report_snapshots force row level security;
revoke all on public.website_report_snapshots from public, anon, authenticated;

create or replace function public.reject_website_report_snapshot_update()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'Website report snapshots are immutable; create a new revision' using errcode = '55000';
end
$$;

drop trigger if exists website_report_snapshots_are_immutable on public.website_report_snapshots;
create trigger website_report_snapshots_are_immutable
before update on public.website_report_snapshots
for each row execute function public.reject_website_report_snapshot_update();

revoke all on function public.reject_website_report_snapshot_update() from public, anon, authenticated;

create or replace function public.client_safe_website_report(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when p_snapshot is null then null else jsonb_build_object(
    'version', p_snapshot -> 'version',
    'generatedAt', p_snapshot -> 'generatedAt',
    'identity', jsonb_build_object(
      'canonicalHost', p_snapshot #> '{identity,canonicalHost}',
      'environment', p_snapshot #> '{identity,environment}'
    ),
    'period', p_snapshot -> 'period',
    'traffic', p_snapshot -> 'traffic',
    'conversions', p_snapshot -> 'conversions',
    'commerce', p_snapshot -> 'commerce',
    'dataQuality', p_snapshot -> 'dataQuality'
  ) end
$$;

revoke all on function public.client_safe_website_report(jsonb) from public, anon, authenticated;

create or replace function public.save_website_report_snapshot(
  p_client_id uuid,
  p_period_start date,
  p_period_end date,
  p_snapshot jsonb,
  p_actor_id uuid
)
returns table (report_id uuid, snapshot_id uuid, revision integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_report public.reports%rowtype;
  v_snapshot_id uuid;
  v_revision integer;
  v_website_id bigint;
  v_source_state text;
  v_source_read_at timestamptz;
  v_client_name text;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_actor_id
      and profile.is_active
      and profile.role in ('admin', 'manager')
  ) then raise exception 'Active manager access required' using errcode = '42501'; end if;

  if p_period_end <= p_period_start
    or p_snapshot ->> 'version' <> '1'
    or p_snapshot #>> '{identity,dynamicsClientId}' <> p_client_id::text
    or p_snapshot #>> '{identity,environment}' <> 'production'
    or p_snapshot #>> '{period,from}' <> p_period_start::text
    or p_snapshot #>> '{period,to}' <> p_period_end::text
  then raise exception 'Website report identity or period mismatch' using errcode = '22023'; end if;

  v_website_id := nullif(p_snapshot ->> 'websiteId', '')::bigint;
  v_source_state := p_snapshot #>> '{dataQuality,state}';
  v_source_read_at := nullif(p_snapshot #>> '{dataQuality,sourceReadAt}', '')::timestamptz;
  if v_website_id is null or v_website_id <= 0
    or v_source_state not in ('available', 'partial')
    or v_source_read_at is null
  then raise exception 'Website report is not snapshot-ready' using errcode = '22023'; end if;

  select client.name into v_client_name
  from public.clients client
  where client.id = p_client_id and client.active;
  if not found then raise exception 'Active client required' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_client_id::text || ':' || p_period_start::text, 0)
  );

  select report.* into v_report
  from public.reports report
  where report.client_id = p_client_id
    and report.platform is null
    and report.period_start = p_period_start
  for update;

  if not found then
    insert into public.reports (
      client_id, platform, period_start, period_end, status, report_title, created_by
    ) values (
      p_client_id, null, p_period_start, p_period_end, 'draft',
      v_client_name || ' ' || to_char(p_period_start, 'FMMonth YYYY') || ' Report', p_actor_id
    ) returning * into v_report;
  elsif v_report.period_end is distinct from p_period_end then
    raise exception 'Existing monthly report period requires review' using errcode = '23514';
  elsif v_report.status = 'published' then
    raise exception 'Published report cannot receive an unreviewed snapshot' using errcode = '23514';
  end if;

  select coalesce(max(item.revision), 0) + 1 into v_revision
  from public.website_report_snapshots item
  where item.report_id = v_report.id;

  insert into public.website_report_snapshots (
    report_id, client_id, website_id, revision, period_start, period_end,
    source_state, source_read_at, snapshot, created_by
  ) values (
    v_report.id, p_client_id, v_website_id, v_revision, p_period_start, p_period_end,
    v_source_state, v_source_read_at, p_snapshot, p_actor_id
  ) returning id into v_snapshot_id;

  update public.reports
  set website_report_snapshot_id = v_snapshot_id
  where id = v_report.id;

  return query select v_report.id, v_snapshot_id, v_revision;
end
$$;

revoke all on function public.save_website_report_snapshot(uuid, date, date, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_website_report_snapshot(uuid, date, date, jsonb, uuid) to service_role;

create or replace function public.report_website_snapshot(p_report_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_snapshot jsonb;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then raise exception 'Active staff access required' using errcode = '42501'; end if;

  select snapshot.snapshot into v_snapshot
  from public.reports report
  join public.website_report_snapshots snapshot
    on snapshot.id = report.website_report_snapshot_id
   and snapshot.report_id = report.id
   and snapshot.client_id = report.client_id
  where report.id = p_report_id;

  return public.client_safe_website_report(v_snapshot);
end
$$;

revoke all on function public.report_website_snapshot(uuid) from public, anon;
grant execute on function public.report_website_snapshot(uuid) to authenticated;

create or replace function public.enforce_publishable_website_snapshot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_state text;
  v_environment text;
begin
  if new.status = 'published' and new.website_report_snapshot_id is not null
    and (old.status is distinct from 'published' or old.website_report_snapshot_id is distinct from new.website_report_snapshot_id)
  then
    select snapshot.source_state, snapshot.snapshot #>> '{identity,environment}'
    into v_state, v_environment
    from public.website_report_snapshots snapshot
    where snapshot.id = new.website_report_snapshot_id
      and snapshot.report_id = new.id
      and snapshot.client_id = new.client_id;

    if not found or v_state not in ('available', 'partial') or v_environment <> 'production' then
      raise exception 'Website snapshot is not publishable' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

revoke all on function public.enforce_publishable_website_snapshot() from public, anon, authenticated;

drop trigger if exists reports_enforce_publishable_website_snapshot on public.reports;
create trigger reports_enforce_publishable_website_snapshot
before update of status, website_report_snapshot_id on public.reports
for each row execute function public.enforce_publishable_website_snapshot();

drop function if exists public.client_published_reports();
create function public.client_published_reports()
returns table (
  id uuid,
  platform text,
  period_start date,
  period_end date,
  status text,
  report_title text,
  previous_month_strategy text,
  previous_month_reflection text,
  performance_comments text,
  strategy_next_month text,
  content_direction_next_month text,
  boost_recommendation text,
  strategy_data jsonb,
  website_report jsonb,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role = 'client'
      and profile.client_id is not null
  ) then raise exception 'Active client access required' using errcode = '42501'; end if;

  return query select
    report.id,
    report.platform,
    report.period_start,
    report.period_end,
    report.status,
    report.report_title,
    report.previous_month_strategy,
    report.previous_month_reflection,
    report.performance_comments,
    report.strategy_next_month,
    report.content_direction_next_month,
    report.boost_recommendation,
    public.client_safe_strategy_data(report.strategy_data),
    public.client_safe_website_report(snapshot.snapshot),
    report.published_at
  from public.reports report
  left join public.website_report_snapshots snapshot
    on snapshot.id = report.website_report_snapshot_id
   and snapshot.report_id = report.id
   and snapshot.client_id = report.client_id
  where report.status = 'published'
    and report.client_id = public.my_client_id()
  order by report.period_start desc, report.created_at desc;
end
$$;

revoke all on function public.client_published_reports() from public, anon;
grant execute on function public.client_published_reports() to authenticated;
