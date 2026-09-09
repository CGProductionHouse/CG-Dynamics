-- MCP connector: create recurring task template through the canonical assistant action layer.
-- Prepared only. Do not apply to production without explicit CA approval.

create or replace function public.create_assistant_recurring_task(
  p_title text,
  p_recurrence_rule text,
  p_recurrence_until date default null,
  p_assignee_name text default null,
  p_client_id uuid default null,
  p_client_name text default null,
  p_notes text default null
)
returns public.planner_tasks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_task public.planner_tasks%rowtype;
  v_actor_name text;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null or v_profile.is_active is not true
     or v_profile.role not in ('admin', 'manager', 'staff', 'team') then
    raise exception 'Active staff profile required';
  end if;

  if p_title is null or length(btrim(p_title)) = 0 then
    raise exception 'Title is required';
  end if;
  if p_recurrence_rule is null or length(btrim(p_recurrence_rule)) = 0 then
    raise exception 'Recurrence rule is required';
  end if;
  if p_recurrence_until is not null and p_recurrence_until < current_date then
    raise exception 'Recurrence end date must not be in the past';
  end if;

  v_actor_name := coalesce(v_profile.full_name, v_profile.id::text);

  insert into public.planner_tasks (
    title, assigned_to_name, due_date, client_id, client_name,
    notes, source, recurrence_rule, recurrence_until, status
  ) values (
    btrim(p_title),
    nullif(btrim(coalesce(p_assignee_name, v_actor_name)), ''),
    current_date,
    p_client_id,
    nullif(btrim(coalesce(p_client_name, '')), ''),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'recurring',
    btrim(p_recurrence_rule),
    p_recurrence_until,
    'pending'
  )
  returning * into v_task;

  insert into public.planner_activity_log(entity_type, entity_id, action, actor_user_id, actor_name, metadata)
  values ('planner_task', v_task.id, 'assistant_created_recurring', auth.uid(), v_actor_name,
    jsonb_build_object('title', v_task.title, 'assignee', v_task.assigned_to_name,
      'recurrence_rule', v_task.recurrence_rule, 'recurrence_until', v_task.recurrence_until));

  return v_task;
end;
$$;

revoke all on function public.create_assistant_recurring_task(text, text, date, text, uuid, text, text) from public;
grant execute on function public.create_assistant_recurring_task(text, text, date, text, uuid, text, text) to authenticated;
