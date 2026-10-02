-- Issue #405 notification runtime actual PostgreSQL acceptance.
-- Run only against the disposable database created by:
--   scripts/website-enquiry-delivery-acceptance.mjs
-- Fixtures are disposable test identities. No provider is contacted.

insert into public.clients (id, name, active) values
  ('40700000-0000-4000-8000-000000000001', 'Delivery Client A', true);
insert into auth.users (id) values ('40710000-0000-4000-8000-000000000001');
insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('40710000-0000-4000-8000-000000000001', 'Delivery Manager', 'manager', null, true);

insert into public.website_enquiry_endpoints (
  id, intake_key, client_id, website_editor_website_id, environment, canonical_host, enabled, verified_by, verified_at
) values (
  '40720000-0000-4000-8000-000000000001', '40721000-0000-4000-8000-000000000001',
  '40700000-0000-4000-8000-000000000001', 'site-a', 'production', 'a.example.test',
  true, '40710000-0000-4000-8000-000000000001', now()
);
insert into public.website_form_schemas (
  id, endpoint_id, schema_key, version, status, field_definitions,
  contact_name_key, contact_email_key, contact_phone_key, activated_by, activated_at
) values (
  '40730000-0000-4000-8000-000000000001', '40720000-0000-4000-8000-000000000001', 'contact_form', 1, 'active',
  '[
    {"key":"name","label":"Your name","type":"text","required":true,"max_length":120},
    {"key":"email","label":"Email","type":"email","required":true,"max_length":320},
    {"key":"message","label":"Message","type":"textarea","required":true,"max_length":2000}
  ]'::jsonb,
  'name', 'email', null, '40710000-0000-4000-8000-000000000001', now()
);
insert into public.website_enquiry_recipient_configurations (id, endpoint_id, version, status)
values ('40740000-0000-4000-8000-000000000001', '40720000-0000-4000-8000-000000000001', 1, 'draft');
insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email, recipient_name) values
  ('40740000-0000-4000-8000-000000000001', 'sales_primary', 'sales@example.test', 'Sales'),
  ('40740000-0000-4000-8000-000000000001', 'sales_backup', 'backup@example.test', 'Backup');
update public.website_enquiry_recipient_configurations
set status = 'approved', approved_by = '40710000-0000-4000-8000-000000000001', approved_at = now();

set role service_role;
select public.submit_website_enquiry('40721000-0000-4000-8000-000000000001', 'contact_form', 1, 'delivery-0000000001',
  '{"name":"Visitor One","email":"visitor@example.test","message":"Please call me"}'::jsonb, '{"landing_path":"/contact"}'::jsonb);
select public.submit_website_enquiry('40721000-0000-4000-8000-000000000001', 'contact_form', 1, 'delivery-0000000002',
  '{"name":"Visitor Two","email":"two@example.test","message":"Second"}'::jsonb, '{}'::jsonb);
reset role;

do $$
begin
  assert not has_function_privilege('authenticated', 'public.claim_website_enquiry_deliveries(text, integer, integer)', 'execute'), 'browser can claim deliveries';
  assert not has_function_privilege('anon', 'public.apply_website_enquiry_delivery_event(text, text, text, text, timestamptz)', 'execute'), 'anon can apply provider events';
  assert not has_function_privilege('authenticated', 'public.complete_website_enquiry_delivery(uuid, uuid, text, text, text)', 'execute'), 'browser can complete deliveries';
  assert not has_function_privilege('authenticated', 'public.resolve_website_enquiry_delivery_reconcile(uuid, text, text)', 'execute'), 'browser can reconcile deliveries';
  assert has_function_privilege('service_role', 'public.claim_website_enquiry_deliveries(text, integer, integer)', 'execute'), 'worker cannot claim';
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'pending') = 4, 'expected four pending jobs';
end $$;

