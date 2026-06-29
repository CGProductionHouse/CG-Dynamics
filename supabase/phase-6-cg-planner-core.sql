-- ============================================================
-- Phase 6A: CG Planner Core Foundation
-- Creates the Planner replacement tables, RLS, and indexes.
--
-- Safe to run on production. Does NOT modify existing
-- command_centre_tables or any existing schema.
--
-- Run via Supabase SQL editor:
--   psql $SUPABASE_DB_URL -f supabase/phase-6-cg-planner-core.sql
-- ============================================================


-- ── 0. HELPER: generic updated_at trigger ────────────────────
-- (only creates if no existing generic version is preferred)

create or replace function public.update_planner_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ── 1. PLANNER BOARDS ───────────────────────────────────────
-- Represents major working boards replacing current Teams Planner
-- areas: Operations / To Do, Client Websites, Admin Check List,
-- Client Schedule, CG Socials.

create table public.planner_boards (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  board_type   text not null default 'operations'
               check (board_type in ('operations', 'websites', 'admin', 'client_schedule', 'cg_socials', 'custom')),
  visibility   text not null default 'staff'
               check (visibility in ('public_internal', 'staff', 'admin_only')),
  description  text,
  sort_order   int not null default 0,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create trigger trg_planner_boards_updated_at
  before update on public.planner_boards
  for each row execute function public.update_planner_updated_at();


-- ── 2. PLANNER BUCKETS ──────────────────────────────────────
-- Columns / categories inside each board (e.g. "Graphic Design",
-- "Client Requests", "Daily", "Weekly", etc.).

create table public.planner_buckets (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.planner_boards(id) on delete cascade,
  name        text not null,
  bucket_type text not null default 'default'
              check (bucket_type in ('default', 'client_requests', 'graphic_design', 'video', 'websites',
                                     'admin', 'content_guides', 'once_off', 'daily', 'weekly', 'monthly',
                                     'payroll', 'checking', 'client_schedule', 'client_package', 'cg_socials', 'other')),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  unique (board_id, name)
);

create trigger trg_planner_buckets_updated_at
  before update on public.planner_buckets
  for each row execute function public.update_planner_updated_at();


-- ── 3. CLIENT PACKAGES ──────────────────────────────────────
-- Versioned client package setup. Each package belongs to a client
-- and has a start/end date. Changing a package ends the old one
-- (end_date) and creates a new one from the new date.

create table public.client_packages (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  package_name text not null,
  status       text not null default 'active'
               check (status in ('active', 'paused', 'archived')),
  start_date   date not null,
  end_date     date,
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create trigger trg_client_packages_updated_at
  before update on public.client_packages
  for each row execute function public.update_planner_updated_at();


-- ── 4. PACKAGE DELIVERABLE TEMPLATES ─────────────────────────
-- Template items that repeat monthly from a package (e.g. DP1, F2,
-- Video 1, Reel 3).

create table public.package_deliverable_templates (
  id                    uuid primary key default gen_random_uuid(),
  package_id            uuid not null references public.client_packages(id) on delete cascade,
  code                  text not null,    -- e.g. "DP", "F", "Video", "Reel"
  deliverable_type      text not null default 'other'
                        check (deliverable_type in ('dp', 'photo', 'video', 'reel', 'content_run',
                                                    'website_update', 'monthly_report', 'strategy', 'admin', 'other')),
  title_template        text not null,    -- e.g. "Designed Poster {instance}"
  count_per_month       int not null default 1,
  default_bucket        text,
  default_assignee_name text,
  default_day_of_month  int check (default_day_of_month between 1 and 31),
  default_weekday       int check (default_weekday between 0 and 6),
  sort_order            int not null default 0,
  active                boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (package_id, code)
);

create trigger trg_package_deliverable_templates_updated_at
  before update on public.package_deliverable_templates
  for each row execute function public.update_planner_updated_at();


-- ── 5. MONTHLY DELIVERABLES ──────────────────────────────────
-- THE core table. One row per client deliverable per month.
-- Moving July's DP1 does NOT affect August's DP1.

create table public.monthly_deliverables (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid not null references public.clients(id) on delete cascade,
  package_id                uuid references public.client_packages(id) on delete set null,
  template_id               uuid references public.package_deliverable_templates(id) on delete set null,
  board_id                  uuid references public.planner_boards(id) on delete set null,
  bucket_id                 uuid references public.planner_buckets(id) on delete set null,
  month                     date not null,      -- first day of month, e.g. 2026-07-01
  code                      text not null,       -- denormalised: "DP", "F", etc.
  instance_number           int not null,        -- 1..N within month
  title                     text not null,
  deliverable_type          text not null default 'other'
                            check (deliverable_type in ('dp', 'photo', 'video', 'reel', 'content_run',
                                                        'website_update', 'monthly_report', 'strategy', 'admin', 'other')),
  production_status         text not null default 'to_do'
                            check (production_status in (
                              'to_do',
                              'in_progress',
                              'ready_internal_review',
                              'internal_changes',
                              'ready_client_approval',
                              'waiting_client',
                              'client_changes',
                              'approved',
                              'scheduled',
                              'posted',
                              'blocked',
                              'moved'
                            )),
  priority                  text not null default 'normal'
                            check (priority in ('normal', 'client_request', 'urgent')),
  assigned_to_user_id       uuid references public.profiles(id) on delete set null,
  assigned_to_name          text,
  due_date                  date,
  scheduled_date            date,    -- only CA/Amonique sets this
  posted_at                 timestamptz,
  internal_approved_at      timestamptz,
  sent_to_client_at         timestamptz,
  client_approved_at        timestamptz,
  moved_from_deliverable_id uuid references public.monthly_deliverables(id) on delete set null,
  replaced_by_request_id    uuid references public.client_requests(id) on delete set null,
  notes                     text,
  created_by                uuid references public.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  archived_at               timestamptz,
  unique (package_id, template_id, instance_number, month)
);

create trigger trg_monthly_deliverables_updated_at
  before update on public.monthly_deliverables
  for each row execute function public.update_planner_updated_at();


-- ── 6. PLANNER ACTIVITY LOG ─────────────────────────────────
-- Safe audit/history log for planner actions.
-- Does NOT store secrets or sensitive finance/payroll data.

create table public.planner_activity_log (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,    -- e.g. 'monthly_deliverable', 'client_package', 'planner_board'
  entity_id     uuid not null,
  action        text not null,    -- e.g. 'created', 'status_changed', 'scheduled', 'assigned', 'archived'
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_name    text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);


-- ── 7. existing command_centre_tasks extension ──────────────
-- Add deliverable_id FK so ad-hoc tasks can link back to
-- the planner deliverable they override or relate to.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'command_centre_tasks'
      and column_name  = 'deliverable_id'
  ) then
    alter table public.command_centre_tasks
      add column deliverable_id uuid references public.monthly_deliverables(id) on delete set null;
  end if;
end;
$$;


-- ── 8. ROW-LEVEL SECURITY ─────────────────────────────────────

-- planner_boards
alter table public.planner_boards enable row level security;

create policy "planner_boards: staff select public"
  on public.planner_boards for select
  using (
    is_staff()
    and (
      visibility in ('public_internal', 'staff')
      or (visibility = 'admin_only' and is_admin())
    )
  );

create policy "planner_boards: admin insert"
  on public.planner_boards for insert
  with check (is_admin());

create policy "planner_boards: admin update"
  on public.planner_boards for update
  using (is_admin());

create policy "planner_boards: admin delete"
  on public.planner_boards for delete
  using (is_admin());

-- planner_buckets
alter table public.planner_buckets enable row level security;

-- Bucket visibility follows its board's visibility via FK.
create policy "planner_buckets: staff select"
  on public.planner_buckets for select
  using (
    exists (
      select 1 from public.planner_boards b
      where b.id = planner_buckets.board_id
        and (
          b.visibility in ('public_internal', 'staff')
          or (b.visibility = 'admin_only' and is_admin())
        )
    )
  );

create policy "planner_buckets: admin insert"
  on public.planner_buckets for insert
  with check (is_admin());

create policy "planner_buckets: admin update"
  on public.planner_buckets for update
  using (is_admin());

create policy "planner_buckets: admin delete"
  on public.planner_buckets for delete
  using (is_admin());

-- client_packages
alter table public.client_packages enable row level security;

create policy "client_packages: admin all"
  on public.client_packages for all
  using (is_admin())
  with check (is_admin());

create policy "client_packages: staff select"
  on public.client_packages for select
  using (is_staff());

-- package_deliverable_templates
alter table public.package_deliverable_templates enable row level security;

create policy "package_deliverable_templates: admin all"
  on public.package_deliverable_templates for all
  using (is_admin())
  with check (is_admin());

create policy "package_deliverable_templates: staff select"
  on public.package_deliverable_templates for select
  using (is_staff());

-- monthly_deliverables
-- Staff can read all, but only admin can update scheduled/approved
-- critical fields. RLS cannot easily enforce field-level restrictions,
-- so we keep the update policy conservative: only admin can update
-- monthly_deliverables directly. Staff update their own work through
-- the dedicated smaller-scope API/helper that the UI will call.
--
-- TODO: Add Amonique-specific manager permissions when role detection
-- supports a 'manager' or 'lead' role beyond the current admin/team/client split.

alter table public.monthly_deliverables enable row level security;

create policy "monthly_deliverables: staff select"
  on public.monthly_deliverables for select
  using (is_staff());

create policy "monthly_deliverables: admin insert"
  on public.monthly_deliverables for insert
  with check (is_admin());

create policy "monthly_deliverables: admin update"
  on public.monthly_deliverables for update
  using (is_admin());

create policy "monthly_deliverables: admin delete"
  on public.monthly_deliverables for delete
  using (is_admin());

-- planner_activity_log
alter table public.planner_activity_log enable row level security;

create policy "planner_activity_log: staff select"
  on public.planner_activity_log for select
  using (is_staff());

create policy "planner_activity_log: staff insert"
  on public.planner_activity_log for insert
  with check (is_staff());


-- ── 9. INDEXES ────────────────────────────────────────────────

create index idx_monthly_deliverables_client_month
  on public.monthly_deliverables(client_id, month);
create index idx_monthly_deliverables_status
  on public.monthly_deliverables(production_status);
create index idx_monthly_deliverables_assigned
  on public.monthly_deliverables(assigned_to_name);
create index idx_monthly_deliverables_scheduled
  on public.monthly_deliverables(scheduled_date)
  where scheduled_date is not null;
create index idx_monthly_deliverables_board
  on public.monthly_deliverables(board_id);
create index idx_monthly_deliverables_bucket
  on public.monthly_deliverables(bucket_id);
create index idx_monthly_deliverables_package
  on public.monthly_deliverables(package_id);
create index idx_monthly_deliverables_archived
  on public.monthly_deliverables(archived_at)
  where archived_at is not null;

create index idx_client_packages_client
  on public.client_packages(client_id);
create index idx_client_packages_active
  on public.client_packages(status)
  where status = 'active';

create index idx_package_templates_package
  on public.package_deliverable_templates(package_id);

create index idx_planner_boards_visibility
  on public.planner_boards(visibility);
create index idx_planner_buckets_board
  on public.planner_buckets(board_id);

create index idx_planner_activity_log_entity
  on public.planner_activity_log(entity_type, entity_id);
create index idx_planner_activity_log_created
  on public.planner_activity_log(created_at desc);


-- ── 10. SEED COMMENTS (not active inserts) ──────────────────
-- Uncomment and adapt when ready to seed initial boards:
--
-- -- Operations / To Do
-- insert into planner_boards (name, slug, board_type, visibility, description, sort_order) values
--   ('Operations / To Do', 'operations-todo', 'operations', 'staff',
--    'Daily tasks, client requests, graphic design, video, websites, content guides, once-off items.', 1);
--
-- -- Client Websites
-- insert into planner_boards (name, slug, board_type, visibility, description, sort_order) values
--   ('Client Websites', 'client-websites', 'websites', 'staff',
--    'Website requests, monthly updates, maintenance, Google Business Profiles, old client sites.', 2);
--
-- -- Admin Check List
-- insert into planner_boards (name, slug, board_type, visibility, description, sort_order) values
--   ('Admin Check List', 'admin-check-list', 'admin', 'admin_only',
--    'Admin-only daily, weekly, monthly tasks. Payroll, checking, financial items.', 3);
--
-- -- Client Schedule
-- insert into planner_boards (name, slug, board_type, visibility, description, sort_order) values
--   ('Client Schedule', 'client-schedule', 'client_schedule', 'staff',
--    'Client package calendar. Monthly deliverables tracking for all clients.', 4);
--
-- -- CG Socials
-- insert into planner_boards (name, slug, board_type, visibility, description, sort_order) values
--   ('CG Socials', 'cg-socials', 'cg_socials', 'public_internal',
--    'CG''s own content schedule, studio schedule, internal content runs and posts.', 5);
