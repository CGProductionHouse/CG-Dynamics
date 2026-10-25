-- DISPOSABLE synthetic schema only. Actual RPC/assignment bodies and ledger migrations load in the test.
alter role service_role bypassrls;
alter table public.planner_boards add column slug text;
create table public.clients(id uuid primary key,name text,active boolean);
create table public.planner_buckets(id uuid primary key,board_id uuid,name text,archived_at timestamptz,sort_order integer);
alter table public.planner_tasks alter column id set default gen_random_uuid();
alter table public.planner_tasks add column bucket_id uuid, add column client_id uuid, add column client_name text,
  add column unresolved_assignee_names text[], add column priority text, add column source text,
  add column import_hash text, add column checklist jsonb, add column microsoft_task_id text,
  add column recurrence_rule text, add column recurrence_until date, add column start_date date,
  add column created_at timestamptz not null default now();
alter table public.planner_task_assignees add column position integer, add column assigned_by uuid;
create table public.company_calendar_events(
 id uuid primary key default gen_random_uuid(),title text,event_type text,start_at timestamptz,end_at timestamptz,
 all_day boolean,location text,notes text,assigned_to_name text,client_id uuid,client_name text,status text,
 microsoft_event_id text,microsoft_calendar_id text,microsoft_source_type text,microsoft_last_synced_at timestamptz,
 client_visible boolean not null default false,updated_at timestamptz not null default now(),
 superseded_by_event_id uuid,microsoft_source_removed_at timestamptz
);
create unique index fixture_calendar_source_identity on public.company_calendar_events(microsoft_calendar_id,microsoft_event_id)
where microsoft_calendar_id is not null and microsoft_event_id is not null;
alter table public.company_calendar_events enable row level security;
grant usage on schema public,auth to service_role;
grant select on public.profiles,public.clients to service_role;
grant select on public.planner_tasks,public.planner_task_assignees,public.planner_activity_log,public.notifications to service_role;
-- PostgreSQL requires UPDATE privilege even for SELECT FOR UPDATE; service role already owns this write path.
grant update on public.planner_tasks to service_role;
grant select,insert,update on public.company_calendar_events to service_role;
