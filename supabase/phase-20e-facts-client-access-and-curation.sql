-- ============================================================================
-- phase-20e-facts-client-access-and-curation.sql
--
-- Report-bound access to normalized monthly facts and persistent top-content
-- curation. Clients never receive direct table access: SECURITY DEFINER RPCs
-- authorize a specific published report and return an explicit safe projection.
-- Staff retain RLS-protected table access and receive a separate technical
-- health projection. Connector fact writes use one atomic service-role RPC.
--
-- Depends on phase-20d-meta-reporting-truth.sql and phase-3e-master-reports.sql.
-- Additive and idempotent; no existing fact or exclusion rows are deleted.
-- ============================================================================

-- 1. Persistent report content exclusions -----------------------------------
create table if not exists public.report_content_exclusions (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid not null references public.reports(id) on delete cascade,
  client_id      uuid not null references public.clients(id) on delete cascade,
  platform       text,
  meta_object_id text not null,
  post_id        uuid references public.posts(id) on delete set null,
  excluded       boolean not null default true,
  reason         text,
  excluded_by    uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fill only safely inferable legacy platform values. Unresolved rows are kept.
update public.report_content_exclusions e
set platform = coalesce(
  (
    select p.platform
    from public.posts p
    where p.id = e.post_id and p.report_id = e.report_id
  ),
  r.platform
)
from public.reports r
where e.report_id = r.id
  and e.platform is null
  and coalesce(
    (
      select p.platform
      from public.posts p
      where p.id = e.post_id and p.report_id = e.report_id
    ),
    r.platform
  ) is not null;

-- Create platform-aware uniqueness before removing the old, overly broad
-- UNIQUE(report_id, meta_object_id) constraint. Existing rows cannot conflict
-- because the old constraint was stricter, including rows with NULL platform.
create unique index if not exists uq_report_content_exclusions_report_platform_object
  on public.report_content_exclusions (report_id, platform, meta_object_id);

do $$
declare
  v_constraint_name text;
begin
  select c.conname
  into v_constraint_name
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.report_content_exclusions'::regclass
    and c.contype = 'u'
    and (
      select array_agg(a.attname order by u.ordinality)
      from unnest(c.conkey) with ordinality as u(attnum, ordinality)
      join pg_catalog.pg_attribute a
        on a.attrelid = c.conrelid and a.attnum = u.attnum
    ) = array['report_id', 'meta_object_id']::name[]
  limit 1;

  if v_constraint_name is not null then
    execute format(
      'alter table public.report_content_exclusions drop constraint %I',
      v_constraint_name
    );
  end if;
end
$$;

-- Connector runs start non-terminal so an interrupted Edge execution can never
-- remain recorded as a verified success.
do $$
declare
  v_definition text;
begin
  select pg_get_constraintdef(c.oid)
    into v_definition
  from pg_catalog.pg_constraint c
  where c.conrelid = 'public.platform_sync_runs'::regclass
    and c.conname = 'platform_sync_runs_status_check';

  if v_definition is null or position('running' in v_definition) = 0 then
    alter table public.platform_sync_runs drop constraint if exists platform_sync_runs_status_check;
    alter table public.platform_sync_runs
      add constraint platform_sync_runs_status_check
      check (status in ('running', 'success', 'partial', 'failed', 'skipped'));
  end if;
end
$$;

create index if not exists idx_report_content_exclusions_report
  on public.report_content_exclusions (report_id) where excluded;
create index if not exists idx_report_content_exclusions_client
  on public.report_content_exclusions (client_id);

drop trigger if exists trg_report_content_exclusions_touch on public.report_content_exclusions;
create trigger trg_report_content_exclusions_touch
before update on public.report_content_exclusions
for each row execute function public.touch_updated_at();

-- NOT VALID preserves legacy rows while enforcing integrity for new/changed
-- rows. The mutation RPC below applies stricter cross-table validation.
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.report_content_exclusions'::regclass
      and conname = 'report_content_exclusions_platform_present'
  ) then
    alter table public.report_content_exclusions
      add constraint report_content_exclusions_platform_present
      check (platform is not null and btrim(platform) <> '') not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.report_content_exclusions'::regclass
      and conname = 'report_content_exclusions_meta_object_present'
  ) then
    alter table public.report_content_exclusions
      add constraint report_content_exclusions_meta_object_present
      check (btrim(meta_object_id) <> '') not valid;
  end if;
end
$$;

