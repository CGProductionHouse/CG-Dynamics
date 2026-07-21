-- ============================================================
-- Phase 18e: Marketing Library function hardening
--
-- Fixes the Supabase function_search_path_mutable advisories
-- for the two Marketing Library database functions by locking
-- their search_path to the empty schema. This prevents
-- untrusted schemas from being searched during function
-- execution.
--
-- Depends on phase-18a (update_marketing_library_updated_at)
-- and phase-18c (enforce_skill_card_activation_gate).
--
-- Idempotent — safe to re-run. Already applied to production.
--
-- Does not change Skill Card content, review state or
-- permissions.
-- ============================================================

alter function public.update_marketing_library_updated_at() set search_path = '';
alter function public.enforce_skill_card_activation_gate() set search_path = '';
