-- DRAFT ONLY: not applied. Feature remains off pending real PostgreSQL/RLS acceptance.
-- Narrow scope: native command_centre_tasks, explicit questions, no task mutations.
begin;
create table public.nolan_decision_requests (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.command_centre_tasks(id) on delete restrict,
  source_revision text not null,
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  question text not null check (length(btrim(question)) between 1 and 4000),
  idempotency_key uuid not null,
  state text not null default 'pending' check (state in ('pending','resolved','withdrawn')),
  response text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete restrict,
  unique (requested_by,idempotency_key),
  check ((state = 'pending' and closed_at is null and closed_by is null and response is null)
    or (state <> 'pending' and closed_at is not null and closed_by is not null))
);
alter table public.nolan_decision_requests enable row level security;
revoke all on public.nolan_decision_requests from public, anon, authenticated;
-- No direct table grants/policies: only narrow checked RPCs expose records.
-- No service-role browser access or generic dynamic SQL.
create function public.nolan_decision_actor()
returns uuid language plpgsql stable security definer set search_path = pg_catalog set timezone = 'UTC' as $
declare v_id uuid;
begin
 select id into v_id from public.profiles
 where id = auth.uid() and is_active and role in ('admin','manager');
 if v_id is null then raise exception 'Active manager access required' using errcode='42501'; end if;
 return v_id;
end $$;
revoke all on function public.nolan_decision_actor() from public,anon,authenticated;

create function public.preview_nolan_decision_task(p_task_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog set timezone = 'UTC' as $
declare v_actor uuid; v_task public.command_centre_tasks; v_recipients jsonb;
begin
 v_actor := public.nolan_decision_actor();
 if not exists(select 1 from public.profiles where id=v_actor and role='admin') then
   raise exception 'Only an active administrator may prepare a decision request' using errcode='42501';
 end if;
 select * into v_task from public.command_centre_tasks where id=p_task_id;
 if not found then raise exception 'Native task not found'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',full_name) order by id),'[]'::jsonb)
 into v_recipients from public.profiles where is_active and role in ('admin','manager');
 return jsonb_build_object('taskId',v_task.id,'title',v_task.title,
   'revision',md5(to_jsonb(v_task)::text),'recipients',v_recipients);
end $$;

create function public.create_nolan_decision_request(
 p_task_id uuid,p_expected_revision text,p_recipient_id uuid,p_question text,p_idempotency_key uuid)
returns uuid language plpgsql security definer set search_path = pg_catalog set timezone = 'UTC' as $
declare v_actor uuid; v_task public.command_centre_tasks; v_prior public.nolan_decision_requests; v_id uuid;
begin
 select id into v_actor from public.profiles where id=auth.uid() and is_active and role='admin' for share;
 if not found then raise exception 'Only an active administrator may request a decision' using errcode='42501'; end if;
 if p_idempotency_key is null or p_expected_revision is null or p_expected_revision=''
   or p_question is null or length(btrim(p_question)) not between 1 and 4000 then
   raise exception 'Invalid decision request';
 end if;
 -- Serialize retries; same actor/key may not be repurposed for different content.
 perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_idempotency_key::text,0));
 select * into v_prior from public.nolan_decision_requests
 where requested_by=v_actor and idempotency_key=p_idempotency_key;
 if found then
   if v_prior.task_id is distinct from p_task_id or v_prior.source_revision is distinct from p_expected_revision
     or v_prior.recipient_id is distinct from p_recipient_id or v_prior.question is distinct from btrim(p_question) then
     raise exception 'Idempotency key already used for different request';
   end if;
   return v_prior.id;
 end if;
 -- Current published task policy permits admin/manager reads. Restrict this new
 -- relation to that same role set; do not infer recipients from task assignment.
 perform 1 from public.profiles where id=p_recipient_id and is_active and role in ('admin','manager') for share;
 if not found then raise exception 'Explicit active manager recipient required' using errcode='42501'; end if;
 select * into v_task from public.command_centre_tasks where id=p_task_id for share;
 if not found then raise exception 'Native task not found'; end if;
 if md5(to_jsonb(v_task)::text) <> p_expected_revision then raise exception 'Source revision changed; review again'; end if;
 insert into public.nolan_decision_requests(task_id,source_revision,recipient_id,requested_by,question,idempotency_key)
 values(p_task_id,p_expected_revision,p_recipient_id,v_actor,btrim(p_question),p_idempotency_key)
 returning id into v_id;
 return v_id;
