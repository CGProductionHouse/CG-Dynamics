-- ============================================================
-- Phase 19a: Secure admin invitations
--
-- Keeps public signup disabled while allowing the admin-only Edge Function
-- to create Supabase Auth invitations. Auth Admin creates auth.users before
-- the recipient accepts the email, so the existing trigger must leave that
-- invite pending until the recipient sets a password and claims it.
--
-- Apply this migration before deploying admin-invite-user.
-- No invite, profile, client or Auth rows are deleted.
--
-- Rollback:
-- 1. Drop public.accept_invite(text) and public.validate_pending_invite().
-- 2. Restore public.handle_new_user() and the authenticated claim_invite grant
--    from phase-14a-workforce-roles.sql.
-- 3. Do not delete invitation/profile data created while this phase was live.
-- ============================================================

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
    case when new.invited_at is not null then 'client' else coalesce(invite.role, 'client') end,
    case
      when new.invited_at is not null then null
      when invite.role = 'client' then invite.client_id
      else null
    end
  )
  on conflict (id) do update
  set email = excluded.email;

  -- A normal signup is complete when auth.users is inserted. An Auth Admin
  -- invitation is not complete yet: invited_at is populated before the user
  -- opens the email and chooses a password.
  if invite.id is not null and new.invited_at is null then
    update public.client_invites
    set status = 'accepted', accepted_at = now()
    where id = invite.id;
  end if;

  return new;
end;
$$;

create or replace function public.validate_pending_invite()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  user_email text;
  invite public.client_invites%rowtype;
begin
  select email into user_email
  from auth.users
  where id = auth.uid();

  if user_email is null then
    raise exception using errcode = 'P0001', message = 'Authentication required.';
  end if;

  select * into invite
  from public.client_invites
  where lower(email) = lower(user_email)
    and status = 'pending'
  order by created_at desc
  limit 1;

  if invite.id is null then
    if exists (
      select 1 from public.client_invites
      where lower(email) = lower(user_email)
        and status = 'accepted'
    ) then
      raise exception using errcode = 'P0001', message = 'This invitation has already been used.';
    end if;
    raise exception using errcode = 'P0001', message = 'No pending invitation matches this account.';
  end if;

  if invite.role = 'client' and not exists (
    select 1 from public.clients
    where id = invite.client_id
      and active = true
  ) then
    raise exception using errcode = 'P0001', message = 'The client linked to this invitation is missing or inactive.';
  end if;

  return jsonb_build_object('invite_id', invite.id);
end;
$$;

create or replace function public.accept_invite(requested_full_name text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  user_email text;
  has_password boolean;
  invite public.client_invites%rowtype;
  resolved_client_id uuid;
begin
  select email, coalesce(encrypted_password, '') <> '' into user_email, has_password
  from auth.users
  where id = auth.uid();

  if user_email is null then
    raise exception using errcode = 'P0001', message = 'Authentication required.';
  end if;

  if not has_password then
    raise exception using errcode = 'P0001', message = 'Set a password before accepting this invitation.';
  end if;

  select * into invite
  from public.client_invites
  where lower(email) = lower(user_email)
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if invite.id is null then
    if exists (
      select 1 from public.client_invites
      where lower(email) = lower(user_email)
        and status = 'accepted'
    ) then
      raise exception using errcode = 'P0001', message = 'This invitation has already been used.';
    end if;
    raise exception using errcode = 'P0001', message = 'No pending invitation matches this account.';
  end if;

  if invite.role = 'client' then
    select id into resolved_client_id
    from public.clients
    where id = invite.client_id
      and active = true;

    if resolved_client_id is null then
      raise exception using errcode = 'P0001', message = 'The client linked to this invitation is missing or inactive.';
    end if;
  else
    resolved_client_id := null;
  end if;

  insert into public.profiles (id, full_name, email, role, client_id)
  values (
    auth.uid(),
    nullif(trim(requested_full_name), ''),
    user_email,
    invite.role,
    resolved_client_id
  )
  on conflict (id) do update
  set full_name = coalesce(nullif(trim(requested_full_name), ''), profiles.full_name),
      email = user_email,
      role = invite.role,
      client_id = resolved_client_id;

  update public.client_invites
  set status = 'accepted', accepted_at = now()
  where id = invite.id;

  return jsonb_build_object(
    'invite_id', invite.id,
    'role', invite.role,
    'client_id', resolved_client_id
  );
end;
$$;

revoke all on function public.accept_invite(text) from public;
revoke all on function public.accept_invite(text) from anon;
grant execute on function public.accept_invite(text) to authenticated;
revoke all on function public.validate_pending_invite() from public;
revoke all on function public.validate_pending_invite() from anon;
grant execute on function public.validate_pending_invite() to authenticated;
-- claim_invite() defaults to an EXECUTE grant to PUBLIC (and anon), so revoking
-- only from authenticated is a no-op — authenticated still inherits via PUBLIC.
-- Revoke from PUBLIC and anon too so the old self-claim path is truly closed;
-- service_role and postgres keep execute for any server-side use.
revoke execute on function public.claim_invite() from public;
revoke execute on function public.claim_invite() from anon;
revoke execute on function public.claim_invite() from authenticated;

-- Manual verification after applying:
-- select pg_get_functiondef('public.handle_new_user()'::regprocedure);
-- select pg_get_functiondef('public.validate_pending_invite()'::regprocedure);
-- select pg_get_functiondef('public.accept_invite(text)'::regprocedure);
-- select role, status, count(*) from public.client_invites group by role, status order by role, status;
