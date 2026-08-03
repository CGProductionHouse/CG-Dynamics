-- Skill Card admin review workflow.
--
-- Adds the practical review surface needed to safely activate the first useful
-- knowledge pack. It does NOT weaken anything:
--
--  * skill_cards / skill_card_reviews keep their existing admin-only RLS.
--  * The existing activation trigger remains the single enforcement authority.
--    Everything here either reports what it would say, or attempts the update
--    and lets the trigger decide.
--  * The gate is STRENGTHENED: a client-specific card can no longer be
--    activated without an exact, active client.
--  * Activation is strictly one card per call — there is no bulk path.

-- ── Canonical agent keys (mirrors agentRegistry.ts / skilledAgents.ts) ───────
-- Used to preview which specialists will receive a card and to surface obsolete
-- or unrecognised keys. An unknown key resolves to null so the reviewer sees it
-- rather than the card silently reaching nobody.
create or replace function public.canonical_agent_key(p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_key, '')))
    when 'creative_director_agent' then 'creative_director'
    when 'creative_director' then 'creative_director'
    when 'marketing_strategist_agent' then 'marketing_strategist'
    when 'marketing_strategist' then 'marketing_strategist'
    when 'copywriter' then 'copywriting_agent'
    when 'copywriting' then 'copywriting_agent'
    when 'copywriting_agent' then 'copywriting_agent'
    when 'brand_guardian_agent' then 'brand_guardian'
    when 'brand_guardian' then 'brand_guardian'
    when 'paid_ads' then 'paid_ads_agent'
    when 'paid_ads_agent' then 'paid_ads_agent'
    when 'content_planner_agent' then 'content_planner'
    when 'content_planner' then 'content_planner'
    when 'client_report' then 'client_report_agent'
    when 'client_report_agent' then 'client_report_agent'
    when 'research_librarian_agent' then 'research_librarian'
    when 'research_librarian' then 'research_librarian'
    when 'historical_advertising_analyst_agent' then 'historical_advertising_analyst'
    when 'historical_advertising_analyst' then 'historical_advertising_analyst'
    when 'social_media_strategist_agent' then 'social_media_strategist'
    when 'social_media_strategist' then 'social_media_strategist'
    else null
  end;
$$;

-- ── Strengthen the activation gate ──────────────────────────────────────────
-- Same checks as before, plus: a client-specific card requires an exact, ACTIVE
-- client. Previously a client-specific card could be activated with no client
-- or an inactive one, which would have put client knowledge into production
-- without a verifiable owner.
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
    and review_status = 'approved';

  if v_approved_count = 0 then
    raise exception 'Skill Card activation blocked: at least one approved review is required.'
      using errcode = 'check_violation';
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
set search_path = public
as $$
declare
  c public.skill_cards;
  v_tier text;
  v_approved integer;
  v_client_active boolean;
  v_out text[] := '{}';
begin
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
   where skill_card_id = c.id and review_status = 'approved';
  if v_approved = 0 then
    v_out := array_append(v_out, 'No approved review yet. Approve the card first.');
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

-- ── Review queue ────────────────────────────────────────────────────────────
-- One admin-only read that returns everything the review screen needs, so the
-- UI never re-derives safety logic itself.
--
-- priority_group implements the agreed first-review order:
--   1 music + platform-rights safety
--   2 universal evidence / specificity / offer / customer clarity
--   3 verified client-specific claim-safety and product limits
--   4 broad agriculture observations and unsupported historical claims (later)
create or replace function public.skill_card_review_queue()
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
  priority_group integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.slug, c.title, c.category, c.subcategory, c.status, c.knowledge_layer,
    c.principle, c.summary, c.why_it_matters, c.how_to_apply, c.agent_instructions,
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
    c.last_reviewed, c.review_expires_at,
    (select count(*)::int from public.skill_card_reviews r where r.skill_card_id = c.id) as review_count,
    (select count(*)::int from public.skill_card_reviews r where r.skill_card_id = c.id and r.review_status = 'approved') as approved_review_count,
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
    end as priority_group
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

