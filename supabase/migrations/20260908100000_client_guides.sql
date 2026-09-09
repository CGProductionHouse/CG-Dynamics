-- 20260908100000_client_guides.sql
-- Client Guide storage: derived/exportable documents from canonical Dynamics intelligence.
-- Each row is a generated Client Guide for one client. The guide is derived, not manually maintained.
-- Updating CG Dynamics intelligence should regenerate the guide.

create table if not exists public.client_guides (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  guide_markdown text not null,
  project_instructions text not null,
  generated_at  timestamptz not null default now(),
  version       integer not null default 1,
  source_pack_path text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.client_guides is 'Derived Client Guide documents. One per client. Generated from canonical Dynamics intelligence, not manually maintained.';

-- One active guide per client (latest version wins)
create unique index if not exists idx_client_guides_client_id
  on public.client_guides (client_id);

-- RLS: admin/manager read + write; staff read; client no access
alter table public.client_guides enable row level security;

-- Admin/manager: full access
create policy client_guides_admin_manager_all
  on public.client_guides
  for all
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ))
  with check (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ));

-- Staff: read only
create policy client_guides_staff_read
  on public.client_guides
  for select
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

-- Updated_at trigger
create or replace function public.update_client_guides_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_client_guides_updated_at on public.client_guides;
create trigger set_client_guides_updated_at
  before update on public.client_guides
  for each row
  execute function public.update_client_guides_updated_at();
