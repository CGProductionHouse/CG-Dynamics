-- ============================================================
-- CG Dynamics — Phase 4b Meta OAuth security foundation
--
-- PREPARED ONLY. Review in Supabase SQL editor before running.
-- Do not run live without explicit approval.
--
-- Adds one-time, expiring OAuth state storage for Meta OAuth CSRF
-- protection. Edge Functions store only SHA-256 state hashes, never
-- raw state values.
-- ============================================================

create table if not exists public.meta_oauth_states (
  id          uuid primary key default gen_random_uuid(),
  state_hash  text not null unique,
  user_id     uuid not null references auth.users(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.meta_oauth_states is
  'Server-only one-time Meta OAuth state hashes. Used by Edge Functions to prevent CSRF and replay attacks.';

comment on column public.meta_oauth_states.state_hash is
  'SHA-256 hash of the OAuth state. Raw state is never stored.';

create index if not exists meta_oauth_states_expires_idx
  on public.meta_oauth_states (expires_at);

create index if not exists meta_oauth_states_unused_idx
  on public.meta_oauth_states (used_at)
  where used_at is null;

alter table public.meta_oauth_states enable row level security;

-- INTENTIONALLY NO POLICIES.
-- This table is server-only. Frontend roles cannot read, insert, update or
-- delete OAuth states. Supabase Edge Functions use the service_role key.

-- Optional maintenance query after deployment:
-- delete from public.meta_oauth_states
-- where expires_at < now() - interval '1 day' or used_at is not null;
-- ============================================================
