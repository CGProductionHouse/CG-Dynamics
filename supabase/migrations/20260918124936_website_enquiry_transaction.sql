-- Issue #405 M2A: canonical website enquiry transaction.
--
-- This migration is intentionally configuration-free: it creates no client/site mappings,
-- recipients, provider credentials or production data. The public submission adapter is a
-- later M2C concern. Only a trusted server using service_role may call the transaction RPC.

begin;

create table public.website_enquiry_endpoints (
  id uuid primary key default gen_random_uuid(),
  intake_key uuid not null unique default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  website_editor_website_id text not null check (char_length(btrim(website_editor_website_id)) between 1 and 160),
  environment text not null check (environment in ('production', 'preview', 'staging')),
  canonical_host text not null check (
    canonical_host = lower(canonical_host)
    and canonical_host ~ '^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$'
    and canonical_host not like '%.%.'
  ),
  enabled boolean not null default false,
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or (verified_by is not null and verified_at is not null)),
  unique (website_editor_website_id, environment),
  unique (id, client_id),
  unique (id, client_id, website_editor_website_id, environment)
);

comment on table public.website_enquiry_endpoints is
  'Reviewed server-side binding from one Website Editor Website/environment to one exact Dynamics client. The intake key is an opaque adapter capability, never browser authority for client or recipient identity.';

create table public.website_form_schemas (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.website_enquiry_endpoints(id) on delete restrict,
  schema_key text not null check (schema_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  field_definitions jsonb not null,
  contact_name_key text,
  contact_email_key text,
  contact_phone_key text,
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'draft' or (activated_by is not null and activated_at is not null)),
  check (contact_email_key is not null or contact_phone_key is not null),
  unique (endpoint_id, schema_key, version),
  unique (id, endpoint_id)
);

comment on table public.website_form_schemas is
  'Immutable-on-activation, versioned Website form contracts. Field keys are stable machine identity; labels remain presentation concerns upstream.';

create unique index website_form_schemas_one_active_idx
  on public.website_form_schemas (endpoint_id, schema_key)
  where status = 'active';

create table public.website_enquiry_recipient_configurations (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.website_enquiry_endpoints(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'approved', 'retired')),
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (status = 'draft' or (approved_by is not null and approved_at is not null)),
  unique (endpoint_id, version),
  unique (id, endpoint_id)
);

comment on table public.website_enquiry_recipient_configurations is
  'Versioned, explicitly approved client-mail routing authority. Browser submissions never provide or override this identity.';

create unique index website_enquiry_one_approved_recipient_config_idx
  on public.website_enquiry_recipient_configurations (endpoint_id)
  where status = 'approved';

