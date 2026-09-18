-- Issue #405 M2A actual PostgreSQL acceptance.
-- Run only against the disposable database created by:
--   scripts/website-enquiry-transaction-acceptance.sh

create extension if not exists dblink with schema extensions;

insert into public.clients (id, name, active) values
  ('40500000-0000-4000-8000-000000000001', 'Enquiry Client A', true),
  ('40500000-0000-4000-8000-000000000002', 'Enquiry Client B', true);

insert into auth.users (id) values
  ('40510000-0000-4000-8000-000000000001'),
  ('40510000-0000-4000-8000-000000000002'),
  ('40510000-0000-4000-8000-000000000003');

insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('40510000-0000-4000-8000-000000000001', 'Enquiry Manager', 'manager', null, true),
  ('40510000-0000-4000-8000-000000000002', 'Client A User', 'client', '40500000-0000-4000-8000-000000000001', true),
  ('40510000-0000-4000-8000-000000000003', 'Client B User', 'client', '40500000-0000-4000-8000-000000000002', true);

insert into public.website_enquiry_endpoints (
  id, intake_key, client_id, website_editor_website_id, environment, canonical_host,
  enabled, verified_by, verified_at
) values
  (
    '40520000-0000-4000-8000-000000000001', '40521000-0000-4000-8000-000000000001',
    '40500000-0000-4000-8000-000000000001', 'website-a', 'production', 'a.example.test',
    true, '40510000-0000-4000-8000-000000000001', now()
  ),
  (
    '40520000-0000-4000-8000-000000000002', '40521000-0000-4000-8000-000000000002',
    '40500000-0000-4000-8000-000000000002', 'website-b', 'preview', 'b.example.test',
    true, '40510000-0000-4000-8000-000000000001', now()
  );

insert into public.website_form_schemas (
  id, endpoint_id, schema_key, version, status, field_definitions,
  contact_name_key, contact_email_key, contact_phone_key, activated_by, activated_at
) values
  (
    '40530000-0000-4000-8000-000000000001', '40520000-0000-4000-8000-000000000001',
    'contact_form', 1, 'active',
    '[
      {"key":"name","type":"text","required":true,"max_length":120},
      {"key":"email","type":"email","required":true,"max_length":320},
      {"key":"phone","type":"tel","required":false,"max_length":80},
      {"key":"service","type":"select","required":true,"max_length":100,"options":["design","video"]},
      {"key":"message","type":"textarea","required":true,"max_length":2000}
    ]'::jsonb,
    'name', 'email', 'phone', '40510000-0000-4000-8000-000000000001', now()
  ),
  (
    '40530000-0000-4000-8000-000000000002', '40520000-0000-4000-8000-000000000002',
    'contact_form', 1, 'active',
    '[
      {"key":"name","type":"text","required":true,"max_length":120},
      {"key":"email","type":"email","required":true,"max_length":320},
      {"key":"message","type":"textarea","required":true,"max_length":2000}
    ]'::jsonb,
    'name', 'email', null, '40510000-0000-4000-8000-000000000001', now()
  ),
  (
    '40530000-0000-4000-8000-000000000003', '40520000-0000-4000-8000-000000000001',
    'crash_form', 1, 'active',
    '[
      {"key":"name","type":"text","required":true,"max_length":120},
      {"key":"email","type":"email","required":true,"max_length":320},
      {"key":"message","type":"textarea","required":true,"max_length":2000}
    ]'::jsonb,
    'name', 'email', null, '40510000-0000-4000-8000-000000000001', now()
  );

insert into public.website_enquiry_recipient_configurations (
  id, endpoint_id, version, status, approved_by, approved_at
) values
  (
    '40540000-0000-4000-8000-000000000001', '40520000-0000-4000-8000-000000000001',
    1, 'draft', null, null
  ),
  (
    '40540000-0000-4000-8000-000000000002', '40520000-0000-4000-8000-000000000002',
    1, 'draft', null, null
  );

