-- Issue #405 M2B actual PostgreSQL acceptance.
-- Run only against the disposable database created by:
--   scripts/website-lead-lifecycle-acceptance.mjs
-- Fixtures are disposable test identities, never production data.

insert into public.clients (id, name, active) values
  ('40600000-0000-4000-8000-000000000001', 'Lead Client A', true),
  ('40600000-0000-4000-8000-000000000002', 'Lead Client B', true),
  ('40600000-0000-4000-8000-000000000003', 'Lead Client C (no website)', true);

insert into auth.users (id) values
  ('40610000-0000-4000-8000-000000000001'),
  ('40610000-0000-4000-8000-000000000002'),
  ('40610000-0000-4000-8000-000000000003'),
  ('40610000-0000-4000-8000-000000000004'),
  ('40610000-0000-4000-8000-000000000005');

insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('40610000-0000-4000-8000-000000000001', 'Lead Manager', 'manager', null, true),
  ('40610000-0000-4000-8000-000000000002', 'Client A User', 'client', '40600000-0000-4000-8000-000000000001', true),
  ('40610000-0000-4000-8000-000000000003', 'Client B User', 'client', '40600000-0000-4000-8000-000000000002', true),
  ('40610000-0000-4000-8000-000000000004', 'Inactive Client A User', 'client', '40600000-0000-4000-8000-000000000001', false),
  ('40610000-0000-4000-8000-000000000005', 'Client C User', 'client', '40600000-0000-4000-8000-000000000003', true);

insert into public.website_enquiry_endpoints (
  id, intake_key, client_id, website_editor_website_id, environment, canonical_host, enabled, verified_by, verified_at
) values
  ('40620000-0000-4000-8000-000000000001', '40621000-0000-4000-8000-000000000001',
   '40600000-0000-4000-8000-000000000001', 'site-a', 'production', 'a.example.test',
   true, '40610000-0000-4000-8000-000000000001', now()),
  ('40620000-0000-4000-8000-000000000002', '40621000-0000-4000-8000-000000000002',
   '40600000-0000-4000-8000-000000000001', 'site-a', 'preview', 'preview-a.example.test',
   true, '40610000-0000-4000-8000-000000000001', now()),
  ('40620000-0000-4000-8000-000000000003', '40621000-0000-4000-8000-000000000003',
   '40600000-0000-4000-8000-000000000002', 'site-b', 'production', 'b.example.test',
   true, '40610000-0000-4000-8000-000000000001', now());

insert into public.website_form_schemas (
  id, endpoint_id, schema_key, version, status, field_definitions,
  contact_name_key, contact_email_key, contact_phone_key, activated_by, activated_at
)
select
  ('40630000-0000-4000-8000-00000000000' || n)::uuid,
  ('40620000-0000-4000-8000-00000000000' || n)::uuid,
  'contact_form', 1, 'active',
  '[
    {"key":"name","label":"Your name","type":"text","required":true,"max_length":120},
    {"key":"email","label":"Email","type":"email","required":true,"max_length":320},
    {"key":"phone","label":"Phone","type":"tel","required":false,"max_length":80},
    {"key":"message","label":"Message","type":"textarea","required":true,"max_length":2000}
  ]'::jsonb,
  'name', 'email', 'phone', '40610000-0000-4000-8000-000000000001', now()
from generate_series(1, 3) n;

insert into public.website_enquiry_recipient_configurations (id, endpoint_id, version, status)
select ('40640000-0000-4000-8000-00000000000' || n)::uuid, ('40620000-0000-4000-8000-00000000000' || n)::uuid, 1, 'draft'
from generate_series(1, 3) n;

insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email)
select ('40640000-0000-4000-8000-00000000000' || n)::uuid, 'sales_primary', 'sales-' || n || '@example.test'
from generate_series(1, 3) n;

update public.website_enquiry_recipient_configurations
set status = 'approved', approved_by = '40610000-0000-4000-8000-000000000001', approved_at = now();

