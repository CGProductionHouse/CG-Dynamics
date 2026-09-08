-- ============================================================
-- CG Dynamics — Phase 5a TikTok provider foundation
--
-- Creates the data layer for connecting TikTok accounts via
-- OAuth 2.0 (Login Kit), storing tokens server-only, linking
-- TikTok accounts to clients, tracking sync operations, and
-- mapping TikTok content to report posts.
--
-- Follows the same security architecture as Meta (phase-4a):
--   tiktok_connections        — frontend-safe connection metadata
--   tiktok_connection_tokens  — server-only token storage (RLS/no policies)
--   tiktok_oauth_states       — one-time CSRF state hashes
--   tiktok_content_mappings   — idempotent content sync mappings
--   tiktok_publish_receipts   — publishing status tracking
--
-- TikTok API facts:
--   - Display API: /v2/user/info/, /v2/video/list/, /v2/video/query/
--   - Content Posting API: /v2/post/publish/video/init/
--   - OAuth 2.0 via Login Kit (web flow)
--   - Access tokens expire in 24h; refresh tokens valid 365 days
--   - Rate limit: 6 requests/min per user token on posting endpoints
-- ============================================================


-- ── 1. TIKTOK CONNECTIONS ───────────────────────────────────
-- Frontend-safe connection metadata. No tokens stored here.

