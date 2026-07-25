-- ============================================================================
-- phase-24e — Agriculture industry library + RC Polypipe & CASE candidate cards
--
-- First Industry Intelligence Library (agriculture) plus two client sub-libraries.
-- ALL cards are needs_review; none is activated. Client-published performance
-- claims are labelled client_opinion, never independent proof. Rights on the new
-- industry sources are metadata_and_link_only (official but copyrighted).
-- Idempotent (guarded by slug / title). Additive.
-- ============================================================================

-- ── Authoritative agriculture sources (metadata + link only) ─────────────────
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, canonical_url,
   rights_status, rights_basis, access_mode, trust_tier, ingestion_status,
   rights_checked_at, rights_review_notes)
select * from (values
  ('official_documentation', 'SABI', 'South African Irrigation Institute',
   'SABI Irrigation Design Manual & Knowledge Base', 'https://sabi.co.za/',
   'official_reference', 'Official SA irrigation body; content copyrighted (no open licence stated).',
   'metadata_and_link_only', 'tier_2_trusted_professional', 'catalogued', now(),
   'Authoritative SA irrigation body. Cite + link only; do not mirror the design manual.'),
  ('official_documentation', 'Water Research Commission', 'Water Research Commission (WRC)',
   'Water Utilisation in Agriculture', 'https://www.wrc.org.za/water-utilisation-in-agriculture/',
   'official_reference', 'Official SA research body; per-document rights vary.',
   'metadata_and_link_only', 'tier_1_primary', 'catalogued', now(),
   'Rights checked per report before any excerpt. Metadata + link only by default.'),
  ('official_documentation', 'DALRRD', 'Department of Agriculture, Land Reform and Rural Development',
   'Water Use and Irrigation Development', 'https://www.nda.gov.za/',
   'official_reference', 'SA government publication; per-document rights vary.',
   'metadata_and_link_only', 'tier_1_primary', 'catalogued', now(),
   'Government source. Cite + link; verify each document before storing text.'),
  ('market_report', 'Statistics South Africa', 'Statistics South Africa (Stats SA)',
   'Agriculture statistical publications', 'https://www.statssa.gov.za/',
   'official_reference', 'Official statistics; per-publication rights.',
   'metadata_and_link_only', 'tier_1_primary', 'catalogued', now(),
   'Use for seasonal / economic context. Metadata + link only by default.'),
  ('official_documentation', 'FAO', 'Food and Agriculture Organization of the United Nations',
   'FAO agriculture & irrigation publications', 'https://www.fao.org/',
   'official_reference', 'UN body; many CC-licensed but per-document rights vary.',
   'metadata_and_link_only', 'tier_1_primary', 'catalogued', now(),
   'Check per-document CC licence before storing text.')
) as v(source_type, source_name, author_or_organisation, title, canonical_url,
   rights_status, rights_basis, access_mode, trust_tier, ingestion_status,
   rights_checked_at, rights_review_notes)
where not exists (
  select 1 from public.marketing_library_sources s where lower(s.title) = lower(v.title)
);

-- ── Agriculture INDUSTRY candidate cards (needs_review, industry_specific) ────
insert into public.skill_cards
  (slug, title, category, subcategory, status, knowledge_layer, source_type,
   confidence_level, evidence_label, principle, summary, why_it_matters,
   how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
   relevant_agents, client_specific, reference_state, notes, owner)
