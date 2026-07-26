-- ============================================================================
-- phase-26a — Skill Card governance fields (AI Marketing Research implementation)
--
-- Makes the readiness "source detail" model first-class on skill_cards so staff
-- and reviewers can see, per candidate:
--   * safe_claim         — what the AI MAY safely say from this evidence
--   * prohibited_overclaim — what the AI must NEVER claim
--   * jurisdiction       — territory / platform scope the finding applies to
--   * review_expires_at  — freshness: when this must be re-verified
--
-- Additive and idempotent. No knowledge is activated here. Production retrieval
-- still gates on status = 'active' (unchanged); these fields are governance +
-- review-UI metadata. The prohibited-overclaim is ALSO encoded inline in each
-- card's summary so the existing assistant retrieval conveys the boundary
-- without any edge-function change.
-- ============================================================================

alter table public.skill_cards
  add column if not exists safe_claim text,
  add column if not exists prohibited_overclaim text,
  add column if not exists jurisdiction text,
  add column if not exists review_expires_at date;

comment on column public.skill_cards.safe_claim is
  'What the AI may safely state from this evidence (readiness model).';
comment on column public.skill_cards.prohibited_overclaim is
  'What the AI must never claim from this evidence. Also encoded inline in summary so retrieval conveys it.';
comment on column public.skill_cards.jurisdiction is
  'Territory / platform scope the finding applies to (e.g. "ZA; platform international").';
comment on column public.skill_cards.review_expires_at is
  'Freshness: date by which this card must be re-verified against its source.';
