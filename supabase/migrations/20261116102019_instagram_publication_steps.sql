-- #220 / #236. REVIEW ONLY. Extend existing background_jobs; no new queue/table.
begin;

-- Preserve the proven generic lease/receipt implementations, including late
-- receipt retention and all non-Instagram behavior, behind service-only wrappers.
alter function public.claim_social_publication(uuid,text) rename to claim_social_publication_lease_v1;
alter function public.save_social_publication(uuid,text,text,jsonb) rename to save_social_publication_receipt_v1;

create function public.claim_social_publication(p_id uuid,p_worker text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; j public.background_jobs;
begin
 result:=public.claim_social_publication_lease_v1(p_id,p_worker);
 if result is null or result->'intent'->>'platform'<>'instagram' then return result; end if;
 select * into j from public.background_jobs where id=p_id;
 -- Read protocol from its durable record, NOT a late observation/payload hint.
 return result||jsonb_build_object('instagram',jsonb_build_object(
  'phase',coalesce(j.publication->'instagram'->>'phase','container_creating'),
  'publishAttempted',coalesce((j.publication->'instagram'->>'publishAttempted')::boolean,false),
  'statusReads',coalesce((j.publication->'instagram'->>'statusReads')::integer,0),
  'startedAt',j.publication->>'started_at'));
end $$;

create function public.begin_instagram_publication_publish(p_id uuid,p_worker text,p_fence text,p_container_id text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs; i jsonb;
begin
 select * into j from public.background_jobs where id=p_id for update;
 i:=j.payload->'intent';
 if nullif(btrim(p_worker),'') is null or nullif(p_fence,'') is null or coalesce(p_container_id,'')!~'^[0-9]+$'
  or j.job_type is distinct from 'social_publish' or j.status is distinct from 'running'
  or j.locked_by is distinct from p_worker or j.publication->>'fence' is distinct from p_fence
  or j.locked_at is null or j.locked_at<=now()-interval '5 minutes'
  or j.publication->>'state' is distinct from 'processing'
  or i->>'platform' is distinct from 'instagram'
  or coalesce(i->>'route','') not in ('instagram_login','instagram_facebook_login')
  or i->>'mediaType' is distinct from 'image/jpeg'
  or j.publication->'instagram'->>'phase' is distinct from 'container_ready'
  or j.publication->'instagram'->>'publishAttempted' is distinct from 'false'
  or j.publication->'observation'->>'operationId' is distinct from p_container_id
  or j.publication->'observation'->>'postId' is not null
  or j.publication->>'started_at' is null or (j.publication->>'started_at')::timestamptz<now()-interval '5 minutes'
  or (j.publication->>'started_at')::timestamptz>now()
  or coalesce((j.publication->'instagram'->>'statusReads')::integer,0)>=5
 then return false; end if;
 if j.publication->'authorization' is null
  or j.publication->'authorization'->>'id' is distinct from i->>'authorizationId'
  or j.publication->'authorization'->>'actorId' is distinct from j.payload->>'authorized_by'
  or j.publication->'authorization'->>'revokedAt' is not null
  or j.publication->'authorization'->>'fingerprint' is distinct from public.social_publication_fingerprint(i)
 then return false; end if;
 perform 1 from public.profiles where id=(j.payload->>'authorized_by')::uuid and is_active and role in ('admin','manager') for share;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',i->>'deliverableId',i->>'platform',i->>'accountId'),0));
 if exists(select 1 from public.background_jobs old where old.id<>j.id and old.job_type='social_publish'
  and old.payload->'intent'->>'deliverableId'=i->>'deliverableId' and old.payload->'intent'->>'platform'=i->>'platform'
  and old.payload->'intent'->>'accountId'=i->>'accountId'
  and old.publication->>'state' in ('submitting','processing','provider_scheduled','posted','unknown_outcome')) then return false; end if;
 perform public.check_social_publication_source(i);
 if (i->>'scheduledAt')::timestamptz>now() or (i->>'scheduledAt')::timestamptz<now()-interval '15 minutes' then return false; end if;
 update public.background_jobs set publication=publication||jsonb_build_object('state','submitting',
  'submission_fence',p_fence,'submission_worker',p_worker,
  'instagram',publication->'instagram'||jsonb_build_object('phase','publishing','publishAttempted',true,'publishStartedAt',now())),
  locked_at=now(),updated_at=now() where id=j.id;
 return true;
end $$;

create function public.save_social_publication(p_id uuid,p_worker text,p_fence text,p_observation jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs; old_op text; old_post text; op text; post text; phase text; attempted boolean; reads integer; saved boolean;
begin
 select * into j from public.background_jobs where id=p_id for update;
 if j.payload->'intent'->>'platform' is distinct from 'instagram' then
  return public.save_social_publication_receipt_v1(p_id,p_worker,p_fence,p_observation);
 end if;
 if jsonb_typeof(p_observation) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_observation) k
  where k not in ('state','operationId','postId','errorCode','instagramPhase')) then raise exception 'Exact Instagram receipt required'; end if;
 old_op:=j.publication->'observation'->>'operationId'; old_post:=j.publication->'observation'->>'postId';
 op:=coalesce(p_observation->>'operationId',old_op); post:=coalesce(p_observation->>'postId',old_post);
 if (op is not null and op!~'^[0-9]+$') or (post is not null and (post!~'^[0-9]+$' or post=op))
  or (old_op is not null and op is distinct from old_op) or (old_post is not null and post is distinct from old_post)
 then raise exception 'Immutable Instagram receipt identities required'; end if;
 -- Old lease receipts remain evidence only. They cannot advance phase/counters.
 if j.status is distinct from 'running' or j.locked_by is distinct from p_worker
  or j.publication->>'fence' is distinct from p_fence or j.locked_at is null or j.locked_at<=now()-interval '5 minutes' then
  return public.save_social_publication_receipt_v1(p_id,p_worker,p_fence,p_observation);
 end if;
 attempted:=coalesce((j.publication->'instagram'->>'publishAttempted')::boolean,false);
 phase:=coalesce(p_observation->>'instagramPhase',j.publication->'instagram'->>'phase',case when op is null then 'container_creating' else 'container_processing' end);
 if phase not in ('container_creating','container_processing','container_ready','publishing','verifying')
  or (not attempted and (post is not null or phase in ('publishing','verifying') or p_observation->>'state'='posted'))
  or (attempted and phase in ('container_creating','container_processing','container_ready'))
  or (p_observation->>'state'='processing' and op is null)
  or (phase='container_ready' and (old_op is null or coalesce(j.publication->'instagram'->>'phase','') not in ('container_processing','container_ready')))
 then raise exception 'Ordered Instagram publication phase required'; end if;
 reads:=coalesce((j.publication->'instagram'->>'statusReads')::integer,0)+case when old_op is not null then 1 else 0 end;
 if reads>=5 and p_observation->>'state'='processing' then
  p_observation:=p_observation||jsonb_build_object('state','unknown_outcome','errorCode','INSTAGRAM_BOUNDED_REVIEW_REQUIRED');
 end if;
 saved:=public.save_social_publication_receipt_v1(p_id,p_worker,p_fence,p_observation);
 if saved then
  update public.background_jobs set publication=publication||jsonb_build_object('instagram',
   coalesce(publication->'instagram','{}'::jsonb)||jsonb_build_object('phase',phase,'publishAttempted',attempted,'statusReads',reads)),
   run_after=case when publication->>'state'='processing' then now()+interval '60 seconds' else run_after end where id=p_id;
 end if;
 return saved;
end $$;

revoke all on function public.claim_social_publication(uuid,text),public.save_social_publication(uuid,text,text,jsonb),
 public.begin_instagram_publication_publish(uuid,text,text,text),public.claim_social_publication_lease_v1(uuid,text),
 public.save_social_publication_receipt_v1(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.claim_social_publication(uuid,text),public.save_social_publication(uuid,text,text,jsonb),
 public.begin_instagram_publication_publish(uuid,text,text,text),public.claim_social_publication_lease_v1(uuid,text),
 public.save_social_publication_receipt_v1(uuid,text,text,jsonb) to service_role;
commit;
