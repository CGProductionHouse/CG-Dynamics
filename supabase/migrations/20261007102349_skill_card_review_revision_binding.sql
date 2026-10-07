-- #433: bind human approval to the exact material content/source/scope/routing.
-- Additive only. UNAPPLIED. Historical approvals remain audit history, not reapproved.
begin;
alter table public.skill_cards add column content_hash text, add column reviewed_content_hash text;
alter table public.skill_card_reviews add column reviewed_content_hash text,
  add column review_kind text not null default 'audit' check (review_kind in ('audit','content_review')),
  add column reviewer_profile_id uuid references public.profiles(id);
create function public.skill_card_material_hash(c public.skill_cards) returns text
language sql stable set search_path = '' as $$
  select encode(sha256(convert_to(
    ((to_jsonb(c) - array['id','status','owner','last_reviewed','created_at','updated_at','content_hash','reviewed_content_hash'])
      || jsonb_build_object('linked_source', (
        select to_jsonb(s) - array['id','created_at','updated_at'] from public.marketing_library_sources s where s.id=c.source_id
      )))::text, 'UTF8')), 'hex');
$$;
revoke all on function public.skill_card_material_hash(public.skill_cards) from public, anon;
grant execute on function public.skill_card_material_hash(public.skill_cards) to authenticated;

create function public.bind_skill_card_revision() returns trigger language plpgsql set search_path = '' as $$
declare h text;
begin
  h := public.skill_card_material_hash(new);
  new.content_hash := h;
  if tg_op = 'INSERT' then
    new.reviewed_content_hash := null;
  elsif public.skill_card_material_hash(old) is distinct from h then
    new.reviewed_content_hash := null;
    if new.status in ('active','reviewed') then new.status := 'needs_review'; end if;
  end if;
  if tg_op='UPDATE' and new.reviewed_content_hash is not null
    and new.reviewed_content_hash is distinct from old.reviewed_content_hash
    and current_user <> pg_get_userbyid((select proowner from pg_proc where oid=
      'public.skill_card_record_review(uuid,text,text,jsonb,text)'::regprocedure)) then
    raise exception 'Canonical human review RPC required for approval binding' using errcode='check_violation';
  end if;
  -- No arbitrary UPDATE can manufacture a reviewed binding without its exact human receipt.
  if new.reviewed_content_hash is not null and (
    new.reviewed_content_hash is distinct from h or not exists (
      select 1 from public.skill_card_reviews r where r.skill_card_id=new.id
      and r.review_kind='content_review' and r.review_status='approved'
      and r.reviewed_content_hash=h and r.reviewer_profile_id is not null
      and r.id=(select rr.id from public.skill_card_reviews rr where rr.skill_card_id=new.id
        and rr.review_kind='content_review' order by rr.reviewed_at desc,rr.id desc limit 1)
    )) then raise exception 'Current human content review required' using errcode='check_violation'; end if;
  return new;
end; $$;
create trigger trg_skill_cards_00_revision before insert or update on public.skill_cards
for each row execute function public.bind_skill_card_revision();

-- Changes to linked source evidence also invalidate approval, without relabelling old evidence.
create function public.invalidate_skill_card_source_review() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if (to_jsonb(old)-array['id','created_at','updated_at']) is distinct from
     (to_jsonb(new)-array['id','created_at','updated_at']) then
    update public.skill_cards set reviewed_content_hash=null,
      status=case when status in ('active','reviewed') then 'needs_review' else status end
      where source_id=new.id;
  end if;
  return new;
end; $$;
create trigger trg_marketing_library_sources_revision after update on public.marketing_library_sources
for each row execute function public.invalidate_skill_card_source_review();
revoke all on function public.bind_skill_card_revision() from public, anon, authenticated;
revoke all on function public.invalidate_skill_card_source_review() from public, anon, authenticated;

-- Only the existing authenticated human RPC may create authoritative review receipts.
create function public.guard_skill_card_content_review() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.review_kind='content_review' then
    raise exception 'Human content review receipts are immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.review_kind='content_review' and (
    current_user <> pg_get_userbyid((select proowner from pg_proc where oid=
      'public.skill_card_record_review(uuid,text,text,jsonb,text)'::regprocedure))
    or auth.uid() is null or not public.is_admin()
    or new.reviewer_profile_id is distinct from auth.uid()
  ) then raise exception 'Canonical human review RPC required'; end if;
  return new;
end; $$;
create trigger trg_skill_card_reviews_content_guard before insert or update or delete on public.skill_card_reviews
for each row execute function public.guard_skill_card_content_review();
revoke all on function public.guard_skill_card_content_review() from public, anon, authenticated;
create or replace function public.enforce_skill_card_activation_gate()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_trust_tier text;
  v_approved_count integer;
  v_client_active boolean;