-- Acquisition through the canonical M2A transaction only (trusted server role).
set role service_role;
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000001',
  '{"name":"Visitor One","email":"One@Example.test","phone":"+27 82 000 0001","message":"Need a quote"}'::jsonb,
  '{"landing_path":"/contact","utm_source":"google"}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000002',
  '{"name":"Visitor Two","email":"two@example.test","message":"Pricing please"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000003',
  '{"name":"Visitor Three","email":"three@example.test","message":"Hello"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000002', 'contact_form', 1, 'lead-a-preview-01',
  '{"name":"Preview Tester","email":"preview@example.test","message":"synthetic"}'::jsonb, '{}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000003', 'contact_form', 1, 'lead-b-0000000001',
  '{"name":"Visitor B","email":"b@example.test","message":"B enquiry"}'::jsonb, '{}'::jsonb);
reset role;

create temporary table lead_ids as
select enquiry.submission_key, enquiry.id
from public.website_enquiries enquiry;
grant select on lead_ids to authenticated;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
end $$;

-- Browser roles have no direct table access to lifecycle or acquisition evidence.
do $$
begin
  assert not has_table_privilege('authenticated', 'public.website_enquiry_lead_states', 'select'), 'authenticated can read lead states';
  assert not has_table_privilege('authenticated', 'public.website_enquiry_lead_states', 'insert'), 'authenticated can write lead states';
  assert not has_table_privilege('authenticated', 'public.website_enquiry_lead_state_events', 'select'), 'authenticated can read lead events';
  assert not has_table_privilege('authenticated', 'public.website_enquiries', 'select'), 'authenticated can read enquiries';
  assert not has_table_privilege('anon', 'public.website_enquiry_lead_states', 'select'), 'anon can read lead states';
  assert not has_function_privilege('anon', 'public.website_lead_inbox(uuid, integer, timestamptz)', 'execute'), 'anon can read inbox';
  assert not has_function_privilege('anon', 'public.set_website_lead_lifecycle(uuid, text, text, text, text)', 'execute'), 'anon can mutate lifecycle';
  assert not has_function_privilege('anon', 'public.website_lead_metrics(uuid, date, date)', 'execute'), 'anon can read metrics';
  assert not has_function_privilege('authenticated', 'public.website_lead_caller_client(uuid)', 'execute'), 'resolver is directly callable';
  assert not has_table_privilege('service_role', 'public.website_enquiry_lead_states', 'update'), 'service role can rewrite client lifecycle';
end $$;

begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000002');
do $$
declare
  v_count integer;
  v_row record;
begin
  -- Client A sees exactly its three production leads; preview and client B are excluded.
  select count(*) into v_count from public.website_lead_inbox();
  assert v_count = 3, format('client A inbox count %s', v_count);
  assert not exists (select 1 from public.website_lead_inbox() where contact_email in ('preview@example.test', 'b@example.test')), 'inbox leaked synthetic or cross-client lead';

  select * into v_row from public.website_lead_inbox() where contact_name = 'Visitor One';
  assert v_row.status = 'new' and v_row.quality is null, 'new lead is not New/unreviewed';
  assert v_row.contact_email = 'one@example.test', 'contact email not canonical';
  assert v_row.contact_phone = '+27 82 000 0001', 'contact phone missing';
  assert v_row.fields -> 0 ->> 'label' = 'Your name', 'field labels not projected in schema order';
  assert jsonb_array_length(v_row.fields) = 4, 'answered fields not projected';
  assert v_row.attribution ->> 'utm_source' = 'google', 'attribution evidence missing';

  -- Naming another client is rejected.
  begin
    perform * from public.website_lead_inbox('40600000-0000-4000-8000-000000000002');
    raise exception 'client A read client B inbox';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.website_lead_metrics('40600000-0000-4000-8000-000000000002', current_date - 1, current_date + 1);
    raise exception 'client A read client B metrics';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Lifecycle: contacted -> qualified/good -> won; poor requires reason.
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000001'), 'contacted');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000001'), 'qualified', 'good');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000001'), 'won', 'good');
do $$
declare
  v_message text;
