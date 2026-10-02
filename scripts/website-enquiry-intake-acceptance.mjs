import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createWebsiteIntakeHandler } from '../supabase/functions/_shared/websiteEnquiryIntake.ts'

// Disposable local PostgreSQL only: HTTP adapter -> real canonical transaction -> exact-client inbox.
const container = `cg-405-m2c-${randomUUID()}`
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw Error(result.stderr || 'Disposable acceptance failed')
  return result.stdout
}
const sqlArgs = ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'acceptance', '-v', 'ON_ERROR_STOP=1', '-X', '-t', '-A', '-q']
const sql = input => docker(sqlArgs, input).trim()
const literal = value => `'${String(value).replaceAll("'", "''")}'`
const key = '40621000-0000-4000-8000-000000000001'
const guard = `select public.reserve_website_enquiry_intake('${key}', 'a.example.test', 'contact_form', 1);`
let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=postgres', 'postgres:17-alpine'])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']).status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  assert.ok(ready)
  docker(['exec', container, 'psql', '-U', 'postgres', '-c', 'create database acceptance;'])
  sql(`create extension pgcrypto; create schema auth; create schema extensions;
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    alter default privileges grant all on tables to service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.clients(id uuid primary key, name text not null, active boolean not null default true);
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role text,
      client_id uuid references public.clients(id), is_active boolean not null default true);`)
  for (const file of ['20261001181932_website_enquiry_transaction.sql', '20261002090000_website_lead_lifecycle.sql', '20261002085355_website_enquiry_intake_guard.sql']) {
    sql(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
  }
  // Reuse the canonical M2B setup only, before it submits any observations.
  const fixture = readFileSync(new URL('../tests/sql/405_website_lead_lifecycle_acceptance.sql', import.meta.url), 'utf8')
  sql(fixture.split('-- Acquisition through the canonical M2A transaction only')[0])
  const rpc = async (name, args) => {
    assert.ok(['reserve_website_enquiry_intake', 'submit_website_enquiry'].includes(name))
    const values = Object.values(args).map(value => typeof value === 'number' ? String(value) : typeof value === 'object' ? `${literal(JSON.stringify(value))}::jsonb` : literal(value))
    try { return { data: JSON.parse(sql(`set role service_role; select public.${name}(${values.join(',')});`)), error: null } }
    catch { return { data: null, error: { code: '22023' } } }
  }
  const handle = createWebsiteIntakeHandler({ enabled: true, rpc })
  const request = (host = 'a.example.test', body = {}) => new Request('https://edge.example.test/intake', { method: 'POST', headers: {
    'content-type': 'application/json', origin: `https://${host}`, 'x-website-host': host,
    'x-intake-key': key, 'x-form-schema': 'contact_form', 'x-form-version': '1',
  }, body: JSON.stringify({ submissionKey: '62300000-0000-4000-8000-000000000001', answers: { name: 'Visitor', email: 'visitor@example.test', message: 'Need a quote' }, ...body }) })
  const accepted = await handle(request())
  assert.equal(accepted.status, 200)
  const receipt = await accepted.json()
  assert.deepEqual(await (await handle(request())).json(), receipt)
  assert.equal(sql('select count(*) from public.website_enquiries;'), '1')
  assert.equal(sql('select count(*) from public.website_enquiry_delivery_jobs;'), '1')
  assert.equal(sql('select count(*) from public.website_enquiry_events;'), '1')
  assert.equal((await handle(request('b.example.test'))).status, 503)
  assert.equal((await handle(request('a.example.test', { client_id: '40600000-0000-4000-8000-000000000002' }))).status, 400)
  const inbox = user => sql(`set role authenticated; set request.jwt.claim.sub='${user}'; select count(*) from public.website_lead_inbox(null, 100, null);`)
  assert.equal(inbox('40610000-0000-4000-8000-000000000002'), '1')
  assert.equal(inbox('40610000-0000-4000-8000-000000000003'), '0')
  sql(`do $$ begin
    assert not has_function_privilege('anon', 'public.reserve_website_enquiry_intake(uuid,text,text,integer)', 'execute');
    assert not has_function_privilege('authenticated', 'public.reserve_website_enquiry_intake(uuid,text,text,integer)', 'execute');
    assert not has_table_privilege('authenticated', 'public.website_enquiry_intake_budgets', 'select');
    assert (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.website_enquiry_intake_budgets'::regclass);
  end $$;`)
  // Twenty independent sessions race; exactly ten may enter the existing transaction.
  sql('truncate public.website_enquiry_intake_budgets;')
  const results = await Promise.all(Array.from({ length: 20 }, () => new Promise((resolve, reject) => {
    const process = spawn('docker', sqlArgs)
    let output = ''; let error = ''
    process.stdout.on('data', chunk => { output += chunk })
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve(JSON.parse(output.trim()).state) : reject(Error(error)))
    process.stdin.end(`set role service_role; ${guard}`)
  })))
  assert.equal(results.filter(state => state === 'allowed').length, 10)
  assert.equal(results.filter(state => state === 'rate_limited').length, 10)
  assert.equal((await handle(request())).status, 429)
  // Saturated hourly budget cannot be bypassed by a new minute.
  sql("update public.website_enquiry_intake_budgets set minute_start=now()-interval '2 minutes', hour_start=date_trunc('hour',now()), hour_count=100;")
  const exhausted = JSON.parse(sql(`set role service_role; ${guard}`))
  assert.equal(exhausted.state, 'rate_limited')
  assert.equal(exhausted.retry_after, 3600)
  sql("update public.website_enquiry_endpoints set enabled=false where canonical_host='a.example.test';")
  assert.equal((await handle(request())).status, 503)
  assert.equal(sql('select count(*) from public.website_enquiries;'), '1')
  console.log('PASS: actual HTTP intake -> canonical PostgreSQL enquiry/outbox/event -> exact-client inbox; replay, cross-client denial, RLS/grants, OFF and 20-session bounded admission')
} finally { if (created) docker(['stop', container]) }
