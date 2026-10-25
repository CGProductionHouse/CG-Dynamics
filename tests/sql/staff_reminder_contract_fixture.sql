-- Disposable test database only. No provider endpoints, credentials or live IDs.
create table profiles(id uuid primary key, full_name text, role text, is_active boolean);
create table planner_tasks(
  id uuid primary key, title text, status text, due_date date, recurrence_rule text,
  assignment_review_state text default 'ok', helper_names text[], archived_at timestamptz,
  superseded_by_task_id uuid, microsoft_source_removed_at timestamptz
);
create view planner_tasks_canonical as select * from planner_tasks where archived_at is null
  and superseded_by_task_id is null and microsoft_source_removed_at is null;
create table planner_task_assignees(task_id uuid, profile_id uuid);
create table assistant_day_items(
  id uuid primary key, user_id uuid references profiles(id), state text, kind text,
  content text, due_date date, planner_task_id uuid, reminder_at timestamptz
);
create table web_push_subscriptions(id uuid primary key, user_id uuid references profiles(id), is_active boolean, expires_at timestamptz);
create table notifications(
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id),
  type text, title text, body text, entity_type text, entity_id uuid, link text, dedupe_key text
);
create unique index fixture_notification_key on notifications(user_id, dedupe_key) where dedupe_key is not null;
create table web_push_deliveries(
  id uuid primary key default gen_random_uuid(), notification_id uuid references notifications(id) on delete cascade,
  subscription_id uuid references web_push_subscriptions(id), user_id uuid,
  status text default 'queued', unique(notification_id,subscription_id)
);
create table background_jobs(
  id uuid primary key default gen_random_uuid(), job_type text, payload jsonb,
  requested_by uuid, requested_by_name text, idempotency_key text unique, max_attempts int
);
create table company_calendar_events(id uuid primary key, title text, start_at timestamptz, status text, assigned_to_name text);
create table fixture_clock(value timestamptz);
insert into fixture_clock values('2026-10-25T13:00:00Z');
create function fixture_now() returns timestamptz language sql as $$ select value from fixture_clock $$;
