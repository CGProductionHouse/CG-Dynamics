-- REVIEW ONLY. Narrow read of the EXISTING Microsoft capture, never a collector,
-- refresh, apply, mapping or task write. No source titles/descriptions leave SQL.
begin;
create function public.read_social_publication_schedule_evidence(p_actor uuid,p_deliverable uuid,p_review uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare d public.monthly_deliverables; r public.content_review_versions;
 s public.microsoft_sync_job_sources; j public.microsoft_sync_jobs; run public.microsoft_sync_runs;
 n integer; task jsonb; revision text; label text;
begin
 if current_user<>'service_role' or not exists(select 1 from public.profiles where id=p_actor and is_active and role in ('admin','manager'))
 then raise exception 'Active publication manager required'; end if;
 select * into d from public.monthly_deliverables where id=p_deliverable;
 select * into r from public.content_review_versions where id=p_review;
 if d.id is null or r.id is null or r.deliverable_id<>d.id or r.client_id<>d.client_id or r.state<>'approved'
  or d.archived_at is not null or d.posted_at is not null or d.production_status in ('scheduled','posted')
  or not exists(select 1 from public.clients where id=d.client_id and active)
  or d.microsoft_source_type is distinct from 'planner_task' or nullif(btrim(d.microsoft_plan_id),'') is null
  or nullif(btrim(d.microsoft_task_id),'') is null
  or exists(select 1 from public.monthly_deliverables other where other.id<>d.id and other.archived_at is null
    and other.microsoft_plan_id=d.microsoft_plan_id and other.microsoft_task_id=d.microsoft_task_id)
 then raise exception 'Exact unscheduled approved source required'; end if;
 -- New/incomplete captures for this exact plan supersede old successful ones.
 -- Never fall back to an older export after a more recent failure/in-flight job.
 select src.* into s from public.microsoft_sync_job_sources src join public.microsoft_sync_jobs job on job.id=src.job_id
 where src.source_type='planner_plan' and src.source_id=d.microsoft_plan_id order by job.created_at desc,job.id desc limit 1;
 if s.id is null then raise exception 'Captured schedule evidence unavailable'; end if;
 select * into j from public.microsoft_sync_jobs where id=s.job_id;
 select * into run from public.microsoft_sync_runs where preview_job_id=j.id order by finished_at desc nulls first,id desc limit 1;
 label:=btrim(regexp_replace(lower(s.source_name),'[^a-z0-9]+',' ','g'));
 -- Same conservative protected-source boundary as read_mcp_schedule_source_page;
 -- this is an exact-ID projection, never client matching by plan/task title.
 if (label<>'2025 clients schedule' and label not like 'client socials %')
  or j.status is distinct from 'complete' or j.exported_at is null or not isfinite(j.exported_at)
  or j.exported_at<now()-interval '5 minutes' or j.exported_at>now()+interval '30 seconds'
  or j.created_at is null or j.created_at<now()-interval '5 minutes' or j.created_at>j.exported_at
  or s.updated_at is null or s.updated_at<now()-interval '5 minutes'
  or run.id is null or run.status not in ('completed','partial') or run.finished_at is null
  or not isfinite(run.finished_at) or run.finished_at>now()+interval '30 seconds'
  or run.snapshot_exported_at is distinct from j.exported_at or j.updated_at>run.finished_at or s.updated_at>run.finished_at
  or s.stage is distinct from 'complete' or s.complete is distinct from true or s.safe_error is not null or s.pagination_cursor is not null
  or jsonb_typeof(s.records) is distinct from 'array' or s.record_count<0 or s.record_count>100000
  or jsonb_array_length(s.records)<>s.record_count or jsonb_typeof(run.source_completeness) is distinct from 'array'
  or not exists(select 1 from jsonb_array_elements(run.source_completeness) item where item->>'sourceType'='planner_plan'
    and item->>'sourceId'=s.source_id and item->>'sourceName'=s.source_name and item->>'complete'='true'
    and item->>'safeError' is null and (item->>'recordCount')::integer=s.record_count)
 then raise exception 'Fresh complete captured schedule evidence required'; end if;
 select count(*),(jsonb_agg(item))->0 into n,task from jsonb_array_elements(s.records) item
 where item->>'sourceTaskId'=d.microsoft_task_id;
 if n<>1 or task->>'sourceType' is distinct from 'planner_task' or task->>'sourcePlanId' is distinct from d.microsoft_plan_id
  or task->>'sourcePlanName' is distinct from s.source_name or task->>'sourceBucketId' is distinct from d.microsoft_bucket_id
  or jsonb_typeof(task->'percentComplete') is distinct from 'number' or (task->>'percentComplete')::numeric not between 0 and 99
  or (task->>'percentComplete')::numeric<>trunc((task->>'percentComplete')::numeric)
  or task->>'completedDate' is not null or coalesce(task->>'dueDate','') !~ '^\d{4}-\d{2}-\d{2}$'
  or (task->>'dueDate')::date is distinct from d.scheduled_date
  or (r.scheduled_at at time zone 'Africa/Johannesburg')::date is distinct from d.scheduled_date
 then raise exception 'Current exact uncompleted posting instruction required'; end if;
 revision:=encode(sha256(convert_to(jsonb_build_object('run',run.id,'job',j.id,'source',s.id,'export',j.exported_at,'task',task)::text,'UTF8')),'hex');
 return jsonb_build_object('contract','social_publication_schedule_evidence_v1','clientId',d.client_id,'deliverableId',d.id,'reviewVersionId',r.id,
  'recordId',d.microsoft_task_id,'revision',revision,'scheduledDate',d.scheduled_date,'capturedAt',j.exported_at,'checkedAt',now());
end $$;
revoke all on function public.read_social_publication_schedule_evidence(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_social_publication_schedule_evidence(uuid,uuid,uuid) to service_role;
commit;
