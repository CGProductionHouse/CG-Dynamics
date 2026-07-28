-- Microsoft apply recovery and production status-contract repair.
--
-- Access model: existing microsoft_sync_runs admin-only RLS remains unchanged.
-- The added metadata contains only reviewed source identities/titles and links to
-- existing admin-only preview/run rows. No Microsoft credentials or raw payloads
-- are stored. Microsoft remains read-only.

do $$
begin
  if to_regclass('public.microsoft_sync_jobs') is null then
    raise exception 'Phase 28a microsoft_sync_jobs is required before Microsoft apply recovery';
  end if;
end $$;

alter table public.microsoft_sync_runs
  add column if not exists preview_job_id uuid
    references public.microsoft_sync_jobs(id) on delete set null,
  add column if not exists retry_of_run_id uuid
    references public.microsoft_sync_runs(id) on delete set null,
  add column if not exists reviewed_items jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.microsoft_sync_runs'::regclass
      and conname = 'microsoft_sync_runs_reviewed_items_array_check'
  ) then
    alter table public.microsoft_sync_runs
      add constraint microsoft_sync_runs_reviewed_items_array_check
      check (jsonb_typeof(reviewed_items) = 'array');
  end if;
end $$;

create index if not exists microsoft_sync_runs_retry_of_idx
  on public.microsoft_sync_runs (retry_of_run_id)
  where retry_of_run_id is not null;

comment on column public.microsoft_sync_runs.preview_job_id is
  'Durable preview job whose persisted records produced this reviewed apply; enables recovery without a Microsoft refetch.';
comment on column public.microsoft_sync_runs.retry_of_run_id is
  'Prior reconciliation run whose failed or not-attempted reviewed actions this run retries.';
comment on column public.microsoft_sync_runs.reviewed_items is
  'Stable identities of the exact executable actions approved for this run. Missing audit rows are not-attempted actions.';

-- Link historical runs to their immutable durable preview before any recovery
-- request can reassemble it. The exported timestamp is unique for the completed
-- preview involved in the 27/28 July incident.
update public.microsoft_sync_runs r
set preview_job_id = j.id
from public.microsoft_sync_jobs j
where r.preview_job_id is null
  and j.exported_at = r.snapshot_exported_at;

-- Existing runs predate reviewed_items. Their applied/failed ledger rows are the
-- exact actions that passed the global review checkbox; skipped conflicts and
-- unchanged rows were never approved for writes.
with reviewed as (
  select i.run_id,
         jsonb_agg(jsonb_build_object(
           'key', i.source_type || ':' || coalesce(nullif(i.source_container_id, ''), 'missing') || ':' || coalesce(nullif(i.source_item_id, ''), 'missing'),
           'sourceType', i.source_type,
           'sourceContainerId', i.source_container_id,
           'sourceItemId', i.source_item_id,
           'sourceName', i.source_name,
           'title', coalesce(i.details->>'title', 'Microsoft item'),
           'action', i.action,
           'removalApproved', i.result_status = 'applied' and i.action in ('cancel', 'archive')
         ) order by i.created_at) as items
  from public.microsoft_sync_run_items i
  where i.result_status in ('previewed', 'applied', 'failed')
    and i.action in ('create', 'link_existing', 'update', 'complete', 'reopen', 'move', 'cancel', 'archive')
  group by i.run_id
)
update public.microsoft_sync_runs r
set reviewed_items = reviewed.items
from reviewed
where r.id = reviewed.run_id
  and r.reviewed_items = '[]'::jsonb;

-- Production still had the original phase-6e five-state constraint, while the
-- current Planner model and Microsoft mapper use the phase-16a operational
-- states. This was the exact cause of the five failed Planner completions on
-- 27/28 July 2026: Microsoft 100% maps to planner status "done".
alter table public.planner_tasks
  drop constraint if exists planner_tasks_status_check;

alter table public.planner_tasks
  add constraint planner_tasks_status_check check (status in (
    'to_do', 'in_progress', 'blocked', 'waiting_client',
    'ready_internal_review', 'approved', 'scheduled', 'done'
  ));

-- Separate additive preflight. The existing apply RPC contract remains version
-- 2 and backward compatible, so the current production frontend is not blocked
-- while this migration and the recovery UI deploy in either order.
create or replace function public.microsoft_sync_recovery_version()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case when public.is_admin() then 1 else 0 end;
$$;

revoke all on function public.microsoft_sync_recovery_version() from public;
revoke all on function public.microsoft_sync_recovery_version() from anon;
grant execute on function public.microsoft_sync_recovery_version() to authenticated;

notify pgrst, 'reload schema';