begin
  if new.status is distinct from 'active' then
    return new;
  end if;

  if new.source_id is null then
    raise exception 'Skill Card activation blocked: a linked source is required.'
      using errcode = 'check_violation';
  end if;

  select trust_tier into v_trust_tier
  from public.marketing_library_sources
  where id = new.source_id;

  if v_trust_tier is null then
    raise exception 'Skill Card activation blocked: the linked source could not be found.'
      using errcode = 'check_violation';
  end if;

  if v_trust_tier in ('needs_review', 'tier_4_low_trust') then
    raise exception 'Skill Card activation blocked: linked source trust tier "%" is not trusted enough.', v_trust_tier
      using errcode = 'check_violation';
  end if;

  select count(*) into v_approved_count
  from public.skill_card_reviews
  where skill_card_id = new.id
    and review_status = 'approved' and review_kind = 'content_review'
    and reviewed_content_hash = new.content_hash;

  if new.content_hash is null or new.reviewed_content_hash is distinct from new.content_hash or v_approved_count = 0 then
    raise exception 'Skill Card activation blocked: at least one approved review is required.'
      using errcode = 'check_violation';
  end if;

  if new.review_expires_at is not null and new.review_expires_at::date < current_date then
    raise exception 'Skill Card review expired' using errcode = 'check_violation';
  end if;
  if new.last_reviewed is null then
    raise exception 'Skill Card activation blocked: last_reviewed must be set.'
      using errcode = 'check_violation';
  end if;

  -- Client-specific knowledge must name an exact, active client.
  if new.client_specific then
    if new.active_client_id is null then
      raise exception 'Skill Card activation blocked: a client-specific card requires an exact active client.'
        using errcode = 'check_violation';
    end if;
    select active into v_client_active from public.clients where id = new.active_client_id;
    if v_client_active is null then
      raise exception 'Skill Card activation blocked: the linked client could not be found.'
        using errcode = 'check_violation';
    end if;
    if not v_client_active then
      raise exception 'Skill Card activation blocked: the linked client is not active.'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$function$;

