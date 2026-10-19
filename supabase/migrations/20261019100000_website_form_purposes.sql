-- Purpose-aware CG Forms transaction. Application and booking requests use the
-- existing durable delivery outbox; opt-in subscriptions go only to a private
-- CG-owned list. Only enquiries generate lead events or appear in lead views.
begin;

alter table public.website_form_schemas
  add column purpose text not null default 'enquiry'
  check (purpose in ('enquiry', 'application', 'booking_request', 'subscription'));
alter table public.website_form_schemas
  add column consent_field_key text,
  add constraint website_subscription_consent_field_required
    check (purpose <> 'subscription' or consent_field_key is not null);
alter table public.website_enquiries
  add column purpose text not null default 'enquiry'
  check (purpose in ('enquiry', 'application', 'booking_request', 'subscription'));
alter table public.website_enquiries
  add constraint website_enquiries_receipt_endpoint_client_unique unique (receipt_id, endpoint_id, client_id);

-- Once active, the reviewed purpose is immutable alongside the field contract.
create or replace function public.protect_website_form_purpose()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.purpose = 'subscription' and not exists (
    select 1 from jsonb_array_elements(new.field_definitions) definition
    where definition ->> 'key' = new.consent_field_key
      and definition ->> 'type' = 'checkbox'
      and definition ->> 'required' = 'true'
  ) then
    raise exception 'Subscription requires a required consent checkbox.' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and old.status <> 'draft' and
     (new.purpose is distinct from old.purpose or new.consent_field_key is distinct from old.consent_field_key) then
    raise exception 'Activated form purpose and consent key are immutable.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger protect_website_form_purpose
  before update on public.website_form_schemas
  for each row execute function public.protect_website_form_purpose();

