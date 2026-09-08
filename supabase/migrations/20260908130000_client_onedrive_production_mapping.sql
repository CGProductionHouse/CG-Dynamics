-- Proposal-only additive migration for Issue #225: OneDrive production cleanup + folder naming enforcement
-- Durable production OneDrive mappings + client short codes.
-- Does NOT apply rename/move/delete behavior. No fuzzy runtime matching.
-- Preserves exact client IDs (FK to clients.id, cascade). RLS on; revoked from anon/authenticated.
-- Edge Function / service-role only access.

begin;

-- 1. Add short_code to clients for canonical naming derivation (e.g., ECONO)
-- Nullable, unique-when-set, manager-assigned. Used only to derive expected future names.
alter table public.clients
  add column if not exists short_code text;

-- Unique only when set (partial unique index)
create unique index if not exists uniq_clients_short_code
  on public.clients (short_code)
  where short_code is not null;

comment on column public.clients.short_code is
  'Manager-assigned short code (e.g., ECONO) for canonical folder naming. Nullable; unique when set. Used only to derive expected future names, never to fuzzy-match existing folders.';

-- 2. Production OneDrive mappings for active clients
-- One row per client mapping to the canonical Clients/<Client>/Videos folder tree.
-- Durable Graph drive/item IDs only. No path-based matching at runtime.
create table if not exists public.client_onedrive_mappings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  client_folder_item_id text not null check (char_length(client_folder_item_id) between 1 and 255),
  videos_folder_item_id text not null check (char_length(videos_folder_item_id) between 1 and 255),
  web_url text,
  folder_name text not null check (char_length(folder_name) between 1 and 255),
  mapped_by uuid not null references public.profiles(id) on delete restrict,
  mapped_at timestamptz not null default now(),
  last_verified_at timestamptz,
  unique (client_id)
);

comment on table public.client_onedrive_mappings is
  'Durable production OneDrive mapping for active clients. Maps each active client to its canonical Clients/<Client>/Videos folder via durable Graph drive/item IDs. No fuzzy runtime matching; no rename/move/delete logic.';