set role service_role;
create temporary table claim_one as
select * from public.claim_website_enquiry_deliveries('resend', 2, 60);
create temporary table claim_two as
select * from public.claim_website_enquiry_deliveries('resend', 10, 60);
reset role;

do $$
declare
  v_row record;
  v_result jsonb;
begin
  -- Two claims never overlap; each job carries its stable idempotency key and an email payload.
  assert (select count(*) from claim_one) = 2 and (select count(*) from claim_two) = 2, 'claim sizes wrong';
  assert not exists (select 1 from claim_one join claim_two using (job_id)), 'a job was claimed twice';
  select * into v_row from claim_one order by job_id limit 1;
  assert v_row.attempt_count = 1, 'attempt not counted';
  assert v_row.client_name = 'Delivery Client A', 'client name missing';
  assert v_row.contact ->> 'email' is not null, 'reply-to contact missing';
  assert jsonb_array_length(v_row.fields) = 3 and v_row.fields -> 0 ->> 'label' = 'Your name', 'labelled fields missing';
  assert (select delivery_key from public.website_enquiry_delivery_jobs where id = v_row.job_id) = v_row.delivery_key, 'delivery key changed';

  -- Nothing left to claim while leased.
  assert (select count(*) from public.claim_website_enquiry_deliveries('resend', 10, 60)) = 0, 'leased job re-claimed';
end $$;

set role service_role;
do $$
declare
  v_jobs uuid[];
  v_tokens uuid[];
  v_result jsonb;
  v_message text;
begin
  select array_agg(job_id order by job_id), array_agg(lease_token order by job_id) into v_jobs, v_tokens
  from (select job_id, lease_token from claim_one union all select job_id, lease_token from claim_two) claimed;

  -- Stale/foreign lease is reported, not applied.
  v_result := public.complete_website_enquiry_delivery(v_jobs[1], gen_random_uuid(), 'accepted', 'msg-x');
  assert v_result ->> 'reason' = 'stale_lease', v_result::text;

  begin
    perform public.complete_website_enquiry_delivery(v_jobs[1], v_tokens[1], 'accepted', null);
    raise exception 'accepted without message id';
  exception when invalid_parameter_value then null;
  end;

  -- Job 1: accepted -> delivered (distinct states, idempotent webhook replay).
  v_result := public.complete_website_enquiry_delivery(v_jobs[1], v_tokens[1], 'accepted', 'msg-1');
  assert v_result ->> 'state' = 'accepted', v_result::text;
  v_result := public.complete_website_enquiry_delivery(v_jobs[1], v_tokens[1], 'accepted', 'msg-1');
  assert v_result ->> 'reason' = 'stale_lease', 'completion replay re-applied';
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-1', 'msg-1', 'delivered', now());
  assert v_result ->> 'state' = 'applied', v_result::text;
  assert (select delivery_state from public.website_enquiry_delivery_jobs where id = v_jobs[1]) = 'delivered', 'delivered not applied';
  -- Same provider event replayed: stored once, acknowledged as a replay.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-1', 'msg-1', 'delivered', now());
  assert (v_result ->> 'replayed')::boolean and v_result ->> 'state' = 'applied', v_result::text;
  -- A second, distinct delivered event for the same message is a duplicate outcome.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-1b', 'msg-1', 'delivered', now());
  assert v_result ->> 'state' = 'duplicate', v_result::text;
  -- Unknown message: durably stored and awaiting acceptance, never silently dropped.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-unknown', 'unknown-msg', 'delivered', now());
  assert (v_result ->> 'stored')::boolean and v_result ->> 'state' = 'awaiting_acceptance', v_result::text;
  assert exists (select 1 from public.website_enquiry_delivery_provider_events where provider_event_id = 'evt-unknown' and processed_at is null), 'early event lost';

  -- Job 2: retryable failure backs off to pending, never lost.
  v_result := public.complete_website_enquiry_delivery(v_jobs[2], v_tokens[2], 'retryable_failure', null, 'http_503');
  assert v_result ->> 'state' = 'pending', v_result::text;
  assert (v_result ->> 'nextAttemptAt')::timestamptz > now(), 'no backoff applied';

  -- Job 3: ambiguous provider response -> reconcile; never re-claimed blindly.
  v_result := public.complete_website_enquiry_delivery(v_jobs[3], v_tokens[3], 'ambiguous', null, 'timeout_after_send');
  assert v_result ->> 'state' = 'reconcile', v_result::text;

  -- Job 4: permanent failure is terminal; delivered event cannot resurrect it.
  v_result := public.complete_website_enquiry_delivery(v_jobs[4], v_tokens[4], 'permanent_failure', null, 'http_422');
  assert v_result ->> 'state' = 'failed', v_result::text;
