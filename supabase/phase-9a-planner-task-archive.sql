-- Phase 9A: allow imported Planner tasks to be removed from active production views
-- Do not run automatically. Apply in Supabase when ready.

alter table public.planner_tasks
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by_name text null,
  add column if not exists archive_reason text null;

create index if not exists idx_planner_tasks_archived
  on public.planner_tasks(archived_at)
  where archived_at is not null;
