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
-- 08:00 SAST = 06:00 UTC. 09:00 SAST = 07:00 UTC.
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
       '2026-06-29 06:00:00+00'::timestamptz,
       '2026-06-29 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00. Monday series 2026-06-29 to 2026-12-28.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-06-29 06:00:00+00'::timestamptz
);

-- 2026-07-06
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-06 06:00:00+00'::timestamptz,
       '2026-07-06 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-06 06:00:00+00'::timestamptz
);

-- 2026-07-13
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-13 06:00:00+00'::timestamptz,
       '2026-07-13 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-13 06:00:00+00'::timestamptz
);

-- 2026-07-20
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-20 06:00:00+00'::timestamptz,
       '2026-07-20 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-20 06:00:00+00'::timestamptz
);

-- 2026-07-27
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-07-27 06:00:00+00'::timestamptz,
       '2026-07-27 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-07-27 06:00:00+00'::timestamptz
);

-- 2026-08-03
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-03 06:00:00+00'::timestamptz,
       '2026-08-03 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-03 06:00:00+00'::timestamptz
);

-- 2026-08-10
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-10 06:00:00+00'::timestamptz,
       '2026-08-10 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-10 06:00:00+00'::timestamptz
);

-- 2026-08-17
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-17 06:00:00+00'::timestamptz,
       '2026-08-17 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-17 06:00:00+00'::timestamptz
);

-- 2026-08-24
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-24 06:00:00+00'::timestamptz,
       '2026-08-24 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-24 06:00:00+00'::timestamptz
);

-- 2026-08-31
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-08-31 06:00:00+00'::timestamptz,
       '2026-08-31 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-08-31 06:00:00+00'::timestamptz
);

-- 2026-09-07
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-07 06:00:00+00'::timestamptz,
       '2026-09-07 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-07 06:00:00+00'::timestamptz
);

-- 2026-09-14
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-14 06:00:00+00'::timestamptz,
       '2026-09-14 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-14 06:00:00+00'::timestamptz
);

-- 2026-09-21
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-21 06:00:00+00'::timestamptz,
       '2026-09-21 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-21 06:00:00+00'::timestamptz
);

-- 2026-09-28
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-09-28 06:00:00+00'::timestamptz,
       '2026-09-28 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-09-28 06:00:00+00'::timestamptz
);

-- 2026-10-05
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-05 06:00:00+00'::timestamptz,
       '2026-10-05 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-05 06:00:00+00'::timestamptz
);

-- 2026-10-12
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-12 06:00:00+00'::timestamptz,
       '2026-10-12 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-12 06:00:00+00'::timestamptz
);

-- 2026-10-19
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-19 06:00:00+00'::timestamptz,
       '2026-10-19 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-19 06:00:00+00'::timestamptz
);

-- 2026-10-26
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-10-26 06:00:00+00'::timestamptz,
       '2026-10-26 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-10-26 06:00:00+00'::timestamptz
);

-- 2026-11-02
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-02 06:00:00+00'::timestamptz,
       '2026-11-02 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-02 06:00:00+00'::timestamptz
);

-- 2026-11-09
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-09 06:00:00+00'::timestamptz,
       '2026-11-09 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-09 06:00:00+00'::timestamptz
);

-- 2026-11-16
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-16 06:00:00+00'::timestamptz,
       '2026-11-16 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-16 06:00:00+00'::timestamptz
);

-- 2026-11-23
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-23 06:00:00+00'::timestamptz,
       '2026-11-23 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-23 06:00:00+00'::timestamptz
);

-- 2026-11-30
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-11-30 06:00:00+00'::timestamptz,
       '2026-11-30 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-11-30 06:00:00+00'::timestamptz
);

-- 2026-12-07
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-07 06:00:00+00'::timestamptz,
       '2026-12-07 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-07 06:00:00+00'::timestamptz
);

-- 2026-12-14
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-14 06:00:00+00'::timestamptz,
       '2026-12-14 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-14 06:00:00+00'::timestamptz
);

-- 2026-12-21
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-21 06:00:00+00'::timestamptz,
       '2026-12-21 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-21 06:00:00+00'::timestamptz
);

-- 2026-12-28
insert into public.company_calendar_events (title, event_type, start_at, end_at, all_day, status, notes)
select 'MEETING - CG INTERNAL', 'meeting',
       '2026-12-28 06:00:00+00'::timestamptz,
       '2026-12-28 07:00:00+00'::timestamptz,
       false, 'planned',
       'Weekly Monday CG internal meeting. SAST 08:00–09:00.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CG INTERNAL' and start_at = '2026-12-28 06:00:00+00'::timestamptz
);


