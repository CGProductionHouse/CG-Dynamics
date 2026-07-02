-- ============================================================
-- Phase 11a: Client portal read access
--
-- Lets signed-in client users read their own month-ahead schedule data
-- through client-safe RPCs only. Do not grant direct client SELECT on
-- monthly_deliverables or company_calendar_events: those base tables
-- contain internal staff fields.
--
-- DO NOT RUN LIVE without review in the Supabase SQL editor.
-- Read-only functions only — clients can never insert/update/delete.
-- ============================================================

-- Remove any earlier direct table policies from draft versions of this
-- migration. Client portal access must go through the safe RPCs below.
drop policy if exists "monthly_deliverables: client reads own"
  on public.monthly_deliverables;

drop policy if exists "company_calendar_events: client reads own"
  on public.company_calendar_events;


-- ── Client-safe scheduled posts ───────────────────────────────
-- Returns only fields safe for a client-facing month-ahead module.
-- Staff/admin callers may pass p_client_id for Client Preview.
-- Client callers are always restricted to their own profile.client_id.

drop function if exists public.client_portal_month_ahead_posts(uuid, date);

create function public.client_portal_month_ahead_posts(
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
    select
      case
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
      when md.production_status in ('scheduled', 'posted', 'approved') then 'scheduled_posted'
      when md.production_status in ('ready_client_approval', 'waiting_client', 'client_changes') then 'awaiting_approval'
      when md.production_status = 'ready_internal_review' then 'for_review'
      when md.production_status in ('in_progress', 'internal_changes', 'blocked') then 'in_production'
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


-- ── Client-safe company calendar events ───────────────────────
-- Returns only client-relevant, non-cancelled events. Internal meetings,
-- internal events, deadlines, notes, staff assignments and linked IDs are
-- never exposed.

drop function if exists public.client_portal_month_ahead_events(uuid, date);

create function public.client_portal_month_ahead_events(
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
    select
      case
        when public.is_staff() then p_client_id
        else public.my_client_id()
      end as allowed_client_id
  ), bounds as (
    select
      date_trunc('month', p_month)::timestamptz as month_start,
      (date_trunc('month', p_month) + interval '1 month')::timestamptz as next_month_start
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


-- Supabase may expose functions broadly by default; lock execution down
-- explicitly to signed-in users. Function logic still enforces client/staff
-- boundaries internally.
revoke all on function public.client_portal_month_ahead_posts(uuid, date) from public, anon;
revoke all on function public.client_portal_month_ahead_events(uuid, date) from public, anon;
grant execute on function public.client_portal_month_ahead_posts(uuid, date) to authenticated;
grant execute on function public.client_portal_month_ahead_events(uuid, date) to authenticated;


-- ── Verification (run after applying in Supabase SQL editor) ──
-- As a client user:
--   select * from public.client_portal_month_ahead_posts(null, '2026-07-01');
--   select * from public.client_portal_month_ahead_events(null, '2026-07-01');
--
-- Direct table access should still be blocked for client users:
--   select * from public.monthly_deliverables limit 1;        -- should return no rows / be denied by RLS
--   select * from public.company_calendar_events limit 1;     -- should return no rows / be denied by RLS
-- ============================================================
