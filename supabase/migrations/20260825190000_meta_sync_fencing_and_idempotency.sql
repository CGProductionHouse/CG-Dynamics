-- Durable lease fencing and transactional Meta persistence for parallel workers.
-- Code-only until a separately approved rollout. Historical migrations remain
-- immutable; rollout must pause drivers and drain old worker binaries first.

alter table public.meta_sync_batch_items
  add column if not exists lease_generation bigint not null default 0,
  add column if not exists instagram_oldest_timestamp timestamptz,
  add column if not exists instagram_ordering_malformed boolean not null default false,
  add column if not exists cooldown_until timestamptz;

alter table public.platform_sync_runs
  add column if not exists batch_item_id uuid references public.meta_sync_batch_items(id) on delete set null,
  add column if not exists completed_metric_keys text[] not null default '{}'::text[];

create table if not exists public.meta_sync_batch_lanes (
  batch_id uuid not null references public.meta_sync_batches(id) on delete cascade,
  lane_id integer not null check (lane_id between 0 and 5),
  lane_count integer not null check (lane_count between 1 and 6),
  lease_generation bigint not null default 1,
  status text not null default 'running' check (status in ('running', 'handoff', 'idle')),
  heartbeat_at timestamptz not null default now(),
  handoff_at timestamptz,
  primary key (batch_id, lane_id)
);
alter table public.meta_sync_batch_lanes enable row level security;
revoke all on public.meta_sync_batch_lanes from public, anon, authenticated;
grant all on public.meta_sync_batch_lanes to service_role;

drop function if exists public.meta_sync_begin_lane_set(uuid);
create function public.meta_sync_begin_lane_set(p_batch_id uuid, p_lane_count integer default 4)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if exists (
    select 1 from public.reports where platform is null
    group by client_id, date_trunc('month', period_end) having count(*) > 1
  ) then
    raise exception 'Duplicate monthly master reports require reviewed reconciliation before migration';
  end if;
  update public.meta_sync_batches batch set summary =
    jsonb_set(
      jsonb_set(coalesce(batch.summary, '{}'::jsonb), '{parallel_lanes_started_at}', to_jsonb(now()), true),
      '{parallel_lane_count}', to_jsonb(greatest(1, least(coalesce(p_lane_count, 4), 6))), true)
  where batch.id = p_batch_id
    and not (coalesce(batch.summary, '{}'::jsonb) ? 'parallel_lanes_started_at');
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.meta_sync_begin_lane_set(uuid, integer) from public, anon, authenticated;
grant execute on function public.meta_sync_begin_lane_set(uuid, integer) to service_role;

do $$
begin
  if exists (
    select 1 from public.meta_sync_batch_items
    group by batch_id, client_id, month having count(*) > 1
  ) then
    raise exception 'Duplicate Meta sync client-month items require reviewed reconciliation before migration';
  end if;
  if exists (
    select 1 from public.posts
    where platform in ('facebook', 'instagram') and nullif(btrim(meta_post_id), '') is not null
    group by report_id, platform, meta_post_id having count(*) > 1
  ) then
    raise exception 'Duplicate report Meta posts require reviewed reconciliation before migration';
  end if;
  if exists (
    select 1 from public.meta_content_mappings
    where post_id is not null group by post_id having count(*) > 1
  ) then
    raise exception 'Posts with multiple Meta mappings require reviewed reconciliation before migration';
  end if;
  if exists (
    select 1 from public.posts post
    left join public.meta_content_mappings mapping on mapping.post_id = post.id
    where post.raw ->> 'source' = 'meta_sync' and mapping.id is null
  ) then
    raise exception 'Orphan Meta sync posts require reviewed reconciliation before migration';
  end if;
end
$$;

create unique index if not exists meta_sync_batch_items_logical_unique
  on public.meta_sync_batch_items (batch_id, client_id, month);
create unique index if not exists posts_report_meta_object_unique
  on public.posts (report_id, platform, meta_post_id)
  where platform in ('facebook', 'instagram') and nullif(btrim(meta_post_id), '') is not null;
create unique index if not exists meta_content_mappings_post_unique
  on public.meta_content_mappings (post_id) where post_id is not null;
create unique index if not exists platform_sync_runs_batch_item_platform_unique
  on public.platform_sync_runs (batch_item_id, platform) where batch_item_id is not null;

