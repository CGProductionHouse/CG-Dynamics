-- Staff invitation acceptance, activation and generic identity reconciliation
-- (PR 5, part 2).
--
-- Acceptance must be idempotent: opening the link twice may not create a second
-- profile, a second alias, or a second assignment link. Every step below is
-- written so that running it again is a no-op.
--
-- Reconciliation reuses the PR 1 resolver (cg_resolve_identity_segment) and
-- names nobody. The same code path runs for every staff member, now and later.

-- ── Reconciliation, dry run and apply in one function ───────────────────────
--
-- p_apply = false returns exactly what would change and writes nothing.
-- Only UNAMBIGUOUS matches to this one profile are touched. Imported text is
-- preserved; a task that names two people, or names someone else, is left
-- alone for a manager.

create or replace function public.reconcile_staff_identity(
  p_profile_id uuid,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_profile public.profiles%rowtype;
  v_aliases_created integer := 0;
  v_links_created integer := 0;
  v_tasks_resolved integer := 0;
  v_reviews_closed integer := 0;
  v_alias_forms text[];
  v_candidate_tasks uuid[];
begin
  -- A manager may reconcile anyone; a person may reconcile only themselves,
  -- which is what happens during their own acceptance.
  if not (public.is_manager() or auth.uid() = p_profile_id) then
    raise exception using errcode = 'P0001', message = 'Manager access required.';
  end if;

  select * into v_profile from public.profiles where id = p_profile_id;
  if v_profile.id is null then
    raise exception using errcode = 'P0001', message = 'That profile does not exist.';
  end if;
  if not v_profile.is_active or v_profile.role not in ('admin', 'manager', 'team') then
    raise exception using errcode = 'P0001', message = 'Only an active staff profile can be reconciled.';
  end if;
  if v_profile.client_id is not null then
    raise exception using errcode = 'P0001', message = 'A client account cannot be used as a staff identity.';
  end if;

  -- Derived forms this person can be known by. Generic: full name, email local
  -- part, first token of the display name. No name is written in code.
  select array_agg(distinct f) into v_alias_forms
  from (
    select public.cg_normalise_identity(v_profile.full_name) as f
    union select public.cg_normalise_identity(split_part(v_profile.email, '@', 1))
    union select public.cg_normalise_identity(split_part(btrim(v_profile.full_name), ' ', 1))
  ) forms
  where f is not null;

  -- A derived form is only safe if it does not already belong to someone else.
  select array_agg(f) into v_alias_forms
  from unnest(coalesce(v_alias_forms, '{}'::text[])) f
  where not exists (
    select 1 from public.cg_staff_identity_candidates() c
    where c.form = f and c.profile_id <> p_profile_id
  );

  -- Imported segments that resolve to exactly this person and nobody else.
  -- cg_split_identity_string returns an array, so it is unnested rather than
  -- joined as a set-returning function.
  select array_agg(distinct t.id) into v_candidate_tasks
  from public.planner_tasks t
  where t.assignment_review_state = 'unresolved'
    and exists (
      select 1
      from unnest(public.cg_split_identity_string(t.assigned_to_name)) seg
      cross join lateral public.cg_resolve_identity_segment(seg) r
      where r.profile_id = p_profile_id)
    -- Every named segment must resolve to this same person; a task naming two
    -- people, or naming somebody unknown, stays unresolved for a manager.
    and not exists (
      select 1
      from unnest(public.cg_split_identity_string(t.assigned_to_name)) seg
      cross join lateral public.cg_resolve_identity_segment(seg) r2
      where r2.profile_id is distinct from p_profile_id);

  if not p_apply then
    return jsonb_build_object(
      'dry_run', true,
      'profile_id', p_profile_id,
      'full_name', v_profile.full_name,
      'alias_forms_to_create', coalesce(array_length(v_alias_forms, 1), 0),
      'tasks_to_reconcile', coalesce(array_length(v_candidate_tasks, 1), 0)
    );
  end if;

  -- 1. Aliases. Unique on (profile_id, alias_normalised), so re-running adds
  --    nothing.
  insert into public.staff_identity_aliases (profile_id, alias_text, alias_normalised, match_rule, created_by)
  select p_profile_id, v_profile.full_name, f, 'activation_derived', auth.uid()
  from unnest(coalesce(v_alias_forms, '{}'::text[])) f
  on conflict (alias_normalised, profile_id) do nothing;
  get diagnostics v_aliases_created = row_count;

  -- 2. Canonical assignment links. The projection guard has a sanctioned
  --    escape hatch for reconciliation writes.
  perform set_config('app.planner_assignment_projection_write', 'on', true);

  insert into public.planner_task_assignees (task_id, profile_id, position)
  select t.id, p_profile_id,
         coalesce((select max(a.position) from public.planner_task_assignees a where a.task_id = t.id), -1)
           + row_number() over (partition by t.id order by t.id)
  from public.planner_tasks t
  where t.id = any(coalesce(v_candidate_tasks, '{}'::uuid[]))
    and not exists (
      select 1 from public.planner_task_assignees a
      where a.task_id = t.id and a.profile_id = p_profile_id
    )
  on conflict do nothing;
  get diagnostics v_links_created = row_count;

  -- 3. Review state. assigned_to_name (the imported text) is left untouched.
  update public.planner_tasks
  set assignment_review_state = 'ok',
      unresolved_assignee_names = '{}'::text[]
  where id = any(coalesce(v_candidate_tasks, '{}'::uuid[]))
    and assignment_review_state = 'unresolved';
  get diagnostics v_tasks_resolved = row_count;

  perform set_config('app.planner_assignment_projection_write', 'off', true);

  -- 4. Close the review queue entries this activation answers.
  update public.staff_identity_review
  set status = 'resolved', resolved_profile_id = p_profile_id,
      reviewed_by = auth.uid(), reviewed_at = now(),
      note = coalesce(note || ' | ', '') || 'Resolved by account activation.'
  where status = 'open'
    and reason = 'no_match'
    and alias_normalised = any(coalesce(v_alias_forms, '{}'::text[]));
  get diagnostics v_reviews_closed = row_count;

  return jsonb_build_object(
    'dry_run', false,
    'profile_id', p_profile_id,
    'aliases_created', v_aliases_created,
    'assignment_links_created', v_links_created,
    'tasks_moved_to_ok', v_tasks_resolved,
    'reviews_closed', v_reviews_closed
  );
end;
$$;

revoke all on function public.reconcile_staff_identity(uuid, boolean) from public, anon;
grant execute on function public.reconcile_staff_identity(uuid, boolean) to authenticated;

-- ── Acceptance ──────────────────────────────────────────────────────────────

create or replace function public.accept_staff_invitation(requested_full_name text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_email text; v_has_password boolean;
  v_invite public.staff_invitations%rowtype;
  v_profile_id uuid := auth.uid();
begin
  select email, coalesce(encrypted_password, '') <> '' into v_email, v_has_password
  from auth.users where id = auth.uid();
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Authentication required.';
  end if;
  if not v_has_password then
    raise exception using errcode = 'P0001', message = 'Set a password before accepting this invitation.';
  end if;

  -- Idempotency: if this account already accepted, return the same answer
  -- rather than doing the work twice.
  select * into v_invite from public.staff_invitations
   where email_normalised = lower(btrim(v_email)) and status = 'accepted'
   order by accepted_at desc limit 1;
  if v_invite.id is not null then
    return jsonb_build_object('invitation_id', v_invite.id, 'role', v_invite.intended_role,
      'profile_id', v_invite.accepted_profile_id, 'already_accepted', true);
  end if;

  select * into v_invite from public.staff_invitations
   where email_normalised = lower(btrim(v_email))
     and status in ('pending', 'sending', 'sent')
   order by created_at desc limit 1 for update;

  if v_invite.id is null then
    raise exception using errcode = 'P0001', message = 'No staff invitation matches this account.';
  end if;
  if v_invite.expires_at <= now() then
    update public.staff_invitations set status = 'expired' where id = v_invite.id;
    raise exception using errcode = 'P0001', message = 'This invitation has expired. Ask a manager to send a new one.';
  end if;

  -- Exactly one canonical staff profile, keyed by the Auth user id.
  insert into public.profiles (id, full_name, email, role, client_id, is_active)
  values (v_profile_id,
          coalesce(nullif(btrim(requested_full_name), ''), v_invite.intended_full_name),
          v_email, v_invite.intended_role, null, true)
  on conflict (id) do update
  set full_name = coalesce(nullif(btrim(requested_full_name), ''), v_invite.intended_full_name, profiles.full_name),
      email = v_email,
      -- The role comes from the invitation, never from anything the invitee sends.
      role = v_invite.intended_role,
      client_id = null,
      is_active = true;

  update public.staff_invitations
  set status = 'accepted', accepted_at = now(), auth_user_id = v_profile_id,
      accepted_profile_id = v_profile_id,
      sent_at = coalesce(sent_at, now()),
      provider_result = coalesce(provider_result,
        jsonb_build_object('inferred', 'accepted without recorded provider result')),
      audit = audit || jsonb_build_object('accepted_at', now())
  where id = v_invite.id;

  -- Older live invitations for the same person are now history.
  update public.staff_invitations
  set status = 'cancelled', cancelled_at = now(),
      audit = audit || jsonb_build_object('cancelled_reason', 'superseded by acceptance')
  where email_normalised = lower(btrim(v_email))
    and id <> v_invite.id
    and status in ('pending', 'sending', 'sent');

  return jsonb_build_object(
    'invitation_id', v_invite.id,
    'role', v_invite.intended_role,
    'profile_id', v_profile_id,
    'already_accepted', false,
    'reconciliation', public.reconcile_staff_identity(v_profile_id, true)
  );
end;
$$;

revoke all on function public.accept_staff_invitation(text) from public, anon;
grant execute on function public.accept_staff_invitation(text) to authenticated;

-- ── Cancel and expire ───────────────────────────────────────────────────────

create or replace function public.cancel_staff_invitation(p_invitation_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v_invite public.staff_invitations%rowtype;
begin
  if not public.is_manager() then
    raise exception using errcode = 'P0001', message = 'Manager access required.';
  end if;
  select * into v_invite from public.staff_invitations where id = p_invitation_id for update;
  if v_invite.id is null then
    raise exception using errcode = 'P0001', message = 'That invitation does not exist.';
  end if;
  if v_invite.status = 'accepted' then
    raise exception using errcode = 'P0001', message = 'An accepted invitation cannot be cancelled.';
  end if;
  if v_invite.status = 'cancelled' then
    return jsonb_build_object('invitation_id', v_invite.id, 'status', 'cancelled', 'changed', false);
  end if;

  update public.staff_invitations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
      audit = audit || jsonb_build_object('cancelled_reason', coalesce(p_reason, 'cancelled by manager'))
  where id = p_invitation_id;

  return jsonb_build_object('invitation_id', v_invite.id, 'status', 'cancelled', 'changed', true);
end;
$$;

revoke all on function public.cancel_staff_invitation(uuid, text) from public, anon;
grant execute on function public.cancel_staff_invitation(uuid, text) to authenticated;

-- Sweep: anything past its expiry that nobody accepted becomes 'expired'. Safe
-- to run repeatedly.
create or replace function public.expire_staff_invitations()
returns integer language plpgsql security definer set search_path to 'public' as $$
declare v_count integer;
begin
  update public.staff_invitations
  set status = 'expired', audit = audit || jsonb_build_object('expired_at', now())
  where status in ('pending', 'sending', 'sent') and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_staff_invitations() from public, anon;
grant execute on function public.expire_staff_invitations() to authenticated;

notify pgrst, 'reload schema';
