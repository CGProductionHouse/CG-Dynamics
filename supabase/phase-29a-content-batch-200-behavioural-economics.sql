-- GENERATED FILE — do not edit by hand.
-- Produced by scripts/generate-content-batch-200.mjs from
-- src/lib/marketing-library/contentBatch200.ts.
--
-- #200 — Behavioural-economics concepts captured from CA's reel screenshots,
-- registered INSIDE the existing #183/#184 architecture (skill_cards +
-- marketing_library_sources). Discovery evidence only.
--
-- Safety contract:
--   * every candidate is status 'needs_review' — nothing is active/auto-approved;
--   * client_specific = false and no active_client_id — no client is guessed;
--   * sources are bibliographic pointers (rights_status 'bibliographic_only',
--     internal_notes_only, full_text_storage false) — no full text ingested;
--   * idempotent: sources use WHERE NOT EXISTS, cards use ON CONFLICT (slug);
--   * each concept still needs INDEPENDENT verification against a stronger
--     authoritative source before activation.
--
-- Deduped out (already in the library, NOT re-registered):
--   * Mere exposure effect — Covered by docs/ai-workforce/ADVERTISING-EVIDENCE-LIBRARY.md evidence records 1–2 and the registered cited sources; not re-registered.
--
-- Depends on phase-18a (skill_cards, marketing_library_sources) and phase-23a
-- (source rights columns). NOT APPLIED to production by this repository — review
-- in the Supabase SQL editor first (docs/pending-supabase-migrations.md).

-- Source: Zeigarnik, B. (1927), On finished and unfinished tasks (Über das Behalten erledigter und unerledigter Handlungen), Psychologische Forschung.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'research_paper', 'Zeigarnik, B. (1927), On finished and unfinished tasks (Über das Behalten erledigter und unerledigter Handlungen), Psychologische Forschung.', 'Bluma Zeigarnik', 'Zeigarnik, B. (1927), On finished and unfinished tasks (Über das Behalten erledigter und unerledigter Handlungen), Psychologische Forschung.', 1927, 'concept:zeigarnik-effect',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:zeigarnik-effect'
     or (s.source_name = 'Zeigarnik, B. (1927), On finished and unfinished tasks (Über das Behalten erledigter und unerledigter Handlungen), Psychologische Forschung.' and coalesce(s.author_or_organisation,'') = coalesce('Bluma Zeigarnik', ''))
);

-- Candidate: Zeigarnik effect — open loops hold attention
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-zeigarnik-effect', 'Zeigarnik effect — open loops hold attention', 'Behavioural economics', 'Zeigarnik effect', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:zeigarnik-effect' limit 1),
  'research_paper', 'universal_principle', 'medium', 'proven_principle',
  '[]'::jsonb, '["copywriting_agent","creative_director_agent","social_media_strategist"]'::jsonb,
  'People remember interrupted or unfinished tasks better than completed ones.', 'An unresolved "open loop" sustains attention and recall until it is closed, which is why teasers, cliffhangers and progress bars keep audiences engaged.', 'Short-form hooks and multi-step funnels can use an open loop to hold attention — but only when the payoff genuinely resolves it.',
  '["Open a reel with a question or tension the content later resolves.","Show progress toward a goal (steps left) to pull people to completion."]'::jsonb, '[]'::jsonb, '["Do not open a loop the content never closes — it reads as clickbait.","Do not treat attention held as proof of persuasion, recall or sales."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Anderson, E. T. & Simester, D. I. (2003), Effects of $9 Price Endings on Retail Sales, Quantitative Marketing and Economics.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'research_paper', 'Anderson, E. T. & Simester, D. I. (2003), Effects of $9 Price Endings on Retail Sales, Quantitative Marketing and Economics.', 'Eric T. Anderson; Duncan I. Simester', 'Anderson, E. T. & Simester, D. I. (2003), Effects of $9 Price Endings on Retail Sales, Quantitative Marketing and Economics.', 2003, 'concept:charm-pricing',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:charm-pricing'
     or (s.source_name = 'Anderson, E. T. & Simester, D. I. (2003), Effects of $9 Price Endings on Retail Sales, Quantitative Marketing and Economics.' and coalesce(s.author_or_organisation,'') = coalesce('Eric T. Anderson; Duncan I. Simester', ''))
);

