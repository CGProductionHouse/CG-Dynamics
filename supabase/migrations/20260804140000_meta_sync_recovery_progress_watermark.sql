-- Only bound recoveries that achieve NOTHING.
--
-- The first cut counted every reaper invocation against a fixed budget. A large
-- but perfectly healthy batch legitimately needs many cron-driven invocations
-- (each one processes a couple of clients), so it would have been force-failed
-- part-way through despite progressing normally. The bound has to measure
-- "recoveries since anything last happened", not "recoveries ever".

alter table public.meta_sync_batches
  add column if not exists recovery_watermark integer not null default 0;

comment on column public.meta_sync_batches.recovery_watermark is
  'Settled item count at the last recovery. Progress past this resets recovery_attempts, so only genuinely stuck batches exhaust the budget.';

create or replace function public.meta_sync_note_recovery(
  p_batch_id uuid,
  p_error text default null,
  p_max_recoveries integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settled integer;
  v_watermark integer;
  v_attempts integer;
  v_pending integer;
begin
  select count(*) filter (where status not in ('queued', 'running'))
    into v_settled
    from public.meta_sync_batch_items
   where batch_id = p_batch_id;

  select recovery_watermark into v_watermark
    from public.meta_sync_batches where id = p_batch_id;

  if v_watermark is null then
    return jsonb_build_object('ok', false, 'error', 'Batch not found.');
  end if;

  if v_settled > v_watermark then
    -- Real progress since the last recovery: this batch is alive, so the
    -- budget starts again from zero.
    update public.meta_sync_batches
       set recovery_attempts = 0,
           recovery_watermark = v_settled,
           last_worker_error = null,
           worker_heartbeat_at = now()
     where id = p_batch_id;
    return jsonb_build_object('ok', true, 'recoveryAttempts', 0, 'progressed', true, 'settledItems', v_settled);
  end if;

  update public.meta_sync_batches
     set recovery_attempts = recovery_attempts + 1,
         last_worker_error = coalesce(left(p_error, 500), last_worker_error),
         worker_heartbeat_at = now()
   where id = p_batch_id
  returning recovery_attempts into v_attempts;

  if v_attempts >= greatest(3, p_max_recoveries) then
    select count(*) into v_pending
      from public.meta_sync_batch_items
     where batch_id = p_batch_id and status in ('queued', 'running');

    -- Give up honestly rather than pretending the batch is still progressing.
    update public.meta_sync_batch_items
       set status = 'failed',
           error = coalesce(error, 'Sync could not be recovered: repeated worker invocations made no progress. Check the Meta connection and permissions, then start a new sync.'),
           finished_at = now()
     where batch_id = p_batch_id and status in ('queued', 'running');

    update public.meta_sync_batches
       set status = 'failed',
           finished_at = now(),
           error = coalesce(
             last_worker_error,
             'Sync stopped after ' || v_attempts || ' recovery attempts with no progress and ' || v_pending || ' item(s) unfinished.')
     where id = p_batch_id;

    return jsonb_build_object('ok', false, 'exhausted', true, 'recoveryAttempts', v_attempts, 'abandonedItems', v_pending);
  end if;

  return jsonb_build_object('ok', true, 'recoveryAttempts', v_attempts, 'progressed', false);
end;
$$;

revoke all on function public.meta_sync_note_recovery(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.meta_sync_note_recovery(uuid, text, integer) to service_role;
