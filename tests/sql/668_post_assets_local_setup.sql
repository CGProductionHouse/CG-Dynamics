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