begin
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000002'), 'closed_lost', 'poor');
    raise exception 'poor lead without reason accepted';
  exception when invalid_parameter_value then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'A poor lead requires a reason', v_message;
  end;
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000002'), 'closed_lost', 'poor', 'other');
    raise exception 'other reason without note accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000002'), 'qualified', 'good', 'spam');
    raise exception 'reason on good lead accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000002'), 'archived');
    raise exception 'unknown status accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000002'), 'closed_lost', 'poor', 'wrong_service', 'Asked for plumbing');

-- Deterministic Good/Poor mapping: every contradictory combination is rejected by the RPC.
do $$
declare
  v_lead uuid := (select id from lead_ids where submission_key = 'lead-a-0000000003');
  v_combo record;
  v_message text;
begin
  for v_combo in
    select * from (values
      ('new', 'good', null), ('contacted', 'good', null), ('new', 'poor', 'spam'),
      ('contacted', 'poor', 'spam'), ('qualified', 'poor', 'spam'), ('won', 'poor', 'spam'),
      ('qualified', null, null), ('won', null, null), ('closed_lost', null, null)
    ) as combo(status, quality, reason)
  loop
    begin
      perform public.set_website_lead_lifecycle(v_lead, v_combo.status, v_combo.quality, v_combo.reason);
      raise exception 'impossible combination accepted: % / %', v_combo.status, v_combo.quality;
    exception when invalid_parameter_value then
      get stacked diagnostics v_message = message_text;
      assert v_message like 'Lead status and quality do not match%', v_message;
    end;
  end loop;
end $$;

do $$
declare
  v_message text;
begin
  -- Cross-client mutation is rejected with the same error as a non-existent lead.
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-b-0000000001'), 'won', 'good');
    raise exception 'client A mutated client B lead';
  exception when insufficient_privilege then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Not authorized for this lead', v_message;
  end;
  begin
    perform public.set_website_lead_lifecycle(gen_random_uuid(), 'won', 'good');
    raise exception 'unknown lead accepted';
  exception when insufficient_privilege then
    get stacked diagnostics v_message = message_text;
    assert v_message = 'Not authorized for this lead', v_message;
  end;
  -- Synthetic preview enquiries cannot be worked as client leads.
  begin
    perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-preview-01'), 'won', 'good');
    raise exception 'synthetic lead mutated';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
declare
  v_metrics jsonb;
begin
  v_metrics := public.website_lead_metrics(null, (now() at time zone 'Africa/Johannesburg')::date, (now() at time zone 'Africa/Johannesburg')::date + 1);
  assert v_metrics ->> 'state' = 'available', v_metrics::text;
  assert (v_metrics ->> 'total')::int = 3, v_metrics::text;
  assert (v_metrics ->> 'qualified')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'won')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'good')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'poor')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'unreviewed')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'closedLost')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'new')::int = 1, v_metrics::text;
  assert (v_metrics ->> 'qualificationRate')::numeric = 0.3333, v_metrics::text;
  assert not (v_metrics::text ~* '@|visitor|\+27'), 'metrics leaked PII';

  v_metrics := public.website_lead_metrics(null, date '2020-01-01', date '2020-02-01');
  assert (v_metrics ->> 'total')::int = 0 and v_metrics -> 'qualificationRate' = 'null'::jsonb, 'empty period is not truthful';

  begin
    perform public.website_lead_metrics(null, date '2020-02-01', date '2020-01-01');
    raise exception 'inverted period accepted';
  exception when invalid_parameter_value then null;
  end;
end $$;
commit;

-- The table constraint itself rejects contradictory state even for privileged writers.
do $$
declare
  v_lead uuid := (select id from lead_ids where submission_key = 'lead-a-0000000003');
