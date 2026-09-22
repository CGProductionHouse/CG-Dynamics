-- #450 narrow service-worker contracts. PREPARED ONLY; do not apply without CA approval.
-- No profile/auth user is seeded. WORKER_SYSTEM_PROFILE_ID must identify an existing,
-- auth-backed active profile. Existing human/MCP functions and grants stay untouched.
begin;

create or replace function public.get_or_create_content_guideline_as_actor(p_run_id uuid, p_actor_profile_id uuid)
returns public.content_guidelines language plpgsql security definer set search_path = '' as $$
declare v_run public.content_runs; v_guide public.content_guidelines; v_name text;
begin
  if auth.role() <> 'service_role' or not exists (
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_actor_profile_id and p.is_active and p.role in ('admin','manager','staff','team')
  ) then raise exception 'Configured active system profile required.' using errcode='42501'; end if;
  select * into v_run from public.content_runs where id=p_run_id for update;
  if v_run.id is null or v_run.client_id is null then raise exception 'Exact-client Content Run required.' using errcode='22023'; end if;
  select * into v_guide from public.content_guidelines where content_run_id=p_run_id;
  if v_guide.id is not null then return v_guide; end if;
  select name into v_name from public.clients where id=v_run.client_id;
  insert into public.content_guidelines(content_run_id,client_id,title,month,created_by)
  values(v_run.id,v_run.client_id,'CONTENT GUIDELINE - '||coalesce(v_name,v_run.client_name,'CLIENT')||
    case when v_run.run_date is not null then ' - '||upper(to_char(v_run.run_date,'FMMonth YYYY')) else '' end,
    case when v_run.run_date is not null then date_trunc('month',v_run.run_date)::date else null end,p_actor_profile_id)
  on conflict(content_run_id) do nothing;
  select * into v_guide from public.content_guidelines where content_run_id=p_run_id;
  return v_guide;
