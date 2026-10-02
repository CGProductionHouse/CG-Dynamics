-- Issue #405 delivery suppression actual PostgreSQL acceptance.
-- Run only against the disposable database created by:
--   scripts/website-enquiry-delivery-suppression-acceptance.mjs
-- Fixtures are disposable test identities. No provider is contacted.

insert into public.clients (id, name, active) values
  ('40800000-0000-4000-8000-000000000001', 'Suppression Client A', true);
insert into auth.users (id) values
  ('40810000-0000-4000-8000-000000000001'),
  ('40810000-0000-4000-8000-000000000002'),
  ('40810000-0000-4000-8000-000000000003'),
  ('40810000-0000-4000-8000-000000000004'),
  ('40810000-0000-4000-8000-000000000005');
insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('40810000-0000-4000-8000-000000000001', 'CG Admin', 'admin', null, true),
  ('40810000-0000-4000-8000-000000000002', 'CG Manager', 'manager', null, true),
  ('40810000-0000-4000-8000-000000000003', 'CG Team', 'team', null, true),
  ('40810000-0000-4000-8000-000000000004', 'Client A User', 'client', '40800000-0000-4000-8000-000000000001', true),
  ('40810000-0000-4000-8000-000000000005', 'Inactive Admin', 'admin', null, false);

insert into public.website_enquiry_endpoints (id, intake_key, client_id, website_editor_website_id, environment, canonical_host)
values ('40820000-0000-4000-8000-000000000001', '40821000-0000-4000-8000-000000000001',
        '40800000-0000-4000-8000-000000000001', 'site-a', 'production', 'a.example.test');
insert into public.website_form_schemas (id, endpoint_id, schema_key, version, field_definitions, contact_name_key, contact_email_key)
values ('40830000-0000-4000-8000-000000000001', '40820000-0000-4000-8000-000000000001', 'contact_form', 1,
  '[{"key":"name","label":"Name","type":"text","required":true,"max_length":120},
    {"key":"email","label":"Email","type":"email","required":true,"max_length":320},
    {"key":"subject","label":"Subject","type":"text","required":false,"max_length":200},
    {"key":"message","label":"Message","type":"textarea","required":true,"max_length":2000}]'::jsonb,
  'name', 'email');
insert into public.website_enquiry_recipient_configurations (id, endpoint_id, version)
values ('40840000-0000-4000-8000-000000000001', '40820000-0000-4000-8000-000000000001', 1);
insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email)
values ('40840000-0000-4000-8000-000000000001', 'primary', 'inbox@example.test');
update public.website_enquiry_recipient_configurations
set status = 'approved', approved_by = '40810000-0000-4000-8000-000000000001', approved_at = now();
update public.website_form_schemas
set status = 'active', activated_by = '40810000-0000-4000-8000-000000000001', activated_at = now();
update public.website_enquiry_endpoints
set enabled = true, verified_by = '40810000-0000-4000-8000-000000000001', verified_at = now();

set role service_role;
select public.submit_website_enquiry('40821000-0000-4000-8000-000000000001', 'contact_form', 1, 'suppress-test-000001',
  '{"name":"Pilot","email":"pilot@example.test","subject":"pilot","message":"ACCEPTANCE TEST - DO NOT ACTION"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40821000-0000-4000-8000-000000000001', 'contact_form', 1, 'suppress-test-000002',
  '{"name":"Two","email":"two@example.test","message":"real"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40821000-0000-4000-8000-000000000001', 'contact_form', 1, 'suppress-test-000003',
  '{"name":"Three","email":"three@example.test","message":"real"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40821000-0000-4000-8000-000000000001', 'contact_form', 1, 'suppress-test-000004',
  '{"name":"Four","email":"four@example.test","message":"race"}'::jsonb, '{}'::jsonb);
reset role;

create temporary table job_ids as
select enquiry.submission_key, job.id as job_id
from public.website_enquiry_delivery_jobs job join public.website_enquiries enquiry on enquiry.id = job.enquiry_id;
grant select on job_ids to authenticated, service_role;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true);
end $$;

do $$
begin
  assert has_function_privilege('authenticated', 'public.suppress_website_enquiry_delivery(uuid, text, text)', 'execute'), 'admin path not callable';
  assert not has_function_privilege('anon', 'public.suppress_website_enquiry_delivery(uuid, text, text)', 'execute'), 'anon can suppress';
  assert not has_function_privilege('anon', 'public.website_enquiry_delivery_preflight()', 'execute'), 'anon can read preflight';
  assert (select count(*) from public.website_enquiry_delivery_jobs where delivery_state = 'pending') = 4, 'expected four pending jobs';