insert into public.website_enquiry_recipient_routes (
  id, recipient_configuration_id, route_key, recipient_email, recipient_name
) values
  (
    '40550000-0000-4000-8000-000000000001', '40540000-0000-4000-8000-000000000001',
    'sales_primary', 'sales-a@example.test', 'Sales A'
  ),
  (
    '40550000-0000-4000-8000-000000000002', '40540000-0000-4000-8000-000000000001',
    'sales_secondary', 'backup-a@example.test', 'Backup A'
  ),
  (
    '40550000-0000-4000-8000-000000000003', '40540000-0000-4000-8000-000000000002',
    'sales_primary', 'sales-b@example.test', 'Sales B'
  );

update public.website_enquiry_recipient_configurations
set status = 'approved', approved_by = '40510000-0000-4000-8000-000000000001', approved_at = now();

do $$
declare
  v_message text;
begin
  begin
    insert into public.website_form_schemas (
      endpoint_id, schema_key, version, field_definitions,
      contact_email_key, activated_by, activated_at
    ) values (
      '40520000-0000-4000-8000-000000000001', 'invalid_duplicate', 1,
      '[
        {"key":"email","type":"email","required":true,"max_length":320},
        {"key":"email","type":"email","required":true,"max_length":320}
      ]'::jsonb,
      'email', '40510000-0000-4000-8000-000000000001', now()
    );
    raise exception 'duplicate field keys were accepted';
  exception when check_violation then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Form schema field keys must be unique.', v_message;
  end;

  begin
    update public.website_enquiry_recipient_routes
    set recipient_email = 'injected@example.test'
    where id = '40550000-0000-4000-8000-000000000001';
    raise exception 'approved recipient route was changed';
  exception when check_violation then
    get stacked diagnostics v_message = message_text;
    assert v_message like 'Approved recipient routes are immutable%', v_message;
  end;
end $$;

set role service_role;

do $$
declare
  v_first jsonb;
  v_replay jsonb;
  v_second jsonb;
  v_other_client jsonb;
  v_message text;
begin
  v_first := public.submit_website_enquiry(
    '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
    'tenant-a-submit-0001',
    '{"name":"Alice Example","email":"ALICE@example.test","phone":"012 345 6789","service":"design","message":"Please call me."}',
    '{"landing_path":"/design","utm_source":"google"}'
  );
  assert (v_first ->> 'accepted')::boolean and not (v_first ->> 'replayed')::boolean,
    'first submission is durably accepted';
  assert (select count(*) from public.website_enquiries where submission_key = 'tenant-a-submit-0001') = 1,
    'first submission creates one enquiry';
  assert (select count(*) from public.website_enquiry_delivery_jobs job
          join public.website_enquiries enquiry on enquiry.id = job.enquiry_id
          where enquiry.submission_key = 'tenant-a-submit-0001') = 2,
    'one pending job exists per approved recipient';
  assert (select count(*) from public.website_enquiry_events event_row
          join public.website_enquiries enquiry on enquiry.id = event_row.enquiry_id
          where enquiry.submission_key = 'tenant-a-submit-0001') = 1,
    'one canonical enquiry event exists';

  v_replay := public.submit_website_enquiry(
    '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
    'tenant-a-submit-0001',
    '{"message":"Please call me.","service":"design","phone":"012 345 6789","email":"alice@example.test","name":"Alice Example"}',
    '{"utm_source":"google","landing_path":"/design"}'
  );
  assert (v_replay ->> 'replayed')::boolean, 'identical replay is reported';
  assert v_replay ->> 'receipt_id' = v_first ->> 'receipt_id', 'identical replay returns the same receipt';
  assert (select count(*) from public.website_enquiries where submission_key = 'tenant-a-submit-0001') = 1,
    'replay creates no enquiry duplicate';

  begin
    perform public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
      'tenant-a-submit-0001',
      '{"name":"Alice Example","email":"alice@example.test","service":"video","message":"Changed payload."}',
      '{"landing_path":"/video"}'
    );
    raise exception 'changed payload reused the same submission key';
  exception when unique_violation then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Submission key was already used with different content.', v_message;
  end;

  begin
    perform public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
      'tenant-a-injection-1',
      '{"name":"Mallory","email":"mallory@example.test","service":"design","message":"x","recipient_email":"mallory@example.test"}',
      '{}'
    );
    raise exception 'recipient injection field was accepted';
  exception when invalid_parameter_value then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Submission contains unsupported fields.', v_message;
  end;

  v_second := public.submit_website_enquiry(
    '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
    'tenant-a-submit-0002',
    '{"name":"Alice Example","email":"alice@example.test","service":"video","message":"A legitimate later enquiry."}',
    '{"landing_path":"/video"}'
  );
  assert v_second ->> 'receipt_id' <> v_first ->> 'receipt_id', 'later enquiry is distinct from contact identity';
  assert (select count(*) from public.website_enquiries enquiry
          join public.website_enquiry_contacts contact on contact.id = enquiry.contact_id
          where contact.client_id = '40500000-0000-4000-8000-000000000001'
            and contact.normalized_email = 'alice@example.test') = 2,
    'same-client contact links two distinct legitimate enquiries';
  assert (select count(*) from public.website_enquiry_contacts
          where client_id = '40500000-0000-4000-8000-000000000001'
            and normalized_email = 'alice@example.test') = 1,
    'same-client contact identity is reused without deduping enquiries';

  v_other_client := public.submit_website_enquiry(
    '40521000-0000-4000-8000-000000000002', 'contact_form', 1,
    'tenant-a-submit-0001',
    '{"name":"Alice Example","email":"alice@example.test","message":"Client B enquiry."}',
    '{"landing_path":"/contact"}'
  );
  assert v_other_client ->> 'receipt_id' <> v_first ->> 'receipt_id',
    'same key in another exact tenant has a distinct receipt';
  assert (select count(*) from public.website_enquiry_contacts
          where normalized_email = 'alice@example.test') = 2,
    'email identity never dedupes contacts across clients';
  assert (select is_synthetic from public.website_enquiry_events event_row
          join public.website_enquiries enquiry on enquiry.id = event_row.enquiry_id
          where enquiry.receipt_id = (v_other_client ->> 'receipt_id')::uuid),
    'preview identity is derived server-side and marked synthetic';
