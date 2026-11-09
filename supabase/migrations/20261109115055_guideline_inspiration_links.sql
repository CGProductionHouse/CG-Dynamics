-- Optional, client-facing trend/reference context for one canonical video.
-- Existing scripts/links/publication/approvals are never rewritten or inferred.
create function public.valid_guideline_inspiration_url(p_url text)
returns boolean language sql immutable security invoker set search_path='' as $$
  select p_url is null or (
    length(p_url)<=2048
    and p_url ~* '^https://((www[.]|m[.]|vt[.]|vm[.])?tiktok[.]com|(www[.]|m[.])?instagram[.]com|(www[.]|m[.]|web[.])?facebook[.]com|fb[.]watch|(www[.]|m[.])?youtube[.]com|youtu[.]be)(:443)?/[a-z0-9@%_-][^[:space:]\\]*$'
    and p_url !~* '^https://[^/]+/(redirect|l[.]php|login|accounts)(/|[?#]|$)'
  );
$$;
revoke all on function public.valid_guideline_inspiration_url(text) from public,anon,authenticated;
grant execute on function public.valid_guideline_inspiration_url(text) to authenticated,service_role;
alter table public.content_guide_ideas
  add column inspiration_url text check (public.valid_guideline_inspiration_url(inspiration_url)),
  add column inspiration_note text check (length(inspiration_note)<=1000);
comment on column public.content_guide_ideas.inspiration_url is 'Optional HTTPS TikTok, Instagram, Facebook or YouTube example. Open-only reference; no embed, ingestion, download or claim of CG ownership.';
comment on column public.content_guide_ideas.inspiration_note is 'Optional short client-facing vision for adapting this reference. Separate from the complete authored script and internal notes.';

-- One explicit allowlist for future publication, signed-in client projection,
-- and approval-version comparison. No private/editor/storage fields included.
create function public.guideline_video_client_snapshot(p_video public.content_guide_ideas)
returns jsonb language sql immutable security invoker set search_path='' as $$
  select jsonb_build_object('position',p_video.position,'title',p_video.title,'script',p_video.script,'objective',p_video.objective,
    'hook',p_video.hook,'shot_breakdown',p_video.shot_breakdown,'cta',p_video.cta,'visual_notes',p_video.visual_notes,
    'platform',p_video.platform,'format',p_video.format,'inspiration_url',p_video.inspiration_url,'inspiration_note',p_video.inspiration_note);
$$;
revoke all on function public.guideline_video_client_snapshot(public.content_guide_ideas) from public,anon,authenticated;
grant execute on function public.guideline_video_client_snapshot(public.content_guide_ideas) to service_role;

