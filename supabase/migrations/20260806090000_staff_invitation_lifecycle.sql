-- Staff invitation lifecycle (PR 5).
--
-- Staff invitations were being stored in public.client_invites, a table built
-- for client portal access. That table has only two states (pending|accepted),
-- no record of whether the Auth invitation was ever created, and no way to
-- express a failed, cancelled or expired invitation. When delivery failed the
-- row stayed 'pending', so the UI could not tell "waiting for them" apart from
-- "this never sent". That is the exact class of confident-but-false display
-- this mission exists to remove.
--
-- Client and staff invitations stay separate systems. client_invites keeps its
-- client rows untouched; staff rows are migrated out with their history intact.

-- ── State machine ───────────────────────────────────────────────────────────
--
--   pending  ─send→ sending ─ok→ sent ─accept→ accepted
--                      │              │
--                      └─error→ failed└─timeout→ expired
--   any non-terminal ─cancel→ cancelled
--   failed ─retry→ sending      (retry_count += 1)
--   sent   ─resend→ sending     (new row, previous_invitation_id set)
--
-- 'sent' means an Auth invitation was created AND the provider accepted it.
-- Nothing may write 'sent' without provider evidence — enforced by a CHECK.

create table if not exists public.staff_invitations (
  id uuid primary key default gen_random_uuid(),

  -- Identity of the invitee.
  email text not null,
  email_normalised text generated always as (lower(btrim(email))) stored,
  intended_full_name text,
  intended_role text not null check (intended_role in ('team', 'manager', 'admin')),

  -- Lifecycle.
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'accepted', 'failed', 'expired', 'cancelled')),

  -- Provenance and audit.
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,

  -- Auth / delivery evidence.
  auth_user_id uuid,
  redirect_to text,
  provider_result jsonb,
  failure_code text,
  failure_reason text,
  retry_count integer not null default 0 check (retry_count >= 0),
  previous_invitation_id uuid references public.staff_invitations(id) on delete set null,

  -- Result of acceptance.
  accepted_profile_id uuid references public.profiles(id) on delete set null,
  audit jsonb not null default '{}'::jsonb,

  -- A row may only claim it was sent if there is provider evidence for it.
  constraint staff_invitations_sent_needs_evidence check (
    status not in ('sent', 'accepted')
    or (sent_at is not null and provider_result is not null)
  ),
  -- A failed row must say why, in words an operator can act on.
  constraint staff_invitations_failure_needs_reason check (
    status <> 'failed' or (failure_code is not null and failure_reason is not null)
  ),
  -- An accepted row must name the canonical profile it produced.
  constraint staff_invitations_accepted_needs_profile check (
    status <> 'accepted' or (accepted_profile_id is not null and accepted_at is not null)
  )
);

-- One live invitation per person. Terminal states (accepted, failed, expired,
-- cancelled) are history and may repeat; only one may be in flight.
create unique index if not exists staff_invitations_one_live_per_email
  on public.staff_invitations (email_normalised)
  where status in ('pending', 'sending', 'sent');

create index if not exists staff_invitations_status_idx on public.staff_invitations (status, created_at desc);
create index if not exists staff_invitations_email_idx on public.staff_invitations (email_normalised);

comment on table public.staff_invitations is
  'Staff invitation lifecycle. Separate from client_invites by design. A row may only claim status sent/accepted when provider evidence exists.';

create or replace function public.touch_staff_invitation()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists staff_invitations_touch on public.staff_invitations;
create trigger staff_invitations_touch before update on public.staff_invitations
  for each row execute function public.touch_staff_invitation();

-- ── Access control ──────────────────────────────────────────────────────────
-- Only managers and admins may see or change staff invitations. Ordinary staff
-- and client users have no access at all; there is deliberately no self-read
-- policy, because an invitee reads their invitation through the SECURITY
-- DEFINER acceptance RPC, not through the table.

alter table public.staff_invitations enable row level security;
alter table public.staff_invitations force row level security;

drop policy if exists staff_invitations_manager_read on public.staff_invitations;
create policy staff_invitations_manager_read on public.staff_invitations
  for select using (public.is_manager());