end $$;

reset role;

-- Six independent database sessions race on the same exact tenant submission key.
select extensions.dblink_connect(
  connection_name,
  'host=127.0.0.1 dbname=cg_website_enquiry_acceptance user=supabase_admin password=postgres'
)
from unnest(array['lead_c1','lead_c2','lead_c3','lead_c4','lead_c5','lead_c6']) connection_name;

select extensions.dblink_send_query(
  connection_name,
  $query$
    select public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
      'concurrent-submit-0001',
      '{"name":"Concurrent Person","email":"concurrent@example.test","service":"design","message":"One concurrent request."}',
      '{"landing_path":"/contact"}'
    )
  $query$
)
from unnest(array['lead_c1','lead_c2','lead_c3','lead_c4','lead_c5','lead_c6']) connection_name;

create temporary table concurrent_receipts (receipt jsonb not null);
insert into concurrent_receipts
select receipt from extensions.dblink_get_result('lead_c1') as result(receipt jsonb)
union all select receipt from extensions.dblink_get_result('lead_c2') as result(receipt jsonb)
union all select receipt from extensions.dblink_get_result('lead_c3') as result(receipt jsonb)
union all select receipt from extensions.dblink_get_result('lead_c4') as result(receipt jsonb)
union all select receipt from extensions.dblink_get_result('lead_c5') as result(receipt jsonb)
union all select receipt from extensions.dblink_get_result('lead_c6') as result(receipt jsonb);

do $$
begin
  assert (select count(*) from concurrent_receipts) = 6, 'all six callers received a receipt';
  assert (select count(distinct receipt ->> 'receipt_id') from concurrent_receipts) = 1,
    'all concurrent callers received the same receipt';
  assert (select count(*) from public.website_enquiries where submission_key = 'concurrent-submit-0001') = 1,
    'concurrent requests create one enquiry';
  assert (select count(*) from public.website_enquiry_events event_row
          join public.website_enquiries enquiry on enquiry.id = event_row.enquiry_id
          where enquiry.submission_key = 'concurrent-submit-0001') = 1,
    'concurrent requests create one event';
  assert (select count(*) from public.website_enquiry_delivery_jobs job
          join public.website_enquiries enquiry on enquiry.id = job.enquiry_id
          where enquiry.submission_key = 'concurrent-submit-0001') = 2,
    'concurrent requests create one approved-recipient job set';
