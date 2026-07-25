-- ============================================================================
-- phase-24f — RC Polypipe & CASE Bloemfontein client candidate cards (V2)
--
-- Client-specific candidate cards, all needs_review, isolated to the exact live
-- client_id. Client-published performance claims are labelled client_opinion and
-- carry a verification request — never presented as independent proof.
-- Idempotent (guarded by slug). Additive.
-- ============================================================================

insert into public.skill_cards
  (slug, title, category, subcategory, status, knowledge_layer, source_type,
   confidence_level, evidence_label, principle, summary, why_it_matters,
   how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
   relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
select * from (values
  -- ── RC Polypipe (4f6106de) — agriculture / irrigation ──────────────────────
  ('rc-polypipe-audience', 'RC Polypipe audience: field-irrigation farmers', 'Client: RC Polypipe', 'Audience',
   'needs_review', 'active_client_specific', 'official_documentation', 'high', 'market_observation',
   'RC Polypipe sells UV-treated HDPE field-irrigation pipe to South African farmers irrigating level or slightly-downgraded land.',
   'Audience is farmers needing affordable field irrigation on suitable terrain, not general plumbing/construction buyers.',
   'Target farming audiences; frame around affordable, durable field irrigation. Do not position as civil/plumbing pipe.',
   '["Speak to farmers irrigating fields","Lead with affordability + durability","Qualify terrain suitability early"]'::jsonb,
   '["Positioning as general construction/plumbing pipe","Ignoring the farming use-case"]'::jsonb,
   '["Classify strictly under agriculture/irrigation, never civil pipe"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","copywriting_agent","content_planner"]'::jsonb,
   true, '4f6106de-c437-404e-8cef-fbe848de0665'::uuid, 'candidate_unverified',
   'Source: rcpolypipe.com official site (2026-07-25). Needs client confirmation + internal review.', 'ai-workforce-v2'),

  ('rc-polypipe-product-limits', 'RC Polypipe product facts and hard limits', 'Client: RC Polypipe', 'Product',
   'needs_review', 'active_client_specific', 'official_documentation', 'high', 'market_observation',
   'UV-treated HDPE pipe in several diameters; works on level/slightly-downgraded land only; cannot pump uphill; needs ~1.8 m minimum water head; pump ~150k-350k L/h.',
   'The product has clear suitability limits that must be stated to avoid mis-sold installations.',
   'Always include suitability limits in education content and lead qualification.',
   '["State terrain limits plainly","Mention water-head and pump requirements","Screen unsuitable sites out early"]'::jsonb,
   '["Implying it works on any terrain","Hiding water-head / pump requirements"]'::jsonb,
   '["Never omit the stated product limitations in client-facing copy"]'::jsonb,
   '["Agriculture"]'::jsonb, '["copywriting_agent","brand_guardian","marketing_strategist"]'::jsonb,
   true, '4f6106de-c437-404e-8cef-fbe848de0665', 'candidate_unverified',
   'Source: rcpolypipe.com official site. Limits are product facts, not marketing gloss.', 'ai-workforce-v2'),

  ('rc-polypipe-94-claim', 'RC Polypipe "94% more cost-effective" is a client claim, not proof', 'Client: RC Polypipe', 'Claim safety',
   'needs_review', 'active_client_specific', 'official_documentation', 'opinion', 'client_opinion',
   'The "94% more cost-effective" figure is published by the client and is not independently substantiated in CG evidence.',
   'This is a client-published marketing claim. It must not be presented as independent proof until substantiated.',
   'Attribute the figure to RC Polypipe; do not restate it as an independent fact. Request substantiating evidence.',
   '["Attribute the claim to the client","Do not present as independent proof","Raise a verification request"]'::jsonb,
   '["Restating 94% as a proven fact","Using it in CG-voiced copy as independent evidence"]'::jsonb,
   '["Treat as client_opinion; require evidence before any proof framing"]'::jsonb,
   '["Agriculture"]'::jsonb, '["brand_guardian","paid_ads_agent","client_report_agent"]'::jsonb,
   true, '4f6106de-c437-404e-8cef-fbe848de0665', 'candidate_unverified',
   'VERIFICATION REQUEST — evidence needed: compared system; assumptions; field size; equipment/install/pumping/labour/maintenance costs; product lifespan; calculation period; source date. Source: rcpolypipe.com.', 'ai-workforce-v2'),

  ('rc-polypipe-suitability-screening', 'RC Polypipe: qualify leads on terrain, head and pump', 'Client: RC Polypipe', 'Lead qualification',
   'needs_review', 'active_client_specific', 'staff_observation', 'medium', 'market_observation',
   'Enquiries should be screened for level/slightly-downgraded terrain, adequate water head and pump capacity before quoting.',
   'Screening on suitability protects the customer and the brand from mis-sold installations.',
   'Build enquiry flows that ask terrain, water head and pump capacity up front.',
   '["Ask terrain shape/slope","Ask available water head","Ask pump capacity"]'::jsonb,
   '["Quoting before suitability is known","Promising results on unsuitable sites"]'::jsonb,
   '["Recommend a suitability screen before any quote"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","content_planner"]'::jsonb,
   true, '4f6106de-c437-404e-8cef-fbe848de0665', 'candidate_unverified',
   'CG observation grounded in stated product limits. Needs internal review.', 'ai-workforce-v2'),

  -- ── CASE Bloemfontein (079df21e) — agricultural machinery dealership ────────
  ('case-bfn-uptime-parts', 'CASE Bloemfontein: uptime, parts and workshop are core value', 'Client: CASE Bloemfontein', 'Value',
   'needs_review', 'active_client_specific', 'official_documentation', 'high', 'market_observation',
   'A dealership''s parts division, workshop and technical support drive purchase and repurchase as much as the machine sale.',
   'CASE Bloemfontein is a full dealership (sales + parts + service), not a product-poster account.',
   'Give parts, workshop and after-sales credibility primary billing alongside equipment.',
   '["Show workshop + parts capability","Evidence service turnaround","Tell retention stories"]'::jsonb,
   '["Reducing the account to product posters","Ignoring parts/service value"]'::jsonb,
   '["Always include parts + after-sales in the value story"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","content_planner"]'::jsonb,
   true, '079df21e-783a-4648-b3fa-0acae6e68867', 'candidate_unverified',
   'Source: casebloemfontein.co.za official site. Needs client confirmation + internal review.', 'ai-workforce-v2'),

  ('case-bfn-multi-line', 'CASE Bloemfontein: agriculture primary, construction/Husqvarna secondary', 'Client: CASE Bloemfontein', 'Positioning',
   'needs_review', 'active_client_specific', 'official_documentation', 'high', 'market_observation',
   'Case IH agriculture is the primary line; CASE construction machinery and Husqvarna outdoor power are secondary lines.',
   'Positioning must lead with agricultural machinery while covering the secondary lines correctly.',
   'Lead agri content; give construction and Husqvarna their own correctly-scoped treatment.',
   '["Lead with Case IH agriculture","Give construction its own audience","Treat Husqvarna as outdoor power"]'::jsonb,
   '["Blending all lines into one generic message","Underplaying the agriculture core"]'::jsonb,
   '["Primary classification is agricultural machinery/dealership"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","creative_director","content_planner"]'::jsonb,
   true, '079df21e-783a-4648-b3fa-0acae6e68867', 'candidate_unverified',
   'Source: casebloemfontein.co.za (Case IH, CASE construction, Husqvarna, parts, workshop).', 'ai-workforce-v2'),

  ('case-bfn-seasonal-urgency', 'CASE Bloemfontein: in-season equipment urgency', 'Client: CASE Bloemfontein', 'Timing',
   'needs_review', 'active_client_specific', 'staff_observation', 'medium', 'market_observation',
   'Planting and harvest windows create urgency for machine availability, parts and fast service.',
   'Seasonal urgency is a genuine driver for equipment sales, parts stocking and service demand.',
   'Time campaigns to the production window; push parts/service readiness before peak season.',
   '["Align to planting/harvest windows","Promote parts readiness pre-season","Offer fast in-season service"]'::jsonb,
   '["Generic monthly themes","Promoting capital spend at low cash-flow points"]'::jsonb,
   '["Ask crop/region/season before timing recommendations"]'::jsonb,
   '["Agriculture"]'::jsonb, '["content_planner","marketing_strategist"]'::jsonb,
   true, '079df21e-783a-4648-b3fa-0acae6e68867', 'candidate_unverified',
   'CG observation grounded in dealership + agriculture seasonality. Needs internal review.', 'ai-workforce-v2'),

  ('case-bfn-tco-demos', 'CASE Bloemfontein: TCO and demonstrations, finance only where verified', 'Client: CASE Bloemfontein', 'Commercial economics',
   'needs_review', 'active_client_specific', 'staff_observation', 'medium', 'market_observation',
   'Equipment buyers weigh total cost of ownership and want demonstrations; any finance/warranty terms must be verified before use.',
   'TCO and demonstrations convert equipment buyers; unverified finance/warranty specifics must not be stated.',
   'Frame value as TCO + demonstration; only cite finance/warranty terms confirmed by the client.',
   '["Frame value as TCO","Offer demonstrations / precision-ag proof","Verify any finance/warranty term first"]'::jsonb,
   '["Stating unverified finance/warranty terms","Selling on price alone"]'::jsonb,
   '["Never state finance/warranty specifics without client verification"]'::jsonb,
   '["Agriculture"]'::jsonb, '["marketing_strategist","paid_ads_agent","brand_guardian"]'::jsonb,
   true, '079df21e-783a-4648-b3fa-0acae6e68867', 'candidate_unverified',
   'CG observation. Finance/warranty terms require client verification before any client-facing use.', 'ai-workforce-v2')
) as v(slug, title, category, subcategory, status, knowledge_layer, source_type,
   confidence_level, evidence_label, principle, summary, why_it_matters,
   how_to_apply, mistakes_to_avoid, agent_instructions, relevant_industries,
   relevant_agents, client_specific, active_client_id, reference_state, notes, owner)
where not exists (select 1 from public.skill_cards sc where sc.slug = v.slug);
