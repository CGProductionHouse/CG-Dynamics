-- Meta sync failed-item retry (issue #166).
--
-- The 74-item batch finished 67/7. The remaining problem is recovering those 7
-- without rerunning the other 67, and without ever retrying a failure that a
-- retry cannot fix.
--
-- Classification lives here as well as in the UI because the retry gate must be
-- ENFORCED, not merely presented: a permission failure retried in a loop just
-- hammers Meta with a request that will be refused every single time.

-- ── Failure classification ──────────────────────────────────────────────────
-- Mirrors src/lib/metaSyncFailures.ts. Permission is tested FIRST: an OAuth
-- permission error also mentions a page fetch, and reading it as transient
-- would retry forever against a wall.
create or replace function public.meta_sync_failure_category(
  p_error text,
  p_warnings jsonb default '[]'::jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare v_hay text;
begin
  v_hay := lower(coalesce(p_error, '') || ' ' || coalesce(
    (select string_agg(value, ' ') from jsonb_array_elements_text(coalesce(p_warnings, '[]'::jsonb)) as t(value)),
    ''));

  if v_hay ~ 'pages_read_user_content'
     or v_hay ~ 'page public content access'
     or v_hay ~ 'oauthexception'
     or v_hay ~ 'requires the ''[^'']+'' permission'
     or v_hay ~ 'access token'
     or v_hay ~ '\m(401|403)\M'
     or v_hay ~ 'permission'
  then
    return 'permission';
  end if;

  if v_hay ~ 'aborterror'
     or v_hay ~ 'signal has been aborted'
     or v_hay ~ 'rate.?limit'
     or v_hay ~ 'paused (to preserve|before page)'
     or v_hay ~ 'worker lease budget'
     or v_hay ~ 'timeout|timed out'
     or v_hay ~ '\m(429|500|502|503|504)\M'
     or v_hay ~ 'temporarily unavailable'
  then
    return 'transient';
  end if;

  return 'stage';
end;
$$;

comment on function public.meta_sync_failure_category(text, jsonb) is
  'permission | transient | stage. Permission failures are never retried automatically.';

-- ── Retryable failed items for a batch ──────────────────────────────────────
-- Read model for the UI and the authority for what retry may touch.
create or replace function public.meta_sync_failed_items(p_batch_id uuid)
returns table (
  id uuid,
  client_id uuid,
  client_name text,
  month text,
  attempts integer,
  posts_synced integer,
  facebook_sync_state text,
  instagram_sync_state text,
  error text,
  warnings jsonb,
  category text,
  retryable boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.client_id, i.client_name, i.month, i.attempts, i.posts_synced,
         i.facebook_sync_state, i.instagram_sync_state, i.error, i.warnings,
         public.meta_sync_failure_category(i.error, i.warnings),
         public.meta_sync_failure_category(i.error, i.warnings) <> 'permission'
    from public.meta_sync_batch_items i
   where i.batch_id = p_batch_id
     and i.status = 'failed'
   order by i.client_name, i.month;
$$;

revoke all on function public.meta_sync_failed_items(uuid) from public, anon;
grant execute on function public.meta_sync_failed_items(uuid) to authenticated, service_role;

-- ── Retry ───────────────────────────────────────────────────────────────────
-- Requeues ONLY failed, retryable items on the EXISTING batch.
--
--  * Successful items are never touched, so nothing already synced is redone
--    and no report can be written twice.
--  * Only the platform stage that actually failed is reset to 'pending'. A
--    stage that completed stays 'complete', so its collected posts are kept and
--    are not re-fetched.
--  * Permission failures are refused here even if the UI asks for them.
--  * The batch is reopened so the existing per-minute reaper drains it; this
--    never creates a batch.
create or replace function public.meta_sync_retry_failed_items(
  p_batch_id uuid,
  p_item_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_staff boolean;
  v_requeued integer := 0;
  v_blocked integer := 0;
  v_settled integer;
begin
  -- Same authorisation as every other staff-triggered sync action.
  select public.is_staff() into v_is_staff;
  if not coalesce(v_is_staff, false) then
    raise exception 'Staff access is required to retry Meta sync items.'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_blocked
    from public.meta_sync_batch_items i
   where i.batch_id = p_batch_id
     and i.status = 'failed'
     and (p_item_ids is null or i.id = any(p_item_ids))
     and public.meta_sync_failure_category(i.error, i.warnings) = 'permission';

  with retryable as (
    select i.id, i.facebook_sync_state, i.instagram_sync_state
      from public.meta_sync_batch_items i
     where i.batch_id = p_batch_id
       and i.status = 'failed'
       and (p_item_ids is null or i.id = any(p_item_ids))
       and public.meta_sync_failure_category(i.error, i.warnings) <> 'permission'
       for update
  )
  update public.meta_sync_batch_items item set
    status = 'queued',
    attempts = 0,
    error = null,
    started_at = null,
    finished_at = null,
    -- Reset ONLY the stage that failed. 'complete' and 'not_applicable' are
    -- preserved so already-collected posts are neither lost nor re-fetched.
    facebook_sync_state = case when retryable.facebook_sync_state = 'failed' then 'pending' else retryable.facebook_sync_state end,
    instagram_sync_state = case when retryable.instagram_sync_state = 'failed' then 'pending' else retryable.instagram_sync_state end,
    facebook_next_cursor = case when retryable.facebook_sync_state = 'failed' then null else item.facebook_next_cursor end,
    instagram_next_cursor = case when retryable.instagram_sync_state = 'failed' then null else item.instagram_next_cursor end
  from retryable
  where item.id = retryable.id;

  get diagnostics v_requeued = row_count;

  if v_requeued = 0 then
    return jsonb_build_object(
      'ok', false, 'requeued', 0, 'blocked', v_blocked,
      'error', case when v_blocked > 0
        then 'Every remaining failure needs a Meta permission fix and cannot be retried.'
        else 'There are no retryable failed items on this batch.' end);
  end if;

  -- Reopen the existing batch for the reaper. No new batch is created.
  select count(*) into v_settled
    from public.meta_sync_batch_items
   where batch_id = p_batch_id and status not in ('queued', 'running');

  update public.meta_sync_batches
     set status = 'running',
         finished_at = null,
         error = null,
         cooldown_until = null,
         recovery_attempts = 0,
         recovery_watermark = v_settled,
         last_worker_error = null,
         worker_heartbeat_at = null
   where id = p_batch_id;

  perform public.recalculate_batch_status(p_batch_id);

  return jsonb_build_object('ok', true, 'requeued', v_requeued, 'blocked', v_blocked);
end;
$$;

revoke all on function public.meta_sync_retry_failed_items(uuid, uuid[]) from public, anon;
grant execute on function public.meta_sync_retry_failed_items(uuid, uuid[]) to authenticated, service_role;
