-- Client report isolation: client accounts have no direct base-table reads.
-- Published report data is exposed only through explicit, client-safe RPCs.

drop policy if exists "reports: client reads own published" on public.reports;
drop policy if exists "posts: client reads own published" on public.posts;
drop policy if exists "manual_platform_metrics: client reads own" on public.manual_platform_metrics;

-- This legacy curation RPC returns Meta object IDs and is therefore staff-only.
create or replace function public.get_report_content_exclusions(p_report_id uuid)
returns table (
  platform text,
  meta_object_id text,
  excluded boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.is_staff() or not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role in ('admin', 'manager', 'staff', 'team')
  ) then
    raise exception 'Staff access required' using errcode = '42501';
  end if;

  return query
  select e.platform, e.meta_object_id, e.excluded
  from public.report_content_exclusions e
  join public.reports r
    on r.id = e.report_id
   and r.client_id = e.client_id
  where e.report_id = p_report_id
  order by e.platform, e.meta_object_id;
end
$$;

-- strategy_data is authored for staff and can contain nested operational IDs.
-- Build the client projection field-by-field rather than subtracting known keys.
create or replace function public.client_safe_strategy_section(p_section jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'enabled', coalesce(p_section -> 'enabled', 'false'::jsonb) = 'true'::jsonb,
    'items', coalesce((
      select jsonb_agg(item.value)
      from jsonb_array_elements(
        case when jsonb_typeof(p_section -> 'items') = 'array' then p_section -> 'items' else '[]'::jsonb end
      ) item(value)
      where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'notes', case when jsonb_typeof(p_section -> 'notes') = 'string' then p_section -> 'notes' else '""'::jsonb end
  );
$$;

create or replace function public.client_safe_strategy_data(p_data jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case when jsonb_typeof(p_data) <> 'object' then null else jsonb_build_object(
    'version', 1,
    'clientDirection', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'clientDirection') = 'array' then p_data -> 'clientDirection' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'clientRequestNotes', case when jsonb_typeof(p_data -> 'clientRequestNotes') = 'string' then p_data -> 'clientRequestNotes' else '""'::jsonb end,
    'topContent', jsonb_build_object(
      'autoCaption', case when jsonb_typeof(p_data #> '{topContent,autoCaption}') = 'string' then p_data #> '{topContent,autoCaption}' else 'null'::jsonb end,
      'autoPlatform', case when jsonb_typeof(p_data #> '{topContent,autoPlatform}') = 'string' then p_data #> '{topContent,autoPlatform}' else 'null'::jsonb end,
      'autoMetricLabel', case when jsonb_typeof(p_data #> '{topContent,autoMetricLabel}') = 'string' then p_data #> '{topContent,autoMetricLabel}' else 'null'::jsonb end,
      'autoMetricValue', case when jsonb_typeof(p_data #> '{topContent,autoMetricValue}') = 'number' then p_data #> '{topContent,autoMetricValue}' else 'null'::jsonb end,
      'autoImageUrl', case when jsonb_typeof(p_data #> '{topContent,autoImageUrl}') = 'string' then p_data #> '{topContent,autoImageUrl}' else 'null'::jsonb end,
      'coverImageUrl', case when jsonb_typeof(p_data #> '{topContent,coverImageUrl}') = 'string' then p_data #> '{topContent,coverImageUrl}' else '""'::jsonb end,
      'contentType', case when jsonb_typeof(p_data #> '{topContent,contentType}') = 'string' then p_data #> '{topContent,contentType}' else '""'::jsonb end,
      'whyItWorked', coalesce((
        select jsonb_agg(item.value) from jsonb_array_elements(
          case when jsonb_typeof(p_data #> '{topContent,whyItWorked}') = 'array' then p_data #> '{topContent,whyItWorked}' else '[]'::jsonb end
        ) item(value) where jsonb_typeof(item.value) = 'string'
      ), '[]'::jsonb),
      'whatThisTellsUs', case when jsonb_typeof(p_data #> '{topContent,whatThisTellsUs}') = 'string' then p_data #> '{topContent,whatThisTellsUs}' else '""'::jsonb end
    ),
    'strategyDrivers', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'strategyDrivers') = 'array' then p_data -> 'strategyDrivers' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'strategyGoingForward', case when jsonb_typeof(p_data -> 'strategyGoingForward') = 'string' then p_data -> 'strategyGoingForward' else '""'::jsonb end,
    'actionPlan', jsonb_build_object(
      'professional_video', public.client_safe_strategy_section(p_data #> '{actionPlan,professional_video}'),
      'reels', public.client_safe_strategy_section(p_data #> '{actionPlan,reels}'),
      'photo_content', public.client_safe_strategy_section(p_data #> '{actionPlan,photo_content}'),
      'design_poster', public.client_safe_strategy_section(p_data #> '{actionPlan,design_poster}'),
      'animated_poster', public.client_safe_strategy_section(p_data #> '{actionPlan,animated_poster}'),
      'campaign_recommendation', public.client_safe_strategy_section(p_data #> '{actionPlan,campaign_recommendation}')
    ),
    'clientActionsRequired', coalesce((
      select jsonb_agg(item.value) from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'clientActionsRequired') = 'array' then p_data -> 'clientActionsRequired' else '[]'::jsonb end
      ) item(value) where jsonb_typeof(item.value) = 'string'
    ), '[]'::jsonb),
    'calendarSelections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'title', case when jsonb_typeof(selection.value -> 'title') = 'string' then selection.value -> 'title' else '""'::jsonb end,
        'date', case when jsonb_typeof(selection.value -> 'date') = 'string' then selection.value -> 'date' else 'null'::jsonb end,
        'use', coalesce(selection.value -> 'use', 'false'::jsonb) = 'true'::jsonb,
        'note', case when jsonb_typeof(selection.value -> 'note') = 'string' then selection.value -> 'note' else '""'::jsonb end
      ))
      from jsonb_array_elements(
        case when jsonb_typeof(p_data -> 'calendarSelections') = 'array' then p_data -> 'calendarSelections' else '[]'::jsonb end
      ) selection(value)
      where jsonb_typeof(selection.value) = 'object'
    ), '[]'::jsonb)
  ) end;
$$;

revoke all on function public.client_safe_strategy_section(jsonb) from public, anon, authenticated;
revoke all on function public.client_safe_strategy_data(jsonb) from public, anon, authenticated;

create or replace function public.client_published_reports()
returns table (
  id uuid,
  platform text,
  period_start date,
  period_end date,
  status text,
  report_title text,
  previous_month_strategy text,
  previous_month_reflection text,
  performance_comments text,
  strategy_next_month text,
  content_direction_next_month text,
  boost_recommendation text,
  strategy_data jsonb,
  published_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role = 'client'
      and profile.client_id is not null
  ) then raise exception 'Active client access required' using errcode = '42501'; end if;

  return query select
    r.id,
    r.platform,
    r.period_start,
    r.period_end,
    r.status,
    r.report_title,
    r.previous_month_strategy,
    r.previous_month_reflection,
    r.performance_comments,
    r.strategy_next_month,
    r.content_direction_next_month,
    r.boost_recommendation,
    public.client_safe_strategy_data(r.strategy_data),
    r.published_at
  from public.reports r
  where r.status = 'published'
    and r.client_id = public.my_client_id()
  order by r.period_start desc, r.created_at desc;
end
$$;

create or replace function public.client_published_report_posts(p_report_id uuid)
returns table (
  platform text,
  publish_time timestamptz,
  post_type text,
  caption text,
  permalink text,
  impressions integer,
  reach integer,
  engagements integer,
  excluded boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role = 'client'
      and profile.client_id is not null
  ) then raise exception 'Active client access required' using errcode = '42501'; end if;

  select r.client_id
  into v_client_id
  from public.reports r
  where r.id = p_report_id
    and r.status = 'published';

  if not found or v_client_id is distinct from public.my_client_id() then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select
    p.platform,
    p.publish_time,
    coalesce(p.raw ->> 'content_type', p.meta_post_type),
    p.caption,
    p.permalink,
    case
      when p.raw ->> 'source' = 'meta_sync' or p.raw ? 'synced_at'
        then case when jsonb_typeof(p.raw -> 'views') = 'number' then (p.raw ->> 'views')::integer end
      when jsonb_typeof(p.raw -> 'views') = 'number' then (p.raw ->> 'views')::integer
      when jsonb_typeof(p.raw -> 'impressions') = 'number' then (p.raw ->> 'impressions')::integer
      else p.views
    end,
    case
      when p.raw ->> 'source' = 'meta_sync' or p.raw ? 'synced_at'
        then case when jsonb_typeof(p.raw -> 'reach') = 'number' then (p.raw ->> 'reach')::integer end
      else p.reach
    end,
    case
      when jsonb_typeof(p.raw -> 'engagements') = 'number' then (p.raw ->> 'engagements')::integer
      else coalesce(p.reactions, 0) + coalesce(p.comments, 0) + coalesce(p.shares, 0) + coalesce(p.total_clicks, 0)
    end,
    exists (
      select 1
      from public.report_content_exclusions e
      where e.report_id = p_report_id
        and e.post_id = p.id
        and e.client_id = v_client_id
        and e.excluded
    )
  from public.posts p
  where p.report_id = p_report_id
  order by p.publish_time nulls last, p.created_at;
end
$$;

create or replace function public.client_published_report_manual_metrics(p_report_id uuid)
returns table (
  month text,
  platform text,
  source_type text,
  views integer,
  reach integer,
  engagements integer,
  accounts_engaged integer,
  profile_visits integer,
  external_link_taps integer,
  followers integer
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_client_id uuid;
  v_month text;
begin
  if not exists (
    select 1 from public.profiles profile
    where profile.id = auth.uid()
      and profile.is_active
      and profile.role = 'client'
      and profile.client_id is not null
  ) then raise exception 'Active client access required' using errcode = '42501'; end if;

  select r.client_id, to_char(date_trunc('month', r.period_start), 'YYYY-MM')
  into v_client_id, v_month
  from public.reports r
  where r.id = p_report_id
    and r.status = 'published';

  if not found or v_client_id is distinct from public.my_client_id() then
    raise exception 'Not authorized for this report' using errcode = '42501';
  end if;

  return query
  select
    m.month,
    m.platform,
    m.source_type,
    m.views,
    m.reach,
    m.engagements,
    m.accounts_engaged,
    m.profile_visits,
    m.external_link_taps,
    m.followers
  from public.manual_platform_metrics m
  where m.client_id = v_client_id
    and m.month = v_month
    -- Legacy automated placeholders are not valid client-report evidence.
    and not (
      m.source_type = 'other'
      and coalesce(m.general_notes, '') ilike 'Meta sync account totals for unavailable metrics%'
    )
  order by m.platform;
end
$$;

revoke all on function public.client_published_reports() from public, anon;
revoke all on function public.client_published_report_posts(uuid) from public, anon;
revoke all on function public.client_published_report_manual_metrics(uuid) from public, anon;
grant execute on function public.client_published_reports() to authenticated;
grant execute on function public.client_published_report_posts(uuid) to authenticated;
grant execute on function public.client_published_report_manual_metrics(uuid) to authenticated;

revoke all on function public.get_report_content_exclusions(uuid) from public, anon;
grant execute on function public.get_report_content_exclusions(uuid) to authenticated;
