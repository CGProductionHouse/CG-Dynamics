-- ============================================================
-- Phase 19f: Unify existing CG Calendar Content Runs with Content Workflow
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- Additive and idempotent. The CG Calendar already holds real Content Run
-- events in public.company_calendar_events (event_type = 'content_run'); the
-- Phase 19d public.content_runs table is separate and empty. This migration
-- gives a Content Run ONE shared identity across both surfaces by:
--   1. adding content_runs.calendar_event_id (FK -> company_calendar_events),
--   2. enforcing at most one non-cancelled run per calendar event, and
--   3. backfilling every existing non-cancelled 'content_run' calendar event
--      into content_runs exactly once (safe to re-run).
--
-- No existing table is dropped or rewritten; no calendar event is modified.
-- Re-running this file creates no duplicate runs (the backfill is guarded by
-- `not exists`, and the column/index adds use `if not exists`).
--
-- Depends on: public.content_runs (phase-19d),
-- public.company_calendar_events (phase-10a).
-- ============================================================

-- ── 1. LINK COLUMN ───────────────────────────────────────────────────────────
-- A Content Run may own a calendar event (its shared identity). on delete set
-- null so removing a calendar event never hard-deletes the operational run.
alter table public.content_runs
  add column if not exists calendar_event_id uuid
    references public.company_calendar_events(id) on delete set null;

comment on column public.content_runs.calendar_event_id is
  'The CG Calendar event that shares this run''s identity (name/client/date/time/location/status are calendar-owned). Null for legacy runs with no calendar event.';

-- ── 2. ONE RUN PER CALENDAR EVENT ────────────────────────────────────────────
-- A calendar event links to at most one non-cancelled Content Run. Cancelled
-- runs are excluded so a cancelled run never blocks re-linking, and null
-- calendar_event_id (legacy/standalone runs) is unconstrained.
create unique index if not exists uniq_content_run_calendar_event
  on public.content_runs (calendar_event_id)
  where calendar_event_id is not null and status <> 'cancelled';

-- Lookup by calendar event (used to open a run from the CG Calendar).
create index if not exists idx_content_runs_calendar_event
  on public.content_runs (calendar_event_id);

-- ── 3. BACKFILL EXISTING CALENDAR CONTENT RUNS ───────────────────────────────
-- Every non-cancelled calendar Content Run that is not already linked becomes a
-- Content Run. run_date/start_time use the Johannesburg business day so the run
-- reads the same date/time staff see on the calendar. Calendar status maps
-- conservatively to the run lifecycle. `not exists` makes reruns a no-op.
insert into public.content_runs (
  calendar_event_id,
  client_id,
  client_name,
  name,
  run_date,
  start_time,
  location,
  lead_name,
  status
)
select
  e.id,
  e.client_id,
  e.client_name,
  e.title,
  (e.start_at at time zone 'Africa/Johannesburg')::date,
  (e.start_at at time zone 'Africa/Johannesburg')::time,
  e.location,
  e.assigned_to_name,
  case e.status
    when 'planned'   then 'planning'
    when 'confirmed' then 'ready'
    when 'completed' then 'completed'
    when 'cancelled' then 'cancelled'
    else 'planning'
  end
from public.company_calendar_events e
where e.event_type = 'content_run'
  and e.status <> 'cancelled'
  and not exists (
    select 1 from public.content_runs cr
    where cr.calendar_event_id = e.id
  );

-- ── Verification (run manually after applying) ───────────────────────────────
-- -- Column + FK present:
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='content_runs'
--     and column_name='calendar_event_id';
-- -- Every non-cancelled calendar content_run now has exactly one linked run:
-- select count(*) as calendar_runs
--   from public.company_calendar_events
--   where event_type='content_run' and status <> 'cancelled';
-- select count(*) as linked_runs
--   from public.content_runs where calendar_event_id is not null;
-- -- No duplicate link (re-running the file must not change these counts):
-- select calendar_event_id, count(*) from public.content_runs
--   where calendar_event_id is not null and status <> 'cancelled'
--   group by calendar_event_id having count(*) > 1;  -- expect zero rows
-- ============================================================