-- Candidate: Charm pricing — price endings affect demand
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-charm-pricing', 'Charm pricing — price endings affect demand', 'Pricing psychology', 'Charm pricing', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:charm-pricing' limit 1),
  'research_paper', 'universal_principle', 'medium', 'market_observation',
  '[]'::jsonb, '["marketing_strategist","copywriting_agent","paid_ads_agent"]'::jsonb,
  'Prices ending in 9 (or just-below-round) can lift demand versus a rounded price.', 'Left-digit and "9-ending" effects can increase sales, but the size and direction depend on category, framing and whether price signals quality.', 'Offer and landing-page pricing should test charm pricing rather than assume it always wins, especially for premium positioning.',
  '["Test a 9-ending against a round price for the same offer before concluding.","Weigh charm pricing against premium/quality signalling for the brand."]'::jsonb, '[]'::jsonb, '["Do not present charm pricing as a guaranteed uplift in every category.","Do not use it where a rounded price better signals premium quality."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Marginal return on ad spend / diminishing returns in marketing-mix analysis (managerial economics concept — attach an authoritative reference at review).
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'professional_source', 'Marginal return on ad spend / diminishing returns in marketing-mix analysis (managerial economics concept — attach an authoritative reference at review).', null, 'Marginal return on ad spend / diminishing returns in marketing-mix analysis (managerial economics concept — attach an authoritative reference at review).', null, 'concept:marginal-roas',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:marginal-roas'
     or (s.source_name = 'Marginal return on ad spend / diminishing returns in marketing-mix analysis (managerial economics concept — attach an authoritative reference at review).' and coalesce(s.author_or_organisation,'') = coalesce(null, ''))
);

-- Candidate: Marginal ROAS — the next rand, not the average
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-marginal-roas', 'Marginal ROAS — the next rand, not the average', 'Media economics', 'Marginal ROAS', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:marginal-roas' limit 1),
  'professional_source', 'universal_principle', 'medium', 'market_observation',
  '[]'::jsonb, '["paid_ads_agent","marketing_strategist","client_report_agent"]'::jsonb,
  'Scaling decisions should use the return on the NEXT unit of spend, not the blended average ROAS.', 'Ad channels show diminishing returns, so average ROAS overstates the value of incremental budget; marginal ROAS is what matters when deciding to scale.', 'Budget-scaling recommendations that cite only average ROAS can push spend past the point where each extra rand loses money.',
  '["When advising a budget increase, reason about incremental return, not blended ROAS.","Flag diminishing returns and saturation rather than extrapolating average ROAS."]'::jsonb, '[]'::jsonb, '["Do not present average ROAS as the return on additional spend.","Do not treat a healthy blended ROAS as proof that scaling is profitable."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Festinger, L. (1957), A Theory of Cognitive Dissonance, Stanford University Press.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'book', 'Festinger, L. (1957), A Theory of Cognitive Dissonance, Stanford University Press.', 'Leon Festinger', 'Festinger, L. (1957), A Theory of Cognitive Dissonance, Stanford University Press.', 1957, 'concept:post-purchase-dissonance',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:post-purchase-dissonance'
     or (s.source_name = 'Festinger, L. (1957), A Theory of Cognitive Dissonance, Stanford University Press.' and coalesce(s.author_or_organisation,'') = coalesce('Leon Festinger', ''))
);

-- Candidate: Post-purchase dissonance — reassurance after the sale
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-post-purchase-dissonance', 'Post-purchase dissonance — reassurance after the sale', 'Behavioural economics', 'Post-purchase dissonance', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:post-purchase-dissonance' limit 1),
  'book', 'universal_principle', 'medium', 'proven_principle',
  '[]'::jsonb, '["marketing_strategist","copywriting_agent","client_report_agent"]'::jsonb,
  'Buyers experience doubt after a purchase and seek reassurance that they chose well.', 'Derived from cognitive dissonance theory: post-purchase communication (onboarding, confirmation, proof) can reduce regret, returns and churn.', 'Lifecycle and CRM messaging should reassure recent buyers, not just chase the next sale.',
  '["Add reassurance to confirmation and onboarding messages (proof, next steps, support).","Reinforce the reasons the buyer chose well shortly after purchase."]'::jsonb, '[]'::jsonb, '["Do not go silent immediately after the sale.","Do not overpromise pre-sale in ways that amplify post-purchase regret."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Contribution margin (managerial/marketing accounting concept — attach an authoritative textbook reference at review).
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'professional_source', 'Contribution margin (managerial/marketing accounting concept — attach an authoritative textbook reference at review).', null, 'Contribution margin (managerial/marketing accounting concept — attach an authoritative textbook reference at review).', null, 'concept:contribution-margin',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:contribution-margin'
     or (s.source_name = 'Contribution margin (managerial/marketing accounting concept — attach an authoritative textbook reference at review).' and coalesce(s.author_or_organisation,'') = coalesce(null, ''))
);

