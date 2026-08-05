-- Canonical ownership for notifications and Assistant context (PR 3B).
--
-- generate_due_assistant_notifications joined the canonical assignee table but
-- ignored PR 1's assignment_review_state and PR 2's supersession pointer. PR 1
-- created 1,370 canonical links, which made this WORSE: every link on an
-- unresolved or conflicted task became a person-specific notification candidate.
--
-- Measured on live data before this change (due-date window removed so the
-- ownership filter itself is what is being measured):
--   78 person-specific candidates across 50 distinct tasks
--   23 genuinely verified across 19 distinct tasks
--   33 unresolved   -> would have told someone a partly-known task was theirs
--   17 conflicted   -> would have told BOTH conflicting people it was theirs
--    8 superseded   -> duplicate rows PR 2 already retired
--   10 helper rows  -> a helper receiving an owner notification
--   CG TV VIDEO - RED OAK TV: 4 candidate notifications -> 0
--
-- The full function body is reapplied in the migration that shipped with this
-- change; see the deployed definition for the authoritative text. The gates it
-- adds to the person-specific block are:
--
--   from public.planner_tasks_canonical      (excludes archived + superseded)
--   and task.assignment_review_state = 'ok'  (PR 1 verification gate)
--   and NOT the person appearing in helper_names
--
-- plus a manager review alert so unresolved and conflicting ownership is
-- surfaced rather than silently dropped.

-- Manager-only ownership review summary for the management Assistant.
-- Ordinary staff never receive it: the function is manager-gated, so conflict
-- evidence about colleagues cannot leak into a personal Assistant.
create or replace function public.assistant_ownership_review_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_conflict integer; v_unresolved integer; v_unassigned integer; v_examples jsonb;
begin
  if not coalesce(public.is_manager(), false) then
    raise exception 'Manager access is required for the ownership review summary.'
      using errcode = 'insufficient_privilege';
  end if;

  select count(*) into v_conflict from public.planner_tasks_canonical where assignment_review_state = 'conflict';
  select count(*) into v_unresolved from public.planner_tasks_canonical where assignment_review_state = 'unresolved';
  select count(*) into v_unassigned
    from public.planner_tasks_canonical t
   where t.assignment_review_state = 'ok'
     and not exists (select 1 from public.planner_task_assignees a where a.task_id = t.id);

  select jsonb_agg(x) into v_examples from (
    select jsonb_build_object(
      'title', t.title, 'client', t.client_name, 'due', t.due_date,
      'state', t.assignment_review_state,
      'importedText', t.assigned_to_name,
      'unresolvedNames', t.unresolved_assignee_names,
      'helperEvidence', t.helper_names,
      'source', t.source,
      'plannerLinked', t.microsoft_task_id is not null,
      'canonicalLinks', (select jsonb_agg(p.full_name) from public.planner_task_assignees a
                          join public.profiles p on p.id = a.profile_id where a.task_id = t.id)
    ) x
    from public.planner_tasks_canonical t
    where t.assignment_review_state = 'conflict'
    order by t.due_date nulls last
    limit 10
  ) y;

  return jsonb_build_object(
    'conflicts', v_conflict,
    'needsAssignmentReview', v_unresolved,
    'unassigned', v_unassigned,
    'conflictExamples', coalesce(v_examples, '[]'::jsonb),
    'rule', 'Tasks in conflict or needing assignment review have NO verified owner. Never state that such a task belongs to a specific person; say it needs assignment review.'
  );
end;
$$;

revoke all on function public.assistant_ownership_review_summary() from public, anon;
grant execute on function public.assistant_ownership_review_summary() to authenticated, service_role;
