-- ============================================================
-- AI Workforce: Marketing Library + Skill Card Storage Design
-- ============================================================
-- This file defines isolated AI Workforce tables only.
-- It must not touch CG Hours, payroll, planner tasks, Command Centre,
-- client reporting, Meta sync, or existing Operations Hub tables.
--
-- Important source rule:
-- AI generated output is not a trusted source. AI may help organise or
-- apply knowledge, but source records must represent human-authored,
-- official, measured, or directly captured business context.
--
-- Client-specific cards should only reference active client records later.
-- This design includes active_client_id for future integration, but no
-- client-specific automation is implemented here.
-- ============================================================

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
  'Isolated AI Workforce source library. Stores books, research, official docs, reports, internal data references, and client/staff source records.';
comment on column public.marketing_library_sources.source_type is
  'AI generated output and unsourced blogs are tracked as low-trust/non-source material, not trusted evidence.';
comment on column public.marketing_library_sources.trust_tier is
  'Source hierarchy aligned to Marketing Library standards: primary, trusted professional, internal learning, low trust, or needs review.';

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
  'Client-specific Skill Cards are future scoped and should only point to active client records when implemented.';
comment on column public.skill_cards.active_client_id is
  'Optional future link to public.clients. This file does not create client-specific workflows or duplicate client lists.';
comment on column public.skill_cards.source_type is
  'Duplicated from source for filtering and review. AI generated output must not be treated as trusted source material.';

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

create index if not exists idx_marketing_library_sources_source_type
  on public.marketing_library_sources(source_type);
create index if not exists idx_marketing_library_sources_trust_tier
  on public.marketing_library_sources(trust_tier);

create index if not exists idx_skill_cards_slug
  on public.skill_cards(slug);
create index if not exists idx_skill_cards_category
  on public.skill_cards(category);
create index if not exists idx_skill_cards_status
  on public.skill_cards(status);
create index if not exists idx_skill_cards_knowledge_layer
  on public.skill_cards(knowledge_layer);
create index if not exists idx_skill_cards_source_type
  on public.skill_cards(source_type);
create index if not exists idx_skill_cards_client_specific
  on public.skill_cards(client_specific);
