-- ============================================================
-- Phase 18c: Skill Card review gate (database-level activation guard)
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- Makes the review lifecycle real: a Skill Card may only become `active` when
--   1. it has a linked source (source_id is not null);
--   2. the linked source trust tier is not 'needs_review' or 'tier_4_low_trust';
--   3. it has at least one approved review (skill_card_reviews.review_status = 'approved');
--   4. last_reviewed is populated.
--
-- Enforced by a BEFORE INSERT OR UPDATE trigger, because conditions 2 and 3
-- read other tables (marketing_library_sources, skill_card_reviews) — something
-- a CHECK constraint cannot do. Direct insertion of an active card is blocked:
-- a freshly inserted card cannot yet have an approved review.
--
-- This is a backstop for the app UI, which also computes readiness before it
-- offers Activate. It never silently downgrades a card and never deletes data.
--
-- Depends on phase-18a (skill_cards, marketing_library_sources,
-- skill_card_reviews). Additive only. No production SQL is run by the app.
-- ============================================================

create or replace function public.enforce_skill_card_activation_gate()
returns trigger
language plpgsql
as $$
declare
  v_trust_tier text;
  v_approved_count integer;
begin
  -- Only guard the transition/insert into the active state. All other states
  -- (draft, needs_review, reviewed, deprecated) are unrestricted here.
  if new.status is distinct from 'active' then
    return new;
  end if;

  -- 1. Linked source required.
  if new.source_id is null then
    raise exception 'Skill Card activation blocked: a linked source is required.'
      using errcode = 'check_violation';
  end if;

  -- 2. Linked source must exist and carry an acceptable trust tier.
  select trust_tier into v_trust_tier
  from public.marketing_library_sources
  where id = new.source_id;

  if v_trust_tier is null then
    raise exception 'Skill Card activation blocked: the linked source could not be found.'
      using errcode = 'check_violation';
  end if;

  if v_trust_tier in ('needs_review', 'tier_4_low_trust') then
    raise exception 'Skill Card activation blocked: linked source trust tier "%" is not trusted enough.', v_trust_tier
      using errcode = 'check_violation';
  end if;

  -- 3. At least one approved review. On direct INSERT no reviews can reference
  --    the new id yet, so an active insert is always rejected here.
  select count(*) into v_approved_count
  from public.skill_card_reviews
  where skill_card_id = new.id
    and review_status = 'approved';

  if v_approved_count = 0 then
    raise exception 'Skill Card activation blocked: at least one approved review is required.'
      using errcode = 'check_violation';
  end if;

  -- 4. last_reviewed must be populated.
  if new.last_reviewed is null then
    raise exception 'Skill Card activation blocked: last_reviewed must be set.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.enforce_skill_card_activation_gate() is
  'Blocks a Skill Card from becoming active unless it has a linked, adequately trusted source, an approved review and a last_reviewed date.';

drop trigger if exists trg_skill_cards_activation_gate on public.skill_cards;
create trigger trg_skill_cards_activation_gate
  before insert or update on public.skill_cards
  for each row execute function public.enforce_skill_card_activation_gate();

-- ── Verification (run manually after applying) ───────────────────────────────
-- These should all RAISE (be rejected):
--   insert into public.skill_cards (slug, title, category, status, knowledge_layer,
--     source_type, principle, summary)
--   values ('gate-test', 'Gate test', 'Test', 'active', 'universal_principle',
--     'book', 'p', 's');   -- no source, no review -> blocked
--
-- A card should activate only after: source_id set to a tier_1/2/3 source,
-- one 'approved' review inserted, and last_reviewed set. Then:
--   update public.skill_cards set status = 'active' where slug = '<ready-card>';
-- succeeds.
-- ============================================================
