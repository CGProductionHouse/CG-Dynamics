-- Issue #399: canonical client portal username access
-- Stores only exact client -> auth user mapping and username. Passwords are never persisted here.

create table if not exists public.client_portal_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  username text not null unique,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_access_username_format
    check (username ~ '^[a-z0-9]{3,64}$')
);

create index if not exists client_portal_access_enabled_idx
  on public.client_portal_access (enabled, client_id);

alter table public.client_portal_access enable row level security;

revoke all on table public.client_portal_access from anon;
revoke all on table public.client_portal_access from authenticated;

comment on table public.client_portal_access is
  'Admin-managed exact client -> portal username/auth-user mapping. No plaintext credentials are stored.';

comment on column public.client_portal_access.username is
  'Canonical lowercase alphanumeric client-facing portal username.';

comment on column public.client_portal_access.auth_user_id is
  'Synthetic/internal Supabase auth identity used only for the mapped exact client.';
