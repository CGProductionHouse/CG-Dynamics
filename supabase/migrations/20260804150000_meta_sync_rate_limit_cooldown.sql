-- Rate limiting is a wait, not a failure.
--
-- Production showed the recovered worker running correctly but Meta returning
-- "rate-limited the Page token request". Items are requeued (right), the reaper
-- retries a minute later (right) -- and because no item settles, the bounded
-- recovery budget would eventually force-fail all remaining clients for what is
-- only a temporary throttle. Backing off is the correct response; failing is not.

alter table public.meta_sync_batches
  add column if not exists cooldown_until timestamptz;

comment on column public.meta_sync_batches.cooldown_until is
  'Set when Meta rate-limits the sync. The reaper skips the batch until this passes and does NOT spend recovery budget while waiting.';

create or replace function public.meta_sync_begin_cooldown(
  p_batch_id uuid,
  p_seconds integer default 900,
  p_reason text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_until timestamptz;
begin
  v_until := now() + make_interval(secs => greatest(60, least(coalesce(p_seconds, 900), 7200)));
  update public.meta_sync_batches
     set cooldown_until = v_until,
         last_worker_error = coalesce(left(p_reason, 500), last_worker_error),
         worker_heartbeat_at = now(),
         -- Waiting out a throttle must not consume the no-progress budget.
         recovery_attempts = 0
   where id = p_batch_id;
  return v_until;
end;
$$;

revoke all on function public.meta_sync_begin_cooldown(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.meta_sync_begin_cooldown(uuid, integer, text) to service_role;

-- Reaper skips batches that are deliberately waiting.
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
     and (b.cooldown_until is null or b.cooldown_until <= now())
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
