-- Standards-based Web Push transport for existing staff notifications.
-- The notifications table remains canonical. Push subscriptions are private
-- per-user/per-device, deliveries are idempotent, and clients are excluded.

create or replace function public.set_web_push_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_web_push_updated_at() from public, anon, authenticated;

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  endpoint_hash text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  device_label text,
  is_active boolean not null default true,
  failure_count integer not null default 0 check (failure_count >= 0),
  last_error_code text,
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(endpoint) between 20 and 4096),
  check (length(p256dh) between 20 and 512),
  check (length(auth_secret) between 8 and 256)
);
create index if not exists web_push_subscriptions_user_active_idx on public.web_push_subscriptions(user_id, is_active);
alter table public.web_push_subscriptions enable row level security;
revoke all on table public.web_push_subscriptions from public, anon, authenticated;
grant all on table public.web_push_subscriptions to service_role;
drop trigger if exists trg_web_push_subscriptions_updated_at on public.web_push_subscriptions;
create trigger trg_web_push_subscriptions_updated_at before update on public.web_push_subscriptions
for each row execute function public.set_web_push_updated_at();

create table if not exists public.web_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.web_push_subscriptions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'failed', 'expired')),
  attempts integer not null default 0 check (attempts >= 0),
  provider_status integer,
  error_code text,
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id, subscription_id)
);
create index if not exists web_push_deliveries_claim_idx on public.web_push_deliveries(status, created_at) where status in ('queued', 'failed');
create index if not exists web_push_deliveries_user_idx on public.web_push_deliveries(user_id, created_at desc);
alter table public.web_push_deliveries enable row level security;
revoke all on table public.web_push_deliveries from public, anon, authenticated;
grant all on table public.web_push_deliveries to service_role;
drop trigger if exists trg_web_push_deliveries_updated_at on public.web_push_deliveries;
create trigger trg_web_push_deliveries_updated_at before update on public.web_push_deliveries
for each row execute function public.set_web_push_updated_at();

