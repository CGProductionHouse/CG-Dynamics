-- #220. Reuse background_jobs; no second schedule/queue. REVIEW ONLY, not applied.
begin;
alter table public.background_jobs add column publication jsonb;

-- Generic jobs allow a requester to read their own history. Publication payloads
-- contain client creative/consent: a former manager becoming a client/staff or
-- inactive must not retain that access. Do not alter other job visibility.
create policy "social publication active manager read" on public.background_jobs
 as restrictive for select to authenticated using (
  job_type<>'social_publish' or exists(select 1 from public.profiles
   where id=auth.uid() and is_active and role in ('admin','manager'))
 );
do $$ declare expression text; begin
 select pg_get_expr(conbin,conrelid) into expression from pg_constraint
 where conrelid='public.background_jobs'::regclass and conname='background_jobs_allowed_type';
 if expression is not null then
  alter table public.background_jobs drop constraint background_jobs_allowed_type;
  execute format('alter table public.background_jobs add constraint background_jobs_allowed_type check ((%s) or job_type = %L) not valid',expression,'social_publish');
 end if;
end $$;
create unique index social_publication_exact_intent on public.background_jobs
 ((payload->'intent'->>'clientId'),(payload->'intent'->>'deliverableId'),
  (payload->'intent'->>'reviewVersionId'),(payload->'intent'->>'platform'),(payload->'intent'->>'accountId'))
 where job_type='social_publish';
create index social_publication_delivery_guard on public.background_jobs
 ((payload->'intent'->>'deliverableId'),(payload->'intent'->>'platform'),(payload->'intent'->>'accountId'))
 where job_type='social_publish';

-- Same UTF-8 length-prefixed projection as socialPublicationAuthorization.ts.
-- No JSON whitespace/order ambiguity, and no secret or provider delivery URL.
create function public.social_publication_fingerprint(p_intent jsonb) returns text
language sql immutable security invoker set search_path='' as $$
 select encode(sha256(convert_to(string_agg(octet_length(convert_to(value,'UTF8'))::text||':'||value,'' order by ordinal),'UTF8')),'hex')
 from jsonb_array_elements_text(jsonb_build_array('social-publication-confirmation:v1',
  p_intent->>'clientId',p_intent->>'deliverableId',p_intent->>'reviewVersionId',p_intent->>'platform',
  p_intent->>'route',p_intent->>'connectionId',p_intent->>'accountId',p_intent->>'assetPath',
  p_intent->>'assetSha256',p_intent->>'mediaType',p_intent->>'caption',p_intent->>'scheduledAt')) with ordinality as parts(value,ordinal);
$$;

