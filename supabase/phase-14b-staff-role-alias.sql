-- ============================================================
-- Phase 14b: Staff role alias
--
-- Adds `staff` as the first-class execution role while preserving the
-- existing `team` role for already-created accounts and invites.
-- Review in Supabase SQL editor before running. Additive only:
-- no data is deleted or rewritten.
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
