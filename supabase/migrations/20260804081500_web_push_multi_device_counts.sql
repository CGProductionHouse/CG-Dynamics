-- Keep morning open-loop counts truthful when one user has multiple push devices.
-- Notification delivery remains one row per notification/device in the outbox.

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
    where item.state = 'open' and (item.due_date is null or item.due_date <= v_today)
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
    where item.state = 'open' and item.kind in ('promise', 'task', 'follow_up', 'question')
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
  where item.state = 'open' and item.reminder_at is not null
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
  from public.planner_tasks task
  join public.planner_task_assignees assignment on assignment.task_id = task.id
  join public.profiles profile on profile.id = assignment.profile_id
  where task.archived_at is null and task.recurrence_rule is null
    and task.status not in ('approved', 'scheduled', 'scheduled_posted', 'done', 'completed', 'moved_to_tomorrow')
    and task.due_date between v_today and v_today + 1
    and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
    and exists (select 1 from public.web_push_subscriptions subscription where subscription.user_id = assignment.profile_id
      and subscription.is_active and (subscription.expires_at is null or subscription.expires_at > now()))
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_rows = row_count; v_inserted := v_inserted + v_rows;
  return v_inserted;
end;
$$;
revoke all on function public.generate_due_assistant_notifications() from public, anon, authenticated;
grant execute on function public.generate_due_assistant_notifications() to service_role;
