// Issue #624. Drives the real intake handler against the real canonical M2A transaction in
// an isolated, disposable PostgreSQL container. No application credentials or existing DB.
import assert from 'node:assert/strict'
import { spawnSync, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { handleIntakeRequest, INTAKE_KEY_HEADER, MAX_INTAKE_BODY_BYTES } from '../supabase/functions/_shared/websiteEnquiryIntake.ts'

const container = `cg-624-intake-acceptance-${randomUUID()}`
const database = 'cg_website_enquiry_acceptance'
const image = 'postgres:17-alpine'

function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Docker acceptance failed')
  return result.stdout
}
function psql(input, db = database) {
  return spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD=postgres', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres',
    '-d', db, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A'], { input, encoding: 'utf8' })
}
function sql(input, db = database) {
  const result = psql(input, db)
  if (result.status !== 0) throw new Error(result.stderr || 'SQL failed')
  return result.stdout.trim()
}
const literal = (value) => {
  const tag = `q${randomUUID().replaceAll('-', '')}`
  return `$${tag}$${value}$${tag}$`
}

// The exact RPC call the Deno entrypoint makes via PostgREST, executed as service_role.
async function submit(args) {
  const result = psql(`\\set VERBOSITY verbose
set role service_role;
select public.submit_website_enquiry(${literal(args.p_intake_key)}::uuid, ${literal(args.p_schema_key)},
  ${Number(args.p_schema_version)}, ${literal(args.p_submission_key)},
  ${literal(JSON.stringify(args.p_answers))}::jsonb, ${literal(JSON.stringify(args.p_attribution))}::jsonb);`)
  if (result.status === 0) return { data: JSON.parse(result.stdout.trim()), error: null }
  const match = result.stderr.match(/ERROR:\s+([0-9A-Z]{5}):\s+([^\n]*)/)
  return { data: null, error: { code: match?.[1], message: match?.[2] } }
}

const logs = []
const admit = async key => ({ data: JSON.parse(sql(`set role service_role; select public.reserve_website_enquiry_intake(${literal(key)}::uuid);`)) })
const deps = { submit, admit, log: (entry) => logs.push(entry) }
const INTAKE_A = '62410000-0000-4000-8000-000000000001'
const INTAKE_DISABLED = '62410000-0000-4000-8000-000000000002'
const INTAKE_DRAFT_SCHEMA = '62410000-0000-4000-8000-000000000003'
const INTAKE_NO_RECIPIENT = '62410000-0000-4000-8000-000000000004'
const INTAKE_B = '62410000-0000-4000-8000-000000000005'
const UNKNOWN = '62410000-0000-4000-8000-0000000000ff'

const answers = { name: 'Intake Visitor', email: 'Visitor@Example.test', phone: '+27 82 555 0100', message: 'Please quote' }
const body = (overrides = {}) => ({ schemaKey: 'contact_form', schemaVersion: 1, submissionKey: 'piek-intake-000000001', answers, attribution: { landing_path: '/contact', utm_source: 'google' }, ...overrides })
const request = (payload, { key = INTAKE_A, headers = {}, method = 'POST', raw } = {}) => new Request('https://functions.example.test/website-enquiry-intake', {
  method,
  headers: { 'content-type': 'application/json', ...(key ? { [INTAKE_KEY_HEADER]: key } : {}), ...headers },
  ...(method === 'GET' || method === 'HEAD' ? {} : { body: raw ?? JSON.stringify(payload) }),
})
async function call(...args) {
  const response = await handleIntakeRequest(request(...args), deps)
  const text = await response.text()
  return { status: response.status, body: JSON.parse(text), text, headers: response.headers }
}
const count = (table, where = 'true') => Number(sql(`select count(*) from public.${table} where ${where};`))

