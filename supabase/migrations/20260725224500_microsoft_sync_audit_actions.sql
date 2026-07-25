-- Keep the Microsoft reconciliation audit ledger aligned with current actions.
-- Additive/idempotent: no business rows are changed and no RLS is weakened.

alter table public.microsoft_sync_run_items
  drop constraint if exists microsoft_sync_run_items_action_check;

alter table public.microsoft_sync_run_items
  add constraint microsoft_sync_run_items_action_check
  check (action in (
    'create', 'link_existing', 'package_template_create',
    'update', 'unchanged', 'complete', 'reopen', 'move',
    'cancel', 'archive', 'conflict', 'skipped', 'failed'
  )) not valid;

alter table public.microsoft_sync_run_items
  validate constraint microsoft_sync_run_items_action_check;

notify pgrst, 'reload schema';
