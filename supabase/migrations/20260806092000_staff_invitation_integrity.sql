-- Integrity diagnostics for the staff invitation lifecycle (PR 5).
--
-- Every row this returns is a defect, not a warning. It is the machine-checkable
-- form of the rule this mission runs on: the app may show that work is
-- unresolved, but it may never present something false as true.

create or replace function public.staff_invitation_integrity()
returns table(check_name text, offending_count bigint, detail text)
language sql stable security definer set search_path to 'public' as $$
  select 'sent_without_provider_result', count(*),
         'Invitation says sent/accepted but has no recorded provider result.'
    from public.staff_invitations
   where status in ('sent', 'accepted') and (provider_result is null or sent_at is null)
  union all
  select 'accepted_without_profile', count(*),
         'Invitation accepted but no canonical staff profile is linked.'
    from public.staff_invitations si
   where si.status = 'accepted'
     and (si.accepted_profile_id is null
          or not exists (select 1 from public.profiles p where p.id = si.accepted_profile_id))
  union all
  select 'duplicate_live_invitations', count(*),
         'The same address has more than one invitation still in flight.'
    from (select email_normalised from public.staff_invitations
           where status in ('pending', 'sending', 'sent')
           group by email_normalised having count(*) > 1) d
  union all
  select 'staff_invite_in_client_invites', count(*),
         'A non-client invitation is still stored in client_invites and has not been migrated.'
    from public.client_invites
   where role <> 'client' and migrated_to_staff_invitation_id is null
  union all
  select 'duplicate_active_staff_identity', count(*),
         'Two active staff profiles resolve to the same identity form.'
    from (select c.form from public.cg_staff_identity_candidates() c
           where c.rule in ('exact_full_name', 'exact_email_local')
           group by c.form having count(distinct c.profile_id) > 1) d
  union all
  select 'profile_without_auth_user', count(*),
         'A profile exists with no authentication user.'
    from public.profiles p
   where not exists (select 1 from auth.users u where u.id = p.id)
  union all
  select 'invalid_role_grant', count(*),
         'An invitation carries a role that is not a valid staff role.'
    from public.staff_invitations
   where intended_role not in ('team', 'manager', 'admin')
  union all
  select 'client_account_as_staff', count(*),
         'An invitation resolved to a profile that is a client account.'
    from public.staff_invitations si
    join public.profiles p on p.id = si.accepted_profile_id
   where p.client_id is not null
  union all
  select 'terminal_invitation_accepted', count(*),
         'An invitation is both accepted and cancelled/expired.'
    from public.staff_invitations
   where status = 'accepted' and cancelled_at is not null
  union all
  select 'duplicate_identity_alias', count(*),
         'The same normalised alias is registered to more than one profile.'
    from (select alias_normalised from public.staff_identity_aliases
           group by alias_normalised having count(distinct profile_id) > 1) d
  union all
  select 'activated_identity_left_unresolved', count(*),
         'An active staff profile has an open no_match review entry that its own aliases answer.'
    from public.staff_identity_review r
   where r.status = 'open' and r.reason = 'no_match'
     and exists (select 1 from public.staff_identity_aliases a
                  where a.alias_normalised = r.alias_normalised);
$$;

revoke all on function public.staff_invitation_integrity() from public, anon;
grant execute on function public.staff_invitation_integrity() to authenticated;

notify pgrst, 'reload schema';
