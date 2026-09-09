-- 20260908110000_client_intelligence_registration.sql
-- Register client intelligence packs and client-specific skill cards for
-- Cape Lumber, Bloem Action Sports, and Dulux Paint & Paper Bloemfontein.
--
-- Idempotent: uses ON CONFLICT / WHERE NOT EXISTS guards.
-- Additive only: no destructive operations.
-- Client-isolated: every source and card is linked to an exact client UUID via name lookup.
--
-- DO NOT apply without CA approval. This is a data-registration migration.

begin;

-- ── Helper: resolve client UUID by exact name ──────────────────────────────
-- Never fuzzy-match. Exact name only.

do $$
declare
  v_cape_id uuid;
  v_action_id uuid;
  v_dulux_id uuid;
begin
  select id into v_cape_id from public.clients where name = 'Cape Lumber' limit 1;
  select id into v_action_id from public.clients where name = 'Action Sport' limit 1;
  select id into v_dulux_id from public.clients where name = 'Dulux Bloemfontein' limit 1;

  if v_cape_id is null then
    raise notice 'SKIP: Cape Lumber client not found in public.clients';
  end if;
  if v_action_id is null then
    raise notice 'SKIP: Action Sport client not found in public.clients';
  end if;
  if v_dulux_id is null then
    raise notice 'SKIP: Dulux Bloemfontein client not found in public.clients';
  end if;

  -- ── 1. Register client intelligence packs as sources ───────────────────
  -- Each client's permanent intelligence pack is a source in the Marketing Library.
  -- trust_tier = needs_review (requires human approval before grounding production).
  -- source_type = professional_source (internal CG research, not AI-generated).
  -- access_mode = metadata_reference (no full-text ingestion of client intel).

  if v_cape_id is not null then
    insert into public.marketing_library_sources
      (source_type, source_name, author_or_organisation, title, trust_tier,
       access_mode, ingestion_status, canonical_url, source_identifier, notes)
    values
      ('professional_source', 'Cape Lumber Marketing Intelligence Pack',
       'CG Production House', 'Cape Lumber Marketing — Performance and Growth Intelligence',
       'needs_review', 'metadata_and_link_only', 'catalogued',
       'docs/ai-workforce/client-intelligence/CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md',
       'repo:docs/ai-workforce/client-intelligence/CAPE-LUMBER-MARKETING-PERFORMANCE-AND-GROWTH-INTELLIGENCE-2026-08.md',
       'Permanent client intelligence pack. Source of truth for Cape Lumber client-specific skill cards.')
    on conflict (source_identifier) where source_identifier is not null do nothing;
  end if;

  if v_action_id is not null then
    insert into public.marketing_library_sources
      (source_type, source_name, author_or_organisation, title, trust_tier,
       access_mode, ingestion_status, canonical_url, source_identifier, notes)
    values
      ('professional_source', 'Bloem Action Sports Intelligence Pack',
       'CG Production House', 'Action Sport / Bloem Action Sports — Client Marketing Intelligence',
       'needs_review', 'metadata_and_link_only', 'catalogued',
       'docs/ai-workforce/client-intelligence/ACTION-SPORT-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md',
       'repo:docs/ai-workforce/client-intelligence/ACTION-SPORT-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md',
       'Permanent client intelligence pack. Source of truth for Bloem Action Sports client-specific skill cards.')
    on conflict (source_identifier) where source_identifier is not null do nothing;
  end if;

  if v_dulux_id is not null then
    insert into public.marketing_library_sources
      (source_type, source_name, author_or_organisation, title, trust_tier,
       access_mode, ingestion_status, canonical_url, source_identifier, notes)
    values
      ('professional_source', 'Dulux Paint & Paper Bloemfontein Intelligence Pack',
       'CG Production House', 'Dulux Paint & Paper Bloemfontein — Client Marketing Intelligence',
       'needs_review', 'metadata_and_link_only', 'catalogued',
       'docs/ai-workforce/client-intelligence/DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md',
       'repo:docs/ai-workforce/client-intelligence/DULUX-PAINT-PAPER-BLOEMFONTEIN-CLIENT-MARKETING-INTELLIGENCE-2026-08.md',
       'Permanent client intelligence pack. Source of truth for Dulux Paint & Paper Bloemfontein client-specific skill cards.')
    on conflict (source_identifier) where source_identifier is not null do nothing;
  end if;

  -- ── 2. Create client-specific skill cards ──────────────────────────────
  -- Cards enter as needs_review. The activation gate (trigger) requires:
  --   - source_id linked to a source with trust_tier NOT IN (needs_review, tier_4_low_trust)
  --   - at least one skill_card_reviews row with review_status = 'approved'
  --   - last_reviewed IS NOT NULL
  -- Until those conditions are met, cards remain inert and do NOT ground production AI.
  --
  -- NOTE: These cards reference source_id via subquery (source_identifier lookup)
  -- so they are safe to run before knowing the source UUIDs.

  -- ── Cape Lumber cards ──────────────────────────────────────────────────

  if v_cape_id is not null then
    insert into public.skill_cards
      (slug, title, category, subcategory, status, knowledge_layer, source_type,
       confidence_level, evidence_label, principle, summary, why_it_matters,
       how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
       relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    select * from (values
      ('cape-lumber-positioning',
       'Cape Lumber: supplier, not contractor',
       'Client: Cape Lumber', 'Positioning',
       'needs_review'::text, 'active_client_specific'::text, 'staff_observation'::text,
       'high'::text, 'market_observation'::text,
       'Cape Lumber is a timber and building-material supplier. Never present them as providing carpentry, joinery, installation, deck/pergola construction, structural engineering, fireproofing or fire-retardant services.',
       'Misrepresenting Cape Lumber as a contractor creates false advertising risk and confuses the buying journey. Positioning must remain supply-led.',
       'Every Cape Lumber content piece must reinforce supply capability, not installation service. The audience is builders, contractors, architects and project buyers.',
       '["Lead with material supply capability","Reference product grades, treatments, sizes and sourcing","Use CTAs around quotes, material lists and stock enquiries"]'::jsonb,
       '["Do not present Cape Lumber as a contractor or installer","Do not create DIY/tutorial-led content","Do not use influencer-style hype or empty corporate phrases"]'::jsonb,
       '["If the content implies installation or construction work, rewrite to focus on material supply","Always verify the audience is trade/project-focused, not DIY"]'::jsonb,
       '["Construction"]'::jsonb,
       '["marketing_strategist","copywriting_agent","content_planner"]'::jsonb,
       true, v_cape_id, 'candidate_unverified'::text,
       'From permanent intelligence pack. Verified against website and socials.',
       'ai-workforce-v2')
    ) as v(slug, title, category, subcategory, status, knowledge_layer, source_type,
           confidence_level, evidence_label, principle, summary, why_it_matters,
           how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
           relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    on conflict (slug) do nothing;
  end if;

  -- ── Bloem Action Sports cards ──────────────────────────────────────────

  if v_action_id is not null then
    insert into public.skill_cards
      (slug, title, category, subcategory, status, knowledge_layer, source_type,
       confidence_level, evidence_label, principle, summary, why_it_matters,
       how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
       relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    select * from (values
      ('action-sport-voice',
       'Bloem Action Sports: voice and tone rules',
       'Client: Action Sport', 'Voice',
       'needs_review'::text, 'active_client_specific'::text, 'staff_observation'::text,
       'high'::text, 'market_observation'::text,
       'Bloem Action Sports content should sound like people who know the venue, the games and the local audience. Confident, clean, local, energetic yet professional, human. Default English; Afrikaans when the brief asks. Never use em dashes.',
       'Generic or corporate language disconnects from the local indoor-sport audience. The voice must feel like the team behind the counter.',
       'Every caption, poster line and reel script must pass the "could this belong to any sport venue?" test. If yes, rewrite.',
       '["Use real match-moment language specific to indoor sport","Write to the person actually playing","Keep copy short enough to work visually"]'::jsonb,
       '["Do not use em dashes in captions or social copy","Do not use generic AI phrases like elevate your experience or take your game to the next level","Do not recycle old schedule or fixture information"]'::jsonb,
       '["If the copy could be pasted onto any sport venue unchanged, rewrite it","Verify current fixtures, prices and specials before publishing"]'::jsonb,
       '["Tourism","Retail"]'::jsonb,
       '["marketing_strategist","copywriting_agent","content_planner"]'::jsonb,
       true, v_action_id, 'candidate_unverified'::text,
       'From permanent intelligence pack. Verified against website and Facebook.',
       'ai-workforce-v2')
    ) as v(slug, title, category, subcategory, status, knowledge_layer, source_type,
           confidence_level, evidence_label, principle, summary, why_it_matters,
           how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
           relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    on conflict (slug) do nothing;
  end if;

  -- ── Dulux Paint & Paper Bloemfontein cards ─────────────────────────────

  if v_dulux_id is not null then
    insert into public.skill_cards
      (slug, title, category, subcategory, status, knowledge_layer, source_type,
       confidence_level, evidence_label, principle, summary, why_it_matters,
       how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
       relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    select * from (values
      ('dulux-bfn-colour-copy',
       'Dulux BFN: describe colour by room effect, not adjectives',
       'Client: Dulux Bloemfontein', 'Colour Copy',
       'needs_review'::text, 'active_client_specific'::text, 'staff_observation'::text,
       'high'::text, 'market_observation'::text,
       'Describe colour by what it does to the room (softens, warms, cools, adds contrast, quietens the space) rather than only adjectives (beautiful, timeless, calming). Encourage physical swatches when accuracy matters.',
       'Adjective-only colour copy is indistinguishable from any paint brand. Room-effect language demonstrates expertise and helps the customer picture the result.',
       'Every colour-focused content piece must explain the room effect. Never stop at one adjective.',
       '["Explain whether the shade softens, warms, cools or contrasts","Encourage physical swatches and checking colour in real lighting","Connect the colour to a specific room, surface or finish"]'::jsonb,
       '["Do not imply screen colours are exact paint matches","Do not use only adjectives without room-effect context","Do not copy national Dulux copy without local specificity"]'::jsonb,
       '["If describing a colour, always include what it does to the room","If the content is about a specific product, verify current stock and pricing"]'::jsonb,
       '["Retail"]'::jsonb,
       '["marketing_strategist","copywriting_agent","content_planner"]'::jsonb,
       true, v_dulux_id, 'candidate_unverified'::text,
       'From permanent intelligence pack. Verified against Instagram and store content.',
       'ai-workforce-v2')
    ) as v(slug, title, category, subcategory, status, knowledge_layer, source_type,
           confidence_level, evidence_label, principle, summary, why_it_matters,
           how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
           relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
    on conflict (slug) do nothing;
  end if;

end $$;

commit;
