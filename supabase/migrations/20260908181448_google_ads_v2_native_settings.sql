-- Google Ads V2 provider-native persistence and client-safe reporting.
-- Reviewed rollout required; do not apply automatically.
begin;

alter table public.google_ads_campaign_daily_metrics
  add column if not exists interactions bigint,
  add column if not exists native_settings jsonb;

comment on column public.google_ads_campaign_daily_metrics.interactions is
  'Google Ads metrics.interactions for provider-native conversion-rate semantics; null on legacy rows.';
comment on column public.google_ads_campaign_daily_metrics.native_settings is
  'Google Ads settings observed at sync time; never historical budget evidence. Existing rows remain null.';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'google_ads_campaign_daily_metrics_interactions_check'
      and conrelid = 'public.google_ads_campaign_daily_metrics'::pg_catalog.regclass
  ) then
    alter table public.google_ads_campaign_daily_metrics
      add constraint google_ads_campaign_daily_metrics_interactions_check
      check (interactions is null or interactions >= 0);
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'google_ads_campaign_daily_metrics_native_settings_check'
      and conrelid = 'public.google_ads_campaign_daily_metrics'::pg_catalog.regclass
  ) then
    alter table public.google_ads_campaign_daily_metrics
      add constraint google_ads_campaign_daily_metrics_native_settings_check
      check (native_settings is null or pg_catalog.jsonb_typeof(native_settings) = 'object');
  end if;
end;
$$;

