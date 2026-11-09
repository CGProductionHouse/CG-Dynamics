-- Per-video responses to an exact published guideline. These are shared-link
-- review responses, NOT authenticated identity or final-asset/posting approval.
create table public.content_guideline_client_responses (
  id uuid primary key,
  content_guideline_id uuid not null references public.content_guidelines(id),
  client_id uuid not null references public.clients(id),
  published_at timestamptz not null,
  video_position integer not null check (video_position > 0),
  video_snapshot jsonb not null check (jsonb_typeof(video_snapshot)='object'),
  action text not null check (action in ('approved','changes_requested','declined','comment')),
  reviewer_name text not null check (length(trim(reviewer_name)) between 1 and 80),
  message text not null check (length(message)<=3000 and (action='approved' or length(trim(message))>0)),
  created_at timestamptz not null default clock_timestamp()
);
create index guideline_client_responses_version_idx on public.content_guideline_client_responses(content_guideline_id,published_at,video_position,created_at desc,id);
create index guideline_client_responses_client_idx on public.content_guideline_client_responses(client_id);
alter table public.content_guideline_client_responses enable row level security;
revoke all on public.content_guideline_client_responses from public,anon,authenticated,service_role;
grant select on public.content_guideline_client_responses to service_role;
comment on table public.content_guideline_client_responses is 'Append-only shared-link review evidence for one published video/version. Names are self-reported. No editorial, production, schedule or final-asset status changes.';

-- Private projection called only by the capability-checked public RPCs.
create function public.project_guideline_client_responses(p_guideline_id uuid,p_published_at timestamptz)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('published_at',s.published_at,'videos',coalesce((
    select jsonb_agg(jsonb_build_object(
      'position',(v->>'position')::integer,
      'revision',(select e.id from public.content_guideline_client_responses e where e.content_guideline_id=s.content_guideline_id and e.published_at=s.published_at and e.video_position=(v->>'position')::integer order by e.created_at desc,e.id desc limit 1),
      'decision',coalesce((select e.action from public.content_guideline_client_responses e where e.content_guideline_id=s.content_guideline_id and e.published_at=s.published_at and e.video_position=(v->>'position')::integer and e.action<>'comment' order by e.created_at desc,e.id desc limit 1),'pending'),
      'responses',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'reviewer_name',e.reviewer_name,'message',e.message,'created_at',e.created_at) order by e.created_at desc,e.id desc) from (
        select * from public.content_guideline_client_responses e where e.content_guideline_id=s.content_guideline_id and e.published_at=s.published_at and e.video_position=(v->>'position')::integer order by e.created_at desc,e.id desc limit 20
      ) e),'[]'::jsonb)
    ) order by (v->>'position')::integer) from jsonb_array_elements(s.snapshot->'guide'->'videos') v
  ),'[]'::jsonb)) from public.content_guideline_public_shares s where s.content_guideline_id=p_guideline_id and s.published_at=p_published_at;
$$;
revoke all on function public.project_guideline_client_responses(uuid,timestamptz) from public,anon,authenticated,service_role;

