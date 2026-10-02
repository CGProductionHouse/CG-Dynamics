-- Issue #405: SES delivery transport support (provider-neutral runtime).
--
-- SES event publishing reports complaints in addition to delivery and bounces. This adds a
-- terminal `complained` delivery state/event so complaint evidence is recorded canonically
-- (never inferred from mailboxes). Event application keeps the existing durable-inbox,
-- per-message lock and never-regress rules. Creates no rows; changes no existing job.

begin;

alter table public.website_enquiry_delivery_jobs
  drop constraint website_enquiry_delivery_jobs_delivery_state_check,
  add constraint website_enquiry_delivery_jobs_delivery_state_check check (
    delivery_state in ('pending', 'leased', 'accepted', 'delivered', 'bounced', 'failed', 'uncertain',
                       'reconcile', 'suppressed', 'complained')
  ),
  drop constraint website_enquiry_delivery_accepted_has_message,
  add constraint website_enquiry_delivery_accepted_has_message check (
    delivery_state not in ('accepted', 'delivered', 'bounced', 'complained')
    or (provider is not null and provider_message_id is not null and accepted_at is not null)
  ),
  add column complained_at timestamptz;

alter table public.website_enquiry_delivery_provider_events
  drop constraint website_enquiry_delivery_provider_events_event_check,
  add constraint website_enquiry_delivery_provider_events_event_check check (
    event in ('delivered', 'bounced', 'complained')
  );

-- Applies pending events for one provider message in occurrence order (adds `complained`).
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
  if not found or v_job.delivery_state not in ('accepted', 'delivered', 'bounced', 'complained') then
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
    elsif v_event.event = 'complained' and v_job.delivery_state in ('accepted', 'delivered') then
      -- A complaint proves receipt; it is recorded as its own terminal outcome.
      v_outcome := 'applied';
      update public.website_enquiry_delivery_jobs job
      set delivery_state = 'complained', complained_at = v_event.occurred_at,
          delivered_at = coalesce(job.delivered_at, v_event.occurred_at), updated_at = clock_timestamp()
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

-- Stores a verified provider event durably, then applies it (adds `complained`).
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
     or p_event is null or p_event not in ('delivered', 'bounced', 'complained') or p_occurred_at is null then
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

commit;
