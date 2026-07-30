-- Phase 29a: release-ready client portal calendar RPCs.
--
-- Additive and idempotent. The client portal never receives direct access to
-- monthly_deliverables or company_calendar_events; these functions expose a
-- narrow, client-safe projection and enforce ownership inside the database.

drop policy if exists "monthly_deliverables: client reads own"
  on public.monthly_deliverables;
drop policy if exists "company_calendar_events: client reads own"
  on public.company_calendar_events;

create or replace function public.client_portal_month_ahead_posts(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  schedule_date date,
  title text,
  post_type text,
  client_safe_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select case
      when public.is_staff() then p_client_id
      else public.my_client_id()
    end as allowed_client_id
  )
  select
    'post-' || substr(md5(md.id::text), 1, 16) as row_key,
    coalesce(md.scheduled_date, md.due_date) as schedule_date,
    md.title,
    md.deliverable_type as post_type,
    case
      when lower(coalesce(md.production_status::text, '')) in (
        'scheduled_posted', 'scheduled', 'posted', 'published', 'live',
        'complete', 'completed', 'done', 'meta_drafts', 'meta_draft',
        'draft', 'drafts', 'approved', 'ready_to_schedule'
      ) then 'scheduled_posted'
      when lower(coalesce(md.production_status::text, '')) in (
        'ready_client_approval', 'waiting_client', 'awaiting_client',
        'client_approval', 'sent_to_client', 'with_client', 'client_changes'
      ) then 'awaiting_approval'
      when lower(coalesce(md.production_status::text, '')) in (
        'ready_internal_review', 'ready_review', 'internal_review', 'review'
      ) then 'for_review'
      when lower(coalesce(md.production_status::text, '')) in (
        'in_progress', 'inprogress', 'doing', 'wip', 'started',
        'internal_changes', 'blocked'
      ) then 'in_production'
      else 'planned'
    end as client_safe_status
  from public.monthly_deliverables md
  cross join caller c
  where c.allowed_client_id is not null
    and md.client_id = c.allowed_client_id
    and md.archived_at is null
    and md.month = date_trunc('month', p_month)::date
    and md.deliverable_type in ('dp', 'photo', 'video', 'reel')
  order by coalesce(md.scheduled_date, md.due_date, date '9999-12-31'), md.title;
$$;

create or replace function public.client_portal_month_ahead_events(
  p_client_id uuid,
  p_month date
)
returns table (
  row_key text,
  title text,
  event_type text,
  start_time timestamptz,
  end_time timestamptz,
  all_day boolean,
  location text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with caller as (
    select case
      when public.is_staff() then p_client_id
      else public.my_client_id()
    end as allowed_client_id
  ), bounds as (
    select
      (date_trunc('month', p_month)::date::timestamp at time zone 'Africa/Johannesburg') as month_start,
      ((date_trunc('month', p_month) + interval '1 month')::date::timestamp at time zone 'Africa/Johannesburg') as next_month_start
  )
  select
    'event-' || substr(md5(e.id::text), 1, 16) as row_key,
    e.title,
    e.event_type,
    e.start_at as start_time,
    e.end_at as end_time,
    e.all_day,
    e.location
  from public.company_calendar_events e
  cross join caller c
  cross join bounds b
  where c.allowed_client_id is not null
    and e.client_id = c.allowed_client_id
    and e.event_type in ('shoot', 'content_run', 'client_event')
    and e.status <> 'cancelled'
    and e.start_at >= b.month_start
    and e.start_at < b.next_month_start
  order by e.start_at, e.title;
$$;

revoke all on function public.client_portal_month_ahead_posts(uuid, date)
  from public, anon;
revoke all on function public.client_portal_month_ahead_events(uuid, date)
  from public, anon;
grant execute on function public.client_portal_month_ahead_posts(uuid, date)
  to authenticated;
grant execute on function public.client_portal_month_ahead_events(uuid, date)
  to authenticated;