-- ── Record a review decision (never activates) ──────────────────────────────
-- Records reviewer, note and timestamp. May apply reviewer wording edits to the
-- claim-safety fields so overconfident/absolute wording can be softened BEFORE
-- approval. Approving sets last_reviewed; it does NOT set status to active.
create or replace function public.skill_card_record_review(
  p_card_id uuid,
  p_decision text,
  p_note text default null,
  p_edits jsonb default null
) returns public.skill_cards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card public.skill_cards;
  v_reviewer text;
  v_allowed text[] := array['principle','summary','why_it_matters','how_to_apply',
                            'agent_instructions','safe_claim','prohibited_overclaim',
                            'jurisdiction','confidence_level','evidence_label'];
  k text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required to review Skill Cards';
  end if;
  if p_decision not in ('approved','changes_requested','rejected','deprecated','needs_review') then
    raise exception 'Unsupported review decision: %', p_decision;
  end if;

  select * into v_card from public.skill_cards where id = p_card_id for update;
  if not found then raise exception 'Skill Card not found'; end if;

  select coalesce(full_name, 'admin') into v_reviewer from public.profiles where id = auth.uid();

  -- Reviewer wording edits, restricted to an explicit allow-list. Structural and
  -- routing fields (status, source, client scope, agents) are never editable here.
  if p_edits is not null and jsonb_typeof(p_edits) = 'object' then
    foreach k in array v_allowed loop
      if p_edits ? k then
        execute format('update public.skill_cards set %I = $1 where id = $2', k)
          using nullif(btrim(coalesce(p_edits ->> k, '')), ''), p_card_id;
      end if;
    end loop;
  end if;

  insert into public.skill_card_reviews (skill_card_id, reviewed_by, review_status, review_notes)
  values (p_card_id, v_reviewer, p_decision, nullif(btrim(coalesce(p_note, '')), ''));

  -- Approving records the review date. Deprecating retires an existing card.
  if p_decision = 'approved' then
    update public.skill_cards set last_reviewed = now() where id = p_card_id;
  elsif p_decision = 'deprecated' then
    update public.skill_cards set status = 'deprecated' where id = p_card_id;
  elsif p_decision = 'rejected' then
    update public.skill_cards set status = 'draft' where id = p_card_id;
  end if;

  select * into v_card from public.skill_cards where id = p_card_id;
  return v_card;
end;
$$;

-- ── Activate exactly one card ───────────────────────────────────────────────
-- Deliberately single-card: there is no bulk activation path anywhere. The
-- UPDATE fires the existing gate trigger, which is the real enforcement.
create or replace function public.skill_card_activate(p_card_id uuid)
returns public.skill_cards
language plpgsql
security definer
set search_path = public
as $$
declare v_card public.skill_cards;
begin
  if not public.is_admin() then
    raise exception 'Admin access required to activate Skill Cards';
  end if;
  select * into v_card from public.skill_cards where id = p_card_id for update;
  if not found then raise exception 'Skill Card not found'; end if;
  if v_card.status = 'active' then return v_card; end if;

  -- The activation gate trigger validates source, trust tier, approved review,
  -- last_reviewed and client scope, and raises with a specific reason.
  update public.skill_cards set status = 'active' where id = p_card_id returning * into v_card;

  insert into public.skill_card_reviews (skill_card_id, reviewed_by, review_status, review_notes)
  values (p_card_id,
          (select coalesce(full_name, 'admin') from public.profiles where id = auth.uid()),
          'approved', 'Activated for production use.');
  return v_card;
end;
$$;

revoke all on function public.canonical_agent_key(text) from public, anon;
revoke all on function public.skill_card_activation_blockers(uuid) from public, anon;
revoke all on function public.skill_card_review_queue() from public, anon;
revoke all on function public.skill_card_record_review(uuid, text, text, jsonb) from public, anon;
revoke all on function public.skill_card_activate(uuid) from public, anon;
grant execute on function public.canonical_agent_key(text) to authenticated;
grant execute on function public.skill_card_activation_blockers(uuid) to authenticated;
grant execute on function public.skill_card_review_queue() to authenticated;
grant execute on function public.skill_card_record_review(uuid, text, text, jsonb) to authenticated;
grant execute on function public.skill_card_activate(uuid) to authenticated;

notify pgrst, 'reload schema';