create table public.website_subscribers (
  endpoint_id uuid not null,
  client_id uuid not null,
  normalized_email text not null check (normalized_email = lower(btrim(normalized_email))
    and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  status text not null default 'subscribed' check (status in ('subscribed', 'unsubscribed')),
  consent_receipt_id uuid not null,
  consent_at timestamptz not null,
  consent_snapshot jsonb not null check (jsonb_typeof(consent_snapshot) = 'object'),
  primary key (endpoint_id, normalized_email),
  foreign key (endpoint_id, client_id) references public.website_enquiry_endpoints(id, client_id) on delete restrict,
  foreign key (consent_receipt_id, endpoint_id, client_id)
    references public.website_enquiries(receipt_id, endpoint_id, client_id) on delete restrict
);
create index website_subscribers_client_status_idx on public.website_subscribers(client_id, status, consent_at desc);
alter table public.website_subscribers enable row level security;
alter table public.website_subscribers force row level security;
revoke all on table public.website_subscribers from public, anon, authenticated, service_role;
grant select, insert, update on table public.website_subscribers to service_role;
revoke all on function public.protect_website_form_purpose() from public, anon, authenticated;

create or replace function public.submit_website_enquiry(
  p_intake_key uuid,
  p_schema_key text,
  p_schema_version integer,
  p_submission_key text,
  p_answers jsonb,
  p_attribution jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_endpoint public.website_enquiry_endpoints%rowtype;
  v_schema public.website_form_schemas%rowtype;
  v_recipient_configuration public.website_enquiry_recipient_configurations%rowtype;
  v_existing public.website_enquiries%rowtype;
  v_enquiry public.website_enquiries%rowtype;
  v_definition jsonb;
  v_key text;
  v_type text;
  v_value jsonb;
  v_text text;
  v_max_length integer;
  v_normalized_answers jsonb := '{}'::jsonb;
  v_normalized_attribution jsonb := '{}'::jsonb;
  v_canonical_payload jsonb;
  v_contact_snapshot jsonb;
  v_fingerprint text;
  v_contact_id uuid;
  v_contact_name text;
  v_contact_email text;
  v_contact_phone text;
  v_created boolean := false;
  v_purpose text;
  v_now timestamptz := clock_timestamp();
begin
  if p_schema_key is null or p_schema_key !~ '^[a-z][a-z0-9_]{1,63}$'
     or p_schema_version is null or p_schema_version < 1
     or p_submission_key is null
     or char_length(p_submission_key) not between 16 and 128
     or p_submission_key !~ '^[A-Za-z0-9:_-]+$'
     or jsonb_typeof(p_answers) <> 'object'
     or jsonb_typeof(coalesce(p_attribution, '{}'::jsonb)) <> 'object' then
    raise exception 'Submission contract is invalid.' using errcode = '22023';
  end if;

  select endpoint.* into v_endpoint
  from public.website_enquiry_endpoints endpoint
  where endpoint.intake_key = p_intake_key
  for share;
  if not found then
    raise exception 'Website intake is unavailable.' using errcode = '22023';
  end if;

  select schema_row.* into v_schema
  from public.website_form_schemas schema_row
  where schema_row.endpoint_id = v_endpoint.id
    and schema_row.schema_key = p_schema_key
    and schema_row.version = p_schema_version
  for share;
  if not found then
    raise exception 'Form schema is unsupported.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(p_answers) answer_key
    where not exists (
      select 1 from jsonb_array_elements(v_schema.field_definitions) definition
      where definition ->> 'key' = answer_key
    )
  ) then
    raise exception 'Submission contains unsupported fields.' using errcode = '22023';
  end if;

  for v_definition in select value from jsonb_array_elements(v_schema.field_definitions)
  loop
    v_key := v_definition ->> 'key';
    v_type := v_definition ->> 'type';
    v_value := p_answers -> v_key;

    if v_value is null or jsonb_typeof(v_value) = 'null' then
      if coalesce((v_definition ->> 'required')::boolean, false) then
        raise exception 'Required form field is missing.' using errcode = '22023';
      end if;
      continue;
    end if;

    if v_type = 'checkbox' then
      if jsonb_typeof(v_value) <> 'boolean' then
        raise exception 'Checkbox field has invalid type.' using errcode = '22023';
      end if;
      v_normalized_answers := v_normalized_answers || jsonb_build_object(v_key, v_value);
      continue;
    end if;

    if jsonb_typeof(v_value) <> 'string' then
      raise exception 'Text-like field has invalid type.' using errcode = '22023';
    end if;
    v_text := btrim(v_value #>> '{}');
    v_max_length := (v_definition ->> 'max_length')::integer;
    if char_length(v_text) > v_max_length
       or (coalesce((v_definition ->> 'required')::boolean, false) and v_text = '') then
      raise exception 'Form field value is invalid.' using errcode = '22023';
    end if;
    if v_type = 'email' and v_text !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception 'Email field is invalid.' using errcode = '22023';
    end if;
    if v_type in ('email', 'tel') and v_text ~ '[\r\n]' then
      raise exception 'Contact field contains control characters.' using errcode = '22023';
    end if;
    if v_type = 'select' and not ((v_definition -> 'options') ? v_text) then
      raise exception 'Select field value is unsupported.' using errcode = '22023';
    end if;
    if v_type = 'email' then
      v_text := lower(v_text);
    end if;
    v_normalized_answers := v_normalized_answers || jsonb_build_object(v_key, v_text);
  end loop;

  if exists (
    select 1 from jsonb_object_keys(coalesce(p_attribution, '{}'::jsonb)) attribute_key
    where attribute_key not in (
      'landing_path', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_content', 'utm_term', 'gclid', 'device_class'
    )
  ) then
    raise exception 'Attribution contains unsupported fields.' using errcode = '22023';
  end if;
  for v_key, v_value in select key, value from jsonb_each(coalesce(p_attribution, '{}'::jsonb))
  loop
    if jsonb_typeof(v_value) = 'null' then
      continue;
    end if;
    if jsonb_typeof(v_value) <> 'string' then
      raise exception 'Attribution values must be text.' using errcode = '22023';
    end if;
    v_text := btrim(v_value #>> '{}');
    if v_key = 'referrer' then
      v_max_length := 2048;
    else
      v_max_length := 500;
    end if;
    if char_length(v_text) > v_max_length or v_text ~ '[\r\n]' then
      raise exception 'Attribution value is invalid.' using errcode = '22023';
    end if;
    v_normalized_attribution := v_normalized_attribution || jsonb_build_object(v_key, v_text);
  end loop;

  v_canonical_payload := jsonb_build_object(
    'schema_key', v_schema.schema_key,
    'schema_version', v_schema.version,
    'answers', v_normalized_answers,
    'attribution', v_normalized_attribution
  );
  v_fingerprint := md5(v_canonical_payload::text);

  -- Serialize this exact endpoint/key before any contact or outbox side effect.
  -- Hash collisions can only add harmless serialization; exact payload equality
  -- below remains the replay/conflict authority.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_endpoint.id::text || ':' || p_submission_key, 0)
  );

  select enquiry.* into v_existing
  from public.website_enquiries enquiry
  where enquiry.endpoint_id = v_endpoint.id
    and enquiry.submission_key = p_submission_key;
  if found then
    if v_existing.form_schema_id <> v_schema.id or v_existing.canonical_payload <> v_canonical_payload then
      raise exception 'Submission key was already used with different content.' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'accepted', true,
      'receipt_id', v_existing.receipt_id,
      'accepted_at', v_existing.accepted_at,
      'replayed', true
    );
  end if;

  if not v_endpoint.enabled or v_schema.status <> 'active' then
    raise exception 'Website intake is unavailable.' using errcode = '22023';
  end if;

  select configuration.* into v_recipient_configuration
  from public.website_enquiry_recipient_configurations configuration
  where configuration.endpoint_id = v_endpoint.id
    and configuration.status = 'approved'
  for share;
  if not found or not exists (
    select 1 from public.website_enquiry_recipient_routes route
    where route.recipient_configuration_id = v_recipient_configuration.id and route.active
  ) then
    raise exception 'Website intake recipient routing is unavailable.' using errcode = '22023';
  end if;

  v_purpose := v_schema.purpose;
  if v_purpose = 'subscription' and (v_normalized_answers ->> v_schema.consent_field_key) is distinct from 'true' then
    raise exception 'Subscription consent is required.' using errcode = '22023';
  end if;

  v_contact_name := nullif(btrim(v_normalized_answers ->> v_schema.contact_name_key), '');
  v_contact_email := nullif(lower(btrim(v_normalized_answers ->> v_schema.contact_email_key)), '');
  v_contact_phone := nullif(btrim(v_normalized_answers ->> v_schema.contact_phone_key), '');
  if v_purpose = 'subscription' and v_contact_email is null then
    raise exception 'Subscription email is required.' using errcode = '22023';
  end if;
  v_contact_snapshot := jsonb_strip_nulls(jsonb_build_object(
    'name', v_contact_name,
    'email', v_contact_email,
    'phone', v_contact_phone
  ));

  if v_contact_email is not null then
    insert into public.website_enquiry_contacts (
      client_id, normalized_email, display_name, phone, first_enquiry_at, last_enquiry_at
    ) values (
      v_endpoint.client_id, v_contact_email, v_contact_name, v_contact_phone, v_now, v_now
    )
    on conflict (client_id, normalized_email) where normalized_email is not null
    do update set
      last_enquiry_at = excluded.last_enquiry_at,
      updated_at = excluded.last_enquiry_at
    returning id into v_contact_id;
  else
    insert into public.website_enquiry_contacts (
      client_id, normalized_email, display_name, phone, first_enquiry_at, last_enquiry_at
    ) values (
      v_endpoint.client_id, null, v_contact_name, v_contact_phone, v_now, v_now
    ) returning id into v_contact_id;
  end if;

  insert into public.website_enquiries (
    endpoint_id, client_id, website_editor_website_id, environment,
    form_schema_id, recipient_configuration_id, contact_id, submission_key, purpose,
    payload_fingerprint, canonical_payload, contact_snapshot, attribution,
    accepted_at
  ) values (
    v_endpoint.id, v_endpoint.client_id, v_endpoint.website_editor_website_id, v_endpoint.environment,
    v_schema.id, v_recipient_configuration.id, v_contact_id, p_submission_key, v_purpose,
    v_fingerprint, v_canonical_payload, v_contact_snapshot, v_normalized_attribution,
    v_now
  )
  on conflict (endpoint_id, submission_key) do nothing
  returning * into v_enquiry;

  if not found then
    select enquiry.* into v_existing
    from public.website_enquiries enquiry
    where enquiry.endpoint_id = v_endpoint.id
      and enquiry.submission_key = p_submission_key;
    if v_existing.form_schema_id <> v_schema.id or v_existing.canonical_payload <> v_canonical_payload then
      raise exception 'Submission key was already used with different content.' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'accepted', true,
      'receipt_id', v_existing.receipt_id,
      'accepted_at', v_existing.accepted_at,
      'replayed', true
    );
  end if;
  v_created := true;

  if v_purpose <> 'subscription' then
  insert into public.website_enquiry_delivery_jobs (
    enquiry_id, endpoint_id, client_id,
    recipient_configuration_id, recipient_configuration_version,
    recipient_route_id, recipient_email_snapshot, recipient_name_snapshot,
    delivery_state, next_attempt_at
  )
  select
    v_enquiry.id, v_endpoint.id, v_endpoint.client_id,
    v_recipient_configuration.id, v_recipient_configuration.version,
    route.id, route.recipient_email, route.recipient_name,
    'pending', v_now
  from public.website_enquiry_recipient_routes route
  where route.recipient_configuration_id = v_recipient_configuration.id
    and route.active
  order by route.id;

  end if;

  if v_purpose = 'subscription' then
    insert into public.website_subscribers (endpoint_id, client_id, normalized_email, consent_receipt_id, consent_at, consent_snapshot)
    values (v_endpoint.id, v_endpoint.client_id, v_contact_email, v_enquiry.receipt_id, v_now,
      jsonb_build_object('schema_key', v_schema.schema_key, 'schema_version', v_schema.version,
        'landing_path', v_normalized_attribution ->> 'landing_path', 'consent', true))
    on conflict (endpoint_id, normalized_email) do update
      set consent_receipt_id = excluded.consent_receipt_id, consent_at = excluded.consent_at,
          consent_snapshot = excluded.consent_snapshot, status = 'subscribed';
  end if;

  if v_purpose = 'enquiry' then
  insert into public.website_enquiry_events (
    enquiry_id, endpoint_id, client_id, website_editor_website_id, environment,
    event_type, is_synthetic, event_data, occurred_at
  ) values (
    v_enquiry.id, v_endpoint.id, v_endpoint.client_id,
    v_endpoint.website_editor_website_id, v_endpoint.environment,
    'generate_lead', v_endpoint.environment <> 'production',
    jsonb_build_object(
      'form_schema_key', v_schema.schema_key,
      'form_schema_version', v_schema.version,
      'landing_path', v_normalized_attribution ->> 'landing_path'
    ),
    v_enquiry.accepted_at
  );

  end if;

  return jsonb_build_object(
    'accepted', true,
    'receipt_id', v_enquiry.receipt_id,
    'accepted_at', v_enquiry.accepted_at,
    'replayed', not v_created
  );