drop policy if exists staff_invitations_manager_write on public.staff_invitations;
create policy staff_invitations_manager_write on public.staff_invitations
  for all using (public.is_manager()) with check (public.is_manager());

-- ── Migrate the staff rows out of client_invites ────────────────────────────
--
-- Every historical staff row is preserved with a truthful state:
--   * already accepted, with a real profile   -> 'accepted'
--   * already accepted, but NO Auth user      -> 'failed' (it never completed)
--   * pending with an undeliverable address   -> 'failed' (it can never send)
--   * pending otherwise                       -> 'pending'
-- Nothing is deleted. client_invites keeps its rows; a marker column records
-- that the staff system now owns them so neither side double-counts.

alter table public.client_invites
  add column if not exists migrated_to_staff_invitation_id uuid references public.staff_invitations(id) on delete set null;

comment on column public.client_invites.migrated_to_staff_invitation_id is
  'Set when a staff invitation was wrongly stored here and has been migrated to public.staff_invitations. The row is retained as audit evidence and must never be sent again.';

with legacy as (
  select
    ci.id as legacy_id,
    lower(btrim(ci.email)) as email,
    -- 'team' is this database''s spelling of the staff role; 'staff' is the
    -- other spelling used by older code. Both map to 'team'.
    case
      when ci.role in ('admin', 'manager') then ci.role
      else 'team'
    end as intended_role,
    ci.created_by,
    ci.created_at,
    ci.accepted_at,
    ci.status as legacy_status,
    au.id as auth_user_id,
    p.id as profile_id,
    -- An address whose domain is not a real deliverable company domain, judged
    -- generically: the local part matches a company address but the domain
    -- does not match ANY domain already proven to receive mail.
    exists (
      select 1 from auth.users good
      where lower(split_part(good.email, '@', 1)) = lower(split_part(ci.email, '@', 1))
        and lower(split_part(good.email, '@', 2)) <> lower(split_part(ci.email, '@', 2))
    ) as local_part_seen_on_another_domain,
    exists (
      select 1 from auth.users any_user
      where lower(split_part(any_user.email, '@', 2)) = lower(split_part(ci.email, '@', 2))
    ) as domain_ever_delivered
  from public.client_invites ci
  left join auth.users au on lower(au.email) = lower(btrim(ci.email))
  left join public.profiles p on p.id = au.id
  where ci.role <> 'client'
    and ci.migrated_to_staff_invitation_id is null
)
insert into public.staff_invitations (
  email, intended_role, status, invited_by, created_at, sent_at, accepted_at,
  expires_at, auth_user_id, accepted_profile_id, provider_result,
  failure_code, failure_reason, audit
)
select
  l.email,
  l.intended_role,
  case
    when l.legacy_status = 'accepted' and l.profile_id is not null then 'accepted'
    when l.legacy_status = 'accepted' and l.profile_id is null then 'failed'
    when not l.domain_ever_delivered then 'failed'
    else 'pending'
  end,
  l.created_by,
  l.created_at,
  case when l.legacy_status = 'accepted' and l.profile_id is not null then l.created_at end,
  case when l.legacy_status = 'accepted' and l.profile_id is not null then l.accepted_at end,
  coalesce(l.accepted_at, l.created_at) + interval '14 days',
  l.auth_user_id,
  l.profile_id,
  case
    when l.legacy_status = 'accepted' and l.profile_id is not null
    then jsonb_build_object('source', 'legacy_client_invites', 'evidence', 'auth user and profile exist')
  end,
  case
    when l.legacy_status = 'accepted' and l.profile_id is null then 'legacy_accepted_without_account'
    when not l.domain_ever_delivered then 'undeliverable_domain'
  end,
  case
    when l.legacy_status = 'accepted' and l.profile_id is null
      then 'This invitation was recorded as accepted but no account was ever created. It did not complete and must be sent again.'
    when not l.domain_ever_delivered
      then 'The email domain has never delivered mail for this workspace and looks mistyped. Correct the address and invite again.'
  end,
  jsonb_build_object(
    'migrated_from', 'client_invites',
    'legacy_invite_id', l.legacy_id,
    'legacy_status', l.legacy_status,
    'legacy_role', l.intended_role,
    'local_part_seen_on_another_domain', l.local_part_seen_on_another_domain,
    'migrated_at', now()
  )
