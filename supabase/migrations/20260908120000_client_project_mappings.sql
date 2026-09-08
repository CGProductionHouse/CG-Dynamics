-- 20260908120000_client_project_mappings.sql
-- Maps each canonical CG Dynamics client to one ChatGPT Project.
-- Supports the direct CG Dynamics ↔ ChatGPT client bridge (Issue #241).
--
-- The bridge: CG Dynamics is the single source of truth for client intelligence.
-- ChatGPT Projects contain durable behavioural instructions and retrieve current
-- client truth when they need it. No duplicate manual maintenance.

begin;

-- ── 1. Client-to-Project mapping ─────────────────────────────────────────
-- One mapping per client (unique on client_id). A client may not yet have a
-- mapped Project (sync_state = 'needs_setup').

create table if not exists public.client_project_mappings (
  id                    uuid primary key default gen_random_uuid(),
  client_id             uuid not null references public.clients(id) on delete cascade unique,
  chatgpt_project_url   text,           -- human-open link to the ChatGPT Project
  project_name          text,           -- display name for the Project
  sync_state            text not null default 'needs_setup'
                          check (sync_state in ('needs_setup', 'connected', 'stale', 'disconnected')),
  last_context_retrieved_at timestamptz, -- last time get-client-context was called
  last_instructions_at  timestamptz,     -- last time project instructions were generated
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.client_project_mappings is
  'One ChatGPT Project per canonical client. CG Dynamics is the source of truth; the Project retrieves current intelligence at task time.';

comment on column public.client_project_mappings.sync_state is
  'needs_setup: no Project URL yet. connected: Project URL set and instructions current. stale: instructions outdated. disconnected: Project removed.';

-- RLS: admin/manager full access; staff read-only; client-role no access.
alter table public.client_project_mappings enable row level security;

create policy client_project_mappings_admin_manager_all
  on public.client_project_mappings
  for all
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ))
  with check (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager')
  ));

create policy client_project_mappings_staff_read
  on public.client_project_mappings
  for select
  using (exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
  ));

-- Updated_at trigger
create or replace function public.update_client_project_mappings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_client_project_mappings_updated_at on public.client_project_mappings;
create trigger set_client_project_mappings_updated_at
  before update on public.client_project_mappings
  for each row
  execute function public.update_client_project_mappings_updated_at();

commit;
