-- #405/#623 M2C. Configuration-free, service-only admission budget; not a lead store.
-- No bindings, recipients, credentials, scheduler or production activation.
begin;

create table public.website_enquiry_intake_budgets (
  endpoint_id uuid primary key references public.website_enquiry_endpoints(id) on delete restrict,
  minute_start timestamptz not null,
  minute_count integer not null check (minute_count between 1 and 11),
  hour_start timestamptz not null,
  hour_count integer not null check (hour_count between 1 and 101)
);
alter table public.website_enquiry_intake_budgets enable row level security;
alter table public.website_enquiry_intake_budgets force row level security;
revoke all on table public.website_enquiry_intake_budgets from public, anon, authenticated, service_role;
grant select, insert, update on table public.website_enquiry_intake_budgets to service_role;

create or replace function public.reserve_website_enquiry_intake(
  p_intake_key uuid, p_canonical_host text, p_schema_key text, p_schema_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_endpoint public.website_enquiry_endpoints%rowtype;
  v_budget public.website_enquiry_intake_budgets%rowtype;
  v_now timestamptz := clock_timestamp();
  v_minute timestamptz := date_trunc('minute', v_now, 'UTC');
  v_hour timestamptz := date_trunc('hour', v_now, 'UTC');
begin
  -- Capability + exact host + active form are authority. Origin alone is not auth.
  select endpoint.* into v_endpoint
  from public.website_enquiry_endpoints endpoint
  join public.clients client on client.id = endpoint.client_id and client.active
  where endpoint.intake_key = p_intake_key
    and endpoint.canonical_host = p_canonical_host
    and endpoint.enabled
    and endpoint.environment = 'production'
    and exists (select 1 from public.website_form_schemas form_schema
      where form_schema.endpoint_id = endpoint.id and form_schema.schema_key = p_schema_key
        and form_schema.version = p_schema_version and form_schema.status = 'active')
    and exists (select 1 from public.website_enquiry_recipient_configurations configuration
      join public.website_enquiry_recipient_routes route
        on route.recipient_configuration_id = configuration.id and route.active
      where configuration.endpoint_id = endpoint.id and configuration.status = 'approved')
  for share of endpoint;
  if not found then
    return jsonb_build_object('state', 'unavailable');
  end if;

  -- One row per canonical endpoint. UPSERT serializes concurrent admission across
  -- instances; saturated counters cannot overflow. Requests/retries consume budget.
  insert into public.website_enquiry_intake_budgets as budget
    (endpoint_id, minute_start, minute_count, hour_start, hour_count)
  values (v_endpoint.id, v_minute, 1, v_hour, 1)
  on conflict (endpoint_id) do update set
    minute_start = v_minute,
    minute_count = case when budget.minute_start = v_minute then least(budget.minute_count + 1, 11) else 1 end,
    hour_start = v_hour,
    hour_count = case when budget.hour_start = v_hour then least(budget.hour_count + 1, 101) else 1 end
  returning * into v_budget;

  return jsonb_build_object('state',
    case when v_budget.minute_count <= 10 and v_budget.hour_count <= 100 then 'allowed' else 'rate_limited' end,
    'retry_after', case when v_budget.hour_count > 100 then 3600 else 60 end);
end;
$$;
revoke all on function public.reserve_website_enquiry_intake(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_website_enquiry_intake(uuid, text, text, integer) to service_role;
commit;
