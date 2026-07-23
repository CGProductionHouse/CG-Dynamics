-- ============================================================================
-- phase-20d-meta-reporting-truth.sql
--
-- Durable, additive, idempotent data model for truthful platform reporting.
--
-- WHY: manual_platform_metrics stores metrics as NOT NULL integers, so the
-- connector is structurally forced to write 0 for genuinely-unavailable data
-- (e.g. Facebook Page views/reach). That collapses "missing" into "valid zero"
-- and lets Instagram-only figures be summed and labelled as all-channel totals.
--
-- This migration introduces a provenance-first model where a metric can be
-- complete, a valid zero, unavailable, permission-blocked, partial, stale or an
-- error — as DISTINCT states — with full source lineage and explicit
-- comparability rules. It does NOT modify or drop any existing table, so it is
-- safe to run alongside the current reporting stack during transition.
--
-- Applies cleanly on re-run: every object uses IF NOT EXISTS / ON CONFLICT.
-- No client IDs, page IDs, IG IDs, asset names or per-client values are encoded.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. metric_registry — canonical metric definitions & compatibility rules
-- ---------------------------------------------------------------------------
create table if not exists public.metric_registry (
  id                       uuid primary key default gen_random_uuid(),
  metric_key               text not null,               -- canonical concept, e.g. 'brand_views'
  platform                 text not null,               -- 'facebook' | 'instagram' | 'google_ads' | 'cross'
  source_metric            text,                        -- provider metric name, e.g. 'page_impressions_unique'
  display_label            text not null,
  definition               text not null,
  aggregation              text not null default 'sum'  -- 'sum' | 'unique' | 'snapshot' | 'reconstructed'
                             check (aggregation in ('sum','unique','snapshot','reconstructed','average')),
  includes_paid            text not null default 'unknown'
                             check (includes_paid in ('organic','paid','both','unknown')),
  client_safe              boolean not null default true,
  cross_platform_additive  boolean not null default false,  -- may this be summed across platforms?
  comparable_group         text not null,               -- only same group may be compared month-on-month
  status                   text not null default 'active'
                             check (status in ('active','deprecated','experimental')),
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (platform, metric_key, source_metric)
);

comment on table public.metric_registry is
  'Canonical metric definitions. cross_platform_additive gates whether a metric may be summed across platforms (unique audiences must NOT be). comparable_group gates month-on-month comparison eligibility.';

