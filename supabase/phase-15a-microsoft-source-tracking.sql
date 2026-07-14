-- ============================================================
-- Phase 15a: Microsoft 365 source tracking
--
-- Additive preparation for preview-first, one-way Planner and Outlook
-- imports. Existing rows remain valid and no data is imported or changed.
--
-- DO NOT RUN LIVE without review in the Supabase SQL editor.
-- ============================================================

alter table public.planner_tasks
  add column if not exists microsoft_source_type text,
  add column if not exists microsoft_plan_id text,
  add column if not exists microsoft_bucket_id text,
  add column if not exists microsoft_task_id text,
  add column if not exists microsoft_last_synced_at timestamptz;

alter table public.monthly_deliverables
  add column if not exists microsoft_source_type text,
  add column if not exists microsoft_plan_id text,
  add column if not exists microsoft_bucket_id text,
  add column if not exists microsoft_task_id text,
  add column if not exists microsoft_last_synced_at timestamptz;

alter table public.company_calendar_events
  add column if not exists microsoft_source_type text,
  add column if not exists microsoft_calendar_id text,
  add column if not exists microsoft_event_id text,
  add column if not exists microsoft_last_synced_at timestamptz;

create unique index if not exists planner_tasks_microsoft_source_key
  on public.planner_tasks (microsoft_plan_id, microsoft_task_id)
  where microsoft_plan_id is not null and microsoft_task_id is not null;

create unique index if not exists monthly_deliverables_microsoft_source_key
  on public.monthly_deliverables (microsoft_plan_id, microsoft_task_id)
  where microsoft_plan_id is not null and microsoft_task_id is not null;

create unique index if not exists company_calendar_events_microsoft_source_key
  on public.company_calendar_events (microsoft_calendar_id, microsoft_event_id)
  where microsoft_calendar_id is not null and microsoft_event_id is not null;

comment on column public.planner_tasks.microsoft_source_type is
  'Microsoft source kind, for example planner_task. Never stores credentials.';
comment on column public.monthly_deliverables.microsoft_source_type is
  'Microsoft source kind, for example planner_client_social. Never stores credentials.';
comment on column public.company_calendar_events.microsoft_source_type is
  'Microsoft source kind, for example outlook_event. Never stores credentials.';
comment on column public.company_calendar_events.microsoft_event_id is
  'Immutable Microsoft Graph event ID requested with Prefer: IdType="ImmutableId".';

-- Rollback guidance:
-- Drop the three partial indexes first, then drop only the microsoft_* columns
-- above. Do not delete Planner tasks, monthly deliverables or calendar events.
