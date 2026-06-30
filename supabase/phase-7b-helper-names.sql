-- ============================================================
-- Phase 7B: Task Helper Names
-- Adds helper_names text[] to command_centre_tasks, planner_tasks,
-- and monthly_deliverables to support collaborative assignments.
--
-- NOT applied. Run in Supabase SQL editor when ready.
--
-- After applying:
--   - addTaskHelperName / removeTaskHelperName in commandCentre.ts
--   - addPlannerHelperName / removePlannerHelperName in planner.ts
--   - addDeliverableHelperName / removeDeliverableHelperName in planner.ts
--   All become active and the drawer helper chips will live-update.
-- ============================================================

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'command_centre_tasks'
      and column_name  = 'helper_names'
  ) then
    alter table public.command_centre_tasks
      add column helper_names text[] not null default '{}';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'planner_tasks'
      and column_name  = 'helper_names'
  ) then
    alter table public.planner_tasks
      add column helper_names text[] not null default '{}';
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'monthly_deliverables'
      and column_name  = 'helper_names'
  ) then
    alter table public.monthly_deliverables
      add column helper_names text[] not null default '{}';
  end if;
end $$;
