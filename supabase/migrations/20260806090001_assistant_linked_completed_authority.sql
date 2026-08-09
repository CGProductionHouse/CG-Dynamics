-- Assistant day items + #176 completed-task authority.
--
-- An `assistant_day_items` row can link to a Planner task (planner_task_id).
-- That link never received Planner completion: assistant reminders and counts
-- filtered ONLY on item.state = 'open', so a task completed in Work/Planner
-- (planner_tasks.status -> 'done' / legacy 'completed') could still surface as
-- an open loop and still generate reminders.
--
-- This forward migration teaches BOTH notification-producing functions the
-- shared #176 semantic WITHOUT mutating rows and WITHOUT a sync trigger:
--
--   A linked assistant item stays active for Planner purposes only when
--     item.state = 'open'  AND  the linked Planner task is NOT operationally
--     completed ('done' / legacy 'completed'). approved / scheduled /
--     ready_internal_review / waiting_client are scheduling states, so they do
--     NOT exclude the item.
--
--   Unlinked items keep their own precedence: state = 'open' remains
--   authoritative (exact legacy behaviour).
--
-- Reopen behaviour is derived, never stored: if the Planner task is re-opened
-- (done -> to_do) the open item naturally becomes active again. An item the
-- user explicitly completed (state='completed') stays inactive regardless of a
-- Planner reopen, because `state` is a separate user decision.
--
-- Non-destructive: no column writes, no data rewrites, no hard deletes, no
-- trigger giving Planner ownership of the assistant row.
--
-- Canonical-link policy: a linked item is eligible only while its exact FK is a
-- current row in planner_tasks_canonical. Archived and superseded rows are
-- retired work and must never reappear as duplicate Assistant loops.
--
-- PR #172 ownership protections are also retained below for person-specific
-- approaching-due notifications: canonical tasks only, verified assignment,
-- and helper exclusion. The manager review digest is restored in the recreated
-- function, while assistant_ownership_review_summary() remains untouched.

create or replace function public.refresh_my_assistant_day_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_actor public.profiles;
  v_local_now timestamp;
  v_today date;
  v_hour integer;
  v_count integer;
  v_inserted integer := 0;
  v_slot text;
  v_title text;
  v_body text;
begin
  select * into v_actor from public.profiles profile
  where profile.id = auth.uid() and profile.is_active
    and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_actor.id is null then raise exception 'Active staff access required'; end if;
  v_local_now := now() at time zone 'Africa/Johannesburg';
  v_today := v_local_now::date;
  v_hour := extract(hour from v_local_now);
  if v_hour < 7 or v_hour >= 19 then return 0; end if;

  if v_hour between 7 and 10 then
    v_slot := 'morning';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and (item.due_date is null or item.due_date <= v_today);
    v_title := 'Morning plan';
    v_body := case when v_count = 0 then 'Your captured commitments are clear. Open My Work for today''s plan.'
      else v_count || ' captured open loop' || case when v_count = 1 then '' else 's' end || ' need attention today.' end;
  elsif v_hour between 11 and 14 then
    v_slot := 'midday';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and (item.due_date is null or item.due_date <= v_today);
    if v_count = 0 then return 0; end if;
    v_title := 'Midday check';
    v_body := v_count || ' captured open loop' || case when v_count = 1 then ' remains.' else 's remain.' end;
  elsif v_hour between 16 and 18 then
    v_slot := 'end-of-day';
    select count(*) into v_count from public.assistant_day_items item
    where item.user_id = auth.uid() and item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and item.kind in ('promise', 'task', 'follow_up', 'question');
    if v_count = 0 then return 0; end if;
    v_title := 'Before you finish today';
    v_body := v_count || ' promise or follow-up' || case when v_count = 1 then ' is' else 's are' end || ' still open.';
  else
    return 0;
  end if;

  insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
  values (auth.uid(), 'assistant_day', v_title, v_body, 'assistant_day',
    '/admin/work?tab=my-day', 'assistant-day:' || v_today::text || ':' || v_slot)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link, dedupe_key)
  select auth.uid(), 'assistant_reminder', 'Follow-up reminder', item.content,
    'assistant_day_item', item.id, '/admin/work?tab=my-day',
    'assistant-reminder:' || item.id::text || ':' || to_char(item.reminder_at at time zone 'Africa/Johannesburg', 'YYYYMMDDHH24MI')
  from public.assistant_day_items item
  where item.user_id = auth.uid() and item.state = 'open'
    and (
      item.planner_task_id is null or exists (
        select 1 from public.planner_tasks_canonical linked_task
        where linked_task.id = item.planner_task_id
          and linked_task.status not in ('done', 'completed')
      )
    )
    and item.reminder_at is not null
    and item.reminder_at between now() - interval '15 minutes' and now() + interval '90 minutes'
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_count = row_count;
  return v_inserted + v_count;
end;
$$;

revoke all on function public.refresh_my_assistant_day_notifications() from public, anon, authenticated;
grant execute on function public.refresh_my_assistant_day_notifications() to authenticated;

create or replace function public.generate_due_assistant_notifications()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_hour integer := extract(hour from now() at time zone 'Africa/Johannesburg');
  v_inserted integer := 0; v_rows integer;
