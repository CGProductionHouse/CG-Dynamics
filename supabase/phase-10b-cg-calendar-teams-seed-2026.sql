-- ============================================================
-- Phase 10b: CG Calendar Teams Seed 2026
-- Weekly internal CG meeting series + one-off events.
--
-- DO NOT RUN LIVE without review.
-- Review in Supabase SQL editor → Dry-run mode (read the SELECT
-- version) before executing INSERTs.
--
-- Timezone: Africa/Johannesburg (SAST = UTC+2).
-- All start_at / end_at stored as UTC (timestamptz).
-- 09:00 SAST = 07:00 UTC. 10:00 SAST = 08:00 UTC.
--
-- Monday series: every Monday 2026-06-29 to 2026-12-28 (27 meetings).
-- The 2026-06-29 date is included only once (first Monday in series).
--
-- One-off events: placeholder section below — requires screenshot
-- review before enabling. See "One-off events" section.
--
-- Idempotency: each INSERT uses NOT EXISTS on (title, start_at)
-- so re-running is safe.
-- ============================================================


-- ── Monday recurring series: MEETING - CG INTERNAL ───────────────

-- 2026-06-29 (series start — also a one-off date, included once only)
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-06-29 07:00:00+00'::timestamptz,
       '2026-06-29 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00. Monday series 2026-06-29 to 2026-12-28.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-06-29 07:00:00+00'::timestamptz
);

-- 2026-07-06
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-06 07:00:00+00'::timestamptz,
       '2026-07-06 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-06 07:00:00+00'::timestamptz
);

-- 2026-07-13
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-13 07:00:00+00'::timestamptz,
       '2026-07-13 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-13 07:00:00+00'::timestamptz
);

-- 2026-07-20
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-20 07:00:00+00'::timestamptz,
       '2026-07-20 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-20 07:00:00+00'::timestamptz
);

-- 2026-07-27
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-27 07:00:00+00'::timestamptz,
       '2026-07-27 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-27 07:00:00+00'::timestamptz
);

-- 2026-08-03
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-03 07:00:00+00'::timestamptz,
       '2026-08-03 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-03 07:00:00+00'::timestamptz
);

-- 2026-08-10
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-10 07:00:00+00'::timestamptz,
       '2026-08-10 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-10 07:00:00+00'::timestamptz
);

-- 2026-08-17
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-17 07:00:00+00'::timestamptz,
       '2026-08-17 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-17 07:00:00+00'::timestamptz
);

-- 2026-08-24
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-24 07:00:00+00'::timestamptz,
       '2026-08-24 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-24 07:00:00+00'::timestamptz
);

-- 2026-08-31
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-31 07:00:00+00'::timestamptz,
       '2026-08-31 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-31 07:00:00+00'::timestamptz
);

-- 2026-09-07
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-07 07:00:00+00'::timestamptz,
       '2026-09-07 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-07 07:00:00+00'::timestamptz
);

-- 2026-09-14
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-14 07:00:00+00'::timestamptz,
       '2026-09-14 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-14 07:00:00+00'::timestamptz
);

-- 2026-09-21
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-21 07:00:00+00'::timestamptz,
       '2026-09-21 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-21 07:00:00+00'::timestamptz
);

-- 2026-09-28
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-28 07:00:00+00'::timestamptz,
       '2026-09-28 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-28 07:00:00+00'::timestamptz
);

-- 2026-10-05
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-05 07:00:00+00'::timestamptz,
       '2026-10-05 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-05 07:00:00+00'::timestamptz
);

-- 2026-10-12
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-12 07:00:00+00'::timestamptz,
       '2026-10-12 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-12 07:00:00+00'::timestamptz
);

-- 2026-10-19
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-19 07:00:00+00'::timestamptz,
       '2026-10-19 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-19 07:00:00+00'::timestamptz
);

-- 2026-10-26
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-26 07:00:00+00'::timestamptz,
       '2026-10-26 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-26 07:00:00+00'::timestamptz
);

-- 2026-11-02
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-02 07:00:00+00'::timestamptz,
       '2026-11-02 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-02 07:00:00+00'::timestamptz
);

-- 2026-11-09
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-09 07:00:00+00'::timestamptz,
       '2026-11-09 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-09 07:00:00+00'::timestamptz
);

-- 2026-11-16
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-16 07:00:00+00'::timestamptz,
       '2026-11-16 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-16 07:00:00+00'::timestamptz
);

-- 2026-11-23
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-23 07:00:00+00'::timestamptz,
       '2026-11-23 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-23 07:00:00+00'::timestamptz
);

-- 2026-11-30
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-30 07:00:00+00'::timestamptz,
       '2026-11-30 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-30 07:00:00+00'::timestamptz
);

-- 2026-12-07
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-07 07:00:00+00'::timestamptz,
       '2026-12-07 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-07 07:00:00+00'::timestamptz
);

-- 2026-12-14
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-14 07:00:00+00'::timestamptz,
       '2026-12-14 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-14 07:00:00+00'::timestamptz
);

-- 2026-12-21
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-21 07:00:00+00'::timestamptz,
       '2026-12-21 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-21 07:00:00+00'::timestamptz
);

-- 2026-12-28
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-28 07:00:00+00'::timestamptz,
       '2026-12-28 08:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 09:00–10:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-28 07:00:00+00'::timestamptz
);


-- ── One-off events (screenshot-derived) ─────────────────────────
-- REVIEW REQUIRED before enabling.
-- The events below were derived from a screenshot of the 2026 H2 calendar.
-- Uncomment and adjust dates/titles after confirming against the actual screenshot.
-- Idempotency: same NOT EXISTS pattern as above.
--
-- Example format (replace with real screenshot events):
--
-- insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
-- select 'CG TEAM STRATEGY SESSION', 'meeting',
--        '2026-08-03 07:00:00+00'::timestamptz,
--        '2026-08-03 10:00:00+00'::timestamptz,
--        false, 'planned',
--        'Screenshot-derived: half-year strategy session. Review date before applying.'
-- where not exists (
--   select 1 from public.company_calendar_events
--   where title = 'CG TEAM STRATEGY SESSION' and start_at = '2026-08-03 07:00:00+00'::timestamptz
-- );
--
-- insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
-- select 'CLIENT SHOOT DAY', 'shoot',
--        '2026-09-15 05:00:00+00'::timestamptz,
--        '2026-09-15 12:00:00+00'::timestamptz,
--        false, 'planned',
--        'Screenshot-derived: full-day client shoot. Confirm client and location before applying.'
-- where not exists (
--   select 1 from public.company_calendar_events
--   where title = 'CLIENT SHOOT DAY' and start_at = '2026-09-15 05:00:00+00'::timestamptz
-- );


-- ── Seed summary ────────────────────────────────────────────────
-- Total events in this file:            27 (Monday series, active)
-- Monday CG Internal meetings:          27 (2026-06-29 to 2026-12-28)
-- One-off screenshot-derived events:     0 active (commented placeholder above)
-- SQL applied live:                      NO — review in Supabase SQL editor first
-- ============================================================