end; $$;
revoke all on function public.get_or_create_content_guideline_as_actor(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_or_create_content_guideline_as_actor(uuid,uuid) to service_role;

create or replace function public.persist_content_autopilot_ideas(
  p_guideline_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_ideas jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare v jsonb; n integer:=0;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_actor_profile_id and p.is_active and p.role in ('admin','manager','staff','team'))
  then raise exception 'Configured active system profile required.' using errcode='42501'; end if;
  if not exists(select 1 from public.content_guidelines g where g.id=p_guideline_id and g.client_id=p_client_id and g.status='draft')
  then raise exception 'Exact draft guideline required.' using errcode='22023'; end if;
  if exists(select 1 from public.content_guide_ideas i where i.content_guideline_id=p_guideline_id and i.status<>'archived') then return 0; end if;
  if jsonb_typeof(p_ideas)<>'array' or jsonb_array_length(p_ideas)=0 then raise exception 'Generated ideas required.' using errcode='22023'; end if;
  for v in select value from jsonb_array_elements(p_ideas) loop
    if nullif(btrim(v->>'title'),'') is null then raise exception 'Idea title required.' using errcode='22023'; end if;
    n:=n+1;
    insert into public.content_guide_ideas(content_guideline_id,client_id,title,objective,hook,notes,month,deliverable_id,position,status,created_by)
    values(p_guideline_id,p_client_id,v->>'title',nullif(v->>'objective',''),nullif(v->>'hook',''),nullif(v->>'angle',''),
      case when (v->>'targetMonth')~'^\d{4}-\d{2}$' then ((v->>'targetMonth')||'-01')::date else null end,
      case when (v->>'deliverableId')~*'^[0-9a-f-]{36}$' then (v->>'deliverableId')::uuid else null end,n,'draft',p_actor_profile_id);
  end loop; return n;
end; $$;
revoke all on function public.persist_content_autopilot_ideas(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_content_autopilot_ideas(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.persist_content_autopilot_developments(
  p_guideline_id uuid,p_client_id uuid,p_actor_profile_id uuid,p_developments jsonb
) returns integer language plpgsql security definer set search_path='' as $$
declare v jsonb; changed integer; n integer:=0;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_actor_profile_id and p.is_active and p.role in ('admin','manager','staff','team'))
  then raise exception 'Configured active system profile required.' using errcode='42501'; end if;
  if not exists(select 1 from public.content_guidelines g where g.id=p_guideline_id and g.client_id=p_client_id and g.status='draft')
  then raise exception 'Exact draft guideline required.' using errcode='22023'; end if;
  if jsonb_typeof(p_developments)<>'array' then raise exception 'Developments must be an array.' using errcode='22023'; end if;
  for v in select value from jsonb_array_elements(p_developments) loop
    update public.content_guide_ideas i set
      script=case when nullif(btrim(i.script),'') is null then nullif(v->>'script','') else i.script end,
      shot_breakdown=case when nullif(btrim(i.shot_breakdown),'') is null then nullif(v->>'shotBreakdown','') else i.shot_breakdown end,
      requirements=case when nullif(btrim(i.requirements),'') is null then nullif(v->>'requirements','') else i.requirements end,
      cta=case when nullif(btrim(i.cta),'') is null then nullif(v->>'cta','') else i.cta end
    where i.id=(v->>'videoId')::uuid and i.content_guideline_id=p_guideline_id and i.client_id=p_client_id and i.status<>'archived'
      and ((nullif(btrim(i.script),'') is null and nullif(v->>'script','') is not null)
        or (nullif(btrim(i.shot_breakdown),'') is null and nullif(v->>'shotBreakdown','') is not null)
        or (nullif(btrim(i.requirements),'') is null and nullif(v->>'requirements','') is not null)
        or (nullif(btrim(i.cta),'') is null and nullif(v->>'cta','') is not null));
    get diagnostics changed=row_count; n:=n+changed;
  end loop; return n;
end; $$;
revoke all on function public.persist_content_autopilot_developments(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_content_autopilot_developments(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.assert_content_autopilot_video_folder_write(
  p_content_guide_idea_id uuid,p_content_run_id uuid,p_client_id uuid,p_actor_profile_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=p_actor_profile_id and p.role='admin' and p.is_active)
  then raise exception 'Configured active admin system profile required.' using errcode='42501'; end if;
  if not exists(select 1 from public.content_guide_ideas i join public.content_guidelines g on g.id=i.content_guideline_id
    where i.id=p_content_guide_idea_id and g.content_run_id=p_content_run_id and g.client_id=p_client_id
      and i.client_id=p_client_id and i.status<>'archived')
  then raise exception 'Video does not belong to that exact run and client.' using errcode='22023'; end if;
  return true;
end; $$;
revoke all on function public.assert_content_autopilot_video_folder_write(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.assert_content_autopilot_video_folder_write(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.upsert_content_autopilot_video_folder(
  p_content_guide_idea_id uuid,p_content_run_id uuid,p_client_id uuid,p_drive_id text,p_folder_item_id text,
  p_folder_name text,p_mapping_origin text,p_actor_profile_id uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform public.assert_content_autopilot_video_folder_write(p_content_guide_idea_id,p_content_run_id,p_client_id,p_actor_profile_id);
  if p_mapping_origin not in ('canonical','legacy_mapped') then raise exception 'Invalid mapping origin.' using errcode='22023'; end if;
  insert into public.content_guide_video_onedrive_folders(content_guide_idea_id,content_run_id,client_id,drive_id,folder_item_id,folder_name,mapping_origin,created_by)
  values(p_content_guide_idea_id,p_content_run_id,p_client_id,p_drive_id,p_folder_item_id,p_folder_name,p_mapping_origin,p_actor_profile_id)
  on conflict(content_guide_idea_id) do update set drive_id=excluded.drive_id,folder_item_id=excluded.folder_item_id,
    folder_name=excluded.folder_name,mapping_origin=excluded.mapping_origin,last_verified_at=now()
  returning id into v_id; return v_id;
end; $$;
revoke all on function public.upsert_content_autopilot_video_folder(uuid,uuid,uuid,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.upsert_content_autopilot_video_folder(uuid,uuid,uuid,text,text,text,text,uuid) to service_role;

commit;