end $$;

select extensions.dblink_disconnect(connection_name)
from unnest(array['lead_c1','lead_c2','lead_c3','lead_c4','lead_c5','lead_c6']) connection_name;

-- Inject a failure at the final event boundary. PostgreSQL must roll back contact, enquiry and jobs.
create function public.test_405_reject_event()
returns trigger
language plpgsql
as $$
begin
  if new.event_data ->> 'form_schema_key' = 'crash_form' then
    raise exception 'injected event failure';
  end if;
  return new;
end;
$$;

create trigger test_405_reject_event
  before insert on public.website_enquiry_events
  for each row execute function public.test_405_reject_event();

set role service_role;
do $$
declare
  v_message text;
begin
  begin
    perform public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'crash_form', 1,
      'crash-submit-0001',
      '{"name":"Crash Test","email":"crash@example.test","message":"Must roll back."}',
      '{"landing_path":"/contact"}'
    );
    raise exception 'injected transaction failure was acknowledged';
  exception when others then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'injected event failure', v_message;
  end;
  assert (select count(*) from public.website_enquiries where submission_key = 'crash-submit-0001') = 0,
    'failed transaction leaves no enquiry';
  assert (select count(*) from public.website_enquiry_contacts where normalized_email = 'crash@example.test') = 0,
    'failed transaction leaves no contact';
  assert (select count(*) from public.website_enquiry_delivery_jobs job
          join public.website_enquiries enquiry on enquiry.id = job.enquiry_id
          where enquiry.submission_key = 'crash-submit-0001') = 0,
    'failed transaction leaves no delivery jobs';
end $$;
reset role;

drop trigger test_405_reject_event on public.website_enquiry_events;
drop function public.test_405_reject_event();

set role service_role;
do $$
declare
  v_receipt jsonb;
begin
  v_receipt := public.submit_website_enquiry(
    '40521000-0000-4000-8000-000000000001', 'crash_form', 1,
    'crash-submit-0001',
    '{"name":"Crash Test","email":"crash@example.test","message":"Must roll back."}',
    '{"landing_path":"/contact"}'
  );
  assert (v_receipt ->> 'accepted')::boolean, 'same key safely retries after transaction rollback';
  assert (select bool_and(job.delivery_state = 'pending' and job.lease_token is null)
          from public.website_enquiry_delivery_jobs job
          join public.website_enquiries enquiry on enquiry.id = job.enquiry_id
          where enquiry.submission_key = 'crash-submit-0001'),
    'committed enquiry leaves recoverable pending jobs after caller/worker crash';
end $$;
reset role;

-- Browser roles cannot call the transaction or read/list/export any tenant's base data.
set role authenticated;
do $$
declare
  v_message text;
begin
  begin
    perform public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
      'browser-submit-0001',
      '{"name":"Browser","email":"browser@example.test","service":"design","message":"forbidden"}',
      '{}'
    );
    raise exception 'authenticated browser called service transaction';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.website_enquiries;
    raise exception 'authenticated browser listed canonical enquiries';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from public.website_enquiry_delivery_jobs;
    raise exception 'authenticated browser listed recipient delivery jobs';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

set role anon;
do $$
begin
  begin
    perform public.submit_website_enquiry(
      '40521000-0000-4000-8000-000000000001', 'contact_form', 1,
      'anonymous-submit-01',
      '{"name":"Anonymous","email":"anonymous@example.test","service":"design","message":"forbidden"}',
      '{}'
    );
    raise exception 'anonymous browser called service transaction';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

do $$
begin
  assert not has_function_privilege('anon', 'public.submit_website_enquiry(uuid,text,integer,text,jsonb,jsonb)', 'execute'),
    'anon has no transaction RPC execution';
  assert not has_function_privilege('authenticated', 'public.submit_website_enquiry(uuid,text,integer,text,jsonb,jsonb)', 'execute'),
    'authenticated has no transaction RPC execution';
  assert has_function_privilege('service_role', 'public.submit_website_enquiry(uuid,text,integer,text,jsonb,jsonb)', 'execute'),
    'only trusted backend service role can execute the transaction';
end $$;