-- Candidate: Contribution margin — what a sale actually contributes
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-contribution-margin', 'Contribution margin — what a sale actually contributes', 'Unit economics', 'Contribution margin', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:contribution-margin' limit 1),
  'professional_source', 'universal_principle', 'medium', 'market_observation',
  '[]'::jsonb, '["marketing_strategist","client_report_agent","paid_ads_agent"]'::jsonb,
  'Contribution margin is price minus variable cost — what each sale contributes to fixed costs and profit.', 'Marketing profitability (and a defensible CAC/ROAS target) should be judged against contribution margin, not revenue, so campaigns are not called profitable when they are not.', 'Report and strategy recommendations that optimise revenue or ROAS without contribution margin can recommend unprofitable growth.',
  '["Frame acceptable acquisition cost against contribution margin, not revenue.","State when margin data is missing rather than assuming profitability."]'::jsonb, '[]'::jsonb, '["Do not equate revenue growth with profit.","Do not set a ROAS/CAC target without knowing the contribution margin."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Kahneman, D., Fredrickson, B. L., Schreiber, C. A. & Redelmeier, D. A. (1993), When More Pain Is Preferred to Less: Adding a Better End, Psychological Science.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'research_paper', 'Kahneman, D., Fredrickson, B. L., Schreiber, C. A. & Redelmeier, D. A. (1993), When More Pain Is Preferred to Less: Adding a Better End, Psychological Science.', 'Daniel Kahneman et al.', 'Kahneman, D., Fredrickson, B. L., Schreiber, C. A. & Redelmeier, D. A. (1993), When More Pain Is Preferred to Less: Adding a Better End, Psychological Science.', 1993, 'concept:peak-end-rule',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:peak-end-rule'
     or (s.source_name = 'Kahneman, D., Fredrickson, B. L., Schreiber, C. A. & Redelmeier, D. A. (1993), When More Pain Is Preferred to Less: Adding a Better End, Psychological Science.' and coalesce(s.author_or_organisation,'') = coalesce('Daniel Kahneman et al.', ''))
);

-- Candidate: Peak-end rule — people judge experiences by peak and end
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-peak-end-rule', 'Peak-end rule — people judge experiences by peak and end', 'Behavioural economics', 'Peak-end rule', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:peak-end-rule' limit 1),
  'research_paper', 'universal_principle', 'medium', 'proven_principle',
  '[]'::jsonb, '["creative_director_agent","copywriting_agent","social_media_strategist"]'::jsonb,
  'People remember an experience largely by its most intense moment and its ending, not its average.', 'Designing a strong peak and a strong finish (to a video, an event or an onboarding flow) shapes how the whole experience is remembered.', 'Content and customer-journey design should engineer a deliberate peak and ending rather than spreading effort evenly.',
  '["Give short-form content a clear peak moment and a deliberate ending.","Design the end of onboarding/events to leave a strong final impression."]'::jsonb, '[]'::jsonb, '["Do not let content trail off at the end.","Do not assume a good average experience is remembered as good."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Iyengar, S. S. & Lepper, M. R. (2000), When Choice is Demotivating: Can One Desire Too Much of a Good Thing?, Journal of Personality and Social Psychology.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'research_paper', 'Iyengar, S. S. & Lepper, M. R. (2000), When Choice is Demotivating: Can One Desire Too Much of a Good Thing?, Journal of Personality and Social Psychology.', 'Sheena S. Iyengar; Mark R. Lepper', 'Iyengar, S. S. & Lepper, M. R. (2000), When Choice is Demotivating: Can One Desire Too Much of a Good Thing?, Journal of Personality and Social Psychology.', 2000, 'concept:choice-overload',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:choice-overload'
     or (s.source_name = 'Iyengar, S. S. & Lepper, M. R. (2000), When Choice is Demotivating: Can One Desire Too Much of a Good Thing?, Journal of Personality and Social Psychology.' and coalesce(s.author_or_organisation,'') = coalesce('Sheena S. Iyengar; Mark R. Lepper', ''))
);

