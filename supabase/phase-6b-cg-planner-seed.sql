-- ============================================================
-- Phase 6B: CG Planner Seed Data
-- Seeds base boards and buckets only.
-- Does NOT insert tasks, packages, or deliverables.
--
-- Idempotent — safe to run multiple times.
-- Requires phase-6-cg-planner-core.sql to have been run first.
--
-- Run via Supabase SQL editor:
--   psql $SUPABASE_DB_URL -f supabase/phase-6b-cg-planner-seed.sql
-- ============================================================


-- ── 1. BOARDS ────────────────────────────────────────────────

insert into public.planner_boards (name, slug, board_type, visibility, description, sort_order) values
  ('Operations / To Do', 'operations-todo', 'operations', 'staff',
   'Daily tasks, client requests, graphic design, video, websites, content guides and once-off items.', 1),
  ('Client Websites', 'client-websites', 'websites', 'staff',
   'New website requests, monthly updates, maintenance, Google Business Profiles and background sites.', 2),
  ('Admin Check List', 'admin-check-list', 'admin', 'admin_only',
   'Admin-only daily, weekly and monthly tasks. Payroll, checking, financial and social checks.', 3),
  ('Client Schedule', 'client-schedule', 'client_schedule', 'staff',
   'Client package calendar. Monthly deliverables, approvals and scheduling for all clients.', 4),
  ('CG Socials', 'cg-socials', 'cg_socials', 'public_internal',
   'CG''s own content schedule, studio schedule, content runs and internal posts.', 5)
on conflict (slug) do nothing;


-- ── 2. BUCKETS ───────────────────────────────────────────────

-- Operations / To Do buckets
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Client Requests', 'client_requests', 1
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Client Requests');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Graphic Design', 'graphic_design', 2
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Graphic Design');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Video', 'video', 3
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Video');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Websites', 'websites', 4
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Websites');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Admin / To Do', 'admin', 5
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Admin / To Do');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Content Guides', 'content_guides', 6
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Content Guides');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Once-Off', 'once_off', 7
from public.planner_boards where slug = 'operations-todo'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Once-Off');

-- Client Websites buckets
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'New Websites / Requests', 'websites', 1
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'New Websites / Requests');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Monthly Updates', 'websites', 2
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Monthly Updates');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Website Maintenance', 'websites', 3
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Website Maintenance');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Google Business Profiles', 'websites', 4
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Google Business Profiles');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Background Sites', 'other', 5
from public.planner_boards where slug = 'client-websites'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Background Sites');

-- Admin Check List buckets
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Daily', 'daily', 1
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Daily');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Weekly', 'weekly', 2
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Weekly');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Monthly', 'monthly', 3
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Monthly');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Social Checks', 'checking', 4
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Social Checks');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Client Check-ins', 'checking', 5
from public.planner_boards where slug = 'admin-check-list'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Client Check-ins');

-- Client Schedule buckets
insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Scheduled', 'default', 1
from public.planner_boards where slug = 'client-schedule'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Scheduled');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Unscheduled', 'default', 2
from public.planner_boards where slug = 'client-schedule'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Unscheduled');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Client Requests', 'client_requests', 3
from public.planner_boards where slug = 'client-schedule'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Client Requests');

insert into public.planner_buckets (board_id, name, bucket_type, sort_order)
select id, 'Waiting Approval', 'default', 4
from public.planner_boards where slug = 'client-schedule'
and not exists (select 1 from public.planner_buckets where board_id = planner_boards.id and name = 'Waiting Approval');

-- CG Socials buckets
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
