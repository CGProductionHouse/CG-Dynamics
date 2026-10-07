-- Synthetic schema prerequisites only; never execute against production.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
create table public.clients(id uuid primary key);
create table public.profiles(id uuid primary key, client_id uuid, role text, is_active boolean);
create table public.monthly_deliverables(id uuid primary key, client_id uuid references public.clients(id), month date,
  scheduled_date date, title text, deliverable_type text, archived_at timestamptz,
  sent_to_client_at timestamptz, client_approved_at timestamptz, posted_at timestamptz);
create table public.company_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_type text not null default 'internal'
    check (event_type in ('meeting','shoot','content_run','client_event','internal','deadline')),
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  location text,
  notes text,
  assigned_to_name text,
  status text not null default 'planned'
    check (status in ('planned','confirmed','completed','cancelled')),
  linked_deliverable_id uuid,
  linked_task_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_visible boolean not null default false,
  superseded_by_event_id uuid
);
create table public.content_runs (
  id uuid primary key default gen_random_uuid(),
  calendar_event_id uuid references public.company_calendar_events(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null
);
create table public.content_guidelines (
  id uuid primary key default gen_random_uuid(),
  content_run_id uuid references public.content_runs(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'draft',
  client_published_at timestamptz
);