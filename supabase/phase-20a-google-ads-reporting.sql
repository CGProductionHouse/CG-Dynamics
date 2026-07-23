-- Phase 20a - Google Ads reporting foundation
-- Review in the Supabase SQL editor before applying.
-- Stores account-to-client links, daily campaign metrics, and sync diagnostics.
-- Credentials and OAuth tokens must remain in Edge Function secrets, never here.

-- 1. ACCOUNT LINKS
-- Links one active Google Ads customer account to one active client at a time.
-- Deactivate links with is_active = false; application roles cannot hard-delete them.

create table if not exists public.google_ads_account_links (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete restrict,
  customer_id    text not null check (customer_id ~ '^[0-9]+$'),
  customer_name  text not null,
  currency_code  text,
  time_zone      text,
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.google_ads_account_links is
  'Internal Google Ads customer-to-client setup metadata. Contains no credentials or tokens; inactive links are retained for history.';
comment on column public.google_ads_account_links.customer_id is
  'Google Ads customer ID in canonical digits-only form, without hyphens.';

create unique index if not exists google_ads_account_links_one_active_per_client_idx
  on public.google_ads_account_links (client_id)
  where is_active;

create unique index if not exists google_ads_account_links_one_active_per_customer_idx
  on public.google_ads_account_links (customer_id)
  where is_active;

create unique index if not exists google_ads_account_links_client_customer_idx
  on public.google_ads_account_links (client_id, customer_id);

create index if not exists google_ads_account_links_client_idx
  on public.google_ads_account_links (client_id);

create index if not exists google_ads_account_links_customer_idx
  on public.google_ads_account_links (customer_id);


-- 2. DAILY CAMPAIGN METRICS
-- One row per linked account, campaign, and reporting date. Edge Functions use
-- the unique index as the idempotent upsert key.

create table if not exists public.google_ads_campaign_daily_metrics (
  id                uuid primary key default gen_random_uuid(),
  account_link_id   uuid not null references public.google_ads_account_links(id) on delete restrict,
  client_id         uuid not null references public.clients(id) on delete restrict,
  customer_id       text not null check (customer_id ~ '^[0-9]+$'),
  campaign_id       text not null,
  campaign_name     text not null,
  campaign_status   text,
  metric_date       date not null,
  impressions       bigint not null default 0 check (impressions >= 0),
  clicks            bigint not null default 0 check (clicks >= 0),
  cost_micros       bigint not null default 0 check (cost_micros >= 0),
  conversions       numeric not null default 0 check (conversions >= 0),
  conversion_value  numeric not null default 0 check (conversion_value >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.google_ads_campaign_daily_metrics is
  'Internal daily Google Ads campaign facts written by service-role Edge Functions and readable by managers.';
comment on column public.google_ads_campaign_daily_metrics.cost_micros is
  'Advertising cost in the Google Ads API micros unit; currency comes from the linked account metadata.';

create unique index if not exists google_ads_campaign_daily_metrics_upsert_idx
  on public.google_ads_campaign_daily_metrics (account_link_id, campaign_id, metric_date);

create index if not exists google_ads_campaign_daily_metrics_client_date_idx
  on public.google_ads_campaign_daily_metrics (client_id, metric_date desc);

create index if not exists google_ads_campaign_daily_metrics_customer_date_idx
  on public.google_ads_campaign_daily_metrics (customer_id, metric_date desc);

create index if not exists google_ads_campaign_daily_metrics_campaign_date_idx
  on public.google_ads_campaign_daily_metrics (campaign_id, metric_date desc);


-- 3. SYNC RUNS
-- Operational diagnostics only. Edge Functions create and update these rows;
-- managers may inspect them, while clients and general staff cannot.

create table if not exists public.google_ads_sync_runs (
  id               uuid primary key default gen_random_uuid(),
  account_link_id  uuid not null references public.google_ads_account_links(id) on delete restrict,
  client_id        uuid not null references public.clients(id) on delete restrict,
  customer_id      text not null check (customer_id ~ '^[0-9]+$'),
  period_start     date not null,
  period_end       date not null,
  status           text not null default 'queued'
                     check (status in ('queued', 'running', 'succeeded', 'failed')),
  rows_upserted    integer not null default 0 check (rows_upserted >= 0),
  error_message    text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (period_end >= period_start)
);

comment on table public.google_ads_sync_runs is
  'Internal Google Ads sync diagnostics. Written by service-role Edge Functions; never exposed to client users.';

create index if not exists google_ads_sync_runs_account_created_idx
  on public.google_ads_sync_runs (account_link_id, created_at desc);

create index if not exists google_ads_sync_runs_client_created_idx
  on public.google_ads_sync_runs (client_id, created_at desc);

create index if not exists google_ads_sync_runs_status_created_idx
  on public.google_ads_sync_runs (status, created_at);


-- 4. UPDATED_AT TRIGGERS

create or replace function public.set_google_ads_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists google_ads_account_links_set_updated_at
  on public.google_ads_account_links;
create trigger google_ads_account_links_set_updated_at
  before update on public.google_ads_account_links
  for each row execute function public.set_google_ads_updated_at();

drop trigger if exists google_ads_campaign_daily_metrics_set_updated_at
  on public.google_ads_campaign_daily_metrics;
create trigger google_ads_campaign_daily_metrics_set_updated_at
  before update on public.google_ads_campaign_daily_metrics
  for each row execute function public.set_google_ads_updated_at();

drop trigger if exists google_ads_sync_runs_set_updated_at
  on public.google_ads_sync_runs;
create trigger google_ads_sync_runs_set_updated_at
  before update on public.google_ads_sync_runs
  for each row execute function public.set_google_ads_updated_at();


-- 5. ATOMIC METRIC REPLACEMENT
-- A complete provider response replaces the requested account/date snapshot in
-- one transaction. Only service-role Edge Functions may execute this function.

create or replace function public.replace_google_ads_campaign_metrics(
  p_account_link_id uuid,
  p_client_id uuid,
  p_customer_id text,
  p_period_start date,
  p_period_end date,
  p_metrics jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if p_period_end < p_period_start or p_customer_id !~ '^[0-9]+$' then
    raise exception 'Invalid Google Ads metric replacement parameters';
  end if;

  if not exists (
    select 1
    from public.google_ads_account_links
    where id = p_account_link_id
      and client_id = p_client_id
      and customer_id = p_customer_id
      and is_active
  ) then
    raise exception 'Active Google Ads account link not found';
  end if;

  delete from public.google_ads_campaign_daily_metrics
  where account_link_id = p_account_link_id
    and metric_date between p_period_start and p_period_end;

  insert into public.google_ads_campaign_daily_metrics (
    account_link_id,
    client_id,
    customer_id,
    campaign_id,
    campaign_name,
    campaign_status,
    metric_date,
    impressions,
    clicks,
    cost_micros,
    conversions,
    conversion_value
  )
  select
    p_account_link_id,
    p_client_id,
    p_customer_id,
    metric.campaign_id,
    metric.campaign_name,
    metric.campaign_status,
    metric.metric_date,
    metric.impressions,
    metric.clicks,
    metric.cost_micros,
    metric.conversions,
    metric.conversion_value
  from jsonb_to_recordset(coalesce(p_metrics, '[]'::jsonb)) as metric(
    campaign_id text,
    campaign_name text,
    campaign_status text,
    metric_date date,
    impressions bigint,
    clicks bigint,
    cost_micros bigint,
    conversions numeric,
    conversion_value numeric
  )
  where metric.metric_date between p_period_start and p_period_end;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.replace_google_ads_campaign_metrics(uuid, uuid, text, date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.replace_google_ads_campaign_metrics(uuid, uuid, text, date, date, jsonb)
  to service_role;


-- 6. ROW-LEVEL SECURITY
-- No DELETE policies are defined. Account links are deactivated, not deleted.
-- Service-role Edge Functions bypass RLS to write metrics and sync runs.

alter table public.google_ads_account_links enable row level security;
alter table public.google_ads_campaign_daily_metrics enable row level security;
alter table public.google_ads_sync_runs enable row level security;

drop policy if exists "google_ads_account_links: manager select"
  on public.google_ads_account_links;
create policy "google_ads_account_links: manager select"
  on public.google_ads_account_links for select
  using (public.is_manager());

drop policy if exists "google_ads_account_links: manager insert" on public.google_ads_account_links;
drop policy if exists "google_ads_account_links: manager update" on public.google_ads_account_links;

revoke insert, update, delete on public.google_ads_account_links from anon, authenticated;
revoke insert, update, delete on public.google_ads_campaign_daily_metrics from anon, authenticated;
revoke insert, update, delete on public.google_ads_sync_runs from anon, authenticated;

drop policy if exists "google_ads_campaign_daily_metrics: staff select"
  on public.google_ads_campaign_daily_metrics;
drop policy if exists "google_ads_campaign_daily_metrics: manager select"
  on public.google_ads_campaign_daily_metrics;
create policy "google_ads_campaign_daily_metrics: manager select"
  on public.google_ads_campaign_daily_metrics for select
  using (public.is_manager());

drop policy if exists "google_ads_sync_runs: manager select"
  on public.google_ads_sync_runs;
create policy "google_ads_sync_runs: manager select"
  on public.google_ads_sync_runs for select
  using (public.is_manager());
