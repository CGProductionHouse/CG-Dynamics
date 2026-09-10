-- Issue #236: durable per-asset/platform refresh checkpoints.
-- Historical/backfill work remains explicit; incremental work can advance only
-- after a fenced platform stage commits completely.

alter table public.meta_sync_batch_items
  add column if not exists asset_id uuid references public.meta_client_assets(id) on delete restrict,
  add column if not exists sync_kind text not null default 'historical';

alter table public.meta_sync_batch_items
  drop constraint if exists meta_sync_batch_items_sync_kind_check;
alter table public.meta_sync_batch_items
  add constraint meta_sync_batch_items_sync_kind_check
  check (sync_kind in ('historical', 'incremental', 'targeted_backfill'));

drop index if exists public.meta_sync_batch_items_logical_unique;
create unique index if not exists meta_sync_batch_items_asset_unique
  on public.meta_sync_batch_items (batch_id, asset_id, month)
  where asset_id is not null;
create unique index if not exists meta_sync_batch_items_legacy_unique
  on public.meta_sync_batch_items (batch_id, client_id, month)
  where asset_id is null;

create table if not exists public.meta_asset_sync_checkpoints (
  asset_id uuid not null references public.meta_client_assets(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram')),
  last_sync_kind text not null check (last_sync_kind in ('historical', 'incremental', 'targeted_backfill')),
  last_status text not null check (last_status in ('complete', 'failed')),
  last_health_state text not null,
  last_attempted_at timestamptz not null,
  last_successful_at timestamptz,
  last_successful_month text,
  high_watermark_at timestamptz,
  next_due_at timestamptz,
  api_version text,
  connector_version text,
  last_error_code text,
  updated_at timestamptz not null default now(),
  primary key (asset_id, platform),
  check (last_successful_month is null or last_successful_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

alter table public.meta_asset_sync_checkpoints enable row level security;
revoke all on public.meta_asset_sync_checkpoints from public, anon, authenticated;
grant all on public.meta_asset_sync_checkpoints to service_role;

create index if not exists meta_asset_sync_checkpoints_due_idx
  on public.meta_asset_sync_checkpoints (next_due_at, platform);

comment on table public.meta_asset_sync_checkpoints is
  'Server-only per-linked-asset refresh position. Advances success/high-water only after a fenced platform stage completes.';

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
  instagram_ordering_malformed boolean, asset_id uuid, sync_kind text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.meta_sync_batch_items item set
    status = case when item.attempts >= 3 then 'failed' else 'queued' end,
    error = case when item.attempts >= 3
      then 'Sync worker timed out repeatedly. Retry this client after checking the Meta connection.' else null end,
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
    select item.id from public.meta_sync_batch_items item
    where item.status = 'queued'
      and (item.cooldown_until is null or item.cooldown_until <= now())
      and (p_batch_id is null or item.batch_id = p_batch_id)
    order by item.created_at, item.id
    limit greatest(1, least(coalesce(p_limit, 5), 10))
    for update skip locked
  )
  update public.meta_sync_batch_items item set
    status = 'running', attempts = item.attempts + 1,
    lease_generation = item.lease_generation + 1,
    started_at = now(), finished_at = null, error = null
  from claimed where item.id = claimed.id
  returning item.id, item.batch_id, item.client_id, item.client_name,
    item.month, item.status, item.attempts, item.posts_synced,
    item.reports_created, item.reports_reused, item.reports_updated,
    item.warnings, item.error, item.started_at, item.finished_at,
    item.created_at, item.facebook_next_cursor, item.instagram_next_cursor,
    item.facebook_sync_state, item.instagram_sync_state,
    item.lease_generation, item.instagram_oldest_timestamp,
    item.instagram_ordering_malformed, item.asset_id, item.sync_kind;
end;
$$;

revoke all on function public.claim_sync_batch_items(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_sync_batch_items(integer, uuid) to service_role;

create or replace function public.meta_sync_checkpoint_platform_terminal(
  p_item_id uuid,
  p_lease_generation bigint,
  p_platform text,
  p_state text,
  p_completed_page_posts integer,
  p_window_end timestamptz,
  p_api_version text,
  p_connector_version text,
  p_health_state text,
  p_error_code text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.meta_sync_batch_items;
  v_posts integer;
  v_success boolean := p_state = 'complete';
begin
  if p_platform not in ('facebook', 'instagram') or p_state not in ('complete', 'failed') then
    raise exception 'Invalid terminal Meta platform checkpoint' using errcode = '22023';
  end if;
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  if v_item.asset_id is null then
    raise exception 'Meta sync item has no exact asset identity' using errcode = '23514';
  end if;

  select public.meta_sync_checkpoint_item(
    p_item_id, p_lease_generation, p_platform, p_state, null,
    p_completed_page_posts, null, null
  ) into v_posts;

  insert into public.meta_asset_sync_checkpoints as checkpoint (
    asset_id, client_id, platform, last_sync_kind, last_status, last_health_state,
    last_attempted_at, last_successful_at, last_successful_month,
    high_watermark_at, next_due_at, api_version, connector_version,
    last_error_code, updated_at
  ) values (
    v_item.asset_id, v_item.client_id, p_platform, v_item.sync_kind, p_state,
    coalesce(nullif(btrim(p_health_state), ''), case when v_success then 'verified' else 'sync_error' end),
    now(), case when v_success then now() else null end,
    case when v_success then v_item.month else null end,
    case when v_success then least(coalesce(p_window_end, now()), now()) else null end,
    case when v_success then now() + interval '6 hours' else now() + interval '1 hour' end,
    p_api_version, p_connector_version,
    case when v_success then null else coalesce(nullif(btrim(p_error_code), ''), 'provider_error') end,
    now()
  )
  on conflict (asset_id, platform) do update set
    client_id = excluded.client_id,
    last_sync_kind = excluded.last_sync_kind,
    last_status = excluded.last_status,
    last_health_state = excluded.last_health_state,
    last_attempted_at = excluded.last_attempted_at,
    last_successful_at = case when v_success then excluded.last_successful_at else checkpoint.last_successful_at end,
    last_successful_month = case when v_success then excluded.last_successful_month else checkpoint.last_successful_month end,
    high_watermark_at = case when v_success then greatest(checkpoint.high_watermark_at, excluded.high_watermark_at) else checkpoint.high_watermark_at end,
    next_due_at = excluded.next_due_at,
    api_version = excluded.api_version,
    connector_version = excluded.connector_version,
    last_error_code = excluded.last_error_code,
    updated_at = now();

  return v_posts;
end;
$$;

revoke all on function public.meta_sync_checkpoint_platform_terminal(uuid, bigint, text, text, integer, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.meta_sync_checkpoint_platform_terminal(uuid, bigint, text, text, integer, timestamptz, text, text, text, text)
  to service_role;

-- Preserve the item's exact asset and workload class in the operational run.
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
declare v_sync_type text;
begin
  v_item := public.meta_sync_require_lease(p_item_id, p_lease_generation);
  v_start := (v_item.month || '-01')::date;
  v_end := (v_start + interval '1 month - 1 day')::date;
  v_sync_type := case
    when v_item.month = to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM') then 'current_month'
    when v_item.sync_kind = 'targeted_backfill' then 'custom'
    else 'previous_completed_month'
  end;
  insert into public.meta_sync_runs as run
    (batch_item_id, client_id, asset_id, connection_id, sync_type, period_start, period_end, status,
     summary, started_at, finished_at)
  values
    (p_item_id, v_item.client_id, v_item.asset_id, p_connection_id, v_sync_type, v_start,
     v_end, p_status, coalesce(p_summary, '{}'::jsonb) || jsonb_build_object('syncKind', v_item.sync_kind), now(), now())
  on conflict (batch_item_id) where batch_item_id is not null do update set
    asset_id = excluded.asset_id, connection_id = excluded.connection_id,
    sync_type = excluded.sync_type, status = excluded.status,
    summary = excluded.summary, finished_at = excluded.finished_at
  returning run.id into v_id;
  return v_id;
end;
$$;

revoke all on function public.meta_sync_record_run(uuid, bigint, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.meta_sync_record_run(uuid, bigint, uuid, text, jsonb) to service_role;
