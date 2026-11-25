import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { readFileSync } from 'node:fs'
import { randomUUID, createHash, webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

// Opt-in, task-owned, NETWORK-NONE container only. Real SQL and SDK; the
// PostgREST wire adapter is local and synthetic. No HTTP server/provider call.
// Minimal fixture schema models the existing state interface, not hosted RLS.
const container = process.env.CG_SOCIAL_QA_CONTAINER
const enabled = container === 'cg-dynamics-social-220-qa'
const database = `qa_meta_state_${randomUUID().replaceAll('-', '')}`
const exec = promisify(execFile), q = value => `'${String(value).replaceAll("'", "''")}'`
const args = ['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', database, '-v', 'ON_ERROR_STOP=1', '-Atq']
const sql = (text, role = '') => execFileSync('docker', args, {
  input: (role ? `set role ${role};\n` : '') + text, encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
}).trim()
const json = (text, role = '') => JSON.parse(sql(text, role) || 'null')
function load(path, dependencies = {}) {
  const exports = {}, code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  vm.runInNewContext(code, { exports, crypto: webcrypto, TextEncoder, btoa, URL, URLSearchParams, Date,
    require(name) { assert(Object.hasOwn(dependencies, name), 'Unexpected fixture dependency'); return dependencies[name] } })
  return exports
}
const shared = load('supabase/functions/_shared/metaOAuthRequest.ts')
const setup = load('supabase/functions/cg-dynamics-mcp/facebookPermissionSetup.ts', {
  '../_shared/metaOAuthRequest.ts': shared, '../_shared/meta.ts': { resolveMetaGraphConfig: () => ({ version: 'v27.0' }) },
})
// Execute the REAL callback's hashing + one-use consumption query, stopping
// BEFORE code exchange, tokens or connection writes. No duplicate implementation.
const callback = readFileSync('supabase/functions/meta-oauth-callback/index.ts', 'utf8')
const ast = ts.createSourceFile('callback.ts', callback, ts.ScriptTarget.Latest, true)
const hashDeclaration = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sha256Hex')
assert(hashDeclaration)
const hashJs = ts.transpileModule(hashDeclaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const callbackHash = new Function('crypto', 'TextEncoder', `${hashJs};return sha256Hex`)(webcrypto, TextEncoder)
const first = callback.indexOf('  const stateHash = await sha256Hex(state)')
const last = callback.indexOf('\n  if (stateError || !consumedState)', first)
assert(first >= 0 && last > first, 'Callback state-consumption boundary changed; review the fixture')
const consume = new Function('sb', 'state', 'sha256Hex', `return (async()=>{${callback.slice(first, last)};return {consumedState,stateError}})()`)
let created = false
before(() => {
  if (!enabled) return
  const format = '{"task":{{json (index .Config.Labels "cg.task")}},"network":{{json .HostConfig.NetworkMode}},"ports":{{json .HostConfig.PortBindings}},"running":{{json .State.Running}}}'
  const metadata = JSON.parse(execFileSync('docker', ['inspect', '--format', format, container], { encoding: 'utf8' }))
  assert.equal(metadata.task, 'social-publishing-220')
  assert.equal(metadata.network, 'none'); assert.deepEqual(metadata.ports ?? {}, {})
  assert.equal(metadata.running, true)
  execFileSync('docker', ['exec', container, 'createdb', '-U', 'postgres', database], { timeout: 15000 })
  created = true
  sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;
    create table profiles(id uuid primary key,role text not null,is_active boolean not null);
    create table meta_oauth_states(id uuid primary key default gen_random_uuid(),state_hash text not null unique check(state_hash ~ '^[a-f0-9]{64}$'),
      user_id uuid not null references profiles(id),expires_at timestamptz not null,used_at timestamptz);
    alter table meta_oauth_states enable row level security;
    grant select on profiles to service_role; grant select,insert,update on meta_oauth_states to service_role;`)
})
after(() => {
  if (created) execFileSync('docker', ['exec', container, 'dropdb', '-U', 'postgres', database], { timeout: 15000 })
})

function fixture({ role = 'admin', active = true, roleAfterInsert } = {}) {
  const actor = randomUUID(), calls = [], env = { META_APP_ID: '123456', META_REDIRECT_URI: 'https://fixture.invalid/meta-oauth-callback',
    SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED: 'true' }
  sql(`insert into profiles values(${q(actor)},${q(role)},${active});`)
  const sb = createClient('https://fixture.invalid', 'synthetic-only', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { async fetch(input, init) {
      const url = new URL(String(input)), method = init?.method ?? 'GET'
      assert.equal(url.origin, 'https://fixture.invalid'); calls.push({ method, path: url.pathname })
      try {
        if (url.pathname === '/rest/v1/profiles') {
          assert.equal(method, 'GET'); assert.equal(url.searchParams.get('id'), `eq.${actor}`)
          assert.equal(url.searchParams.get('select'), 'role,is_active')
          return Response.json(json(`select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select role,is_active from profiles where id=${q(actor)}) r`, 'service_role'))
        }
        assert.equal(url.pathname, '/rest/v1/meta_oauth_states')
        if (method === 'POST') {
          const row = JSON.parse(init.body)
          assert.deepEqual(Object.keys(row).sort(), ['expires_at', 'state_hash', 'user_id'])
          assert.equal(row.user_id, actor); assert.match(row.state_hash, /^[a-f0-9]{64}$/)
          sql(`insert into meta_oauth_states(state_hash,user_id,expires_at) values(${q(row.state_hash)},${q(row.user_id)},${q(row.expires_at)});`, 'service_role')
          if (roleAfterInsert) sql(`update profiles set role=${q(roleAfterInsert)} where id=${q(actor)};`)
          return new Response(null, { status: 201 })
        }
        assert.equal(method, 'PATCH')
        assert.equal(url.searchParams.get('used_at'), 'is.null'); assert.equal(url.searchParams.get('select'), 'id,user_id')
        const hash = url.searchParams.get('state_hash'), expiry = url.searchParams.get('expires_at')
        assert.match(hash, /^eq\.[a-f0-9]{64}$/); assert.match(expiry, /^gt\.[0-9TZ:.-]+$/)
        const row = JSON.parse(init.body); assert.deepEqual(Object.keys(row), ['used_at'])
        const text = `set role service_role; with consumed as (update meta_oauth_states set used_at=${q(row.used_at)}
          where state_hash=${q(hash.slice(3))} and used_at is null and expires_at>${q(expiry.slice(3))}::timestamptz returning id,user_id)
          select coalesce(jsonb_agg(to_jsonb(consumed)),'[]') from consumed;`
        // Independent PostgreSQL sessions allow actual concurrent UPDATEs.
        const { stdout } = await exec('docker', args.concat(['-c', text]), { encoding: 'utf8', timeout: 15000 })
        const rows = JSON.parse(stdout.trim())
        return rows.length === 1 ? Response.json(rows[0]) : Response.json({ code: 'PGRST116', message: 'No single unused state' }, { status: 406 })
      } catch (error) {
        if (error?.code === 'ERR_ASSERTION') throw error
        return Response.json({ code: 'SYNTHETIC_DATABASE_FAILURE', message: 'Private local database failure' }, { status: 500 })
      }
    } } })
  const principal = { userId: actor, profileId: actor, role }
  const dispatcher = actualOperationalDispatcher({ supabase: sb, profileId: actor, connection: principal,
    contextKind: 'company_admin', effectiveClientId: null, role, isActive: active }, {
    start_facebook_permission_setup: (staff, raw) => setup.startFacebookPermissionSetup(staff.supabase, staff.connection.profileId, raw, name => env[name]),
  }, new Set())
  return { actor, calls, env,
    async request(raw = { confirm_permission_request: true }, context = { context_kind: 'company_admin' }) {
      const response = await dispatcher({ context, ...raw }, 'start_facebook_permission_setup')
      return response.error ? { dispatcherError: response.error } : JSON.parse(response.result.content[0].text)
    },
    consume: state => consume(sb, state, callbackHash),
    rows: () => json(`select coalesce(jsonb_agg(to_jsonb(s)),'[]') from meta_oauth_states s where user_id=${q(actor)}`),
  }
}

test('PostgreSQL: actual dispatcher/SDK persist only hashed actor-bound expiring state', { skip: !enabled }, async () => {
  const f = fixture(), result = await f.request(), rows = f.rows()
  assert.equal(result.ok, true); assert.equal(result.canPublish, false); assert.equal(result.requiresOwnerConsent, true)
  assert.equal(rows.length, 1); const state = new URL(result.url).searchParams.get('state')
  assert.equal(rows[0].state_hash, createHash('sha256').update(state).digest('hex'))
  assert.equal(rows[0].user_id, f.actor); assert.equal(rows[0].used_at, null)
  assert.equal(Date.parse(rows[0].expires_at), Date.parse(result.expires_at))
  assert.equal(JSON.stringify(rows).includes(state), false)
  assert(f.calls.every(c => ['/rest/v1/profiles', '/rest/v1/meta_oauth_states'].includes(c.path)))
})

test('PostgreSQL: real callback state query has one winner across concurrent consumers and refuses replay', { skip: !enabled }, async () => {
  const f = fixture(), result = await f.request(), state = new URL(result.url).searchParams.get('state')
  const outcomes = await Promise.all([f.consume(state), f.consume(state)])
  assert.equal(outcomes.filter(r => !r.stateError && r.consumedState?.user_id === f.actor).length, 1)
  assert.equal(outcomes.filter(r => r.stateError && !r.consumedState).length, 1)
  assert(f.rows()[0].used_at)
  assert.equal((await f.consume(state)).consumedState, null)
})

test('PostgreSQL: expired and tampered state cannot pass the actual callback predicate', { skip: !enabled }, async () => {
  const f = fixture(), result = await f.request(), state = new URL(result.url).searchParams.get('state')
  assert.equal((await f.consume(`${state}altered`)).consumedState, null)
  sql(`update meta_oauth_states set expires_at=now()-interval '1 second' where user_id=${q(f.actor)};`)
  assert.equal((await f.consume(state)).consumedState, null); assert.equal(f.rows()[0].used_at, null)
})

test('PostgreSQL: inactive roles refuse insertion and mid-insert revocation withholds the setup URL', { skip: !enabled }, async () => {
  for (const options of [{ active: false }, { role: 'staff' }, { roleAfterInsert: 'staff' }]) {
    const f = fixture(options), result = await f.request()
    assert.equal(result.error, 'ACTIVE_MANAGER_REQUIRED'); assert.equal(result.url, undefined)
    assert.equal(f.rows().length, options.roleAfterInsert ? 1 : 0)
  }
})

test('PostgreSQL: unconfirmed, wrong-context and disabled requests create no state', { skip: !enabled }, async () => {
  const f = fixture()
  assert.equal((await f.request({ confirm_permission_request: false })).error, 'META_PUBLISHING_CONSENT_REQUEST_INVALID')
  assert((await f.request(undefined, { context_kind: 'staff', staff_profile_id: f.actor })).dispatcherError)
  f.env.SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED = 'false'
  assert.equal((await f.request()).error, 'META_PUBLISHING_CONSENT_DISABLED')
  assert.equal(f.rows().length, 0); assert.equal(f.calls.length, 0)
})

test('PostgreSQL: real denied state insert returns only a safe failure without a URL', { skip: !enabled }, async () => {
  const f = fixture()
  sql('revoke insert on meta_oauth_states from service_role;')
  try {
    const result = await f.request()
    assert.equal(result.error, 'META_OAUTH_STATE_UNAVAILABLE'); assert.equal(result.url, undefined)
    assert.equal(f.rows().length, 0); assert.doesNotMatch(JSON.stringify(result), /permission denied|insert into|state_hash|https/i)
  } finally { sql('grant insert on meta_oauth_states to service_role;') }
})