create table if not exists public.tiktok_connections (
  id                 uuid primary key default gen_random_uuid(),
  connected_by       uuid references auth.users(id) on delete set null,
  tiktok_open_id     text,
  display_name       text,
  avatar_url         text,
  profile_deep_link  text,
  status             text not null default 'not_connected'
                       check (status in ('not_connected','connected','needs_reauth','revoked','error')),
  scopes             text[] not null default '{}',
  last_error         text,
  last_connected_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.tiktok_connections is
  'Frontend-safe TikTok connection metadata. Tokens live in tiktok_connection_tokens (server-only).';

create or replace function public.set_tiktok_connections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiktok_connections_set_updated_at on public.tiktok_connections;
create trigger tiktok_connections_set_updated_at
  before update on public.tiktok_connections
  for each row execute procedure public.set_tiktok_connections_updated_at();


-- ── 2. TIKTOK CONNECTION TOKENS ─────────────────────────────
-- Server-only token storage. SECURITY: RLS enabled with NO
-- policies. Only Edge Functions (service_role) can access.

create table if not exists public.tiktok_connection_tokens (
  id                     uuid primary key default gen_random_uuid(),
  connection_id          uuid not null unique references public.tiktok_connections(id) on delete cascade,
  access_token           text not null,
  refresh_token          text,
  token_expires_at       timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

comment on table public.tiktok_connection_tokens is
  'SERVER-ONLY. TikTok OAuth tokens. Never queried from the frontend.';

create or replace function public.set_tiktok_connection_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiktok_connection_tokens_set_updated_at on public.tiktok_connection_tokens;
create trigger tiktok_connection_tokens_set_updated_at
  before update on public.tiktok_connection_tokens
  for each row execute procedure public.set_tiktok_connection_tokens_updated_at();


-- ── 3. TIKTOK OAUTH STATES ──────────────────────────────────
-- One-time CSRF state hashes for OAuth flow.

create table if not exists public.tiktok_oauth_states (
  id          uuid primary key default gen_random_uuid(),
  state_hash  text not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.tiktok_oauth_states is
  'Server-only one-time TikTok OAuth state hashes for CSRF protection.';

create index if not exists tiktok_oauth_states_expires_idx
  on public.tiktok_oauth_states (expires_at);

create index if not exists tiktok_oauth_states_unused_idx
  on public.tiktok_oauth_states (used_at)
  where used_at is null;


-- ── 4. TIKTOK CONTENT MAPPINGS ──────────────────────────────
-- Idempotent mapping of TikTok video IDs to report posts.

create table if not exists public.tiktok_content_mappings (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  report_id         uuid references public.reports(id) on delete cascade,
  post_id           uuid references public.posts(id) on delete set null,
  tiktok_video_id   text not null,
  title             text,
  share_url         text,
  embed_link        text,
  duration          integer,
  cover_image_url   text,
  view_count        integer,
  like_count        integer,
  comment_count     integer,
  share_count       integer,
  last_synced_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists tiktok_content_mappings_unique
  on public.tiktok_content_mappings (client_id, tiktok_video_id);

create index if not exists tiktok_content_mappings_report_idx
  on public.tiktok_content_mappings (report_id);

create index if not exists tiktok_content_mappings_post_idx
  on public.tiktok_content_mappings (post_id);

create or replace function public.set_tiktok_content_mappings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiktok_content_mappings_set_updated_at on public.tiktok_content_mappings;
create trigger tiktok_content_mappings_set_updated_at
  before update on public.tiktok_content_mappings
  for each row execute procedure public.set_tiktok_content_mappings_updated_at();


-- ── 5. TIKTOK PUBLISH RECEIPTS ──────────────────────────────
-- Tracks content publishing lifecycle. Each receipt represents
-- one publish attempt (direct post or draft upload).

create table if not exists public.tiktok_publish_receipts (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid not null references public.clients(id) on delete cascade,
  connection_id      uuid references public.tiktok_connections(id) on delete set null,
  publish_id         text,
  post_mode          text not null check (post_mode in ('direct_post','draft_upload')),
  source_type        text not null check (source_type in ('pull_from_url','file_upload')),
  source_url         text,
  privacy_level      text,
  title              text,
  status             text not null default 'pending'
                       check (status in ('pending','uploading','processing','published','failed','cancelled')),
  provider_error     text,
  tiktok_video_id    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists tiktok_publish_receipts_client_idx
  on public.tiktok_publish_receipts (client_id);

create index if not exists tiktok_publish_receipts_publish_id_idx
  on public.tiktok_publish_receipts (publish_id);

create index if not exists tiktok_publish_receipts_status_idx
  on public.tiktok_publish_receipts (status);

create or replace function public.set_tiktok_publish_receipts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tiktok_publish_receipts_set_updated_at on public.tiktok_publish_receipts;
create trigger tiktok_publish_receipts_set_updated_at
  before update on public.tiktok_publish_receipts
  for each row execute procedure public.set_tiktok_publish_receipts_updated_at();


-- ── 6. ROW-LEVEL SECURITY ───────────────────────────────────

-- 6a. tiktok_connections (frontend-safe metadata)
alter table public.tiktok_connections enable row level security;

create policy "tiktok_connections: admin all"
  on public.tiktok_connections for all
  using (is_admin())
  with check (is_admin());

create policy "tiktok_connections: staff read"
  on public.tiktok_connections for select
  using (is_staff());

-- 6b. tiktok_connection_tokens (server-only — no frontend policies)
alter table public.tiktok_connection_tokens enable row level security;
-- INTENTIONALLY NO POLICIES — server-only.

-- 6c. tiktok_oauth_states (server-only — no frontend policies)
alter table public.tiktok_oauth_states enable row level security;
-- INTENTIONALLY NO POLICIES — server-only.

-- 6d. tiktok_content_mappings
alter table public.tiktok_content_mappings enable row level security;

create policy "tiktok_content_mappings: admin all"
  on public.tiktok_content_mappings for all
  using (is_admin())
  with check (is_admin());

create policy "tiktok_content_mappings: staff read"
  on public.tiktok_content_mappings for select
  using (is_staff());

-- 6e. tiktok_publish_receipts
alter table public.tiktok_publish_receipts enable row level security;

create policy "tiktok_publish_receipts: admin all"
  on public.tiktok_publish_receipts for all
  using (is_admin())
  with check (is_admin());

create policy "tiktok_publish_receipts: staff read"
  on public.tiktok_publish_receipts for select
  using (is_staff());