begin
  begin
    insert into public.website_enquiry_lead_states (enquiry_id, client_id, status, quality, updated_by)
    values (v_lead, '40600000-0000-4000-8000-000000000001', 'new', 'good', '40610000-0000-4000-8000-000000000001');
    raise exception 'table accepted Good + New';
  exception when check_violation then null;
  end;
  begin
    insert into public.website_enquiry_lead_states (enquiry_id, client_id, status, quality, poor_reason, updated_by)
    values (v_lead, '40600000-0000-4000-8000-000000000001', 'won', 'poor', 'spam', '40610000-0000-4000-8000-000000000001');
    raise exception 'table accepted Poor + Won';
  exception when check_violation then null;
  end;
  begin
    insert into public.website_enquiry_lead_states (enquiry_id, client_id, status, quality, updated_by)
    values (v_lead, '40600000-0000-4000-8000-000000000001', 'closed_lost', null, '40610000-0000-4000-8000-000000000001');
    raise exception 'table accepted unreviewed Closed-Lost';
  exception when check_violation then null;
  end;
  begin
    insert into public.website_enquiry_lead_states (enquiry_id, client_id, status, quality, updated_by)
    values (v_lead, '40600000-0000-4000-8000-000000000001', 'won', null, '40610000-0000-4000-8000-000000000001');
    raise exception 'table accepted unreviewed Won';
  exception when check_violation then null;
  end;
end $$;

-- Acquisition evidence was not rewritten by lifecycle work.
do $$
begin
  assert (select count(*) from public.website_enquiries) = 5, 'enquiry count changed';
  assert (select count(*) from public.website_enquiry_events) = 5, 'event count changed';
  assert (select count(*) from public.website_enquiry_lead_states) = 2, 'unexpected lifecycle rows';
  assert (select count(*) from public.website_enquiry_lead_state_events) = 4, 'audit trail incomplete';
  assert (select previous_status from public.website_enquiry_lead_state_events
          where status = 'won') = 'qualified', 'audit previous status wrong';
  assert not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'website_enquiry_lead_state_events'
      and column_name ~ 'email|phone|name|note'
  ), 'audit trail stores PII';
end $$;

-- Client B sees only its own lead and its own (untouched) state.
begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000003');
do $$
begin
  assert (select count(*) from public.website_lead_inbox()) = 1, 'client B inbox wrong';
  assert (select status from public.website_lead_inbox()) = 'new', 'client B lead was changed';
end $$;
commit;

-- Inactive client user and client without a website.
begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000004');
do $$
begin
  begin
    perform * from public.website_lead_inbox();
    raise exception 'inactive client user read inbox';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.as_user('40610000-0000-4000-8000-000000000005');
do $$
declare
  v_metrics jsonb := public.website_lead_metrics(null, date '2026-01-01', date '2026-02-01');
begin
  assert v_metrics ->> 'state' = 'not_connected', v_metrics::text;
  assert (select count(*) from public.website_lead_inbox()) = 0, 'client C inbox not empty';
end $$;
commit;

-- Staff must name an active client, see the same exact-client truth and can work leads.
begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000001');
do $$
begin
  begin
    perform * from public.website_lead_inbox();
    raise exception 'staff read inbox without client';
  exception when invalid_parameter_value then null;
  end;
  assert (select count(*) from public.website_lead_inbox('40600000-0000-4000-8000-000000000002')) = 1, 'staff client B inbox wrong';
  perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-b-0000000001'), 'contacted');
  assert (select status from public.website_lead_inbox('40600000-0000-4000-8000-000000000002')) = 'contacted', 'staff update lost';
  -- A Good (qualified) lead that later does not buy is Lost but still counts as qualified.
  perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-b-0000000001'), 'qualified', 'good');
  perform public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-b-0000000001'), 'closed_lost', 'good');
  declare
    v_metrics jsonb := public.website_lead_metrics('40600000-0000-4000-8000-000000000002',
      (now() at time zone 'Africa/Johannesburg')::date, (now() at time zone 'Africa/Johannesburg')::date + 1);
  begin
    assert (v_metrics ->> 'qualified')::int = 1 and (v_metrics ->> 'lost')::int = 1
      and (v_metrics ->> 'won')::int = 0 and (v_metrics ->> 'poor')::int = 0
      and (v_metrics ->> 'qualificationRate')::numeric = 1, v_metrics::text;
  end;
end $$;
commit;

do $$
begin
  assert (select actor_kind from public.website_enquiry_lead_state_events
          where status = 'contacted' and client_id = '40600000-0000-4000-8000-000000000002') = 'staff', 'staff actor not audited';
end $$;

-- Unauthenticated callers are rejected even if execute were granted.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  begin
    perform * from public.website_lead_inbox();
    raise exception 'anonymous session read inbox';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

select 'M2B lead lifecycle acceptance passed' as result;
