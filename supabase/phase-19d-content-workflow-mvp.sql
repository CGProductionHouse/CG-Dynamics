-- ============================================================
-- Phase 19d: Content Workflow MVP (Content Guides + Content Runs)
--
-- REVIEW IN THE SUPABASE SQL EDITOR BEFORE APPLYING LIVE.
--
-- Additive only. Three new canonical tables let staff manually create content
-- guide ideas, group approved ideas into content runs, and assign/execute the
-- run — removing daily coordination from Amonique. No existing table is
-- modified; client/user/schedule master data is referenced, never duplicated.
--
-- RLS (launch MVP): internal staff (is_staff) may read and create/update;
-- clients have NO access. Hard deletion is not used — archived/cancelled
-- states retire records. Consistent with public.is_staff/is_manager/is_admin.
--
-- Depends on: public.clients, public.profiles, public.monthly_deliverables,
-- public.is_staff() (phase-14b), public.update_planner_updated_at() (phase-6).
-- ============================================================

-- ── 1. CONTENT GUIDE IDEAS ───────────────────────────────────────────────────
create table if not exists public.content_guide_ideas (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references public.clients(id) on delete set null,
  client_name        text,                       -- denormalised for display (like monthly_deliverables)
  month              date,                       -- first day of the target month
  title              text not null,
  objective          text,
  platform           text,
  format             text,
  hook               text,                       -- hook / content angle
  cta                text,
  visual_notes       text,                       -- visual / filming notes
  owner_user_id      uuid references public.profiles(id) on delete set null,
  owner_name         text,
  proposed_post_date date,
  deliverable_id     uuid references public.monthly_deliverables(id) on delete set null,
  status             text not null default 'idea'
                     check (status in ('idea', 'needs_review', 'approved',
                                       'added_to_run', 'in_production', 'completed', 'archived')),
  notes              text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.content_guide_ideas is
  'Staff-created content ideas. Approved ideas can be grouped into a content run and optionally linked to a monthly_deliverable.';

drop trigger if exists trg_content_guide_ideas_updated_at on public.content_guide_ideas;
create trigger trg_content_guide_ideas_updated_at
  before update on public.content_guide_ideas
  for each row execute function public.update_planner_updated_at();

-- ── 2. CONTENT RUNS ──────────────────────────────────────────────────────────
create table if not exists public.content_runs (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references public.clients(id) on delete set null,
  client_name    text,                           -- denormalised for display
  name           text not null,
  run_date       date,
  start_time     time,
  location       text,
  lead_user_id   uuid references public.profiles(id) on delete set null,
  lead_name      text,
  helper_names   text[] not null default '{}',
  internal_notes text,
  status         text not null default 'planning'
                 check (status in ('planning', 'ready', 'in_progress', 'captured',
                                   'processing', 'completed', 'cancelled')),
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.content_runs is
  'A production/shoot run grouping approved content ideas with a lead, helpers, date, location and shot list.';

drop trigger if exists trg_content_runs_updated_at on public.content_runs;
create trigger trg_content_runs_updated_at
  before update on public.content_runs
  for each row execute function public.update_planner_updated_at();

-- ── 3. CONTENT RUN ITEMS (shot list) ─────────────────────────────────────────
create table if not exists public.content_run_items (
  id            uuid primary key default gen_random_uuid(),
  run_id        uuid not null references public.content_runs(id) on delete cascade,
  guide_idea_id uuid references public.content_guide_ideas(id) on delete set null,
  sort_order    int not null default 0,          -- shot order / number
  title         text,                            -- shot title (denormalised from the idea when linked)
  shot_notes    text,
  requirements  text,                            -- people / products / props required
  completed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.content_run_items is
  'One shot/item within a content run. May link to an approved content guide idea. completed tracks per-item progress.';

drop trigger if exists trg_content_run_items_updated_at on public.content_run_items;
create trigger trg_content_run_items_updated_at
  before update on public.content_run_items
  for each row execute function public.update_planner_updated_at();

-- ── 4. INDEXES ───────────────────────────────────────────────────────────────
create index if not exists idx_content_guide_ideas_client on public.content_guide_ideas(client_id);
create index if not exists idx_content_guide_ideas_status on public.content_guide_ideas(status);
create index if not exists idx_content_guide_ideas_month on public.content_guide_ideas(month);
create index if not exists idx_content_guide_ideas_owner on public.content_guide_ideas(owner_user_id);
create index if not exists idx_content_guide_ideas_deliverable on public.content_guide_ideas(deliverable_id);
create index if not exists idx_content_runs_client on public.content_runs(client_id);
create index if not exists idx_content_runs_status on public.content_runs(status);
create index if not exists idx_content_runs_run_date on public.content_runs(run_date);
create index if not exists idx_content_runs_lead on public.content_runs(lead_user_id);
create index if not exists idx_content_run_items_run on public.content_run_items(run_id);
create index if not exists idx_content_run_items_guide on public.content_run_items(guide_idea_id);

-- ── 5. ROW-LEVEL SECURITY ────────────────────────────────────────────────────
-- Internal staff may read and create/update; clients get no policy (denied).
-- No delete policy — records are retired via archived/cancelled states.
alter table public.content_guide_ideas enable row level security;
alter table public.content_runs enable row level security;
alter table public.content_run_items enable row level security;

drop policy if exists "content_guide_ideas: staff select" on public.content_guide_ideas;
create policy "content_guide_ideas: staff select"
  on public.content_guide_ideas for select using (public.is_staff());
drop policy if exists "content_guide_ideas: staff insert" on public.content_guide_ideas;
create policy "content_guide_ideas: staff insert"
  on public.content_guide_ideas for insert with check (public.is_staff());
drop policy if exists "content_guide_ideas: staff update" on public.content_guide_ideas;
create policy "content_guide_ideas: staff update"
  on public.content_guide_ideas for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "content_runs: staff select" on public.content_runs;
create policy "content_runs: staff select"
  on public.content_runs for select using (public.is_staff());
drop policy if exists "content_runs: staff insert" on public.content_runs;
create policy "content_runs: staff insert"
  on public.content_runs for insert with check (public.is_staff());
drop policy if exists "content_runs: staff update" on public.content_runs;
create policy "content_runs: staff update"
  on public.content_runs for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "content_run_items: staff select" on public.content_run_items;
create policy "content_run_items: staff select"
  on public.content_run_items for select using (public.is_staff());
drop policy if exists "content_run_items: staff insert" on public.content_run_items;
create policy "content_run_items: staff insert"
  on public.content_run_items for insert with check (public.is_staff());
drop policy if exists "content_run_items: staff update" on public.content_run_items;
create policy "content_run_items: staff update"
  on public.content_run_items for update using (public.is_staff()) with check (public.is_staff());
-- content_run_items delete is allowed for staff so a shot can be removed from a
-- run before it is executed (runs/ideas themselves are retired, never deleted).
drop policy if exists "content_run_items: staff delete" on public.content_run_items;
create policy "content_run_items: staff delete"
  on public.content_run_items for delete using (public.is_staff());

-- ── Verification (run manually after applying) ───────────────────────────────
-- select tablename, rowsecurity from pg_tables where schemaname='public'
--   and tablename in ('content_guide_ideas','content_runs','content_run_items');
-- Expected: RLS enabled on all three; staff select/insert/update policies; no
-- client-role policy anywhere.
-- ============================================================
