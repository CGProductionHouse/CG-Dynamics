-- ============================================================
-- CG Dynamics - Phase 3h manual platform metrics
-- Run this once in the Supabase SQL editor.
--
-- A manual fallback for platforms without a reliable CSV export
-- (e.g. Instagram not connected to Meta Business Suite, varying
-- TikTok exports). One aggregate row per client + month + platform.
-- These feed into the master monthly report alongside CSV imports.
-- ============================================================

create table if not exists manual_platform_metrics (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references clients(id) on delete cascade,
  month                    text not null,   -- 'YYYY-MM'
  platform                 text not null check (platform in ('facebook','instagram','tiktok')),
  source_type              text not null default 'manual_summary'
                             check (source_type in ('meta_csv','manual_summary','tiktok_csv','other')),
  views                    int not null default 0,
  reach                    int not null default 0,
  engagements              int not null default 0,
  accounts_engaged         int not null default 0,
  profile_visits           int not null default 0,
  external_link_taps       int not null default 0,
  followers                int not null default 0,
  top_content_notes        text,
  content_type_split_notes text,
  general_notes            text,
  created_by               uuid references profiles(id),
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

-- One manual entry per client + month + platform.
create unique index if not exists manual_platform_metrics_unique
  on manual_platform_metrics (client_id, month, platform);

create index if not exists manual_platform_metrics_client_month_idx
  on manual_platform_metrics (client_id, month);

-- Keep updated_at fresh.
create or replace function public.set_manual_metrics_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists manual_platform_metrics_set_updated_at on manual_platform_metrics;
create trigger manual_platform_metrics_set_updated_at
  before update on manual_platform_metrics
  for each row execute procedure public.set_manual_metrics_updated_at();

-- ── ROW-LEVEL SECURITY ───────────────────────────────────────
alter table manual_platform_metrics enable row level security;

-- Admin: full read/write.
create policy "manual_platform_metrics: admin all"
  on manual_platform_metrics for all
  using (is_admin())
  with check (is_admin());

-- Team (staff): read-only across all clients.
create policy "manual_platform_metrics: staff read all"
  on manual_platform_metrics for select
  using (is_staff());

-- Client: read-only, own linked client only.
create policy "manual_platform_metrics: client reads own"
  on manual_platform_metrics for select
  using (client_id = my_client_id());
