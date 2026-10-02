-- Issue #624 disposable fixtures only (scripts/website-enquiry-intake-acceptance.mjs).
-- Identities are synthetic; nothing here represents production configuration.

insert into public.clients (id, name, active) values
  ('62400000-0000-4000-8000-000000000001', 'Intake Client A', true),
  ('62400000-0000-4000-8000-000000000002', 'Intake Client B', true);
insert into auth.users (id) values ('62420000-0000-4000-8000-000000000001');
insert into public.profiles (id, full_name, role, client_id, is_active) values
  ('62420000-0000-4000-8000-000000000001', 'Intake Reviewer', 'manager', null, true);

-- 1 enabled; 2 disabled; 3 draft schema only; 4 no approved recipients; 5 other client.
insert into public.website_enquiry_endpoints (id, intake_key, client_id, website_editor_website_id, environment, canonical_host)
select ('62430000-0000-4000-8000-00000000000' || n)::uuid, ('62410000-0000-4000-8000-00000000000' || n)::uuid,
  case when n = 5 then '62400000-0000-4000-8000-000000000002'::uuid else '62400000-0000-4000-8000-000000000001'::uuid end,
  n::text, 'production', 'site' || n || '.example.test'
from generate_series(1, 5) n;

insert into public.website_form_schemas (id, endpoint_id, schema_key, version, field_definitions, contact_name_key, contact_email_key, contact_phone_key)
select ('62440000-0000-4000-8000-00000000000' || n)::uuid, ('62430000-0000-4000-8000-00000000000' || n)::uuid, 'contact_form', 1,
  '[
    {"key":"name","label":"Name","type":"text","required":true,"max_length":120},
    {"key":"email","label":"Email","type":"email","required":true,"max_length":320},
    {"key":"phone","label":"Phone","type":"tel","required":false,"max_length":80},
    {"key":"subject","label":"Subject","type":"text","required":false,"max_length":200},
    {"key":"message","label":"Message","type":"textarea","required":true,"max_length":4000}
  ]'::jsonb, 'name', 'email', 'phone'
from generate_series(1, 5) n;

insert into public.website_enquiry_recipient_configurations (id, endpoint_id, version)
select ('62450000-0000-4000-8000-00000000000' || n)::uuid, ('62430000-0000-4000-8000-00000000000' || n)::uuid, 1
from generate_series(1, 5) n;
insert into public.website_enquiry_recipient_routes (recipient_configuration_id, route_key, recipient_email)
select ('62450000-0000-4000-8000-00000000000' || n)::uuid, 'primary', 'inbox-' || n || '@example.test'
from generate_series(1, 5) n;

update public.website_enquiry_recipient_configurations
set status = 'approved', approved_by = '62420000-0000-4000-8000-000000000001', approved_at = now()
where endpoint_id <> '62430000-0000-4000-8000-000000000004';
update public.website_form_schemas
set status = 'active', activated_by = '62420000-0000-4000-8000-000000000001', activated_at = now()
where endpoint_id <> '62430000-0000-4000-8000-000000000003';
update public.website_enquiry_endpoints
set enabled = true, verified_by = '62420000-0000-4000-8000-000000000001', verified_at = now()
where id <> '62430000-0000-4000-8000-000000000002';