let created = false
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=postgres', image])
  created = true
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { encoding: 'utf8' })
    if (result.status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  sql(`create database ${database};`, 'postgres')
  sql(`create extension pgcrypto; create schema auth; create schema extensions;
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    alter default privileges grant all on tables to service_role;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.clients(id uuid primary key, name text not null, active boolean not null default true);
    create table public.profiles(id uuid primary key references auth.users(id), full_name text, role text,
      client_id uuid references public.clients(id), is_active boolean not null default true);`)
  for (const migration of ['20261001181932_website_enquiry_transaction.sql', '20261002085355_website_enquiry_intake_guard.sql', '20261002090000_website_lead_lifecycle.sql', '20261002110000_website_enquiry_delivery_runtime.sql']) {
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'))
  }
  sql(readFileSync(new URL('../tests/sql/624_website_enquiry_intake_fixtures.sql', import.meta.url), 'utf8'))

  // Boundary: method, browser origin, key, content type, size, body shape.
  assert.equal((await call(body(), { method: 'GET' })).status, 405)
  assert.equal((await call(body(), { headers: { origin: 'https://www.piekgroup.co.za' } })).body.error, 'server_to_server_only')
  assert.equal((await call(body(), { headers: { 'sec-fetch-site': 'cross-site' } })).status, 403)
  assert.equal((await call(body(), { key: null })).body.error, 'unauthorized')
  assert.equal((await call(body(), { key: 'not-a-uuid' })).status, 401)
  assert.equal((await call(body(), { headers: { 'content-type': 'text/plain' } })).status, 415)
  assert.equal((await call(null, { raw: 'x'.repeat(MAX_INTAKE_BODY_BYTES + 1) })).status, 413)
  assert.equal((await call(null, { raw: '{not json' })).body.error, 'invalid_request')
  assert.equal((await call(null, { raw: '[]' })).status, 400)
  // No client/Website/environment/recipient/role/lifecycle override path exists.
  for (const extra of [{ clientId: '62400000-0000-4000-8000-000000000002' }, { websiteId: '5' }, { environment: 'production' },
    { recipientEmail: 'attacker@example.test' }, { role: 'admin' }, { status: 'won' }, { intakeKey: INTAKE_B }]) {
    assert.equal((await call(body(extra))).body.error, 'invalid_request', JSON.stringify(extra))
  }
  assert.equal((await call(body({ attribution: { utm_source: 'x', client_id: 'y' } }))).status, 400)
  assert.equal((await call(body({ attribution: { landing_path: 'a\r\nb' } }))).status, 400)
  assert.equal(count('website_enquiries'), 0, 'boundary rejections created enquiries')

  // Answers smuggling identity are rejected by the canonical schema contract.
  const smuggled = await call(body({ submissionKey: 'piek-intake-smuggle01', answers: { ...answers, recipient_email: 'attacker@example.test' } }))
  assert.equal(smuggled.body.error, 'invalid_submission')

  // Honeypot: generic handled response, nothing canonical created.
  const spam = await call(body({ submissionKey: 'piek-intake-honeypot01', honeypot: 'http://spam.example' }))
  assert.deepEqual([spam.status, spam.body], [202, { ok: true, handled: true }])
  assert.equal(count('website_enquiries'), 0, 'honeypot created an enquiry')
  assert.equal(count('website_enquiry_delivery_jobs'), 0, 'honeypot created outbox work')

  // Happy path into the canonical transaction.
  const first = await call(body())
  assert.equal(first.status, 201, first.text)
  assert.deepEqual(Object.keys(first.body).sort(), ['acceptedAt', 'handled', 'ok', 'receiptId', 'replayed', 'accepted'].sort())
  assert.equal(first.body.replayed, false)
  assert.equal(count('website_enquiries', `receipt_id = '${first.body.receiptId}' and client_id = '62400000-0000-4000-8000-000000000001' and website_editor_website_id = '1' and environment = 'production'`), 1)
  assert.equal(count('website_enquiry_delivery_jobs', `delivery_state = 'pending'`), 1, 'one pending outbox job, no send')
  assert.equal(count('website_enquiry_delivery_jobs', `delivery_state <> 'pending'`), 0, 'intake attempted delivery')
  assert.equal(sql(`select contact_snapshot ->> 'email' from public.website_enquiries where receipt_id = '${first.body.receiptId}';`), 'visitor@example.test')

  // Identical replay returns the same receipt; changed payload conflicts.
  const replay = await call(body())
  assert.equal(replay.status, 200)
  assert.equal(replay.body.receiptId, first.body.receiptId)
  assert.equal(replay.body.replayed, true)
  const conflict = await call(body({ answers: { ...answers, message: 'Different' } }))
  assert.deepEqual([conflict.status, conflict.body.error, conflict.body.retryable], [409, 'submission_conflict', false])
  assert.equal(count('website_enquiries'), 1)

  // Fail closed: unknown key, disabled endpoint, inactive schema, no approved recipients, unsupported schema.
  for (const key of [UNKNOWN, INTAKE_DISABLED, INTAKE_DRAFT_SCHEMA, INTAKE_NO_RECIPIENT]) {
    const result = await call(body({ submissionKey: `piek-intake-closed-${key.slice(-2)}` }), { key })
    assert.deepEqual([result.status, result.body.error], [403, 'intake_unavailable'], key)
  }
  assert.equal((await call(body({ submissionKey: 'piek-intake-schema-v9', schemaVersion: 9 }))).body.error, 'schema_unsupported')
  assert.equal((await call(body({ submissionKey: 'piek-intake-missing-01', answers: { name: 'No contact' } }))).body.error, 'invalid_submission')
  assert.equal(count('website_enquiries'), 1, 'a fail-closed path created an enquiry')

  // Same submission key on another endpoint is that endpoint's own transaction, never client A's.
  const other = await call(body(), { key: INTAKE_B })
  assert.equal(other.status, 201)
  assert.notEqual(other.body.receiptId, first.body.receiptId)
  assert.equal(count('website_enquiries', `receipt_id = '${other.body.receiptId}' and client_id = '62400000-0000-4000-8000-000000000002'`), 1)

  // Transport failure is retryable and safe.
  const down = await handleIntakeRequest(request(body()), { admit, submit: async () => { throw new Error('connection reset 10.0.0.1') } })
  const downBody = await down.json()
  assert.deepEqual([down.status, downBody], [503, { ok: false, error: 'temporarily_unavailable', retryable: true }])

  // No PII, answers, intake key or raw body in any log line or error response.
  const logText = JSON.stringify(logs)
  for (const secret of [INTAKE_A, INTAKE_B, 'Intake Visitor', 'visitor@example.test', 'Visitor@Example.test', '+27 82', 'Please quote', 'attacker@example.test', 'spam.example']) {
    assert.ok(!logText.includes(secret), `log leaked ${secret}`)
  }
  assert.ok(logs.every((entry) => Object.keys(entry).sort().join() === 'event,outcome,status'), 'log shape widened')
  for (const response of [first, replay, conflict, spam, smuggled]) {
    assert.ok(!/visitor|attacker|\+27|quote|62410000/i.test(response.text), `response leaked data: ${response.text}`)
  }
  assert.equal(first.headers.get('access-control-allow-origin'), null, 'CORS header exposed')
  assert.equal(first.headers.get('cache-control'), 'no-store')

  // The actual browser RPC sees only its own canonical intake receipt.
  const inbox = user => sql(`set role authenticated; set request.jwt.claim.sub='${user}'; select receipt_id from public.website_lead_inbox(null, 100, null);`)
  assert.equal(inbox('62401000-0000-4000-8000-000000000002'), first.body.receiptId)
  assert.equal(inbox('62401000-0000-4000-8000-000000000003'), other.body.receiptId)
  sql(`do $$ begin
    assert not has_function_privilege('anon', 'public.reserve_website_enquiry_intake(uuid)', 'execute');
    assert not has_function_privilege('authenticated', 'public.reserve_website_enquiry_intake(uuid)', 'execute');
    assert not has_table_privilege('authenticated', 'public.website_enquiry_intake_budgets', 'select');
    assert (select relrowsecurity and relforcerowsecurity from pg_class where oid='public.website_enquiry_intake_budgets'::regclass);
  end $$;`)
  sql('truncate public.website_enquiry_intake_budgets;')
  // Avoid a wall-clock minute rollover during the concurrent admission fixture.
  while (new Date().getUTCSeconds() > 45) await new Promise(resolve => setTimeout(resolve, 250))
  // Twenty independent DB sessions: exactly ten may be admitted in one minute.
  const states = await Promise.all(Array.from({ length: 20 }, () => new Promise((resolve, reject) => {
    const process = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-X', '-q', '-t', '-A'])
    let output = ''; let error = ''
    process.stdout.on('data', chunk => { output += chunk })
    process.stderr.on('data', chunk => { error += chunk })
    process.on('error', reject)
    process.on('close', code => code === 0 ? resolve(JSON.parse(output.trim()).state) : reject(Error(error)))
    process.stdin.end(`set role service_role; select public.reserve_website_enquiry_intake('${INTAKE_A}');`)
  })))
  assert.equal(states.filter(state => state === 'allowed').length, 10)
  assert.equal(states.filter(state => state === 'rate_limited').length, 10)
  const limited = await call(body())
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('retry-after'), '60')
  assert.equal(count('website_enquiries'), 2)
  // Minute changes cannot bypass hourly saturation; counts remain bounded.
  sql("update public.website_enquiry_intake_budgets set minute_start=now()-interval '2 minutes', hour_start=date_trunc('hour',now()), hour_count=100;")
  const hourly = await call(body())
  assert.equal(hourly.status, 429)
  assert.equal(hourly.headers.get('retry-after'), '3600')
  assert.equal(sql('select max(hour_count) from public.website_enquiry_intake_budgets;'), '101')
  // A delayed request's older clock snapshot must never rewind/reset a newer bucket.
  sql("update public.website_enquiry_intake_budgets set minute_start=date_trunc('minute',now())+interval '1 minute', minute_count=10;")
  assert.equal((await call(body())).status, 429)
  assert.equal(sql("select bool_and(minute_start > date_trunc('minute',now()) and minute_count=11) from public.website_enquiry_intake_budgets;"), 't')

  console.log('PASS: #624 intake — canonical enquiry/outbox/Inbox, replay/conflict/isolation, fail-closed boundaries, PII-free logs, RLS/grants and bounded 20-session admission')
} finally {
  if (created) docker(['stop', container])
}
