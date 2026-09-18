-- Issue #396: read-only Client Portal Library / Brand Hub foundation.
--
-- This migration records exact, human-reviewed OneDrive mappings only. It does not create
-- folders, copy or move files, grant permissions, or create shares. Browser roles receive no
-- direct table access; the client-onboarding Edge Function returns the client-safe projection.

begin;

create table if not exists public.client_portal_libraries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  root_folder_item_id text not null check (char_length(root_folder_item_id) between 1 and 255),
  root_folder_name text not null check (
    root_folder_name ~ '^A_ClientPortal_[A-Za-z0-9][A-Za-z0-9_-]{0,95}$'
  ),
  enabled boolean not null default false,
  mapped_by uuid not null references public.profiles(id) on delete restrict,
  mapped_at timestamptz not null default now(),
  last_verified_at timestamptz,
  check (not enabled or last_verified_at is not null),
  unique (id, client_id),
  unique (id, client_id, drive_id),
  unique (drive_id, root_folder_item_id)
);

comment on table public.client_portal_libraries is
  'Exact client-safe A_ClientPortal_<ClientSlug> OneDrive root mappings. Durable Graph IDs are internal only. Mapping does not grant or change OneDrive permissions.';

create table if not exists public.client_portal_library_categories (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null check (category in ('brand_identity', 'graphic_design', 'video', 'photography')),
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  folder_item_id text not null check (char_length(folder_item_id) between 1 and 255),
  folder_name text not null check (
    (category = 'brand_identity' and folder_name = 'Brand Identity')
    or (category = 'graphic_design' and folder_name = 'Graphic Design')
    or (category = 'video' and folder_name = 'Video')
    or (category = 'photography' and folder_name = 'Photography')
  ),
  mapped_by uuid not null references public.profiles(id) on delete restrict,
  mapped_at timestamptz not null default now(),
  last_verified_at timestamptz,
  foreign key (library_id, client_id, drive_id)
    references public.client_portal_libraries(id, client_id, drive_id) on delete cascade,
  unique (library_id, category),
  unique (id, library_id, client_id, drive_id, folder_item_id),
  unique (drive_id, folder_item_id)
);

comment on table public.client_portal_library_categories is
  'Exact durable mappings for the locked client-safe Brand Identity, Graphic Design, Video and optional Photography folders.';

create table if not exists public.client_portal_assets (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null,
  category_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  drive_id text not null check (char_length(drive_id) between 1 and 255),
  parent_folder_item_id text not null check (char_length(parent_folder_item_id) between 1 and 255),
  item_id text not null check (char_length(item_id) between 1 and 255),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 255),
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  deliverable_id uuid references public.monthly_deliverables(id) on delete set null,
  published_by uuid not null references public.profiles(id) on delete restrict,
  published_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (library_id, client_id)
    references public.client_portal_libraries(id, client_id) on delete cascade,
  foreign key (category_id, library_id, client_id, drive_id, parent_folder_item_id)
    references public.client_portal_library_categories(id, library_id, client_id, drive_id, folder_item_id)
    on delete cascade,
  unique (drive_id, item_id)
);

comment on table public.client_portal_assets is
  'Explicitly published client-safe final assets. One canonical record may link to one monthly_deliverables row; Graph IDs and paths never enter the client projection.';

create index if not exists client_portal_library_categories_client_idx
  on public.client_portal_library_categories (client_id, library_id, category);
create index if not exists client_portal_assets_client_idx
  on public.client_portal_assets (client_id, library_id, active, published_at desc);
create index if not exists client_portal_assets_deliverable_idx
  on public.client_portal_assets (deliverable_id)
  where deliverable_id is not null;

create or replace function public.enforce_client_portal_asset_deliverable_client()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deliverable_id is not null and not exists (
    select 1
    from public.monthly_deliverables deliverable
    where deliverable.id = new.deliverable_id
      and deliverable.client_id = new.client_id
  ) then
    raise exception 'Client Portal asset deliverable must belong to the same client.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_client_portal_asset_deliverable_client
  on public.client_portal_assets;
create trigger enforce_client_portal_asset_deliverable_client
  before insert or update of client_id, deliverable_id
  on public.client_portal_assets
  for each row execute function public.enforce_client_portal_asset_deliverable_client();

alter table public.client_portal_libraries enable row level security;
alter table public.client_portal_library_categories enable row level security;
alter table public.client_portal_assets enable row level security;

revoke all on table public.client_portal_libraries from anon, authenticated;
revoke all on table public.client_portal_library_categories from anon, authenticated;
revoke all on table public.client_portal_assets from anon, authenticated;
grant select on table public.client_portal_libraries to service_role;
grant select on table public.client_portal_library_categories to service_role;
grant select on table public.client_portal_assets to service_role;
revoke all on function public.enforce_client_portal_asset_deliverable_client() from public, anon, authenticated;

commit;
