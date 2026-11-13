-- Explicitly requested client-review links. Private capability registry; the
-- anonymous RPC projects ONE immutable published snapshot, never source tables.
create table public.content_guideline_public_shares (
  content_guideline_id uuid primary key references public.content_guidelines(id) on delete cascade,
  client_id uuid not null references public.clients(id),
  public_slug text not null check (public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*-content-guideline$'),
  share_token text not null unique default encode(extensions.gen_random_bytes(32), 'hex') check (share_token ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  published_at timestamptz not null,
  published_by uuid not null references public.profiles(id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  check ((revoked_at is null) = (revoked_by is null))
);
create index content_guideline_public_shares_client_idx on public.content_guideline_public_shares(client_id);
create index content_guideline_public_shares_publisher_idx on public.content_guideline_public_shares(published_by);
create index content_guideline_public_shares_revoker_idx on public.content_guideline_public_shares(revoked_by) where revoked_by is not null;
alter table public.content_guideline_public_shares enable row level security;
revoke all on public.content_guideline_public_shares from public, anon, authenticated;
grant select, insert, update on public.content_guideline_public_shares to service_role;
comment on table public.content_guideline_public_shares is
  'Private, revocable bearer links and explicit client-safe publication snapshots. No anonymous enumeration or source-table access.';

create or replace function public.manage_content_guideline_share_as_actor(
  p_run_id uuid, p_actor_profile_id uuid, p_action text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
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
    select jsonb_agg(jsonb_build_object(
      'position',v.position,'title',v.title,'script',v.script,'objective',v.objective,
      'hook',v.hook,'shot_breakdown',v.shot_breakdown,'cta',v.cta,
      'visual_notes',v.visual_notes,'platform',v.platform,'format',v.format
    ) order by v.position,v.created_at) into videos
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
end $$;
revoke all on function public.manage_content_guideline_share_as_actor(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.manage_content_guideline_share_as_actor(uuid,uuid,text) to service_role;

create or replace function public.manage_content_guideline_share(p_run_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','manager','staff','team')) then
    raise exception 'Active staff access required';
  end if;
  return public.manage_content_guideline_share_as_actor(p_run_id,auth.uid(),p_action);
end $$;
revoke all on function public.manage_content_guideline_share(uuid,text) from public,anon,authenticated;
grant execute on function public.manage_content_guideline_share(uuid,text) to authenticated;

create or replace function public.read_public_content_guideline_share(p_slug text,p_token text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare result jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_slug is null or length(p_slug)>180
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*-content-guideline$' then return null; end if;
  select s.snapshot into result from public.content_guideline_public_shares s
    join public.content_guidelines g on g.id=s.content_guideline_id and g.client_id=s.client_id
    join public.content_runs r on r.id=g.content_run_id and r.client_id=g.client_id
    join public.clients c on c.id=g.client_id and c.active
    where s.public_slug=p_slug and s.share_token=p_token and s.revoked_at is null
      and g.status='published' and g.client_published_at is not null;
  return result;
end $$;
revoke all on function public.read_public_content_guideline_share(text,text) from public,anon,authenticated;
grant execute on function public.read_public_content_guideline_share(text,text) to anon,authenticated;
notify pgrst, 'reload schema';
