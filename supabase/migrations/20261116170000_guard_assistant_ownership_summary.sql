-- PR #995 owns this narrow guard; PR #990 owns shared inactive-session policy work.
-- Preserve the existing manager policy, result contract, grants and historical data.
create or replace function public.assistant_ownership_review_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_conflict integer; v_unresolved integer; v_unassigned integer; v_examples jsonb;
begin
  if not coalesce(public.is_manager(), false)
     or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active = true) then
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
