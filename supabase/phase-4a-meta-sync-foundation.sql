-- ============================================================
-- CG Dynamics — Phase 4a Meta Business sync foundation
-- Run this once in the Supabase SQL editor before testing Meta sync.
--
-- Creates the data layer for connecting Meta Business assets,
-- linking them to CG Dynamics clients, tracking sync operations,
-- and mapping Meta content to report posts.
--
-- IMPORTANT: This migration does NOT implement OAuth, call Meta
-- APIs, or wire the frontend. It only creates the database tables
-- so the remaining phases can build on top.
--
-- SECURITY ARCHITECTURE:
--   meta_connections         — frontend-safe connection metadata (status,
--                              business info, no tokens). Readable by
--                              admin and staff via RLS.
--   meta_connection_tokens   — server-only encrypted token storage.
--                              RLS is enabled with NO select policies.
--                              Only Supabase Edge Functions using the
--                              service_role key (which bypasses RLS) can
--                              read or write this table. Tokens never
--                              reach the browser.
--
-- Future flow:
--   1. OAuth callback runs in a Supabase Edge Function.
--   2. Edge Functions write encrypted tokens to meta_connection_tokens
--      and update meta_connections.status.
--   3. Frontend triggers connect/sync actions via Supabase RPC or Edge
--      Function — it only ever reads meta_connections, never tokens.
--   4. Synced data creates or updates draft reports only.
--   5. Reports will never auto-publish.
--   6. Current month data stays as internal draft until month-end.
-- ============================================================


-- ── 1. META CONNECTIONS ─────────────────────────────────────
-- Frontend-safe connection metadata. Status and linked assets are
-- visible to admin/staff via RLS. No token data lives here.
-- Encrypted tokens are stored separately in meta_connection_tokens.