create or replace function public.register_my_web_push_subscription(
  p_endpoint text, p_p256dh text, p_auth_secret text,
  p_user_agent text default null, p_device_label text default null
) returns table(subscription_id uuid, active boolean, last_seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_hash text; v_row public.web_push_subscriptions;
begin
  select * into v_profile from public.profiles profile
  where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_profile.id is null then raise exception 'Active staff access required'; end if;
  if p_endpoint is null or length(p_endpoint) not between 20 and 4096 or p_endpoint !~ '^https://'
    or p_p256dh is null or length(p_p256dh) not between 20 and 512
    or p_auth_secret is null or length(p_auth_secret) not between 8 and 256
  then raise exception 'Invalid push subscription'; end if;
  v_hash := encode(sha256(convert_to(p_endpoint, 'UTF8')), 'hex');
  insert into public.web_push_subscriptions(
    user_id, endpoint, endpoint_hash, p256dh, auth_secret, user_agent, device_label,
    is_active, failure_count, last_error_code, last_seen_at, expires_at
  ) values (
    auth.uid(), p_endpoint, v_hash, p_p256dh, p_auth_secret,
    left(nullif(btrim(coalesce(p_user_agent, '')), ''), 500),
    left(nullif(btrim(coalesce(p_device_label, '')), ''), 100),
    true, 0, null, now(), null
  ) on conflict (endpoint_hash) do update set
    user_id = excluded.user_id, endpoint = excluded.endpoint, p256dh = excluded.p256dh,
    auth_secret = excluded.auth_secret, user_agent = excluded.user_agent,
    device_label = excluded.device_label, is_active = true, failure_count = 0,
    last_error_code = null, last_seen_at = now(), expires_at = null
  returning * into v_row;
  return query select v_row.id, v_row.is_active, v_row.last_seen_at;
end;
$$;

create or replace function public.my_web_push_subscription_status(p_endpoint text)
returns table(subscription_id uuid, active boolean, last_seen_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  if auth.uid() is null or p_endpoint is null then return; end if;
  v_hash := encode(sha256(convert_to(p_endpoint, 'UTF8')), 'hex');
  return query select subscription.id, subscription.is_active, subscription.last_seen_at
  from public.web_push_subscriptions subscription
  join public.profiles profile on profile.id = subscription.user_id
  where subscription.endpoint_hash = v_hash and subscription.user_id = auth.uid()
    and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team');
end;
$$;

create or replace function public.unregister_my_web_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hash text; v_changed integer;
begin
  if auth.uid() is null or p_endpoint is null then return false; end if;
  v_hash := encode(sha256(convert_to(p_endpoint, 'UTF8')), 'hex');
  update public.web_push_subscriptions subscription
  set is_active = false, expires_at = now(), last_seen_at = now()
  where subscription.endpoint_hash = v_hash and subscription.user_id = auth.uid();
  get diagnostics v_changed = row_count;
  update public.web_push_deliveries delivery set status = 'expired', error_code = 'unsubscribed'
  where delivery.subscription_id in (
    select subscription.id from public.web_push_subscriptions subscription
    where subscription.endpoint_hash = v_hash and subscription.user_id = auth.uid()
  ) and delivery.status in ('queued', 'failed');
  return v_changed > 0;
end;
$$;

create or replace function public.send_my_test_push_notification()
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_id uuid;
begin
  select * into v_profile from public.profiles profile
  where profile.id = auth.uid() and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team');
  if v_profile.id is null then raise exception 'Active staff access required'; end if;
  if not exists (select 1 from public.web_push_subscriptions subscription
    where subscription.user_id = auth.uid() and subscription.is_active
      and (subscription.expires_at is null or subscription.expires_at > now()))
  then raise exception 'No active push subscription'; end if;
  insert into public.notifications(user_id, type, title, body, entity_type, link, dedupe_key)
  values (auth.uid(), 'push_test', 'CG Dynamics notifications are on',
    'This is a private test notification for this device.', 'assistant_day', '/admin/assistant',
    'push-test:' || auth.uid()::text || ':' || gen_random_uuid()::text)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.register_my_web_push_subscription(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.my_web_push_subscription_status(text) from public, anon, authenticated;
revoke all on function public.unregister_my_web_push_subscription(text) from public, anon, authenticated;
revoke all on function public.send_my_test_push_notification() from public, anon, authenticated;
grant execute on function public.register_my_web_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.my_web_push_subscription_status(text) to authenticated;
grant execute on function public.unregister_my_web_push_subscription(text) to authenticated;
grant execute on function public.send_my_test_push_notification() to authenticated;

create or replace function public.queue_notification_web_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_queued integer;
begin
  insert into public.web_push_deliveries(notification_id, subscription_id, user_id)
  select new.id, subscription.id, new.user_id
  from public.web_push_subscriptions subscription
  join public.profiles profile on profile.id = subscription.user_id
  where subscription.user_id = new.user_id and subscription.is_active
    and (subscription.expires_at is null or subscription.expires_at > now())
    and profile.is_active and profile.role in ('admin', 'manager', 'staff', 'team')
  on conflict (notification_id, subscription_id) do nothing;
  get diagnostics v_queued = row_count;
  if v_queued > 0 then
    insert into public.background_jobs(job_type, payload, requested_by, requested_by_name, idempotency_key, max_attempts)
    select 'web_push_delivery', jsonb_build_object('notification_id', new.id), null,
      profile.full_name, 'web-push:' || new.id::text, 4
    from public.profiles profile where profile.id = new.user_id
    on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_notification_web_push() from public, anon, authenticated;
drop trigger if exists trg_notifications_queue_web_push on public.notifications;
create trigger trg_notifications_queue_web_push after insert on public.notifications
for each row execute function public.queue_notification_web_push();

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
      case when count(item.id) = 0 then 'Your captured commitments are clear. Open My Work for today''s plan.'
        else count(item.id)::text || ' captured open loop' || case when count(item.id) = 1 then '' else 's' end || ' need attention today.' end,
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

do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'cg-assistant-push-refresh';
    perform cron.schedule('cg-assistant-push-refresh', '*/5 * * * *', 'select public.generate_due_assistant_notifications();');
  end if;
end;
$$;

comment on table public.web_push_subscriptions is 'Private staff-owned device subscriptions. Endpoints and key material are service-only.';
comment on table public.web_push_deliveries is 'Idempotent delivery outbox linking canonical notifications to active device subscriptions.';
