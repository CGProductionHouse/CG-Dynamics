-- Phase 8a: Client Brand Profile + Update Log
-- Apply in Supabase SQL Editor when ready.
-- App degrades gracefully (42P01 errors handled) until this migration is applied.

create table if not exists client_brand_profiles (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references clients(id) on delete cascade,
  brand_notes       text,
  tone_voice        text,
  visual_direction  text,
  colours_fonts     text,
  do_notes          text,
  dont_notes        text,
  asset_notes       text,
  onedrive_url      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (client_id)
);

create table if not exists client_brand_logs (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references clients(id) on delete cascade,
  log_date         date not null default current_date,
  title            text not null,
  note             text,
  changed_by_name  text,
  created_at       timestamptz not null default now()
);

alter table client_brand_profiles enable row level security;
alter table client_brand_logs enable row level security;

create policy "Staff can read brand profiles"
  on client_brand_profiles for select
  using (auth.role() = 'authenticated');

create policy "Admins can write brand profiles"
  on client_brand_profiles for all
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Staff can read brand logs"
  on client_brand_logs for select
  using (auth.role() = 'authenticated');

create policy "Staff can write brand logs"
  on client_brand_logs for all
  using (auth.role() = 'authenticated');
