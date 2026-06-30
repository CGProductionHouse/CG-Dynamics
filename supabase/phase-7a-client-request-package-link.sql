-- ============================================================
-- Phase 7A: Client request package link fields
--
-- Adds package classification fields to command_centre_tasks so
-- admin can link a client request task to a monthly deliverable
-- and classify it as: use_slot / addon / move_work.
--
-- deliverable_id was already added to the DB by phase-6 (conditional
-- alter table). This migration adds the classification columns only.
--
-- NOT APPLIED YET. Review docs/client-request-package-workflow.md
-- before running.
-- ============================================================

-- package_action: how admin classifies this request vs the client package.
--   use_slot  = request fills an existing package deliverable slot
--   addon     = request is extra work beyond the package (flag quote_needed)
--   move_work = a package deliverable is being moved to another month
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'command_centre_tasks'
      and column_name  = 'package_action'
  ) then
    alter table public.command_centre_tasks
      add column package_action text
        check (package_action in ('use_slot', 'addon', 'move_work'));
  end if;
end; $$;

-- quote_needed: true when an add-on request has not yet been quoted.
-- Surfaced in the Monthly Planner usage summary so Amonique can track
-- un-quoted extras before they become silent freebies.
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'command_centre_tasks'
      and column_name  = 'quote_needed'
  ) then
    alter table public.command_centre_tasks
      add column quote_needed boolean not null default false;
  end if;
end; $$;

-- admin_package_note: short admin reason for the classification.
-- Example: "Client asked for holiday poster — linking to DP2"
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'command_centre_tasks'
      and column_name  = 'admin_package_note'
  ) then
    alter table public.command_centre_tasks
      add column admin_package_note text;
  end if;
end; $$;

-- Indexes for package action lookups (e.g. "all addon requests for client X")
create index if not exists idx_command_centre_tasks_package_action
  on public.command_centre_tasks(package_action)
  where package_action is not null;

create index if not exists idx_command_centre_tasks_quote_needed
  on public.command_centre_tasks(quote_needed)
  where quote_needed = true;

-- ── RLS note ──────────────────────────────────────────────────
-- The existing staff update policy on command_centre_tasks allows
-- all staff to update tasks they can see. These new columns are
-- admin-only fields (set via Package action menu visible only to
-- admin in the UI). No RLS change needed for this migration because:
--   - Staff cannot see the Package action UI controls
--   - A future RPC (e.g. rpc_admin_set_package_action) can enforce
--     column-level restriction if needed
-- ── ───────────────────────────────────────────────────────────
