-- ============================================================
-- CG Dynamics - Phase 3j client package settings + report strategy data
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- Adds:
--   clients.package_settings  - monthly deliverables package (JSONB)
--   reports.strategy_data     - guided strategy engine structured data (JSONB)
--
-- No RLS changes are needed: both columns inherit their table's existing
-- policies. Existing rows default to an empty package / null strategy and keep
-- working unchanged. The app reads these columns defensively, so it continues
-- to function before this migration is applied; package + structured strategy
-- saving simply activates once the columns exist.
-- ============================================================

alter table public.clients
  add column if not exists package_settings jsonb not null default '{}'::jsonb;

alter table public.reports
  add column if not exists strategy_data jsonb;

comment on column public.clients.package_settings is
  'Monthly deliverables package: professional_videos_per_month, reels_per_month, photo_posts_per_month, design_posters_per_month, animated_posters_per_month, campaign_management_included, monthly_campaign_budget, shoot_days_per_month, package_notes.';

comment on column public.reports.strategy_data is
  'Guided strategy engine structured data: client direction, top content insight, strategy going forward, action plan and client actions. Selected option labels are stored here so old reports are unaffected when the global option library changes.';