-- ---------------------------------------------------------------------------
-- 2. platform_sync_runs — one row per connector execution (all platforms)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_sync_runs (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  asset_id           uuid,
  connection_id      uuid,
  platform           text not null,                     -- 'facebook' | 'instagram' | 'google_ads'
  run_type           text not null default 'manual'
                       check (run_type in ('manual','scheduled','rollback','historical_resync','finalize')),
  period_month       text,                              -- 'YYYY-MM'
  period_start       date,
  period_end         date,
  api_version        text,                              -- Graph/API version used
  connector_version  text,
  source_timezone    text,                              -- platform asset timezone
  business_timezone  text not null default 'Africa/Johannesburg',
  token_class        text check (token_class in ('page','user','system_user','service')),  -- NAME only, never a token value
  requested_bounds   jsonb,                             -- exact since/until sent to the API
  status             text not null default 'success'
                       check (status in ('success','partial','failed','skipped')),
  health_state       text not null default 'verified'
                       check (health_state in ('verified','verified_partial','not_comparable',
                                               'sync_error','permission_blocked','reconnection_required',
                                               'metric_migration_required')),
  summary            jsonb not null default '{}'::jsonb,
  warnings           jsonb not null default '[]'::jsonb, -- token-redacted strings only
  started_at         timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists idx_platform_sync_runs_client_period
  on public.platform_sync_runs (client_id, platform, period_month);
create index if not exists idx_platform_sync_runs_created
  on public.platform_sync_runs (created_at desc);

comment on table public.platform_sync_runs is
  'One operational record per connector execution. A failed run is an integration incident, never a client performance result.';

-- ---------------------------------------------------------------------------
-- 3. platform_metric_snapshots — raw source responses + provenance
-- ---------------------------------------------------------------------------
create table if not exists public.platform_metric_snapshots (
  id               uuid primary key default gen_random_uuid(),
  sync_run_id      uuid references public.platform_sync_runs(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  asset_id         uuid,
  platform         text not null,
  source_endpoint  text,                                -- e.g. '/{page-id}/insights'
  source_metric    text not null,                       -- provider metric requested
  api_version      text,
  token_class      text,
  period_month     text,
  period_start     date,
  period_end       date,
  metric_type      text,                                -- 'total_value' | 'time_series' | 'lifetime' | 'field' | 'reconstructed'
  response_shape   text,                                -- 'total_value' | 'values' | 'field' | 'reconstructed_sum' | 'error'
  value            numeric,                             -- NULL = provider did not return a value (NEVER coerce to 0)
  availability     text not null default 'unavailable'
                     check (availability in ('complete','valid_zero','unavailable','permission_blocked','error','partial','stale')),
  error_code       text,
  error_subcode    text,
  error_message    text,                                -- token-redacted
  trace_id         text,                                -- provider fbtrace_id / request id (safe)
  raw_snapshot     jsonb,                               -- token-stripped source payload reference
  retrieved_at     timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create index if not exists idx_metric_snapshots_lookup
  on public.platform_metric_snapshots (client_id, platform, period_month, source_metric);
create index if not exists idx_metric_snapshots_run
  on public.platform_metric_snapshots (sync_run_id);

comment on table public.platform_metric_snapshots is
  'Source-of-truth provenance for every metric request. value IS NULL means the provider returned nothing — this is distinct from availability=valid_zero.';

-- ---------------------------------------------------------------------------
-- 4. platform_metric_facts_monthly — normalized, reproducible monthly facts
-- ---------------------------------------------------------------------------
create table if not exists public.platform_metric_facts_monthly (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  asset_id           uuid,
  platform           text not null,
  period_month       text not null,                     -- 'YYYY-MM'
  period_start       date not null,
  period_end         date not null,
  metric_key         text not null,                     -- canonical (metric_registry.metric_key)
  source_metric      text,
  value              numeric,                            -- NULL when unavailable; NEVER 0 for missing
  availability       text not null default 'unavailable'
                       check (availability in ('complete','valid_zero','unavailable','permission_blocked','error','partial','stale')),
  includes_paid      text not null default 'unknown'
                       check (includes_paid in ('organic','paid','both','unknown')),
  aggregation        text,
  comparable_group   text,                              -- copied from registry at write time
  api_version        text,
  connector_version  text,
  source_timezone    text,
  provenance         jsonb not null default '{}'::jsonb, -- { endpoint, token_class, response_shape, snapshot_id, sync_run_id, retrieved_at }
  sync_run_id        uuid references public.platform_sync_runs(id) on delete set null,
  verified_at        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (client_id, platform, period_month, metric_key)
);

create index if not exists idx_metric_facts_client_month
  on public.platform_metric_facts_monthly (client_id, period_month);
create index if not exists idx_metric_facts_metric
  on public.platform_metric_facts_monthly (client_id, platform, metric_key, period_month);

comment on table public.platform_metric_facts_monthly is
  'Canonical client-safe monthly facts. One row per (client, platform, month, canonical metric). Re-sync upserts in place; a failed re-sync must never overwrite a verified value with an unavailable one (enforced in the connector).';

-- ---------------------------------------------------------------------------
-- 5. platform_metric_facts_daily — optional daily grain (same semantics)
-- ---------------------------------------------------------------------------
create table if not exists public.platform_metric_facts_daily (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  asset_id           uuid,
  platform           text not null,
  fact_date          date not null,
  metric_key         text not null,
  source_metric      text,
  value              numeric,
  availability       text not null default 'unavailable'
                       check (availability in ('complete','valid_zero','unavailable','permission_blocked','error','partial','stale')),
  api_version        text,
  connector_version  text,
  provenance         jsonb not null default '{}'::jsonb,
  sync_run_id        uuid references public.platform_sync_runs(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (client_id, platform, fact_date, metric_key)
);

create index if not exists idx_metric_facts_daily_lookup
  on public.platform_metric_facts_daily (client_id, platform, metric_key, fact_date);

-- ---------------------------------------------------------------------------
-- 6. updated_at touch triggers (idempotent)
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_metric_registry_touch on public.metric_registry;
create trigger trg_metric_registry_touch before update on public.metric_registry
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_metric_facts_monthly_touch on public.platform_metric_facts_monthly;
create trigger trg_metric_facts_monthly_touch before update on public.platform_metric_facts_monthly
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row Level Security — internal reporting facts
--    Service-role writes (bypasses RLS). Staff read. No client-user access here;
--    client-facing consumption goes through client-safe application queries.
-- ---------------------------------------------------------------------------
alter table public.metric_registry              enable row level security;
alter table public.platform_sync_runs           enable row level security;
alter table public.platform_metric_snapshots    enable row level security;
alter table public.platform_metric_facts_monthly enable row level security;
alter table public.platform_metric_facts_daily  enable row level security;

do $$
begin
  -- metric_registry: all staff may read; admins may manage.
  drop policy if exists "metric_registry: staff read" on public.metric_registry;
  create policy "metric_registry: staff read" on public.metric_registry
    for select using (public.is_staff());
  drop policy if exists "metric_registry: admin manage" on public.metric_registry;
  create policy "metric_registry: admin manage" on public.metric_registry
    for all using (public.is_admin()) with check (public.is_admin());

  drop policy if exists "platform_sync_runs: staff read" on public.platform_sync_runs;
  create policy "platform_sync_runs: staff read" on public.platform_sync_runs
    for select using (public.is_staff());

  drop policy if exists "platform_metric_snapshots: staff read" on public.platform_metric_snapshots;
  create policy "platform_metric_snapshots: staff read" on public.platform_metric_snapshots
    for select using (public.is_staff());

  drop policy if exists "platform_metric_facts_monthly: staff read" on public.platform_metric_facts_monthly;
  create policy "platform_metric_facts_monthly: staff read" on public.platform_metric_facts_monthly
    for select using (public.is_staff());

  drop policy if exists "platform_metric_facts_daily: staff read" on public.platform_metric_facts_daily;
  create policy "platform_metric_facts_daily: staff read" on public.platform_metric_facts_daily
    for select using (public.is_staff());
end $$;

-- ---------------------------------------------------------------------------
-- 8. Seed the canonical metric registry (idempotent)
--    Facebook: Business-Suite-aligned concepts. Instagram: professional account
--    metrics. Google Ads: paid demand. comparable_group keeps definitions that
--    changed over time from being compared as if identical.
-- ---------------------------------------------------------------------------
insert into public.metric_registry
  (metric_key, platform, source_metric, display_label, definition, aggregation, includes_paid, client_safe, cross_platform_additive, comparable_group)
values
  -- Facebook — brand visibility
  ('brand_views','facebook','page_impressions','Facebook views','Times the Page''s content entered a screen (Business Suite "Views").','sum','both',true,false,'fb_views_v1'),
  ('unique_viewers','facebook','page_impressions_unique','Facebook viewers','Unique accounts that saw the Page''s content (Business Suite "Viewers"). Unique audience — not summable across platforms.','unique','both',true,false,'fb_viewers_v1'),
  ('reach','facebook','page_impressions_unique','Facebook reach','Unique accounts reached. Unique audience — not summable across platforms.','unique','both',true,false,'fb_reach_v1'),
  -- Facebook — audience response
  ('content_interactions','facebook','page_post_engagements','Facebook content interactions','Reactions, comments, shares and clicks on Page content.','sum','both',true,false,'fb_interactions_v1'),
  ('follows_gained','facebook','page_daily_follows_unique','Facebook follows gained','New follows during the period. A period metric, not a snapshot.','sum','organic',true,false,'fb_follows_gained_v1'),
  ('current_followers','facebook','followers_count','Facebook followers','Point-in-time follower count. A snapshot — never shown as period growth.','snapshot','organic',true,false,'fb_followers_snapshot_v1'),
  ('page_visits','facebook','page_views_total','Facebook Page visits','Times the Page profile was visited.','sum','both',true,false,'fb_page_visits_v1'),
  -- Instagram — brand visibility
  ('brand_views','instagram','views','Instagram views','Times Instagram content was played or displayed.','sum','both',true,false,'ig_views_v1'),
  ('reach','instagram','reach','Instagram reach','Unique accounts that saw the content. Unique audience — not summable across platforms.','unique','both',true,false,'ig_reach_v1'),
  -- Instagram — audience response
  ('content_interactions','instagram','total_interactions','Instagram interactions','Likes, comments, saves and shares on Instagram content.','sum','both',true,false,'ig_interactions_v1'),
  ('profile_visits','instagram','profile_views','Instagram profile visits','Times the profile was visited.','sum','both',true,false,'ig_profile_visits_v1'),
  ('website_clicks','instagram','website_clicks','Instagram website clicks','Taps on the website link in the profile.','sum','both',true,false,'ig_website_clicks_v1'),
  ('follows_gained','instagram','follows_and_unfollows','Instagram follows gained','Net/period follows. A period metric, not a snapshot.','sum','organic',true,false,'ig_follows_gained_v1'),
  ('current_followers','instagram','followers_count','Instagram followers','Point-in-time follower count. A snapshot — never shown as period growth.','snapshot','organic',true,false,'ig_followers_snapshot_v1'),
  -- Google Ads — paid demand (kept explicitly separate from organic visibility)
  ('ads_impressions','google_ads','impressions','Ad impressions','Times ads were shown. Paid demand — never merged into organic visibility.','sum','paid',true,false,'gads_impressions_v1'),
  ('ads_clicks','google_ads','clicks','Ad clicks','Clicks on ads.','sum','paid',true,false,'gads_clicks_v1'),
  ('ads_spend','google_ads','cost','Ad spend','Amount spent on ads in the period.','sum','paid',true,false,'gads_spend_v1'),
  ('ads_conversions','google_ads','conversions','Ad conversions','Conversions attributed to ads.','sum','paid',true,false,'gads_conversions_v1')
on conflict (platform, metric_key, source_metric) do nothing;

-- ============================================================================
-- End phase-20d
-- ============================================================================