end $$;
reset role;

do $$
declare
  v_reconcile uuid;
begin
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'reconcile') = 1, 'reconcile count';
  -- Expire the backoff so only truly due jobs are claimable; reconcile/failed stay put.
  update public.website_enquiry_delivery_jobs set next_attempt_at = now() - interval '1 second' where delivery_state = 'pending';
end $$;

set role service_role;
do $$
declare
  v_claimed integer;
  v_job uuid;
  v_token uuid;
  v_result jsonb;
begin
  select count(*) into v_claimed from public.claim_website_enquiry_deliveries('resend', 10, 60);
  assert v_claimed = 1, format('only the retry job may be claimed, got %s', v_claimed);

  -- Reconcile: provider confirms the message exists -> accepted, no resend.
  select id into v_job from public.website_enquiry_delivery_jobs where delivery_state = 'reconcile';
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_job, 'found', 'msg-3');
  assert v_result ->> 'state' = 'accepted', v_result::text;
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_job, 'absent');
  assert v_result ->> 'reason' = 'not_reconciling', 'reconcile re-applied';

  -- Bounce after acceptance is recorded distinctly.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-3', 'msg-3', 'bounced', now());
  assert v_result ->> 'state' = 'applied', v_result::text;
  assert (select delivery_state from public.website_enquiry_delivery_jobs where provider_message_id = 'msg-3') = 'bounced', 'bounce not applied';
end $$;
reset role;

-- Expired lease -> reconcile (worker may have reached the provider).
update public.website_enquiry_delivery_jobs
set lease_expires_at = now() - interval '1 second'
where delivery_state = 'leased';

set role service_role;
do $$
declare
  v_job uuid;
  v_result jsonb;
begin
  assert (select count(*) from public.claim_website_enquiry_deliveries('resend', 10, 60)) = 0, 'expired lease was resent';
  select id into v_job from public.website_enquiry_delivery_jobs where reconcile_reason = 'lease_expired';
  assert v_job is not null, 'expired lease not moved to reconcile';
  begin
    perform public.resolve_website_enquiry_delivery_reconcile(v_job, 'resend_anyway');
    raise exception 'unknown reconcile resolution accepted';
  exception when invalid_parameter_value then null;
  end;
  -- Inside the provider replay window the same delivery key may be replayed safely.
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_job, 'idempotent_replay');
  assert v_result ->> 'state' = 'pending', v_result::text;
end $$;
reset role;

-- Retry exhaustion: 5th failed attempt is terminal.
do $$
declare
  v_job uuid;
  v_token uuid;
  v_result jsonb;
  i integer;
begin
  for i in 1..10 loop
    update public.website_enquiry_delivery_jobs set next_attempt_at = now() - interval '1 second' where delivery_state = 'pending';
    select job_id, lease_token into v_job, v_token from public.claim_website_enquiry_deliveries('resend', 1, 60);
    exit when v_job is null;
    v_result := public.complete_website_enquiry_delivery(v_job, v_token, 'retryable_failure', null, 'http_503');
    exit when v_result ->> 'state' = 'failed';
  end loop;
  assert (select attempt_count from public.website_enquiry_delivery_jobs where id = v_job) = 5, 'retry cap not 5';
  assert (select delivery_state from public.website_enquiry_delivery_jobs where id = v_job) = 'failed', 'exhausted job not failed';
