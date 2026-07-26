-- ============================================================================
-- phase-25e — Historical human-created campaign references (social master)
--
-- A small, honest seed of widely-documented pre-generative-AI campaigns as
-- RESEARCH references (review_status = 'needs_review'). Only publicly-established
-- facts are recorded; every "why it worked" is labelled interpretation. No
-- restricted creative is mirrored — canonical_url points to the brand's own
-- public context / official ad library, not a copied asset. Specific ad-library
-- captures (Meta/TikTok/LinkedIn transparency tools) require reviewer work in a
-- browser and are intentionally NOT fabricated here.
--
-- Idempotent by headline. Additive.
-- ============================================================================

insert into public.marketing_library_historical_ads
  (headline, product_or_offer, medium, period, publication_title, publication_date,
   location, canonical_url, dominant_appeal, proof_device, cta, audience,
   rights_status, access_mode, candidate_principles, interpretation_notes, review_status)
select v.headline, v.product_or_offer, v.medium, v.period, v.publication_title, v.publication_date,
   v.location, v.canonical_url, v.dominant_appeal, v.proof_device, v.cta, v.audience,
   'official_reference', 'metadata_and_link_only', v.candidate_principles::jsonb, v.interpretation_notes, 'needs_review'
from (values
  ('Dumb Ways to Die', 'Rail-safety public awareness', 'Online video / music / social', 'c.2012',
   'Metro Trains Melbourne campaign', '2012', 'Australia', 'https://www.metrotrains.com.au/',
   'Humour + catchy music to make a safety message shareable', 'Virality / cultural spread',
   'Be safe around trains', 'General public, younger skew',
   '["Entertainment can carry a serious message","Memorability and shareability beat lecturing"]',
   'INTERPRETATION (needs verification): widely cited as effective because entertainment lowered resistance to a safety message. Verify specifics and metrics before use.'),
  ('The Man Your Man Could Smell Like', 'Old Spice body wash', 'TV + online video / social', 'c.2010',
   'Old Spice / Procter & Gamble campaign', '2010', 'United States', 'https://www.oldspice.com/',
   'Humour, absurdity and fast pacing', 'Cultural virality and response videos',
   'Consider the brand for men (bought by women)', 'Women buying for men; men',
   '["Know who actually buys","Humour + a clear reframe of the buyer can shift a category"]',
   'INTERPRETATION (needs verification): often credited with re-targeting the real purchaser. Confirm claims and results before relying on them.'),
  ('Real Beauty Sketches', 'Dove personal care', 'Online video / social', 'c.2013',
   'Dove / Unilever campaign', '2013', 'Global', 'https://www.dove.com/',
   'Emotional self-perception insight', 'Demonstration (forensic-artist device)',
   'Rethink how you see yourself', 'Women',
   '["A strong emotional insight travels","Demonstration beats assertion"]',
   'INTERPRETATION (needs verification): widely discussed for an emotional insight and a demonstration device. Verify facts, rights and outcomes before use.')
) as v(headline, product_or_offer, medium, period, publication_title, publication_date,
   location, canonical_url, dominant_appeal, proof_device, cta, audience,
   candidate_principles, interpretation_notes)
where not exists (
  select 1 from public.marketing_library_historical_ads h where h.headline = v.headline
);