end $$;

-- Authorization: client users, non-manager staff, inactive admins and anonymous sessions are refused.
begin;
set local role authenticated;
do $$
declare
  v_user uuid;
  v_job uuid := (select job_id from job_ids where submission_key = 'suppress-test-000001');
begin
  foreach v_user in array array[
    '40810000-0000-4000-8000-000000000004'::uuid, '40810000-0000-4000-8000-000000000003'::uuid,
    '40810000-0000-4000-8000-000000000005'::uuid, null::uuid
  ] loop
    perform pg_temp.as_user(v_user);
    begin
      perform public.suppress_website_enquiry_delivery(v_job, 'acceptance_test');
      raise exception 'unauthorised suppression accepted for %', v_user;
    exception when insufficient_privilege then null;
    end;
    begin
      perform * from public.website_enquiry_delivery_preflight();
      raise exception 'unauthorised preflight read for %', v_user;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
commit;

-- Admin: preflight lists sendable jobs; invalid input refused; pilot job suppressed and audited.
begin;
set local role authenticated;
select pg_temp.as_user('40810000-0000-4000-8000-000000000001');
do $$
declare
  v_job uuid := (select job_id from job_ids where submission_key = 'suppress-test-000001');
  v_result jsonb;
begin
  assert (select count(*) from public.website_enquiry_delivery_preflight()) = 4, 'preflight should list four pending jobs';
  assert (select subject from public.website_enquiry_delivery_preflight() where job_id = v_job) = 'pilot', 'preflight subject missing';
  begin
    perform public.suppress_website_enquiry_delivery(v_job, 'cancelled');
    raise exception 'invalid reason accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.suppress_website_enquiry_delivery(v_job, 'other', '   ');
    raise exception 'other without note accepted';
  exception when invalid_parameter_value then null;
  end;
  v_result := public.suppress_website_enquiry_delivery(gen_random_uuid(), 'acceptance_test');
  assert v_result ->> 'reason' = 'not_found', v_result::text;

  v_result := public.suppress_website_enquiry_delivery(v_job, 'acceptance_test', 'pilot test - do not send');
  assert (v_result ->> 'applied')::boolean and v_result ->> 'from' = 'pending', v_result::text;
  v_result := public.suppress_website_enquiry_delivery(v_job, 'acceptance_test');
  assert v_result ->> 'reason' = 'already_suppressed', 'suppression not idempotent';
  assert not exists (select 1 from public.website_enquiry_delivery_preflight() where job_id = v_job), 'suppressed job still in preflight';
end $$;
commit;

do $$
begin
  assert (select delivery_state || '|' || suppressed_from_state || '|' || suppression_reason || '|' || suppression_note
          from public.website_enquiry_delivery_jobs where id = (select job_id from job_ids where submission_key = 'suppress-test-000001'))
    = 'suppressed|pending|acceptance_test|pilot test - do not send', 'suppression audit incomplete';
  assert (select suppressed_by from public.website_enquiry_delivery_jobs where id = (select job_id from job_ids where submission_key = 'suppress-test-000001'))
    = '40810000-0000-4000-8000-000000000001', 'suppressing actor not recorded';
end $$;

-- A suppressed job is never claimed by the worker.
set role service_role;
create temporary table claim_one as select * from public.claim_website_enquiry_deliveries('resend', 50, 120);
reset role;
do $$
begin
  assert not exists (select 1 from claim_one where job_id = (select job_id from job_ids where submission_key = 'suppress-test-000001')), 'worker claimed a suppressed job';
  assert (select count(*) from claim_one) = 3, format('expected three claimable jobs, got %s', (select count(*) from claim_one));
end $$;

-- In-flight and already-sent jobs are refused; reconcile can be suppressed by a manager.
set role service_role;
do $$
declare
  v_two uuid := (select job_id from job_ids where submission_key = 'suppress-test-000002');
  v_three uuid := (select job_id from job_ids where submission_key = 'suppress-test-000003');
