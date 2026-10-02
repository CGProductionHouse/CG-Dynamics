-- Issue #405 M2B: website enquiry notification runtime (outbox worker contract).
--
-- Extends the M2A transactional outbox (website_enquiry_delivery_jobs). Only a trusted
-- server worker using service_role may claim, complete, reconcile or apply provider
-- events. Ambiguous provider outcomes move to `reconcile` and are never blindly resent.
-- Creates no rows, recipients, senders or provider configuration.

begin;

alter table public.website_enquiry_delivery_jobs
  add column provider text check (provider is null or provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  add column provider_message_id text check (provider_message_id is null or char_length(provider_message_id) between 1 and 200),
  add column last_error_code text check (last_error_code is null or char_length(last_error_code) between 1 and 120),
  add column reconcile_reason text check (
    reconcile_reason is null or reconcile_reason in ('lease_expired', 'ambiguous_provider_response')
  ),
  add column accepted_at timestamptz,
  add column delivered_at timestamptz,
  add column bounced_at timestamptz,
  add column failed_at timestamptz,
  add constraint website_enquiry_delivery_accepted_has_message check (
    delivery_state not in ('accepted', 'delivered', 'bounced')
    or (provider is not null and provider_message_id is not null and accepted_at is not null)
  ),
  add constraint website_enquiry_delivery_reconcile_has_reason check (
    (delivery_state = 'reconcile') = (reconcile_reason is not null)
  );

create unique index website_enquiry_delivery_provider_message_idx
  on public.website_enquiry_delivery_jobs (provider, provider_message_id)
  where provider_message_id is not null;
create index website_enquiry_delivery_leased_idx
  on public.website_enquiry_delivery_jobs (lease_expires_at)
  where delivery_state = 'leased';
create index website_enquiry_delivery_reconcile_idx
  on public.website_enquiry_delivery_jobs (updated_at)
  where delivery_state = 'reconcile';

comment on column public.website_enquiry_delivery_jobs.delivery_key is
  'Stable provider idempotency key. Every send attempt for this job reuses it.';

-- Claims due pending jobs under a lease. Expired leases are first moved to reconcile:
-- the worker may have reached the provider, so the job must never be resent blindly.
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

-- Records the provider outcome for one leased attempt. A stale or foreign lease is
-- reported, never applied. Retryable failures back off; the 5th failure is terminal.
create or replace function public.complete_website_enquiry_delivery(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_provider_message_id text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.website_enquiry_delivery_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_error text := left(nullif(btrim(p_error_code), ''), 120);
begin
  if p_outcome is null or p_outcome not in ('accepted', 'retryable_failure', 'permanent_failure', 'ambiguous') then
    raise exception 'Delivery outcome is invalid' using errcode = '22023';
  end if;
  if p_outcome = 'accepted' and nullif(btrim(p_provider_message_id), '') is null then
    raise exception 'Accepted delivery requires a provider message id' using errcode = '22023';
  end if;

  select job.* into v_job
  from public.website_enquiry_delivery_jobs job
  where job.id = p_job_id
  for update;
  if not found or v_job.delivery_state <> 'leased' or v_job.lease_token is distinct from p_lease_token then
    return jsonb_build_object('applied', false, 'reason', 'stale_lease');
  end if;

  if p_outcome = 'accepted' then
    perform public.lock_website_enquiry_provider_message(v_job.provider, btrim(p_provider_message_id));
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'accepted', provider_message_id = btrim(p_provider_message_id),
        accepted_at = v_now, last_error_code = null,
        lease_token = null, lease_expires_at = null, updated_at = v_now
    where job.id = p_job_id;
    -- Apply any delivered/bounced events that arrived before this acceptance.
    perform public.process_website_enquiry_provider_events(v_job.provider, btrim(p_provider_message_id));
  elsif p_outcome = 'ambiguous' then
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'reconcile', reconcile_reason = 'ambiguous_provider_response',
        last_error_code = v_error, lease_token = null, lease_expires_at = null, updated_at = v_now
    where job.id = p_job_id;
  elsif p_outcome = 'permanent_failure' or v_job.attempt_count >= 5 then
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'failed', failed_at = v_now, last_error_code = v_error,
        lease_token = null, lease_expires_at = null, updated_at = v_now
    where job.id = p_job_id;
  else
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'pending', last_error_code = v_error,
        next_attempt_at = v_now + make_interval(secs => least(3600, 60 * power(2, v_job.attempt_count - 1)::integer)),
        lease_token = null, lease_expires_at = null, updated_at = v_now
    where job.id = p_job_id;
  end if;

  return (
    select jsonb_build_object('applied', true, 'state', job.delivery_state, 'nextAttemptAt', job.next_attempt_at)
    from public.website_enquiry_delivery_jobs job where job.id = p_job_id
  );
end;
$$;

-- Resolves a reconcile job only from explicit evidence for its delivery_key:
--   found             provider holds the message           -> accepted (no resend)
--   absent            provider confirms nothing was sent    -> pending
--   idempotent_replay provider dedupes this delivery_key    -> pending; the resend reuses
--                     (only inside its 23h replay window)     the same key, so a message the
--                                                            provider already accepted is
--                                                            returned, never duplicated.
-- Anything else stays in reconcile for staff review.
create or replace function public.resolve_website_enquiry_delivery_reconcile(
  p_job_id uuid,
  p_resolution text,
  p_provider_message_id text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.website_enquiry_delivery_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_resolution is null or p_resolution not in ('found', 'absent', 'idempotent_replay') then
    raise exception 'Reconcile resolution is invalid' using errcode = '22023';
  end if;
  if p_resolution = 'found' and nullif(btrim(p_provider_message_id), '') is null then
    raise exception 'Found delivery requires a provider message id' using errcode = '22023';
  end if;

  select job.* into v_job from public.website_enquiry_delivery_jobs job where job.id = p_job_id for update;
  if not found or v_job.delivery_state <> 'reconcile' then
    return jsonb_build_object('applied', false, 'reason', 'not_reconciling');
  end if;
  if p_resolution = 'idempotent_replay' and v_job.created_at <= v_now - interval '23 hours' then
    return jsonb_build_object('applied', false, 'reason', 'replay_window_closed');
  end if;

  if p_resolution = 'found' then
    perform public.lock_website_enquiry_provider_message(v_job.provider, btrim(p_provider_message_id));
    update public.website_enquiry_delivery_jobs job
    set delivery_state = 'accepted', provider_message_id = btrim(p_provider_message_id),
        accepted_at = v_now, reconcile_reason = null, updated_at = v_now
    where job.id = p_job_id;
    perform public.process_website_enquiry_provider_events(v_job.provider, btrim(p_provider_message_id));
    return jsonb_build_object('applied', true, 'state', 'accepted');
  end if;

  update public.website_enquiry_delivery_jobs job
  set delivery_state = 'pending', reconcile_reason = null, next_attempt_at = v_now, updated_at = v_now
  where job.id = p_job_id;
  return jsonb_build_object('applied', true, 'state', 'pending');
end;
$$;

-- Durable inbox for verified provider events. A provider can report delivered/bounced
-- before the worker has persisted the accepted provider message id; such events are
-- stored here and applied as soon as the matching job is accepted, never dropped.
create table public.website_enquiry_delivery_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider ~ '^[a-z][a-z0-9_]{1,31}$'),
  provider_event_id text not null check (char_length(provider_event_id) between 1 and 200),
  provider_message_id text not null check (char_length(provider_message_id) between 1 and 200),
  event text not null check (event in ('delivered', 'bounced')),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (outcome is null or outcome in ('applied', 'duplicate', 'superseded')),
  check ((processed_at is null) = (outcome is null)),
  unique (provider, provider_event_id)
);

comment on table public.website_enquiry_delivery_provider_events is
  'Verified provider delivery events. Pending rows wait for the accepted provider message id; nothing verified is discarded.';

create index website_enquiry_provider_events_pending_idx
  on public.website_enquiry_delivery_provider_events (provider, provider_message_id, occurred_at)
  where processed_at is null;

alter table public.website_enquiry_delivery_provider_events enable row level security;
alter table public.website_enquiry_delivery_provider_events force row level security;
revoke all on table public.website_enquiry_delivery_provider_events from public, anon, authenticated, service_role;
grant select, insert, update on table public.website_enquiry_delivery_provider_events to service_role;

-- Serialises event storage and job acceptance for one provider message so neither side
-- can miss the other (see the race acceptance test).
create or replace function public.lock_website_enquiry_provider_message(p_provider text, p_provider_message_id text)
returns void
language sql
security invoker
set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('website_enquiry_provider_message:' || p_provider || ':' || p_provider_message_id, 0)
  );
