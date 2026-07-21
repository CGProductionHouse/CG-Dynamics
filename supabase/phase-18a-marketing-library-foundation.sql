-- ============================================================
-- Phase 18a: Marketing Library / Skill Card foundation
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- First storage foundation for the AI Workforce Marketing Library. Isolated,
-- additive tables only. This file does NOT wire anything into the app UI,
-- routing, CG Hub, Planner, Command Centre, Client Dashboard, Meta sync or
-- CG Hours. No Skill Cards are seeded.
--
-- Source rule: AI-generated output is not a trusted source. AI may help
-- organise or apply knowledge, but source records must represent
-- human-authored, official, measured, or directly captured business context.
--
-- Permissions (v1, conservative):
--   * admin manages and reviews all Marketing Library records;
--   * staff may READ active, non-client-specific Skill Cards only;
--   * clients have NO Marketing Library access (no policy grants them any).
--
-- Depends on public.is_staff() / public.is_admin() (phase-14b) and
-- public.clients (schema.sql). Additive only: no existing table is modified.
-- ============================================================

-- ── updated_at helper (isolated to the Marketing Library) ────────────────────
create or replace function public.update_marketing_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. SOURCES ───────────────────────────────────────────────────────────────
-- Books, research, official docs, market reports, internal data references and
-- client/staff source records. Low-trust source types (AI-generated output,
-- unsourced blogs) may be recorded for review or exclusion but must never be
-- treated as trusted evidence.
create table if not exists public.marketing_library_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'book',
    'research_paper',
    'official_documentation',
    'market_report',
    'internal_campaign_data',
    'client_interview',
    'staff_observation',
    'professional_source',
    'other',
    'ai_generated',
    'unsourced_blog'
  )),
  source_name text not null,
  author_or_organisation text,
  title text,
  publication_year integer,
  chapter_or_section text,
  page_or_url text,
  notes text,
  trust_tier text not null default 'needs_review' check (trust_tier in (
    'tier_1_primary',
    'tier_2_trusted_professional',
    'tier_3_internal_learning',
    'tier_4_low_trust',
    'needs_review'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.marketing_library_sources is
  'Isolated AI Workforce source library. Books, research, official docs, reports, internal data references and client/staff source records.';
comment on column public.marketing_library_sources.source_type is
  'AI-generated output and unsourced blogs are tracked as low-trust/non-source material, not trusted evidence.';
comment on column public.marketing_library_sources.trust_tier is
  'Source hierarchy: primary, trusted professional, internal learning, low trust, or needs review.';

drop trigger if exists trg_marketing_library_sources_updated_at on public.marketing_library_sources;
create trigger trg_marketing_library_sources_updated_at
  before update on public.marketing_library_sources
  for each row execute function public.update_marketing_library_updated_at();

-- ── 2. SKILL CARDS ───────────────────────────────────────────────────────────
-- Structured marketing knowledge for future specialist agents. Cards stay
-- draft / needs_review until a human review approves them. Client-specific
-- cards are future-scoped and must point at an active client record.
create table if not exists public.skill_cards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  subcategory text,
  status text not null default 'draft' check (status in (
    'draft',
    'needs_review',
    'reviewed',
    'active',
    'deprecated'
  )),
  knowledge_layer text not null check (knowledge_layer in (
    'universal_principle',
    'south_african_market',
    'industry_specific',
    'active_client_specific',
    'internal_learning'
  )),
  source_id uuid references public.marketing_library_sources(id) on delete set null,
  source_type text not null check (source_type in (
    'book',
    'research_paper',
    'official_documentation',
    'market_report',
    'internal_campaign_data',
    'client_interview',
    'staff_observation',
    'professional_source',
    'other',
    'ai_generated',
    'unsourced_blog'
  )),
  confidence_level text not null default 'low' check (confidence_level in (
    'high',
    'medium',
    'low',
    'opinion'
  )),
  evidence_label text not null default 'hypothesis' check (evidence_label in (
    'proven_principle',
    'platform_rule',
    'market_observation',
    'internal_learning',
    'client_opinion',
    'hypothesis'
  )),
  principle text not null,
  summary text not null,
  why_it_matters text,
  how_to_apply jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  mistakes_to_avoid jsonb not null default '[]'::jsonb,
  agent_instructions jsonb not null default '[]'::jsonb,
  relevant_industries jsonb not null default '[]'::jsonb,
  relevant_agents jsonb not null default '[]'::jsonb,
  related_card_ids jsonb not null default '[]'::jsonb,
  client_specific boolean not null default false,
  active_client_id uuid references public.clients(id) on delete set null,
  notes text,
  owner text,
  last_reviewed date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint skill_cards_client_specific_requires_client check (
    client_specific = false or active_client_id is not null
  )
);

comment on table public.skill_cards is
  'Isolated AI Workforce Skill Card library. Structured marketing knowledge for future specialist agents.';
comment on column public.skill_cards.client_specific is
  'Client-specific Skill Cards are future scoped and must point to an active client record when used.';
comment on column public.skill_cards.active_client_id is
  'Optional future link to public.clients. This file does not create client-specific workflows or duplicate client lists.';
comment on column public.skill_cards.source_type is
  'Duplicated from source for filtering and review. AI-generated output must not be treated as trusted source material.';

drop trigger if exists trg_skill_cards_updated_at on public.skill_cards;
create trigger trg_skill_cards_updated_at
  before update on public.skill_cards
  for each row execute function public.update_marketing_library_updated_at();

-- ── 3. SKILL CARD REVIEWS ────────────────────────────────────────────────────
-- Human review log before a card becomes active or trusted by agents.
create table if not exists public.skill_card_reviews (
  id uuid primary key default gen_random_uuid(),
  skill_card_id uuid not null references public.skill_cards(id) on delete cascade,
  reviewed_by text,
  review_status text not null check (review_status in (
    'needs_review',
    'approved',
    'changes_requested',
    'rejected',
    'deprecated'
  )),
  review_notes text,
  reviewed_at timestamptz not null default now()
);

comment on table public.skill_card_reviews is
  'Human review log for Skill Cards before they become active or trusted by AI Workforce agents.';

-- ── 4. SKILL CARD USAGE LOGS ─────────────────────────────────────────────────
-- Future audit trail: which agent used which Skill Card and where it
-- influenced output. Populated by later AI Workforce work, not this phase.
create table if not exists public.skill_card_usage_logs (
  id uuid primary key default gen_random_uuid(),
  skill_card_id uuid references public.skill_cards(id) on delete set null,
  agent_key text,
  usage_context text,
  output_reference text,
  created_at timestamptz not null default now()
);

comment on table public.skill_card_usage_logs is
  'Future AI Workforce audit trail showing which agent used which Skill Card and where it influenced output.';

-- ── 5. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_marketing_library_sources_source_type
  on public.marketing_library_sources(source_type);
create index if not exists idx_marketing_library_sources_trust_tier
  on public.marketing_library_sources(trust_tier);

create index if not exists idx_skill_cards_slug on public.skill_cards(slug);
create index if not exists idx_skill_cards_category on public.skill_cards(category);
create index if not exists idx_skill_cards_status on public.skill_cards(status);
create index if not exists idx_skill_cards_knowledge_layer on public.skill_cards(knowledge_layer);
create index if not exists idx_skill_cards_source_type on public.skill_cards(source_type);
create index if not exists idx_skill_cards_client_specific on public.skill_cards(client_specific);
create index if not exists idx_skill_cards_source_id on public.skill_cards(source_id);
create index if not exists idx_skill_cards_active_client_id on public.skill_cards(active_client_id);

create index if not exists idx_skill_card_reviews_card on public.skill_card_reviews(skill_card_id);
create index if not exists idx_skill_card_usage_logs_card on public.skill_card_usage_logs(skill_card_id);

-- ── 6. ROW-LEVEL SECURITY ────────────────────────────────────────────────────
-- Default-deny. Admins manage everything; staff get a single narrow read on
-- active shared cards; clients are never granted any policy.
alter table public.marketing_library_sources enable row level security;
alter table public.skill_cards enable row level security;
alter table public.skill_card_reviews enable row level security;
alter table public.skill_card_usage_logs enable row level security;

-- Sources: admin only (manage + review). No staff or client access in v1.
drop policy if exists "marketing_library_sources: admin all" on public.marketing_library_sources;
create policy "marketing_library_sources: admin all"
  on public.marketing_library_sources for all
  using (public.is_admin())
  with check (public.is_admin());

-- Skill Cards: admin manages everything.
drop policy if exists "skill_cards: admin all" on public.skill_cards;
create policy "skill_cards: admin all"
  on public.skill_cards for all
  using (public.is_admin())
  with check (public.is_admin());

-- Skill Cards: staff may READ active, non-client-specific cards only.
-- (Permissive SELECT policy OR-combined with the admin policy above.)
drop policy if exists "skill_cards: staff read active shared" on public.skill_cards;
create policy "skill_cards: staff read active shared"
  on public.skill_cards for select
  using (public.is_staff() and status = 'active' and client_specific = false);

-- Reviews: admin only.
drop policy if exists "skill_card_reviews: admin all" on public.skill_card_reviews;
create policy "skill_card_reviews: admin all"
  on public.skill_card_reviews for all
  using (public.is_admin())
  with check (public.is_admin());

-- Usage logs: admin only in v1 (future agents will write via a service path).
drop policy if exists "skill_card_usage_logs: admin all" on public.skill_card_usage_logs;
create policy "skill_card_usage_logs: admin all"
  on public.skill_card_usage_logs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── Verification (run manually after applying) ───────────────────────────────
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--     and tablename in ('marketing_library_sources', 'skill_cards',
--                       'skill_card_reviews', 'skill_card_usage_logs');
-- select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename like 'skill_card%' or tablename = 'marketing_library_sources'
--   order by tablename, policyname;
-- Expected: RLS enabled on all four; admin "all" policy on each; one extra
-- staff SELECT policy on skill_cards. No client-role policy anywhere.
-- ============================================================