-- ── Advisory blockers (what the gate WOULD say) ─────────────────────────────
-- Purely informational for the review screen. The trigger above stays the
-- authority; this exists so a reviewer can see why a card is not yet
-- activatable without having to attempt it.
create or replace function public.skill_card_activation_blockers(p_card_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.skill_cards;
  v_tier text;
  v_approved integer;
  v_client_active boolean;
  v_out text[] := '{}';
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into c from public.skill_cards where id = p_card_id;
  if not found then return array['Card not found.']; end if;

  if c.source_id is null then
    v_out := array_append(v_out, 'No linked source. Link a trusted source before activation.');
  else
    select trust_tier into v_tier from public.marketing_library_sources where id = c.source_id;
    if v_tier is null then
      v_out := array_append(v_out, 'The linked source could not be found.');
    elsif v_tier in ('needs_review', 'tier_4_low_trust') then
      v_out := array_append(v_out, 'Source trust tier "' || v_tier || '" is not trusted enough for activation.');
    end if;
  end if;

  select count(*) into v_approved from public.skill_card_reviews
   where skill_card_id = c.id and review_status = 'approved' and review_kind = 'content_review'
     and reviewed_content_hash = c.content_hash;
  if c.content_hash is null or c.reviewed_content_hash is distinct from c.content_hash or v_approved = 0 then
    v_out := array_append(v_out, 'No approved review for the current content revision. Reload and review the card.');
  end if;

  if c.last_reviewed is null then
    v_out := array_append(v_out, 'No last-reviewed date. Approving the card sets this.');
  end if;

  if c.client_specific then
    if c.active_client_id is null then
      v_out := array_append(v_out, 'Client-specific card has no exact client assigned.');
    else
      select active into v_client_active from public.clients where id = c.active_client_id;
      if v_client_active is null then
        v_out := array_append(v_out, 'The linked client could not be found.');
      elsif not v_client_active then
        v_out := array_append(v_out, 'The linked client is not active.');
      end if;
    end if;
  end if;

  if c.review_expires_at is not null and c.review_expires_at < now() then
    v_out := array_append(v_out, 'The review has expired. Re-review before activating.');
  end if;

  return v_out;
end;
$$;

drop function public.skill_card_review_queue();
create function public.skill_card_review_queue()
returns table (
  id uuid,
  slug text,
  title text,
  category text,
  subcategory text,
  status text,
  knowledge_layer text,
  principle text,
  summary text,
  why_it_matters text,
  how_to_apply text,
  agent_instructions text,
  safe_claim text,
  prohibited_overclaim text,
  jurisdiction text,
  evidence_label text,
  confidence_level text,
  source_reference text,
  reference_state text,
  relevant_agents jsonb,
  resolved_agents text[],
  unrecognised_agents text[],
  relevant_industries jsonb,
  client_specific boolean,
  active_client_id uuid,
  active_client_name text,
  active_client_is_active boolean,
  source_id uuid,
  source_name text,
  source_trust_tier text,
  last_reviewed timestamptz,
  review_expires_at timestamptz,
  review_count integer,
  approved_review_count integer,
  latest_review_status text,
  latest_review_by text,
  latest_review_notes text,
  latest_reviewed_at timestamptz,
  blockers text[],
  ready_to_activate boolean,
  priority_group integer,
  content_hash text,
  reviewed_content_hash text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.slug, c.title, c.category, c.subcategory, c.status, c.knowledge_layer,
    c.principle, c.summary, c.why_it_matters, c.how_to_apply::text, c.agent_instructions::text,
    c.safe_claim, c.prohibited_overclaim, c.jurisdiction, c.evidence_label,
    c.confidence_level, c.source_reference, c.reference_state,
    c.relevant_agents,
    coalesce((
      select array_agg(distinct public.canonical_agent_key(a) order by public.canonical_agent_key(a))
      from jsonb_array_elements_text(coalesce(c.relevant_agents, '[]'::jsonb)) a
      where public.canonical_agent_key(a) is not null
    ), '{}') as resolved_agents,
    coalesce((
      select array_agg(distinct a order by a)
      from jsonb_array_elements_text(coalesce(c.relevant_agents, '[]'::jsonb)) a
      where public.canonical_agent_key(a) is null
    ), '{}') as unrecognised_agents,
    c.relevant_industries, c.client_specific, c.active_client_id,
    cl.name as active_client_name, cl.active as active_client_is_active,
    c.source_id, s.source_name, s.trust_tier as source_trust_tier,
    c.last_reviewed::timestamptz, c.review_expires_at::timestamptz,
    (select count(*)::int from public.skill_card_reviews r where r.skill_card_id = c.id) as review_count,
    (select count(*)::int from public.skill_card_reviews r where r.skill_card_id = c.id and r.review_status = 'approved' and r.review_kind = 'content_review' and r.reviewed_content_hash = c.content_hash) as approved_review_count,
    lr.review_status as latest_review_status,
    lr.reviewed_by as latest_review_by,
    lr.review_notes as latest_review_notes,
    lr.reviewed_at as latest_reviewed_at,
    public.skill_card_activation_blockers(c.id) as blockers,
    (c.status <> 'active' and cardinality(public.skill_card_activation_blockers(c.id)) = 0) as ready_to_activate,
    case
      when c.category in ('Music & Copyright Rights', 'TikTok Platform Risk') then 1
      when c.category = 'Marketing Library' then 2
      when c.client_specific then 3
      else 4
    end as priority_group,
    public.skill_card_material_hash(c), c.reviewed_content_hash
  from public.skill_cards c
  left join public.marketing_library_sources s on s.id = c.source_id
  left join public.clients cl on cl.id = c.active_client_id
  left join lateral (
    select r.review_status, r.reviewed_by, r.review_notes, r.reviewed_at
    from public.skill_card_reviews r
    where r.skill_card_id = c.id
    order by r.reviewed_at desc
    limit 1
  ) lr on true
  where public.is_admin()
  order by
    case when c.status = 'active' then 1 else 0 end,
    case
      when c.category in ('Music & Copyright Rights', 'TikTok Platform Risk') then 1
      when c.category = 'Marketing Library' then 2
      when c.client_specific then 3
      else 4
    end,
    c.category, c.title;
$$;

drop function public.skill_card_record_review(uuid,text,text,jsonb);
create function public.skill_card_record_review(
  p_card_id uuid, p_decision text, p_note text default null, p_edits jsonb default null,
  p_expected_content_hash text default null
) returns public.skill_cards language plpgsql security definer set search_path='' as $$
declare c public.skill_cards; actor text; k text; v jsonb; locked_source uuid;
  allowed text[] := array['principle','summary','why_it_matters','how_to_apply','agent_instructions',
    'safe_claim','prohibited_overclaim','jurisdiction','confidence_level','evidence_label'];
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_decision is null or p_decision not in ('approved','changes_requested','rejected','deprecated','needs_review') then
    raise exception 'Unsupported review decision'; end if;
  select * into c from public.skill_cards where id=p_card_id;
  if not found then raise exception 'Skill Card not found'; end if;
  -- Source -> card lock order matches source invalidation; no card/source deadlock loop.
  locked_source := c.source_id;
  perform 1 from public.marketing_library_sources where id=c.source_id for share;
  select * into c from public.skill_cards where id=p_card_id for update;
  if not found then raise exception 'Skill Card not found'; end if;
  if c.source_id is distinct from locked_source then
    raise exception 'Skill Card source changed. Reload and review.' using errcode='serialization_failure'; end if;
  if p_expected_content_hash is null or p_expected_content_hash !~ '^[a-f0-9]{64}$'
    or p_expected_content_hash is distinct from public.skill_card_material_hash(c) then
    raise exception 'Skill Card changed. Reload and review the current content.' using errcode='serialization_failure';
  end if;
  select full_name into actor from public.profiles where id=auth.uid();
  -- Review never activates. A legacy active card may be reviewed without rewriting
  -- history; it must then pass the separate deliberate activation action.
  update public.skill_cards set status=case when status='active' then 'needs_review' else status end,
    reviewed_content_hash=null where id=p_card_id;
  if p_edits is not null then
    if jsonb_typeof(p_edits)<>'object' then raise exception 'Edits must be an object'; end if;
    for k,v in select key,value from jsonb_each(p_edits) loop
      if not k=any(allowed) then raise exception 'Unsupported review edit: %',k; end if;
      if k in ('how_to_apply','agent_instructions') then
        -- Canonical storage is JSON arrays; the review editor also accepts a JSON-array string.
        if jsonb_typeof(v)='string' then v := (v #>> '{}')::jsonb; end if;
        if jsonb_typeof(v)<>'array' or exists(select 1 from jsonb_array_elements(v) e where jsonb_typeof(e)<>'string') then
          raise exception 'Review list edits must be string arrays'; end if;
        execute format('update public.skill_cards set %I=$1 where id=$2',k) using v,p_card_id;
      else
        if jsonb_typeof(v) not in ('string','null') then raise exception 'Review wording must be text'; end if;
        execute format('update public.skill_cards set %I=$1 where id=$2',k)
          using nullif(btrim(v #>> '{}'),''),p_card_id;
      end if;
    end loop;
  end if;
  -- Refresh the DB-owned hash even for legacy rows; this does not approve any other card.
  update public.skill_cards set content_hash=public.skill_card_material_hash(skill_cards) where id=p_card_id returning * into c;
  insert into public.skill_card_reviews(skill_card_id,reviewed_by,reviewer_profile_id,review_status,review_notes,review_kind,reviewed_content_hash,reviewed_at)
    values(p_card_id,coalesce(actor,'Admin'),auth.uid(),p_decision,nullif(btrim(p_note),''),
      'content_review',c.content_hash,greatest(clock_timestamp(),
        coalesce((select max(reviewed_at)+interval '1 microsecond' from public.skill_card_reviews
          where skill_card_id=p_card_id and review_kind='content_review'),clock_timestamp())));
  update public.skill_cards set reviewed_content_hash=case when p_decision='approved' then c.content_hash else null end,
    last_reviewed=case when p_decision='approved' then current_date else last_reviewed end,
    status=case when p_decision='approved' then 'reviewed'
                when p_decision='deprecated' then 'deprecated' when p_decision='rejected' then 'draft' else 'needs_review' end
    where id=p_card_id returning * into c;
  return c;
end; $$;
revoke all on function public.skill_card_record_review(uuid,text,text,jsonb,text) from public, anon;
grant execute on function public.skill_card_record_review(uuid,text,text,jsonb,text) to authenticated;

-- Activation/routing records retain default 'audit' and never serve as human content approvals.
create or replace function public.skill_card_activate(p_card_id uuid) returns public.skill_cards
language plpgsql security definer set search_path='' as $$
declare c public.skill_cards;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  select * into c from public.skill_cards where id=p_card_id for update;
  if not found then raise exception 'Skill Card not found'; end if;
  if cardinality(public.skill_card_activation_blockers(c.id))<>0 then raise exception 'Current content review and trusted source required'; end if;
  update public.skill_cards set status='active' where id=p_card_id returning * into c;
  insert into public.skill_card_reviews(skill_card_id,reviewed_by,review_status,review_notes)
    values(p_card_id,(select full_name from public.profiles where id=auth.uid()),'approved','Activated for production use.');
  return c;
end; $$;
revoke all on function public.skill_card_review_queue() from public, anon;
grant execute on function public.skill_card_review_queue() to authenticated;
-- Same canonical table, read-only snapshot for the legacy detail editor. No backfill/store.
create function public.skill_card_review_cards() returns setof public.skill_cards
language plpgsql stable security definer set search_path='' as $$
declare c public.skill_cards;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Admin access required'; end if;
  for c in select * from public.skill_cards order by updated_at desc loop
    c.content_hash := public.skill_card_material_hash(c);
    return next c;
  end loop;
end; $$;
revoke all on function public.skill_card_review_cards() from public, anon;
grant execute on function public.skill_card_review_cards() to authenticated;
notify pgrst, 'reload schema';
commit;

