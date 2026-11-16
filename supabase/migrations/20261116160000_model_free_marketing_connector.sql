-- #995: model-free external authorship. New service-only seam; existing RLS/profile
-- helpers and legacy UI RPCs are deliberately unchanged (#990 owns that lane).
begin;
create table public.mcp_marketing_write_receipts (
  actor_id uuid not null references public.profiles(id),
  request_key uuid not null,
  input_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id, request_key)
);
alter table public.mcp_marketing_write_receipts enable row level security;
alter table public.mcp_marketing_write_receipts force row level security;
revoke all on public.mcp_marketing_write_receipts from public,anon,authenticated;
grant select,insert on public.mcp_marketing_write_receipts to service_role;

create function public.mcp_write_marketing_artifact(
  p_actor uuid,p_connection uuid,p_context text,p_key uuid,p_input jsonb,p_project_client uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  actor_role text; connection_role text; client uuid; artifact public.ai_marketing_artifacts%rowtype;
  version_row public.ai_marketing_artifact_versions%rowtype; previous public.mcp_marketing_write_receipts%rowtype;
  fingerprint text; result jsonb; action text; specialist text; artifact_type text; decision text;
  expected integer; evidence uuid[]; note text; prior_specialist text; campaign_name text;
begin
  if auth.role() is distinct from 'service_role' or auth.uid() is not null then raise exception 'Service-only marketing operation'; end if;
  select role into actor_role from public.profiles where id=p_actor and is_active=true and role in ('admin','manager','staff','team');
  select role into connection_role from public.profiles where id=p_connection and is_active=true and role in ('admin','manager','staff','team');
  if actor_role is null or connection_role is null or p_context is null or p_context not in ('staff','company_admin','client')
     or (p_actor<>p_connection and connection_role not in ('admin','manager'))
     or (p_context='client' and (p_actor<>p_connection or p_project_client is null))
     or (p_context='company_admin' and (p_actor<>p_connection or connection_role not in ('admin','manager'))) then raise exception 'Active actor and authorised connection required'; end if;
  if p_key is null or jsonb_typeof(p_input) is distinct from 'object' or octet_length(p_input::text)>50000 then raise exception 'Invalid bounded input'; end if;
  client := (p_input->>'client_id')::uuid;
  if not exists(select 1 from public.clients where id=client and active=true) then raise exception 'Exact active client required'; end if;
  if p_context='client' and client is distinct from p_project_client then raise exception 'Exact Project client required'; end if;
  action:=p_input->>'action';
  if action is null or action not in ('draft','decision') then raise exception 'Unsupported marketing action'; end if;
  fingerprint:=encode(sha256(convert_to(p_input::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text||':'||p_key::text,0));
  select * into previous from public.mcp_marketing_write_receipts where actor_id=p_actor and request_key=p_key;
  if found then
    if previous.input_hash<>fingerprint then raise exception 'Receipt key input conflict'; end if;
    return previous.result;
  end if;
  note:=nullif(btrim(p_input->>'note'),'');
  if length(note)>4000 then raise exception 'Note too long'; end if;
  if p_input->>'artifact_id' is not null then
    select * into artifact from public.ai_marketing_artifacts where id=(p_input->>'artifact_id')::uuid and client_id=client for update;
    if not found then raise exception 'Artifact unavailable for exact client'; end if;
  end if;
  if p_input ? 'campaign_id' and (action<>'draft' or artifact.id is not null) then raise exception 'Campaign binding is creation-only'; end if;
  if action='draft' then
    specialist:=p_input->>'specialist';
    artifact_type:=case specialist when 'marketing_strategist' then 'strategy_brief' when 'copywriting_agent' then 'copy_deck' when 'creative_director' then 'creative_direction' when 'brand_guardian' then 'brand_review' when 'social_media_strategist' then 'social_strategy' when 'paid_ads_agent' then 'paid_ads_plan' when 'content_planner' then 'content_plan' end;
    if artifact_type is null or jsonb_typeof(p_input->'content') is distinct from 'object' or octet_length((p_input->'content')::text)>32000 or coalesce(length(btrim(p_input->>'request')),0) not between 1 and 8000 then raise exception 'Invalid authored draft'; end if;
    expected:=(p_input->>'expected_version')::integer;
    if expected is null or expected<0 or expected<>coalesce(artifact.current_version,0) then raise exception 'Stale artifact version'; end if;
    if artifact.status in ('human_approved','rejected') then raise exception 'Closed artifact cannot be overwritten'; end if;
    if jsonb_typeof(p_input->'evidence_card_ids') is distinct from 'array' or jsonb_array_length(p_input->'evidence_card_ids') not between 1 and 50 then raise exception 'Reviewed evidence required'; end if;
    select array_agg(distinct value::uuid) into evidence from jsonb_array_elements_text(p_input->'evidence_card_ids');
    -- Evidence must still be reviewed, current and exact-scope at the atomic save.
    if exists(select 1 from unnest(evidence) as e(card_id) where not exists(
      select 1 from public.skill_cards c where c.id=e.card_id and c.status='active'
      and c.content_hash ~ '^[a-f0-9]{64}$' and c.reviewed_content_hash=c.content_hash
      and (c.review_expires_at is null or c.review_expires_at>=current_date)
      and coalesce(c.source_type,'') not in ('ai_generated','unsourced_blog')
      and ((c.client_specific=false and c.active_client_id is null) or
           (c.client_specific=true and c.active_client_id=client and c.client_scope_key is not distinct from nullif(p_input->>'scope_key','')))
    )) then raise exception 'Evidence is missing, stale, unreviewed or outside client scope'; end if;
    if p_input->>'campaign_id' is not null then
      select m.campaign_name into campaign_name from public.google_ads_campaign_daily_metrics m
        where m.client_id=client and m.campaign_id=p_input->>'campaign_id'
        order by m.metric_date desc,m.campaign_name limit 1;
      if not found then raise exception 'Campaign unavailable for exact client'; end if;
    end if;
    prior_specialist:=artifact.current_specialist;
    if artifact.id is null then
      insert into public.ai_marketing_artifacts(client_id,originating_request,requested_specialist,current_specialist,artifact_type,created_by,campaign_id,campaign_name)
      values(client,btrim(p_input->>'request'),specialist,specialist,artifact_type,p_actor,p_input->>'campaign_id',campaign_name) returning * into artifact;
    end if;
    insert into public.ai_marketing_artifact_versions(artifact_id,version,specialist,content,evidence_card_ids,parent_version_id,created_by)
    values(artifact.id,expected+1,specialist,p_input->'content',evidence,
      (select id from public.ai_marketing_artifact_versions where artifact_id=artifact.id and version=expected),p_actor) returning * into version_row;
    update public.ai_marketing_artifacts set current_version=expected+1,current_specialist=specialist,status='draft',updated_at=now() where id=artifact.id returning * into artifact;
    insert into public.ai_marketing_artifact_transitions(artifact_id,version_id,action,from_specialist,to_specialist,note,actor_id)
    values(artifact.id,version_row.id,case when expected=0 then 'created' when prior_specialist=specialist then 'regenerated' else 'handed_off' end,prior_specialist,specialist,note,p_actor);
  else
    decision:=p_input->>'decision';
    if artifact.id is null or decision is null or decision not in ('approved','rejected','changes_requested','returned') or p_input->'confirm_human_decision' is distinct from 'true'::jsonb then raise exception 'Explicit human decision required'; end if;
    if decision in ('approved','rejected') and actor_role not in ('admin','manager') then raise exception 'Manager approval access required'; end if;
    select * into version_row from public.ai_marketing_artifact_versions where id=(p_input->>'version_id')::uuid and artifact_id=artifact.id and version=artifact.current_version;
    if not found then raise exception 'Decision must target the current version'; end if;
    update public.ai_marketing_artifacts set status=case decision when 'approved' then 'human_approved' when 'rejected' then 'rejected' else 'changes_requested' end,updated_at=now() where id=artifact.id returning * into artifact;
    insert into public.ai_marketing_artifact_approvals(artifact_id,version_id,decision,note,reviewer_id) values(artifact.id,version_row.id,decision,note,p_actor);
    insert into public.ai_marketing_artifact_transitions(artifact_id,version_id,action,from_specialist,to_specialist,note,actor_id) values(artifact.id,version_row.id,decision,version_row.specialist,version_row.specialist,note,p_actor);
  end if;
  insert into public.ai_marketing_artifact_audit(artifact_id,version_id,actor_id,event,details)
  values(artifact.id,version_row.id,p_actor,case when action='draft' then 'external_authored_draft' else 'human_'||decision end,jsonb_build_object('connection_principal',p_connection,'context',p_context,'model_used',false));
  result:=jsonb_build_object('artifact_id',artifact.id,'version_id',version_row.id,'version',artifact.current_version,'status',artifact.status,'client_id',client,'model_used',false,'receipt',jsonb_build_object('actor',p_actor,'key',p_key));
  insert into public.mcp_marketing_write_receipts(actor_id,request_key,input_hash,result) values(p_actor,p_key,fingerprint,result);
  return result;
end $$;
revoke all on function public.mcp_write_marketing_artifact(uuid,uuid,text,uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.mcp_write_marketing_artifact(uuid,uuid,text,uuid,jsonb,uuid) to service_role;
commit;
