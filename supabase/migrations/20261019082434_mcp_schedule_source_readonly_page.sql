-- PREPARED ONLY: no production apply. Reuse existing captured source arrays.
-- No new store, source fetch, job stamp, task/schedule write or RLS grant.
create or replace function public.read_mcp_schedule_source_page(
  p_actor_profile_id uuid, p_run_id uuid, p_source_id text,
  p_offset integer default 0, p_expected_revision text default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_run public.microsoft_sync_runs;
  v_job public.microsoft_sync_jobs;
  v_source public.microsoft_sync_job_sources;
  v_revision text;
  v_records jsonb;
  v_label text;
begin
  if current_user <> 'service_role' or not exists (
    select 1 from public.profiles where id=p_actor_profile_id and is_active and role='admin'
  ) then raise exception 'Exact active company admin required'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 or nullif(btrim(p_source_id),'') is null or length(p_source_id)>512 then
    raise exception 'Invalid source page identity';
  end if;
  if p_offset>0 and p_expected_revision is null then raise exception 'Pinned source revision required'; end if;
  select * into v_run from public.microsoft_sync_runs where id=p_run_id;
  if not found or v_run.status not in ('completed','partial') or v_run.finished_at is null or v_run.preview_job_id is null then
    raise exception 'Exact finished run with durable source job required';
  end if;
  select * into v_job from public.microsoft_sync_jobs where id=v_run.preview_job_id;
  if not found or v_job.status<>'complete' or v_job.exported_at is distinct from v_run.snapshot_exported_at
    or v_job.updated_at>v_run.finished_at then raise exception 'Run/source job binding unavailable'; end if;
  select * into v_source from public.microsoft_sync_job_sources
    where job_id=v_job.id and source_type='planner_plan' and source_id=p_source_id;
  if not found then raise exception 'Exact captured Planner source required'; end if;
  -- Conservative SQL defence; the existing canonical TS plan mapper is checked again by MCP.
  v_label:=btrim(regexp_replace(lower(v_source.source_name),'[^a-z0-9]+',' ','g'));
  if v_label<>'2025 clients schedule' and v_label not like 'client socials %' then
    raise exception 'Only protected Client Schedule source evidence is readable here';
  end if;
  if v_source.stage<>'complete' or not v_source.complete or v_source.safe_error is not null
    or v_source.pagination_cursor is not null or jsonb_typeof(v_source.records) is distinct from 'array'
    or v_source.record_count<0 or v_source.record_count>100000
    or jsonb_array_length(v_source.records)<>v_source.record_count or v_source.updated_at>v_run.finished_at
    or not exists (select 1 from jsonb_array_elements(v_run.source_completeness) item
      where item->>'sourceType'='planner_plan' and item->>'sourceId'=v_source.source_id
        and item->>'sourceName'=v_source.source_name and item->>'complete'='true'
        and item->>'safeError' is null and (item->>'recordCount')::integer=v_source.record_count)
    then raise exception 'Captured source coverage is unavailable, not empty'; end if;
  if p_offset>v_source.record_count then raise exception 'Source offset exceeds captured coverage'; end if;
  -- Drift token, not a credential/signature. Includes the actual JSON payload as well as metadata.
  v_revision:=md5(jsonb_build_object('run',v_run.id,'job',v_job.id,'source',v_source.id,
    'export',extract(epoch from v_job.exported_at),'updated',extract(epoch from v_source.updated_at),
    'name',v_source.source_name,'count',v_source.record_count,'records',v_source.records)::text);
  if p_expected_revision is not null and p_expected_revision<>v_revision then raise exception 'Captured source drift; restart the read'; end if;
  if exists (
    select 1 from generate_series(p_offset,least(p_offset+49,v_source.record_count-1)) n
    cross join lateral (select v_source.records->n as item) selected
    where jsonb_typeof(item) is distinct from 'object'
      or length(coalesce(item->>'description',''))>32768
      or exists (select 1 from unnest(array['sourceType','sourcePlanId','sourcePlanName',
        'sourceBucketId','sourceBucketName','sourceTaskId','title','startDate','dueDate','completedDate']) key
        where length(coalesce(item->>key,''))>512)
  ) then raise exception 'Captured source page exceeds safe projection bounds'; end if;
  -- At most50 elements leave PostgreSQL. Private description is server-only privacy input;
  -- the MCP projection never returns it or raw task/bucket text to the Assistant.
  select coalesce(jsonb_agg(jsonb_build_object(
    'sourceType',item->'sourceType','sourcePlanId',item->'sourcePlanId','sourcePlanName',item->'sourcePlanName',
    'sourceBucketId',item->'sourceBucketId','sourceBucketName',item->'sourceBucketName','sourceTaskId',item->'sourceTaskId',
    'title',item->'title','description',item->'description','startDate',item->'startDate',
    'dueDate',item->'dueDate','completedDate',item->'completedDate','percentComplete',item->'percentComplete'
  ) order by n),'[]'::jsonb) into v_records
  from generate_series(p_offset,least(p_offset+49,v_source.record_count-1)) n
  cross join lateral (select v_source.records->n as item) selected;
  return jsonb_build_object('contract','microsoft_schedule_source_page_v1','run_id',v_run.id,'job_id',v_job.id,
    'source_id',v_source.source_id,'source_name',v_source.source_name,'source_revision',v_revision,
    'captured_at',v_job.exported_at,'record_count',v_source.record_count,'offset',p_offset,
    'records',v_records,'source_complete',true);
end $$;
revoke all on function public.read_mcp_schedule_source_page(uuid,uuid,text,integer,text) from public,anon,authenticated;
grant execute on function public.read_mcp_schedule_source_page(uuid,uuid,text,integer,text) to service_role;
