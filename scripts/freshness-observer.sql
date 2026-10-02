-- #451/#623: one MVCC snapshot, SELECT only; never call application RPCs.
WITH bounds AS (SELECT '{{FROM}}'::timestamptz AS lo, '{{TO}}'::timestamptz AS hi),
jobs AS (
  SELECT j.* FROM public.microsoft_sync_jobs j
  ORDER BY j.created_at DESC, j.id LIMIT 20
), sources AS (
  SELECT s.* FROM public.microsoft_sync_job_sources s
  WHERE s.job_id=(SELECT id FROM jobs ORDER BY created_at DESC,id LIMIT 1)
), runs AS (
  SELECT r.* FROM public.microsoft_sync_runs r
  WHERE r.preview_job_id IN (SELECT id FROM jobs)
    OR r.id=(SELECT id FROM public.microsoft_sync_runs WHERE status='completed' AND trigger_type='agent' ORDER BY applied_at DESC NULLS LAST,id LIMIT 1)
    OR (r.status='applying' AND r.created_at >= '2026-07-01' AND r.created_at < '2026-08-01' AND (r.trigger_type <> 'agent' OR r.preview_job_id IS NULL))
), assets AS (
  SELECT a.id,a.client_id,a.connection_id,a.facebook_page_id,a.instagram_account_id,a.updated_at,c.last_connected_at
  FROM public.meta_client_assets a JOIN public.clients cl ON cl.id=a.client_id AND cl.active
  LEFT JOIN public.meta_connections c ON c.id=a.connection_id
  WHERE a.is_active AND (a.facebook_page_id IS NOT NULL OR a.instagram_account_id IS NOT NULL)
), items AS (
  SELECT i.*,b.summary->>'via' AS via FROM public.meta_sync_batch_items i
  JOIN public.meta_sync_batches b ON b.id=i.batch_id CROSS JOIN bounds w
  WHERE i.created_at >= w.lo - interval '1 hour' OR i.status IN ('queued','running')
), facts AS (
  SELECT f.* FROM public.platform_metric_facts_monthly f
  JOIN assets a ON a.id=f.asset_id AND a.client_id=f.client_id
  WHERE f.platform IN ('facebook','instagram')
), guards AS (
  SELECT 'monthly_deliverables' AS scope,d.id::text AS id,to_jsonb(d)::text AS row FROM public.monthly_deliverables d
  UNION ALL SELECT 'native_planner',p.id::text,to_jsonb(p)::text FROM public.planner_tasks p WHERE p.microsoft_task_id IS NULL
  UNION ALL SELECT 'native_calendar',c.id::text,to_jsonb(c)::text FROM public.company_calendar_events c WHERE c.microsoft_event_id IS NULL AND c.microsoft_calendar_id IS NULL
  UNION ALL SELECT 'july_manual_apply',r.id::text,to_jsonb(r)::text FROM public.microsoft_sync_runs r WHERE r.created_at >= '2026-07-01' AND r.created_at < '2026-08-01' AND (r.trigger_type <> 'agent' OR r.preview_job_id IS NULL)
), guard_scopes AS (
  SELECT unnest(ARRAY['monthly_deliverables','native_planner','native_calendar','july_manual_apply']) AS scope
), tables AS (
  SELECT unnest(ARRAY['public.microsoft_sync_jobs','public.microsoft_sync_job_sources','public.microsoft_sync_runs','public.microsoft_sync_run_items','public.monthly_deliverables','public.planner_tasks','public.company_calendar_events','public.clients','public.meta_connections','public.meta_client_assets','public.meta_sync_batches','public.meta_sync_batch_items','public.meta_asset_sync_checkpoints','public.platform_metric_facts_monthly','public.platform_sync_runs','cron.job','cron.job_run_details']) AS name
), mirror_observations AS (
  SELECT s.job_id,s.id AS source_row_id,s.source_id,s.source_name,s.updated_at AS observed_at,
    r->>'sourceType' AS source_type,r->>'sourceTaskId' AS task_id,r->>'sourceEventId' AS event_id,
    r->>'sourceCalendarId' AS calendar_id,r->>'sourcePlanId' AS plan_id,
    r->>'percentComplete' AS percent_complete,r->>'cancelled' AS cancelled,
    p.id AS planner_id,p.status AS planner_status,p.client_id AS planner_client_id,
    c.id AS calendar_row_id,c.status AS calendar_status,c.client_id AS calendar_client_id
  FROM sources s CROSS JOIN LATERAL jsonb_array_elements(s.records) r
  LEFT JOIN public.planner_tasks p ON r->>'sourceType'='planner_task' AND p.microsoft_plan_id=r->>'sourcePlanId' AND p.microsoft_task_id=r->>'sourceTaskId'
  LEFT JOIN public.company_calendar_events c ON r->>'sourceType'='outlook_event' AND c.microsoft_calendar_id=r->>'sourceCalendarId' AND c.microsoft_event_id=r->>'sourceEventId'
  WHERE s.job_id=(SELECT id FROM jobs ORDER BY created_at DESC,id LIMIT 1)
    AND (r->>'percentComplete'='100' OR r->>'cancelled'='true')
)
SELECT jsonb_build_object(
 'observed_at',now(),'window',jsonb_build_object('from',(SELECT lo FROM bounds),'to',(SELECT hi FROM bounds)),
 'unfiltered',NOT EXISTS(SELECT 1 FROM tables WHERE row_security_active(name::regclass)),
 'jobs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'status',status,'created_at',created_at,'updated_at',updated_at,'exported_at',exported_at,'automatic_retry_count',automatic_retry_count,'automatic_retry_after',automatic_retry_after,'has_failure',automatic_failure IS NOT NULL) ORDER BY created_at DESC,id) FROM jobs),'[]'::jsonb),
 'sources',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'job_id',job_id,'position',position,'source_type',source_type,'source_id',source_id,'source_name',source_name,'required',required,'stage',stage,'record_count',record_count,'complete',complete,'has_error',safe_error IS NOT NULL,'records_count',jsonb_array_length(records),'pending_details',jsonb_array_length(pending_detail_ids),'has_cursor',pagination_cursor IS NOT NULL,'updated_at',updated_at) ORDER BY job_id,position,id) FROM sources),'[]'::jsonb),
 'runs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'preview_job_id',preview_job_id,'trigger_type',trigger_type,'status',status,'created_at',created_at,'started_at',started_at,'applied_at',applied_at,'finished_at',finished_at,'automatic_recovery_count',automatic_recovery_count,'automatic_recovery_after',automatic_recovery_after,'has_error',safe_error IS NOT NULL,'applied',summary->'applied','skipped',summary->'skipped','failed',summary->'failed','conflicts',summary->'conflicts','client_schedule_excluded',summary->'clientScheduleExcluded','source_completeness',(SELECT COALESCE(jsonb_agg(jsonb_build_object('sourceId',s->'sourceId','sourceName',s->'sourceName','recordCount',s->'recordCount','complete',s->'complete','has_error',s->>'safeError' IS NOT NULL)),'[]'::jsonb) FROM jsonb_array_elements(source_completeness) s)) ORDER BY created_at,id) FROM runs),'[]'::jsonb),
 'mirror_observations',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY job_id,source_row_id,task_id,event_id,planner_id,calendar_row_id) FROM (SELECT * FROM mirror_observations LIMIT 20001) m),'[]'::jsonb),
 'planner_plan_guards',COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY plan_id) FROM (SELECT p.microsoft_plan_id AS plan_id,count(*) AS count,encode(sha256(convert_to(string_agg(encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex'),'' ORDER BY p.id),'UTF8')),'hex') AS hash FROM public.planner_tasks p WHERE p.microsoft_plan_id IS NOT NULL GROUP BY p.microsoft_plan_id) g),'[]'::jsonb),
 'protected',COALESCE((SELECT jsonb_agg(jsonb_build_object('scope',s.scope,'count',(SELECT count(*) FROM guards g WHERE g.scope=s.scope),'hash',(SELECT encode(sha256(convert_to(COALESCE(string_agg(encode(sha256(convert_to(g.row,'UTF8')),'hex'),'' ORDER BY g.id),''),'UTF8')),'hex') FROM guards g WHERE g.scope=s.scope)) ORDER BY s.scope) FROM guard_scopes s),'[]'::jsonb),
 'assets',COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM assets a),'[]'::jsonb),
 'checkpoints',COALESCE((SELECT jsonb_agg((to_jsonb(c)-'last_error_code') || jsonb_build_object('has_error',c.last_error_code IS NOT NULL) ORDER BY c.asset_id,c.platform) FROM public.meta_asset_sync_checkpoints c JOIN assets a ON a.id=c.asset_id AND a.client_id=c.client_id),'[]'::jsonb),
 'platform_runs',COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT r.id,r.client_id,r.asset_id,r.platform,r.period_month,r.status,r.health_state,r.started_at,r.finished_at FROM public.platform_sync_runs r JOIN assets a ON a.id=r.asset_id AND a.client_id=r.client_id CROSS JOIN bounds w WHERE r.id IN (SELECT sync_run_id FROM facts) OR r.started_at>=w.lo LIMIT 20001) r),'[]'::jsonb),
 'facts',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY id) FROM (SELECT id,client_id,asset_id,platform,period_month,metric_key,source_metric,value,availability,verified_at,updated_at,sync_run_id,comparable_group,api_version,connector_version FROM facts LIMIT 20001) f),'[]'::jsonb),
 'items',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM (SELECT id,batch_id,asset_id,client_id,month,status,attempts,facebook_sync_state,instagram_sync_state,lease_generation,created_at,started_at,finished_at,cooldown_until,via,
   CASE WHEN error IS NULL THEN NULL
     WHEN error ~* 'AbortError|signal has been aborted|request.timeout' THEN 'AbortError: The signal has been aborted'
     WHEN error LIKE '%Mapped Page access failed (%' THEN 'Mapped Page access failed (code: ' || COALESCE(substring(error FROM 'code: ([0-9]+)'),'unknown') || ')'
     WHEN error LIKE '%Meta did not grant a Page token for this mapped Page.%' THEN 'Meta did not grant a Page token for this mapped Page. Reconnect with the required Page access.'
     WHEN error LIKE 'Facebook page token unavailable for linked page.%' THEN 'Facebook page token unavailable for linked page. Relink Meta or verify page access.'
     WHEN error LIKE 'Facebook account facts are permission blocked.%' THEN 'Facebook account facts are permission blocked.'
     WHEN error LIKE 'Instagram account facts are permission blocked.%' THEN 'Instagram account facts are permission blocked.'
     ELSE COALESCE(substring(error FROM '^(Facebook|Instagram)'),'Unknown') || ' failure (code: ' || COALESCE(substring(error FROM 'code: ([0-9]+)'),'unknown') || ')' END AS error,
   facebook_next_cursor IS NOT NULL AS facebook_has_cursor,instagram_next_cursor IS NOT NULL AS instagram_has_cursor
   FROM items LIMIT 20001) i),'[]'::jsonb),
 'batches',COALESCE((SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM (SELECT b.id,b.status,b.created_at,b.finished_at,b.worker_heartbeat_at,b.recovery_attempts,b.cooldown_until,b.total_items,b.failed_items,b.completed_items,b.summary->>'via' AS via,(SELECT count(*) FROM public.meta_sync_batch_items i WHERE i.batch_id=b.id) AS actual_items FROM public.meta_sync_batches b CROSS JOIN bounds w WHERE b.created_at >= w.lo AND b.created_at < w.hi LIMIT 20001) b),'[]'::jsonb),
 'ticks',COALESCE((SELECT jsonb_agg(jsonb_build_object('minute',t,'dispatches',(SELECT count(*) FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid WHERE j.jobname='cg-background-worker' AND d.start_time>=t AND d.start_time<t+interval '1 minute'),'succeeded_dispatches',(SELECT count(*) FROM cron.job_run_details d JOIN cron.job j ON j.jobid=d.jobid WHERE j.jobname='cg-background-worker' AND d.status='succeeded' AND d.start_time>=t AND d.start_time<t+interval '1 minute'),'fleet_batches',(SELECT count(*) FROM public.meta_sync_batches b WHERE b.summary->>'via'='fleet_freshness' AND b.created_at>=t AND b.created_at<t+interval '1 minute')) ORDER BY t) FROM bounds w CROSS JOIN LATERAL generate_series(w.lo,w.hi-interval '1 minute',interval '1 minute') t),'[]'::jsonb),
 'scheduler',COALESCE((SELECT jsonb_agg(jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active,'username',username,'database',database,'targets_worker',command LIKE '%https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/background-worker%','timeout_30000',command LIKE '%30000%')) FROM cron.job WHERE jobname='cg-background-worker'),'[]'::jsonb)
) AS evidence;
