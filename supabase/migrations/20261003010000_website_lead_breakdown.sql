-- Issue #405: qualified-lead breakdown by landing page and by acquisition source.
--
-- Website Performance must show which landing pages and sources bring QUALIFIED leads, not just
-- raw lead counts, without letting one or two leads drive optimisation decisions. This adds one
-- aggregate-only, exact-client RPC alongside website_lead_metrics:
-- - keys are a landing PATH (query/fragment stripped) or a SOURCE (utm_source, else referrer
--   host, else "not recorded") — never names, emails, phones, messages or full referrer URLs;
-- - every row carries sufficientSample = total >= 5, the minimum before a row may inform an
--   optimisation decision; smaller rows are still shown, labelled low-confidence;
-- - same caller resolution, period rules and production-only scope as website_lead_metrics.
begin;

create or replace function public.website_lead_breakdown(
  p_client_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_dimension text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c_min_sample constant integer := 5;
  c_max_rows constant integer := 10;
  v_client_id uuid;
  v_endpoints integer;
  v_rows jsonb;
  v_total_rows integer;
begin
  select caller.client_id into v_client_id from public.website_lead_caller_client(p_client_id) caller;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 366 then
    raise exception 'Lead breakdown period is invalid' using errcode = '22023';
  end if;
  if p_dimension is null or p_dimension not in ('landing_page', 'source') then
    raise exception 'Lead breakdown dimension is invalid' using errcode = '22023';
  end if;

  select count(*) into v_endpoints
  from public.website_enquiry_endpoints endpoint
  where endpoint.client_id = v_client_id and endpoint.environment = 'production';

  with leads as (
    select
      case p_dimension
        when 'landing_page' then nullif(btrim(split_part(split_part(enquiry.attribution ->> 'landing_path', '?', 1), '#', 1)), '')
        else coalesce(
          nullif(lower(btrim(enquiry.attribution ->> 'utm_source')), ''),
          nullif(regexp_replace(lower(substring(enquiry.attribution ->> 'referrer' from '^[A-Za-z][A-Za-z0-9+.-]*://(?:[^/?#@]*@)?([^/:?#@]+)')), '^www\.', ''), '')
        )
      end as key,
      lead_state.quality
    from public.website_enquiries enquiry
    left join public.website_enquiry_lead_states lead_state
      on lead_state.enquiry_id = enquiry.id
     and lead_state.client_id = enquiry.client_id
    where enquiry.client_id = v_client_id
      and enquiry.environment = 'production'
      and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date >= p_from
      and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date < p_to
  ),
  grouped as (
    select
      key,
      count(*) as total,
      count(*) filter (where quality = 'good') as qualified,
      count(*) filter (where quality = 'poor') as poor,
      count(*) filter (where quality is null) as unreviewed
    from leads
    group by key
  ),
  ranked as (
    select grouped.*, row_number() over (order by qualified desc, total desc, key asc nulls last) as position
    from grouped
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'key', key,
      'total', total,
      'qualified', qualified,
      'poor', poor,
      'unreviewed', unreviewed,
      'qualificationRate', round(qualified::numeric / total, 4),
      'sufficientSample', total >= c_min_sample
    ) order by position) filter (where position <= c_max_rows), '[]'::jsonb),
    count(*)
  into v_rows, v_total_rows
  from ranked;

  return jsonb_build_object(
    'clientId', v_client_id,
    'dimension', p_dimension,
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', 'Africa/Johannesburg'),
    'state', case when v_endpoints = 0 then 'not_connected' else 'available' end,
    'minSample', c_min_sample,
    'rows', v_rows,
    'otherRows', greatest(v_total_rows - c_max_rows, 0)
  );
end;
$$;

revoke all on function public.website_lead_breakdown(uuid, date, date, text) from public, anon;
grant execute on function public.website_lead_breakdown(uuid, date, date, text) to authenticated;

commit;
