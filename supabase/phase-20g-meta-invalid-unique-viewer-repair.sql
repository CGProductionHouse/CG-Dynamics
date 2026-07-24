-- ============================================================================
-- Phase 20g - Repair invalid Facebook unique-viewer facts
--
-- The first Graph v25 connector pass treated a daily
-- page_total_media_view_unique series as a monthly total. Unique audiences
-- cannot be summed across days. The normal fact upsert intentionally preserves
-- verified values when a later probe is unavailable, so this one-time repair
-- replaces only facts whose stored source snapshot proves that invalid shape.
-- ============================================================================

begin;

with invalid_facts as (
  select
    f.id as fact_id,
    latest_snapshot.id as snapshot_id,
    latest_snapshot.sync_run_id,
    latest_snapshot.retrieved_at
  from public.platform_metric_facts_monthly f
  join public.platform_metric_snapshots invalid_snapshot
    on invalid_snapshot.id = nullif(f.provenance ->> 'snapshot_id', '')::uuid
  join lateral (
    select s.id, s.sync_run_id, s.retrieved_at
    from public.platform_metric_snapshots s
    where s.client_id = f.client_id
      and s.platform = f.platform
      and s.period_month = f.period_month
      and s.source_metric = f.source_metric
      and s.availability = 'unavailable'
      and s.value is null
      and s.retrieved_at > invalid_snapshot.retrieved_at
    order by s.retrieved_at desc
    limit 1
  ) latest_snapshot on true
  where f.platform = 'facebook'
    and f.metric_key = 'unique_viewers'
    and f.source_metric = 'page_total_media_view_unique'
    and f.availability in ('complete', 'valid_zero')
    and f.value is not null
    and invalid_snapshot.raw_snapshot #> '{source_response,data,0,values}' is not null
    and jsonb_typeof(
      invalid_snapshot.raw_snapshot #> '{source_response,data,0,values}'
    ) = 'array'
    and jsonb_array_length(
      invalid_snapshot.raw_snapshot #> '{source_response,data,0,values}'
    ) > 1
)
update public.platform_metric_facts_monthly f
set
  value = null,
  availability = 'unavailable',
  provenance = jsonb_build_object(
    'endpoint', 'total_value',
    'error_code', null,
    'snapshot_id', invalid_facts.snapshot_id,
    'sync_run_id', invalid_facts.sync_run_id,
    'token_class', 'page',
    'retrieved_at', invalid_facts.retrieved_at,
    'response_shape', 'error',
    'repair', 'daily_unique_series_not_summable'
  ),
  sync_run_id = invalid_facts.sync_run_id,
  verified_at = invalid_facts.retrieved_at
from invalid_facts
where f.id = invalid_facts.fact_id;

commit;
