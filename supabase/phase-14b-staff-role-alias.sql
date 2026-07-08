-- ============================================================
-- Phase 14b: Staff role alias
--
-- Adds `staff` as the first-class execution role while preserving the
-- existing `team` role for already-created accounts and invites.
-- Review in Supabase SQL editor before running. Additive only:
-- no data is deleted or rewritten.
--
-- Run order:
-- Run phase-14a-workforce-roles.sql first, then this file.
-- Do not run phase 14a again after this file unless you also rerun this file,
-- because phase 14a intentionally predates the `staff` role alias.
-- ============================================================

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'profiles'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'staff', 'team', 'client'));

do $$
declare
  constraint_name text;
begin
  select c.conname into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'client_invites'
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table public.client_invites drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.client_invites
  add constraint client_invites_role_check
  check (role in ('admin', 'manager', 'staff', 'team', 'client'));

create or replace function public.is_staff()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager', 'staff', 'team')
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- Verification queries to run manually after this file:
-- select role, count(*) from public.profiles group by role order by role;
-- select role, status, count(*) from public.client_invites group by role, status order by role, status;
-- select public.is_staff(), public.is_manager(), public.is_admin();