create function public.read_public_guideline_video_reviews(p_slug text,p_token text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.content_guideline_public_shares;
begin
  if public.read_public_content_guideline_share(p_slug,p_token) is null then return null; end if;
  select * into s from public.content_guideline_public_shares where public_slug=p_slug and share_token=p_token and revoked_at is null;
  return public.project_guideline_client_responses(s.content_guideline_id,s.published_at);
end $$;
revoke all on function public.read_public_guideline_video_reviews(text,text) from public,anon,authenticated;
grant execute on function public.read_public_guideline_video_reviews(text,text) to anon,authenticated;

create function public.respond_public_guideline_video(
  p_slug text,p_token text,p_published_at timestamptz,p_position integer,
  p_action text,p_reviewer_name text,p_message text,p_request_id uuid,p_expected_revision uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.content_guideline_public_shares; v jsonb; prior public.content_guideline_client_responses;
  latest uuid; result jsonb;
begin
  if p_request_id is null or p_published_at is null or p_position is null or p_position<1
    or p_action is null or p_action not in ('approved','changes_requested','declined','comment')
    or p_reviewer_name is null or length(trim(p_reviewer_name)) not between 1 and 80
    or p_message is null or length(p_message)>3000 or (p_action<>'approved' and length(trim(p_message))=0)
    then raise exception 'Please add your name and a comment for changes, declines or comments.'; end if;
  -- Serialize submissions/revocation/republish on the same existing registry row.
  select * into s from public.content_guideline_public_shares where public_slug=p_slug and share_token=p_token for update;
  if s.content_guideline_id is null or public.read_public_content_guideline_share(p_slug,p_token) is null then raise exception 'This review link is unavailable.'; end if;
  if s.published_at is distinct from p_published_at then raise exception 'This guideline has been updated. Refresh before responding.'; end if;
  select value into v from jsonb_array_elements(s.snapshot->'guide'->'videos') where (value->>'position')::integer=p_position;
  if v is null then raise exception 'This video is unavailable.'; end if;
  select * into prior from public.content_guideline_client_responses where id=p_request_id;
  if prior.id is not null then
    if prior.content_guideline_id<>s.content_guideline_id or prior.published_at<>s.published_at or prior.video_position<>p_position
      or prior.action<>p_action or prior.reviewer_name<>trim(p_reviewer_name) or prior.message<>trim(p_message) then raise exception 'This response could not be verified. Please refresh.'; end if;
  else
    select id into latest from public.content_guideline_client_responses where content_guideline_id=s.content_guideline_id and published_at=s.published_at and video_position=p_position order by created_at desc,id desc limit 1;
    if latest is distinct from p_expected_revision then raise exception 'Another response was added. Refresh the reviews before responding.'; end if;
    if (select count(*) from public.content_guideline_client_responses where content_guideline_id=s.content_guideline_id and created_at>clock_timestamp()-interval '10 minutes')>=30
      or (select count(*) from public.content_guideline_client_responses where content_guideline_id=s.content_guideline_id and video_position=p_position and created_at>clock_timestamp()-interval '10 minutes')>=10
      then raise exception 'Several responses were just received. Please try again in a few minutes.'; end if;
    insert into public.content_guideline_client_responses(id,content_guideline_id,client_id,published_at,video_position,video_snapshot,action,reviewer_name,message)
    values(p_request_id,s.content_guideline_id,s.client_id,s.published_at,p_position,v,p_action,trim(p_reviewer_name),trim(p_message));
  end if;
  result:=public.project_guideline_client_responses(s.content_guideline_id,s.published_at);
  return result || jsonb_build_object('saved_response_id',p_request_id);
end $$;
revoke all on function public.respond_public_guideline_video(text,text,timestamptz,integer,text,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.respond_public_guideline_video(text,text,timestamptz,integer,text,text,text,uuid,uuid) to anon,authenticated;

-- Staff-only history, scoped to the canonical exact-client run. Public responses
-- stay separate from editorial/production status and are never a posting permit.
create function public.get_guideline_client_reviews_as_actor(p_run_id uuid,p_actor_profile_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare g public.content_guidelines; result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active and role in ('admin','manager','staff','team')) then raise exception 'Active staff access required'; end if;
  select cg.* into g from public.content_guidelines cg join public.content_runs r on r.id=cg.content_run_id and r.client_id=cg.client_id where r.id=p_run_id;
  if g.id is null then raise exception 'Exact client guideline required'; end if;
  select coalesce(jsonb_agg(x.data order by x.created_at desc,x.id desc),'[]'::jsonb) into result from (
    select e.id,e.created_at,jsonb_build_object('id',e.id,'position',e.video_position,'title',e.video_snapshot->>'title','action',e.action,'reviewer_name',e.reviewer_name,'message',e.message,'created_at',e.created_at,'published_at',e.published_at,
      'current_publication',coalesce(s.published_at=e.published_at and s.revoked_at is null and g.status='published' and g.client_published_at is not null,false),
      'matches_current_video',exists(select 1 from public.content_guide_ideas i where i.content_guideline_id=g.id and i.client_id=g.client_id and i.status<>'archived' and jsonb_build_object('position',i.position,'title',i.title,'script',i.script,'objective',i.objective,'hook',i.hook,'shot_breakdown',i.shot_breakdown,'cta',i.cta,'visual_notes',i.visual_notes,'platform',i.platform,'format',i.format)=e.video_snapshot)
    ) data from public.content_guideline_client_responses e left join public.content_guideline_public_shares s on s.content_guideline_id=e.content_guideline_id
    where e.content_guideline_id=g.id and e.client_id=g.client_id order by e.created_at desc,e.id desc limit 100
  ) x;
  return jsonb_build_object('content_run_id',p_run_id,'guideline_id',g.id,'responses',result,'identity','self_reported_shared_link');
end $$;
revoke all on function public.get_guideline_client_reviews_as_actor(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_guideline_client_reviews_as_actor(uuid,uuid) to service_role;

create function public.get_guideline_client_reviews(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  return public.get_guideline_client_reviews_as_actor(p_run_id,auth.uid());
end $$;
revoke all on function public.get_guideline_client_reviews(uuid) from public,anon,authenticated;
grant execute on function public.get_guideline_client_reviews(uuid) to authenticated;
notify pgrst,'reload schema';