-- 3. Content Run → OneDrive month/shoot folder links
-- Per Content Run durable month/shoot folder itemId (supports #224/#225).
create table if not exists public.content_run_onedrive_folders (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid not null references public.content_runs(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  month_folder_item_id text not null check (char_length(month_folder_item_id) between 1 and 255),
  web_url text,
  folder_name text not null check (char_length(folder_name) between 1 and 255),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  unique (content_run_id)
);

comment on table public.content_run_onedrive_folders is
  'Durable OneDrive month/shoot folder links per Content Run. Maps a Content Run to its canonical month folder under Videos/<YYYY>/<YYYY_MM_MON>. No fuzzy runtime matching.';

-- 4. Indexes for common lookups
create index if not exists idx_client_onedrive_mappings_client on public.client_onedrive_mappings(client_id);
create index if not exists idx_client_onedrive_mappings_drive on public.client_onedrive_mappings(drive_id);
create index if not exists idx_content_run_onedrive_folders_run on public.content_run_onedrive_folders(content_run_id);
create index if not exists idx_content_run_onedrive_folders_client on public.content_run_onedrive_folders(client_id);

-- 5. Row Level Security
alter table public.client_onedrive_mappings enable row level security;
alter table public.content_run_onedrive_folders enable row level security;

-- No browser access — Edge Function / service-role only
revoke all on public.client_onedrive_mappings from anon, authenticated;
revoke all on public.content_run_onedrive_folders from anon, authenticated;

-- 6. Service-role helper functions for Edge Function access (security definer, search_path='')
-- These are called by the client-onboarding Edge Function with service-role key.
-- They enforce exact client isolation and read-only for non-admin roles.

-- client_onedrive_mappings: read for Edge Function
create or replace function public.get_client_onedrive_mapping(p_client_id uuid)
returns table (
  id uuid,
  client_id uuid,
  drive_id text,
  client_folder_item_id text,
  videos_folder_item_id text,
  web_url text,
  folder_name text,
  mapped_at timestamptz,
  last_verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select m.id, m.client_id, m.drive_id, m.client_folder_item_id, m.videos_folder_item_id,
         m.web_url, m.folder_name, m.mapped_at, m.last_verified_at
  from public.client_onedrive_mappings m
  where m.client_id = p_client_id;
end;
$$;

revoke all on function public.get_client_onedrive_mapping(uuid) from public, anon, authenticated;
grant execute on function public.get_client_onedrive_mapping(uuid) to service_role;

-- content_run_onedrive_folders: read for Edge Function
create or replace function public.get_content_run_onedrive_folder(p_content_run_id uuid)
returns table (
  id uuid,
  content_run_id uuid,
  client_id uuid,
  drive_id text,
  month_folder_item_id text,
  web_url text,
  folder_name text,
  created_at timestamptz,
  last_verified_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select f.id, f.content_run_id, f.client_id, f.drive_id, f.month_folder_item_id,
         f.web_url, f.folder_name, f.created_at, f.last_verified_at
  from public.content_run_onedrive_folders f
  where f.content_run_id = p_content_run_id;
end;
$$;

revoke all on function public.get_content_run_onedrive_folder(uuid) from public, anon, authenticated;
grant execute on function public.get_content_run_onedrive_folder(uuid) to service_role;

-- Admin-only write helpers (used by admin UI / staff actions)
create or replace function public.upsert_client_onedrive_mapping(
  p_client_id uuid,
  p_drive_id text,
  p_client_folder_item_id text,
  p_videos_folder_item_id text,
  p_web_url text,
  p_folder_name text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- Require admin role
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  -- Verify client exists and is active
  if not exists (
    select 1 from public.clients c where c.id = p_client_id and c.active is true
  ) then
    raise exception 'Active client required.' using errcode = '22023';
  end if;

  -- Upsert
  insert into public.client_onedrive_mappings (
    client_id, drive_id, client_folder_item_id, videos_folder_item_id,
    web_url, folder_name, mapped_by
  ) values (
    p_client_id, p_drive_id, p_client_folder_item_id, p_videos_folder_item_id,
    p_web_url, p_folder_name, p_actor_id
  )
  on conflict (client_id) do update set
    drive_id = excluded.drive_id,
    client_folder_item_id = excluded.client_folder_item_id,
    videos_folder_item_id = excluded.videos_folder_item_id,
    web_url = excluded.web_url,
    folder_name = excluded.folder_name,
    mapped_by = excluded.mapped_by,
    mapped_at = now(),
    last_verified_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_client_onedrive_mapping(uuid, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.upsert_client_onedrive_mapping(uuid, text, text, text, text, text, uuid) to service_role;

create or replace function public.upsert_content_run_onedrive_folder(
  p_content_run_id uuid,
  p_client_id uuid,
  p_drive_id text,
  p_month_folder_item_id text,
  p_web_url text,
  p_folder_name text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.role = 'admin' and p.is_active is true
  ) then
    raise exception 'Active admin access required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.content_runs r where r.id = p_content_run_id
  ) then
    raise exception 'Content run not found.' using errcode = '22023';
  end if;

  insert into public.content_run_onedrive_folders (
    content_run_id, client_id, drive_id, month_folder_item_id,
    web_url, folder_name, created_by
  ) values (
    p_content_run_id, p_client_id, p_drive_id, p_month_folder_item_id,
    p_web_url, p_folder_name, p_actor_id
  )
  on conflict (content_run_id) do update set
    client_id = excluded.client_id,
    drive_id = excluded.drive_id,
    month_folder_item_id = excluded.month_folder_item_id,
    web_url = excluded.web_url,
    folder_name = excluded.folder_name,
    created_by = excluded.created_by,
    created_at = now(),
    last_verified_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.upsert_content_run_onedrive_folder(uuid, uuid, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.upsert_content_run_onedrive_folder(uuid, uuid, text, text, text, text, uuid) to service_role;

commit;