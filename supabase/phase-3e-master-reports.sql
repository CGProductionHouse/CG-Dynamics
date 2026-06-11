-- ============================================================
-- CG Dynamics - Phase 3e Master monthly reports
-- Run this once in the Supabase SQL editor before testing Phase 3e.
--
-- Restructures reporting so each client has ONE master monthly
-- report (per client + month) that combines all platforms.
-- Platform-specific detail is split out using posts.platform.
-- ============================================================

-- 1. A master report is not tied to a single platform.
alter table reports alter column platform drop not null;

-- 2. Tag each snapshotted post with its source platform so the
--    master report can be split into Facebook / Instagram / TikTok
--    tabs on the client side (clients can only read `posts`, not
--    `imported_meta_posts`).
alter table posts add column if not exists platform text
  check (platform in ('facebook','instagram','tiktok'));

create index if not exists posts_report_platform_idx
  on posts (report_id, platform);

-- 3. Enforce one master report per client + month.
create unique index if not exists reports_master_unique
  on reports (client_id, period_start)
  where platform is null;
