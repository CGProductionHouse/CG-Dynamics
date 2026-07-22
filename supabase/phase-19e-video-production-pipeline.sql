-- ============================================================
-- Phase 19e: Video production pipeline
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- Additive extension of phase-19d. The existing content_guide_ideas row becomes
-- the canonical tracked VIDEO item: it links to one existing monthly_deliverable
-- and tracks its own production lifecycle (shoot -> edit -> internal -> client).
-- It does NOT duplicate monthly_deliverables scheduling/posting statuses — after
-- client_approved, the Client Schedule item remains responsible for Scheduled
-- and Posted.
--
-- No new main video table. No seed data. No OneDrive credentials. RLS is
-- unchanged (phase-19d staff-only policies still apply; clients keep zero
-- access). Safe to run after phase-19d; idempotent where practical.
--
-- Depends on: phase-19d (content_guide_ideas), public.profiles.
-- ============================================================

-- ── 1. Additive columns on content_guide_ideas ──────────────────────────────
alter table public.content_guide_ideas
  add column if not exists video_number                 integer,
  add column if not exists folder_client_code           text,
  add column if not exists canonical_name               text,
  add column if not exists script                       text,
  add column if not exists shot_breakdown               text,
  add column if not exists requirements                 text,
  add column if not exists editor_user_id               uuid references public.profiles(id) on delete set null,
  add column if not exists editor_name                  text,
  add column if not exists production_status            text,
  add column if not exists production_note              text,
  add column if not exists onedrive_footage_url         text,
  add column if not exists onedrive_internal_review_url text,
  add column if not exists onedrive_client_approval_url text,
  add column if not exists onedrive_final_url           text,
  add column if not exists production_status_updated_at  timestamptz;

-- Default production_status to not_shot (only where still null).
update public.content_guide_ideas
  set production_status = 'not_shot'
  where production_status is null;

alter table public.content_guide_ideas
  alter column production_status set default 'not_shot';

-- production_status check constraint (drop-then-add so re-runs are safe).
alter table public.content_guide_ideas
  drop constraint if exists content_guide_ideas_production_status_check;
alter table public.content_guide_ideas
  add constraint content_guide_ideas_production_status_check
  check (production_status in (
    'not_shot', 'shot', 'ready_to_edit', 'editing', 'internal_review',
    'internal_changes', 'ready_for_client', 'sent_to_client',
    'client_changes', 'client_approved'
  ));

comment on column public.content_guide_ideas.canonical_name is
  'Expected OneDrive folder/video name, e.g. 2026_07_DULUX_VIDEO_01_ASMR_MIXING_STATION. Display/copy only — never renames OneDrive.';
comment on column public.content_guide_ideas.production_status is
  'Video production lifecycle. Distinct from monthly_deliverables scheduling/posting, which stays the Client Schedule source of truth.';

-- ── 2. One active video per deliverable ─────────────────────────────────────
-- Detect existing duplicates first and refuse rather than guess/delete.
do $$
declare
  dup_count integer;
  dup_list text;
begin
  select count(*), string_agg(deliverable_id::text, ', ')
    into dup_count, dup_list
  from (
    select deliverable_id
    from public.content_guide_ideas
    where deliverable_id is not null
      and status <> 'archived'
    group by deliverable_id
    having count(*) > 1
  ) d;

  if coalesce(dup_count, 0) > 0 then
    raise exception 'phase-19e blocked: % deliverable_id(s) already have more than one non-archived content guide. Resolve these duplicate links before applying. Affected deliverable_id(s): %', dup_count, dup_list;
  end if;
end $$;

-- Only one non-archived guide may actively link to a given deliverable.
create unique index if not exists uniq_content_guide_active_deliverable
  on public.content_guide_ideas (deliverable_id)
  where deliverable_id is not null and status <> 'archived';

-- ── 3. Indexes ──────────────────────────────────────────────────────────────
create index if not exists idx_content_guide_ideas_production_status on public.content_guide_ideas(production_status);
create index if not exists idx_content_guide_ideas_editor on public.content_guide_ideas(editor_user_id);
create index if not exists idx_content_guide_ideas_canonical_name on public.content_guide_ideas(canonical_name);

-- ── Verification (run manually after applying) ───────────────────────────────
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='content_guide_ideas'
--     and column_name in ('production_status','canonical_name','editor_user_id','onedrive_footage_url');
-- select conname from pg_constraint where conrelid='public.content_guide_ideas'::regclass
--   and conname='content_guide_ideas_production_status_check';
-- select indexname from pg_indexes where schemaname='public'
--   and indexname='uniq_content_guide_active_deliverable';
-- RLS unchanged: phase-19d staff policies still apply; clients keep zero access.
-- ============================================================