begin
  if v_hour < 7 or v_hour >= 19 then return 0; end if;
  if v_hour between 7 and 10 then
    insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
    select profile.id, 'assistant_day', 'Morning plan',
      case when count(distinct item.id) = 0 then 'Your captured commitments are clear. Open My Work for today''s plan.'
        else count(distinct item.id)::text || ' captured open loop' || case when count(distinct item.id) = 1 then '' else 's' end || ' need attention today.' end,
      'assistant_day', '/admin/work?tab=my-day', 'assistant-day:' || v_today::text || ':morning'
    from public.profiles profile
    join public.web_push_subscriptions subscription on subscription.user_id = profile.id and subscription.is_active
      and (subscription.expires_at is null or subscription.expires_at > now())
    left join public.assistant_day_items item on item.user_id = profile.id and item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and (item.due_date is null or item.due_date <= v_today)
    where profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
    group by profile.id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;
  elsif v_hour between 11 and 14 then
    insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
    select item.user_id, 'assistant_day', 'Midday check', count(*)::text || ' captured open loop' ||
      case when count(*) = 1 then ' remains.' else 's remain.' end,
      'assistant_day', '/admin/work?tab=my-day', 'assistant-day:' || v_today::text || ':midday'
    from public.assistant_day_items item join public.profiles profile on profile.id = item.user_id
    where item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and (item.due_date is null or item.due_date <= v_today)
      and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
      and exists (select 1 from public.web_push_subscriptions subscription where subscription.user_id = item.user_id
        and subscription.is_active and (subscription.expires_at is null or subscription.expires_at > now()))
    group by item.user_id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;
  elsif v_hour between 16 and 18 then
    insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
    select item.user_id, 'assistant_day', 'Before you finish today', count(*)::text || ' promise or follow-up' ||
      case when count(*) = 1 then ' is' else 's are' end || ' still open.',
      'assistant_day', '/admin/work?tab=my-day', 'assistant-day:' || v_today::text || ':end-of-day'
    from public.assistant_day_items item join public.profiles profile on profile.id = item.user_id
    where item.state = 'open'
      and (
        item.planner_task_id is null or exists (
          select 1 from public.planner_tasks_canonical linked_task
          where linked_task.id = item.planner_task_id
            and linked_task.status not in ('done', 'completed')
        )
      )
      and item.kind in ('promise', 'task', 'follow_up', 'question')
      and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
      and exists (select 1 from public.web_push_subscriptions subscription where subscription.user_id = item.user_id
        and subscription.is_active and (subscription.expires_at is null or subscription.expires_at > now()))
    group by item.user_id
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;
  end if;

  insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link, dedupe_key)
  select item.user_id, 'assistant_reminder', 'Follow-up reminder', item.content, 'assistant_day_item', item.id,
    '/admin/work?tab=my-day', 'assistant-reminder:' || item.id::text || ':' ||
      to_char(item.reminder_at at time zone 'Africa/Johannesburg', 'YYYYMMDDHH24MI')
  from public.assistant_day_items item join public.profiles profile on profile.id = item.user_id
  where item.state = 'open'
    and (
      item.planner_task_id is null or exists (
        select 1 from public.planner_tasks_canonical linked_task
        where linked_task.id = item.planner_task_id
          and linked_task.status not in ('done', 'completed')
      )
    )
    and item.reminder_at is not null
    and item.reminder_at between now() - interval '5 minutes' and now() + interval '10 minutes'
    and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
    and exists (select 1 from public.web_push_subscriptions subscription where subscription.user_id = item.user_id
      and subscription.is_active and (subscription.expires_at is null or subscription.expires_at > now()))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  insert into public.notifications(user_id, type, title, body, entity_type, entity_id, link, dedupe_key)
  select assignment.profile_id, 'approaching_due',
    case when task.due_date <= v_today then 'Task due today' else 'Task due tomorrow' end,
    task.title, 'planner_task', task.id, '/admin/work?tab=board&id=' || task.id::text,
    'approaching-due:' || assignment.profile_id::text || ':' || task.id::text || ':' || v_today::text
  from public.planner_tasks_canonical task
  join public.planner_task_assignees assignment on assignment.task_id = task.id
  join public.profiles profile on profile.id = assignment.profile_id
  where task.recurrence_rule is null
    and task.assignment_review_state = 'ok'
    and not exists (
      select 1
      from unnest(coalesce(task.helper_names, '{}'::text[])) helper(name)
      where lower(btrim(helper.name)) = lower(btrim(profile.full_name))
    )
    and task.status not in ('approved', 'scheduled', 'scheduled_posted', 'done', 'completed', 'moved_to_tomorrow')
    and task.due_date between v_today and v_today + 1
    and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
    and exists (select 1 from public.web_push_subscriptions subscription where subscription.user_id = assignment.profile_id
      and subscription.is_active and (subscription.expires_at is null or subscription.expires_at > now()))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;

  -- PR #172: unresolved/conflicted due work has no verified owner, so it must
  -- reach managers as a review digest rather than generating person-specific
  -- notifications or disappearing silently.
  insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
  select manager.id, 'ownership_review', 'Task ownership needs review',
    count(distinct task.id)::text || ' due task' ||
      case when count(distinct task.id) = 1 then ' needs' else 's need' end || ' assignment review.',
    'planner_task', '/admin/work?tab=workload',
    'ownership-review:' || manager.id::text || ':' || v_today::text || ':approaching-due'
  from public.profiles manager
  cross join public.planner_tasks_canonical task
  where manager.is_active and manager.role in ('admin', 'manager')
    and task.recurrence_rule is null
    and task.assignment_review_state in ('unresolved', 'conflict')
    and task.status not in ('approved', 'scheduled', 'scheduled_posted', 'done', 'completed', 'moved_to_tomorrow')
    and task.due_date between v_today and v_today + 1
    and exists (
      select 1 from public.web_push_subscriptions subscription
      where subscription.user_id = manager.id
        and subscription.is_active
        and (subscription.expires_at is null or subscription.expires_at > now())
    )
  group by manager.id
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;
  return v_inserted;
end;
$$;

revoke all on function public.generate_due_assistant_notifications() from public, anon, authenticated;
grant execute on function public.generate_due_assistant_notifications() to service_role;
