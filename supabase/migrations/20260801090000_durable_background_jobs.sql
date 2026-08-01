-- Durable background job queue for CG Assistant (APPLIED to production, migrations:
-- durable_background_jobs_queue + schedule_background_worker). Jobs persist in the
-- DB and are drained by a server-side worker Edge Function (background-worker)
-- invoked every minute by pg_cron + pg_net, so they continue after the app
-- closes. Atomic claim (FOR UPDATE SKIP LOCKED), retries with exponential
-- backoff, idempotency (unique key), progress, terminal state, and a
-- notification to the requester on finish. Worker RPCs are service_role-only;
-- enqueue is staff-gated. No hidden store, no privileged bypass.

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  progress int not null default 0,
  attempts int not null default 0,
  max_attempts int not null default 3,
  idempotency_key text unique,
  requested_by uuid references public.profiles(id) on delete set null,
  requested_by_name text,
  error text,
  locked_by text,
  locked_at timestamptz,
  run_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_bgjobs_claimable on public.background_jobs(status, run_after) where status = 'queued';
create index if not exists idx_bgjobs_requested_by on public.background_jobs(requested_by);

alter table public.background_jobs enable row level security;

drop policy if exists "bgjobs read own or manager" on public.background_jobs;
create policy "bgjobs read own or manager" on public.background_jobs
  for select to authenticated
  using (requested_by = auth.uid() or is_admin() or is_manager());

-- No direct insert/update/delete: staff enqueue and the worker transitions state
-- only through the SECURITY DEFINER RPCs (enqueue staff-gated; claim/progress/
-- complete/fail granted to service_role only). See migration
-- durable_background_jobs_queue for full function bodies.

-- Scheduler (migration schedule_background_worker):
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   cron 'cg-background-worker' every minute -> net.http_post(
--     '<project>.functions.supabase.co/functions/v1/background-worker', apikey = ANON)
-- The cron carries only the public anon key; the worker uses its own injected
-- service role to drain the queue.
