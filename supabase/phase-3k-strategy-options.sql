-- ============================================================
-- CG Dynamics - Phase 3k editable strategy option library
-- Run this once in the Supabase SQL editor. Safe to re-run (idempotent).
--
-- A global, admin-editable library of selectable options used by the guided
-- strategy engine (client direction, why-it-worked, strategy drivers, etc.).
-- The app ships with sensible built-in defaults and falls back to them if this
-- table is empty or absent, so it keeps working before this migration is run.
--
-- IMPORTANT: when an option is selected into a report, the app stores the
-- selected label/value inside that report's strategy_data. Editing or removing
-- a global option here therefore never changes already-saved reports.
-- ============================================================

create table if not exists public.strategy_options (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  label       text not null,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists strategy_options_category_idx
  on public.strategy_options (category, sort_order);

-- Keep updated_at fresh.
create or replace function public.set_strategy_options_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists strategy_options_set_updated_at on public.strategy_options;
create trigger strategy_options_set_updated_at
  before update on public.strategy_options
  for each row execute procedure public.set_strategy_options_updated_at();

-- ── ROW-LEVEL SECURITY ───────────────────────────────────────
-- Mirrors the established pattern: admins read/write, all staff read, and
-- (harmless here) clients are simply not granted access. The option library is
-- internal tooling, so no client policy is added.
alter table public.strategy_options enable row level security;

-- Admin: full read/write.
drop policy if exists "strategy_options: admin all" on public.strategy_options;
create policy "strategy_options: admin all"
  on public.strategy_options for all
  using (is_admin())
  with check (is_admin());

-- Team (staff): read-only. They may select options but not edit the library.
drop policy if exists "strategy_options: staff read all" on public.strategy_options;
create policy "strategy_options: staff read all"
  on public.strategy_options for select
  using (is_staff());

-- ── OPTIONAL SEED ────────────────────────────────────────────
-- Leaving this table empty is fine — the app uses its built-in defaults. If you
-- want the defaults materialised so they can be edited/reordered in the admin
-- UI, run the seed below once. It only inserts when the table is empty.
--
-- insert into public.strategy_options (category, label, sort_order)
-- select category, label, sort_order from (values
--   ('client_direction', 'Promote a special', 1),
--   ('client_direction', 'Seasonal content', 2),
--   ('client_direction', 'Product or service push', 3)
--   -- ... extend with the defaults from src/lib/db/strategyOptions.ts ...
-- ) as seed(category, label, sort_order)
-- where not exists (select 1 from public.strategy_options);