end $$;

-- Outside the provider replay window an ambiguous job is never replayed automatically.
do $$
declare
  v_job uuid;
  v_result jsonb;
begin
  select id into v_job from public.website_enquiry_delivery_jobs where delivery_state = 'failed' limit 1;
  update public.website_enquiry_delivery_jobs
  set delivery_state = 'reconcile', reconcile_reason = 'ambiguous_provider_response', created_at = now() - interval '2 days'
  where id = v_job;
  set local role service_role;
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_job, 'idempotent_replay');
  assert v_result ->> 'reason' = 'replay_window_closed', v_result::text;
  reset role;
  update public.website_enquiry_delivery_jobs
  set delivery_state = 'failed', reconcile_reason = null
  where id = v_job;
end $$;

-- Email failure never loses the enquiry or its lead record.
do $$
begin
  assert (select count(*) from public.website_enquiries) = 2, 'enquiries lost';
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'failed') = 2, 'failed count';
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'delivered') = 1, 'delivered count';
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'bounced') = 1, 'bounced count';
end $$;

-- ===== Webhook-before-acceptance race regressions =====
create extension if not exists dblink with schema extensions;

set role service_role;
select public.submit_website_enquiry('40721000-0000-4000-8000-000000000001', 'contact_form', 1, 'delivery-race-000001',
  '{"name":"Race One","email":"race1@example.test","message":"Race"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40721000-0000-4000-8000-000000000001', 'contact_form', 1, 'delivery-race-000002',
  '{"name":"Race Two","email":"race2@example.test","message":"Race"}'::jsonb, '{}'::jsonb);
reset role;

-- Only the four new race jobs are pending and due.
update public.website_enquiry_delivery_jobs set next_attempt_at = now() + interval '1 day'
where delivery_state = 'pending'
  and enquiry_id not in (select id from public.website_enquiries where submission_key like 'delivery-race-%');

create temporary table race_claims as
select job_id, lease_token from public.claim_website_enquiry_deliveries('resend', 10, 300) order by job_id;

do $$
declare
  v_jobs uuid[] := (select array_agg(job_id order by job_id) from race_claims);
  v_tokens uuid[] := (select array_agg(lease_token order by job_id) from race_claims);
  v_result jsonb;
begin
  assert array_length(v_jobs, 1) = 4, 'race jobs not claimed';

  -- Race 1 (sequential): delivered arrives BEFORE the worker persists acceptance.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-race-1', 'msg-race-1', 'delivered', now());
  assert v_result ->> 'state' = 'awaiting_acceptance', v_result::text;
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-race-1', 'msg-race-1', 'delivered', now());
  assert (v_result ->> 'replayed')::boolean and v_result ->> 'state' = 'awaiting_acceptance', 'provider retry not idempotent';
  v_result := public.complete_website_enquiry_delivery(v_jobs[1], v_tokens[1], 'accepted', 'msg-race-1');
  assert v_result ->> 'state' = 'delivered', format('early delivered event lost on acceptance: %s', v_result);
  assert (select outcome from public.website_enquiry_delivery_provider_events where provider_event_id = 'evt-race-1') = 'applied', 'early event not marked applied';

  -- Race 2: bounced and delivered both arrive early and out of order; applied by occurrence.
  perform public.apply_website_enquiry_delivery_event('resend', 'evt-race-2b', 'msg-race-2', 'bounced', now());
  perform public.apply_website_enquiry_delivery_event('resend', 'evt-race-2d', 'msg-race-2', 'delivered', now() - interval '1 minute');
  v_result := public.complete_website_enquiry_delivery(v_jobs[2], v_tokens[2], 'accepted', 'msg-race-2');
  assert v_result ->> 'state' = 'bounced', v_result::text;
  assert (select delivered_at is not null and bounced_at is not null from public.website_enquiry_delivery_jobs where id = v_jobs[2]), 'out-of-order evidence lost';
  assert (select count(*) from public.website_enquiry_delivery_provider_events
          where provider_message_id = 'msg-race-2' and outcome = 'applied') = 2, 'out-of-order events not both applied';

  -- A late delivered after bounce is recorded but never regresses state.
  v_result := public.apply_website_enquiry_delivery_event('resend', 'evt-race-2late', 'msg-race-2', 'delivered', now());
  assert v_result ->> 'state' = 'superseded', v_result::text;
  assert (select delivery_state from public.website_enquiry_delivery_jobs where id = v_jobs[2]) = 'bounced', 'state regressed';

  -- Race 3: early event + reconcile resolution 'found' also applies it.
  perform public.apply_website_enquiry_delivery_event('resend', 'evt-race-3', 'msg-race-3', 'delivered', now());
  perform public.complete_website_enquiry_delivery(v_jobs[3], v_tokens[3], 'ambiguous', null, 'timeout_after_send');
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_jobs[3], 'found', 'msg-race-3');
  assert (select delivery_state from public.website_enquiry_delivery_jobs where id = v_jobs[3]) = 'delivered', 'early event lost on reconcile';
