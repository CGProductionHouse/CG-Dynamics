-- #389. Prepared only: no production application or entitlement inference.
create table public.client_service_entitlements (
  client_id uuid not null references public.clients(id) on delete restrict,
  service_key text not null check (service_key in ('linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience')),
  state text not null check (state in ('included','not_included','unknown','not_applicable')),
  evidence_note text not null check (length(btrim(evidence_note)) between 1 and 2000),
  source_references jsonb not null default '[]' check (jsonb_typeof(source_references) = 'array' and jsonb_array_length(source_references) <= 20),
  verified_at timestamptz not null default now(),
  verified_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  notes text check (length(notes) <= 2000),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (client_id,service_key)
);
alter table public.client_service_entitlements enable row level security;
revoke all on public.client_service_entitlements from public, anon, authenticated;
grant select on public.client_service_entitlements to authenticated;
create policy entitlement_manager_read on public.client_service_entitlements for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active and p.role in ('admin','manager')));

-- Existing audit authority is also the durable receipt/measurement authority.
create unique index planner_service_expansion_receipt_key on public.planner_activity_log
  ((metadata->>'client_id'),(metadata->>'idempotency_key')) where action='client_service_expansion_requested';
create index planner_service_expansion_measurement on public.planner_activity_log
  (action,(metadata->>'client_id'),(metadata->>'service_key'),created_at)
  where action in ('client_service_expansion_requested','client_service_surface_shown');