create table if not exists public.google_ads_monthly_targets (
  id bigint generated always as identity primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  month date not null,
  amount_micros bigint not null check (amount_micros > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  approval_note text not null check (btrim(approval_note) <> '' and char_length(approval_note) <= 500),
  approved_at timestamptz not null,
  approved_by uuid references public.profiles(id) on delete set null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_ads_monthly_targets_month_check
    check (month = pg_catalog.date_trunc('month', month)::date),
  constraint google_ads_monthly_targets_client_month_key unique (client_id, month)
);

comment on table public.google_ads_monthly_targets is
  'Client-approved CG monthly spend targets. Never Google Ads provider budgets and never authority to mutate Google Ads.';

alter table public.google_ads_monthly_targets enable row level security;
alter table public.google_ads_monthly_targets force row level security;
revoke all on table public.google_ads_monthly_targets from public, anon, authenticated;
grant all on table public.google_ads_monthly_targets to service_role;

create index if not exists google_ads_monthly_targets_month_client_idx
  on public.google_ads_monthly_targets (month desc, client_id);

create or replace function public.set_google_ads_monthly_target(
  p_client_id uuid,
  p_month date,
  p_amount_micros bigint,
  p_currency_code text,
  p_approval_note text,
  p_approved_at timestamptz,
  p_expected_version integer default null
)
returns table (target_id bigint, target_version integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  saved public.google_ads_monthly_targets%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = actor_id and p.is_active and p.role in ('admin', 'manager')
  ) then
    raise exception 'Google Ads target access denied' using errcode = '42501';
  end if;
  if p_client_id is null or not exists (select 1 from public.clients c where c.id = p_client_id and c.active) then
    raise exception 'An active client is required' using errcode = '22023';
  end if;
  if p_month is null or p_month <> pg_catalog.date_trunc('month', p_month)::date then
    raise exception 'Target month must be the first day of a month' using errcode = '22023';
  end if;
  if p_amount_micros is null or p_amount_micros <= 0 then
    raise exception 'Target amount must be positive' using errcode = '22023';
  end if;
  if p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Target currency must be a three-letter code' using errcode = '22023';
  end if;
  if p_approval_note is null or btrim(p_approval_note) = '' or char_length(p_approval_note) > 500 or p_approved_at is null then
    raise exception 'Approval evidence and date are required' using errcode = '22023';
  end if;

  insert into public.google_ads_monthly_targets (
    client_id, month, amount_micros, currency_code, approval_note,
    approved_at, approved_by, updated_at
  ) values (
    p_client_id, p_month, p_amount_micros, upper(p_currency_code), btrim(p_approval_note),
    p_approved_at, actor_id, now()
  )
  on conflict (client_id, month) do update set
    amount_micros = excluded.amount_micros,
    currency_code = excluded.currency_code,
    approval_note = excluded.approval_note,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    version = public.google_ads_monthly_targets.version + 1,
    updated_at = now()
  where p_expected_version is null
    or public.google_ads_monthly_targets.version = p_expected_version
  returning * into saved;

  if saved.id is null then
    raise exception 'Google Ads target changed; reload before saving' using errcode = '40001';
  end if;
  return query select saved.id, saved.version;
end;
$$;

revoke all on function public.set_google_ads_monthly_target(uuid, date, bigint, text, text, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.set_google_ads_monthly_target(uuid, date, bigint, text, text, timestamptz, integer)
  to authenticated;

create or replace function public.list_google_ads_monthly_targets()
returns table (
  client_id uuid,
  month date,
  amount_micros bigint,
  currency_code text,
  approval_note text,
  approved_at timestamptz,
  version integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role in ('admin', 'manager')
  ) then
    raise exception 'Google Ads target access denied' using errcode = '42501';
  end if;
  return query
  select t.client_id, t.month, t.amount_micros, t.currency_code,
    t.approval_note, t.approved_at, t.version
  from public.google_ads_monthly_targets t
  order by t.month desc, t.client_id;
end;
$$;

revoke all on function public.list_google_ads_monthly_targets()
  from public, anon, authenticated;
grant execute on function public.list_google_ads_monthly_targets()
  to authenticated;

create or replace function public.replace_google_ads_account_campaign_metrics(
  p_google_ads_account_id uuid,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.google_ads_accounts%rowtype;
  inserted_count integer;
begin
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads metric replacement range';
  end if;

  if pg_catalog.jsonb_typeof(coalesce(p_metrics, '[]'::pg_catalog.jsonb)) <> 'array' then
    raise exception 'Metrics must be a JSON array';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_google_ads_account_id::text, 0));

  select * into account_row
  from public.google_ads_accounts
  where id = p_google_ads_account_id and is_active
  for update;

  if not found then
    raise exception 'Active Google Ads account not found';
  end if;

  delete from public.google_ads_campaign_daily_metrics
  where google_ads_account_id = p_google_ads_account_id
    and metric_date between p_period_start and p_period_end;

  insert into public.google_ads_campaign_daily_metrics (
    google_ads_account_id, account_link_id, client_id, customer_id,
    campaign_id, campaign_name, campaign_status, campaign_type, metric_date,
    impressions, clicks, interactions, cost_micros, conversions,
    conversion_value, native_settings
  )
  select
    account_row.id, null, null, account_row.customer_id,
    metric.campaign_id, metric.campaign_name, metric.campaign_status,
    metric.campaign_type, metric.metric_date, metric.impressions,
    metric.clicks, metric.interactions, metric.cost_micros,
    metric.conversions, metric.conversion_value, metric.native_settings
  from pg_catalog.jsonb_to_recordset(coalesce(p_metrics, '[]'::pg_catalog.jsonb)) as metric(
    campaign_id text,
    campaign_name text,
    campaign_status text,
    campaign_type text,
    metric_date date,
    impressions bigint,
    clicks bigint,
    interactions bigint,
    cost_micros bigint,
    conversions numeric,
    conversion_value numeric,
    native_settings jsonb
  )
  where metric.metric_date between p_period_start and p_period_end
    and metric.campaign_id is not null
    and metric.campaign_name is not null
    and metric.impressions is not null
    and metric.clicks is not null
    and metric.cost_micros is not null
    and metric.conversions is not null
    and metric.conversion_value is not null;

  get diagnostics inserted_count = row_count;
  if inserted_count <> pg_catalog.jsonb_array_length(coalesce(p_metrics, '[]'::pg_catalog.jsonb)) then
    raise exception 'Every metric row must be complete and fall within the replacement range';
  end if;

  return inserted_count;
end;
$$;

revoke all on function public.replace_google_ads_account_campaign_metrics(uuid, date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_google_ads_account_campaign_metrics(uuid, date, date, jsonb)
  to service_role;

create or replace function public.get_google_ads_dashboard_campaign_metrics_v2(
  p_report_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  campaign_name text,
  campaign_status text,
  campaign_type text,
  impressions bigint,
  clicks bigint,
  interactions bigint,
  cost numeric,
  conversions numeric,
  value numeric,
  currency text,
  time_zone text,
  native_settings jsonb,
  first_activity date,
  last_activity date,
  data_through_date date,
  monthly_target_micros bigint,
  target_currency text,
  current_7d jsonb,
  previous_7d jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_client_id uuid;
begin
  select r.client_id
    into report_client_id
  from public.reports r
  where r.id = p_report_id
    and exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.is_active
    )
    and r.status in ('draft', 'published')
    and (
      coalesce(public.is_staff(), false)
      or (
        r.status = 'published'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active
            and p.client_id = r.client_id
            and p.role = 'client'
        )
      )
    );

  if report_client_id is null then
    raise exception 'Report access denied' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads report period' using errcode = '22023';
  end if;

  if p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date
    or p_period_end <> (p_period_start + interval '1 month - 1 day')::date then
    raise exception 'Google Ads period must be one complete calendar month' using errcode = '22023';
  end if;

  return query
  with resolved as (
    select m.*, a.currency_code, a.time_zone
    from public.google_ads_campaign_daily_metrics m
    join public.google_ads_accounts a
      on a.id = m.google_ads_account_id and a.is_active
    where m.metric_date between (p_period_start - 13) and p_period_end
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1 from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1 from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.customer_id = m.customer_id
              and cl.campaign_id = m.campaign_id
              and cl.client_id = report_client_id
              and cl.is_active
          )
        )
      )
  ),
  period_rows as (
    select * from resolved
    where metric_date between p_period_start and p_period_end
  ),
  latest_settings as (
    select distinct on (r.google_ads_account_id, r.campaign_id)
      r.google_ads_account_id, r.campaign_id, r.native_settings
    from period_rows r
    where r.native_settings is not null
    order by r.google_ads_account_id, r.campaign_id,
      r.native_settings ->> 'observed_at' desc nulls last,
      r.metric_date desc
  ),
  data_bounds as (
    select pg_catalog.max(r.metric_date) as data_through_date
    from period_rows r
  ),
  trend_coverage as (
    select db.data_through_date is not null and not exists (
      select 1
      from (select distinct r.google_ads_account_id from period_rows r) accounts
      where not exists (
        select 1 from public.google_ads_sync_runs sr
        where sr.google_ads_account_id = accounts.google_ads_account_id
          and sr.status = 'succeeded'
          and sr.period_start <= db.data_through_date - 13
          and sr.period_end >= db.data_through_date
      )
    ) as ready
    from data_bounds db
  ),
  trend_windows as (
    select
      case when tc.ready then pg_catalog.jsonb_build_object(
        'start_date', db.data_through_date - 6,
        'end_date', db.data_through_date,
        'spend_micros', coalesce(pg_catalog.sum(r.cost_micros) filter (where r.metric_date between db.data_through_date - 6 and db.data_through_date), 0),
        'impressions', coalesce(pg_catalog.sum(r.impressions) filter (where r.metric_date between db.data_through_date - 6 and db.data_through_date), 0),
        'clicks', coalesce(pg_catalog.sum(r.clicks) filter (where r.metric_date between db.data_through_date - 6 and db.data_through_date), 0),
        'conversions', coalesce(pg_catalog.sum(r.conversions) filter (where r.metric_date between db.data_through_date - 6 and db.data_through_date), 0)
      ) else null end as current_7d,
      case when tc.ready then pg_catalog.jsonb_build_object(
        'start_date', db.data_through_date - 13,
        'end_date', db.data_through_date - 7,
        'spend_micros', coalesce(pg_catalog.sum(r.cost_micros) filter (where r.metric_date between db.data_through_date - 13 and db.data_through_date - 7), 0),
        'impressions', coalesce(pg_catalog.sum(r.impressions) filter (where r.metric_date between db.data_through_date - 13 and db.data_through_date - 7), 0),
        'clicks', coalesce(pg_catalog.sum(r.clicks) filter (where r.metric_date between db.data_through_date - 13 and db.data_through_date - 7), 0),
        'conversions', coalesce(pg_catalog.sum(r.conversions) filter (where r.metric_date between db.data_through_date - 13 and db.data_through_date - 7), 0)
      ) else null end as previous_7d
    from data_bounds db
    cross join trend_coverage tc
    left join resolved r on true
    group by db.data_through_date, tc.ready
  ),
  target as (
    select t.amount_micros, t.currency_code
    from public.google_ads_monthly_targets t
    where t.client_id = report_client_id
      and t.month = p_period_start
  )
  select
    r.campaign_name,
    (pg_catalog.array_agg(r.campaign_status order by r.metric_date desc))[1],
    (pg_catalog.array_agg(r.campaign_type order by r.metric_date desc))[1],
    pg_catalog.sum(r.impressions)::bigint,
    pg_catalog.sum(r.clicks)::bigint,
    case when pg_catalog.count(r.interactions) = pg_catalog.count(*)
      then pg_catalog.sum(r.interactions)::bigint else null end,
    pg_catalog.sum(r.cost_micros)::numeric / 1000000::numeric,
    pg_catalog.sum(r.conversions),
    pg_catalog.sum(r.conversion_value),
    r.currency_code,
    r.time_zone,
    case when ls.native_settings is null then null else
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'api_version', ls.native_settings -> 'api_version',
        'observed_at', ls.native_settings -> 'observed_at',
        'primary_status', ls.native_settings -> 'primary_status',
        'primary_status_reasons', ls.native_settings -> 'primary_status_reasons',
        'start_date', ls.native_settings -> 'start_date',
        'end_date', ls.native_settings -> 'end_date',
        'bidding_strategy_type', ls.native_settings -> 'bidding_strategy_type',
        'budget_amount_micros', ls.native_settings -> 'budget_amount_micros',
        'budget_total_amount_micros', ls.native_settings -> 'budget_total_amount_micros',
        'budget_period', ls.native_settings -> 'budget_period',
        'budget_shared', ls.native_settings -> 'budget_shared',
        'budget_reference_count', ls.native_settings -> 'budget_reference_count',
        'budget_delivery_method', ls.native_settings -> 'budget_delivery_method',
        'budget_status', ls.native_settings -> 'budget_status',
        'budget_type', ls.native_settings -> 'budget_type'
      ))
    end,
    pg_catalog.min(r.metric_date) filter (
      where r.impressions > 0 or r.clicks > 0 or coalesce(r.interactions, 0) > 0
        or r.cost_micros > 0 or r.conversions <> 0
    ),
    pg_catalog.max(r.metric_date) filter (
      where r.impressions > 0 or r.clicks > 0 or coalesce(r.interactions, 0) > 0
        or r.cost_micros > 0 or r.conversions <> 0
    ),
    db.data_through_date,
    t.amount_micros,
    t.currency_code,
    tw.current_7d,
    tw.previous_7d
  from period_rows r
  left join latest_settings ls
    on ls.google_ads_account_id = r.google_ads_account_id
   and ls.campaign_id = r.campaign_id
  cross join data_bounds db
  cross join trend_windows tw
  left join target t on true
  group by r.google_ads_account_id, r.campaign_id, r.campaign_name,
    r.currency_code, r.time_zone, ls.native_settings, db.data_through_date,
    t.amount_micros, t.currency_code, tw.current_7d, tw.previous_7d
  order by r.campaign_name;