create function public.check_social_publication_source(p_intent jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.content_review_versions; d public.monthly_deliverables;
begin
 select * into d from public.monthly_deliverables where id=(p_intent->>'deliverableId')::uuid for share;
 select * into r from public.content_review_versions where id=(p_intent->>'reviewVersionId')::uuid for share;
 if d.id is null or r.id is null or d.client_id::text is distinct from p_intent->>'clientId'
  or r.client_id<>d.client_id or r.deliverable_id<>d.id or r.state<>'approved'
  or d.archived_at is not null or d.posted_at is not null
  or not exists(select 1 from public.clients where id=d.client_id and active)
  or coalesce(not (p_intent->>'platform'=any(r.channels)),true)
  or (case p_intent->>'route' when 'facebook_page' then 'facebook'
    when 'instagram_login' then 'instagram' when 'instagram_facebook_login' then 'instagram'
    when 'tiktok_accounts' then 'tiktok' when 'linkedin_organization' then 'linkedin'
    when 'youtube_channel' then 'youtube' else null end) is distinct from p_intent->>'platform'
  or r.caption is distinct from p_intent->>'caption' or r.asset_path is distinct from p_intent->>'assetPath'
  or r.media_type is distinct from p_intent->>'mediaType'
  or r.scheduled_at is distinct from (p_intent->>'scheduledAt')::timestamptz
  or (r.scheduled_at at time zone 'Africa/Johannesburg')::date is distinct from d.scheduled_date
  or coalesce(p_intent->>'assetSha256','') !~ '^[a-f0-9]{64}$'
  or nullif(p_intent->>'accountId','') is null or nullif(p_intent->>'connectionId','') is null
  or nullif(p_intent->>'authorizationId','') is null or nullif(p_intent->>'key','') is null
  then raise exception 'Current exact approved publication source required'; end if;
end $$;

create function public.enqueue_social_publication(p_intent jsonb,p_actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare jid uuid;
begin
 if not exists(select 1 from public.profiles where id=p_actor and is_active and role in ('admin','manager'))
 then raise exception 'Active manager publication authorization required'; end if;
 perform public.check_social_publication_source(p_intent);
 if (p_intent->>'scheduledAt')::timestamptz<=now() then raise exception 'Future publication time required'; end if;
 -- Internal only: handler must obtain explicit actor consent and fresh provider
 -- preflight. Caller data is never a credential or permission grant.
 insert into public.background_jobs(job_type,payload,idempotency_key,requested_by,run_after,publication)
 values('social_publish',jsonb_build_object('intent',p_intent,'authorized_by',p_actor),p_intent->>'key',p_actor,
  (p_intent->>'scheduledAt')::timestamptz,jsonb_build_object('state','queued','polls',0))
 on conflict do nothing returning id into jid;
 if jid is null then
  select id into jid from public.background_jobs where job_type='social_publish'
   and payload->'intent'->>'clientId'=p_intent->>'clientId'
   and payload->'intent'->>'deliverableId'=p_intent->>'deliverableId'
   and payload->'intent'->>'reviewVersionId'=p_intent->>'reviewVersionId'
   and payload->'intent'->>'platform'=p_intent->>'platform'
   and payload->'intent'->>'accountId'=p_intent->>'accountId';
 end if;
 if jid is null then raise exception 'Publication intent conflict'; end if;
 return jid;
end $$;

-- Explicit staff confirmation is a separate fact from creative approval. Keep
-- it in the SAME job, atomically with enqueue; no second queue/consent table.
create function public.authorize_social_publication(p_intent jsonb,p_actor uuid,p_fingerprint text,p_evidence jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare jid uuid; j public.background_jobs; a jsonb; checked timestamptz;
begin
 perform 1 from public.profiles where id=p_actor and is_active and role in ('admin','manager') for share;
 if not found then raise exception 'Active manager publication authorization required'; end if;
 if p_fingerprint is distinct from public.social_publication_fingerprint(p_intent)
  or coalesce(p_fingerprint,'') !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_evidence) is distinct from 'object'
  or p_evidence-array['intentFingerprint','checkedAt','teamsRecordId','teamsRevision','mediaProfile'] <> '{}'::jsonb
  or p_evidence->>'intentFingerprint' is distinct from p_fingerprint
  or jsonb_typeof(p_evidence->'checkedAt') is distinct from 'string'
  or jsonb_typeof(p_evidence->'teamsRecordId') is distinct from 'string'
  or jsonb_typeof(p_evidence->'teamsRevision') is distinct from 'string'
  or jsonb_typeof(p_evidence->'mediaProfile') is distinct from 'string'
  or coalesce(length(btrim(p_evidence->>'teamsRecordId')),0) not between 1 and 512
  or coalesce(length(btrim(p_evidence->>'teamsRevision')),0) not between 1 and 512
  or coalesce(length(btrim(p_evidence->>'mediaProfile')),0) not between 1 and 128
 then raise exception 'Current exact publication confirmation required'; end if;
 checked:=(p_evidence->>'checkedAt')::timestamptz;
 if checked is null or not isfinite(checked) or checked<now()-interval '5 minutes' or checked>now()+interval '30 seconds'
 then raise exception 'Fresh server publication preflight required'; end if;
 jid:=public.enqueue_social_publication(p_intent,p_actor);
 select * into j from public.background_jobs where id=jid for update;
 if public.social_publication_fingerprint(j.payload->'intent') is distinct from p_fingerprint
 then raise exception 'Existing publication differs; review its recorded intent'; end if;
 a:=j.publication->'authorization';
 if a is not null then
  if a->>'fingerprint' is distinct from p_fingerprint or a->>'revokedAt' is not null
  then raise exception 'Existing publication authorization requires review'; end if;
  -- Repeated clicks return the original job/actor/confirmation, never reset it.
  return jsonb_build_object('jobId',jid,'authorizationId',a->>'id','fingerprint',p_fingerprint,
   'status',j.status,'state',j.publication->>'state');
 end if;
 if j.status<>'queued' or j.publication->>'state' is distinct from 'queued' or j.publication->>'started_at' is not null
 then raise exception 'Publication already claimed; reconciliation required'; end if;
 a:=jsonb_build_object('id',((j.payload->'intent'->>'authorizationId')::uuid)::text,'actorId',p_actor,
  'fingerprint',p_fingerprint,'confirmedAt',now(),'revokedAt',null,'evidence',p_evidence);
 update public.background_jobs set publication=publication||jsonb_build_object('authorization',a),
  payload=jsonb_set(payload,'{authorized_by}',to_jsonb(p_actor)),updated_at=now() where id=jid;
 return jsonb_build_object('jobId',jid,'authorizationId',a->>'id','fingerprint',p_fingerprint,'status',j.status,'state','queued');
end $$;

create function public.revoke_social_publication(p_id uuid,p_client uuid,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs; a jsonb; stopped boolean;
begin
 perform 1 from public.profiles where id=p_actor and is_active and role in ('admin','manager') for share;
 if not found then raise exception 'Active manager publication authorization required'; end if;
 select * into j from public.background_jobs where id=p_id and job_type='social_publish'
  and payload->'intent'->>'clientId'=p_client::text for update;
 if j.id is null then return null; end if;
 a:=j.publication->'authorization';
 if a is null then raise exception 'Recorded publication authorization required'; end if;
 if a->>'revokedAt' is null then
  a:=a||jsonb_build_object('revokedAt',now(),'revokedBy',p_actor);
  stopped:=j.publication->>'started_at' is null and j.publication->>'state' in ('queued','retry_wait','blocked');
  update public.background_jobs set publication=publication||jsonb_build_object('authorization',a)||
   case when stopped then jsonb_build_object('state','cancelled') else '{}'::jsonb end,
   status=case when stopped then 'cancelled' else status end,
   locked_by=case when stopped then null else locked_by end,locked_at=case when stopped then null else locked_at end,
   finished_at=case when stopped then now() else finished_at end,updated_at=now() where id=j.id returning * into j;
 end if;
 -- Revocation is NOT cancellation/deletion of an already-started provider post.
 return jsonb_build_object('jobId',j.id,'status',j.status,'state',j.publication->>'state',
  'authorizationRevoked',true,'providerMayHaveStarted',j.publication->>'started_at' is not null);
end $$;

-- The existing worker claims background_jobs first. This RPC fences that exact
-- lease, including a new fence when a pre-submission lease is recovered.
create function public.claim_social_publication(p_id uuid,p_worker text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs;
begin
 update public.background_jobs set publication=publication||jsonb_build_object('fence',gen_random_uuid()),updated_at=now()
 where id=p_id and job_type='social_publish' and status='running' and locked_by=p_worker
  and locked_at>now()-interval '5 minutes' returning * into j;
 if j.id is null then return null; end if;
 return jsonb_build_object('id',j.id,'key',j.idempotency_key,'intent',j.payload->'intent',
  'fence',j.publication->>'fence','state',j.publication->>'state',
  'observation',coalesce(j.publication->'observation','{}'::jsonb)||coalesce(j.publication->'late_observation','{}'::jsonb),'attempt',j.attempts);
end $$;

create function public.begin_social_publication(p_id uuid,p_worker text,p_fence text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs; i jsonb;
begin
 select * into j from public.background_jobs where id=p_id for update;
 if nullif(btrim(p_worker),'') is null or nullif(p_fence,'') is null
  or j.job_type is distinct from 'social_publish' or j.status is distinct from 'running'
  or j.locked_by is distinct from p_worker or j.publication->>'fence' is distinct from p_fence
  or j.locked_at is null or j.locked_at<=now()-interval '5 minutes'
  or coalesce(j.publication->>'state','') not in ('queued','retry_wait') then return false; end if;
 i:=j.payload->'intent';
 if j.publication->'authorization' is null
  or j.publication->'authorization'->>'id' is distinct from i->>'authorizationId'
  or j.publication->'authorization'->>'actorId' is distinct from j.payload->>'authorized_by'
  or j.publication->'authorization'->>'revokedAt' is not null
  or j.publication->'authorization'->>'fingerprint' is distinct from public.social_publication_fingerprint(i)
 then return false; end if;
 if not exists(select 1 from public.profiles where id=(j.payload->>'authorized_by')::uuid and is_active and role in ('admin','manager')) then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(concat_ws('|',i->>'deliverableId',i->>'platform',i->>'accountId'),0));
 -- Review changes/reconnections never bypass an older accepted/ambiguous attempt.
 if exists(select 1 from public.background_jobs old where old.id<>j.id and old.job_type='social_publish'
  and old.payload->'intent'->>'deliverableId'=i->>'deliverableId'
  and old.payload->'intent'->>'platform'=i->>'platform' and old.payload->'intent'->>'accountId'=i->>'accountId'
  and old.publication->>'state' in ('submitting','processing','provider_scheduled','posted','unknown_outcome')) then return false; end if;
 perform public.check_social_publication_source(i);
 if (i->>'scheduledAt')::timestamptz>now() or (i->>'scheduledAt')::timestamptz<now()-interval '15 minutes'
 then return false; end if;
 update public.background_jobs set publication=publication||jsonb_build_object('state','submitting','started_at',now(),
  'submission_fence',p_fence,'submission_worker',p_worker),locked_at=now()
 where id=j.id;
 return true;
end $$;

create function public.save_social_publication(p_id uuid,p_worker text,p_fence text,p_observation jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare j public.background_jobs; s text:=p_observation->>'state'; polls integer;
begin
 if s not in ('processing','provider_scheduled','posted','failed','unknown_outcome','blocked')
  or s is null or (s='posted' and nullif(p_observation->>'postId','') is null)
 then raise exception 'Verified publication observation required'; end if;
 select * into j from public.background_jobs where id=p_id for update;
 if nullif(btrim(p_worker),'') is null or nullif(p_fence,'') is null
  or j.job_type is distinct from 'social_publish' or j.status is distinct from 'running'
  or j.locked_by is distinct from p_worker or j.publication->>'fence' is distinct from p_fence
  or j.locked_at is null or j.locked_at<=now()-interval '5 minutes'
  or (s<>'blocked' and j.publication->>'started_at' is null) then
  -- An old worker may return a real provider receipt after losing its lease.
  -- Retain that evidence WITHOUT allowing it to promote state or overwrite the
  -- new worker. Recovery reads the IDs and verifies them with the provider.
  if j.job_type='social_publish' and j.publication->>'submission_fence'=p_fence
   and j.publication->>'submission_worker'=p_worker
   and j.publication->'late_observation' is null
   and (nullif(p_observation->>'postId','') is not null or nullif(p_observation->>'operationId','') is not null) then
   update public.background_jobs set publication=publication||jsonb_build_object('late_observation',jsonb_strip_nulls(p_observation)),
    status=case when status='failed' and publication->>'state'='unknown_outcome' and coalesce((publication->>'polls')::int,0)<120 then 'queued' else status end,
    attempts=case when status='failed' and publication->>'state'='unknown_outcome' then 0 else attempts end,
    run_after=case when status='failed' and publication->>'state'='unknown_outcome' then now() else run_after end
    where id=j.id;
  end if;
  return false;
 end if;
 polls:=coalesce((j.publication->>'polls')::int,0)+1;
 if polls>=120 and s in ('processing','provider_scheduled') then s:='unknown_outcome'; end if;
 -- Preserve identifiers across transient/unknown status reads.
 p_observation:=coalesce(j.publication->'observation','{}'::jsonb)||jsonb_strip_nulls(p_observation)||jsonb_build_object('state',s);
 update public.background_jobs set publication=publication||jsonb_build_object('state',s,'observation',p_observation,'polls',polls),
  status=case when s='posted' then 'succeeded' when s in ('failed','unknown_outcome','blocked') then 'failed' else 'queued' end,
  result=jsonb_build_object('publication',p_observation),
  error=case when s in ('failed','unknown_outcome','blocked') then coalesce(p_observation->>'errorCode',s) else null end,
  run_after=now()+interval '30 seconds', attempts=case when s in ('processing','provider_scheduled') then greatest(0,attempts-1) else attempts end,
  finished_at=case when s in ('posted','failed','unknown_outcome','blocked') then now() else null end,
  locked_by=null,locked_at=null,updated_at=now() where id=j.id;
 return true;
end $$;

revoke all on function public.check_social_publication_source(jsonb),public.enqueue_social_publication(jsonb,uuid),
 public.social_publication_fingerprint(jsonb),public.authorize_social_publication(jsonb,uuid,text,jsonb),public.revoke_social_publication(uuid,uuid,uuid),
 public.claim_social_publication(uuid,text),public.begin_social_publication(uuid,text,text),
 public.save_social_publication(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.check_social_publication_source(jsonb),public.enqueue_social_publication(jsonb,uuid),
 public.social_publication_fingerprint(jsonb),public.authorize_social_publication(jsonb,uuid,text,jsonb),public.revoke_social_publication(uuid,uuid,uuid),
 public.claim_social_publication(uuid,text),public.begin_social_publication(uuid,text,text),
 public.save_social_publication(uuid,text,text,jsonb) to service_role;
commit;