drop function if exists public.claim_sync_batch_items(integer, uuid);
create function public.claim_sync_batch_items(
  p_limit integer default 5,
  p_batch_id uuid default null
)
returns table (
  id uuid, batch_id uuid, client_id uuid, client_name text, month text,
  status text, attempts int, posts_synced int, reports_created int,
  reports_reused int, reports_updated int, warnings jsonb, error text,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz,
  facebook_next_cursor text, instagram_next_cursor text,
  facebook_sync_state text, instagram_sync_state text,
  lease_generation bigint, instagram_oldest_timestamp timestamptz,
  instagram_ordering_malformed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meta_sync_batch_items item set
    status = case when item.attempts >= 3 then 'failed' else 'queued' end,
    error = case when item.attempts >= 3
      then 'Sync worker timed out repeatedly. Retry this client after checking the Meta connection.'
      else null end,
    started_at = null,
    finished_at = case when item.attempts >= 3 then now() else null end,
    facebook_sync_state = case
      when item.attempts >= 3 and item.facebook_sync_state not in ('complete', 'failed', 'not_applicable') then 'failed'
      else item.facebook_sync_state end,
    instagram_sync_state = case
      when item.attempts >= 3 and item.instagram_sync_state not in ('complete', 'failed', 'not_applicable') then 'failed'
      else item.instagram_sync_state end,
    facebook_next_cursor = case when item.attempts >= 3 then null else item.facebook_next_cursor end,
    instagram_next_cursor = case when item.attempts >= 3 then null else item.instagram_next_cursor end
  where item.status = 'running'
    and item.started_at < now() - interval '5 minutes'
    and (p_batch_id is null or item.batch_id = p_batch_id);

  return query
  with claimed as (
    select item.id
    from public.meta_sync_batch_items item
    where item.status = 'queued'
      and (item.cooldown_until is null or item.cooldown_until <= now())
      and (p_batch_id is null or item.batch_id = p_batch_id)
    order by item.created_at, item.id
    limit greatest(1, least(coalesce(p_limit, 5), 10))
    for update skip locked
  )
  update public.meta_sync_batch_items item set
    status = 'running',
    attempts = item.attempts + 1,
    lease_generation = item.lease_generation + 1,
    started_at = now(), finished_at = null, error = null
  from claimed
  where item.id = claimed.id
  returning item.id, item.batch_id, item.client_id, item.client_name,
    item.month, item.status, item.attempts, item.posts_synced,
    item.reports_created, item.reports_reused, item.reports_updated,
    item.warnings, item.error, item.started_at, item.finished_at,
    item.created_at, item.facebook_next_cursor, item.instagram_next_cursor,
    item.facebook_sync_state, item.instagram_sync_state,
    item.lease_generation, item.instagram_oldest_timestamp,
    item.instagram_ordering_malformed;
end;
$$;

revoke all on function public.claim_sync_batch_items(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_sync_batch_items(integer, uuid) to service_role;

create or replace function public.meta_sync_acquire_lane(
  p_batch_id uuid,
  p_lane_id integer,
  p_lane_count integer,
  p_previous_generation bigint default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare v_lane public.meta_sync_batch_lanes;
begin
  if p_lane_count < 1 or p_lane_count > 6 or p_lane_id < 0 or p_lane_id >= p_lane_count then
    raise exception 'Invalid Meta worker lane identity' using errcode = '22023';
  end if;
  select lane.* into v_lane from public.meta_sync_batch_lanes lane
  where lane.batch_id = p_batch_id and lane.lane_id = p_lane_id for update;
  if not found then
    insert into public.meta_sync_batch_lanes(batch_id, lane_id, lane_count)
    values (p_batch_id, p_lane_id, p_lane_count)
    returning * into v_lane;
    return v_lane.lease_generation;
  end if;
  if p_previous_generation is not null
     and v_lane.lease_generation = p_previous_generation and v_lane.status = 'handoff' then
    update public.meta_sync_batch_lanes set
      lease_generation = lease_generation + 1, lane_count = p_lane_count,
      status = 'running', heartbeat_at = now(), handoff_at = null
    where batch_id = p_batch_id and lane_id = p_lane_id
    returning * into v_lane;
    return v_lane.lease_generation;
  end if;
  if v_lane.status = 'idle'
     or v_lane.heartbeat_at < now() - interval '2 minutes'
     or (v_lane.status = 'handoff' and v_lane.handoff_at < now() - interval '15 seconds') then
    update public.meta_sync_batch_lanes set
      lease_generation = lease_generation + 1, lane_count = p_lane_count,
      status = 'running', heartbeat_at = now(), handoff_at = null
    where batch_id = p_batch_id and lane_id = p_lane_id
    returning * into v_lane;
    return v_lane.lease_generation;
  end if;
  return null;
end;
$$;

create or replace function public.meta_sync_touch_lane(
  p_batch_id uuid, p_lane_id integer, p_lease_generation bigint
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.meta_sync_batch_lanes set heartbeat_at = now()
  where batch_id = p_batch_id and lane_id = p_lane_id
    and lease_generation = p_lease_generation and status = 'running';
  if not found then raise exception 'Meta lane lease lost' using errcode = '55000'; end if;
end;
$$;

create or replace function public.meta_sync_prepare_lane_handoff(
  p_batch_id uuid, p_lane_id integer, p_lease_generation bigint
)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.meta_sync_batch_lanes set status = 'handoff', handoff_at = now(), heartbeat_at = now()
  where batch_id = p_batch_id and lane_id = p_lane_id
    and lease_generation = p_lease_generation and status = 'running';
  if not found then raise exception 'Meta lane lease lost' using errcode = '55000'; end if;
end;
$$;

create or replace function public.meta_sync_release_lane(
  p_batch_id uuid, p_lane_id integer, p_lease_generation bigint
)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.meta_sync_batch_lanes set status = 'idle', heartbeat_at = now(), handoff_at = null
  where batch_id = p_batch_id and lane_id = p_lane_id
    and lease_generation = p_lease_generation;
  return found;
end;
$$;

create or replace function public.meta_sync_lane_recovery_candidates(p_limit integer default 8)
returns table(batch_id uuid, lane_id integer, lane_count integer)
language sql stable security definer set search_path = '' as $$
  with active as (
    select b.id, greatest(1, least(coalesce((b.summary ->> 'parallel_lane_count')::integer, 4), 6)) lane_count
    from public.meta_sync_batches b
    where b.status in ('queued', 'running')
      and (b.cooldown_until is null or b.cooldown_until <= now())
      and exists (select 1 from public.meta_sync_batch_items item
        where item.batch_id = b.id and (
          item.status = 'running' or
          (item.status = 'queued' and (item.cooldown_until is null or item.cooldown_until <= now()))))
  )
  select active.id, generated.lane_id, active.lane_count
  from active
  cross join lateral generate_series(0, active.lane_count - 1) generated(lane_id)
  left join public.meta_sync_batch_lanes lane
    on lane.batch_id = active.id and lane.lane_id = generated.lane_id
  where lane.batch_id is null or lane.status = 'idle'
     or lane.heartbeat_at < now() - interval '2 minutes'
     or (lane.status = 'handoff' and lane.handoff_at < now() - interval '15 seconds')
  order by active.id, generated.lane_id
  limit greatest(1, least(coalesce(p_limit, 8), 24));
$$;

revoke all on function public.meta_sync_acquire_lane(uuid, integer, integer, bigint) from public, anon, authenticated;
revoke all on function public.meta_sync_touch_lane(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.meta_sync_prepare_lane_handoff(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.meta_sync_release_lane(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.meta_sync_lane_recovery_candidates(integer) from public, anon, authenticated;
grant execute on function public.meta_sync_acquire_lane(uuid, integer, integer, bigint) to service_role;
grant execute on function public.meta_sync_touch_lane(uuid, integer, bigint) to service_role;
grant execute on function public.meta_sync_prepare_lane_handoff(uuid, integer, bigint) to service_role;
grant execute on function public.meta_sync_release_lane(uuid, integer, bigint) to service_role;
grant execute on function public.meta_sync_lane_recovery_candidates(integer) to service_role;

create or replace function public.meta_sync_stalled_batches(
  p_stale_seconds integer default 120,
  p_limit integer default 3
)
returns table (
  batch_id uuid, queued_items bigint, stale_running_items bigint,
  recovery_attempts integer, seconds_since_heartbeat numeric
)
language sql stable security definer set search_path = '' as $$
  select b.id,
         count(*) filter (where i.status = 'queued'
           and (i.cooldown_until is null or i.cooldown_until <= now())),
         count(*) filter (where i.status = 'running' and i.started_at < now() - interval '5 minutes'),
         b.recovery_attempts,
         round(extract(epoch from now() - coalesce(b.worker_heartbeat_at, b.created_at))::numeric, 1)
  from public.meta_sync_batches b
  join public.meta_sync_batch_items i on i.batch_id = b.id
  where b.status in ('queued', 'running')
    and (b.cooldown_until is null or b.cooldown_until <= now())
    and coalesce(b.worker_heartbeat_at, b.created_at) < now() - make_interval(secs => greatest(30, p_stale_seconds))
  group by b.id, b.recovery_attempts, b.worker_heartbeat_at, b.created_at
  having count(*) filter (where i.status = 'queued'
           and (i.cooldown_until is null or i.cooldown_until <= now())) > 0
      or count(*) filter (where i.status = 'running' and i.started_at < now() - interval '5 minutes') > 0
  order by coalesce(b.worker_heartbeat_at, b.created_at)
  limit greatest(1, least(coalesce(p_limit, 3), 10));
$$;
revoke all on function public.meta_sync_stalled_batches(integer, integer) from public, anon, authenticated;
grant execute on function public.meta_sync_stalled_batches(integer, integer) to service_role;

create or replace function public.meta_sync_require_lease(
  p_item_id uuid,
  p_lease_generation bigint
)
returns public.meta_sync_batch_items
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
begin
  select item.* into v_item
  from public.meta_sync_batch_items item
  where item.id = p_item_id
  for update;

  if not found or v_item.status <> 'running'
     or v_item.lease_generation <> p_lease_generation then
    raise exception 'Meta sync lease lost' using errcode = '55000';
  end if;
  return v_item;
end;
$$;

revoke all on function public.meta_sync_require_lease(uuid, bigint) from public, anon, authenticated, service_role;

create or replace function public.meta_sync_touch_item_lease(
  p_item_id uuid,
  p_lease_generation bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  update public.meta_sync_batches set worker_heartbeat_at = now()
  where id = v_item.batch_id;
end;
$$;

create or replace function public.meta_sync_checkpoint_item(
  p_item_id uuid,
  p_lease_generation bigint,
  p_platform text,
  p_state text,
  p_next_cursor text,
  p_completed_page_posts integer default 0,
  p_instagram_oldest_timestamp timestamptz default null,
  p_instagram_ordering_malformed boolean default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_posts integer;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  if p_platform not in ('facebook', 'instagram') then
    raise exception 'Invalid Meta platform' using errcode = '22023';
  end if;
  if p_state not in ('pending', 'facts_pending', 'complete', 'failed', 'not_applicable') then
    raise exception 'Invalid Meta sync state' using errcode = '22023';
  end if;

  if p_platform = 'facebook' then
    update public.meta_sync_batch_items set
      facebook_sync_state = p_state,
      facebook_next_cursor = p_next_cursor,
      posts_synced = posts_synced + greatest(0, coalesce(p_completed_page_posts, 0))
    where id = p_item_id returning posts_synced into v_posts;
  else
    update public.meta_sync_batch_items set
      instagram_sync_state = p_state,
      instagram_next_cursor = p_next_cursor,
      instagram_oldest_timestamp = coalesce(p_instagram_oldest_timestamp, instagram_oldest_timestamp),
      instagram_ordering_malformed = coalesce(p_instagram_ordering_malformed, instagram_ordering_malformed),
      posts_synced = posts_synced + greatest(0, coalesce(p_completed_page_posts, 0))
    where id = p_item_id returning posts_synced into v_posts;
  end if;
  return v_posts;
end;
$$;

create or replace function public.meta_sync_settle_item(
  p_item_id uuid,
  p_lease_generation bigint,
  p_status text,
  p_reports_created integer default 0,
  p_reports_reused integer default 0,
  p_warnings jsonb default '[]'::jsonb,
  p_error text default null,
  p_refund_attempt boolean default false,
  p_cooldown_seconds integer default null,
  p_cooldown_scope text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  if p_status not in ('queued', 'completed', 'warning', 'failed', 'skipped') then
    raise exception 'Invalid Meta item status' using errcode = '22023';
  end if;

  update public.meta_sync_batch_items set
    status = p_status,
    attempts = case when p_refund_attempt then greatest(0, attempts - 1) else attempts end,
    reports_created = greatest(reports_created, coalesce(p_reports_created, 0)),
    reports_reused = greatest(reports_reused, coalesce(p_reports_reused, 0)),
    warnings = coalesce(p_warnings, '[]'::jsonb),
    error = left(p_error, 1000),
    cooldown_until = case
      when p_cooldown_seconds is not null and p_cooldown_scope = 'item'
        then now() + make_interval(secs => greatest(60, least(p_cooldown_seconds, 7200)))
      else null end,
    started_at = case when p_status = 'queued' then null else started_at end,
    finished_at = case when p_status = 'queued' then null else now() end
  where id = p_item_id;

  if p_cooldown_seconds is not null and p_cooldown_scope = 'batch' then
    update public.meta_sync_batches set
      cooldown_until = now() + make_interval(secs => greatest(60, least(p_cooldown_seconds, 7200))),
      last_worker_error = coalesce(left(p_error, 500), last_worker_error),
      worker_heartbeat_at = now(), recovery_attempts = 0
    where id = v_item.batch_id;
  end if;
  perform public.recalculate_batch_status(v_item.batch_id);
end;
$$;

create or replace function public.meta_sync_release_claims(p_claims jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer;
begin
  if coalesce(jsonb_typeof(p_claims), '') <> 'array' then
    raise exception 'Claims must be a JSON array' using errcode = '22023';
  end if;
  with claims as (
    select (entry ->> 'item_id')::uuid item_id,
           (entry ->> 'lease_generation')::bigint lease_generation
    from jsonb_array_elements(p_claims) entry
  )
  update public.meta_sync_batch_items item set
    status = 'queued', attempts = greatest(0, item.attempts - 1),
    started_at = null, finished_at = null, error = null
  from claims
  where item.id = claims.item_id and item.status = 'running'
    and item.lease_generation = claims.lease_generation;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.meta_sync_record_run(
  p_item_id uuid,
  p_lease_generation bigint,
  p_connection_id uuid,
  p_status text,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_id uuid;
declare v_start date;
declare v_end date;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  v_start := (v_item.month || '-01')::date;
  v_end := (v_start + interval '1 month - 1 day')::date;
  insert into public.meta_sync_runs
    (client_id, connection_id, sync_type, period_start, period_end, status,
     summary, started_at, finished_at)
  values
    (v_item.client_id, p_connection_id, 'previous_completed_month', v_start,
     v_end, p_status, coalesce(p_summary, '{}'::jsonb), now(), now())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.meta_sync_get_or_create_report(
  p_item_id uuid default null,
  p_lease_generation bigint default null,
  p_client_id uuid default null,
  p_month date default null,
  p_report_title text default null,
  p_created_by uuid default null
)
returns table(report_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_client uuid;
declare v_month date;
declare v_existing uuid;
declare v_count integer;
begin
  if (p_item_id is null) <> (p_lease_generation is null) then
    raise exception 'Item and lease generation must be supplied together' using errcode = '22023';
  end if;
  if p_item_id is not null then
    v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
    v_client := v_item.client_id;
    v_month := (v_item.month || '-01')::date;
  else
    v_client := p_client_id;
    v_month := date_trunc('month', p_month)::date;
  end if;
  if v_client is null or v_month is null then
    raise exception 'Invalid report identity' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'meta-master-report:' || v_client::text || ':' || v_month::text, 0));
  select count(*), (array_agg(r.id order by r.created_at, r.id))[1] into v_count, v_existing
  from public.reports r
  where r.client_id = v_client and r.platform is null
    and r.period_end >= v_month
    and r.period_end < (v_month + interval '1 month');
  if v_count > 1 then
    raise exception 'Multiple master reports require review' using errcode = '23514';
  end if;
  if v_existing is not null then
    report_id := v_existing; created := false; return next; return;
  end if;

  insert into public.reports
    (client_id, platform, period_start, period_end, status, report_title, created_by)
  values
    (v_client, null, v_month, (v_month + interval '1 month - 1 day')::date,
     'draft', p_report_title, p_created_by)
  on conflict (client_id, period_start) where platform is null do nothing
  returning id into v_existing;
  created := v_existing is not null;
  if v_existing is null then
    select r.id into v_existing from public.reports r
    where r.client_id = v_client and r.platform is null and r.period_start = v_month;
  end if;
  if v_existing is null then raise exception 'Could not acquire master report'; end if;
  report_id := v_existing; return next;
end;
$$;

create or replace function public.meta_normalize_permalink(p_value text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(regexp_replace(split_part(split_part(coalesce(p_value, ''), '?', 1), '#', 1), '^https?://', ''), '/+$', ''))
$$;
create or replace function public.meta_normalize_caption(p_value text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'))
$$;

create or replace function public.meta_sync_upsert_report_post(
  p_item_id uuid default null,
  p_lease_generation bigint default null,
  p_client_id uuid default null,
  p_meta_object_id text default null,
  p_meta_object_type text default null,
  p_payload jsonb default '{}'::jsonb
)
returns table(post_id uuid, inserted boolean, reused_imported boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_client uuid;
declare v_report public.reports;
declare v_mapping public.meta_content_mappings;
declare v_existing public.posts;
declare v_imported public.posts;
declare v_imported_count integer;
declare v_duplicate uuid;
declare v_post_id uuid;
declare v_platform text := p_payload ->> 'platform';
declare v_report_id uuid := (p_payload ->> 'report_id')::uuid;
declare v_object text := btrim(p_meta_object_id);
declare v_now timestamptz := now();
begin
  if (p_item_id is null) <> (p_lease_generation is null) then
    raise exception 'Item and lease generation must be supplied together' using errcode = '22023';
  end if;
  if p_item_id is not null then
    v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
    v_client := v_item.client_id;
  else
    v_client := p_client_id;
  end if;
  if v_client is null or v_platform not in ('facebook', 'instagram')
     or v_report_id is null or nullif(v_object, '') is null then
    raise exception 'Invalid Meta post identity' using errcode = '22023';
  end if;

  select r.* into v_report from public.reports r where r.id = v_report_id for update;
  if not found or v_report.client_id <> v_client or v_report.platform is not null then
    raise exception 'Report/client mismatch' using errcode = '23514';
  end if;
  if p_item_id is not null and not (
    v_report.period_end >= (v_item.month || '-01')::date
    and v_report.period_end < ((v_item.month || '-01')::date + interval '1 month')
  ) then raise exception 'Report/item month mismatch' using errcode = '23514'; end if;

  insert into public.meta_content_mappings as mapping
    (client_id, report_id, platform, meta_object_id, meta_object_type, permalink, last_synced_at)
  values
    (v_client, v_report_id, v_platform, v_object, p_meta_object_type,
     p_payload ->> 'permalink', v_now)
  on conflict (client_id, platform, meta_object_id) do update
  set updated_at = mapping.updated_at
  returning mapping.* into v_mapping;

  if v_mapping.post_id is not null then
    select p.* into v_existing from public.posts p where p.id = v_mapping.post_id for update;
    if v_existing.id is not null and v_existing.report_id <> v_report_id then
      raise exception 'Meta mapping/report mismatch requires review' using errcode = '23514';
    end if;
  end if;

  select count(*), (array_agg(p.id order by p.created_at, p.id))[1] into v_imported_count, v_duplicate
  from public.posts p
  left join public.meta_content_mappings m on m.post_id = p.id
  where p.report_id = v_report_id and p.platform = v_platform and m.id is null
    and coalesce(p.raw ->> 'source', '') <> 'meta_sync'
    and (
      (public.meta_normalize_permalink(p_payload ->> 'permalink') <> ''
       and public.meta_normalize_permalink(p.permalink) = public.meta_normalize_permalink(p_payload ->> 'permalink'))
      or
      (public.meta_normalize_caption(p_payload ->> 'caption') <> ''
       and public.meta_normalize_caption(p.caption) = public.meta_normalize_caption(p_payload ->> 'caption')
       and p.publish_time is not null and p_payload ->> 'publish_time' is not null
       and abs(extract(epoch from (p.publish_time - (p_payload ->> 'publish_time')::timestamptz))) <= 64800)
    );
  if v_imported_count = 1 then
    select p.* into v_imported from public.posts p where p.id = v_duplicate for update;
  end if;
  if v_imported.id is not null then v_existing := v_imported; end if;

  inserted := false;
  reused_imported := v_existing.id is not null and coalesce(v_existing.raw ->> 'source', '') <> 'meta_sync';
  if v_existing.id is not null then
    if reused_imported then
      update public.posts set
        permalink = coalesce(nullif(permalink, ''), p_payload ->> 'permalink'),
        raw = coalesce(raw, '{}'::jsonb) || jsonb_build_object('meta_sync', coalesce(p_payload -> 'raw', '{}'::jsonb))
      where id = v_existing.id returning id into v_post_id;
    else
      update public.posts set
        meta_post_id = v_object,
        publish_time = (p_payload ->> 'publish_time')::timestamptz,
        meta_post_type = p_payload ->> 'meta_post_type',
        caption = p_payload ->> 'caption', permalink = p_payload ->> 'permalink',
        views = (p_payload ->> 'views')::integer,
        reach = (p_payload ->> 'reach')::integer,
        reactions = coalesce((p_payload ->> 'reactions')::integer, 0),
        comments = coalesce((p_payload ->> 'comments')::integer, 0),
        shares = coalesce((p_payload ->> 'shares')::integer, 0),
        total_clicks = coalesce((p_payload ->> 'total_clicks')::integer, total_clicks),
        raw = coalesce(p_payload -> 'raw', '{}'::jsonb)
      where id = v_existing.id returning id into v_post_id;
    end if;
  else
    insert into public.posts
      (report_id, platform, meta_post_id, publish_time, meta_post_type, caption,
       permalink, views, reach, reactions, comments, shares, total_clicks, raw)
    values
      (v_report_id, v_platform, v_object, (p_payload ->> 'publish_time')::timestamptz,
       p_payload ->> 'meta_post_type', p_payload ->> 'caption', p_payload ->> 'permalink',
       (p_payload ->> 'views')::integer, (p_payload ->> 'reach')::integer,
       coalesce((p_payload ->> 'reactions')::integer, 0),
       coalesce((p_payload ->> 'comments')::integer, 0),
       coalesce((p_payload ->> 'shares')::integer, 0),
       coalesce((p_payload ->> 'total_clicks')::integer, 0),
       coalesce(p_payload -> 'raw', '{}'::jsonb))
    on conflict (report_id, platform, meta_post_id)
      where platform in ('facebook', 'instagram') and nullif(btrim(meta_post_id), '') is not null
    do update set
      publish_time = excluded.publish_time, meta_post_type = excluded.meta_post_type,
      caption = excluded.caption, permalink = excluded.permalink,
      views = excluded.views, reach = excluded.reach, reactions = excluded.reactions,
      comments = excluded.comments, shares = excluded.shares,
      total_clicks = excluded.total_clicks, raw = excluded.raw
    returning id, (xmax = 0) into v_post_id, inserted;
  end if;

  if v_mapping.post_id is not null and v_mapping.post_id <> v_post_id then
    v_duplicate := v_mapping.post_id;
  else v_duplicate := null; end if;

  update public.meta_content_mappings set
    report_id = v_report_id, post_id = v_post_id, meta_object_type = p_meta_object_type,
    permalink = p_payload ->> 'permalink', last_synced_at = v_now
  where id = v_mapping.id;

  if v_duplicate is not null then
    update public.reports set best_poster_post_id = v_post_id where best_poster_post_id = v_duplicate;
    update public.reports set best_video_post_id = v_post_id where best_video_post_id = v_duplicate;
    update public.report_content_exclusions set post_id = v_post_id where post_id = v_duplicate;
    delete from public.posts where id = v_duplicate;
  end if;
  post_id := v_post_id;
  return next;
end;
$$;

alter table public.platform_sync_runs drop constraint if exists platform_sync_runs_status_check;
alter table public.platform_sync_runs add constraint platform_sync_runs_status_check
  check (status in ('running', 'success', 'partial', 'failed', 'skipped'));

create or replace function public.meta_sync_begin_account_fact_run(
  p_item_id uuid,
  p_lease_generation bigint,
  p_platform text,
  p_asset_id uuid,
  p_connection_id uuid,
  p_api_version text,
  p_connector_version text,
  p_token_class text,
  p_period_start date,
  p_period_end date,
  p_requested_bounds jsonb
)
returns table(sync_run_id uuid, completed_metric_keys text[], summary jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  if p_platform not in ('facebook', 'instagram') then raise exception 'Invalid platform'; end if;
  insert into public.platform_sync_runs as run
    (batch_item_id, client_id, asset_id, connection_id, platform, run_type,
     period_month, period_start, period_end, api_version, connector_version,
     token_class, requested_bounds, business_timezone, status, health_state,
     started_at, summary)
  values
    (p_item_id, v_item.client_id, p_asset_id, p_connection_id, p_platform,
     'scheduled', v_item.month, p_period_start, p_period_end, p_api_version,
     p_connector_version, p_token_class, p_requested_bounds,
     'Africa/Johannesburg', 'running', 'sync_error', now(), '{}'::jsonb)
  on conflict (batch_item_id, platform) where batch_item_id is not null do update
    set started_at = run.started_at
  returning run.id, run.completed_metric_keys, run.summary
  into sync_run_id, completed_metric_keys, summary;
  return next;
end;
$$;

create or replace function public.meta_sync_persist_account_metric(
  p_item_id uuid,
  p_lease_generation bigint,
  p_sync_run_id uuid,
  p_metric_key text,
  p_terminal boolean,
  p_snapshot jsonb,
  p_fact jsonb
)
returns table(snapshot_id uuid, fact_outcome text, completed_metric_keys text[])
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_run public.platform_sync_runs;
declare v_snapshot uuid;
declare v_outcome text;
declare v_completed text[];
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  select run.* into v_run from public.platform_sync_runs run
  where run.id = p_sync_run_id and run.batch_item_id = p_item_id for update;
  if not found then raise exception 'Fact run/item mismatch' using errcode = '23514'; end if;

  insert into public.platform_metric_snapshots
    (sync_run_id, client_id, asset_id, platform, source_endpoint, source_metric,
     api_version, token_class, period_month, period_start, period_end, metric_type,
     response_shape, value, availability, error_code, error_subcode, error_message,
     trace_id, raw_snapshot, retrieved_at)
  values
    (v_run.id, v_run.client_id, v_run.asset_id, v_run.platform,
     p_snapshot ->> 'source_endpoint', p_snapshot ->> 'source_metric',
     v_run.api_version, v_run.token_class, v_run.period_month, v_run.period_start,
     v_run.period_end, p_snapshot ->> 'metric_type', p_snapshot ->> 'response_shape',
     (p_snapshot ->> 'value')::numeric, p_snapshot ->> 'availability',
     p_snapshot ->> 'error_code', p_snapshot ->> 'error_subcode',
     p_snapshot ->> 'error_message', p_snapshot ->> 'trace_id',
     p_snapshot -> 'raw_snapshot', coalesce((p_snapshot ->> 'retrieved_at')::timestamptz, now()))
  returning id into v_snapshot;

  v_outcome := public.upsert_platform_metric_fact_preserving_verified(
    v_run.client_id, v_run.asset_id, v_run.platform, v_run.period_month,
    v_run.period_start, v_run.period_end, p_metric_key, p_fact ->> 'source_metric',
    (p_fact ->> 'value')::numeric, p_fact ->> 'availability',
    p_fact ->> 'includes_paid', p_fact ->> 'aggregation',
    p_fact ->> 'comparable_group', v_run.api_version, v_run.connector_version,
    p_fact ->> 'source_timezone',
    coalesce(p_fact -> 'provenance', '{}'::jsonb) || jsonb_build_object(
      'snapshot_id', v_snapshot, 'sync_run_id', v_run.id,
      'retrieved_at', coalesce(p_snapshot ->> 'retrieved_at', now()::text)),
    v_run.id, coalesce((p_snapshot ->> 'retrieved_at')::timestamptz, now())
  );

  update public.platform_sync_runs run set
    completed_metric_keys = case
      when p_terminal and not (p_metric_key = any(run.completed_metric_keys))
        then array_append(run.completed_metric_keys, p_metric_key)
      else run.completed_metric_keys end,
    summary = jsonb_set(
      jsonb_set(coalesce(run.summary, '{}'::jsonb), '{metric_results}',
        coalesce(run.summary -> 'metric_results', '{}'::jsonb), true),
      array['metric_results', p_metric_key], coalesce(p_fact, '{}'::jsonb), true)
  where run.id = v_run.id returning run.completed_metric_keys into v_completed;

  snapshot_id := v_snapshot; fact_outcome := v_outcome;
  completed_metric_keys := v_completed; return next;
end;
$$;

create or replace function public.meta_sync_finalize_account_fact_run(
  p_item_id uuid,
  p_lease_generation bigint,
  p_sync_run_id uuid,
  p_expected_metric_keys text[],
  p_status text,
  p_health_state text,
  p_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.meta_sync_batch_items;
declare v_run public.platform_sync_runs;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  select run.* into v_run from public.platform_sync_runs run
  where run.id = p_sync_run_id and run.batch_item_id = p_item_id for update;
  if not found then raise exception 'Fact run/item mismatch' using errcode = '23514'; end if;
  if p_status in ('success', 'partial') and exists (
    select 1 from unnest(coalesce(p_expected_metric_keys, '{}'::text[])) key
    where not (key = any(v_run.completed_metric_keys))
  ) then raise exception 'Account fact metrics remain incomplete' using errcode = '55000'; end if;
  update public.platform_sync_runs set
    status = p_status, health_state = p_health_state, finished_at = now(),
    summary = coalesce(summary, '{}'::jsonb) || coalesce(p_summary, '{}'::jsonb)
  where id = p_sync_run_id;
end;
$$;

revoke all on function public.meta_sync_touch_item_lease(uuid, bigint) from public, anon, authenticated;
revoke all on function public.meta_sync_checkpoint_item(uuid, bigint, text, text, text, integer, timestamptz, boolean) from public, anon, authenticated;
revoke all on function public.meta_sync_settle_item(uuid, bigint, text, integer, integer, jsonb, text, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.meta_sync_release_claims(jsonb) from public, anon, authenticated;
revoke all on function public.meta_sync_record_run(uuid, bigint, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.meta_sync_get_or_create_report(uuid, bigint, uuid, date, text, uuid) from public, anon, authenticated;
revoke all on function public.meta_sync_upsert_report_post(uuid, bigint, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.meta_sync_begin_account_fact_run(uuid, bigint, text, uuid, uuid, text, text, text, date, date, jsonb) from public, anon, authenticated;
revoke all on function public.meta_sync_persist_account_metric(uuid, bigint, uuid, text, boolean, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.meta_sync_finalize_account_fact_run(uuid, bigint, uuid, text[], text, text, jsonb) from public, anon, authenticated;

grant execute on function public.meta_sync_touch_item_lease(uuid, bigint) to service_role;
grant execute on function public.meta_sync_checkpoint_item(uuid, bigint, text, text, text, integer, timestamptz, boolean) to service_role;
grant execute on function public.meta_sync_settle_item(uuid, bigint, text, integer, integer, jsonb, text, boolean, integer, text) to service_role;
grant execute on function public.meta_sync_release_claims(jsonb) to service_role;
grant execute on function public.meta_sync_record_run(uuid, bigint, uuid, text, jsonb) to service_role;
grant execute on function public.meta_sync_get_or_create_report(uuid, bigint, uuid, date, text, uuid) to service_role;
grant execute on function public.meta_sync_upsert_report_post(uuid, bigint, uuid, text, text, jsonb) to service_role;
grant execute on function public.meta_sync_begin_account_fact_run(uuid, bigint, text, uuid, uuid, text, text, text, date, date, jsonb) to service_role;
grant execute on function public.meta_sync_persist_account_metric(uuid, bigint, uuid, text, boolean, jsonb, jsonb) to service_role;
grant execute on function public.meta_sync_finalize_account_fact_run(uuid, bigint, uuid, text[], text, text, jsonb) to service_role;