-- Candidate: Choice overload — too many options can reduce action
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-choice-overload', 'Choice overload — too many options can reduce action', 'Behavioural economics', 'Choice overload / paralysis', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:choice-overload' limit 1),
  'research_paper', 'universal_principle', 'medium', 'market_observation',
  '[]'::jsonb, '["marketing_strategist","copywriting_agent","paid_ads_agent"]'::jsonb,
  'Adding options can reduce the likelihood of any choice being made, under some conditions.', 'Choice overload is real but context-dependent (the effect varies with expertise, preference clarity and how options are presented), so simplification should be tested, not assumed.', 'Offer sets, menus and landing-page CTAs may convert better when simplified — but the effect is conditional.',
  '["Reduce or structure options where audiences show hesitation.","Test a simplified option set rather than assuming fewer always wins."]'::jsonb, '[]'::jsonb, '["Do not state that fewer options always increase conversion.","Do not remove genuinely valued choice in the name of simplicity."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;

-- Source: Kahneman, D. & Tversky, A. (1979), Prospect Theory: An Analysis of Decision under Risk, Econometrica.
insert into public.marketing_library_sources
  (source_type, source_name, author_or_organisation, title, publication_year, source_identifier,
   trust_tier, rights_status, access_mode, full_text_storage, commercial_use, ingestion_status, notes)
select 'research_paper', 'Kahneman, D. & Tversky, A. (1979), Prospect Theory: An Analysis of Decision under Risk, Econometrica.', 'Daniel Kahneman; Amos Tversky', 'Kahneman, D. & Tversky, A. (1979), Prospect Theory: An Analysis of Decision under Risk, Econometrica.', 1979, 'concept:loss-aversion',
       'needs_review', 'bibliographic_only', 'internal_notes_only', false, 'unknown', 'catalogued',
       'Content batch #200 (CA reel, discovery evidence only). Bibliographic pointer — verify the exact canonical source and rights before ingestion/activation.'
where not exists (
  select 1 from public.marketing_library_sources s
  where s.source_identifier = 'concept:loss-aversion'
     or (s.source_name = 'Kahneman, D. & Tversky, A. (1979), Prospect Theory: An Analysis of Decision under Risk, Econometrica.' and coalesce(s.author_or_organisation,'') = coalesce('Daniel Kahneman; Amos Tversky', ''))
);

-- Candidate: Loss aversion — losses loom larger than gains
insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label, relevant_industries, relevant_agents,
  principle, summary, why_it_matters, how_to_apply, examples, mistakes_to_avoid,
  agent_instructions, related_card_ids, notes, client_specific
)
select 'be-loss-aversion', 'Loss aversion — losses loom larger than gains', 'Behavioural economics', 'Loss aversion', 'needs_review', null,
  (select id from public.marketing_library_sources where source_identifier = 'concept:loss-aversion' limit 1),
  'research_paper', 'universal_principle', 'medium', 'proven_principle',
  '[]'::jsonb, '["copywriting_agent","marketing_strategist","paid_ads_agent"]'::jsonb,
  'People weigh potential losses more heavily than equivalent gains.', 'From prospect theory: framing an offer around what is lost by inaction can be more motivating than the equivalent gain — used honestly, without manufactured fear.', 'Copy and offer framing can ethically use loss framing, but must avoid manipulation or false scarcity.',
  '["Where truthful, frame the cost of inaction alongside the benefit of acting.","Use genuine deadlines/limits, never fabricated scarcity."]'::jsonb, '[]'::jsonb, '["Do not manufacture fake scarcity or fear.","Do not rely on loss framing where it misrepresents the offer."]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  'Content batch #200 (CA reel, discovery evidence only). Needs independent verification against a stronger authoritative source before activation.',
  false
on conflict (slug) do nothing;
