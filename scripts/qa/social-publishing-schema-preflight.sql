-- READ ONLY metadata preflight for the existing PR991 Facebook-first rollout.
-- Does not apply migrations, inspect business rows, sign media or enqueue/publish.
-- Run against the exact authorized project before any separately approved rollout.
-- A compatible result is NOT migration application or native/provider acceptance.
with required(table_name,column_name,type_name) as (values
('background_jobs','id','uuid'),('background_jobs','payload','jsonb'),('background_jobs','job_type','text'),('background_jobs','status','text'),('background_jobs','requested_by','uuid'),('background_jobs','locked_by','text'),('background_jobs','locked_at','timestamp with time zone'),('background_jobs','run_after','timestamp with time zone'),('background_jobs','idempotency_key','text'),
('profiles','id','uuid'),('profiles','role','text'),('profiles','is_active','boolean'),
('clients','id','uuid'),('clients','active','boolean'),
('monthly_deliverables','id','uuid'),('monthly_deliverables','client_id','uuid'),('monthly_deliverables','archived_at','timestamp with time zone'),('monthly_deliverables','posted_at','timestamp with time zone'),('monthly_deliverables','production_status','text'),('monthly_deliverables','scheduled_date','date'),('monthly_deliverables','microsoft_source_type','text'),('monthly_deliverables','microsoft_plan_id','text'),('monthly_deliverables','microsoft_task_id','text'),('monthly_deliverables','microsoft_bucket_id','text'),
('content_review_versions','id','uuid'),('content_review_versions','client_id','uuid'),('content_review_versions','deliverable_id','uuid'),('content_review_versions','state','text'),('content_review_versions','asset_path','text'),('content_review_versions','media_type','text'),('content_review_versions','caption','text'),('content_review_versions','channels','text[]'),('content_review_versions','scheduled_at','timestamp with time zone'),
('microsoft_sync_job_sources','job_id','uuid'),('microsoft_sync_job_sources','source_type','text'),('microsoft_sync_job_sources','source_id','text'),('microsoft_sync_job_sources','source_name','text'),('microsoft_sync_job_sources','records','jsonb'),('microsoft_sync_job_sources','record_count','integer'),('microsoft_sync_job_sources','complete','boolean'),('microsoft_sync_job_sources','safe_error','text'),('microsoft_sync_job_sources','pagination_cursor','text'),('microsoft_sync_job_sources','stage','text'),('microsoft_sync_job_sources','updated_at','timestamp with time zone'),
('microsoft_sync_jobs','id','uuid'),('microsoft_sync_jobs','status','text'),('microsoft_sync_jobs','exported_at','timestamp with time zone'),('microsoft_sync_jobs','created_at','timestamp with time zone'),('microsoft_sync_jobs','updated_at','timestamp with time zone'),
('microsoft_sync_runs','id','uuid'),('microsoft_sync_runs','preview_job_id','uuid'),('microsoft_sync_runs','status','text'),('microsoft_sync_runs','finished_at','timestamp with time zone'),('microsoft_sync_runs','snapshot_exported_at','timestamp with time zone'),('microsoft_sync_runs','source_completeness','jsonb')
), actual as (
select c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) type_name,c.relrowsecurity rls,c.oid table_oid
from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid
where n.nspname='public' and a.attnum>0 and not a.attisdropped
), migrations as (
select version from supabase_migrations.schema_migrations where version in ('20261115104948','20261115104950','20261116085815','20261116102019')
)
select jsonb_build_object(
'checked_at',now(),'required_column_count',(select count(*) from required),
'column_type_mismatches',(select coalesce(jsonb_agg(jsonb_build_object('table',r.table_name,'column',r.column_name,'expected',r.type_name,'actual',a.type_name)),'[]'::jsonb) from required r left join actual a using(table_name,column_name) where a.type_name is distinct from r.type_name),
'rls_disabled',(select coalesce(jsonb_agg(distinct r.table_name),'[]'::jsonb) from required r join actual a using(table_name,column_name) where not a.rls),
'service_role_table_access_missing',(select coalesce(jsonb_agg(distinct r.table_name),'[]'::jsonb) from required r join actual a using(table_name,column_name) where not has_table_privilege('service_role',a.table_oid,'SELECT')),
'applied_candidate_migrations',(select coalesce(jsonb_agg(version),'[]'::jsonb) from migrations),
'candidate_publication_column_exists',exists(select 1 from actual where table_name='background_jobs' and column_name='publication'),
'queue_name_collisions',(select coalesce(jsonb_agg(p.proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('social_publication_fingerprint','check_social_publication_source','enqueue_social_publication','authorize_social_publication','revoke_social_publication','claim_social_publication','begin_social_publication','save_social_publication','read_social_publication_schedule_evidence')),
'queue_index_collisions',(select coalesce(jsonb_agg(indexname),'[]'::jsonb) from pg_indexes where schemaname='public' and indexname in ('social_publication_exact_intent','social_publication_delivery_guard')),
'queue_policy_collision',exists(select 1 from pg_policies where schemaname='public' and tablename='background_jobs' and policyname='social publication active manager read'),
'background_job_type_constraint',(select pg_get_expr(conbin,conrelid) from pg_constraint where conrelid='public.background_jobs'::regclass and conname='background_jobs_allowed_type')
) as readiness;

