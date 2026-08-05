-- Canonical task authority and duplicate reconciliation (PR 2).
--
-- THE STATED PREMISE WAS WRONG, and the evidence says so plainly.
--
-- The earlier audit counted 51 duplicate title groups and 4,015 surplus rows by
-- grouping on TITLE ALONE. Grouping on real evidence shows those are recurring
-- instances, not duplicates:
--
--   FACEBOOK GROUPS SHARE  486 rows / 486 distinct due dates  (daily)
--   RED OAK TV              49 rows /  48 distinct due dates  (weekly)
--
-- Deduplicating on title would have destroyed roughly 4,000 legitimate task
-- instances. Grouped on (title, client, board, bucket, due date) the true
-- picture is 4,250 groups from 4,264 active rows: 14 duplicate groups and 14
-- surplus rows.
--
-- Nothing is deleted. Duplicates are SUPERSEDED by pointer, keeping every row,
-- its Planner ids and its history.
--
-- Canonical winner per evidence group:
--   1. a row carrying a durable Microsoft/Planner id beats one without;
--   2. then microsoft_import beats teams_import;
--   3. then the earliest created row, so the original survives.

-- ── Supersession pointer ────────────────────────────────────────────────────
alter table public.planner_tasks
  add column if not exists superseded_by_task_id uuid references public.planner_tasks(id),
  add column if not exists superseded_reason text,
  add column if not exists superseded_at timestamptz;

comment on column public.planner_tasks.superseded_by_task_id is
  'Points at the canonical row for this logical task. Non-null means the row is retained for audit but must NOT appear in Work, My Work, Team Work, summaries, notifications or CG Assistant context.';

create index if not exists planner_tasks_superseded_idx
  on public.planner_tasks (superseded_by_task_id) where superseded_by_task_id is not null;
create index if not exists planner_tasks_canonical_active_idx
  on public.planner_tasks (archived_at, superseded_by_task_id) where archived_at is null and superseded_by_task_id is null;

-- ── Duplicate candidates needing a human ────────────────────────────────────
-- Same title and placement but DIFFERENT durable evidence (e.g. due dates a day
-- apart). These may or may not be one task; the rules do not know, so they stay
-- separate and visible rather than being merged on a guess.
create table if not exists public.task_duplicate_review (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  task_ids uuid[] not null,
  title text not null,
  reason text not null check (reason in ('near_duplicate_dates', 'cross_source_no_durable_id', 'conflicting_status')),
  detail text,
  status text not null default 'open' check (status in ('open', 'merged', 'kept_separate')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (group_key, reason)
);
alter table public.task_duplicate_review enable row level security;
alter table public.task_duplicate_review force row level security;
drop policy if exists task_duplicate_review_staff_read on public.task_duplicate_review;
create policy task_duplicate_review_staff_read on public.task_duplicate_review for select using (public.is_staff());
drop policy if exists task_duplicate_review_manager_write on public.task_duplicate_review;
create policy task_duplicate_review_manager_write on public.task_duplicate_review for all
  using (public.is_manager()) with check (public.is_manager());

-- ── The evidence key ────────────────────────────────────────────────────────
-- A durable Microsoft/Planner id IS the identity when present. Otherwise the
-- identity is the full placement of the work: title + client + board + bucket +
-- due date. Due date is deliberately part of the key — that is precisely what
-- separates a recurring instance from a duplicate.
create or replace function public.cg_task_evidence_key(
  p_title text, p_client_id uuid, p_board_id uuid, p_bucket_id uuid, p_due date, p_ms_task_id text
)
returns text language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_ms_task_id, '') <> '' then 'ms:' || p_ms_task_id
    else 'ev:' || upper(btrim(coalesce(p_title, ''))) || '|' || coalesce(p_client_id::text, '-') || '|' ||
         coalesce(p_board_id::text, '-') || '|' || coalesce(p_bucket_id::text, '-') || '|' || coalesce(p_due::text, '-')
  end;
$$;

-- ── Canonical operational view ──────────────────────────────────────────────
-- One row per logical task. Every consumer reads this instead of planner_tasks.
create or replace view public.planner_tasks_canonical as
  select t.*
    from public.planner_tasks t
   where t.archived_at is null
     and t.superseded_by_task_id is null;

comment on view public.planner_tasks_canonical is
  'Authoritative active task list: archived and superseded rows removed. Work, My Work, Team Work, summaries, notifications and CG Assistant must read this.';

grant select on public.planner_tasks_canonical to authenticated, service_role;

grant execute on function public.cg_task_evidence_key(text, uuid, uuid, uuid, date, text) to authenticated, service_role;
