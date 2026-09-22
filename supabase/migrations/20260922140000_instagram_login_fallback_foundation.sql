-- #471 Phase 1 only. Prepared code; do not apply without CA approval.
-- Standalone Instagram Login is a separate credential route for professional
-- accounts that cannot use the canonical Facebook Page-linked Meta flow.

create table if not exists public.meta_instagram_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  connected_by uuid references auth.users(id) on delete set null,
  app_scoped_user_id text not null,
  instagram_account_id text not null unique,
  instagram_username text not null,
  account_type text not null check (account_type in ('Business', 'Media_Creator')),
  scopes text[] not null default '{}',
  status text not null default 'pending_review'
    check (status in ('pending_review', 'connected', 'needs_reauth', 'revoked', 'rejected')),
  confirmed_asset_id uuid unique references public.meta_client_assets(id) on delete set null,
  last_connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meta_instagram_connections is
  'Frontend-safe standalone Instagram Login metadata. pending_review is not a reporting mapping; explicit staff confirmation must bind confirmed_asset_id.';

create table if not exists public.meta_instagram_connection_tokens (
  connection_id uuid primary key references public.meta_instagram_connections(id) on delete cascade,
  access_token text not null,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.meta_instagram_connection_tokens is
  'SERVER-ONLY Instagram user tokens. RLS has no browser policies; only narrowly guarded service-role functions may access rows.';

create table if not exists public.meta_instagram_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.meta_instagram_connections enable row level security;
alter table public.meta_instagram_connection_tokens enable row level security;
alter table public.meta_instagram_oauth_states enable row level security;

drop policy if exists meta_instagram_connections_manager_read on public.meta_instagram_connections;
create policy meta_instagram_connections_manager_read
  on public.meta_instagram_connections for select to authenticated
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active = true
      and profile.role in ('admin', 'manager')
  ));

-- No authenticated policies exist on token or OAuth-state tables.
revoke all on public.meta_instagram_connection_tokens from anon, authenticated;
revoke all on public.meta_instagram_oauth_states from anon, authenticated;
revoke insert, update, delete on public.meta_instagram_connections from anon, authenticated;
grant select on public.meta_instagram_connections to authenticated;

create or replace function public.set_meta_instagram_connection_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meta_instagram_connections_set_updated_at on public.meta_instagram_connections;
create trigger meta_instagram_connections_set_updated_at
  before update on public.meta_instagram_connections
  for each row execute procedure public.set_meta_instagram_connection_updated_at();

create or replace function public.complete_instagram_login_connection(
  p_client_id uuid,
  p_connected_by uuid,
  p_app_scoped_user_id text,
  p_instagram_account_id text,
  p_instagram_username text,
  p_account_type text,
  p_scopes text[],
  p_access_token text,
  p_token_expires_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_connection_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;
  if p_account_type not in ('Business', 'Media_Creator') then
    raise exception 'Professional Instagram account required';
  end if;
  if p_instagram_account_id !~ '^\d+$' or p_app_scoped_user_id !~ '^\d+$' then
    raise exception 'Invalid Instagram provider identity';
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and active = true) then
    raise exception 'Active client required';
  end if;
  if not exists (select 1 from auth.users where id = p_connected_by) then
    raise exception 'Authenticated connecting user required';
  end if;
  if coalesce(btrim(p_access_token), '') = '' then
    raise exception 'Instagram access token required';
  end if;
  if p_instagram_username !~ '^[A-Za-z0-9._]{1,30}$' then
    raise exception 'Invalid Instagram username';
  end if;
  if not (p_scopes @> array['instagram_business_basic', 'instagram_business_manage_insights']::text[]) then
    raise exception 'Required Instagram reporting scopes missing';
  end if;
  if exists (
    select 1 from public.meta_client_assets
    where client_id = p_client_id
      and is_active = true
      and instagram_account_id is not null
  ) then
    raise exception 'Client already has a canonical Instagram mapping';
  end if;
  if exists (
    select 1 from public.meta_instagram_connections
    where instagram_account_id = p_instagram_account_id and client_id <> p_client_id
  ) then
    raise exception 'Instagram account is already assigned to another client';
  end if;

  insert into public.meta_instagram_connections (
    client_id, connected_by, app_scoped_user_id, instagram_account_id,
    instagram_username, account_type, scopes, status, last_connected_at
  ) values (
    p_client_id, p_connected_by, p_app_scoped_user_id, p_instagram_account_id,
    p_instagram_username, p_account_type, p_scopes, 'pending_review', now()
  )
  on conflict (client_id) do update set
    connected_by = excluded.connected_by,
    app_scoped_user_id = excluded.app_scoped_user_id,
    instagram_account_id = excluded.instagram_account_id,
    instagram_username = excluded.instagram_username,
    account_type = excluded.account_type,
    scopes = excluded.scopes,
    status = 'pending_review',
    confirmed_asset_id = null,
    last_connected_at = now()
  returning id into v_connection_id;

  insert into public.meta_instagram_connection_tokens (connection_id, access_token, token_expires_at)
  values (v_connection_id, p_access_token, p_token_expires_at)
  on conflict (connection_id) do update set
    access_token = excluded.access_token,
    token_expires_at = excluded.token_expires_at,
    updated_at = now();

  return v_connection_id;
end;
$$;

revoke all on function public.complete_instagram_login_connection(uuid, uuid, text, text, text, text, text[], text, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_instagram_login_connection(uuid, uuid, text, text, text, text, text[], text, timestamptz) to service_role;