from legacy l
on conflict do nothing;

update public.client_invites ci
set migrated_to_staff_invitation_id = si.id
from public.staff_invitations si
where ci.role <> 'client'
  and ci.migrated_to_staff_invitation_id is null
  and (si.audit ->> 'legacy_invite_id')::uuid = ci.id;

-- A migrated staff row must never be picked up by the client acceptance path
-- again. Its own status stays truthful (it really was pending in the old
-- system); the acceptance RPCs below simply stop looking at migrated rows.

-- ── Keep the client acceptance path off migrated staff rows ─────────────────
-- Same bodies as before, with one added filter. A staff invitation is now
-- accepted through accept_staff_invitation, never through accept_invite.

create or replace function public.accept_invite(requested_full_name text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  user_email text;
  has_password boolean;
  invite public.client_invites%rowtype;
  resolved_client_id uuid;
begin
  select email, coalesce(encrypted_password, '') <> '' into user_email, has_password
  from auth.users where id = auth.uid();

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
    and migrated_to_staff_invitation_id is null
  order by created_at desc limit 1 for update;

  if invite.id is null then
    if exists (
      select 1 from public.client_invites
      where lower(email) = lower(user_email) and status = 'accepted'
        and migrated_to_staff_invitation_id is null
    ) then
      raise exception using errcode = 'P0001', message = 'This invitation has already been used.';
    end if;
    raise exception using errcode = 'P0001', message = 'No pending invitation matches this account.';
  end if;

  if invite.role = 'client' then
    select id into resolved_client_id from public.clients
     where id = invite.client_id and active = true;
    if resolved_client_id is null then
      raise exception using errcode = 'P0001', message = 'The client linked to this invitation is missing or inactive.';
    end if;
  else
    resolved_client_id := null;
  end if;

  insert into public.profiles (id, full_name, email, role, client_id)
  values (auth.uid(), nullif(trim(requested_full_name), ''), user_email, invite.role, resolved_client_id)
  on conflict (id) do update
  set full_name = coalesce(nullif(trim(requested_full_name), ''), profiles.full_name),
      email = user_email, role = invite.role, client_id = resolved_client_id;

  update public.client_invites set status = 'accepted', accepted_at = now() where id = invite.id;

  return jsonb_build_object('invite_id', invite.id, 'role', invite.role, 'client_id', resolved_client_id);
end;
$$;

create or replace function public.validate_pending_invite()
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  user_email text;
  invite public.client_invites%rowtype;
  staff_invite public.staff_invitations%rowtype;
begin
  select email into user_email from auth.users where id = auth.uid();
  if user_email is null then
    raise exception using errcode = 'P0001', message = 'Authentication required.';
  end if;

  -- A staff invitation is validated by its own function; report it as valid
  -- here so the shared signup screen does not reject a real staff invitee.
  select * into staff_invite from public.staff_invitations
   where email_normalised = lower(btrim(user_email))
     and status in ('pending', 'sending', 'sent')
     and expires_at > now()
   order by created_at desc limit 1;
  if staff_invite.id is not null then
    return jsonb_build_object('invite_id', staff_invite.id, 'kind', 'staff');
  end if;

  select * into invite from public.client_invites
   where lower(email) = lower(user_email) and status = 'pending'
     and migrated_to_staff_invitation_id is null
   order by created_at desc limit 1;

  if invite.id is null then
    if exists (
      select 1 from public.client_invites
      where lower(email) = lower(user_email) and status = 'accepted'
        and migrated_to_staff_invitation_id is null
    ) then
      raise exception using errcode = 'P0001', message = 'This invitation has already been used.';
    end if;
    raise exception using errcode = 'P0001', message = 'No pending invitation matches this account.';
  end if;

  if invite.role = 'client' and not exists (
    select 1 from public.clients where id = invite.client_id and active = true
  ) then
    raise exception using errcode = 'P0001', message = 'The client linked to this invitation is missing or inactive.';
  end if;

  return jsonb_build_object('invite_id', invite.id, 'kind', 'client');
end;
$$;

notify pgrst, 'reload schema';