select * from (values
  ('agri-farmer-decision-making', 'Farmers buy on proof, not adjectives', 'Agriculture', 'Buyer psychology',
   'needs_review', 'industry_specific', 'professional_source', 'medium', 'market_observation',
   'Farming buyers are risk-managers: they weigh yield, uptime, water/energy cost and downside risk before price.',
   'Agricultural buyers evaluate inputs as risk and return decisions across a season, not impulse purchases.',
   'Lead with measurable outcomes (water saved, hours saved, uptime, ROI over a season) and local proof.',
   '["Show a demonstration or field result","Quantify saving over a season","Name the local reference / area"]'::jsonb,
   '["Selling on slogans instead of measurable outcomes","Ignoring downside risk the farmer carries"]'::jsonb,
   '["Separate a proven outcome from a hypothesis","Ask for the evidence behind any performance number"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","copywriting_agent","content_planner"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Needs reviewer confirmation against SABI/WRC/DALRRD sources.', 'ai-workforce-v2'),

  ('agri-demonstration-led-selling', 'Demonstration and field days beat claims', 'Agriculture', 'Sales motion',
   'needs_review', 'industry_specific', 'professional_source', 'medium', 'market_observation',
   'Seeing a machine or system work on real ground converts better than a spec sheet in agriculture.',
   'Demonstrations, field days and working references are the dominant proof device in farm sales.',
   'Plan content around demos, field days and real installations rather than studio product shots alone.',
   '["Film a real demonstration","Capture a working installation with the farmer","Invite to a field day"]'::jsonb,
   '["Relying only on rendered product images","No path from interest to a live demonstration"]'::jsonb,
   '["Prefer real demonstration evidence over stock imagery"]'::jsonb,
   '["Agriculture"]'::jsonb, '["content_planner","creative_director","copywriting_agent"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Needs reviewer confirmation.', 'ai-workforce-v2'),

  ('agri-seasonality', 'Sell to the season, not the calendar month', 'Agriculture', 'Timing',
   'needs_review', 'industry_specific', 'market_report', 'medium', 'market_observation',
   'Agricultural demand follows planting, irrigation, harvest and cash-flow cycles that differ by crop and region.',
   'Relevance in agriculture is driven by the production season and cash-flow timing, not generic monthly themes.',
   'Map each message to the production window (pre-season prep, in-season uptime, post-harvest ROI).',
   '["Align campaigns to the crop/production window","Time offers to cash-flow (post-harvest)"]'::jsonb,
   '["Generic seasonal themes ignoring the farming calendar","Pushing capital spend at low cash-flow points"]'::jsonb,
   '["Ask which crop/region/season before recommending timing"]'::jsonb,
   '["Agriculture"]'::jsonb, '["content_planner","marketing_strategist"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Confirm seasonal windows against Stats SA / DALRRD.', 'ai-workforce-v2'),

  ('agri-tco-roi', 'Communicate total cost of ownership and risk reduction', 'Agriculture', 'Commercial economics',
   'needs_review', 'industry_specific', 'professional_source', 'medium', 'market_observation',
   'Farmers compare lifetime cost (install, labour, water, energy, maintenance, lifespan), not sticker price.',
   'Agricultural value is a total-cost-of-ownership and risk-reduction story across a season and asset life.',
   'Frame value as TCO and risk reduction, with the assumptions stated, not a single headline percentage.',
   '["Break value into install/labour/water/energy/maintenance/lifespan","State the comparison + assumptions"]'::jsonb,
   '["A single unsubstantiated percentage with no assumptions","Comparing to an unnamed alternative"]'::jsonb,
   '["Never present a client percentage as independent proof without evidence"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","paid_ads_agent","client_report_agent"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Confirm against WRC economics of irrigation.', 'ai-workforce-v2'),

  ('agri-after-sales-trust', 'After-sales support and parts availability are the real product', 'Agriculture', 'Retention',
   'needs_review', 'industry_specific', 'professional_source', 'medium', 'market_observation',
   'Downtime in season is costly; dealers win on parts availability, workshop credibility and fast field service.',
   'In machinery and equipment, ongoing support and uptime drive purchase and repurchase more than the initial sale.',
   'Market parts, workshop and service credibility as core value, not an afterthought.',
   '["Show workshop and parts capability","Evidence fast turnaround / field service","Tell retention stories"]'::jsonb,
   '["Marketing only the sale and ignoring service","No proof of uptime / support"]'::jsonb,
   '["Treat parts + service as primary value for equipment clients"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","content_planner"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Confirm with dealer references.', 'ai-workforce-v2'),

  ('agri-water-energy-efficiency', 'Water and energy efficiency is a commercial argument in SA', 'Agriculture', 'Value drivers',
   'needs_review', 'industry_specific', 'official_documentation', 'medium', 'market_observation',
   'SA water scarcity and energy cost make efficiency a direct commercial and risk argument, backed by official bodies.',
   'Water and energy efficiency in SA agriculture is a cost, risk and compliance argument, not just sustainability.',
   'Tie efficiency claims to cost/risk and cite authoritative bodies (WRC/SABI) where possible.',
   '["Quantify water/energy saved with assumptions","Cite WRC/SABI context for the claim"]'::jsonb,
   '["Vague sustainability language with no numbers","Claiming savings without stated assumptions"]'::jsonb,
   '["Require an assumption + source for any efficiency percentage"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","copywriting_agent"]'::jsonb,
   false, 'candidate_unverified', 'V2 agriculture candidate. Cite WRC/SABI at review.', 'ai-workforce-v2')
) as v(slug, title, category, subcategory, status, knowledge_layer, source_type,
   confidence_level, evidence_label, principle, summary, why_it_matters,
   how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
   relevant_agents, client_specific, reference_state, notes, owner)
where not exists (select 1 from public.skill_cards sc where sc.slug = v.slug);
