-- Issue #405 qualified-lead breakdown — actual PostgreSQL acceptance.
-- Runs after 405_website_lead_lifecycle_acceptance.sql in the disposable database created by
--   scripts/website-lead-lifecycle-acceptance.mjs
-- and reuses its fixtures (client A: lead-a-1 /contact + utm google, Good/Won; lead-a-2 Poor;
-- lead-a-3 unreviewed; client B: lead-b-1 Good/Lost). Disposable test identities only.

set role service_role;
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000004',
  '{"name":"Visitor Four","email":"four@example.test","message":"Solar quote"}'::jsonb,
  '{"landing_path":"/services/solar?gclid=abc123#quote","utm_source":"  Facebook "}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000005',
  '{"name":"Visitor Five","email":"five@example.test","message":"Solar quote"}'::jsonb,
  '{"landing_path":"/services/solar","referrer":"https://www.Google.com/search?q=solar+visitor+five"}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000006',
  '{"name":"Visitor Six","email":"six@example.test","message":"Solar quote"}'::jsonb,
  '{"landing_path":"/services/solar","referrer":"https://someuser:secret@evil.example:8443/x?email=six@example.test"}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000007',
  '{"name":"Visitor Seven","email":"seven@example.test","message":"Solar quote"}'::jsonb,
  '{"landing_path":"/services/solar"}'::jsonb);
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000001', 'contact_form', 1, 'lead-a-0000000008',
  '{"name":"Visitor Eight","email":"eight@example.test","message":"Solar quote"}'::jsonb,
  '{"landing_path":"/services/solar","utm_source":"google"}'::jsonb);
-- Preview (synthetic) enquiry with attribution must never appear.
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000002', 'contact_form', 1, 'lead-a-preview-02',
  '{"name":"Preview Two","email":"preview2@example.test","message":"synthetic"}'::jsonb,
  '{"landing_path":"/preview-only","utm_source":"preview-source"}'::jsonb);
-- Client B: eleven more distinct landing pages (twelve groups with lead-b-1's unrecorded path).
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000003', 'contact_form', 1, 'lead-b-page-' || lpad(n::text, 5, '0'),
  jsonb_build_object('name', 'B Visitor ' || n, 'email', 'b' || n || '@example.test', 'message', 'B'),
  jsonb_build_object('landing_path', '/b-page-' || lpad(n::text, 2, '0')))
from generate_series(1, 11) n;
-- Client B: hostile/malformed attribution. None of these strings may ever appear as a key.
select public.submit_website_enquiry('40621000-0000-4000-8000-000000000003', 'contact_form', 1, 'lead-b-neg-' || lpad(n::text, 6, '0'),
  jsonb_build_object('name', 'B Neg ' || n, 'email', 'bneg' || n || '@example.test', 'message', 'B'),
  attribution)
from (values
  -- email-like utm_source falls back to a valid referrer host
  (1, '{"utm_source":"john.doe@example.test","referrer":"https://news.example.org/story?id=1"}'::jsonb),
  -- whitespace-heavy (a name)
  (2, '{"utm_source":"  John   Smith  "}'::jsonb),
  -- URL-like, carrying a query
  (3, '{"utm_source":"https://evil.example/?email=jane"}'::jsonb),
  -- overlong token (41 chars)
  (4, jsonb_build_object('utm_source', 'a' || repeat('b', 40))),
  -- percent-encoded email
  (5, '{"utm_source":"jane%40example.test"}'::jsonb),
  -- unsafe landing path (email in path) with a safe utm_source
  (6, '{"utm_source":"Newsletter","landing_path":"/thank-you/jane@example.test"}'::jsonb),
  -- invalid referrer host and an encoded landing path
  (7, '{"referrer":"https://bad_host!.example/x","landing_path":"/thanks/jane%40example.test"}'::jsonb),
  -- a token at the maximum safe length (32) is kept
  (8, jsonb_build_object('utm_source', 'm' || repeat('k', 31)))
) as fixture(n, attribution);
reset role;

insert into lead_ids
select enquiry.submission_key, enquiry.id
from public.website_enquiries enquiry
where enquiry.submission_key not in (select submission_key from lead_ids);

-- Browser roles: execute for authenticated only.
do $$
begin
  assert not has_function_privilege('anon', 'public.website_lead_breakdown(uuid, date, date, text)', 'execute'), 'anon can read breakdown';
  assert has_function_privilege('authenticated', 'public.website_lead_breakdown(uuid, date, date, text)', 'execute'), 'authenticated cannot read breakdown';
end $$;

begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000002');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000004'), 'qualified', 'good');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000005'), 'qualified', 'good');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000006'), 'won', 'good');
select public.set_website_lead_lifecycle((select id from lead_ids where submission_key = 'lead-a-0000000007'), 'closed_lost', 'poor', 'spam');
do $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_pages jsonb;
  v_sources jsonb;
  v_row jsonb;