-- ── One-off events (screenshot-derived from Teams Calendar) ─────
-- All times SAST (UTC+2). Stored as UTC (timestamptz).
-- Source: Teams Calendar screenshot. Verify time/duration before applying.
-- Idempotency: WHERE NOT EXISTS (title, start_at). Safe to re-run.
-- client_id deliberately omitted — do not guess UUIDs.

-- 2026-06-29 10:00 SAST (08:00 UTC) — CONTENT RUN - LORACLOX (1h)
-- Note: 2026-06-29 Monday CG Internal meeting already seeded above; this is a different event.
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - LORACLOX', 'content_run', 'LORACLOX', 'TBC',
       '2026-06-29 08:00:00+00'::timestamptz,
       '2026-06-29 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - LORACLOX' and start_at = '2026-06-29 08:00:00+00'::timestamptz
);

-- 2026-06-30 09:30 SAST (07:30 UTC) — CASE - ONCE OFF (1h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CASE - ONCE OFF', 'client_event', 'CASE', 'CASE',
       '2026-06-30 07:30:00+00'::timestamptz,
       '2026-06-30 08:30:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CASE - ONCE OFF' and start_at = '2026-06-30 07:30:00+00'::timestamptz
);

-- 2026-06-30 12:00 SAST (10:00 UTC) — MEETING - JACO SMITH (1h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'MEETING - JACO SMITH', 'meeting', 'JAC SMITH FUNERALS', 'JAC SMITH FUNERALS',
       '2026-06-30 10:00:00+00'::timestamptz,
       '2026-06-30 11:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - JACO SMITH' and start_at = '2026-06-30 10:00:00+00'::timestamptz
);

-- 2026-07-01 11:30 SAST (09:30 UTC) — CONTENT RUN - MADISONS (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - MADISONS', 'content_run', 'MADISONS', 'Microsoft Teams Meeting',
       '2026-07-01 09:30:00+00'::timestamptz,
       '2026-07-01 11:30:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - MADISONS' and start_at = '2026-07-01 09:30:00+00'::timestamptz
);

-- 2026-07-02 08:00 SAST (06:00 UTC) — RED OAK - CONTENT RUN (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'RED OAK - CONTENT RUN', 'content_run', 'RED OAK', 'RED OAK',
       '2026-07-02 06:00:00+00'::timestamptz,
       '2026-07-02 08:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'RED OAK - CONTENT RUN' and start_at = '2026-07-02 06:00:00+00'::timestamptz
);

-- 2026-07-02 11:00 SAST (09:00 UTC) — CONTENT RUN - FIRST TECH (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - FIRST TECH', 'content_run', 'FIRST TECH', 'FIRST TECH',
       '2026-07-02 09:00:00+00'::timestamptz,
       '2026-07-02 11:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - FIRST TECH' and start_at = '2026-07-02 09:00:00+00'::timestamptz
);

-- 2026-07-03 09:00 SAST (07:00 UTC) — CONTENT RUN - SECURIFORCE (4h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - SECURIFORCE', 'content_run', 'SECURIFORCE', 'TBC',
       '2026-07-03 07:00:00+00'::timestamptz,
       '2026-07-03 11:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - SECURIFORCE' and start_at = '2026-07-03 07:00:00+00'::timestamptz
);

-- 2026-07-03 13:00 SAST (11:00 UTC) — CONTENT RUN - ECONOFOODS (1h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - ECONOFOODS', 'content_run', 'ECONOFOODS', 'ECONOFOODS',
       '2026-07-03 11:00:00+00'::timestamptz,
       '2026-07-03 12:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - ECONOFOODS' and start_at = '2026-07-03 11:00:00+00'::timestamptz
);

-- 2026-07-03 15:00 SAST (13:00 UTC) — MEETING - STAFF VRYFEES (1h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'MEETING - STAFF VRYFEES', 'meeting', 'Microsoft Teams Meeting',
       '2026-07-03 13:00:00+00'::timestamptz,
       '2026-07-03 14:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - STAFF VRYFEES' and start_at = '2026-07-03 13:00:00+00'::timestamptz
);

-- 2026-07-04 17:00 SAST (15:00 UTC) — CONTENT RUN - STAFFY (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - STAFFY', 'content_run', 'STAFFY', 'STAFFY',
       '2026-07-04 15:00:00+00'::timestamptz,
       '2026-07-04 17:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - STAFFY' and start_at = '2026-07-04 15:00:00+00'::timestamptz
);

