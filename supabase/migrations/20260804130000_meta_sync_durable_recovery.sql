-- Meta sync durable recovery (production blocker #161).
--
-- The queue could reach a state with items queued and NO worker able to run:
--
--  * The only durable driver was a background_jobs row. Once it exhausted its
--    3 attempts it became terminally 'failed' and nothing ever invoked
--    meta-sync-worker again, while the batch stayed 'running' with 69 queued.
--  * The worker's own continuation is an outbound HTTP call to itself held open
--    with waitUntil, so every generation keeps its ancestors alive. The nesting
--    dies after a couple of hops, stranding the rest of the queue.
--  * Claiming marked 5 items 'running' but the invocation budget only allowed a
--    few to be processed. The rest were abandoned, and the stale-lease sweep
--    counted each abandonment as a real attempt, so untouched clients were
--    force-failed after 3 abandonments.
--
-- This migration makes the batch itself the durable unit of work and gives the
-- already-running per-minute cron worker everything it needs to rescue one.
-- Nothing here weakens RLS: every function is SECURITY DEFINER and callable
-- only by service_role (the cron worker) or staff, matching the existing model.

-- ── Durable worker heartbeat on the batch ───────────────────────────────────
-- Without this there is no way to tell "a worker is actively chewing through
-- this batch" from "no worker has touched it in an hour". The reaper needs
-- that distinction so it neither stampedes a healthy batch nor leaves a dead
-- one sitting forever.
alter table public.meta_sync_batches
  add column if not exists worker_heartbeat_at timestamptz,
  add column if not exists last_worker_error text,
  add column if not exists recovery_attempts integer not null default 0;

comment on column public.meta_sync_batches.worker_heartbeat_at is
  'Set by meta-sync-worker while it holds and processes items. Stale => no live worker.';
comment on column public.meta_sync_batches.recovery_attempts is
  'How many times the cron reaper has revived this batch. Bounded so a permanently broken batch fails loudly instead of looping.';

create index if not exists meta_sync_batches_active_idx
  on public.meta_sync_batches (status, worker_heartbeat_at)
  where status in ('queued', 'running');

create index if not exists meta_sync_batch_items_pending_idx
  on public.meta_sync_batch_items (batch_id, status, started_at);

-- ── Heartbeat ───────────────────────────────────────────────────────────────
create or replace function public.meta_sync_touch_batch(p_batch_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.meta_sync_batches
     set worker_heartbeat_at = now(),
         started_at = coalesce(started_at, now())
   where id = p_batch_id;
$$;

revoke all on function public.meta_sync_touch_batch(uuid) from public, anon, authenticated;
grant execute on function public.meta_sync_touch_batch(uuid) to service_role;

-- ── Release abandoned claims WITHOUT burning an attempt ─────────────────────
-- A worker that runs out of invocation budget still holds items it never
-- touched. Those are not failures: returning them to the queue at their
-- original attempt count is what stops untouched clients being force-failed.
create or replace function public.meta_sync_release_items(p_item_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    return 0;
  end if;

  update public.meta_sync_batch_items item
     set status = 'queued',
         started_at = null,
         finished_at = null,
         -- Undo the increment the claim applied: this item was never attempted.
         attempts = greatest(0, item.attempts - 1)
   where item.id = any(p_item_ids)
     and item.status = 'running';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.meta_sync_release_items(uuid[]) from public, anon, authenticated;
grant execute on function public.meta_sync_release_items(uuid[]) to service_role;

-- ── Find batches that need a worker ─────────────────────────────────────────
-- "Needs a worker" = has real work left AND no worker has heartbeat in
-- p_stale_seconds. Returning the oldest first keeps FIFO fairness.
create or replace function public.meta_sync_stalled_batches(
  p_stale_seconds integer default 120,
  p_limit integer default 3
)
returns table (
  batch_id uuid,
  queued_items bigint,
  stale_running_items bigint,
  recovery_attempts integer,
  seconds_since_heartbeat numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id,
         count(*) filter (where i.status = 'queued'),
         count(*) filter (where i.status = 'running' and i.started_at < now() - interval '5 minutes'),
         b.recovery_attempts,
         round(extract(epoch from now() - coalesce(b.worker_heartbeat_at, b.created_at))::numeric, 1)
    from public.meta_sync_batches b
    join public.meta_sync_batch_items i on i.batch_id = b.id
   where b.status in ('queued', 'running')
     and coalesce(b.worker_heartbeat_at, b.created_at) < now() - make_interval(secs => greatest(30, p_stale_seconds))
   group by b.id, b.recovery_attempts, b.worker_heartbeat_at, b.created_at
  having count(*) filter (where i.status = 'queued') > 0
      or count(*) filter (where i.status = 'running' and i.started_at < now() - interval '5 minutes') > 0
   order by coalesce(b.worker_heartbeat_at, b.created_at)
   limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;

revoke all on function public.meta_sync_stalled_batches(integer, integer) from public, anon;
grant execute on function public.meta_sync_stalled_batches(integer, integer) to service_role;
grant execute on function public.meta_sync_stalled_batches(integer, integer) to authenticated;

-- ── Record a recovery attempt, and fail loudly when recovery is impossible ──
-- Bounded so a batch that can never progress (revoked Meta permission, deleted
-- client) stops looping and surfaces a real error instead of spinning forever.
create or replace function public.meta_sync_note_recovery(
  p_batch_id uuid,
  p_error text default null,
  p_max_recoveries integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_pending integer;
begin
  update public.meta_sync_batches
     set recovery_attempts = recovery_attempts + 1,
         last_worker_error = coalesce(left(p_error, 500), last_worker_error),
         worker_heartbeat_at = now()
   where id = p_batch_id
  returning recovery_attempts into v_attempts;

  if v_attempts is null then
    return jsonb_build_object('ok', false, 'error', 'Batch not found.');
  end if;

  if v_attempts >= p_max_recoveries then
    select count(*) into v_pending
      from public.meta_sync_batch_items
     where batch_id = p_batch_id and status in ('queued', 'running');

    -- Give up honestly rather than pretending the batch is still progressing.
    update public.meta_sync_batch_items
       set status = 'failed',
           error = coalesce(error, 'Sync could not be recovered after repeated attempts. Check the Meta connection and permissions, then start a new sync.'),
           finished_at = now()
     where batch_id = p_batch_id and status in ('queued', 'running');

    update public.meta_sync_batches
       set status = 'failed',
           finished_at = now(),
           error = coalesce(
             last_worker_error,
             'Sync stopped after ' || v_attempts || ' recovery attempts with ' || v_pending || ' item(s) unfinished.')
     where id = p_batch_id;

    return jsonb_build_object('ok', false, 'exhausted', true, 'recoveryAttempts', v_attempts, 'abandonedItems', v_pending);
  end if;

  return jsonb_build_object('ok', true, 'recoveryAttempts', v_attempts);
end;
$$;

revoke all on function public.meta_sync_note_recovery(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.meta_sync_note_recovery(uuid, text, integer) to service_role;