end;
$$;

-- Replace the three client-facing lead functions so nonlead data never enters
-- the inbox, lifecycle actions or lead metrics. Existing enquiry rows default
-- to enquiry and retain their current behavior.
create or replace function public.website_lead_inbox(
  p_client_id uuid default null,
  p_limit integer default 100,
  p_before timestamptz default null
)
returns table (
  enquiry_id uuid,
  receipt_id uuid,
  accepted_at timestamptz,
  website_editor_website_id text,
  form_schema_key text,
  form_schema_version integer,
  contact_name text,
  contact_email text,
  contact_phone text,
  fields jsonb,
  attribution jsonb,
  status text,
  quality text,
  poor_reason text,
  poor_note text,
  lifecycle_updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  select caller.client_id into v_client_id from public.website_lead_caller_client(p_client_id) caller;
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception 'Limit must be between 1 and 200' using errcode = '22023';
  end if;

  return query
  select
    enquiry.id,
    enquiry.receipt_id,
    enquiry.accepted_at,
    enquiry.website_editor_website_id,
    form_schema.schema_key,
    form_schema.version,
    enquiry.contact_snapshot ->> 'name',
    enquiry.contact_snapshot ->> 'email',
    enquiry.contact_snapshot ->> 'phone',
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', definition.value ->> 'key',
        'label', coalesce(definition.value ->> 'label', definition.value ->> 'key'),
        'type', definition.value ->> 'type',
        'value', enquiry.canonical_payload #> array['answers', definition.value ->> 'key']
      ) order by definition.ordinality)
      from jsonb_array_elements(form_schema.field_definitions) with ordinality definition
      where enquiry.canonical_payload -> 'answers' ? (definition.value ->> 'key')
    ), '[]'::jsonb),
    enquiry.attribution,
    coalesce(lead_state.status, 'new'),
    lead_state.quality,
    lead_state.poor_reason,
    lead_state.poor_note,
    lead_state.updated_at
  from public.website_enquiries enquiry
  join public.website_form_schemas form_schema
    on form_schema.id = enquiry.form_schema_id
   and form_schema.endpoint_id = enquiry.endpoint_id
  left join public.website_enquiry_lead_states lead_state
    on lead_state.enquiry_id = enquiry.id
   and lead_state.client_id = enquiry.client_id
  where enquiry.client_id = v_client_id
    -- Synthetic preview/staging enquiries are never client leads.
    and enquiry.environment = 'production'
    and enquiry.purpose = 'enquiry'
    and (p_before is null or enquiry.accepted_at < p_before)
  order by enquiry.accepted_at desc, enquiry.id desc
  limit p_limit;