create table public.website_enquiry_recipient_routes (
  id uuid primary key default gen_random_uuid(),
  recipient_configuration_id uuid not null references public.website_enquiry_recipient_configurations(id) on delete restrict,
  route_key text not null check (route_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  recipient_email text not null check (
    char_length(recipient_email) between 3 and 320
    and recipient_email = lower(btrim(recipient_email))
    and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  recipient_name text check (recipient_name is null or char_length(btrim(recipient_name)) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (recipient_configuration_id, route_key),
  unique (recipient_configuration_id, recipient_email),
  unique (id, recipient_configuration_id)
);

comment on table public.website_enquiry_recipient_routes is
  'Exact approved recipient routes. The canonical transaction snapshots these values into delivery jobs.';

create table public.website_enquiry_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  normalized_email text check (
    normalized_email is null or (
      normalized_email = lower(btrim(normalized_email))
      and char_length(normalized_email) between 3 and 320
    )
  ),
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 200),
  phone text check (phone is null or char_length(btrim(phone)) between 3 and 80),
  first_enquiry_at timestamptz not null default now(),
  last_enquiry_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);

comment on table public.website_enquiry_contacts is
  'Canonical client-scoped contact identity derived from website enquiries. A contact is not an enquiry; repeat legitimate submissions remain separate enquiry rows.';

create unique index website_enquiry_contacts_client_email_idx
  on public.website_enquiry_contacts (client_id, normalized_email)
  where normalized_email is not null;

create table public.website_enquiries (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null unique default gen_random_uuid(),
  endpoint_id uuid not null,
  client_id uuid not null,
  website_editor_website_id text not null,
  environment text not null,
  form_schema_id uuid not null,
  recipient_configuration_id uuid not null,
  contact_id uuid not null,
  submission_key text not null check (
    char_length(submission_key) between 16 and 128
    and submission_key ~ '^[A-Za-z0-9:_-]+$'
  ),
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{32}$'),
  canonical_payload jsonb not null check (jsonb_typeof(canonical_payload) = 'object'),
  contact_snapshot jsonb not null check (jsonb_typeof(contact_snapshot) = 'object'),
  attribution jsonb not null default '{}'::jsonb check (jsonb_typeof(attribution) = 'object'),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (endpoint_id, client_id, website_editor_website_id, environment)
    references public.website_enquiry_endpoints(id, client_id, website_editor_website_id, environment)
    on delete restrict,
  foreign key (form_schema_id, endpoint_id)
    references public.website_form_schemas(id, endpoint_id) on delete restrict,
  foreign key (recipient_configuration_id, endpoint_id)
    references public.website_enquiry_recipient_configurations(id, endpoint_id) on delete restrict,
  foreign key (contact_id, client_id)
    references public.website_enquiry_contacts(id, client_id) on delete restrict,
  unique (endpoint_id, submission_key),
  unique (id, client_id),
  unique (id, endpoint_id)
);

comment on table public.website_enquiries is
  'Canonical durable website enquiries. Tenant-scoped idempotency is endpoint + submission_key; email is never a cross-client or enquiry dedupe key.';

create table public.website_enquiry_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  delivery_key uuid not null unique default gen_random_uuid(),
  enquiry_id uuid not null,
  endpoint_id uuid not null,
  client_id uuid not null,
  recipient_configuration_id uuid not null,
  recipient_configuration_version integer not null check (recipient_configuration_version > 0),
  recipient_route_id uuid not null,
  recipient_email_snapshot text not null,
  recipient_name_snapshot text,
  delivery_state text not null default 'pending' check (
    delivery_state in ('pending', 'leased', 'accepted', 'delivered', 'bounced', 'failed', 'uncertain', 'reconcile')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enquiry_id, client_id)
    references public.website_enquiries(id, client_id) on delete restrict,
  foreign key (enquiry_id, endpoint_id)
    references public.website_enquiries(id, endpoint_id) on delete restrict,
  foreign key (recipient_configuration_id, endpoint_id)
    references public.website_enquiry_recipient_configurations(id, endpoint_id) on delete restrict,
  foreign key (recipient_route_id, recipient_configuration_id)
    references public.website_enquiry_recipient_routes(id, recipient_configuration_id) on delete restrict,
  check (
    (delivery_state = 'leased' and lease_token is not null and lease_expires_at is not null)
    or (delivery_state <> 'leased' and lease_token is null and lease_expires_at is null)
  ),
  unique (enquiry_id, recipient_route_id)
);

comment on table public.website_enquiry_delivery_jobs is
  'Transactional delivery outbox. M2A only creates pending jobs; provider sending, claiming and reconciliation belong to M2B.';

