-- ============================================================
-- Phase 13a: Recurring planner tasks (foundation)
--
-- Adds recurrence template/instance support to planner_tasks per
-- docs/recurring-tasks-and-microsoft-import.md.
--
-- Model:
--   * A TEMPLATE row has recurrence_rule set (e.g. FREQ=WEEKLY;BYDAY=MO)
--     and never appears in task lists itself.
--   * INSTANCES are materialised on view for a capped window (today ->
--     +14 days) with recurrence_parent_id pointing at the template.
--   * Idempotency: instances are inserted with a deterministic
--     import_hash ('rec-<template-id>-<due-date>'), and import_hash is
--     already unique on planner_tasks — re-materialising is a no-op.
--     The partial index below adds a second guard at the model level.
--
-- DO NOT RUN LIVE without review in the Supabase SQL editor.
-- Additive only: no data is modified or deleted.
-- ============================================================

alter table public.planner_tasks
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_parent_id uuid references public.planner_tasks(id) on delete cascade,
  add column if not exists recurrence_until date;

-- One instance per template per day — the anti-runaway guard.
create unique index if not exists planner_tasks_recurrence_instance_key
  on public.planner_tasks (recurrence_parent_id, due_date)
  where recurrence_parent_id is not null;

-- Fast template lookup for materialisation.
create index if not exists planner_tasks_recurrence_templates_idx
  on public.planner_tasks (recurrence_rule)
  where recurrence_rule is not null and archived_at is null;

comment on column public.planner_tasks.recurrence_rule is
  'RRULE subset for templates: FREQ=DAILY|WEEKLY|MONTHLY, optional INTERVAL, BYDAY (MO..SU), BYMONTHDAY (1-28). Null on normal tasks and instances.';
comment on column public.planner_tasks.recurrence_parent_id is
  'Set on materialised instances; points at the recurrence template row.';

-- ── Verification (after applying) ─────────────────────────────
-- Create a weekly Monday template (adjust board/bucket ids):
--   insert into public.planner_tasks (board_id, bucket_id, title, status,
--     priority, source, import_hash, recurrence_rule)
--   values ('<board>', '<bucket>', 'Weekly content run', 'to_do', 'normal',
--     'manual', 'rec-template-weekly-content-run', 'FREQ=WEEKLY;BYDAY=MO');
-- Then open Planner Board in the app twice — instances for the next two
-- Mondays should exist exactly once each.
-- ============================================================
