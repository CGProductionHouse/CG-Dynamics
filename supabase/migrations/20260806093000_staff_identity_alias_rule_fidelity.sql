-- Alias rule fidelity (PR 5 follow-up, found by live lifecycle testing).
--
-- Two real defects only a live run could surface:
--
-- 1. reconcile_staff_identity wrote match_rule = 'activation_derived', which
--    staff_identity_aliases_match_rule_check rejects. Acceptance failed
--    outright. Each derived form now records the rule it actually came from,
--    in the same vocabulary the PR 1 resolver uses, and keeps the text it was
--    derived from rather than always the display name.
--
-- 2. The first fix used a temp table; this database has a safe-update guard
--    that rejects an unqualified DELETE, so the forms are computed inline.

create or replace function public.cg_derived_identity_forms(p_profile_id uuid)
returns table(form text, source_text text, rule text)
language sql stable security definer set search_path to 'public' as $$
  with p as (select id, full_name, email from public.profiles where id = p_profile_id),
  forms as (
    select public.cg_normalise_identity(p.full_name) as form,
           p.full_name as source_text, 'exact_full_name' as rule from p
    union all
    select public.cg_normalise_identity(split_part(p.email, '@', 1)),
           split_part(p.email, '@', 1), 'exact_email_local' from p
    union all
    select public.cg_normalise_identity(split_part(btrim(p.full_name), ' ', 1)),
           split_part(btrim(p.full_name), ' ', 1), 'unique_first_token' from p
  )
  select f.form, min(f.source_text), min(f.rule)
  from forms f
  where f.form is not null
    -- A derived form is only usable if it does not already belong to somebody else.
    and not exists (select 1 from public.cg_staff_identity_candidates() c
                     where c.form = f.form and c.profile_id <> p_profile_id)
  group by f.form;
$$;

revoke all on function public.cg_derived_identity_forms(uuid) from public, anon;
grant execute on function public.cg_derived_identity_forms(uuid) to authenticated;

-- reconcile_staff_identity, reapplied in full so this file alone rebuilds it.

create or replace function public.reconcile_staff_identity(p_profile_id uuid, p_apply boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_profile public.profiles%rowtype;
  v_aliases_created integer := 0; v_links_created integer := 0;
  v_tasks_resolved integer := 0; v_reviews_closed integer := 0;
  v_alias_forms text[]; v_candidate_tasks uuid[];
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

  select array_agg(d.form) into v_alias_forms
    from public.cg_derived_identity_forms(p_profile_id) d;

  -- Every named segment must resolve to this same person; a task naming two
  -- people, or naming somebody unknown, stays unresolved for a manager.
  select array_agg(distinct t.id) into v_candidate_tasks
  from public.planner_tasks t
  where t.assignment_review_state = 'unresolved'
    and exists (
      select 1 from unnest(public.cg_split_identity_string(t.assigned_to_name)) seg
      cross join lateral public.cg_resolve_identity_segment(seg) r
      where r.profile_id = p_profile_id)
    and not exists (
      select 1 from unnest(public.cg_split_identity_string(t.assigned_to_name)) seg
      cross join lateral public.cg_resolve_identity_segment(seg) r2
      where r2.profile_id is distinct from p_profile_id);

  if not p_apply then
    return jsonb_build_object('dry_run', true, 'profile_id', p_profile_id,
      'full_name', v_profile.full_name,
      'alias_forms_to_create', coalesce(array_length(v_alias_forms, 1), 0),
      'tasks_to_reconcile', coalesce(array_length(v_candidate_tasks, 1), 0));
  end if;

  insert into public.staff_identity_aliases (profile_id, alias_text, alias_normalised, match_rule, created_by)
  select p_profile_id, d.source_text, d.form, d.rule, auth.uid()
  from public.cg_derived_identity_forms(p_profile_id) d
  on conflict (alias_normalised, profile_id) do nothing;
  get diagnostics v_aliases_created = row_count;

  -- The projection guard has a sanctioned escape hatch for reconciliation.
  perform set_config('app.planner_assignment_projection_write', 'on', true);

  insert into public.planner_task_assignees (task_id, profile_id, position)
  select t.id, p_profile_id,
         coalesce((select max(a.position) from public.planner_task_assignees a where a.task_id = t.id), -1)
           + row_number() over (partition by t.id order by t.id)
  from public.planner_tasks t
  where t.id = any(coalesce(v_candidate_tasks, '{}'::uuid[]))
    and not exists (select 1 from public.planner_task_assignees a
                    where a.task_id = t.id and a.profile_id = p_profile_id)
  on conflict do nothing;
  get diagnostics v_links_created = row_count;

  -- assigned_to_name, the imported text, is deliberately left untouched.
  update public.planner_tasks
  set assignment_review_state = 'ok', unresolved_assignee_names = '{}'::text[]
  where id = any(coalesce(v_candidate_tasks, '{}'::uuid[]))
    and assignment_review_state = 'unresolved';
  get diagnostics v_tasks_resolved = row_count;

  perform set_config('app.planner_assignment_projection_write', 'off', true);

  update public.staff_identity_review
  set status = 'resolved', resolved_profile_id = p_profile_id,
      reviewed_by = auth.uid(), reviewed_at = now(),
      note = coalesce(note || ' | ', '') || 'Resolved by account activation.'
  where status = 'open' and reason = 'no_match'
    and alias_normalised = any(coalesce(v_alias_forms, '{}'::text[]));
  get diagnostics v_reviews_closed = row_count;

  return jsonb_build_object('dry_run', false, 'profile_id', p_profile_id,
    'aliases_created', v_aliases_created, 'assignment_links_created', v_links_created,
    'tasks_moved_to_ok', v_tasks_resolved, 'reviews_closed', v_reviews_closed);
end;
$$;

notify pgrst, 'reload schema';
