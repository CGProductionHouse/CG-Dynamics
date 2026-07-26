-- ============================================================================
-- phase-28a — Durable Microsoft preview jobs
--
-- Replaces the single long-running microsoft-transition-sync fetch (which timed
-- out fetching all six Planner sources at once) with a durable, observable,
-- resumable job. Each configured source is a row with a bounded stage machine:
--   queued -> fetching_tasks -> fetching_details -> complete | failed
-- The Edge Function processes bounded units (one source's tasks, or a batch of
-- task details) per invocation and persists progress here, so the admin can poll
-- status, leave/return, and retry only failed sources. Records are persisted per
-- source and assembled into the snapshot once every required source completes.
--
-- Read-only toward Microsoft (fetch only). Additive + idempotent. RLS: admin only
-- (the Edge Function uses the service role; the admin page reads via the function).
-- ============================================================================

create table if not exists public.microsoft_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running'
    check (status in ('running', 'complete', 'failed', 'cancelled')),
  range_start text,
  range_end text,
  assignee_map jsonb not null default '{}'::jsonb,
  exported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.microsoft_sync_jobs is
  'Durable Microsoft preview jobs. One row per admin-triggered preview; sources are fetched in bounded batches by microsoft-transition-sync. Read-only toward Microsoft.';

create table if not exists public.microsoft_sync_job_sources (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.microsoft_sync_jobs(id) on delete cascade,
  position integer not null default 0,
  source_type text not null check (source_type in ('outlook_calendar', 'planner_plan')),
  source_id text not null,
  source_name text not null,
  required boolean not null default true,
  stage text not null default 'queued'
    check (stage in ('queued', 'fetching_tasks', 'fetching_details', 'complete', 'failed')),
  record_count integer not null default 0,
  complete boolean not null default false,
  safe_error text,
  records jsonb not null default '[]'::jsonb,
  pending_detail_ids jsonb not null default '[]'::jsonb,
  range_start text,
  range_end text,
  attempts integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (job_id, source_type, source_id)
);

comment on table public.microsoft_sync_job_sources is
  'Per-source state for a durable Microsoft preview job. Bounded stage machine + persisted records enable resume + retry-failed.';

create index if not exists idx_msjs_job on public.microsoft_sync_job_sources(job_id);
create index if not exists idx_msjs_stage on public.microsoft_sync_job_sources(job_id, stage);
create index if not exists idx_msj_created_by on public.microsoft_sync_jobs(created_by, status);

alter table public.microsoft_sync_jobs enable row level security;
alter table public.microsoft_sync_job_sources enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='microsoft_sync_jobs' and policyname='msj_admin_all') then
    create policy msj_admin_all on public.microsoft_sync_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='microsoft_sync_job_sources' and policyname='msjs_admin_all') then
    create policy msjs_admin_all on public.microsoft_sync_job_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;
