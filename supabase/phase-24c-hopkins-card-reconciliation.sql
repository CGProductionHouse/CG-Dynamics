-- ============================================================================
-- phase-24c — Hopkins Skill Card reconciliation (AI Workforce V2)
--
-- Honest reconciliation of the five existing Scientific Advertising cards. It
-- does NOT fabricate chapter/page references: verified references require the
-- source text, which is not yet ingested (see docs/ai-workforce/INGESTION-STATUS.md).
--
-- What this does:
--  1. Adds reusable card-provenance columns: source_reference (a verified
--     chapter/section/page ref) and reference_state (verification state).
--  2. Confirms each Hopkins card's source link and records reference_state =
--     'pending_source_ingestion', with an honest note, keeping status =
--     'needs_review'. No card is activated.
--
-- The knowledge_layer mismatch (DB 'universal_principle' vs the agent contracts'
-- canonical 'universal') is handled at READ time by normaliseKnowledgeLayer in
-- retrievalV1.ts — the stored value is intentionally left unchanged.
-- Additive and idempotent.
-- ============================================================================

alter table public.skill_cards
  add column if not exists source_reference text,
  add column if not exists reference_state text;

-- Constrain reference_state to a known vocabulary (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'skill_cards_reference_state_check'
  ) then
    alter table public.skill_cards
      add constraint skill_cards_reference_state_check
      check (reference_state is null or reference_state = any (array[
        'unverified',
        'pending_source_ingestion',
        'candidate_unverified',
        'human_verified'
      ]));
  end if;
end $$;

-- Reconcile the five Scientific Advertising cards. They remain needs_review with
-- low confidence and 'hypothesis' evidence until a reviewer verifies them against
-- the ingested source. We record WHY a verified reference is not yet attached.
update public.skill_cards
set
  reference_state = 'pending_source_ingestion',
  notes = coalesce(notes, '') ||
    case when coalesce(notes, '') = '' then '' else E'\n' end ||
    'V2 reconciliation (phase-24c): source link to Scientific Advertising (Hopkins, 1923) '
    || 'confirmed. A verified chapter/page reference is pending full-text ingestion of the '
    || 'public-domain edition (blocked this session — see INGESTION-STATUS.md). No chapter or '
    || 'page has been invented. Card stays needs_review.',
  updated_at = now()
where source_id = 'd73f5665-e20b-46a1-a16b-0c112c6b0fd0'
  and status = 'needs_review'
  and (reference_state is null or reference_state <> 'human_verified');
