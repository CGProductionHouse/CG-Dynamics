-- Phase 20c - Report-bound, client-safe Google Ads dashboard RPCs
-- Review in the Supabase SQL editor before applying. Do not apply directly to
-- production. Requires phases 20a and 20b.

-- The requested period is authorized through the report, not constrained to
-- the report's own dates, so the dashboard may request a previous-month range.
create or replace function public.get_google_ads_dashboard_campaign_metrics(
  p_report_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  campaign_name text,
  campaign_status text,
  campaign_type text,
  impressions bigint,
  clicks bigint,
  cost numeric,
  conversions numeric,
  value numeric,
  currency text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  report_client_id uuid;
  report_month_start date;
  report_month_end date;
  previous_month_start date;
  previous_month_end date;
begin
  select r.client_id, date_trunc('month', r.period_start)::date
    into report_client_id, report_month_start
  from public.reports r
  where r.id = p_report_id
    and r.status in ('draft', 'published')
    and (
      coalesce(public.is_staff(), false)
      or (
        r.status = 'published'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.client_id = r.client_id
            and p.role = 'client'
        )
      )
    );

  if report_client_id is null then
    raise exception 'Report access denied' using errcode = '42501';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads report period' using errcode = '22023';
  end if;

  report_month_end := (report_month_start + interval '1 month - 1 day')::date;
  previous_month_start := (report_month_start - interval '1 month')::date;
  previous_month_end := (report_month_start - interval '1 day')::date;
  if not (
    (p_period_start = report_month_start and p_period_end = report_month_end)
    or (p_period_start = previous_month_start and p_period_end = previous_month_end)
  ) then
    raise exception 'Google Ads period must be the report month or previous month' using errcode = '42501';
  end if;

  return query
  with resolved as (
    select m.*, a.currency_code
    from public.google_ads_campaign_daily_metrics m
    join public.google_ads_accounts a
      on a.id = m.google_ads_account_id
     and a.is_active
    where m.metric_date between p_period_start and p_period_end
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1 from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id
              and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1 from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.customer_id = m.customer_id
              and cl.campaign_id = m.campaign_id
              and cl.client_id = report_client_id
              and cl.is_active
          )
        )
      )
  )
  select
    r.campaign_name,
    (array_agg(r.campaign_status order by r.metric_date desc))[1],
    (array_agg(r.campaign_type order by r.metric_date desc))[1],
    sum(r.impressions)::bigint,
    sum(r.clicks)::bigint,
    sum(r.cost_micros)::numeric / 1000000::numeric,
    sum(r.conversions),
    sum(r.conversion_value),
    r.currency_code
  from resolved r
  group by r.google_ads_account_id, r.campaign_id, r.campaign_name, r.currency_code
  order by r.campaign_name;
end;
$$;

revoke all on function public.get_google_ads_dashboard_campaign_metrics(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_google_ads_dashboard_campaign_metrics(uuid, date, date)
  to authenticated;


create or replace function public.get_google_ads_dashboard_status(
  p_report_id uuid,
  p_period_start date,
  p_period_end date
)
returns table (
  connected boolean,
  has_mapping boolean,
  has_successful_sync boolean,
  metric_row_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  report_client_id uuid;
  report_month_start date;
  report_month_end date;
  previous_month_start date;
  previous_month_end date;
begin
  select r.client_id, date_trunc('month', r.period_start)::date
    into report_client_id, report_month_start
  from public.reports r
  where r.id = p_report_id
    and r.status in ('draft', 'published')
    and (
      coalesce(public.is_staff(), false)
      or (
        r.status = 'published'
        and exists (
          select 1
          from public.profiles p
          where p.id = auth.uid()
            and p.client_id = r.client_id
            and p.role = 'client'
        )
      )
    );

  if report_client_id is null then
    raise exception 'Report access denied' using errcode = '42501';
  end if;

  if p_period_start is null or p_period_end is null or p_period_end < p_period_start then
    raise exception 'Invalid Google Ads report period' using errcode = '22023';
  end if;

  report_month_end := (report_month_start + interval '1 month - 1 day')::date;
  previous_month_start := (report_month_start - interval '1 month')::date;
  previous_month_end := (report_month_start - interval '1 day')::date;
  if not (
    (p_period_start = report_month_start and p_period_end = report_month_end)
    or (p_period_start = previous_month_start and p_period_end = previous_month_end)
  ) then
    raise exception 'Google Ads period must be the report month or previous month' using errcode = '42501';
  end if;

  return query
  with mapped_accounts as (
    select a.id
    from public.google_ads_accounts a
    where a.is_active
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1
            from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id
              and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1
            from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.client_id = report_client_id
              and cl.is_active
          )
        )
      )
  ),
  resolved_metrics as (
    select m.id
    from public.google_ads_campaign_daily_metrics m
    join public.google_ads_accounts a
      on a.id = m.google_ads_account_id
     and a.is_active
    where m.metric_date between p_period_start and p_period_end
      and (
        (
          a.account_mode = 'dedicated'
          and exists (
            select 1
            from public.google_ads_account_links al
            where al.google_ads_account_id = a.id
              and al.client_id = report_client_id
              and al.is_active
          )
        )
        or
        (
          a.account_mode = 'shared'
          and exists (
            select 1
            from public.google_ads_campaign_links cl
            where cl.google_ads_account_id = a.id
              and cl.customer_id = m.customer_id
              and cl.campaign_id = m.campaign_id
              and cl.client_id = report_client_id
              and cl.is_active
          )
        )
      )
  )
  select
    exists (
      select 1
      from public.google_ads_accounts a
      where a.is_active
    ),
    exists (select 1 from mapped_accounts),
    exists (
      select 1
      from public.google_ads_sync_runs sr
      join mapped_accounts ma on ma.id = sr.google_ads_account_id
      where sr.status = 'succeeded'
        and sr.period_start <= p_period_start
        and sr.period_end >= p_period_end
    ),
    (select count(*) from resolved_metrics);
end;
$$;

revoke all on function public.get_google_ads_dashboard_status(uuid, date, date)
  from public, anon, authenticated;
grant execute on function public.get_google_ads_dashboard_status(uuid, date, date)
  to authenticated;