end;
$$;

revoke all on function public.get_google_ads_dashboard_campaign_metrics_v2(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_google_ads_dashboard_campaign_metrics_v2(uuid, date, date)
  to authenticated;

create or replace function public.get_google_ads_dashboard_status_v2(
  p_report_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  connected boolean,
  has_mapping boolean,
  has_successful_sync boolean,
  metric_row_count bigint,
  last_successful_sync timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_client_id uuid;
begin
  select r.client_id
    into report_client_id
  from public.reports r
  where r.id = p_report_id
    and exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid() and actor.is_active
    )
    and r.status in ('draft', 'published')
    and (
      coalesce(public.is_staff(), false)
      or (
        r.status = 'published'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.is_active
            and p.client_id = r.client_id
            and p.role = 'client'
        )
      )
    );

  if report_client_id is null then
    raise exception 'Report access denied' using errcode = '42501';
  end if;
  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads report period' using errcode = '22023';
  end if;

  if p_period_start <> pg_catalog.date_trunc('month', p_period_start)::date
    or p_period_end <> (p_period_start + interval '1 month - 1 day')::date then
    raise exception 'Google Ads period must be one complete calendar month' using errcode = '22023';
  end if;

  return query
  with mapped_accounts as (
    select a.id
    from public.google_ads_accounts a
    where a.is_active
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1 from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1 from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.client_id = report_client_id and cl.is_active
          )
        )
      )
  ),
  resolved_metrics as (
    select m.id
    from public.google_ads_campaign_daily_metrics m
    join public.google_ads_accounts a
      on a.id = m.google_ads_account_id and a.is_active
    where m.metric_date between p_period_start and p_period_end
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1 from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1 from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.customer_id = m.customer_id
              and cl.campaign_id = m.campaign_id
              and cl.client_id = report_client_id and cl.is_active
          )
        )
      )
  ),
  successful_syncs as (
    select sr.finished_at
    from public.google_ads_sync_runs sr
    join mapped_accounts ma on ma.id = sr.google_ads_account_id
    where sr.status = 'succeeded'
      and sr.period_start <= p_period_end
      and sr.period_end >= p_period_start
  )
  select
    exists (select 1 from public.google_ads_accounts a where a.is_active),
    exists (select 1 from mapped_accounts),
    exists (select 1 from successful_syncs),
    (select pg_catalog.count(*) from resolved_metrics),
    (select pg_catalog.max(s.finished_at) from successful_syncs s);
end;
$$;

revoke all on function public.get_google_ads_dashboard_status_v2(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_google_ads_dashboard_status_v2(uuid, date, date)
  to authenticated;

commit;
