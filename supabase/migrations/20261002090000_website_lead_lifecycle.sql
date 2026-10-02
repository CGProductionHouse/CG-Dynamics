-- Issue #405 M2B: exact-client Lead Inbox lifecycle and Website Performance lead metrics.
--
-- Builds only on the M2A canonical enquiry transaction (20261001181932). Acquisition
-- evidence (website_enquiries / website_enquiry_events) stays append-only; the client's
-- mutable lead lifecycle lives in a separate 1:1 state table with an append-only audit
-- trail. This migration creates no rows, mappings, recipients or provider configuration.

begin;

create table public.website_enquiry_lead_states (
  enquiry_id uuid primary key,
  client_id uuid not null,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'qualified', 'won', 'closed_lost')
  ),
  quality text check (quality is null or quality in ('good', 'poor')),
  poor_reason text check (
    poor_reason is null or poor_reason in (
      'spam', 'wrong_service', 'out_of_area', 'no_budget', 'duplicate', 'unreachable', 'other'
    )
  ),
  poor_note text check (poor_note is null or char_length(btrim(poor_note)) between 1 and 500),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (enquiry_id, client_id)
    references public.website_enquiries(id, client_id) on delete restrict,
  -- Deterministic #405 mapping: Good lead = Qualified (which may later be Won or
  -- Lost); Poor lead = Closed-Lost/disqualified with a reason; New/Contacted are
  -- unreviewed. Every other combination is unrepresentable.
  constraint website_enquiry_lead_states_outcome_check check (
    (status in ('new', 'contacted') and quality is null)
    or (status in ('qualified', 'won') and quality is not distinct from 'good')
    or (status = 'closed_lost' and quality is not null and quality in ('good', 'poor'))
  ),
  check ((quality = 'poor') = (poor_reason is not null)),
  check (poor_note is null or quality = 'poor'),
  check (poor_reason <> 'other' or poor_note is not null)
);

comment on table public.website_enquiry_lead_states is
  'Mutable client lead lifecycle for one canonical website enquiry. Absence means New/unreviewed. Never edits acquisition evidence.';

create table public.website_enquiry_lead_state_events (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null,
  client_id uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('client', 'staff')),
  previous_status text,
  status text not null,
  previous_quality text,
  quality text,
  poor_reason text,
  created_at timestamptz not null default now(),
  foreign key (enquiry_id, client_id)
    references public.website_enquiries(id, client_id) on delete restrict
);

comment on table public.website_enquiry_lead_state_events is
  'Append-only audit trail of lead lifecycle/quality changes. Contains no visitor PII.';

create index website_enquiry_lead_states_client_idx
  on public.website_enquiry_lead_states (client_id, status);
create index website_enquiry_lead_state_events_enquiry_idx
  on public.website_enquiry_lead_state_events (enquiry_id, created_at desc);

alter table public.website_enquiry_lead_states enable row level security;
alter table public.website_enquiry_lead_state_events enable row level security;
alter table public.website_enquiry_lead_states force row level security;
alter table public.website_enquiry_lead_state_events force row level security;

revoke all on table public.website_enquiry_lead_states from public, anon, authenticated, service_role;
revoke all on table public.website_enquiry_lead_state_events from public, anon, authenticated, service_role;
grant select on table public.website_enquiry_lead_states to service_role;
grant select on table public.website_enquiry_lead_state_events to service_role;

-- Resolves the one exact client the caller may act for. Client users are pinned to
-- their own profile client and may never name another. Staff must name an active client.
create or replace function public.website_lead_caller_client(p_client_id uuid)
returns table (client_id uuid, actor_kind text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile record;
begin
  select profile.id, profile.role, profile.client_id, profile.is_active
  into v_profile
  from public.profiles profile
  where profile.id = auth.uid();

  if not found or not v_profile.is_active then
    raise exception 'Active access required' using errcode = '42501';
  end if;

  if v_profile.role = 'client' then
    if v_profile.client_id is null
       or (p_client_id is not null and p_client_id <> v_profile.client_id) then
      raise exception 'Not authorized for this client' using errcode = '42501';
    end if;
    return query select v_profile.client_id, 'client'::text;
    return;
  end if;

  if v_profile.role in ('admin', 'manager', 'staff', 'team') then
    if p_client_id is null or not exists (
      select 1 from public.clients client where client.id = p_client_id and client.active
    ) then
      raise exception 'Active client required' using errcode = '22023';
    end if;
    return query select p_client_id, 'staff'::text;
    return;
  end if;

  raise exception 'Not authorized for this client' using errcode = '42501';
end;
$$;

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
  where enquiry.id = p_enquiry_id and enquiry.environment = 'production';
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

-- Aggregate-only lead metrics for Website Performance. No visitor PII leaves this function.
-- Period is [p_from, p_to) in Africa/Johannesburg local dates, matching monthly reporting.
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
    and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date >= p_from
    and (enquiry.accepted_at at time zone 'Africa/Johannesburg')::date < p_to;

  return v_result;
end;
$$;

revoke all on function public.website_lead_caller_client(uuid) from public, anon, authenticated, service_role;
revoke all on function public.website_lead_inbox(uuid, integer, timestamptz) from public, anon;
revoke all on function public.set_website_lead_lifecycle(uuid, text, text, text, text) from public, anon;
revoke all on function public.website_lead_metrics(uuid, date, date) from public, anon;
grant execute on function public.website_lead_inbox(uuid, integer, timestamptz) to authenticated;
grant execute on function public.set_website_lead_lifecycle(uuid, text, text, text, text) to authenticated;
grant execute on function public.website_lead_metrics(uuid, date, date) to authenticated;

commit;