end $$;

-- Race 4 (two real sessions): the webhook transaction has stored the event but not yet
-- committed while the worker records acceptance. The worker must wait, then apply it.
select extensions.dblink_connect('race_webhook', 'host=127.0.0.1 dbname=cg_website_enquiry_acceptance user=supabase_admin password=postgres');
select extensions.dblink_connect('race_worker', 'host=127.0.0.1 dbname=cg_website_enquiry_acceptance user=supabase_admin password=postgres');
select extensions.dblink_exec('race_webhook', 'begin');
select * from extensions.dblink('race_webhook',
  $q$select public.apply_website_enquiry_delivery_event('resend', 'evt-race-4', 'msg-race-4', 'delivered', now())$q$
) as result(outcome jsonb);

select extensions.dblink_send_query('race_worker', format(
  $q$select public.complete_website_enquiry_delivery(%L::uuid, %L::uuid, 'accepted', 'msg-race-4')$q$,
  (select job_id from race_claims order by job_id offset 3 limit 1),
  (select lease_token from race_claims order by job_id offset 3 limit 1)
));
select pg_sleep(0.5);
do $$
begin
  assert extensions.dblink_is_busy('race_worker') = 1, 'worker did not wait for the in-flight webhook transaction';
end $$;
select extensions.dblink_exec('race_webhook', 'commit');

create temporary table race_worker_result as
select outcome from extensions.dblink_get_result('race_worker') as result(outcome jsonb);
do $$
begin
  assert (select outcome ->> 'state' from race_worker_result) = 'delivered', (select outcome::text from race_worker_result);
  assert (select delivery_state from public.website_enquiry_delivery_jobs where provider_message_id = 'msg-race-4') = 'delivered', 'concurrent early event lost';
  assert (select outcome from public.website_enquiry_delivery_provider_events where provider_event_id = 'evt-race-4') = 'applied', 'concurrent event not applied';
end $$;
select extensions.dblink_disconnect('race_webhook');
select extensions.dblink_disconnect('race_worker');

-- Worker sweep is safe and idempotent: nothing pending for accepted jobs remains.
set role service_role;
do $$
begin
  assert public.sweep_website_enquiry_provider_events(50) = 0, 'sweep found unapplied events for accepted jobs';
  -- The truly unknown message stays durably pending (not acknowledged-and-lost).
  assert exists (select 1 from public.website_enquiry_delivery_provider_events where provider_event_id = 'evt-unknown' and processed_at is null), 'unknown event discarded';
end $$;
reset role;

select 'Delivery runtime acceptance passed' as result;
