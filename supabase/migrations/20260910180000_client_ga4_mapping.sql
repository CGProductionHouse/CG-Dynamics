-- Exact-client GA4 / website mapping for #335. PREPARED ONLY — DO NOT APPLY WITHOUT CA APPROVAL.
--
-- Completes the mapping chain the issue requires:
--   Dynamics client_id → Google Ads customer/campaign (already exists in google_ads_*_links)
--                      → GA4 property / web stream      (client_ga4_properties, below)
--                      → approved website domain(s)     (client_website_domains, below)
--
-- ISOLATION MODEL — matches the existing Google Ads tables exactly.
-- Base tables are manager/admin readable only via is_manager(). Client-facing access happens
-- through report-scoped SECURITY DEFINER RPCs, never by reading these tables directly. That is
-- how the current Google Ads path prevents cross-client leakage and this follows it rather than
-- inventing a second access model.
--
-- NO FUZZY MATCHING. The constraints below make sibling-client fallback structurally impossible:
--   * at most ONE active GA4 property per client;
--   * a GA4 property may not be active for two different clients;
--   * a website domain may not be active for two different clients.
-- Those are enforced by unique indexes, not by application code that could be bypassed.
--
-- Additive only. Creates new tables; touches no existing table, column, policy or row.

begin;

-- ── GA4 property mapping ────────────────────────────────────────────────────
create table if not exists public.client_ga4_properties (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- GA4 numeric property id as used by the Data API ("properties/<id>").
  property_id text not null check (property_id ~ '^[0-9]{6,20}$'),
  property_display_name text,
  -- Web stream measurement id, e.g. G-XXXXXXXXXX. Optional: reporting works from property_id.
  measurement_id text check (measurement_id is null or measurement_id ~ '^G-[A-Z0-9]{4,20}$'),
  stream_id text check (stream_id is null or stream_id ~ '^[0-9]{6,20}$'),
  -- Property reporting timezone/currency, needed to explain Ads↔GA4 period differences truthfully.
  time_zone text,
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active GA4 property per client: no ambiguity about which property a report reads.
create unique index if not exists client_ga4_properties_one_active_per_client
  on public.client_ga4_properties (client_id) where is_active;

-- A property may not be active for two clients: makes cross-client leakage structurally impossible.
create unique index if not exists client_ga4_properties_property_single_client
  on public.client_ga4_properties (property_id) where is_active;

alter table public.client_ga4_properties enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_ga4_properties'
      and policyname = 'client_ga4_properties: manager select'
  ) then
    create policy "client_ga4_properties: manager select"
      on public.client_ga4_properties for select using (public.is_manager());
  end if;
end $$;

-- ── Approved website domains ────────────────────────────────────────────────
create table if not exists public.client_website_domains (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- Stored normalised: lowercase host only, no scheme, no path, no trailing dot.
  domain text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_website_domains_unique_per_client
  on public.client_website_domains (client_id, domain);

-- A domain belongs to exactly one client while active.
create unique index if not exists client_website_domains_single_client
  on public.client_website_domains (domain) where is_active;

create unique index if not exists client_website_domains_one_primary
  on public.client_website_domains (client_id) where is_primary and is_active;

alter table public.client_website_domains enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_website_domains'
      and policyname = 'client_website_domains: manager select'
  ) then
    create policy "client_website_domains: manager select"
      on public.client_website_domains for select using (public.is_manager());
  end if;
end $$;

-- ── CG CTA / key-event taxonomy ─────────────────────────────────────────────
-- Bounded to what Dynamics needs in order to tell the truth about a CTA. This is the taxonomy the
-- reporting layer checks against the property's actual events; it does NOT redesign client websites.
create table if not exists public.client_cta_event_definitions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  -- CG taxonomy key, e.g. whatsapp_click / phone_click / email_click / quote_request / form_submit.
  cta_key text not null check (cta_key ~ '^[a-z][a-z0-9_]{2,48}$'),
  label text not null check (length(trim(label)) > 0),
  -- GA4 event names that satisfy this CTA, in priority order. Empty means "expected but not yet
  -- instrumented", which the runtime reports as setup_required rather than as zero.
  ga4_event_names text[] not null default '{}',
  -- True when the client's onboarding says this action matters commercially.
  expected boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_cta_event_definitions_unique_key
  on public.client_cta_event_definitions (client_id, cta_key);

alter table public.client_cta_event_definitions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'client_cta_event_definitions'
      and policyname = 'client_cta_event_definitions: manager select'
  ) then
    create policy "client_cta_event_definitions: manager select"
      on public.client_cta_event_definitions for select using (public.is_manager());
  end if;
end $$;

-- Deliberately NO seed data. A GA4 property, domain or CTA taxonomy must be recorded per client
-- with real provider evidence; inventing a mapping is exactly the failure mode this issue forbids.

commit;
