-- Proposal-only additive migration for Issue #225
-- Durable production OneDrive mappings + client short codes
-- DO NOT APPLY TO PRODUCTION WITHOUT EXPLICIT CA APPROVAL
-- This migration is staged for review; it creates no runtime code paths until the
-- dedicated Microsoft app is registered, consented, and the folder grant is performed.

begin;

-- 1. Add short_code to clients (nullable, unique-when-set, manager-assigned)
-- Used only to DERIVE expected future folder names (e.g. 2026_08_ECONO_VIDEO_01).
-- Never used for fuzzy-matching existing folders at runtime.
alter table public.clients
  add column if not exists short_code text
    check (char_length(short_code) between 2 and 16)
    check (short_code ~ '^[A-Z0-9]+$');

create unique index if not exists clients_short_code_unique
  on public.clients (short_code)
  where short_code is not null;

comment on column public.clients.short_code is
  'Manager-assigned short code (e.g. ECONO) used only to derive canonical future folder names. Never used for fuzzy runtime matching.';

-- 2. Production OneDrive mapping table (one per active client)
-- Stores durable Graph drive/item IDs only. No paths, no guessed names.
create table if not exists public.client_onedrive_mappings (
  client_id uuid primary key references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  client_folder_item_id text not null check (char_length(client_folder_item_id) between 1 and 255),
  videos_folder_item_id text not null check (char_length(videos_folder_item_id) between 1 and 255),
  web_url text not null check (char_length(web_url) between 1 and 2048),
  folder_name text not null check (char_length(folder_name) between 1 and 255), -- display/audit only
  mapped_by uuid not null references public.profiles(id) on delete restrict,
  mapped_at timestamptz not null default now(),
  last_verified_at timestamptz not null default now()
);

comment on table public.client_onedrive_mappings is
  'Durable OneDrive production mapping per client. Stores Graph driveId + itemIds for Clients/<Client> and Videos folders. No fuzzy matching; exact IDs only.';

-- 3. Per-Content-Run durable month/shoot folder links (refs #224/#225)
create table if not exists public.content_run_onedrive_folders (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid not null references public.content_runs(id) on delete cascade,
  month_folder_item_id text not null check (char_length(month_folder_item_id) between 1 and 255),
  month_folder_web_url text not null check (char_length(month_folder_web_url) between 1 and 2048),
  shoot_folder_item_id text check (shoot_folder_item_id is null or char_length(shoot_folder_item_id) between 1 and 255),
  shoot_folder_web_url text check (shoot_folder_web_url is null or char_length(shoot_folder_web_url) between 1 and 2048),
  resolved_at timestamptz not null default now(),
  resolved_by uuid not null references public.profiles(id) on delete restrict,
  unique (content_run_id)
);

comment on table public.content_run_onedrive_folders is
  'Durable month/shoot folder itemIds for a Content Run. Resolved against the client Videos folder via Graph.';

-- 4. RLS: service-role / Edge Function only (revoked from anon/authenticated)
alter table public.client_onedrive_mappings enable row level security;
alter table public.content_run_onedrive_folders enable row level security;

revoke all on public.client_onedrive_mappings from anon, authenticated;
revoke all on public.content_run_onedrive_folders from anon, authenticated;

-- 5. Helpful indexes
create index if not exists client_onedrive_mappings_verified_idx
  on public.client_onedrive_mappings (last_verified_at desc);

create index if not exists content_run_onedrive_folders_run_idx
  on public.content_run_onedrive_folders (content_run_id);

commit;