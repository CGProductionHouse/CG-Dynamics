-- ============================================================
-- Phase 6E: Teams Planner Import Foundation
-- Adds a generic planner_tasks table for non-package Planner exports.
-- Safe to run. Does not delete, drop, truncate, or import data.
-- ============================================================

create table if not exists public.planner_tasks (
  id                 uuid primary key default gen_random_uuid(),
  board_id           uuid references public.planner_boards(id) on delete set null,
  bucket_id          uuid references public.planner_buckets(id) on delete set null,
  title              text not null,
  client_id          uuid references public.clients(id) on delete set null,
  client_name        text,
  assigned_to_name   text,
  status             text not null default 'to_do'
                     check (status in ('to_do', 'in_progress', 'ready_internal_review', 'approved', 'scheduled')),
  priority           text not null default 'normal'
                     check (priority in ('normal', 'client_request', 'urgent')),
  start_date         date,
  due_date           date,
  notes              text,
  checklist          jsonb not null default '[]'::jsonb,
  source             text not null default 'teams_import',
  original_plan_name text,
  original_bucket_name text,
  original_task_id   text,
  import_hash        text not null unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_planner_tasks_updated_at on public.planner_tasks;
create trigger trg_planner_tasks_updated_at
  before update on public.planner_tasks
  for each row execute function public.update_planner_updated_at();

create index if not exists idx_planner_tasks_board_bucket on public.planner_tasks(board_id, bucket_id);
create index if not exists idx_planner_tasks_client on public.planner_tasks(client_id);
create index if not exists idx_planner_tasks_due_date on public.planner_tasks(due_date);
create index if not exists idx_planner_tasks_status on public.planner_tasks(status);
create index if not exists idx_planner_tasks_import_hash on public.planner_tasks(import_hash);

alter table public.planner_tasks enable row level security;

drop policy if exists "planner_tasks: staff select visible boards" on public.planner_tasks;
create policy "planner_tasks: staff select visible boards"
  on public.planner_tasks for select
  using (
    is_staff()
    and exists (
      select 1
      from public.planner_boards b
      where b.id = planner_tasks.board_id
        and (
          b.visibility in ('public_internal', 'staff')
          or (b.visibility = 'admin_only' and is_admin())
        )
    )
  );

drop policy if exists "planner_tasks: admin insert" on public.planner_tasks;
create policy "planner_tasks: admin insert"
  on public.planner_tasks for insert
  with check (is_admin());

drop policy if exists "planner_tasks: admin update" on public.planner_tasks;
create policy "planner_tasks: admin update"
  on public.planner_tasks for update
  using (is_admin());

drop policy if exists "planner_tasks: admin delete" on public.planner_tasks;
create policy "planner_tasks: admin delete"
  on public.planner_tasks for delete
  using (is_admin());
