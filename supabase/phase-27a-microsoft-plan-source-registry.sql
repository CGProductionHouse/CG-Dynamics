-- ============================================================================
-- phase-27a — Microsoft plan-source registry
--
-- Root-cause fix for "2025 CLIENTS SCHEDULE is absent from the configured
-- sources". The production import sources came ONLY from the
-- MICROSOFT_SYNC_SOURCES_JSON Edge secret, so a plan not hand-listed there was
-- never fetched. This admin-managed registry lets a Planner plan be added as a
-- fetched source WITHOUT editing the secret. The Edge Function merges these
-- active rows into the env manifest (dedup by plan id).
--
-- Read-only toward Microsoft (we only fetch). Additive + idempotent. RLS:
-- staff read, admin manage.
-- ============================================================================

create table if not exists public.microsoft_sync_plan_sources (
  plan_id text primary key,
  plan_name text not null,
  kind text not null default 'client_schedule'
    check (kind in ('client_schedule', 'planner', 'cg_calendar', 'review')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.microsoft_sync_plan_sources is
  'Admin-managed Microsoft Planner plans fetched by microsoft-transition-sync, merged with the env manifest. Read-only toward Microsoft.';

alter table public.microsoft_sync_plan_sources enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='microsoft_sync_plan_sources' and policyname='msps_staff_read') then
    create policy msps_staff_read on public.microsoft_sync_plan_sources for select to authenticated using (public.is_staff());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='microsoft_sync_plan_sources' and policyname='msps_admin_manage') then
    create policy msps_admin_manage on public.microsoft_sync_plan_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- Seed the real plan from the verified export (docs/planner-exports/2025 CLIENTS
-- SCHEDULE.xlsx: Plan ID 1ZjZPTY4W02yLFfq1V7cYmUAAitG). Classified as a Client
-- Schedule source (matches EXACT_PLAN_MAPPINGS['2025 clients schedule']).
insert into public.microsoft_sync_plan_sources (plan_id, plan_name, kind, notes)
values ('1ZjZPTY4W02yLFfq1V7cYmUAAitG', '2025 CLIENTS SCHEDULE', 'client_schedule',
        'Verified from official Planner export 2026-06-29. Contains active client schedules incl. THE STAFFORDHIRE PUB → The Staffy.')
on conflict (plan_id) do nothing;