begin
  v_pages := public.website_lead_breakdown(null, v_today, v_today + 1, 'landing_page');
  assert v_pages ->> 'state' = 'available' and v_pages ->> 'dimension' = 'landing_page', v_pages::text;
  assert (v_pages ->> 'minSample')::int = 5 and (v_pages ->> 'otherRows')::int = 0, v_pages::text;
  assert jsonb_array_length(v_pages -> 'rows') = 3, v_pages::text;
  -- Query string and fragment stripped; five leads -> a sufficient sample.
  v_row := v_pages -> 'rows' -> 0;
  assert v_row = '{"key":"/services/solar","total":5,"qualified":3,"poor":1,"unreviewed":1,"qualificationRate":0.6000,"sufficientSample":true}'::jsonb, v_row::text;
  v_row := v_pages -> 'rows' -> 1;
  assert v_row = '{"key":"/contact","total":1,"qualified":1,"poor":0,"unreviewed":0,"qualificationRate":1.0000,"sufficientSample":false}'::jsonb, v_row::text;
  -- Leads with no recorded landing page are one honest "not recorded" (null) bucket.
  v_row := v_pages -> 'rows' -> 2;
  assert v_row = '{"key":null,"total":2,"qualified":0,"poor":1,"unreviewed":1,"qualificationRate":0.0000,"sufficientSample":false}'::jsonb, v_row::text;

  v_sources := public.website_lead_breakdown(null, v_today, v_today + 1, 'source');
  -- utm_source (trimmed, lowercased) wins; else referrer host without www/userinfo/port/path.
  assert (select jsonb_agg(row_value -> 'key') from jsonb_array_elements(v_sources -> 'rows') row_value)
    = '["google","evil.example","facebook","google.com",null]'::jsonb, v_sources::text;
  assert v_sources -> 'rows' -> 0 = '{"key":"google","total":2,"qualified":1,"poor":0,"unreviewed":1,"qualificationRate":0.5000,"sufficientSample":false}'::jsonb, v_sources::text;
  assert v_sources -> 'rows' -> 4 = '{"key":null,"total":3,"qualified":0,"poor":2,"unreviewed":1,"qualificationRate":0.0000,"sufficientSample":false}'::jsonb, v_sources::text;

  -- Aggregate keys only: no contact data, full referrer URLs, query strings or credentials.
  assert not ((v_pages::text || v_sources::text) ~* '@|visitor|\+27|gclid|q=|someuser|secret|8443|preview|example\.test'), 'breakdown leaked PII or URL detail';

  -- Exact-client and input rules.
  begin
    perform public.website_lead_breakdown('40600000-0000-4000-8000-000000000002', v_today, v_today + 1, 'source');
    raise exception 'client A read client B breakdown';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.website_lead_breakdown(null, v_today, v_today + 1, 'contact_email');
    raise exception 'unknown dimension accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.website_lead_breakdown(null, v_today + 1, v_today, 'source');
    raise exception 'inverted period accepted';
  exception when invalid_parameter_value then null;
  end;
  v_pages := public.website_lead_breakdown(null, date '2020-01-01', date '2020-02-01', 'landing_page');
  assert v_pages -> 'rows' = '[]'::jsonb and (v_pages ->> 'otherRows')::int = 0, 'empty period is not truthful';
end $$;
commit;

-- Staff on client B: at most ten rows, the remainder counted, never silently dropped.
begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000001');
do $$
declare
  v_today date := (now() at time zone 'Africa/Johannesburg')::date;
  v_pages jsonb := public.website_lead_breakdown('40600000-0000-4000-8000-000000000002', v_today, v_today + 1, 'landing_page');
  v_sources jsonb;
begin
  assert v_pages ->> 'clientId' = '40600000-0000-4000-8000-000000000002', v_pages::text;
  assert jsonb_array_length(v_pages -> 'rows') = 10 and (v_pages ->> 'otherRows')::int = 2, v_pages::text;
  -- lead-b-1 is the only Good lead, with no recorded landing page: it ranks first.
  assert v_pages -> 'rows' -> 0 ->> 'key' is null and (v_pages -> 'rows' -> 0 ->> 'qualified')::int = 1, v_pages::text;
  assert v_pages -> 'rows' -> 1 ->> 'key' = '/b-page-01', v_pages::text;
  -- Unsafe landing paths join the "not recorded or not recognised" bucket (b-1 + 8 hostile rows).
  assert (v_pages -> 'rows' -> 0 ->> 'total')::int = 9, v_pages::text;

  -- Sources: only safe tokens or valid referrer hosts survive; everything else is null.
  v_sources := public.website_lead_breakdown('40600000-0000-4000-8000-000000000002', v_today, v_today + 1, 'source');
  assert (select jsonb_agg(row_value -> 'key') from jsonb_array_elements(v_sources -> 'rows') row_value)
    = jsonb_build_array(null, 'mkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk', 'news.example.org', 'newsletter'), v_sources::text;
  assert (v_sources -> 'rows' -> 0 ->> 'total')::int = 17 and (v_sources ->> 'otherRows')::int = 0, v_sources::text;
  assert not ((v_pages::text || v_sources::text) ~* '@|%40|john|smith|jane|https?:|evil|bad_host|story|abbbb|\s{2}'),
    'hostile attribution leaked into breakdown keys';
  begin
    perform public.website_lead_breakdown(null, v_today, v_today + 1, 'source');
    raise exception 'staff read breakdown without client';
  exception when invalid_parameter_value then null;
  end;
end $$;
commit;

-- A client without a website is "not connected", not zero performance.
begin;
set local role authenticated;
select pg_temp.as_user('40610000-0000-4000-8000-000000000005');
do $$
declare
  v_pages jsonb := public.website_lead_breakdown(null, date '2026-01-01', date '2026-02-01', 'landing_page');
begin
  assert v_pages ->> 'state' = 'not_connected' and v_pages -> 'rows' = '[]'::jsonb, v_pages::text;
end $$;
commit;

-- Read-only: the breakdown changed no evidence.
do $$
begin
  assert (select count(*) from public.website_enquiries) = 30, 'unexpected enquiry count';
  assert (select count(*) from public.website_enquiry_lead_states) = 7, 'unexpected lifecycle rows';
end $$;

select 'Lead breakdown acceptance passed' as result;
