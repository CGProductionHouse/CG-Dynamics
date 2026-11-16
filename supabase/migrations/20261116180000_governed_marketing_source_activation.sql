-- #995: authenticated admin-only canonical source review / activation adapter.
-- No service-role identity impersonation; no shared policy/helper changes.
begin;
create function public.mcp_marketing_source_review(
  p_card uuid, p_client uuid default null, p_scope text default null,
  p_document uuid default null, p_offset integer default 0,
  p_activate boolean default false, p_expected_hash text default null,
  p_confirm boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  c public.skill_cards; s public.marketing_library_sources; d public.marketing_library_documents;
  locked_source uuid; blockers text[]; documents jsonb; chunks jsonb; activated boolean:=false;
begin
  -- Retain canonical admin authority and independently deny inactive sessions.
  if auth.uid() is null or not coalesce(public.is_admin(),false)
    or not exists(select 1 from public.profiles where id=auth.uid() and is_active=true and role='admin')
    then raise exception 'Active authenticated admin required'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'Invalid offset'; end if;
  select source_id into locked_source from public.skill_cards where id=p_card;
  perform 1 from public.marketing_library_sources where id=locked_source for share;
  select * into c from public.skill_cards where id=p_card for update;
  if not found or c.source_id is distinct from locked_source then raise exception 'Card unavailable; reload'; end if;
  if (c.client_specific and (c.active_client_id is distinct from p_client
       or c.client_scope_key is distinct from p_scope
       or not exists(select 1 from public.clients where id=p_client and active=true)))
    or (not c.client_specific and (p_client is not null or c.active_client_id is not null or p_scope is not null))
    then raise exception 'Exact card client and scope required'; end if;
  blockers:=public.skill_card_activation_blockers(c.id);
  if p_activate then
    if p_confirm is distinct from true then raise exception 'Explicit human activation confirmation required'; end if;
    if p_expected_hash is null or p_expected_hash is distinct from public.skill_card_material_hash(c)
      or p_expected_hash is distinct from c.content_hash then raise exception 'Card revision changed; reload'; end if;
    if cardinality(blockers)<>0 then raise exception 'Canonical activation requirements not met'; end if;
    -- Same gate, triggers, authenticated reviewer identity and audit as the retained UI.
    -- Repeated requests for the same active revision do not add redundant audit rows.
    if c.status<>'active' then c:=public.skill_card_activate(c.id); end if;
    activated:=true;
  end if;
  select * into s from public.marketing_library_sources where id=c.source_id;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into documents from (
    select id,title,edition,document_type,ingestion_status,text_human_verified,rights_status,access_mode,content_hash
      from public.marketing_library_documents where source_id=c.source_id order by id limit 50 offset p_offset
  ) x;
  chunks:='[]'::jsonb;
  if p_document is not null then
    select * into d from public.marketing_library_documents where id=p_document and source_id=c.source_id;
    if not found then raise exception 'Document unavailable for exact source'; end if;
    -- Bibliographic/excerpt/research/owned status is not a full-text redistribution grant.
    -- Restrict external raw text to verified public-domain documents with current source permission.
    if s.rights_status is distinct from 'public_domain' or s.access_mode is distinct from 'full_text_allowed'
      or s.full_text_storage is distinct from true or s.commercial_use is distinct from 'allowed'
      or s.rights_checked_at is null or s.ingestion_status is distinct from 'verified'
      or d.rights_status is distinct from 'public_domain' or d.access_mode is distinct from 'full_text_allowed'
      or d.ingestion_status is distinct from 'verified' or d.text_human_verified is distinct from true
      then raise exception 'Source rights or verification do not permit raw text'; end if;
    select coalesce(jsonb_agg(x),'[]'::jsonb) into chunks from (
      select id,section,page_start,page_end,left(body,8000) as body,length(body)>8000 as truncated,content_hash
        from public.marketing_library_chunks where document_id=d.id and verification_state='verified'
        order by id limit 10 offset p_offset
    ) x;
  end if;
  return jsonb_build_object('model_used',false,'activated',activated,'blockers',blockers,
    'card',jsonb_build_object('id',c.id,'title',c.title,'status',c.status,'content_hash',public.skill_card_material_hash(c),
      'reviewed_content_hash',c.reviewed_content_hash,'source_id',c.source_id,'client_id',c.active_client_id,
      'scope_key',c.client_scope_key,'principle',c.principle,'summary',c.summary,'how_to_apply',c.how_to_apply,
      'mistakes_to_avoid',c.mistakes_to_avoid,'agent_instructions',c.agent_instructions),
    'source',jsonb_build_object('id',s.id,'title',s.title,'source_name',s.source_name,
      'author_or_organisation',s.author_or_organisation,'canonical_url',s.canonical_url,
      'trust_tier',s.trust_tier,'rights_status',s.rights_status,'access_mode',s.access_mode,
      'commercial_use',s.commercial_use,'full_text_storage',s.full_text_storage,'rights_checked_at',s.rights_checked_at),
    'documents',documents,'documents_next_offset',case when jsonb_array_length(documents)=50 and p_offset<100000 then p_offset+50 end,
    'scan_limit_reached',p_offset>=100000 and (jsonb_array_length(documents)=50 or jsonb_array_length(chunks)=10),
    'chunks',chunks,'chunks_next_offset',case when jsonb_array_length(chunks)=10 and p_offset<100000 then p_offset+10 end);
end $$;
revoke all on function public.mcp_marketing_source_review(uuid,uuid,text,uuid,integer,boolean,text,boolean) from public,anon,service_role;
grant execute on function public.mcp_marketing_source_review(uuid,uuid,text,uuid,integer,boolean,text,boolean) to authenticated;
commit;