end;
$$;

create or replace function public.set_website_lead_lifecycle(
  p_enquiry_id uuid,
  p_status text,
  p_quality text default null,
  p_poor_reason text default null,
  p_poor_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enquiry_client_id uuid;
  v_client_id uuid;
  v_actor_kind text;
  v_previous public.website_enquiry_lead_states%rowtype;
  v_saved public.website_enquiry_lead_states%rowtype;
  v_note text := nullif(btrim(p_poor_note), '');
begin
  select enquiry.client_id into v_enquiry_client_id
  from public.website_enquiries enquiry
  where enquiry.id = p_enquiry_id and enquiry.environment = 'production' and enquiry.purpose = 'enquiry';
  if not found then
    -- Indistinguishable from cross-client access: never confirm another client's lead exists.
    raise exception 'Not authorized for this lead' using errcode = '42501';
  end if;

  begin
    -- A client user naming another client's enquiry is rejected by the caller resolver.
    select caller.client_id, caller.actor_kind into v_client_id, v_actor_kind
    from public.website_lead_caller_client(v_enquiry_client_id) caller;
  exception when insufficient_privilege then
    raise exception 'Not authorized for this lead' using errcode = '42501';
  end;
  if v_client_id is distinct from v_enquiry_client_id then
    raise exception 'Not authorized for this lead' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('new', 'contacted', 'qualified', 'won', 'closed_lost') then
    raise exception 'Lead status is invalid' using errcode = '22023';
  end if;
  if p_quality is not null and p_quality not in ('good', 'poor') then
    raise exception 'Lead quality is invalid' using errcode = '22023';
  end if;
  if not coalesce(
    (p_status in ('new', 'contacted') and p_quality is null)
    or (p_status in ('qualified', 'won') and p_quality is not distinct from 'good')
    or (p_status = 'closed_lost' and p_quality is not null and p_quality in ('good', 'poor')),
    false
  ) then
    raise exception 'Lead status and quality do not match: Good leads are Qualified, Won or Lost; Poor leads are Closed-Lost; New and Contacted leads are unreviewed'
      using errcode = '22023';
  end if;
  if p_quality = 'poor' and p_poor_reason is null then
    raise exception 'A poor lead requires a reason' using errcode = '22023';
  end if;
  if p_quality is distinct from 'poor' and (p_poor_reason is not null or v_note is not null) then
    raise exception 'A poor-lead reason is only valid for a poor lead' using errcode = '22023';
  end if;
  if p_poor_reason = 'other' and v_note is null then
    raise exception 'An "other" poor-lead reason requires a note' using errcode = '22023';
  end if;

  select lead_state.* into v_previous
  from public.website_enquiry_lead_states lead_state
  where lead_state.enquiry_id = p_enquiry_id
  for update;

  insert into public.website_enquiry_lead_states as lead_state (
    enquiry_id, client_id, status, quality, poor_reason, poor_note, updated_by, updated_at
  ) values (
    p_enquiry_id, v_client_id, p_status, p_quality, p_poor_reason, v_note, auth.uid(), clock_timestamp()
  )
  on conflict (enquiry_id) do update set
    status = excluded.status,
    quality = excluded.quality,
    poor_reason = excluded.poor_reason,
    poor_note = excluded.poor_note,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at
  where lead_state.client_id = excluded.client_id
  returning lead_state.* into v_saved;
  if not found then
    raise exception 'Not authorized for this lead' using errcode = '42501';
  end if;

  insert into public.website_enquiry_lead_state_events (
    enquiry_id, client_id, actor_id, actor_kind,
    previous_status, status, previous_quality, quality, poor_reason
  ) values (
    p_enquiry_id, v_client_id, auth.uid(), v_actor_kind,
    coalesce(v_previous.status, 'new'), v_saved.status, v_previous.quality, v_saved.quality, v_saved.poor_reason
  );

  return jsonb_build_object(
    'enquiryId', v_saved.enquiry_id,
    'status', v_saved.status,
    'quality', v_saved.quality,
    'poorReason', v_saved.poor_reason,
    'poorNote', v_saved.poor_note,
    'updatedAt', v_saved.updated_at
  );
end;
$$;

create or replace function public.website_lead_metrics(
  p_client_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_endpoints integer;
  v_result jsonb;
begin
  select caller.client_id into v_client_id from public.website_lead_caller_client(p_client_id) caller;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 366 then
    raise exception 'Lead metrics period is invalid' using errcode = '22023';
  end if;

  select count(*) into v_endpoints
  from public.website_enquiry_endpoints endpoint
  where endpoint.client_id = v_client_id and endpoint.environment = 'production';

  select jsonb_build_object(
    'clientId', v_client_id,
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'timezone', 'Africa/Johannesburg'),
    'state', case when v_endpoints = 0 then 'not_connected' else 'available' end,
    'total', count(*),
    'new', count(*) filter (where coalesce(lead_state.status, 'new') = 'new'),
    'contacted', count(*) filter (where lead_state.status = 'contacted'),
    -- A Good lead is a qualified lead, whatever its later Won/Lost outcome.
    'qualified', count(*) filter (where lead_state.quality = 'good'),
    'won', count(*) filter (where lead_state.status = 'won'),
    'closedLost', count(*) filter (where lead_state.status = 'closed_lost'),
    'lost', count(*) filter (where lead_state.status = 'closed_lost' and lead_state.quality = 'good'),
    'good', count(*) filter (where lead_state.quality = 'good'),
    'poor', count(*) filter (where lead_state.quality = 'poor'),
    'unreviewed', count(*) filter (where lead_state.quality is null),
    'qualificationRate', case when count(*) = 0 then null else round(
      (count(*) filter (where lead_state.quality = 'good'))::numeric / count(*), 4
    ) end
  ) into v_result
  from public.website_enquiries enquiry
  left join public.website_enquiry_lead_states lead_state
    on lead_state.enquiry_id = enquiry.id
   and lead_state.client_id = enquiry.client_id
  where enquiry.client_id = v_client_id
    and enquiry.environment = 'production'
    and enquiry.purpose = 'enquiry'
    and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date >= p_from
    and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date < p_to;

  return v_result;
end;
$$;

-- A new claim contract carries purpose to the worker without modifying the
-- existing claim RPC return shape. The legacy claim is limited to lead jobs so
-- an older or SES worker cannot deliver an application with lead email copy.
create or replace function public.claim_website_enquiry_deliveries(
  p_provider text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table (
  job_id uuid,
  lease_token uuid,
  delivery_key uuid,
  attempt_count integer,
  recipient_email text,
  recipient_name text,
  enquiry_receipt_id uuid,
  enquiry_accepted_at timestamptz,
  client_name text,
  website_editor_website_id text,
  contact jsonb,
  fields jsonb,
  landing_path text
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'Delivery provider is invalid' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 50
     or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'Delivery claim bounds are invalid' using errcode = '22023';
  end if;

  update public.website_enquiry_delivery_jobs job
  set delivery_state = 'reconcile',
      reconcile_reason = 'lease_expired',
      lease_token = null,
      lease_expires_at = null,
      updated_at = v_now
  where job.delivery_state = 'leased'
    and job.lease_expires_at < v_now;

  return query
  with due as (
    select job.id
    from public.website_enquiry_delivery_jobs job
    where job.delivery_state = 'pending'
      and exists (select 1 from public.website_enquiries e where e.id = job.enquiry_id and e.purpose = 'enquiry')
      and job.next_attempt_at <= v_now
    order by job.next_attempt_at, job.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'leased',
        lease_token = gen_random_uuid(),
        lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
        attempt_count = job.attempt_count + 1,
        provider = p_provider,
        updated_at = v_now
    from due
    where job.id = due.id
    returning job.*
  )
  select
    claimed.id,
    claimed.lease_token,
    claimed.delivery_key,
    claimed.attempt_count,
    claimed.recipient_email_snapshot,
    claimed.recipient_name_snapshot,
    enquiry.receipt_id,
    enquiry.accepted_at,
    client.name,
    enquiry.website_editor_website_id,
    enquiry.contact_snapshot,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', coalesce(definition.value ->> 'label', definition.value ->> 'key'),
        'value', enquiry.canonical_payload #> array['answers', definition.value ->> 'key']
      ) order by definition.ordinality)
      from jsonb_array_elements(form_schema.field_definitions) with ordinality definition
      where enquiry.canonical_payload -> 'answers' ? (definition.value ->> 'key')
    ), '[]'::jsonb),
    enquiry.attribution ->> 'landing_path'
  from claimed
  join public.website_enquiries enquiry
    on enquiry.id = claimed.enquiry_id and enquiry.client_id = claimed.client_id
  join public.website_form_schemas form_schema
    on form_schema.id = enquiry.form_schema_id and form_schema.endpoint_id = enquiry.endpoint_id
  join public.clients client on client.id = claimed.client_id;