create table public.website_enquiry_events (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null,
  endpoint_id uuid not null,
  client_id uuid not null,
  website_editor_website_id text not null,
  environment text not null,
  event_type text not null check (event_type = 'generate_lead'),
  is_synthetic boolean not null,
  event_data jsonb not null default '{}'::jsonb check (jsonb_typeof(event_data) = 'object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  foreign key (enquiry_id, client_id)
    references public.website_enquiries(id, client_id) on delete restrict,
  foreign key (enquiry_id, endpoint_id)
    references public.website_enquiries(id, endpoint_id) on delete restrict,
  foreign key (endpoint_id, client_id, website_editor_website_id, environment)
    references public.website_enquiry_endpoints(id, client_id, website_editor_website_id, environment)
    on delete restrict,
  unique (enquiry_id, event_type)
);

comment on table public.website_enquiry_events is
  'One privacy-minimised canonical reporting event per accepted enquiry. Preview/staging identity is derived from the server endpoint and marked synthetic.';

create index website_enquiry_endpoints_client_idx
  on public.website_enquiry_endpoints (client_id, enabled);
create index website_form_schemas_endpoint_idx
  on public.website_form_schemas (endpoint_id, schema_key, version, status);
create index website_enquiry_recipient_configs_endpoint_idx
  on public.website_enquiry_recipient_configurations (endpoint_id, status, version desc);
create index website_enquiry_recipient_routes_config_idx
  on public.website_enquiry_recipient_routes (recipient_configuration_id, active);
create index website_enquiries_client_received_idx
  on public.website_enquiries (client_id, accepted_at desc);
create index website_enquiries_website_received_idx
  on public.website_enquiries (website_editor_website_id, environment, accepted_at desc);
create index website_enquiry_delivery_pending_idx
  on public.website_enquiry_delivery_jobs (next_attempt_at, created_at)
  where delivery_state = 'pending';
create index website_enquiry_delivery_client_idx
  on public.website_enquiry_delivery_jobs (client_id, created_at desc);
create index website_enquiry_events_reporting_idx
  on public.website_enquiry_events (client_id, website_editor_website_id, environment, occurred_at desc)
  where not is_synthetic;

create or replace function public.validate_website_form_schema()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_definition jsonb;
  v_key text;
  v_type text;
  v_required_contact boolean := false;
begin
  if jsonb_typeof(new.field_definitions) <> 'array'
     or jsonb_array_length(new.field_definitions) < 1
     or jsonb_array_length(new.field_definitions) > 32 then
    raise exception 'Form schema must contain between 1 and 32 field definitions.' using errcode = '23514';
  end if;

  if (select count(*) from jsonb_array_elements(new.field_definitions)) <>
     (select count(distinct definition ->> 'key') from jsonb_array_elements(new.field_definitions) definition) then
    raise exception 'Form schema field keys must be unique.' using errcode = '23514';
  end if;

  for v_definition in select value from jsonb_array_elements(new.field_definitions)
  loop
    if jsonb_typeof(v_definition) <> 'object' then
      raise exception 'Every form field definition must be an object.' using errcode = '23514';
    end if;
    v_key := v_definition ->> 'key';
    v_type := v_definition ->> 'type';
    if v_key is null or v_key !~ '^[a-z][a-z0-9_]{1,63}$' then
      raise exception 'Form field key is invalid.' using errcode = '23514';
    end if;
    if v_type not in ('text', 'textarea', 'email', 'tel', 'select', 'checkbox') then
      raise exception 'Form field type is unsupported.' using errcode = '23514';
    end if;
    if v_type <> 'checkbox' and (
      not (v_definition ? 'max_length')
      or (v_definition ->> 'max_length') !~ '^[0-9]+$'
      or (v_definition ->> 'max_length')::integer not between 1 and 4000
    ) then
      raise exception 'Text-like fields require max_length between 1 and 4000.' using errcode = '23514';
    end if;
    if v_type = 'select' and (
      jsonb_typeof(v_definition -> 'options') <> 'array'
      or jsonb_array_length(v_definition -> 'options') < 1
      or jsonb_array_length(v_definition -> 'options') > 50
    ) then
      raise exception 'Select fields require between 1 and 50 options.' using errcode = '23514';
    end if;
    if coalesce((v_definition ->> 'required')::boolean, false)
       and v_key in (new.contact_email_key, new.contact_phone_key) then
      v_required_contact := true;
    end if;
  end loop;

  if new.contact_name_key is not null and not exists (
    select 1 from jsonb_array_elements(new.field_definitions) definition
    where definition ->> 'key' = new.contact_name_key and definition ->> 'type' in ('text', 'textarea')
  ) then
    raise exception 'contact_name_key must reference a text field.' using errcode = '23514';
  end if;
  if new.contact_email_key is not null and not exists (
    select 1 from jsonb_array_elements(new.field_definitions) definition
    where definition ->> 'key' = new.contact_email_key and definition ->> 'type' = 'email'
  ) then
    raise exception 'contact_email_key must reference an email field.' using errcode = '23514';
  end if;
  if new.contact_phone_key is not null and not exists (
    select 1 from jsonb_array_elements(new.field_definitions) definition
    where definition ->> 'key' = new.contact_phone_key and definition ->> 'type' = 'tel'
  ) then
    raise exception 'contact_phone_key must reference a tel field.' using errcode = '23514';
  end if;
  if not v_required_contact then
    raise exception 'At least one configured contact method must be required.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if not (
      old.status = 'active' and new.status = 'retired'
      and new.endpoint_id = old.endpoint_id
      and new.schema_key = old.schema_key
      and new.version = old.version
      and new.field_definitions = old.field_definitions
      and new.contact_name_key is not distinct from old.contact_name_key
      and new.contact_email_key is not distinct from old.contact_email_key
      and new.contact_phone_key is not distinct from old.contact_phone_key
      and new.activated_by is not distinct from old.activated_by
      and new.activated_at is not distinct from old.activated_at
    ) then
      raise exception 'Activated form schema versions are immutable.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_website_form_schema
  before insert or update on public.website_form_schemas
  for each row execute function public.validate_website_form_schema();

