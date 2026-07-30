-- Phase 29c: recover Meta queue rows left running after an Edge Function timeout.
-- The worker's writes are idempotent; a bounded lease lets a later worker safely
-- retry an interrupted item instead of leaving the whole batch running forever.

create or replace function public.claim_sync_batch_items(
  p_limit integer default 5,
  p_batch_id uuid default null
)
returns table (
  id                uuid,
  batch_id          uuid,
  client_id         uuid,
  client_name       text,
  month             text,
  status            text,
  attempts          int,
  posts_synced      int,
  reports_created   int,
  reports_reused    int,
  reports_updated   int,
  warnings          jsonb,
  error             text,
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz
)
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.meta_sync_batch_items i
  set
    status = case when i.attempts >= 3 then 'failed' else 'queued' end,
    error = case
      when i.attempts >= 3 then 'Sync worker timed out repeatedly. Retry this client after checking the Meta connection.'
      else null
    end,
    started_at = null,
    finished_at = case when i.attempts >= 3 then now() else null end
  where i.status = 'running'
    and i.started_at < now() - interval '5 minutes'
    and (p_batch_id is null or i.batch_id = p_batch_id);

  return query
  with claimed as (
    select i.id
    from public.meta_sync_batch_items i
    where i.status = 'queued'
      and (p_batch_id is null or i.batch_id = p_batch_id)
    order by i.created_at asc
    limit greatest(1, least(coalesce(p_limit, 5), 10))
    for update skip locked
  )
  update public.meta_sync_batch_items i
  set
    status = 'running',
    attempts = i.attempts + 1,
    started_at = now(),
    finished_at = null,
    error = null
  from claimed
  where i.id = claimed.id
  returning i.*;
end;
$$;

revoke all on function public.claim_sync_batch_items(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_sync_batch_items(integer, uuid) to service_role;