create function public.verify_client_service_entitlement(p_client_id uuid, p_service_key text, p_state text,
  p_evidence_note text, p_source_references jsonb, p_expected_revision integer, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_old public.client_service_entitlements; v_new public.client_service_entitlements;
begin
  select * into v_actor from public.profiles where id = auth.uid() and is_active and role in ('admin','manager');
  if v_actor.id is null then raise exception 'Active manager access required' using errcode='42501'; end if;
  if not exists(select 1 from public.clients where id=p_client_id and active) then raise exception 'Active client required'; end if;
  if p_expected_revision is null or p_expected_revision < 0 then raise exception 'Expected revision required'; end if;
  if p_source_references is null or jsonb_typeof(p_source_references) <> 'array' then raise exception 'Source references must be an array'; end if;
  if exists(select 1 from jsonb_array_elements(p_source_references) e where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and 1000) then raise exception 'Invalid source reference'; end if;
  if p_state in ('included','not_included','not_applicable') and jsonb_array_length(p_source_references)=0 then raise exception 'Verified provenance required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('entitlement-'||p_client_id::text||'-'||p_service_key,0));
  select * into v_old from public.client_service_entitlements where client_id=p_client_id and service_key=p_service_key for update;
  if coalesce(v_old.revision,0) <> p_expected_revision then raise exception 'Evidence changed; reload before verifying' using errcode='40001'; end if;
  insert into public.client_service_entitlements(client_id,service_key,state,evidence_note,source_references,verified_by_profile_id,notes)
  values(p_client_id,p_service_key,p_state,btrim(p_evidence_note),p_source_references,v_actor.id,p_notes)
  on conflict(client_id,service_key) do update set state=excluded.state,evidence_note=excluded.evidence_note,
    source_references=excluded.source_references,verified_by_profile_id=v_actor.id,verified_at=now(),notes=excluded.notes,
    updated_at=now(),revision=client_service_entitlements.revision+1 returning * into v_new;
  insert into public.planner_activity_log(entity_type,entity_id,action,actor_user_id,actor_name,metadata)
  values('client',p_client_id,'service_entitlement_verified',v_actor.id,v_actor.full_name,
    jsonb_build_object('service_key',p_service_key,'before',to_jsonb(v_old),'after',to_jsonb(v_new)));
end $$;

-- Safe projection. No caller-selected client, provider IDs, evidence or internal task data.
create function public.get_my_client_service_entitlements()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_client uuid; v_result jsonb;
begin
  select p.client_id into v_client from public.profiles p join public.clients c on c.id=p.client_id
  where p.id=auth.uid() and p.is_active and p.role='client' and c.active;
  if v_client is null then raise exception 'Active client access required' using errcode='42501'; end if;
  with services(key) as (values('linkedin'),('google_ads'),('meta_ads'),('instagram'),('tiktok'),('google_business_profile'),('website_digital_experience'))
  select jsonb_agg(jsonb_build_object('service_key',s.key,'state',coalesce(e.state,'unknown'),'verified_at',e.verified_at,
    'connection',case
      when s.key='instagram' then case when exists (
        select 1 from public.meta_client_assets a join public.meta_connections c on c.id=a.connection_id
        where a.client_id=v_client and a.is_active and nullif(a.instagram_account_id,'') is not null and c.status='connected'
      ) or exists (
        select 1 from public.meta_instagram_connections c join public.meta_client_assets a on a.id=c.confirmed_asset_id
        where c.client_id=v_client and a.client_id=v_client and a.is_active and c.status='connected' and a.instagram_account_id=c.instagram_account_id
      ) then 'connected' else 'needs_connection' end
      when s.key='meta_ads' then case when exists (
        select 1 from public.meta_client_assets a join public.meta_connections c on c.id=a.connection_id
        where a.client_id=v_client and a.is_active and nullif(a.ad_account_id,'') is not null and c.status='connected'
      ) then 'connected' else 'needs_connection' end
      when s.key='tiktok' then case when exists(select 1 from public.tiktok_connections c where c.client_id=v_client and c.status='connected' and nullif(c.tiktok_open_id,'') is not null)
        then 'connected' else 'needs_connection' end
      when s.key='google_ads' then case when exists(
        select 1 from public.google_ads_account_links l join public.google_ads_accounts a on a.id=l.google_ads_account_id
        where l.client_id=v_client and l.is_active and a.is_active and a.account_mode='dedicated'
      ) or exists(
        select 1 from public.google_ads_campaign_links l join public.google_ads_accounts a on a.id=l.google_ads_account_id
        where l.client_id=v_client and l.is_active and a.is_active and a.account_mode='shared'
      ) then 'connected' else 'needs_connection' end
      else 'unavailable' end,
    'requested_at',(select max(log.created_at) from public.planner_activity_log log where log.action='client_service_expansion_requested'
      and log.metadata->>'client_id'=v_client::text and log.metadata->>'service_key'=s.key)) order by s.key)
  into v_result from services s left join public.client_service_entitlements e on e.client_id=v_client and e.service_key=s.key;
  return v_result;
end $$;

create function public.submit_client_service_expansion_request(p_service_key text, p_message text, p_idempotency_key uuid, p_surface text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor public.profiles; v_client public.clients; v_entitlement public.client_service_entitlements;
  v_log public.planner_activity_log; v_task public.planner_tasks; v_board uuid; v_bucket uuid;
  v_payload jsonb; v_hash text; v_label text; v_audit text; v_projection text;
begin
  select * into v_actor from public.profiles where id=auth.uid() and is_active and role='client';
  select * into v_client from public.clients where id=v_actor.client_id and active;
  if v_actor.id is null or v_client.id is null then raise exception 'Active client access required' using errcode='42501'; end if;
  v_label := case p_service_key when 'linkedin' then 'LinkedIn' when 'google_ads' then 'Google Ads' when 'meta_ads' then 'Meta Ads'
    when 'instagram' then 'Instagram' when 'tiktok' then 'TikTok' when 'google_business_profile' then 'Google Business Profile'
    when 'website_digital_experience' then 'Website / Digital Experience' end;
  if v_label is null or p_idempotency_key is null or p_surface is null or p_surface not in ('performance','overview') or length(coalesce(p_message,''))>2000 then raise exception 'Invalid request'; end if;
  v_payload := jsonb_build_object('service_key',p_service_key,'message',btrim(coalesce(p_message,'')),'surface',p_surface,'requester',v_actor.id);
  v_hash := 'cgpse-'||v_client.id::text||'-'||p_idempotency_key::text;
  perform pg_advisory_xact_lock(hashtextextended(v_hash,0));
  select * into v_log from public.planner_activity_log where action='client_service_expansion_requested'
    and metadata->>'client_id'=v_client.id::text and metadata->>'idempotency_key'=p_idempotency_key::text;
  if v_log.id is not null then
    if v_log.metadata->'payload' is distinct from v_payload then raise exception 'Idempotency key payload conflict' using errcode='23505'; end if;
    return jsonb_build_object('submitted_at',v_log.created_at,'replayed',true);
  end if;
  select * into v_entitlement from public.client_service_entitlements where client_id=v_client.id and service_key=p_service_key for share;
  if v_entitlement.state is distinct from 'not_included' then raise exception 'This service is not a verified expansion opportunity' using errcode='42501'; end if;
  select id into strict v_board from public.planner_boards where slug='operations-todo' and archived_at is null and visibility in ('public_internal','staff');
  select id into strict v_bucket from public.planner_buckets where board_id=v_board and upper(name)='CLIENT REQUESTS' and archived_at is null;
  if v_board is null or v_bucket is null then raise exception 'Operations CLIENT REQUESTS is unavailable'; end if;
  v_audit := current_setting('app.planner_task_audit_write',true);
  v_projection := current_setting('app.planner_assignment_projection_write',true);
  perform set_config('app.planner_task_audit_write','on',true);
  perform set_config('app.planner_assignment_projection_write','on',true);
  insert into public.planner_tasks(board_id,bucket_id,title,client_id,client_name,assigned_to_name,helper_names,unresolved_assignee_names,notes,status,priority,source,import_hash,checklist)
  values(v_board,v_bucket,'Package expansion request: '||v_label,v_client.id,v_client.name,null,'{}','{}',nullif(btrim(p_message),''),'to_do','client_request','client_portal_service_expansion',v_hash,'[]') returning * into v_task;
  perform set_config('app.planner_task_audit_write',coalesce(v_audit,''),true);
  perform set_config('app.planner_assignment_projection_write',coalesce(v_projection,''),true);
  insert into public.planner_activity_log(entity_type,entity_id,action,actor_user_id,actor_name,metadata)
  values('planner_task',v_task.id,'client_service_expansion_requested',v_actor.id,v_actor.full_name,
    jsonb_build_object('client_id',v_client.id,'service_key',p_service_key,'idempotency_key',p_idempotency_key,'payload',v_payload,'entitlement_revision',v_entitlement.revision));
  return jsonb_build_object('submitted_at',now(),'replayed',false);
end $$;

-- Bounded, deduplicated surface measurement in the existing activity authority.
create function public.record_client_service_surface(p_surface text, p_view_key uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor public.profiles; v_service record;
begin
  select p.* into v_actor from public.profiles p join public.clients c on c.id=p.client_id
  where p.id=auth.uid() and p.is_active and p.role='client' and c.active;
  if v_actor.id is null then raise exception 'Active client access required' using errcode='42501'; end if;
  if p_surface is null or p_surface not in ('overview','performance') or p_view_key is null then raise exception 'Invalid surface'; end if;
  perform pg_advisory_xact_lock(hashtextextended('cgpsev-'||v_actor.client_id::text||p_view_key::text,0));
  if exists(select 1 from public.planner_activity_log where action='client_service_surface_shown' and metadata->>'client_id'=v_actor.client_id::text and metadata->>'view_key'=p_view_key::text) then return; end if;
  for v_service in
    select s.key as service_key,coalesce(e.state,'unknown') as state
    from unnest(array['linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience']) with ordinality s(key,position)
    left join public.client_service_entitlements e on e.client_id=v_actor.client_id and e.service_key=s.key
    where p_surface='performance' or e.state='not_included'
    order by s.position limit case when p_surface='overview' then 2 else 7 end
  loop
    insert into public.planner_activity_log(entity_type,entity_id,action,actor_user_id,actor_name,metadata)
    values('client',v_actor.client_id,'client_service_surface_shown',v_actor.id,v_actor.full_name,
      jsonb_build_object('client_id',v_actor.client_id,'service_key',v_service.service_key,'state',v_service.state,'surface',p_surface,'view_key',p_view_key));
  end loop;
end $$;

create function public.get_client_service_expansion_review(p_client_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.profiles where id=auth.uid() and is_active and role in ('admin','manager')) then
    raise exception 'Active manager access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.clients where id=p_client_id and active) then raise exception 'Active client required'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('service_key',s.key,
    'surface_views',(select count(*) from public.planner_activity_log l where l.action='client_service_surface_shown' and l.metadata->>'client_id'=p_client_id::text and l.metadata->>'service_key'=s.key),
    'requests',(select count(*) from public.planner_activity_log l where l.action='client_service_expansion_requested' and l.metadata->>'client_id'=p_client_id::text and l.metadata->>'service_key'=s.key),
    'latest_request_at',(select max(l.created_at) from public.planner_activity_log l where l.action='client_service_expansion_requested' and l.metadata->>'client_id'=p_client_id::text and l.metadata->>'service_key'=s.key)
    ) order by s.position),'[]') into v_result
  from unnest(array['linkedin','google_ads','meta_ads','instagram','tiktok','google_business_profile','website_digital_experience']) with ordinality s(key,position);
  return v_result;
end $$;

revoke all on function public.verify_client_service_entitlement(uuid,text,text,text,jsonb,integer,text) from public,anon;
revoke all on function public.get_my_client_service_entitlements() from public,anon;
revoke all on function public.submit_client_service_expansion_request(text,text,uuid,text) from public,anon;
revoke all on function public.record_client_service_surface(text,uuid) from public,anon;
revoke all on function public.get_client_service_expansion_review(uuid) from public,anon;
grant execute on function public.verify_client_service_entitlement(uuid,text,text,text,jsonb,integer,text) to authenticated;
grant execute on function public.get_my_client_service_entitlements() to authenticated;
grant execute on function public.submit_client_service_expansion_request(text,text,uuid,text) to authenticated;
grant execute on function public.record_client_service_surface(text,uuid) to authenticated;
grant execute on function public.get_client_service_expansion_review(uuid) to authenticated;
