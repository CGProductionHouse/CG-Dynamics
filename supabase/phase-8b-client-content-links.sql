-- Phase 8b: Per-Client Content Links & Guidelines
-- Apply in Supabase SQL Editor when ready.
-- App degrades gracefully (42P01 errors handled) until this migration is applied.

create table if not exists client_content_links (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references clients(id) on delete cascade,
  onedrive_main_url   text,
  brand_assets_url    text,
  raw_footage_url     text,
  ready_to_edit_url   text,
  exports_url         text,
  naming_convention   text,
  content_guideline   text,
  video_reel_notes    text,
  shot_list           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (client_id)
);

alter table client_content_links enable row level security;

create policy "Staff can read content links"
  on client_content_links for select
  using (auth.role() = 'authenticated');

create policy "Staff can write content links"
  on client_content_links for all
  using (auth.role() = 'authenticated');