-- 2026-07-06 10:00 SAST (08:00 UTC) — MEETING - CHENIQUE (1h)
-- Note: 2026-07-06 Monday CG Internal meeting already seeded above (07:00 UTC); this is a different event.
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'MEETING - CHENIQUE', 'meeting', 'CHENIQUE', 'CHENIQUE',
       '2026-07-06 08:00:00+00'::timestamptz,
       '2026-07-06 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - CHENIQUE' and start_at = '2026-07-06 08:00:00+00'::timestamptz
);

-- 2026-07-06 11:00 SAST (09:00 UTC) — MEETING - BOUWER & COETZEE (1h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'MEETING - BOUWER & COETZEE', 'meeting', 'IN STUDIO',
       '2026-07-06 09:00:00+00'::timestamptz,
       '2026-07-06 10:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'MEETING - BOUWER & COETZEE' and start_at = '2026-07-06 09:00:00+00'::timestamptz
);

-- 2026-07-07 09:00 SAST (07:00 UTC) — VRYFEES / UFS (10h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'VRYFEES', 'client_event', 'UFS', 'UFS',
       '2026-07-07 07:00:00+00'::timestamptz,
       '2026-07-07 17:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. UFS Vryfees event. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'VRYFEES' and start_at = '2026-07-07 07:00:00+00'::timestamptz
);

-- 2026-07-08 08:00 SAST (06:00 UTC) — VRYFEES / UFS (8h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'VRYFEES', 'client_event', 'UFS', 'UFS',
       '2026-07-08 06:00:00+00'::timestamptz,
       '2026-07-08 14:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. UFS Vryfees event. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'VRYFEES' and start_at = '2026-07-08 06:00:00+00'::timestamptz
);

-- 2026-07-09 09:00 SAST (07:00 UTC) — UFS - VRYFEES (8h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'UFS - VRYFEES', 'client_event', 'UFS', 'UFS',
       '2026-07-09 07:00:00+00'::timestamptz,
       '2026-07-09 15:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. UFS Vryfees event. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'UFS - VRYFEES' and start_at = '2026-07-09 07:00:00+00'::timestamptz
);

-- 2026-07-09 18:00 SAST (16:00 UTC) — BSN - MEETING (1h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'BSN - MEETING', 'meeting', 'BSN', 'KAI RESTAURANT',
       '2026-07-09 16:00:00+00'::timestamptz,
       '2026-07-09 17:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'BSN - MEETING' and start_at = '2026-07-09 16:00:00+00'::timestamptz
);

-- 2026-07-10 08:00 SAST (06:00 UTC) — VRYFEES / UFS (8h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'VRYFEES', 'client_event', 'UFS', 'UFS',
       '2026-07-10 06:00:00+00'::timestamptz,
       '2026-07-10 14:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. UFS Vryfees event. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'VRYFEES' and start_at = '2026-07-10 06:00:00+00'::timestamptz
);

-- 2026-07-11 08:00 SAST (06:00 UTC) — VRYFEES / UFS (10h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'VRYFEES', 'client_event', 'UFS', 'UFS',
       '2026-07-11 06:00:00+00'::timestamptz,
       '2026-07-11 16:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. UFS Vryfees event. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'VRYFEES' and start_at = '2026-07-11 06:00:00+00'::timestamptz
);

-- 2026-07-13 09:00 SAST (07:00 UTC) — PEYPER BONDS - CONTENT RUN (2h)
-- Note: 2026-07-13 Monday CG Internal meeting already seeded above (07:00 UTC);
-- the content run starts at the same UTC time but has a different title — unique by (title, start_at).
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'PEYPER BONDS - CONTENT RUN', 'content_run', 'PEYPER BONDS', 'PEYPER BONDS',
       '2026-07-13 07:00:00+00'::timestamptz,
       '2026-07-13 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'PEYPER BONDS - CONTENT RUN' and start_at = '2026-07-13 07:00:00+00'::timestamptz
);

-- 2026-07-14 08:00 SAST (06:00 UTC) — CONTENT RUN - WE AR FUELS (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - WE AR FUELS', 'content_run', 'WE AR FUELS', 'HERTZOGVILLE',
       '2026-07-14 06:00:00+00'::timestamptz,
       '2026-07-14 08:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - WE AR FUELS' and start_at = '2026-07-14 06:00:00+00'::timestamptz
);

-- 2026-07-18 09:00 SAST (07:00 UTC) — EVENT - PSG (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'EVENT - PSG', 'client_event', 'PSG', 'NASORG CENTRUM',
       '2026-07-18 07:00:00+00'::timestamptz,
       '2026-07-18 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'EVENT - PSG' and start_at = '2026-07-18 07:00:00+00'::timestamptz
);

