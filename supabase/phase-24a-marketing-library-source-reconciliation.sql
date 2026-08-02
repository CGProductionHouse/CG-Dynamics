-- ============================================================================
-- phase-24a — Marketing Library source reconciliation (AI Workforce V2)
--
-- 1. Correct the ONE legacy source with null rights/access fields
--    (Scientific Advertising, pre-dates phase-23a). Idempotent, ID-preserving:
--    it updates in place and NEVER creates a duplicate Scientific Advertising.
-- 2. Add a source uniqueness strategy that stops duplicate editions being
--    confused while still allowing legitimate distinct editions.
--
-- Rights basis is item-level, not inferred from age alone: the LoC catalog item
-- (LCCN 23009362) plus the pre-1929 US publication date establish public domain.
-- Additive and safe to re-run.
-- ============================================================================

-- 1. Legacy source correction (ID-preserving). Match on the stable title so this
--    targets the single pre-existing record without hardcoding the UUID.
update public.marketing_library_sources
set
  canonical_url      = coalesce(canonical_url, 'https://www.loc.gov/item/23009362/'),
  source_identifier  = coalesce(source_identifier, 'LCCN 23009362'),
  edition            = coalesce(edition, 'Lord & Thomas, 1923'),
  language           = coalesce(language, 'en'),
  country            = coalesce(country, 'US'),
  rights_status      = coalesce(rights_status, 'public_domain'),
  rights_basis       = coalesce(
                         rights_basis,
                         'US work published 1923 (pre-1929) — public domain in the US. '
                         || 'Library of Congress catalog item, LCCN 23009362.'),
  commercial_use     = coalesce(commercial_use, 'yes'),
  full_text_storage  = coalesce(full_text_storage, true),
  access_mode        = coalesce(access_mode, 'full_text_allowed'),
  rights_checked_at  = coalesce(rights_checked_at, now()),
  rights_review_notes = coalesce(
                         rights_review_notes,
                         'Reconciled in phase-24a. Rights verified from LoC item + pre-1929 US '
                         || 'publication, not from age alone. Approved for full-text ingestion.'),
  ingestion_status   = coalesce(ingestion_status, 'catalogued'),
  acquisition_status = coalesce(acquisition_status, 'approved_for_ingestion'),
  trust_tier         = coalesce(trust_tier, 'tier_1_primary'),
  updated_at         = now()
where lower(title) = 'scientific advertising'
  and (rights_status is null or access_mode is null or canonical_url is null);

-- 2. Source uniqueness strategy.
--    A source is uniquely identified by (title, publication year, edition).
--    Distinct editions (different edition text) remain allowed; an accidental
--    duplicate of the same title+year+edition is rejected. Uses a normalised
--    expression index so casing/whitespace cannot smuggle a duplicate through.
create unique index if not exists marketing_library_sources_title_year_edition_uidx
  on public.marketing_library_sources (
    lower(btrim(title)),
    coalesce(publication_year, -1),
    lower(btrim(coalesce(edition, '')))
  );

-- 3. Guardrail: a document may only carry a rights status/access mode consistent
--    with its parent source. Enforced at ingestion time in code; recorded here as
--    the documented contract (no destructive constraint added to avoid breaking
--    manually-entered rows).
comment on column public.marketing_library_documents.rights_status is
  'Must equal the parent source rights_status at ingestion time (enforced in ingestion pipeline).';
comment on column public.marketing_library_documents.access_mode is
  'Must equal the parent source access_mode at ingestion time (enforced in ingestion pipeline).';
