-- ============================================================
-- Phase 5: CG Command Centre
-- Task management for daily CG Production House operations.
--
-- Safe to run on production. Creates the command_centre_tasks
-- table with RLS matching the existing staff security patterns.
--
-- Run via Supabase SQL editor:
--   psql $SUPABASE_DB_URL -f supabase/phase-5-cg-command-centre.sql
-- ============================================================


-- ── 1. TABLE ─────────────────────────────────────────────────

create table public.command_centre_tasks (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  client_id             uuid references public.clients(id) on delete set null,
  client_name           text,
  assigned_to_user_id   uuid references public.profiles(id) on delete set null,
  assigned_to_name      text,
  bucket                text not null default 'Admin / To Do'
                        check (bucket in (
                          'Client Requests',
                          'Graphic Design',
                          'Video',
                          'Websites',
                          'Admin / To Do',
                          'Content Guides',
                          'Once-off',
                          'Recurring',
                          'CG Socials',
                          'Client Schedules'
                        )),
  priority              text not null default 'normal'
                        check (priority in ('normal', 'client_request', 'urgent')),
  status                text not null default 'to_do'
                        check (status in (
                          'to_do',
                          'in_progress',
                          'done',
                          'blocked',
                          'waiting_client',
                          'moved_to_tomorrow'
                        )),
  due_date              date not null default current_date,
  notes                 text,
  source                text not null default 'manual'
                        check (source in ('manual', 'whatsapp_paste', 'morning_list', 'other')),
  whatsapp_source_text  text,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  completed_at          timestamptz
);

-- Auto-update updated_at on row change
create or replace function public.update_command_centre_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at = now();
  end if;
  if old.status = 'done' and new.status is distinct from 'done' then
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger trg_command_centre_tasks_updated_at
  before update on public.command_centre_tasks
  for each row execute function public.update_command_centre_tasks_updated_at();


-- ── 2. ROW-LEVEL SECURITY ─────────────────────────────────────

alter table public.command_centre_tasks enable row level security;

-- Staff (admin + team) can read all tasks
create policy "command_centre_tasks: staff select"
  on public.command_centre_tasks for select
  using (is_staff());

-- Staff can insert tasks
create policy "command_centre_tasks: staff insert"
  on public.command_centre_tasks for insert
  with check (is_staff());

-- Admin can update any task; team can update tasks they are
-- assigned to (by user id) or any task if not assigned to anyone.
create policy "command_centre_tasks: staff update"
  on public.command_centre_tasks for update
  using (
    is_staff()
    and (
      is_admin()
      or assigned_to_user_id is null
      or assigned_to_user_id = auth.uid()
    )
  );

-- Only admin can delete tasks
create policy "command_centre_tasks: admin delete"
  on public.command_centre_tasks for delete
  using (is_admin());


-- ── 3. INDEXES ────────────────────────────────────────────────

create index idx_command_centre_tasks_status    on public.command_centre_tasks(status);
create index idx_command_centre_tasks_due_date  on public.command_centre_tasks(due_date);
create index idx_command_centre_tasks_assigned  on public.command_centre_tasks(assigned_to_name);