end;
$$;

create or replace function public.claim_website_form_deliveries(
  p_provider text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
)
returns table (
  job_id uuid,
  lease_token uuid,
  delivery_key uuid,
  attempt_count integer,
  recipient_email text,
  recipient_name text,
  enquiry_receipt_id uuid,
  enquiry_accepted_at timestamptz,
  client_name text,
  website_editor_website_id text,
  contact jsonb,
  fields jsonb,
  landing_path text,
  purpose text
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'Delivery provider is invalid' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 50
     or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'Delivery claim bounds are invalid' using errcode = '22023';
  end if;

  update public.website_enquiry_delivery_jobs job
  set delivery_state = 'reconcile',
      reconcile_reason = 'lease_expired',
      lease_token = null,
      lease_expires_at = null,
      updated_at = v_now
  where job.delivery_state = 'leased'
    and job.lease_expires_at < v_now;

  return query
  with due as (
    select job.id
    from public.website_enquiry_delivery_jobs job
    where job.delivery_state = 'pending'
      and job.next_attempt_at <= v_now
    order by job.next_attempt_at, job.created_at
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'leased',
        lease_token = gen_random_uuid(),
        lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
        attempt_count = job.attempt_count + 1,
        provider = p_provider,
        updated_at = v_now
    from due
    where job.id = due.id
    returning job.*
  )
  select
    claimed.id,
    claimed.lease_token,
    claimed.delivery_key,
    claimed.attempt_count,
    claimed.recipient_email_snapshot,
    claimed.recipient_name_snapshot,
    enquiry.receipt_id,
    enquiry.accepted_at,
    client.name,
    enquiry.website_editor_website_id,
    enquiry.contact_snapshot,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', coalesce(definition.value ->> 'label', definition.value ->> 'key'),
        'value', enquiry.canonical_payload #> array['answers', definition.value ->> 'key']
      ) order by definition.ordinality)
      from jsonb_array_elements(form_schema.field_definitions) with ordinality definition
      where enquiry.canonical_payload -> 'answers' ? (definition.value ->> 'key')
    ), '[]'::jsonb),
    enquiry.attribution ->> 'landing_path',
    enquiry.purpose
  from claimed
  join public.website_enquiries enquiry
    on enquiry.id = claimed.enquiry_id and enquiry.client_id = claimed.client_id
  join public.website_form_schemas form_schema
    on form_schema.id = enquiry.form_schema_id and form_schema.endpoint_id = enquiry.endpoint_id
  join public.clients client on client.id = claimed.client_id;
end;
$$;
revoke all on function public.claim_website_form_deliveries(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_website_form_deliveries(text, integer, integer) to service_role;

commit;
