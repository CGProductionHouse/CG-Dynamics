-- Content Guideline multi-month coverage (phase-19g)
--
-- One Content Guideline belongs to one Content Run (one shoot session).
-- The guideline may cover many future months: each video carries its own
-- target month and optional Client Schedule link.
--
-- Run this in the Supabase SQL editor before deploying the UI.
-- Reversal:
--   alter table public.content_guidelines
--     drop constraint if exists content_guidelines_coverage_check;
--   alter table public.content_guidelines
--     drop column if exists coverage_start,
--     drop column if exists coverage_end;
--   drop function if exists public.update_content_guideline_coverage;

alter table public.content_guidelines
  add column if not exists coverage_start date,
  add column if not exists coverage_end  date;

comment on column public.content_guidelines.coverage_start is
  'First month the shoot plans content for (e.g. 2026-08-01).';
comment on column public.content_guidelines.coverage_end is
  'Last month the shoot plans content for (e.g. 2027-01-01).';
comment on column public.content_guidelines.month is
  'Legacy single-month field. New guidelines should use coverage_start / coverage_end.';

-- Enforce valid date range: end must not be before start.
do $$ begin
  alter table public.content_guidelines
    add constraint content_guidelines_coverage_check
      check (coverage_end >= coverage_start);
exception
  when duplicate_object then null;
end $$;

-- Backfill: for existing guidelines with a month set, derive coverage window.
-- Idempotent: only touches rows where coverage_start is still null.
update public.content_guidelines
  set coverage_start = month, coverage_end = month
  where coverage_start is null and month is not null;

-- Each video already has a month (date) column on content_guide_ideas.
-- The month column is per-video, not per-guideline. The add-guideline-video
-- function must stop defaulting month from the guideline.
--
-- No schema change needed on content_guide_ideas — the month column already
-- exists and is independent. The UI will now expose it.

drop function if exists public.update_content_guideline_coverage;

create or replace function public.update_content_guideline_coverage(
  p_guideline_id uuid,
  p_coverage_start date,
  p_coverage_end   date
) returns public.content_guidelines as $$
  update public.content_guidelines
    set coverage_start = p_coverage_start,
        coverage_end   = p_coverage_end,
        updated_at     = now()
    where id = p_guideline_id
      and p_coverage_end >= p_coverage_start
    returning *;
$$ language sql;

grant execute on function public.update_content_guideline_coverage to authenticated;

-- Match existing grant pattern (select/insert/update, not all).
grant select, insert, update on table public.content_guidelines to authenticated;