create or replace function public.protect_website_recipient_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_configuration_id uuid := case when tg_op = 'DELETE' then old.recipient_configuration_id else new.recipient_configuration_id end;
begin
  if exists (
    select 1 from public.website_enquiry_recipient_configurations configuration
    where configuration.id = v_configuration_id and configuration.status <> 'draft'
  ) then
    raise exception 'Approved recipient routes are immutable; create a new configuration version.' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_website_recipient_routes
  before insert or update or delete on public.website_enquiry_recipient_routes
  for each row execute function public.protect_website_recipient_configuration();

create or replace function public.protect_approved_website_recipient_configuration()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and not (
    old.status = 'approved' and new.status = 'retired'
    and new.endpoint_id = old.endpoint_id
    and new.version = old.version
    and new.approved_by is not distinct from old.approved_by
    and new.approved_at is not distinct from old.approved_at
  ) then
    raise exception 'Approved recipient configuration versions are immutable.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger protect_approved_website_recipient_configuration
  before update on public.website_enquiry_recipient_configurations
  for each row execute function public.protect_approved_website_recipient_configuration();

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

  v_contact_name := nullif(btrim(v_normalized_answers ->> v_schema.contact_name_key), '');
  v_contact_email := nullif(lower(btrim(v_normalized_answers ->> v_schema.contact_email_key)), '');
  v_contact_phone := nullif(btrim(v_normalized_answers ->> v_schema.contact_phone_key), '');
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
    form_schema_id, recipient_configuration_id, contact_id, submission_key,
    payload_fingerprint, canonical_payload, contact_snapshot, attribution,
    accepted_at
  ) values (
    v_endpoint.id, v_endpoint.client_id, v_endpoint.website_editor_website_id, v_endpoint.environment,
    v_schema.id, v_recipient_configuration.id, v_contact_id, p_submission_key,
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

  return jsonb_build_object(
    'accepted', true,
    'receipt_id', v_enquiry.receipt_id,
    'accepted_at', v_enquiry.accepted_at,
    'replayed', not v_created
  );
end;
$$;

alter table public.website_enquiry_endpoints enable row level security;
alter table public.website_form_schemas enable row level security;
alter table public.website_enquiry_recipient_configurations enable row level security;
alter table public.website_enquiry_recipient_routes enable row level security;
alter table public.website_enquiry_contacts enable row level security;
alter table public.website_enquiries enable row level security;
alter table public.website_enquiry_delivery_jobs enable row level security;
alter table public.website_enquiry_events enable row level security;

alter table public.website_enquiry_endpoints force row level security;
alter table public.website_form_schemas force row level security;
alter table public.website_enquiry_recipient_configurations force row level security;
alter table public.website_enquiry_recipient_routes force row level security;
alter table public.website_enquiry_contacts force row level security;
alter table public.website_enquiries force row level security;
alter table public.website_enquiry_delivery_jobs force row level security;
alter table public.website_enquiry_events force row level security;

revoke all on table public.website_enquiry_endpoints from public, anon, authenticated;
revoke all on table public.website_form_schemas from public, anon, authenticated;
revoke all on table public.website_enquiry_recipient_configurations from public, anon, authenticated;
revoke all on table public.website_enquiry_recipient_routes from public, anon, authenticated;
revoke all on table public.website_enquiry_contacts from public, anon, authenticated;
revoke all on table public.website_enquiries from public, anon, authenticated;
revoke all on table public.website_enquiry_delivery_jobs from public, anon, authenticated;
revoke all on table public.website_enquiry_events from public, anon, authenticated;

grant select, insert, update on table public.website_enquiry_endpoints to service_role;
grant select, insert, update on table public.website_form_schemas to service_role;
grant select, insert, update on table public.website_enquiry_recipient_configurations to service_role;
grant select, insert, update, delete on table public.website_enquiry_recipient_routes to service_role;
grant select, insert, update on table public.website_enquiry_contacts to service_role;
grant select, insert on table public.website_enquiries to service_role;
grant select, insert, update on table public.website_enquiry_delivery_jobs to service_role;
grant select, insert on table public.website_enquiry_events to service_role;

revoke all on function public.validate_website_form_schema() from public, anon, authenticated;
revoke all on function public.protect_website_recipient_configuration() from public, anon, authenticated;
revoke all on function public.protect_approved_website_recipient_configuration() from public, anon, authenticated;
revoke all on function public.submit_website_enquiry(uuid, text, integer, text, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.submit_website_enquiry(uuid, text, integer, text, jsonb, jsonb)
  to service_role;

commit;
