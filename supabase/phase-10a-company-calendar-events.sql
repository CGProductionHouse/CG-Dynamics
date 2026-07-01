-- ============================================================
-- Phase 10a: Company Calendar Events
-- Meetings, shoots, content runs, client events, internal
-- deadlines and staff/internal events.
--
-- This is the Company Events Calendar layer (Calendar B).
-- It is separate from the Production Package Calendar (Calendar A)
-- which uses monthly_deliverables.
--
-- Safe to run on production.
--
-- Run via Supabase SQL editor:
--   psql $SUPABASE_DB_URL -f supabase/phase-10a-company-calendar-events.sql
-- ============================================================


-- ── 1. TABLE ─────────────────────────────────────────────────

create table public.company_calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  event_type            text not null default 'internal'
                        check (event_type in (
                          'meeting',
                          'shoot',
                          'content_run',
                          'client_event',
                          'internal',
                          'deadline'
                        )),
  client_id             uuid references public.clients(id) on delete set null,
  client_name           text,
  start_at              timestamptz not null,
  end_at                timestamptz,
  all_day               boolean not null default false,
  location              text,
  notes                 text,
  assigned_to_name      text,
  status                text not null default 'planned'
                        check (status in (
                          'planned',
                          'confirmed',
                          'completed',
                          'cancelled'
                        )),
  linked_deliverable_id uuid,
  linked_task_id        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Auto-update updated_at on row change
create or replace function public.update_company_calendar_events_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_company_calendar_events_updated_at
  before update on public.company_calendar_events
  for each row execute function public.update_company_calendar_events_updated_at();


-- ── 2. ROW-LEVEL SECURITY ─────────────────────────────────────

alter table public.company_calendar_events enable row level security;

-- Staff (admin + team) can read all events
create policy "company_calendar_events: staff select"
  on public.company_calendar_events for select
  using (is_staff());

-- Staff can insert events
create policy "company_calendar_events: staff insert"
  on public.company_calendar_events for insert
  with check (is_staff());

-- Staff can update events (admin can update any; team can update any)
create policy "company_calendar_events: staff update"
  on public.company_calendar_events for update
  using (is_staff());

-- Only admin can delete events
create policy "company_calendar_events: admin delete"
  on public.company_calendar_events for delete
  using (is_admin());


-- ── 3. INDEXES ────────────────────────────────────────────────

create index idx_company_calendar_events_start_at  on public.company_calendar_events(start_at);
create index idx_company_calendar_events_client_id on public.company_calendar_events(client_id);
create index idx_company_calendar_events_event_type on public.company_calendar_events(event_type);
create index idx_company_calendar_events_status    on public.company_calendar_events(status);
