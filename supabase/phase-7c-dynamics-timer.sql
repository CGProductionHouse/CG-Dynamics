-- ============================================================
-- Phase 7C: Dynamics Timer — Time Sessions
-- Adds dynamics_time_sessions table so staff can track work
-- time inside CG Dynamics without touching CG Hours.
--
-- NOT applied. Run in Supabase SQL editor when ready.
--
-- After applying, wire addPlannerHelperName / addTaskHelperName
-- to the active Start/Pause/Stop buttons in the drawers.
--
-- Verify after applying:
--   select count(*) from public.dynamics_time_sessions;
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name   = 'dynamics_time_sessions'
--   order by ordinal_position;
-- ============================================================

create table if not exists public.dynamics_time_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  source_type     text not null
                  check (source_type in ('daily_task', 'planner_task', 'monthly_deliverable')),
  source_id       uuid not null,
  client_id       uuid references public.clients(id) on delete set null,
  client_name     text,
  task_title      text not null,
  bucket_name     text,
  status          text not null default 'running'
                  check (status in ('running', 'paused', 'stopped')),
  started_at      timestamptz not null default now(),
  paused_at       timestamptz,
  stopped_at      timestamptz,
  elapsed_seconds integer not null default 0,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_dynamics_time_sessions_updated_at on public.dynamics_time_sessions;
create trigger trg_dynamics_time_sessions_updated_at
  before update on public.dynamics_time_sessions
  for each row execute function public.update_planner_updated_at();


-- ── Indexes ───────────────────────────────────────────────────

create index if not exists idx_time_sessions_user
  on public.dynamics_time_sessions(user_id);

create index if not exists idx_time_sessions_source
  on public.dynamics_time_sessions(source_type, source_id);

create index if not exists idx_time_sessions_status
  on public.dynamics_time_sessions(status)
  where status != 'stopped';

create index if not exists idx_time_sessions_started
  on public.dynamics_time_sessions(started_at desc);


-- ── RLS ──────────────────────────────────────────────────────

alter table public.dynamics_time_sessions enable row level security;

-- Each user can read their own sessions; admin can read all.
drop policy if exists "time_sessions: own select" on public.dynamics_time_sessions;
create policy "time_sessions: own select"
  on public.dynamics_time_sessions for select
  using (
    is_staff()
    and (user_id = auth.uid() or is_admin())
  );

-- Staff can only insert their own sessions.
drop policy if exists "time_sessions: own insert" on public.dynamics_time_sessions;
create policy "time_sessions: own insert"
  on public.dynamics_time_sessions for insert
  with check (
    is_staff()
    and user_id = auth.uid()
  );

-- Staff can only update their own sessions.
drop policy if exists "time_sessions: own update" on public.dynamics_time_sessions;
create policy "time_sessions: own update"
  on public.dynamics_time_sessions for update
  using (
    is_staff()
    and user_id = auth.uid()
  );

-- Admin can delete any session (cleanup/correction).
drop policy if exists "time_sessions: admin delete" on public.dynamics_time_sessions;
create policy "time_sessions: admin delete"
  on public.dynamics_time_sessions for delete
  using (is_admin());