begin
  perform public.complete_website_enquiry_delivery(v_two, (select lease_token from claim_one where job_id = v_two), 'accepted', 'msg-two');
  perform public.complete_website_enquiry_delivery(v_three, (select lease_token from claim_one where job_id = v_three), 'ambiguous', null, 'timeout_after_send');
end $$;
reset role;

begin;
set local role authenticated;
select pg_temp.as_user('40810000-0000-4000-8000-000000000002');
do $$
declare
  v_two uuid := (select job_id from job_ids where submission_key = 'suppress-test-000002');
  v_three uuid := (select job_id from job_ids where submission_key = 'suppress-test-000003');
  v_four uuid := (select job_id from job_ids where submission_key = 'suppress-test-000004');
  v_result jsonb;
begin
  v_result := public.suppress_website_enquiry_delivery(v_four, 'duplicate');
  assert v_result ->> 'reason' = 'not_suppressible' and v_result ->> 'state' = 'leased', 'in-flight job suppressed: ' || v_result::text;
  v_result := public.suppress_website_enquiry_delivery(v_two, 'duplicate');
  assert v_result ->> 'reason' = 'not_suppressible' and v_result ->> 'state' = 'accepted', 'sent job suppressed: ' || v_result::text;
  v_result := public.suppress_website_enquiry_delivery(v_three, 'other', 'ambiguous send; client already called back');
  assert (v_result ->> 'applied')::boolean and v_result ->> 'from' = 'reconcile', v_result::text;
end $$;
commit;

set role service_role;
do $$
declare
  v_three uuid := (select job_id from job_ids where submission_key = 'suppress-test-000003');
  v_result jsonb;
begin
  v_result := public.resolve_website_enquiry_delivery_reconcile(v_three, 'idempotent_replay');
  assert v_result ->> 'reason' = 'not_reconciling', 'suppressed reconcile job was replayed';
  assert (select reconcile_reason from public.website_enquiry_delivery_jobs where id = v_three) is null, 'reconcile reason not cleared';
end $$;
reset role;

-- Direct writes cannot fake a suppression without the audit fields.
do $$
begin
  begin
    update public.website_enquiry_delivery_jobs set delivery_state = 'suppressed'
    where id = (select job_id from job_ids where submission_key = 'suppress-test-000004');
    raise exception 'unaudited suppression accepted';
  exception when check_violation then null;
  end;
end $$;

-- Race: an admin suppression transaction is open when the worker claims; the worker must skip
-- the locked job, and after commit the job is suppressed, never leased.
update public.website_enquiry_delivery_jobs
set delivery_state = 'pending', lease_token = null, lease_expires_at = null
where id = (select job_id from job_ids where submission_key = 'suppress-test-000004');

create extension if not exists dblink with schema extensions;
select extensions.dblink_connect('suppress_admin', 'host=127.0.0.1 dbname=cg_website_enquiry_acceptance user=supabase_admin password=postgres');
select extensions.dblink_exec('suppress_admin', 'begin');
select extensions.dblink_exec('suppress_admin', 'set local role authenticated');
select * from extensions.dblink('suppress_admin',
  $q$select set_config('request.jwt.claims', '{"sub":"40810000-0000-4000-8000-000000000001","role":"authenticated"}', true)$q$
) as t(v text);
select * from extensions.dblink('suppress_admin', format(
  $q$select public.suppress_website_enquiry_delivery(%L::uuid, 'acceptance_test')::text$q$,
  (select job_id from job_ids where submission_key = 'suppress-test-000004')
)) as t(result text);

set role service_role;
create temporary table claim_race as select * from public.claim_website_enquiry_deliveries('resend', 50, 120);
reset role;
select extensions.dblink_exec('suppress_admin', 'commit');
select extensions.dblink_disconnect('suppress_admin');

do $$
begin
  assert not exists (select 1 from claim_race where job_id = (select job_id from job_ids where submission_key = 'suppress-test-000004')),
    'worker claimed a job while it was being suppressed';
  assert (select delivery_state from public.website_enquiry_delivery_jobs
          where id = (select job_id from job_ids where submission_key = 'suppress-test-000004')) = 'suppressed', 'race lost the suppression';
  -- Enquiry evidence is untouched by suppression.
  assert (select count(*) from public.website_enquiries) = 4, 'enquiry evidence changed';
  assert (select count(*) from public.website_enquiry_events) = 4, 'event evidence changed';
end $$;

select 'Delivery suppression acceptance passed' as result;
