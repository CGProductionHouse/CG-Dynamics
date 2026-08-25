-- Serialize batch status recalculation now that independent worker lanes can
-- settle the final items concurrently. This migration is code-only until the
-- normal reviewed production rollout is separately approved.

create or replace function public.recalculate_batch_status(
  p_batch_id uuid
)
returns void
language plpgsql
as $$
declare
  v_total        int;
  v_completed    int;
  v_failed       int;
  v_running      int;
  v_queued       int;
begin
  -- Prevent an older concurrent aggregate snapshot from overwriting a newer
  -- terminal result after another lane settles the final item.
  perform 1
    from public.meta_sync_batches
   where id = p_batch_id
   for update;

  select
    count(*),
    count(*) filter (where status in ('completed','warning','skipped')),
    count(*) filter (where status = 'failed'),
    count(*) filter (where status = 'running'),
    count(*) filter (where status = 'queued')
  into v_total, v_completed, v_failed, v_running, v_queued
  from public.meta_sync_batch_items
  where batch_id = p_batch_id;

  update public.meta_sync_batches
  set
    total_items     = v_total,
    completed_items = v_completed,
    failed_items    = v_failed,
    status          = case
                        when v_queued = 0 and v_running = 0 then 'completed'
                        else 'running'
                      end,
    finished_at     = case
                        when v_queued = 0 and v_running = 0 then now()
                        else null
                      end
  where id = p_batch_id;
end;
$$;

-- A provider throttle is a wait, not a consumed item attempt. Reset only the
-- failed platform stage while preserving completed stages and page checkpoints.
create or replace function public.meta_sync_requeue_throttled_items(
  p_item_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.meta_sync_batch_items item
     set status = 'queued',
         attempts = greatest(0, item.attempts - 1),
         started_at = null,
         finished_at = null,
         error = null,
         facebook_sync_state = case when item.facebook_sync_state = 'failed' then 'pending' else item.facebook_sync_state end,
         instagram_sync_state = case when item.instagram_sync_state = 'failed' then 'pending' else item.instagram_sync_state end
   where item.id = any(coalesce(p_item_ids, array[]::uuid[]))
     and item.status in ('queued', 'failed');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.meta_sync_requeue_throttled_items(uuid[]) from public, anon, authenticated;
grant execute on function public.meta_sync_requeue_throttled_items(uuid[]) to service_role;
