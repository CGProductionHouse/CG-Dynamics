-- ============================================================
-- Phase 14a: Workforce roles
--
-- Adds the manager role for CG Dynamics workforce permissions.
-- Review in Supabase SQL editor before running. Additive only:
-- no data is deleted or modified except replacing role CHECK constraints
-- and helper functions.
--
-- Run order:
-- 1. Run this file first to add manager/global invite support and relax
--    client_invites.client_id for workforce invites.
-- 2. Run phase-14b-staff-role-alias.sql immediately after this file to add
--    the first-class `staff` role while preserving legacy `team`.
--
-- Rollback note:
-- This file intentionally replaces role CHECK constraints and helper
-- functions only. If a rollback is needed, restore the previous CHECK
-- constraint definitions and helper functions from the database backup or
-- migration history; do not delete profiles, invites or accepted user data.
-- ============================================================

-- Allow profiles.role = manager while preserving existing admin/team/client.
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
    and pg_get_constraintdef(c.oid) like '%role%admin%team%client%';

  if constraint_name is not null then
    execute format('alter table public.profiles drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'manager', 'team', 'client'));

-- Allow manager invites. Team/admin invites are global; client invites require
-- client_id in the app and claim flow.
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
    and pg_get_constraintdef(c.oid) like '%role%admin%team%client%';

  if constraint_name is not null then
    execute format('alter table public.client_invites drop constraint %I', constraint_name);
  end if;
end
$$;

alter table public.client_invites
  add constraint client_invites_role_check
  check (role in ('admin', 'manager', 'team', 'client'));

alter table public.client_invites
  alter column client_id drop not null;

-- Staff-level read access includes admin, manager and team.
create or replace function public.is_staff()
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'manager', 'team')
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

-- Keep invite claiming compatible with manager/team invites that have no
-- client_id. Client-role invites still link a client explicitly.
create or replace function public.claim_invite()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  user_email text;
  invite public.client_invites%rowtype;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    return;
  end if;

  update public.profiles
  set email = user_email
  where id = auth.uid()
    and (email is null or email = '');

  select * into invite
  from public.client_invites
  where lower(email) = lower(user_email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite.id is null then
    return;
  end if;

  update public.profiles
  set role = invite.role,
      client_id = case when invite.role = 'client' then invite.client_id else null end
  where id = auth.uid();

  update public.client_invites
  set status = 'accepted', accepted_at = now()
  where id = invite.id;
end;
$$;

grant execute on function public.claim_invite() to authenticated;

-- Keep the signup trigger aligned with manager/team invites. This covers the
-- first-account-create path before the app-side claim_invite RPC runs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  invite public.client_invites%rowtype;
begin
  select * into invite
  from public.client_invites
  where lower(email) = lower(new.email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  insert into public.profiles (id, full_name, email, role, client_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    coalesce(invite.role, 'client'),
    case when invite.role = 'client' then invite.client_id else null end
  );

  if invite.id is not null then
    update public.client_invites
    set status = 'accepted', accepted_at = now()
    where id = invite.id;
  end if;

  return new;
end;
$$;

-- Verification queries to run manually after phase 14a and 14b:
-- select conname, pg_get_constraintdef(oid)
-- from pg_constraint
-- where conrelid in ('public.profiles'::regclass, 'public.client_invites'::regclass)
--   and contype = 'c'
-- order by conrelid::regclass::text, conname;
--
-- select role, count(*) from public.profiles group by role order by role;
-- select role, status, count(*) from public.client_invites group by role, status order by role, status;