-- Preserve existing identity, publication and privilege boundaries.
CREATE OR REPLACE FUNCTION public.client_portal_published_content_guidelines(p_client_id uuid DEFAULT NULL::uuid, p_month date DEFAULT NULL::date)
 RETURNS TABLE(row_key text, title text, month date, run_name text, filming_date date, published_at timestamp with time zone, videos jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_client_id uuid;
begin
  if public.is_staff() then
    v_client_id := p_client_id;
  else
    v_client_id := public.my_client_id();
  end if;

  if v_client_id is null then
    return;
  end if;

  return query
  select
    md5(guideline.id::text) as row_key,
    guideline.title,
    guideline.month,
    run.name as run_name,
    run.run_date as filming_date,
    guideline.client_published_at as published_at,
    coalesce(
      jsonb_agg(
        public.guideline_video_client_snapshot(video) order by video.position, video.created_at
      ) filter (where video.id is not null),
      '[]'::jsonb
    ) as videos
  from public.content_guidelines guideline
  join public.content_runs run on run.id = guideline.content_run_id
  left join public.content_guide_ideas video
    on video.content_guideline_id = guideline.id
   and video.status <> 'archived'
  where guideline.client_id = v_client_id
    and guideline.client_published_at is not null
    and guideline.status = 'published'
    and (p_month is null or guideline.month = date_trunc('month', p_month)::date)
  group by guideline.id, run.id
  order by guideline.month desc nulls last, run.run_date desc nulls last, guideline.created_at desc;
end;
$function$;

-- Preserve existing identity, publication and privilege boundaries.
CREATE OR REPLACE FUNCTION public.manage_content_guideline_share_as_actor(p_run_id uuid, p_actor_profile_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  g public.content_guidelines; r public.content_runs; s public.content_guideline_public_shares;
  client_name text; slug text; videos jsonb; stamp timestamptz := now();
begin
  if p_action is null or p_action not in ('publish', 'get', 'revoke') then raise exception 'Unknown guideline sharing action'; end if;
  if not exists (select 1 from public.profiles where id=p_actor_profile_id and is_active and role in ('admin','manager','staff','team')) then
    raise exception 'Active staff access required';
  end if;
  select * into r from public.content_runs where id=p_run_id;
  if r.id is null or r.client_id is null then raise exception 'Exact Content Run and client required'; end if;
  select name into client_name from public.clients where id=r.client_id and active;
  if client_name is null then raise exception 'Active exact client required'; end if;
  select * into g from public.content_guidelines where content_run_id=p_run_id for update;
  if g.id is null or g.client_id is distinct from r.client_id or g.status='archived' then
    raise exception 'Canonical guideline does not match this client and Content Run';
  end if;
  select * into s from public.content_guideline_public_shares where content_guideline_id=g.id for update;
  if s.content_guideline_id is not null and s.client_id is distinct from g.client_id then raise exception 'Share client mismatch'; end if;

  if p_action='revoke' then
    update public.content_guideline_public_shares set revoked_at=coalesce(revoked_at,stamp), revoked_by=coalesce(revoked_by,p_actor_profile_id)
      where content_guideline_id=g.id returning * into s;
    return jsonb_build_object('state','revoked','guideline_id',g.id,'content_run_id',r.id,'client_id',g.client_id,'client_name',client_name);
  end if;

  if p_action='publish' then
    -- One snapshot query preserves verbatim authored wording, including every
    -- scene. No operational notes/assignees/IDs/OneDrive fields enter this JSON.
    select jsonb_agg(public.guideline_video_client_snapshot(v) order by v.position,v.created_at) into videos
    from public.content_guide_ideas v where v.content_guideline_id=g.id and v.client_id=g.client_id and v.status<>'archived';
    if videos is null or jsonb_array_length(videos)=0 then raise exception 'Add a complete video before publishing'; end if;
    if exists (select 1 from jsonb_array_elements(videos) v where nullif(trim(v->>'title'),'') is null
      or nullif(trim(v->>'script'),'') is null or trim(v->>'script') ~* '^(script pending|tbd|to be confirmed)([[:space:].!]*$|[[:space:]:-])'
      or v->>'position' is null or (v->>'position')::integer < 1)
      or (select count(distinct v->>'position') from jsonb_array_elements(videos) v) <> jsonb_array_length(videos)
      then raise exception 'Every video needs a title, unique position and complete script before publishing'; end if;
    if exists (select 1 from public.content_guide_ideas v where v.content_guideline_id=g.id and v.status<>'archived' and v.client_id is distinct from g.client_id) then
      raise exception 'Guideline video client mismatch';
    end if;
    slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(client_name),'[^a-z0-9]+','-','g')),''),'client') || '-content-guideline';
    insert into public.content_guideline_public_shares(content_guideline_id,client_id,public_slug,snapshot,published_at,published_by)
    values(g.id,g.client_id,slug,jsonb_build_object('client',jsonb_build_object('name',client_name),'guide',jsonb_build_object(
      'row_key','shared-guideline','title',g.title,'month',g.month,'run_name',r.name,
      'filming_date',r.run_date,'published_at',stamp,'videos',videos)),stamp,p_actor_profile_id)
    on conflict (content_guideline_id) do update set
      public_slug=excluded.public_slug,snapshot=excluded.snapshot,published_at=excluded.published_at,published_by=excluded.published_by,
      share_token=case when content_guideline_public_shares.revoked_at is not null then encode(extensions.gen_random_bytes(32),'hex') else content_guideline_public_shares.share_token end,
      revoked_at=null,revoked_by=null
    returning * into s;
    -- Publishing for review does NOT approve a video or change Client Schedule.
    update public.content_guidelines set status='published',client_published_at=stamp where id=g.id;
  end if;

  if s.content_guideline_id is null or s.revoked_at is not null
    or (p_action='get' and (g.status<>'published' or g.client_published_at is null)) then
    return jsonb_build_object('state','not_shared','guideline_id',g.id,'content_run_id',r.id,'client_id',g.client_id,'client_name',client_name);
  end if;
  return jsonb_build_object('state','published_for_review','guideline_id',g.id,'content_run_id',r.id,
    'client_id',g.client_id,'client_name',client_name,'public_slug',s.public_slug,'share_token',s.share_token,
    'published_at',s.published_at,'video_count',jsonb_array_length(s.snapshot->'guide'->'videos'));
end $function$;

-- Prior-version evidence remains literal; absent legacy inspiration means null.
create or replace function public.get_guideline_client_reviews_as_actor(p_run_id uuid,p_actor_profile_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare g public.content_guidelines; result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_profile_id and is_active and role in ('admin','manager','staff','team')) then raise exception 'Active staff access required'; end if;
  select cg.* into g from public.content_guidelines cg join public.content_runs r on r.id=cg.content_run_id and r.client_id=cg.client_id where r.id=p_run_id;
  if g.id is null then raise exception 'Exact client guideline required'; end if;
  select coalesce(jsonb_agg(x.data order by x.created_at desc,x.id desc),'[]'::jsonb) into result from (
    select e.id,e.created_at,jsonb_build_object('id',e.id,'position',e.video_position,'title',e.video_snapshot->>'title','action',e.action,'reviewer_name',e.reviewer_name,'message',e.message,'created_at',e.created_at,'published_at',e.published_at,
      'current_publication',coalesce(s.published_at=e.published_at and s.revoked_at is null and g.status='published' and g.client_published_at is not null,false),
      'matches_current_video',exists(select 1 from public.content_guide_ideas i where i.content_guideline_id=g.id and i.client_id=g.client_id and i.status<>'archived' and public.guideline_video_client_snapshot(i)=(jsonb_build_object('inspiration_url',null,'inspiration_note',null) || e.video_snapshot))
    ) data from public.content_guideline_client_responses e left join public.content_guideline_public_shares s on s.content_guideline_id=e.content_guideline_id
    where e.content_guideline_id=g.id and e.client_id=g.client_id order by e.created_at desc,e.id desc limit 100
  ) x;
  return jsonb_build_object('content_run_id',p_run_id,'guideline_id',g.id,'responses',result,'identity','self_reported_shared_link');
end $$;

notify pgrst,'reload schema';