end $$;

create function public.list_my_nolan_decision_requests()
returns jsonb language plpgsql stable security definer set search_path = pg_catalog set timezone = 'UTC' as $
declare v_actor uuid; v_rows jsonb; v_count integer;
begin
 v_actor := public.nolan_decision_actor();
 -- Bounded complete snapshot. Exceeding bound is an explicit error, not a
 -- truncated success; no cross-account or historical recipient inference.
 select count(*) into v_count from public.nolan_decision_requests
 where state='pending' and (recipient_id=v_actor or requested_by=v_actor);
 if v_count > 500 then raise exception 'Decision coverage exceeds 500; paged adapter required'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',r.id,'taskId',r.task_id,'title',t.title,'question',r.question,
 'recipientId',r.recipient_id,'requestedBy',r.requested_by,'createdAt',r.created_at,
 'version',r.version,'state',r.state,'sourceRevision',r.source_revision,
 'currentRevision',md5(to_jsonb(t)::text),
 'recipientActive',exists(select 1 from public.profiles p where p.id=r.recipient_id and p.is_active and p.role in ('admin','manager'))
 ) order by r.created_at,r.id),'[]'::jsonb) into v_rows
 from public.nolan_decision_requests r join public.command_centre_tasks t on t.id=r.task_id
 where r.state='pending' and (r.recipient_id=v_actor or r.requested_by=v_actor);
 return jsonb_build_object('complete',true,'rows',v_rows);
end $$;

create function public.close_nolan_decision_request(p_request_id uuid,p_expected_version integer,p_action text,p_response text)
returns void language plpgsql security definer set search_path = pg_catalog set timezone = 'UTC' as $
declare v_actor uuid; v_request public.nolan_decision_requests; v_task public.command_centre_tasks;
begin
 select id into v_actor from public.profiles where id=auth.uid() and is_active and role in ('admin','manager') for share;
 if not found then raise exception 'Active manager access required' using errcode='42501'; end if;
 select * into v_request from public.nolan_decision_requests where id=p_request_id for update;
 if not found or (v_request.recipient_id<>v_actor and v_request.requested_by<>v_actor) then
   raise exception 'Decision request unavailable' using errcode='42501';
 end if;
 if v_request.version is distinct from p_expected_version or v_request.state<>'pending' then
   raise exception 'Request changed; reload before responding';
 end if;
 if p_action='resolve' then
   if v_request.recipient_id<>v_actor then raise exception 'Only the named recipient may respond' using errcode='42501'; end if;
   if p_response is null or length(btrim(p_response)) not between 1 and 4000 then raise exception 'Response required'; end if;
   select * into v_task from public.command_centre_tasks where id=v_request.task_id for share;
   if not found or md5(to_jsonb(v_task)::text)<>v_request.source_revision then raise exception 'Source revision changed; new request required'; end if;
 elsif p_action='withdraw' then
   if v_request.requested_by<>v_actor then raise exception 'Only the requester may withdraw' using errcode='42501'; end if;
 else raise exception 'Unsupported action';
 end if;
 update public.nolan_decision_requests set state=case when p_action='resolve' then 'resolved' else 'withdrawn' end,
 response=case when p_action='resolve' then btrim(p_response) else null end,
 closed_at=now(),closed_by=v_actor,version=version+1 where id=v_request.id;
 -- Question response only. Never update task status, publish or apply a decision.
end $$;

revoke all on function public.preview_nolan_decision_task(uuid) from public,anon;
revoke all on function public.create_nolan_decision_request(uuid,text,uuid,text,uuid) from public,anon;
revoke all on function public.list_my_nolan_decision_requests() from public,anon;
revoke all on function public.close_nolan_decision_request(uuid,integer,text,text) from public,anon;
grant execute on function public.preview_nolan_decision_task(uuid) to authenticated;
grant execute on function public.create_nolan_decision_request(uuid,text,uuid,text,uuid) to authenticated;
grant execute on function public.list_my_nolan_decision_requests() to authenticated;
grant execute on function public.close_nolan_decision_request(uuid,integer,text,text) to authenticated;
commit;