create table if not exists public.meta_connections (
  id                 uuid primary key default gen_random_uuid(),
  connected_by       uuid references auth.users(id) on delete set null,
  meta_business_id   text,
  meta_business_name text,
  status             text not null default 'not_connected'
                       check (status in ('not_connected','connected','needs_reauth','revoked','error')),
  scopes             text[] not null default '{}',
  last_error         text,
  last_connected_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.meta_connections is
  'Frontend-safe Meta Business connection metadata. No encrypted tokens are stored here — they live in meta_connection_tokens which is server-only.';

-- updated_at trigger (follows the existing per-table trigger pattern)
create or replace function public.set_meta_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_connections_set_updated_at on public.meta_connections;
create trigger meta_connections_set_updated_at
  before update on public.meta_connections
  for each row execute procedure public.set_meta_connections_updated_at();


-- ── 2. META CONNECTION TOKENS ───────────────────────────────
-- Server-only encrypted token storage. One row per Meta connection.
--
-- SECURITY: RLS is enabled with NO select/insert/update/delete
-- policies for any frontend role (admin, staff, client). This table
-- can ONLY be accessed by Supabase Edge Functions running with the
-- service_role key, which bypasses RLS entirely.
--
-- The frontend must never query this table. Tokens never reach the
-- browser. If a future phase needs token-expiry information on the
-- frontend, expose a boolean/status column on meta_connections
-- instead of leaking the encrypted value or expiry date.

create table if not exists public.meta_connection_tokens (
  id                     uuid primary key default gen_random_uuid(),
  connection_id          uuid not null unique references public.meta_connections(id) on delete cascade,
  encrypted_access_token text not null,
  encrypted_refresh_token text,
  token_expires_at       timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.meta_connection_tokens is
  'SERVER-ONLY. Encrypted Meta tokens. Never queried from the frontend. Only Supabase Edge Functions (service_role) should read/write this table.';

comment on column public.meta_connection_tokens.encrypted_access_token is
  'Encrypted long-lived Meta access token. Written and read exclusively by server-side Edge Functions using the service_role key. Never stored or sent to the frontend.';

comment on column public.meta_connection_tokens.encrypted_refresh_token is
  'Encrypted token for refreshing the access token. Same security rule as encrypted_access_token.';

create or replace function public.set_meta_connection_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_connection_tokens_set_updated_at on public.meta_connection_tokens;
create trigger meta_connection_tokens_set_updated_at
  before update on public.meta_connection_tokens
  for each row execute procedure public.set_meta_connection_tokens_updated_at();


-- ── 3. META CLIENT ASSETS ───────────────────────────────────
-- Links a CG Dynamics client to their Meta assets (Facebook Page,
-- Instagram account, ad account). One client can have multiple
-- mappings if they manage pages for multiple brands.
--
-- No unique constraint on (client_id) or (client_id, is_active) so
-- that future multi-page or multi-brand clients are not blocked.

create table if not exists public.meta_client_assets (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade,
  connection_id         uuid references public.meta_connections(id) on delete set null,
  facebook_page_id      text,
  facebook_page_name    text,
  instagram_account_id  text,
  instagram_username    text,
  ad_account_id         text,
  ad_account_name       text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists meta_client_assets_client_idx
  on public.meta_client_assets (client_id);

create index if not exists meta_client_assets_connection_idx
  on public.meta_client_assets (connection_id);

create index if not exists meta_client_assets_fb_page_idx
  on public.meta_client_assets (facebook_page_id);

create index if not exists meta_client_assets_ig_account_idx
  on public.meta_client_assets (instagram_account_id);

create index if not exists meta_client_assets_active_idx
  on public.meta_client_assets (is_active);

create or replace function public.set_meta_client_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_client_assets_set_updated_at on public.meta_client_assets;
create trigger meta_client_assets_set_updated_at
  before update on public.meta_client_assets
  for each row execute procedure public.set_meta_client_assets_updated_at();


-- ── 4. META SYNC RUNS ───────────────────────────────────────
-- Logs every sync attempt so staff can monitor success, failure,
-- and what period was synced. Used to prevent duplicate syncs.

create table if not exists public.meta_sync_runs (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  asset_id      uuid references public.meta_client_assets(id) on delete set null,
  connection_id uuid references public.meta_connections(id) on delete set null,
  sync_type     text not null check (sync_type in ('previous_completed_month','current_month','custom')),
  period_start  date not null,
  period_end    date not null,
  status        text not null default 'queued' check (status in ('queued','running','success','partial','failed')),
  summary       jsonb not null default '{}'::jsonb,
  error_message text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists meta_sync_runs_client_idx
  on public.meta_sync_runs (client_id);

create index if not exists meta_sync_runs_asset_idx
  on public.meta_sync_runs (asset_id);

create index if not exists meta_sync_runs_connection_idx
  on public.meta_sync_runs (connection_id);

create index if not exists meta_sync_runs_period_idx
  on public.meta_sync_runs (period_start, period_end);

create index if not exists meta_sync_runs_status_idx
  on public.meta_sync_runs (status);

create index if not exists meta_sync_runs_created_idx
  on public.meta_sync_runs (created_at desc);


-- ── 5. META CONTENT MAPPINGS ────────────────────────────────
-- Maps Meta post/media IDs to existing CG Dynamics report posts,
-- making sync idempotent and preventing duplicate entries.

create table if not exists public.meta_content_mappings (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  report_id         uuid references public.reports(id) on delete cascade,
  post_id           uuid references public.posts(id) on delete set null,
  platform          text not null check (platform in ('facebook','instagram')),
  meta_object_id    text not null,
  meta_object_type  text,
  permalink         text,
  source_hash       text,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One mapping per client + platform + Meta object ID (idempotent sync).
-- Using a unique index (rather than a table constraint) for idempotent
-- re-runs — PostgreSQL does not support CREATE UNIQUE INDEX IF NOT EXISTS
-- on table constraints.
create unique index if not exists meta_content_mappings_unique
  on public.meta_content_mappings (client_id, platform, meta_object_id);

create index if not exists meta_content_mappings_report_idx
  on public.meta_content_mappings (report_id);

create index if not exists meta_content_mappings_post_idx
  on public.meta_content_mappings (post_id);

create or replace function public.set_meta_content_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_content_mappings_set_updated_at on public.meta_content_mappings;
create trigger meta_content_mappings_set_updated_at
  before update on public.meta_content_mappings
  for each row execute procedure public.set_meta_content_mappings_updated_at();


-- ── 6. ROW-LEVEL SECURITY ───────────────────────────────────
-- Follows the phase-3g+ split pattern: admin full control,
-- staff read-only on frontend-safe tables. Clients have no access
-- to Meta sync data, keeping their view limited to published
-- reports only.
--
-- meta_connection_tokens has RLS enabled with NO policies — it is
-- server-only and must never be queried from the frontend.

-- 6a. meta_connections (frontend-safe metadata only)
alter table public.meta_connections enable row level security;

create policy "meta_connections: admin all"
  on public.meta_connections for all
  using (is_admin())
  with check (is_admin());

create policy "meta_connections: staff read"
  on public.meta_connections for select
  using (is_staff());

-- 6b. meta_connection_tokens (server-only — no frontend policies)
alter table public.meta_connection_tokens enable row level security;

-- INTENTIONALLY NO POLICIES.
-- This table has RLS enabled but grants zero access to any frontend
-- role (admin, staff, client). Only Supabase Edge Functions using the
-- service_role key (which bypasses RLS) can read or write tokens.
-- If a future phase needs to check token existence from the frontend,
-- add a non-sensitive boolean column to meta_connections instead.

-- 6c. meta_client_assets
alter table public.meta_client_assets enable row level security;

create policy "meta_client_assets: admin all"
  on public.meta_client_assets for all
  using (is_admin())
  with check (is_admin());

create policy "meta_client_assets: staff read"
  on public.meta_client_assets for select
  using (is_staff());

-- 6d. meta_sync_runs
alter table public.meta_sync_runs enable row level security;

create policy "meta_sync_runs: admin all"
  on public.meta_sync_runs for all
  using (is_admin())
  with check (is_admin());

create policy "meta_sync_runs: staff read"
  on public.meta_sync_runs for select
  using (is_staff());

-- 6e. meta_content_mappings
alter table public.meta_content_mappings enable row level security;

create policy "meta_content_mappings: admin all"
  on public.meta_content_mappings for all
  using (is_admin())
  with check (is_admin());

create policy "meta_content_mappings: staff read"
  on public.meta_content_mappings for select
  using (is_staff());
