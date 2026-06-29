-- ============================================================
-- Phase 6B: CG Planner Seed Data
-- Seeds base boards and buckets only.
-- Does NOT insert tasks, packages, or deliverables.
--
-- Idempotent — safe to run multiple times.
-- Requires phase-6-cg-planner-core.sql to have been run first.
--
-- Bucket names based on real Teams Planner exports:
--   To Do.xlsx, Client Websites.xlsx, ADMIN CHECK LIST.xlsx
--   2025 CLIENTS SCHEDULE.xlsx
--
-- Run via Supabase SQL editor:
--   psql $SUPABASE_DB_URL -f supabase/phase-6b-cg-planner-seed.sql
-- ============================================================


-- ── 1. BOARDS ────────────────────────────────────────────────

insert into public.planner_boards (name, slug, board_type, visibility, description, sort_order) values
  ('Operations / To Do', 'operations-todo', 'operations', 'staff',
   'Daily tasks, client requests, graphic design, websites, content guides and once-off items.', 1),
  ('Client Websites', 'client-websites', 'websites', 'staff',
   'New website requests, monthly updates, maintenance, Google Business Profiles and background sites.', 2),
  ('Admin Check List', 'admin-check-list', 'admin', 'admin_only',
   'Admin-only daily, weekly and monthly tasks. Payroll, checking, social platforms and additional admin.', 3),
  ('Client Schedule', 'client-schedule', 'client_schedule', 'staff',
   'Client package calendar. Monthly deliverables, approvals and scheduling for all clients.', 4),
  ('CG Socials', 'cg-socials', 'cg_socials', 'public_internal',
   'CG''s own content schedule, studio schedule, content runs and internal posts.', 5)
on conflict (slug) do nothing;


-- ── 2. BUCKETS ───────────────────────────────────────────────

-- Operations / To Do (from To Do.xlsx export)
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'CG ADMIN - RECURRING', 'admin', 1
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'CG ADMIN - RECURRING');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'CLIENT REQUESTS', 'client_requests', 2
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'CLIENT REQUESTS');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'GRAPHIC DESIGN', 'graphic_design', 3
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'GRAPHIC DESIGN');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'ADMIN / TO DO', 'admin', 4
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'ADMIN / TO DO');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'WEBSITES', 'websites', 5
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'WEBSITES');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'CONTENT GUIDES', 'content_guides', 6
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'CONTENT GUIDES');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'ONCE-OFF', 'once_off', 7
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'ONCE-OFF');

-- Client Websites (from Client Websites.xlsx export)
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'NEW WEBSITES / REQUESTS', 'websites', 1
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'NEW WEBSITES / REQUESTS');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'MONTHLY UPDATES', 'websites', 2
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'MONTHLY UPDATES');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'WEBSITES MAINTENANCE', 'websites', 3
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'WEBSITES MAINTENANCE');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'GOOGLE BUSINESS PROFILES', 'websites', 4
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'GOOGLE BUSINESS PROFILES');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'BACKGROUND SITES (OLD CLIENTS)', 'other', 5
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'BACKGROUND SITES (OLD CLIENTS)');

-- Admin Check List (from ADMIN CHECK LIST.xlsx export)
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'DAILY', 'daily', 1
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'DAILY');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'WEEKLY', 'weekly', 2
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'WEEKLY');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'MONTHLY', 'monthly', 3
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'MONTHLY');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'INSTAGRAM NOT CONNECTED', 'default', 4
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'INSTAGRAM NOT CONNECTED');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'TIKTOK PAGES', 'default', 5
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'TIKTOK PAGES');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'LINKDIN', 'default', 6
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'LINKDIN');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'ADDITIONAL ADMIN', 'admin', 7
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'ADDITIONAL ADMIN');

-- Client Schedule (from 2025 CLIENTS SCHEDULE.xlsx export)
-- The real Planner export uses client names as buckets (43 clients).
-- These should be dynamically generated from active client_packages,
-- not statically seeded here.
--
-- Scheduled / Unscheduled / Waiting Approval / Client Requests
-- are STATUSES and VIEWS, not primary buckets.
-- They will be implemented as view filters in the Planner UI.
--
-- See architecture doc section "Real Planner export findings"
-- for the correct model: Package Master View → Monthly Bucket View → Calendar View.

-- CG Socials (kept from original — no export available yet)
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'CG Schedule', 'cg_socials', 1
from public.planner_boards where slug = 'cg-socials'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'CG Schedule');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'CG Studio Schedule', 'cg_socials', 2
from public.planner_boards where slug = 'cg-socials'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'CG Studio Schedule');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Content Runs', 'cg_socials', 3
from public.planner_boards where slug = 'cg-socials'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Content Runs');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Internal Posts', 'cg_socials', 4
from public.planner_boards where slug = 'cg-socials'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Internal Posts');
