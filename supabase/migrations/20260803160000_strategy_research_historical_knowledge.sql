-- Strategy, Research Librarian, and Historical Advertising candidate knowledge.
--
-- Sources were inspected directly in machine-readable form on 2026-08-03.
-- This migration stores source metadata and review-ready derived cards only.
-- It does not store restricted full text, activate cards, or add client claims.
-- Additive and idempotent by source edition + card slug.

insert into public.marketing_library_sources (
  source_type, source_name, author_or_organisation, title, publication_year,
  chapter_or_section, page_or_url, notes, trust_tier,
  canonical_url, edition, language, country, source_identifier,
  rights_status, rights_basis, commercial_use, full_text_storage, access_mode,
  rights_checked_at, rights_review_notes, ingestion_status, acquisition_status
)
select * from (values
  (
    'official_documentation', 'GCS OASIS Campaign Planning', 'UK Government Communications',
    'OASIS: Planning government communications', 2020,
    'Objectives; Audience and insights; Strategy and ideas; Implementation; Scoring and evaluation',
    'https://www.communications.gov.uk/publication/guide-to-campaign-planning-oasis/',
    'Current HTML inspected directly on 2026-08-03. Cards paraphrase narrow planning guidance and retain UK-government context.',
    'tier_1_primary', 'https://www.communications.gov.uk/publication/guide-to-campaign-planning-oasis/',
    'Live HTML verified 2026-08-03', 'en', 'GB', 'GCS-OASIS-2020',
    'official_reference', 'Official UK Government Communications publication. Link/reference use only in this pass; no page text is mirrored.',
    'unknown', false, 'metadata_and_link_only', now(),
    'Machine-readable HTML inspected directly. Re-check current Crown copyright/OGL terms before any full-text storage or commercial reuse.',
    'verified', 'reviewed'
  ),
  (
    'official_documentation', 'GCS Evaluation Cycle', 'UK Government Communications',
    'Evaluate and learn: The Evaluation Cycle', 2024,
    'Inputs - Communication planning; Linking the Evaluation Cycle and OASIS',
    'https://www.communications.gov.uk/publication/gcs-evaluation-cycle/',
    'Current HTML inspected directly on 2026-08-03. Supports evaluation planning and learning-loop boundaries only.',
    'tier_1_primary', 'https://www.communications.gov.uk/publication/gcs-evaluation-cycle/',
    'Live HTML verified 2026-08-03', 'en', 'GB', 'GCS-EVALUATION-CYCLE-2024',
    'official_reference', 'Official UK Government Communications publication. Link/reference use only in this pass; no page text is mirrored.',
    'unknown', false, 'metadata_and_link_only', now(),
    'Machine-readable HTML inspected directly. Re-check current Crown copyright/OGL terms before any full-text storage or commercial reuse.',
    'verified', 'reviewed'
  ),
  (
    'professional_source', 'OpenStax Principles of Marketing', 'OpenStax / Rice University',
    'Principles of Marketing', 2022,
    '5.1 Market Segmentation and Consumer Markets; 5.6 Product Positioning; 13.4 Steps in the IMC Planning Process',
    'https://openstax.org/books/principles-marketing/pages/preface',
    'Machine-readable HTML sections inspected directly on 2026-08-03. Derived cards use short paraphrases, not copied textbook expression.',
    'tier_2_trusted_professional', 'https://openstax.org/books/principles-marketing/pages/preface',
    'Web edition verified 2026-08-03', 'en', 'US', 'OPENSTAX-PRINCIPLES-MARKETING',
    'research_only', 'OpenStax states CC BY-NC-SA 4.0. CG stores metadata and derived review notes only; no full text or figures are ingested.',
    'restricted', false, 'metadata_and_link_only', now(),
    'Attribution and non-commercial/share-alike limits preserved. Do not reproduce the text or artwork commercially without separate permission.',
    'verified', 'reviewed'
  ),
  (
    'internal_campaign_data', 'CG Research and Source Quality Standard', 'CG Production House',
    'CG Dynamics Research and Source Quality Standard', 2026,
    'Minimum evidence record; Books and foundational works; Research workflow; Prohibited practices',
    'docs/research-source-quality-standard.md',
    'Internal governance source. It defines how evidence is classified and when a specialist must refuse.',
    'tier_3_internal_learning', null,
    'Repository standard at main, verified 2026-08-03', 'en', 'ZA', 'CG-RESEARCH-STANDARD',
    'user_owned', 'Internal CG Production House governance document.',
    'allowed', false, 'internal_notes_only', now(),
    'Internal-only. It governs process and does not establish external market facts.',
    'verified', 'reviewed'
  )
) as v(
  source_type, source_name, author_or_organisation, title, publication_year,
  chapter_or_section, page_or_url, notes, trust_tier,
  canonical_url, edition, language, country, source_identifier,
  rights_status, rights_basis, commercial_use, full_text_storage, access_mode,
  rights_checked_at, rights_review_notes, ingestion_status, acquisition_status
)
where not exists (
  select 1 from public.marketing_library_sources s
  where lower(btrim(s.title)) = lower(btrim(v.title))
    and coalesce(s.publication_year, -1) = coalesce(v.publication_year, -1)
    and lower(btrim(coalesce(s.edition, ''))) = lower(btrim(coalesce(v.edition, '')))
);