$$;

-- Applies pending events for one provider message in occurrence order. Caller must hold
-- the message lock. Returns the number of events processed.
create or replace function public.process_website_enquiry_provider_events(p_provider text, p_provider_message_id text)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.website_enquiry_delivery_jobs%rowtype;
  v_event public.website_enquiry_delivery_provider_events%rowtype;
  v_outcome text;
  v_processed integer := 0;
begin
  select job.* into v_job
  from public.website_enquiry_delivery_jobs job
  where job.provider = p_provider and job.provider_message_id = p_provider_message_id
  for update;
  if not found or v_job.delivery_state not in ('accepted', 'delivered', 'bounced') then
    return 0;
  end if;

  for v_event in
    select provider_event.* from public.website_enquiry_delivery_provider_events provider_event
    where provider_event.provider = p_provider
      and provider_event.provider_message_id = p_provider_message_id
      and provider_event.processed_at is null
    order by provider_event.occurred_at, provider_event.received_at, provider_event.id
    for update
  loop
    if v_event.event = v_job.delivery_state then
      v_outcome := 'duplicate';
    elsif v_event.event = 'delivered' and v_job.delivery_state = 'accepted' then
      v_outcome := 'applied';
      update public.website_enquiry_delivery_jobs job
      set delivery_state = 'delivered', delivered_at = v_event.occurred_at, updated_at = clock_timestamp()
      where job.id = v_job.id
      returning job.* into v_job;
    elsif v_event.event = 'bounced' and v_job.delivery_state in ('accepted', 'delivered') then
      v_outcome := 'applied';
      update public.website_enquiry_delivery_jobs job
      set delivery_state = 'bounced', bounced_at = v_event.occurred_at, updated_at = clock_timestamp()
      where job.id = v_job.id
      returning job.* into v_job;
    else
      -- e.g. delivered reported after a bounce: recorded, never regresses state.
      v_outcome := 'superseded';
    end if;
    update public.website_enquiry_delivery_provider_events provider_event
    set processed_at = clock_timestamp(), outcome = v_outcome
    where provider_event.id = v_event.id;
    v_processed := v_processed + 1;
  end loop;
  return v_processed;
