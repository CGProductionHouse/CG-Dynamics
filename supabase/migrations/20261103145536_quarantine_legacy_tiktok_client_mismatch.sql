-- Exact historical repair: All Around PVC's September TikTok facts came from
-- the connection now durably owned by Wiseman Group. Preserve private evidence,
-- remove the wrong client's public numeric values, and leave every other fact.
-- No mapping, permission, provider call, report publication or schema change.
do $quarantine$
declare
  v_target constant uuid := 'fd16ebae-a50b-4920-afe0-94c2631f8f06';
  v_run constant uuid := '644ccb60-c294-4512-8e4c-c7d1b577a04b';
  v_connection constant uuid := '4bc29c96-dc18-43b0-ac17-f65f18a8279b';
  v_actual_owner constant uuid := '899c9988-8207-4e45-a8fc-a7446dfcf96b';
  v_expected constant jsonb := '{"comments":0,"current_followers":284,"following_count":76,"likes":0,"shares":0,"total_likes":764,"video_count":37,"views":0}';
  v_count integer;
begin
  perform 1 from public.platform_metric_facts_monthly
    where client_id=v_target and platform='tiktok' and period_month='2026-09'
      and sync_run_id=v_run order by id for update;
  select count(*) into v_count from public.platform_metric_facts_monthly
    where client_id=v_target and platform='tiktok' and period_month='2026-09' and sync_run_id=v_run;
  -- Fresh installations need no historical data repair.
  if v_count=0 then return; end if;
  if v_count<>8 then raise exception 'Expected the exact eight reviewed TikTok facts'; end if;
  if not exists(select 1 from public.platform_sync_runs r
    join public.tiktok_connections c on c.id=r.connection_id
    where r.id=v_run and r.platform='tiktok' and r.client_id=v_target
      and r.connection_id=v_connection and c.client_id=v_actual_owner)
  then raise exception 'Reviewed provider identity mismatch has changed'; end if;
  if not exists(select 1 from public.platform_metric_facts_monthly f
    where f.client_id=v_target and f.platform='tiktok' and f.period_month='2026-09' and f.sync_run_id=v_run
      and (f.value is not null or f.availability<>'unavailable'
        or f.provenance->'client_identity_quarantine'->>'version' is distinct from '1'))
  then return; end if;
  if exists(select 1 from public.platform_metric_facts_monthly f
    where f.client_id=v_target and f.platform='tiktok' and f.period_month='2026-09' and f.sync_run_id=v_run
      and (not (v_expected ? f.metric_key) or f.value is distinct from (v_expected->>f.metric_key)::numeric
        or f.availability<>'partial' or f.connector_version<>'tiktok-v1'
        or f.provenance ? 'client_identity_quarantine'))
    or (select count(distinct metric_key) from public.platform_metric_facts_monthly
      where client_id=v_target and platform='tiktok' and period_month='2026-09' and sync_run_id=v_run)<>8
  then raise exception 'Historical fact values changed; review instead of overwriting'; end if;
  update public.platform_metric_facts_monthly f set
    value=null, availability='unavailable',
    provenance=coalesce(f.provenance,'{}'::jsonb)||jsonb_build_object('client_identity_quarantine',
      jsonb_build_object('version',1,'reason','Historical TikTok connection belongs to a different client',
        'held_at',clock_timestamp(),'source_run_id',v_run,'source_connection_id',v_connection,
        'source_connection_client_id',v_actual_owner,'original_value',f.value,
        'original_availability',f.availability))
  where f.client_id=v_target and f.platform='tiktok' and f.period_month='2026-09' and f.sync_run_id=v_run;
  get diagnostics v_count=row_count;
  if v_count<>8 then raise exception 'Quarantine scope changed'; end if;
end;
$quarantine$;
