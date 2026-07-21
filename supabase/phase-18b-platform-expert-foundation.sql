-- ============================================================
-- Phase 18b: Platform Expert foundation
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- First, minimal Platform Expert layer for the AI Workforce Marketing Library.
-- Platform Experts translate durable marketing principles into current platform
-- mechanics (Instagram, Facebook, LinkedIn, ...). This phase creates only the
-- three core tables needed now — experts, surfaces and knowledge items — plus
-- empty platform shells. It deliberately does NOT create sources join tables,
-- formats, experiments, change logs or platform Skill Cards; those are later.
--
-- Knowledge lifecycle: items carry a knowledge_state, confidence, territory,
-- last_verified_at and expires_at so stale platform mechanics are never used
-- silently (docs/CORE_PRINCIPLES.md: avoid stale platform mechanics).
--
-- Permissions (v1, conservative):
--   * admin manages all Platform Expert records;
--   * staff may READ active platforms/surfaces and only current, non-expired
--     knowledge (verified_current / observed_current);
--   * clients have NO access (no policy grants them any).
--
-- Depends on public.is_staff() / public.is_admin() (phase-14b) and
-- public.marketing_library_sources (phase-18a). Additive only.
-- ============================================================

-- Reuse the Marketing Library updated_at helper. Recreated idempotently so this
-- file also works if applied before/independently of phase-18a's definition.
create or replace function public.update_marketing_library_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── 1. PLATFORM EXPERTS ──────────────────────────────────────────────────────
-- One row per platform. Empty shell now; knowledge is added later, verified.
create table if not exists public.platform_experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_experts is
  'AI Workforce Platform Experts. Each platform (Instagram, Facebook, ...) is a living, versioned knowledge system. Empty shells until verified knowledge is added.';

drop trigger if exists trg_platform_experts_updated_at on public.platform_experts;
create trigger trg_platform_experts_updated_at
  before update on public.platform_experts
  for each row execute function public.update_marketing_library_updated_at();

-- ── 2. PLATFORM SURFACES ─────────────────────────────────────────────────────
-- Distinct surfaces within a platform: Feed, Reels, Stories, Search, Profile...
create table if not exists public.platform_surfaces (
  id uuid primary key default gen_random_uuid(),
  platform_expert_id uuid not null references public.platform_experts(id) on delete cascade,
  surface_key text not null,
  name text not null,
  user_intent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform_expert_id, surface_key)
);

comment on table public.platform_surfaces is
  'Surfaces within a Platform Expert (e.g. Instagram Feed, Reels, Stories, Search).';

drop trigger if exists trg_platform_surfaces_updated_at on public.platform_surfaces;
create trigger trg_platform_surfaces_updated_at
  before update on public.platform_surfaces
  for each row execute function public.update_marketing_library_updated_at();

-- ── 3. PLATFORM KNOWLEDGE ITEMS ──────────────────────────────────────────────
-- Atomic platform knowledge, optionally scoped to a surface and linked to an
-- existing Marketing Library source. Never used past expiry without review.
create table if not exists public.platform_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  platform_expert_id uuid not null references public.platform_experts(id) on delete cascade,
  surface_id uuid references public.platform_surfaces(id) on delete set null,
  source_id uuid references public.marketing_library_sources(id) on delete set null,
  title text not null,
  principle text not null,
  application text,
  limitations text,
  knowledge_state text not null default 'experimental' check (knowledge_state in (
    'verified_current',
    'observed_current',
    'experimental',
    'disputed',
    'stale',
    'retired'
  )),
  confidence text not null default 'low' check (confidence in (
    'high',
    'medium',
    'low',
    'opinion'
  )),
  territory text,
  researched_at date,
  last_verified_at date,
  expires_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_knowledge_items is
  'Atomic Platform Expert knowledge. knowledge_state + last_verified_at + expires_at govern whether staff/agents may rely on it. AI-generated output is never a trusted source.';
comment on column public.platform_knowledge_items.knowledge_state is
  'verified_current, observed_current, experimental, disputed, stale or retired. Staff read only verified_current/observed_current and non-expired.';

drop trigger if exists trg_platform_knowledge_items_updated_at on public.platform_knowledge_items;
create trigger trg_platform_knowledge_items_updated_at
  before update on public.platform_knowledge_items
  for each row execute function public.update_marketing_library_updated_at();

-- ── 4. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_platform_experts_slug on public.platform_experts(slug);
create index if not exists idx_platform_experts_active on public.platform_experts(active);
create index if not exists idx_platform_surfaces_expert on public.platform_surfaces(platform_expert_id);
create index if not exists idx_platform_knowledge_expert on public.platform_knowledge_items(platform_expert_id);
create index if not exists idx_platform_knowledge_surface on public.platform_knowledge_items(surface_id);
create index if not exists idx_platform_knowledge_source on public.platform_knowledge_items(source_id);
create index if not exists idx_platform_knowledge_state on public.platform_knowledge_items(knowledge_state);
create index if not exists idx_platform_knowledge_expires on public.platform_knowledge_items(expires_at);

-- ── 5. ROW-LEVEL SECURITY ────────────────────────────────────────────────────
-- Default-deny. Admin manages everything; staff read active platforms/surfaces
-- and only current, non-expired knowledge; clients get no policy.
alter table public.platform_experts enable row level security;
alter table public.platform_surfaces enable row level security;
alter table public.platform_knowledge_items enable row level security;

-- Platform experts
drop policy if exists "platform_experts: admin all" on public.platform_experts;
create policy "platform_experts: admin all"
  on public.platform_experts for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "platform_experts: staff read active" on public.platform_experts;
create policy "platform_experts: staff read active"
  on public.platform_experts for select
  using (public.is_staff() and active = true);

-- Platform surfaces
drop policy if exists "platform_surfaces: admin all" on public.platform_surfaces;
create policy "platform_surfaces: admin all"
  on public.platform_surfaces for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "platform_surfaces: staff read active" on public.platform_surfaces;
create policy "platform_surfaces: staff read active"
  on public.platform_surfaces for select
  using (public.is_staff() and active = true);

-- Platform knowledge items: staff read only current, non-expired knowledge.
drop policy if exists "platform_knowledge_items: admin all" on public.platform_knowledge_items;
create policy "platform_knowledge_items: admin all"
  on public.platform_knowledge_items for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "platform_knowledge_items: staff read current" on public.platform_knowledge_items;
create policy "platform_knowledge_items: staff read current"
  on public.platform_knowledge_items for select
  using (
    public.is_staff()
    and knowledge_state in ('verified_current', 'observed_current')
    and (expires_at is null or expires_at >= current_date)
  );

-- ── 6. SEED — empty platform shells only (idempotent, no knowledge) ───────────
-- Only the priority platforms as inactive-free shells. No surfaces and no
-- knowledge items are seeded; unverified platform rules must never be seeded.
insert into public.platform_experts (name, slug)
values
  ('Instagram', 'instagram'),
  ('Facebook', 'facebook'),
  ('LinkedIn', 'linkedin'),
  ('TikTok', 'tiktok'),
  ('Google Business Profile', 'google-business-profile'),
  ('YouTube', 'youtube'),
  ('WhatsApp Business', 'whatsapp-business')
on conflict (slug) do nothing;

-- ── Verification (run manually after applying) ───────────────────────────────
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--     and tablename in ('platform_experts', 'platform_surfaces', 'platform_knowledge_items');
-- select name, slug, active from public.platform_experts order by name;
-- Expected: RLS enabled on all three; 7 platform shells; no surfaces or
-- knowledge rows; no client-role policy anywhere.
-- ============================================================