comment on table public.report_content_exclusions is
  'Staff curation of client-facing report highlights. Exclusions do not alter aggregate facts and are keyed by report, platform and stable provider object ID.';

-- 2. Fact integrity and lookup uniqueness ------------------------------------
create unique index if not exists uq_metric_facts_client_platform_month_metric
  on public.platform_metric_facts_monthly
    (client_id, platform, period_month, metric_key);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.platform_metric_facts_monthly'::regclass
      and conname = 'metric_facts_monthly_period_format'
  ) then
    alter table public.platform_metric_facts_monthly
      add constraint metric_facts_monthly_period_format
      check (
        period_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
        and period_start <= period_end
        and to_char(period_start, 'YYYY-MM') = period_month
        and to_char(period_end, 'YYYY-MM') = period_month
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.platform_metric_facts_monthly'::regclass
      and conname = 'metric_facts_monthly_identity_present'
  ) then
    alter table public.platform_metric_facts_monthly
      add constraint metric_facts_monthly_identity_present
      check (btrim(platform) <> '' and btrim(metric_key) <> '') not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.platform_metric_facts_monthly'::regclass
      and conname = 'metric_facts_monthly_availability_value'
  ) then
    alter table public.platform_metric_facts_monthly
      add constraint metric_facts_monthly_availability_value
      check (
        (availability in ('complete', 'valid_zero', 'partial', 'stale') and value is not null)
        or
        (availability in ('unavailable', 'permission_blocked', 'error') and value is null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.platform_metric_facts_monthly'::regclass
      and conname = 'metric_facts_monthly_valid_zero_value'
  ) then
    alter table public.platform_metric_facts_monthly
      add constraint metric_facts_monthly_valid_zero_value
      check (availability <> 'valid_zero' or value = 0) not valid;
  end if;
end
$$;

-- 3. RLS: staff table access only; clients must use report-bound RPCs --------
alter table public.platform_metric_facts_monthly enable row level security;
alter table public.report_content_exclusions enable row level security;

drop policy if exists "platform_metric_facts_monthly: client reads own"
  on public.platform_metric_facts_monthly;
drop policy if exists "report_content_exclusions: client reads own"
  on public.report_content_exclusions;

drop policy if exists "platform_metric_facts_monthly: staff read"
  on public.platform_metric_facts_monthly;
create policy "platform_metric_facts_monthly: staff read"
  on public.platform_metric_facts_monthly
  for select using (public.is_staff());

drop policy if exists "report_content_exclusions: staff manage"
  on public.report_content_exclusions;
create policy "report_content_exclusions: staff manage"
  on public.report_content_exclusions
  for select using (public.is_admin());

-- 4. Report-bound client-safe monthly facts ----------------------------------
create or replace function public.get_report_metric_facts(p_report_id uuid)
returns table (
  platform text,
  period_month text,
  period_start date,
  period_end date,
  metric_key text,
  source_metric text,
  value numeric,
  availability text,
  includes_paid text,
  aggregation text,
  comparable_group text
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
  v_status text;
  v_report_month text;
begin
  select r.client_id, r.status,
         to_char(date_trunc('month', r.period_end), 'YYYY-MM')
  into v_client_id, v_status, v_report_month
  from public.reports r
  where r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_staff()
    or (
      v_status = 'published'
      and v_client_id = public.my_client_id()
    )
  ) then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select f.platform, f.period_month, f.period_start, f.period_end,
         f.metric_key, f.source_metric, f.value,
         f.availability, f.includes_paid, f.aggregation, f.comparable_group
  from public.platform_metric_facts_monthly f
  where f.client_id = v_client_id
    and f.period_month in (
      v_report_month,
      to_char(to_date(v_report_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')
    )
    and exists (
      select 1
      from public.metric_registry mr
      where mr.platform = f.platform
        and mr.metric_key = f.metric_key
        and mr.client_safe
        and (
          mr.status = 'active'
          or (public.is_staff() and mr.status = 'experimental')
        )
    )
  order by f.period_month desc, f.platform, f.metric_key;
end
$$;

-- Client-safe activation state distinguishes a genuine legacy report (no
-- normalized attempt yet) from a failed normalized sync with no fact rows.
create or replace function public.get_report_metric_fact_status(p_report_id uuid)
returns table (
  normalized_attempted boolean,
  current_fact_count bigint,
  ready_fact_count bigint
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
  v_status text;
  v_report_month text;
begin
  select r.client_id, r.status, to_char(date_trunc('month', r.period_end), 'YYYY-MM')
    into v_client_id, v_status, v_report_month
  from public.reports r
  where r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;
  if not (
    public.is_staff()
    or (v_status = 'published' and v_client_id = public.my_client_id())
  ) then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select
    exists (
      select 1 from public.platform_sync_runs sr
      where sr.client_id = v_client_id and sr.period_month = v_report_month
    ) or exists (
      select 1 from public.platform_metric_facts_monthly f
      where f.client_id = v_client_id and f.period_month = v_report_month
    ),
    (select count(*) from public.platform_metric_facts_monthly f
      where f.client_id = v_client_id and f.period_month = v_report_month),
    (select count(*)
      from public.platform_metric_facts_monthly f
      join public.metric_registry mr
        on mr.platform = f.platform and mr.metric_key = f.metric_key
       and mr.client_safe and mr.status = 'active'
      where f.client_id = v_client_id
        and f.period_month = v_report_month
        and f.availability in ('complete', 'valid_zero')
        and f.value is not null);
end
$$;

-- 5. Staff-only report data health -------------------------------------------
create or replace function public.get_report_fact_health(p_report_id uuid)
returns table (
  period_month text,
  platform text,
  attempted boolean,
  successful boolean,
  latest_run_status text,
  latest_health_state text,
  latest_attempted_at timestamptz,
  last_successful_at timestamptz,
  api_version text,
  connector_version text,
  metric_key text,
  fact_value numeric,
  fact_availability text,
  source_metric text,
  aggregation text,
  comparable_group text,
  includes_paid text,
  fact_verified_at timestamptz,
  permission_blocked boolean,
  partial_error_or_stale boolean,
  comparison_eligible boolean,
  safe_reference text,
  ready_for_client_reporting boolean
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
  v_report_month text;
begin
  if not public.is_staff() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  select r.client_id,
         to_char(date_trunc('month', r.period_end), 'YYYY-MM')
  into v_client_id, v_report_month
  from public.reports r
  where r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  return query
  with run_health as (
    select sr.period_month, sr.platform,
           true as attempted,
           bool_or(sr.status = 'success') as successful,
           (array_agg(sr.status order by coalesce(sr.finished_at, sr.created_at) desc))[1] as latest_run_status,
           (array_agg(sr.health_state order by coalesce(sr.finished_at, sr.created_at) desc))[1] as latest_health_state,
           max(coalesce(sr.finished_at, sr.started_at, sr.created_at)) as latest_attempted_at,
           max(coalesce(sr.finished_at, sr.started_at, sr.created_at))
             filter (where sr.status = 'success') as last_successful_at,
           (array_agg(sr.api_version order by coalesce(sr.finished_at, sr.created_at) desc))[1] as api_version,
           (array_agg(sr.connector_version order by coalesce(sr.finished_at, sr.created_at) desc))[1] as connector_version,
           (array_agg(sr.id::text order by coalesce(sr.finished_at, sr.created_at) desc))[1] as safe_reference
    from public.platform_sync_runs sr
    where sr.client_id = v_client_id
      and sr.period_month in (
        v_report_month,
        to_char(to_date(v_report_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')
      )
    group by sr.period_month, sr.platform
  ), relevant_facts as (
    select f.*
    from public.platform_metric_facts_monthly f
    where f.client_id = v_client_id
      and f.period_month in (
        v_report_month,
        to_char(to_date(v_report_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')
      )
  ), current_with_previous as (
    select f.*,
           previous.value as previous_value,
           previous.availability as previous_availability,
           previous.source_metric as previous_source_metric,
           previous.aggregation as previous_aggregation,
           previous.comparable_group as previous_comparable_group,
           previous.includes_paid as previous_includes_paid,
           previous.period_start as previous_period_start,
           previous.period_end as previous_period_end
    from relevant_facts f
    left join relevant_facts previous
      on f.period_month = v_report_month
     and previous.period_month = to_char(to_date(v_report_month || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM')
     and previous.platform = f.platform
     and previous.metric_key = f.metric_key
  )
  select coalesce(f.period_month, rh.period_month),
         coalesce(f.platform, rh.platform),
         coalesce(rh.attempted, false),
         coalesce(rh.successful, false),
         rh.latest_run_status,
         rh.latest_health_state,
         rh.latest_attempted_at,
         rh.last_successful_at,
         coalesce(f.api_version, rh.api_version),
         coalesce(f.connector_version, rh.connector_version),
         f.metric_key,
         f.value,
         f.availability,
         f.source_metric,
         f.aggregation,
         f.comparable_group,
         f.includes_paid,
         f.verified_at,
         coalesce(f.availability = 'permission_blocked' or rh.latest_health_state = 'permission_blocked', false),
         coalesce(f.availability in ('partial', 'error', 'stale') or rh.latest_run_status in ('partial', 'failed'), false),
         coalesce(
           f.period_month = v_report_month
           and f.availability in ('complete', 'valid_zero')
           and f.value is not null
           and f.previous_availability in ('complete', 'valid_zero')
           and f.previous_value is not null
           and coalesce(f.source_metric, '') = coalesce(f.previous_source_metric, '')
           and coalesce(f.aggregation, '') = coalesce(f.previous_aggregation, '')
           and coalesce(f.comparable_group, '') = coalesce(f.previous_comparable_group, '')
           and coalesce(f.includes_paid, '') = coalesce(f.previous_includes_paid, '')
           and f.period_start = date_trunc('month', f.period_start)::date
           and f.period_end = (date_trunc('month', f.period_start) + interval '1 month - 1 day')::date
           and f.previous_period_start = date_trunc('month', f.previous_period_start)::date
           and f.previous_period_end = (date_trunc('month', f.previous_period_start) + interval '1 month - 1 day')::date,
           false
         ),
         rh.safe_reference,
         coalesce(
           f.period_month = v_report_month
           and f.availability in ('complete', 'valid_zero')
            and f.value is not null
            and rh.latest_run_status in ('success', 'partial')
            and rh.latest_health_state in ('verified', 'verified_partial')
            and exists (
              select 1
              from public.metric_registry mr
              where mr.platform = f.platform
                and mr.metric_key = f.metric_key
                and mr.client_safe
                and mr.status = 'active'
            ),
            false
          )
  from current_with_previous f
  full join run_health rh
    on rh.period_month = f.period_month and rh.platform = f.platform
  order by coalesce(f.period_month, rh.period_month) desc,
           coalesce(f.platform, rh.platform), f.metric_key nulls last;
end
$$;

-- 6. Report-bound safe exclusion flags --------------------------------------
create or replace function public.get_report_content_exclusions(p_report_id uuid)
returns table (
  platform text,
  meta_object_id text,
  excluded boolean
)
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
  v_status text;
begin
  select r.client_id, r.status
  into v_client_id, v_status
  from public.reports r
  where r.id = p_report_id;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_staff()
    or (
      v_status = 'published'
      and v_client_id = public.my_client_id()
    )
  ) then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select e.platform, e.meta_object_id, e.excluded
  from public.report_content_exclusions e
  where e.report_id = p_report_id
    and e.client_id = v_client_id
  order by e.platform, e.meta_object_id;
end
$$;

-- 7. Staff-only exclusion mutation with cross-table integrity checks ---------
create or replace function public.set_report_content_exclusion(
  p_report_id uuid,
  p_client_id uuid,
  p_post_id uuid,
  p_platform text,
  p_meta_object_id text,
  p_excluded boolean,
  p_reason text default null
)
returns table (
  platform text,
  meta_object_id text,
  excluded boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  v_report_platform text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_client_id is null or p_post_id is null or p_excluded is null
     or nullif(btrim(p_platform), '') is null
     or nullif(btrim(p_meta_object_id), '') is null then
    raise exception 'Report, client, post, platform, object ID and exclusion flag are required'
      using errcode = '22023';
  end if;

  select r.platform
  into v_report_platform
  from public.reports r
  where r.id = p_report_id and r.client_id = p_client_id;

  if not found then
    raise exception 'Report/client mismatch' using errcode = '23514';
  end if;

  if v_report_platform is not null and v_report_platform <> btrim(p_platform) then
    raise exception 'Report/platform mismatch' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.report_id = p_report_id
      and p.platform = btrim(p_platform)
      and p.meta_post_id = btrim(p_meta_object_id)
  ) then
    raise exception 'Post/report/platform/object mismatch' using errcode = '23514';
  end if;

  insert into public.report_content_exclusions as e
    (report_id, client_id, platform, meta_object_id, post_id, excluded, reason, excluded_by)
  values
    (p_report_id, p_client_id, btrim(p_platform), btrim(p_meta_object_id),
     p_post_id, p_excluded, nullif(btrim(p_reason), ''), auth.uid())
  on conflict (report_id, platform, meta_object_id) do update
  set client_id = excluded.client_id,
      post_id = excluded.post_id,
      excluded = excluded.excluded,
      reason = excluded.reason,
      excluded_by = auth.uid()
  returning e.platform, e.meta_object_id, e.excluded
  into platform, meta_object_id, excluded;

  return next;
end
$$;

-- 8. Atomic service-role-only preserve-verified fact upsert -----------------
-- Drop first because PostgreSQL cannot CREATE OR REPLACE a function when its
-- return type changes (the earlier Phase 20e draft returned a table row).
drop function if exists public.upsert_platform_metric_fact_preserving_verified(
  uuid, uuid, text, text, date, date, text, text, numeric, text, text, text,
  text, text, text, text, jsonb, uuid, timestamptz
);

create or replace function public.upsert_platform_metric_fact_preserving_verified(
  p_client_id uuid,
  p_asset_id uuid,
  p_platform text,
  p_period_month text,
  p_period_start date,
  p_period_end date,
  p_metric_key text,
  p_source_metric text,
  p_value numeric,
  p_availability text,
  p_includes_paid text,
  p_aggregation text,
  p_comparable_group text,
  p_api_version text,
  p_connector_version text,
  p_source_timezone text,
  p_provenance jsonb,
  p_sync_run_id uuid,
  p_verified_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_outcome text;
  v_fact_id uuid;
  v_inserted boolean;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_client_id is null
     or p_period_start is null
     or p_period_end is null
     or p_availability is null
     or nullif(btrim(p_platform), '') is null
     or nullif(btrim(p_metric_key), '') is null
     or p_period_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
     or p_period_start > p_period_end
     or to_char(p_period_start, 'YYYY-MM') <> p_period_month
     or to_char(p_period_end, 'YYYY-MM') <> p_period_month then
    raise exception 'Invalid monthly fact identity or period' using errcode = '22023';
  end if;

  if p_availability not in (
    'complete', 'valid_zero', 'unavailable', 'permission_blocked',
    'error', 'partial', 'stale'
  )
  or (p_availability in ('complete', 'valid_zero', 'partial', 'stale') and p_value is null)
  or (p_availability in ('unavailable', 'permission_blocked', 'error') and p_value is not null)
  or (p_availability = 'valid_zero' and p_value <> 0) then
    raise exception 'Fact value is inconsistent with availability' using errcode = '22023';
  end if;

  if p_sync_run_id is not null and not exists (
    select 1
    from public.platform_sync_runs sr
    where sr.id = p_sync_run_id
      and sr.client_id = p_client_id
      and sr.platform = btrim(p_platform)
      and sr.period_month = p_period_month
  ) then
    raise exception 'Sync run/fact mismatch' using errcode = '23514';
  end if;

  insert into public.platform_metric_facts_monthly as f
    (client_id, asset_id, platform, period_month, period_start, period_end,
     metric_key, source_metric, value, availability, includes_paid, aggregation,
     comparable_group, api_version, connector_version, source_timezone,
     provenance, sync_run_id, verified_at)
  values
    (p_client_id, p_asset_id, btrim(p_platform), p_period_month,
     p_period_start, p_period_end, btrim(p_metric_key), p_source_metric, p_value,
     p_availability, p_includes_paid, p_aggregation, p_comparable_group,
     p_api_version, p_connector_version, p_source_timezone,
     coalesce(p_provenance, '{}'::jsonb), p_sync_run_id,
     coalesce(p_verified_at, now()))
  on conflict (client_id, platform, period_month, metric_key) do update
  set asset_id = excluded.asset_id,
      period_start = excluded.period_start,
      period_end = excluded.period_end,
      source_metric = excluded.source_metric,
      value = excluded.value,
      availability = excluded.availability,
      includes_paid = excluded.includes_paid,
      aggregation = excluded.aggregation,
      comparable_group = excluded.comparable_group,
      api_version = excluded.api_version,
      connector_version = excluded.connector_version,
      source_timezone = excluded.source_timezone,
      provenance = excluded.provenance,
      sync_run_id = excluded.sync_run_id,
      verified_at = excluded.verified_at
  where not (
    f.availability in ('complete', 'valid_zero')
    and excluded.availability not in ('complete', 'valid_zero')
  )
  returning f.id, (xmax = 0)
  into v_fact_id, v_inserted;

  if v_fact_id is null then
    select f.id into v_fact_id
    from public.platform_metric_facts_monthly f
    where f.client_id = p_client_id
      and f.platform = btrim(p_platform)
      and f.period_month = p_period_month
      and f.metric_key = btrim(p_metric_key);
    v_outcome := 'kept_verified';
  elsif v_inserted then
    v_outcome := 'inserted';
  else
    v_outcome := 'updated';
  end if;

  return v_outcome;
end
$$;

-- 9. Publication gate --------------------------------------------------------
-- Legacy reports with no normalized connector attempt remain publishable as a
-- current-period-only fallback. Once normalized syncing has started, a report
-- cannot transition to published while connector health is unsafe or while no
-- active client-safe fact is ready.
create or replace function public.enforce_report_truth_before_publish()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_month text;
  v_has_truth boolean;
begin
  if new.status <> 'published'
     or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  v_month := to_char(date_trunc('month', new.period_end), 'YYYY-MM');
  select
    exists (
      select 1 from public.platform_sync_runs sr
      where sr.client_id = new.client_id and sr.period_month = v_month
    ) or exists (
      select 1 from public.platform_metric_facts_monthly f
      where f.client_id = new.client_id and f.period_month = v_month
    )
  into v_has_truth;

  if not v_has_truth then
    return new;
  end if;

  if exists (
    select 1
    from (
      select distinct on (sr.platform)
             sr.status, sr.health_state
      from public.platform_sync_runs sr
      where sr.client_id = new.client_id and sr.period_month = v_month
      order by sr.platform, coalesce(sr.finished_at, sr.started_at, sr.created_at) desc
    ) latest
    where latest.status in ('running', 'failed')
       or latest.health_state in ('sync_error', 'permission_blocked', 'reconnection_required', 'metric_migration_required')
  ) then
    raise exception 'Verified platform data requires review before publishing'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.platform_metric_facts_monthly f
    join public.metric_registry mr
      on mr.platform = f.platform and mr.metric_key = f.metric_key
     and mr.client_safe and mr.status = 'active'
    where f.client_id = new.client_id
      and f.period_month = v_month
      and f.availability in ('complete', 'valid_zero')
      and f.value is not null
  ) then
    raise exception 'No verified client-safe platform facts are ready for publishing'
      using errcode = 'P0001';
  end if;

  return new;
end
$$;

drop trigger if exists reports_enforce_reporting_truth on public.reports;
create trigger reports_enforce_reporting_truth
before insert or update of status on public.reports
for each row execute function public.enforce_report_truth_before_publish();

-- 10. Explicit privileges ----------------------------------------------------
revoke all on function public.get_report_metric_facts(uuid)
  from public, anon, authenticated;
revoke all on function public.get_report_metric_fact_status(uuid)
  from public, anon, authenticated;
revoke all on function public.get_report_fact_health(uuid)
  from public, anon, authenticated;
revoke all on function public.get_report_content_exclusions(uuid)
  from public, anon, authenticated;
revoke all on function public.set_report_content_exclusion(uuid, uuid, uuid, text, text, boolean, text)
  from public, anon, authenticated;
revoke all on function public.upsert_platform_metric_fact_preserving_verified(
  uuid, uuid, text, text, date, date, text, text, numeric, text, text, text,
  text, text, text, text, jsonb, uuid, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.get_report_metric_facts(uuid) to authenticated;
grant execute on function public.get_report_metric_fact_status(uuid) to authenticated;
grant execute on function public.get_report_fact_health(uuid) to authenticated;
grant execute on function public.get_report_content_exclusions(uuid) to authenticated;
grant execute on function public.set_report_content_exclusion(uuid, uuid, uuid, text, text, boolean, text)
  to authenticated;
grant execute on function public.upsert_platform_metric_fact_preserving_verified(
  uuid, uuid, text, text, date, date, text, text, numeric, text, text, text,
  text, text, text, text, jsonb, uuid, timestamptz
) to service_role;

-- Authenticated users need table privileges for RLS to apply. With the client
-- policies removed, these grants resolve only for staff; service_role bypasses
-- RLS for connector operations.
grant select on public.platform_metric_facts_monthly to authenticated;
revoke insert, update, delete on public.report_content_exclusions from authenticated;
grant select on public.report_content_exclusions to authenticated;
grant all on public.platform_metric_facts_monthly to service_role;
grant all on public.report_content_exclusions to service_role;

-- ============================================================================
-- End phase-20e
-- ============================================================================
