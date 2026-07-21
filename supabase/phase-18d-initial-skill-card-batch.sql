-- ============================================================
-- Phase 18d: Initial skill card batch — Scientific Advertising
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
-- Additive only. Does not overwrite cards an admin may have
-- edited (slug-based upsert). Does not insert quotes, chapters,
-- page numbers, or claim modern interpretations were Claude
-- Hopkins's exact wording.
--
-- Depends on phase-18a (marketing_library_sources, skill_cards).
-- ============================================================

-- Source: Scientific Advertising
insert into public.marketing_library_sources (
  source_type, source_name, author_or_organisation, title, publication_year,
  trust_tier, notes
)
select
  'book',
  'Scientific Advertising',
  'Claude Hopkins',
  'Scientific Advertising',
  1923,
  'tier_1_primary',
  'Primary source for the Scientific Advertising skill domain. '
  'Manual chapter/page verification is still required. '
  'These cards must not be used to claim modern platform algorithm mechanics.'
where not exists (
  select 1 from public.marketing_library_sources
  where source_name = 'Scientific Advertising'
    and author_or_organisation = 'Claude Hopkins'
);

-- Cards (all link to the source above via subquery)

insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id,
  source_type, knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents,
  principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific
)
select
  'scientific-advertising-salesmanship',
  'Advertising is salesmanship',
  'Marketing Library',
  'Scientific Advertising',
  'needs_review', null, mls.id,
  'book', 'universal_principle', 'low', 'hypothesis',
  '[]'::jsonb, '["marketing_strategist","copywriting_agent","creative_director_agent"]'::jsonb,
  'Advertising is salesmanship, not entertainment or brand theatre.',
  'The primary purpose of advertising is to sell, not to win awards or entertain. Every element must serve the sale.',
  'When advertising is treated as salesmanship, every word and image is measured against its contribution to the sale.',
  '["Write every ad as if it were a personal sales pitch.","Remove anything that does not help close the sale."]'::jsonb,
  '["A direct-mail piece that explains benefits before features follows the salesmanship structure."]'::jsonb,
  '["Do not prioritise creativity over clarity.","Do not write ads that impress peers instead of persuading buyers."]'::jsonb,
  '["Prefer clear benefit-driven copy over clever wordplay.","Treat every headline as a sales argument."]'::jsonb,
  '[]'::jsonb,
  'Hopkins core premise. Manual chapter/page verification is still required. '
  'This is a universal principle, not a platform-specific tactic.',
  false
from public.marketing_library_sources mls
where mls.source_name = 'Scientific Advertising'
  and mls.author_or_organisation = 'Claude Hopkins'
on conflict (slug) do nothing;

insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id,
  source_type, knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents,
  principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific
)
select
  'scientific-advertising-track-before-scaling',
  'Track before scaling',
  'Marketing Library',
  'Scientific Advertising',
  'needs_review', null, mls.id,
  'book', 'universal_principle', 'low', 'hypothesis',
  '[]'::jsonb, '["marketing_strategist","paid_ads_agent","client_report_agent"]'::jsonb,
  'Test every variable with split runs before spending significant budget.',
  'No campaign should scale until the key variables have been tested and measured. Track results, then scale what works.',
  'Untested campaigns waste budget on assumptions. Tracking first ensures that only proven approaches receive more investment.',
  '["Run split tests on headlines, offers, and calls to action before scaling.","Set a clear success metric before each test."]'::jsonb,
  '["A split test between two headlines on the same audience shows which one drives more conversions before the full campaign runs."]'::jsonb,
  '["Do not change multiple variables at once in a test.","Do not scale a campaign that has not been tested."]'::jsonb,
  '["Flag any recommendation that scales spend without evidence.","Propose split tests before recommending budget increases."]'::jsonb,
  '[]'::jsonb,
  'Based on Hopkins emphasis on split-run testing. Manual chapter/page verification is still required. '
  'Modern A/B testing platforms implement this principle differently.',
  false
from public.marketing_library_sources mls
where mls.source_name = 'Scientific Advertising'
  and mls.author_or_organisation = 'Claude Hopkins'
on conflict (slug) do nothing;

insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id,
  source_type, knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents,
  principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific
)
select
  'scientific-advertising-specificity',
  'Specificity over superlatives',
  'Marketing Library',
  'Scientific Advertising',
  'needs_review', null, mls.id,
  'book', 'universal_principle', 'low', 'hypothesis',
  '[]'::jsonb, '["copywriting_agent","paid_ads_agent"]'::jsonb,
  'Specific claims outperform vague superlatives in advertising.',
  'Concrete numbers, facts, and specific benefits build more trust than generic superlatives like best or greatest.',
  'Specificity gives the reader a reason to believe. Vague claims are easily dismissed.',
  '["Replace superlatives with specific facts.","Use numbers, percentages, and concrete examples."]'::jsonb,
  '["Use \"4 out of 5 dentists recommend\" instead of \"most dentists recommend\"."]'::jsonb,
  '["Do not make claims you cannot support.","Do not use vague industry jargon instead of specific benefits."]'::jsonb,
  '["Scan copy for unsupported superlatives and replace them with specific claims.","Prefer data-backed statements over opinion words."]'::jsonb,
  '[]'::jsonb,
  'A well-known Hopkins principle. Manual chapter/page verification is still required. '
  'Specificity works across all media but must be adapted to platform character limits.',
  false
from public.marketing_library_sources mls
where mls.source_name = 'Scientific Advertising'
  and mls.author_or_organisation = 'Claude Hopkins'
on conflict (slug) do nothing;

insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id,
  source_type, knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents,
  principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific
)
select
  'scientific-advertising-offers-over-claims',
  'Offers over empty claims',
  'Marketing Library',
  'Scientific Advertising',
  'needs_review', null, mls.id,
  'book', 'universal_principle', 'low', 'hypothesis',
  '[]'::jsonb, '["marketing_strategist","copywriting_agent","paid_ads_agent"]'::jsonb,
  'A concrete offer outperforms empty brand claims every time.',
  'Give the reader a clear, tangible offer rather than unsupported claims about quality or reputation.',
  'An offer gives the reader something to act on. Empty claims give them nothing.',
  '["Lead with the offer, not the brand slogan.","Make the offer specific, time-bound where appropriate, and easy to redeem."]'::jsonb,
  '["Replace \"We are the best\" with \"Free consultation book by Friday\"."]'::jsonb,
  '["Do not bury the offer beneath brand messaging.","Do not make offers you cannot fulfil."]'::jsonb,
  '["Identify the offer in every piece of copy and move it to a prominent position.","Question any ad that has no clear offer."]'::jsonb,
  '[]'::jsonb,
  'A foundational Hopkins concept. Manual chapter/page verification is still required. '
  'This is not the same as always be closing the offer itself must be genuine.',
  false
from public.marketing_library_sources mls
where mls.source_name = 'Scientific Advertising'
  and mls.author_or_organisation = 'Claude Hopkins'
on conflict (slug) do nothing;

insert into public.skill_cards (
  slug, title, category, subcategory, status, last_reviewed, source_id,
  source_type, knowledge_layer, confidence_level, evidence_label,
  relevant_industries, relevant_agents,
  principle, summary, why_it_matters,
  how_to_apply, examples, mistakes_to_avoid, agent_instructions,
  related_card_ids, notes, client_specific
)
select
  'scientific-advertising-serve-customer',
  'Serve the customer, not the award',
  'Marketing Library',
  'Scientific Advertising',
  'needs_review', null, mls.id,
  'book', 'universal_principle', 'low', 'hypothesis',
  '[]'::jsonb, '["creative_director_agent","brand_guardian","marketing_strategist"]'::jsonb,
  'Advertising should serve the customer needs, not the advertiser ego or award aspirations.',
  'The goal is to help the customer make a decision, not to impress creative directors or win industry awards.',
  'Award-chasing advertising often confuses or distracts the customer. Customer-serving advertising sells.',
  '["Measure every creative decision against customer value, not peer approval.","Prefer clarity that serves the buyer over cleverness that impresses judges."]'::jsonb,
  '["A simple, direct ad that drives sales is more effective than a complex, artistic ad that wins awards."]'::jsonb,
  '["Do not design for award juries instead of customers.","Do not sacrifice clarity for innovation."]'::jsonb,
  '["Flag any creative decision that prioritises cleverness over customer clarity.","Default to customer-serving copy over brand-ego copy."]'::jsonb,
  '[]'::jsonb,
  'A known Hopkins position on honest advertising. Manual chapter/page verification is still required. '
  'This is a strategic principle, not a prohibition on creativity.',
  false
from public.marketing_library_sources mls
where mls.source_name = 'Scientific Advertising'
  and mls.author_or_organisation = 'Claude Hopkins'
on conflict (slug) do nothing;
