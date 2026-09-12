-- Native task archive fields for command_centre_tasks
-- Allows archiving stale Excel-imported tasks with no Microsoft identity
-- Part of #217 launch blocker resolution

alter table public.command_centre_tasks
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by_name text,
  add column if not exists archive_reason text;

-- Index for efficient active-only queries
create index if not exists command_centre_tasks_archived_at_idx
  on public.command_centre_tasks (archived_at)
  where archived_at is not null;

-- RLS policy: only admins can archive native tasks
-- (archive is a write operation; existing policies should cover this)
-- If needed, add explicit policy:
-- create policy "Admins can archive native tasks" on public.command_centre_tasks
--   for update using (is_admin());