end;
$$;

-- Stores a verified provider webhook durably, then applies it if the job is accepted.
-- Returns stored=true whenever the event is safely persisted (new or replayed), so the
-- handler may acknowledge it; any database failure raises and the provider retries.
create or replace function public.apply_website_enquiry_delivery_event(
  p_provider text,
  p_provider_event_id text,
  p_provider_message_id text,
  p_event text,
  p_occurred_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_inserted boolean;
  v_message_id text := btrim(p_provider_message_id);
  v_event_id text := btrim(p_provider_event_id);
  v_event_row public.website_enquiry_delivery_provider_events%rowtype;
begin
  if p_provider is null or p_provider !~ '^[a-z][a-z0-9_]{1,31}$'
     or nullif(v_event_id, '') is null or nullif(v_message_id, '') is null
     or p_event is null or p_event not in ('delivered', 'bounced') or p_occurred_at is null then
    raise exception 'Delivery event is invalid' using errcode = '22023';
  end if;

  perform public.lock_website_enquiry_provider_message(p_provider, v_message_id);

  insert into public.website_enquiry_delivery_provider_events (
    provider, provider_event_id, provider_message_id, event, occurred_at
  ) values (p_provider, v_event_id, v_message_id, p_event, p_occurred_at)
  on conflict (provider, provider_event_id) do nothing;
  v_inserted := found;

  perform public.process_website_enquiry_provider_events(p_provider, v_message_id);

  select provider_event.* into v_event_row
  from public.website_enquiry_delivery_provider_events provider_event
  where provider_event.provider = p_provider and provider_event.provider_event_id = v_event_id;

  return jsonb_build_object(
    'stored', true,
    'replayed', not v_inserted,
    'state', coalesce(v_event_row.outcome, 'awaiting_acceptance')
  );
end;
$$;

-- Safety sweep for the worker: applies any pending events whose job is now accepted.
create or replace function public.sweep_website_enquiry_provider_events(p_limit integer default 50)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message record;
  v_total integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'Sweep limit is invalid' using errcode = '22023';
  end if;
  for v_message in
    select distinct provider_event.provider, provider_event.provider_message_id
    from public.website_enquiry_delivery_provider_events provider_event
    join public.website_enquiry_delivery_jobs job
      on job.provider = provider_event.provider and job.provider_message_id = provider_event.provider_message_id
    where provider_event.processed_at is null
    limit p_limit
  loop
    perform public.lock_website_enquiry_provider_message(v_message.provider, v_message.provider_message_id);
    v_total := v_total + public.process_website_enquiry_provider_events(v_message.provider, v_message.provider_message_id);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.claim_website_enquiry_deliveries(text, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_website_enquiry_delivery(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.resolve_website_enquiry_delivery_reconcile(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_website_enquiry_delivery_event(text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.sweep_website_enquiry_provider_events(integer) from public, anon, authenticated;
revoke all on function public.lock_website_enquiry_provider_message(text, text) from public, anon, authenticated;
revoke all on function public.process_website_enquiry_provider_events(text, text) from public, anon, authenticated;
grant execute on function public.claim_website_enquiry_deliveries(text, integer, integer) to service_role;
grant execute on function public.complete_website_enquiry_delivery(uuid, uuid, text, text, text) to service_role;
grant execute on function public.resolve_website_enquiry_delivery_reconcile(uuid, text, text) to service_role;
grant execute on function public.apply_website_enquiry_delivery_event(text, text, text, text, timestamptz) to service_role;
grant execute on function public.sweep_website_enquiry_provider_events(integer) to service_role;
grant execute on function public.lock_website_enquiry_provider_message(text, text) to service_role;
grant execute on function public.process_website_enquiry_provider_events(text, text) to service_role;

commit;
