-- ============================================================
-- CG Dynamics - Phase 3f user emails + client invite flow
-- Run this once in the Supabase SQL editor.
--
-- A) Store email on profiles (backfilled from auth.users) and keep
--    new signups' email saved automatically.
-- B) Add a client_invites table so an admin can pre-approve a client
--    email. When that person signs up or next logs in, their profile
--    is automatically linked to the invited client and role.
-- ============================================================

-- ── A. EMAIL ON PROFILES ─────────────────────────────────────

alter table profiles add column if not exists email text;

-- Backfill existing rows from auth.users.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');


-- ── B. CLIENT INVITES TABLE ──────────────────────────────────

create table if not exists client_invites (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  client_id   uuid not null references clients(id) on delete cascade,
  role        text not null default 'client' check (role in ('admin','team','client')),
  status      text not null default 'pending' check (status in ('pending','accepted')),
  created_by  uuid references profiles(id),
  created_at  timestamptz default now(),
  accepted_at timestamptz
);

-- Only one *pending* invite per email at a time (case-insensitive).
create unique index if not exists client_invites_pending_email_idx
  on client_invites (lower(email))
  where status = 'pending';

create index if not exists client_invites_email_idx
  on client_invites (lower(email));

alter table client_invites enable row level security;

-- Admin only: view/create/edit/delete invites (requirement D).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_invites'
      and policyname = 'client_invites: admin full access'
  ) then
    create policy "client_invites: admin full access"
      on client_invites for all
      using (is_admin())
      with check (is_admin());
  end if;
end
$$;


-- ── C. AUTO-LINK ON SIGNUP ───────────────────────────────────
-- Replaces the original handle_new_user so new profiles also store
-- email and pick up any pending invite for that email.

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
    invite.client_id
  );

  if invite.id is not null then
    update public.client_invites
    set status = 'accepted', accepted_at = now()
    where id = invite.id;
  end if;

  return new;
end;
$$;


-- ── D. AUTO-LINK ON LOGIN ────────────────────────────────────
-- Security-definer RPC the app calls after authentication so an
-- *existing* user who is invited later gets linked on their next
-- login. A user can only ever claim an invite for their own email.

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

  -- Keep the profile email in sync as a safety net.
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
  set role = invite.role, client_id = invite.client_id
  where id = auth.uid();

  update public.client_invites
  set status = 'accepted', accepted_at = now()
  where id = invite.id;
end;
$$;

grant execute on function public.claim_invite() to authenticated;