-- Candidate cards. Every row remains needs_review and requires the existing
-- Skill Card Review + activation gate before production retrieval.
insert into public.skill_cards (
  slug, title, category, subcategory, status, source_id, source_type,
  knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents, principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific, source_reference, reference_state,
  safe_claim, prohibited_overclaim, jurisdiction, review_expires_at, owner
)
select
  v.slug, v.title, v.category, v.subcategory, 'needs_review', s.id, v.source_type,
  'universal_principle', v.confidence, v.evidence_label,
  '[]'::jsonb, v.agents::jsonb, v.principle, v.summary, v.why_it_matters,
  v.how_to_apply::jsonb, '[]'::jsonb, v.mistakes::jsonb, v.instructions::jsonb,
  '[]'::jsonb, v.notes, false, v.source_reference, v.reference_state,
  v.safe_claim, v.prohibited_overclaim, v.jurisdiction, v.review_expires_at, 'CG AI Workforce research'
from (values
  (
    'strategy-audience-segments-evidence-not-stereotypes', 'Segment audiences from evidence, not stereotypes',
    'Strategy Foundations', 'Audience segmentation', 'professional_source', 'medium', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'Define audience groups through shared needs, behaviours or expected response, then validate that the segment is reachable and useful.',
    'OpenStax defines segmentation as dividing a target market into more precise groups with common needs and expected responses. This supports a working segmentation hypothesis, not a claim that demographics determine behaviour. Prohibited overclaim: never infer an individual''s needs, identity or intent from a segment label alone.',
    'Evidence-based groups make audience choices reviewable and reduce generic one-message-for-everyone planning.',
    '["Record the evidence for each segment.","Describe the shared need or behaviour.","State what remains assumed and must be tested."]',
    '["Using demographic labels as personality claims.","Inventing audience size or intent."]',
    '["Label source facts, planning interpretation and untested assumptions separately.","Do not turn a segment into a stereotype."]',
    'OpenStax Principles of Marketing, section 5.1, Market Segmentation Defined and The Advantages of Market Segmentation',
    'human_verified',
    'A campaign may segment a market into groups sharing needs or expected responses when the grouping is supported by evidence.',
    'A segment label does not prove any individual''s behaviour, preference, identity or purchase intent.',
    'General marketing concept; local privacy, equality and advertising law still applies.', date '2028-08-03',
    'Direct HTML section inspected 2026-08-03; card wording is a narrow paraphrase.'
  ),
  (
    'strategy-positioning-target-value-difference-proof', 'Positioning connects target, value, difference and proof',
    'Strategy Foundations', 'Positioning', 'professional_source', 'medium', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'A positioning statement should identify the target audience, the value offered, a relevant difference, and the reason the audience should believe it.',
    'OpenStax describes positioning as deciding and communicating how the market should think and feel about an offering, and its statement templates connect target, benefit, differentiation and evidence. Prohibited overclaim: a desired position is not proof that customers already perceive the brand that way.',
    'It gives creative, offer and channel decisions one consistent strategic reference point.',
    '["Draft one target-specific positioning statement.","Separate desired perception from measured perception.","List the proof still required."]',
    '["Treating a slogan as positioning.","Claiming differentiation without evidence."]',
    '["Mark desired position as strategy and current market perception as unknown unless researched."]',
    'OpenStax Principles of Marketing, section 5.6, Product Positioning Defined and Positioning Statements',
    'human_verified',
    'A positioning statement can connect a defined audience, relevant benefit, differentiation and supporting evidence.',
    'Do not claim customers hold the intended perception without research, or that a difference is unique without substantiation.',
    'General marketing concept; comparative claims require applicable local substantiation.', date '2028-08-03',
    'Direct HTML section inspected 2026-08-03; no third-party positioning quote is copied.'
  ),
  (
    'strategy-offer-message-value-action', 'Design the offer around value and a desired action',
    'Strategy Foundations', 'Offer design', 'professional_source', 'medium', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'Connect the target audience''s relevant value to one clear desired action, with real terms and evidence.',
    'OpenStax''s IMC planning sequence links objectives, audience, message, features and benefits, call to action, positioning and channel. This supports designing a coherent offer/message, not a guarantee that any offer will convert. Prohibited overclaim: never invent price, availability, urgency, terms or proof.',
    'An offer is operational only when the audience value, action and fulfilment conditions are explicit.',
    '["State the audience value.","State the desired action.","List terms, exclusions and proof that require client confirmation."]',
    '["Inventing scarcity or deadlines.","Confusing a creative hook with a verified offer."]',
    '["Keep unconfirmed offer details as questions, not draft facts."]',
    'OpenStax Principles of Marketing, section 13.4, Design the Message; Create the Message Content; Designing the Promotion',
    'human_verified',
    'Offer/message planning can connect relevant customer value, the desired response, positioning and delivery channel.',
    'No source here proves a particular offer will convert or permits fabricated price, urgency, availability or terms.',
    'General marketing concept; offer claims and terms require client approval and applicable ZA law review.', date '2028-08-03',
    'Direct HTML section inspected 2026-08-03; commercial examples were not copied into the card.'
  ),
  (
    'strategy-objective-before-tactics', 'Set a measurable outcome before tactics',
    'Strategy Foundations', 'Campaign objectives', 'official_documentation', 'high', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'Define the campaign outcome and the role communications can play before choosing content, channels or tactics.',
    'The current GCS OASIS guide starts with outcome-focused objectives and requires individual activities and channels to contribute to them. This is UK government communications guidance that can inform planning structure. Prohibited overclaim: it is not proof that communications alone can overcome product, access, price or operational barriers.',
    'It prevents activity volume from being mistaken for campaign success.',
    '["Write one specific measurable outcome.","Define communications'' contribution.","Separate output metrics from behaviour or business outcomes."]',
    '["Starting with a platform or post count.","Claiming communications caused an outcome without evidence."]',
    '["Refuse to recommend tactics until the objective and measurement basis are clear."]',
    'GCS OASIS live HTML, Objectives and Making objectives SMART',
    'human_verified',
    'Campaign planning should start with an outcome-focused, measurable objective and define the contribution of communications.',
    'Do not claim communications alone can solve non-communication barriers or that outputs prove business impact.',
    'UK government communications guidance; transferable planning structure, not ZA law or a universal causal rule.', date '2027-08-03',
    'Direct official HTML inspected 2026-08-03. Current wording should be rechecked by expiry.'
  ),
  (
    'strategy-channel-role-by-audience-objective', 'Give each channel a defined role',
    'Strategy Foundations', 'Channel-role planning', 'official_documentation', 'high', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'Select channels from audience access, trust, behaviour and the campaign objective, then state the distinct job each channel performs.',
    'GCS OASIS says channel choice should reflect where audiences are, who they trust and what drives behaviour, using paid, earned and owned options. Prohibited overclaim: being present on a channel does not prove reach, trust, suitability or results.',
    'A role-based channel plan reduces duplicated activity and clarifies what success means for each channel.',
    '["Name the audience and journey stage.","Assign one primary role per channel.","Define a channel-level signal tied to the overall objective."]',
    '["Choosing channels from habit alone.","Treating all channels as interchangeable distribution."]',
    '["State missing audience-access evidence and recommend a test rather than asserting channel fit."]',
    'GCS OASIS live HTML, Strategy and ideas: Channels; Objectives',
    'human_verified',
    'Channel selection can be based on audience access, trust, behavioural context and its contribution to the objective.',
    'Do not claim channel presence guarantees reach, trust, behaviour change or commercial results.',
    'UK government communications guidance; platform mechanics require separate current official evidence.', date '2027-08-03',
    'Direct official HTML inspected 2026-08-03. No current social-platform rule is inferred.'
  ),
  (
    'strategy-measure-learn-adapt-loop', 'Plan measurement and learning before launch',
    'Strategy Foundations', 'Measurement and learning', 'official_documentation', 'high', 'proven_principle',
    '["marketing_strategist","research_librarian"]',
    'Define evaluation at planning time, monitor outputs, audience response and outcomes, and feed verified learning into the next decision.',
    'The GCS Evaluation Cycle connects communication planning, objectives, KPIs, audience segmentation, testing and a feedback loop into future planning. Prohibited overclaim: reach or engagement alone does not establish behaviour change, business impact or causation.',
    'A learning loop makes uncertainty explicit and turns results into the next test instead of retrospective storytelling.',
    '["Define outcome and leading indicators before launch.","Record what changed and when.","Separate output, outtake and outcome.","State what the evidence cannot explain."]',
    '["Selecting metrics after seeing results.","Attributing causation from correlation.","Treating missing data as zero."]',
    '["Present findings, interpretation, limitations and next test as separate fields."]',
    'GCS Evaluation Cycle live HTML, Inputs - Communication planning; Linking the Evaluation Cycle and OASIS',
    'human_verified',
    'Evaluation should be designed with the campaign, monitored during delivery, and used to inform future planning.',
    'Outputs such as reach or engagement do not by themselves prove attitude change, behaviour change, revenue impact or causation.',
    'UK government communications guidance; metrics must use the relevant platform/business definitions and verified data.', date '2027-08-03',
    'Both official HTML sources were inspected directly on 2026-08-03.'
  ),
  (
    'librarian-evidence-brief-classification', 'Evidence briefs separate fact, interpretation, observation and uncertainty',
    'Research Governance', 'Evidence brief', 'internal_campaign_data', 'high', 'internal_learning',
    '["research_librarian"]',
    'A Research Librarian brief must classify source fact, specialist interpretation, internal observation and uncertainty instead of blending them.',
    'The CG source quality standard requires identifiable evidence, claim-to-source fit, limitations, confidence and evidence labels. This is an internal operating rule, not an external market fact.',
    'Downstream specialists can see what is supported, what is reasoned and what still needs evidence.',
    '["Answer the exact research question.","Cite each source fact.","Place interpretation and internal observation in separate sections.","List contradictions and missing evidence."]',
    '["Presenting a model synthesis as a source fact.","Omitting uncertainty because the answer sounds plausible."]',
    '["Never write campaign strategy or final client copy.","Return a structured evidence brief for another specialist only."]',
    'CG Dynamics Research and Source Quality Standard, Minimum evidence record and Claim-to-source matching',
    'human_verified',
    'CG research briefs must separate cited source facts from interpretation, internal observation and uncertainty.',
    'Do not present internal process rules as external facts or use a model summary as evidence.',
    'CG Production House internal governance; all external claims retain their own jurisdiction.', date '2027-08-03',
    'Internal governance candidate. Human review still required before activation.'
  ),
  (
    'librarian-refuse-insufficient-approved-evidence', 'Refuse when approved evidence is insufficient',
    'Research Governance', 'Evidence sufficiency', 'internal_campaign_data', 'high', 'internal_learning',
    '["research_librarian"]',
    'If approved sources do not support the question, return the evidence gap and stop rather than filling it with generic knowledge.',
    'The CG source quality standard prohibits creating reusable knowledge from model memory, unsourced summaries or unchecked sources. This is an internal operating rule.',
    'A useful refusal protects every specialist downstream from confident but unsupported work.',
    '["State which approved sources were checked.","State the unsupported claim or missing evidence type.","Suggest a lawful source-acquisition next step."]',
    '["Answering from model memory.","Using needs-review cards as production truth.","Creating strategy to hide a research gap."]',
    '["Return refusal plus evidence gap; do not create campaign strategy or final client copy."]',
    'CG Dynamics Research and Source Quality Standard, Non-negotiable rule; Research workflow; Prohibited practices',
    'human_verified',
    'The Research Librarian must refuse a factual brief when approved evidence is insufficient and identify the gap.',
    'Do not substitute model memory, generic blogs, needs-review cards or uncited inference for approved evidence.',
    'CG Production House internal governance.', date '2027-08-03',
    'Internal governance candidate. Production retrieval remains status=active only.'
  ),
  (
    'historical-original-claim-modern-interpretation-boundary', 'Separate historical claims from modern interpretation',
    'Historical Advertising', 'Source handling', 'internal_campaign_data', 'high', 'internal_learning',
    '["historical_advertising_analyst","research_librarian"]',
    'Historical analysis must quote or paraphrase the original source with a verifiable location, then separately label modern interpretation, outdated assumptions and applicability limits.',
    'The CG source quality standard says foundational works can support historical context but cannot prove current platform rules, legal requirements, technical limits or guaranteed performance.',
    'It prevents an old advertising example from silently becoming current operational advice.',
    '["Record title, author, year and exact chapter/section.","Label the original-source claim.","Add modern interpretation separately.","Flag period assumptions and current evidence still required."]',
    '["Calling a historical opinion timeless without corroboration.","Using an old example as a current platform tactic."]',
    '["Refuse when source location cannot be verified.","Never present historical principles as current platform rules."]',
    'CG Dynamics Research and Source Quality Standard, Books and foundational works',
    'human_verified',
    'Historical sources may be analysed as historical context when original claims and source locations are separated from modern interpretation.',
    'Do not present a historical claim as a current platform rule, legal requirement, technical limit, universal behaviour law or guaranteed result.',
    'Historical context only; current applicability depends on separate current evidence and jurisdiction.', date '2027-08-03',
    'Internal governance candidate routed only to the Historical Analyst and Research Librarian.'
  ),
  (
    'historical-hopkins-test-campaigns-context', 'Hopkins test campaigns are historical context, not a platform rule',
    'Historical Advertising', 'Scientific Advertising', 'book', 'low', 'hypothesis',
    '["historical_advertising_analyst","research_librarian"]',
    'Study Hopkins'' discussion of test campaigns as evidence of an early direct-advertising testing practice, then verify any modern application independently.',
    'Scientific Advertising (1923) includes a chapter titled Test Campaigns. The chapter can be analysed as primary historical context after human review. Prohibited overclaim: its existence does not prove modern experimental validity, platform implementation, universal lift or current best practice.',
    'It gives the Historical Analyst a narrow original-source task without activating the rejected salesmanship card or converting a 1923 practice into a current rule.',
    '["Inspect the original chapter.","Cite the chapter and edition.","Separate the author''s claim from modern experimental interpretation.","List assumptions that no longer hold."]',
    '["Reactivating Advertising is salesmanship unchanged.","Inventing page numbers.","Calling 1923 mail-order practice a current A/B testing standard."]',
    '["Use only as historical context until a human verifies the chapter text.","Require separate current evidence for any recommendation."]',
    'Scientific Advertising (Hopkins, 1923), Chapter 15: Test Campaigns; Library of Congress item 23009362. No page asserted.',
    'candidate_unverified',
    'The 1923 book contains a chapter titled Test Campaigns and may be studied as primary historical advertising context.',
    'Do not claim the chapter establishes current platform rules, modern experimental validity, guaranteed uplift or universal best practice.',
    'US advertising history, 1923; modern applicability unverified.', date '2027-08-03',
    'Public-domain source record already exists. This new candidate does not modify or activate scientific-advertising-salesmanship.'
  )
) as v(
  slug, title, category, subcategory, source_type, confidence, evidence_label,
  agents, principle, summary, why_it_matters, how_to_apply, mistakes, instructions,
  source_reference, reference_state, safe_claim, prohibited_overclaim,
  jurisdiction, review_expires_at, notes
)
join lateral (
  select source.id
  from public.marketing_library_sources source
  where
    (v.source_type = 'professional_source' and source.source_identifier = 'OPENSTAX-PRINCIPLES-MARKETING')
    or (v.source_type = 'official_documentation' and (
      (v.slug = 'strategy-measure-learn-adapt-loop' and source.source_identifier = 'GCS-EVALUATION-CYCLE-2024')
      or (v.slug <> 'strategy-measure-learn-adapt-loop' and source.source_identifier = 'GCS-OASIS-2020')
    ))
    or (v.source_type = 'internal_campaign_data' and source.source_identifier = 'CG-RESEARCH-STANDARD')
    or (v.source_type = 'book' and lower(source.title) = 'scientific advertising')
  order by
    (source.source_identifier = 'LCCN 23009362') desc,
    source.created_at asc,
    source.id asc
  limit 1
) s on true
on conflict (slug) do nothing;

-- The rejected scientific-advertising-salesmanship row is intentionally not updated by this pack.

notify pgrst, 'reload schema';