-- 2026-07-21 19:00 SAST (17:00 UTC) — CONTENT RUN - STAFFY (1h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'CONTENT RUN - STAFFY', 'content_run', 'STAFFY', 'STAFFY',
       '2026-07-21 17:00:00+00'::timestamptz,
       '2026-07-21 18:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CONTENT RUN - STAFFY' and start_at = '2026-07-21 17:00:00+00'::timestamptz
);

-- 2026-07-23 16:00 SAST (14:00 UTC) — CAPTAINS CUP - REGISTRATION (1h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'CAPTAINS CUP - REGISTRATION', 'client_event', 'BLOEM BAAN',
       '2026-07-23 14:00:00+00'::timestamptz,
       '2026-07-23 15:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CAPTAINS CUP - REGISTRATION' and start_at = '2026-07-23 14:00:00+00'::timestamptz
);

-- 2026-07-24 09:00 SAST (07:00 UTC) — CAPTAINS CUP (2h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'CAPTAINS CUP', 'client_event', 'BLOEM BAAN',
       '2026-07-24 07:00:00+00'::timestamptz,
       '2026-07-24 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CAPTAINS CUP' and start_at = '2026-07-24 07:00:00+00'::timestamptz
);

-- 2026-07-25 09:00 SAST (07:00 UTC) — CAPTAINS CUP (2h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'CAPTAINS CUP', 'client_event', 'BLOEM BAAN',
       '2026-07-25 07:00:00+00'::timestamptz,
       '2026-07-25 09:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'CAPTAINS CUP' and start_at = '2026-07-25 07:00:00+00'::timestamptz
);

-- 2026-09-01 08:00 SAST (06:00 UTC) — ECONOFOODS - GOLF DAY / CAPE TOWN (7h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'ECONOFOODS - GOLF DAY / CAPE TOWN', 'client_event', 'ECONOFOODS', 'DURBANVILLE',
       '2026-09-01 06:00:00+00'::timestamptz,
       '2026-09-01 13:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'ECONOFOODS - GOLF DAY / CAPE TOWN' and start_at = '2026-09-01 06:00:00+00'::timestamptz
);

-- 2026-09-02 14:00 SAST (12:00 UTC) — 30TH BIRTHDAY GALA - ECONOFOODS (2h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select '30TH BIRTHDAY GALA - ECONOFOODS', 'client_event', 'ECONOFOODS', 'CAPE TOWN / DURBANVILLE',
       '2026-09-02 12:00:00+00'::timestamptz,
       '2026-09-02 14:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = '30TH BIRTHDAY GALA - ECONOFOODS' and start_at = '2026-09-02 12:00:00+00'::timestamptz
);

-- 2026-09-26 12:00 SAST (10:00 UTC) — EVENT - TROUE CHANE (5h) | Amonique Fourie
insert into public.company_calendar_events (title, event_type, location, assigned_to_name, start_at, end_at, all_day, status, notes)
select 'EVENT - TROUE CHANE', 'client_event', 'TBC', 'Amonique Fourie',
       '2026-09-26 10:00:00+00'::timestamptz,
       '2026-09-26 15:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'EVENT - TROUE CHANE' and start_at = '2026-09-26 10:00:00+00'::timestamptz
);

-- 2026-10-17 09:00 SAST (07:00 UTC) — WEDDING - LANE (8h)
insert into public.company_calendar_events (title, event_type, location, start_at, end_at, all_day, status, notes)
select 'WEDDING - LANE', 'client_event', 'ORANJE GASTEPLAAS',
       '2026-10-17 07:00:00+00'::timestamptz,
       '2026-10-17 15:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'WEDDING - LANE' and start_at = '2026-10-17 07:00:00+00'::timestamptz
);

-- 2026-11-27 10:00 SAST (08:00 UTC) — GOLF DAY - WISEMAN GROUP (4h)
insert into public.company_calendar_events (title, event_type, client_name, location, start_at, end_at, all_day, status, notes)
select 'GOLF DAY - WISEMAN GROUP', 'client_event', 'WISEMAN GROUP', 'BLOEM BAAN',
       '2026-11-27 08:00:00+00'::timestamptz,
       '2026-11-27 12:00:00+00'::timestamptz,
       false, 'planned',
       'Screenshot-derived from Teams Calendar. Verify time/duration.'
where not exists (
  select 1 from public.company_calendar_events
  where title = 'GOLF DAY - WISEMAN GROUP' and start_at = '2026-11-27 08:00:00+00'::timestamptz
);


-- ── Seed summary ────────────────────────────────────────────────
-- Total events in this file:            57
-- Monday CG Internal meetings:          27 (2026-06-29 to 2026-12-28, SAST 08:00–09:00)
-- One-off screenshot-derived events:    30 (active INSERTs, source: Teams Calendar)
-- SQL applied live:                     NO — review in Supabase SQL editor first
-- ============================================================
