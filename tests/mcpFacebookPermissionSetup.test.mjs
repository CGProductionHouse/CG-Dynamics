import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import vm from 'node:vm'
import ts from 'typescript'
import { createClient } from '@supabase/supabase-js'
import { actualOperationalDispatcher } from './helpers/mcpOperationalDispatcher.mjs'

const actor = '11111111-1111-4111-8111-111111111111'
const tool = 'start_facebook_permission_setup'
const reportingScopes = ['pages_show_list', 'pages_read_engagement', 'read_insights',
  'instagram_basic', 'instagram_manage_insights', 'business_management']
function load(path, dependencies = {}) {
  const exports = {}
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  vm.runInNewContext(js, { exports, crypto: webcrypto, TextEncoder, btoa, URL, URLSearchParams, Date,
    require(name) { assert(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`); return dependencies[name] } })
  return exports
}
const shared = load('supabase/functions/_shared/metaOAuthRequest.ts')

function fixture({ role = 'admin', active = true, fail = false, afterInsertRole = role, thrown = false } = {}) {
  const env = { META_APP_ID: '123456', META_REDIRECT_URI: 'https://fixture.supabase.co/functions/v1/meta-oauth-callback',
    SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED: 'true' }
  const calls = [], writes = [], reads = []
  let profileRole = role
  const sb = createClient('https://fixture.supabase.co', 'synthetic-not-a-secret', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { async fetch(input, init) {
      const url = new URL(String(input)), method = init?.method ?? 'GET'
      calls.push({ path: url.pathname, method, query: url.searchParams })
      if (url.pathname === '/rest/v1/profiles') {
        assert.equal(method, 'GET'); assert.equal(url.searchParams.get('id'), `eq.${actor}`)
        assert.equal(url.searchParams.get('select'), 'role,is_active')
        return Response.json({ role: profileRole, is_active: active })
      }
      assert.equal(url.pathname, '/rest/v1/meta_oauth_states'); assert.equal(method, 'POST')
      const row = JSON.parse(init.body); writes.push(row)
      if (thrown) throw new Error('PRIVATE TRANSPORT DETAIL')
      profileRole = afterInsertRole
      return fail ? Response.json({ code: 'PRIVATE_DATABASE_DETAIL', message: 'PRIVATE_ERROR' }, { status: 500 })
        : new Response(null, { status: 201 })
    } },
  })
  const setup = load('supabase/functions/cg-dynamics-mcp/facebookPermissionSetup.ts', {
    '../_shared/metaOAuthRequest.ts': shared,
    '../_shared/meta.ts': { resolveMetaGraphConfig() { return { version: 'v27.0' } } },
  })
  const get = name => { reads.push(name); return env[name] }
  const principal = { userId: actor, profileId: actor, role }
  const staff = { supabase: sb, profileId: actor, connection: principal, contextKind: 'company_admin',
    effectiveClientId: null, role, isActive: active }
  const dispatcher = actualOperationalDispatcher(staff,
    { [tool]: (s, input) => setup.startFacebookPermissionSetup(s.supabase, s.connection.profileId, input, get) }, new Set())
  return { env, calls, writes, reads, get,
    direct: (input = { confirm_permission_request: true }, actorId = actor) => setup.startFacebookPermissionSetup(sb, actorId, input, get),
    async mcp(context = { context_kind: 'company_admin' }, input = { confirm_permission_request: true }) {
      return dispatcher({ context, ...input }, tool)
    },
    reporting: () => shared.createMetaOAuthRequest(sb, actor, { appId: env.META_APP_ID,
      redirectUri: env.META_REDIRECT_URI, graphVersion: 'v27.0', publishing: false }, get),
  }
}

test('reproduction: existing MCP catalog/dispatcher must expose a company-admin permission setup path', () => {
  const catalog = load('supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
  const action = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === tool)
  assert(action, 'Company ChatGPT previously had no accessible publishing-consent setup action')
  assert.equal(action.annotations.readOnlyHint, false)
  assert.equal(action.annotations.idempotentHint, undefined)
  assert.equal(action.inputSchema.additionalProperties, false)
  assert.equal(action.inputSchema.properties.confirm_permission_request.const, true)
  assert.match(action.description, /never auto-retry/i)
  assert.match(action.description, /owner must open\/review\/complete/i)
  const manifest = load('supabase/functions/cg-dynamics-mcp/capabilityManifest.ts').CG_CAPABILITY_MANIFEST
  assert.match(manifest.find(c => c.key === 'cg_dynamics_mcp').operatingStandards.join(' '), /fresh expiring OAuth state; never auto-retry/)
  const index = readFileSync('supabase/functions/cg-dynamics-mcp/index.ts', 'utf8')
  assert.match(index, /start_facebook_permission_setup:.*staff\.connection\.profileId/)
})

test('actual dispatcher + actual installed SDK create only an actor-bound hashed expiring login state', async () => {
  const f = fixture(), start = Date.now(), response = await f.mcp()
  assert.equal(response.result.isError, false)
  const result = JSON.parse(response.result.content[0].text), url = new URL(result.url)
  assert.equal(result.requiresOwnerConsent, true); assert.equal(result.publishing_ready, false)
  assert.equal(result.canPublish, false); assert.equal(result.scope, 'facebook_permission_setup')
  assert.equal(result._context.effective_context_kind, 'company_admin')
  assert.equal(url.origin, 'https://www.facebook.com'); assert.equal(url.pathname, '/v27.0/dialog/oauth')
  assert.equal(url.searchParams.get('response_type'), 'code'); assert.equal(url.searchParams.get('auth_type'), 'rerequest')
  assert.deepEqual(url.searchParams.get('scope').split(','), [...reportingScopes, 'pages_manage_posts'])
  assert.equal(url.searchParams.get('redirect_uri'), f.env.META_REDIRECT_URI)
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].user_id, actor)
  assert.equal(f.writes[0].state_hash, createHash('sha256').update(url.searchParams.get('state')).digest('hex'))
  assert.equal(Object.hasOwn(f.writes[0], 'state'), false)
  assert.equal(f.writes[0].expires_at, result.expires_at)
  assert(Date.parse(result.expires_at) >= start + 3599000 && Date.parse(result.expires_at) <= Date.now() + 3600000)
  assert.equal(f.calls.filter(c => c.path.endsWith('/profiles')).length, 2)
  assert(f.calls.every(c => ['/rest/v1/profiles', '/rest/v1/meta_oauth_states'].includes(c.path)))
  assert(f.reads.every(name => ['META_APP_ID', 'META_REDIRECT_URI', 'SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED'].includes(name)))
  for (const forbidden of ['job_id', 'client_id', 'connection_id', 'access_token', 'client_secret']) assert.equal(result[forbidden], undefined)
})

test('staff/client/missing Project contexts refuse setup before database work', async () => {
  for (const context of [{ context_kind: 'staff', staff_profile_id: actor },
    { context_kind: 'client', client_id: actor }, null]) {
    const f = fixture(), result = await f.mcp(context)
    assert(result.error); assert.equal(f.calls.length, 0)
  }
})

test('unconfirmed/injected requests, impersonated actors and scope/callback overrides refuse before reads', async () => {
  for (const input of [{}, { confirm_permission_request: false }, { confirm_permission_request: 'true' },
    { confirm_permission_request: true, actor_id: actor }, { confirm_permission_request: true, scope: 'ads_management' },
    { confirm_permission_request: true, redirect_uri: 'https://foreign.invalid' },
    { confirm_permission_request: true, idempotency_key: 'not-a-job' }]) {
    const f = fixture(); assert.equal((await f.direct(input)).error, 'META_PUBLISHING_CONSENT_REQUEST_INVALID')
    assert.equal(f.calls.length, 0)
  }
  const f = fixture(); assert.equal((await f.direct({ confirm_permission_request: true }, 'not-an-actor')).error, 'META_PUBLISHING_CONSENT_REQUEST_INVALID')
  assert.equal(f.calls.length, 0)
})

test('only exact enabled flag and current active admin/manager permit a state', async () => {
  for (const value of [undefined, 'false', 'TRUE', '1', ' true']) {
    const f = fixture(); f.env.SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED = value
    assert.equal((await f.direct()).error, 'META_PUBLISHING_CONSENT_DISABLED'); assert.equal(f.calls.length, 0)
  }
  for (const options of [{ role: 'staff' }, { role: 'client' }, { active: false }]) {
    const f = fixture(options); assert.equal((await f.direct()).error, 'ACTIVE_MANAGER_REQUIRED')
    assert.equal(f.writes.length, 0)
  }
  assert.equal((await fixture({ role: 'manager' }).direct()).ok, true)
})

test('a manager losing authority during persistence receives no setup URL or false grant', async () => {
  const f = fixture({ afterInsertRole: 'staff' }), r = await f.direct()
  assert.equal(r.error, 'ACTIVE_MANAGER_REQUIRED'); assert.equal(r.url, undefined)
  assert.equal(f.writes.length, 1); assert.equal(r.canPublish, false)
})

test('unsafe or absent server callback/application settings never persist login state', async () => {
  for (const patch of [{ META_APP_ID: '' }, { META_APP_ID: '123&scope=ads_management' },
    { META_REDIRECT_URI: '' }, { META_REDIRECT_URI: 'http://fixture.invalid' },
    { META_REDIRECT_URI: 'https://user:private@fixture.invalid' }, { META_REDIRECT_URI: 'https://fixture.invalid/#private' }]) {
    const f = fixture(); Object.assign(f.env, patch)
    const r = await f.direct(); assert(r.error); assert.equal(r.url, undefined); assert.equal(f.writes.length, 0)
  }
})

test('database/transport failures return safe errors without state URLs or secrets', async () => {
  for (const options of [{ fail: true }, { thrown: true }]) {
    const f = fixture(options), r = await f.direct()
    assert(r.error); assert.equal(r.url, undefined); assert.equal(r.canPublish, false)
    assert.doesNotMatch(JSON.stringify(r), /PRIVATE|https|token|secret/i)
  }
})

test('each deliberate setup request has a fresh nonce; no operational retry receipt stores the raw nonce', async () => {
  const f = fixture(), first = await f.mcp(), second = await f.mcp()
  const a = JSON.parse(first.result.content[0].text), b = JSON.parse(second.result.content[0].text)
  assert.notEqual(new URL(a.url).searchParams.get('state'), new URL(b.url).searchParams.get('state'))
  assert.equal(f.writes.length, 2)
  assert.equal(f.calls.some(c => c.path.includes('rpc') || c.path.includes('idempotency')), false)
})

test('the same shared constructor preserves reporting scopes without the publishing gate or new role rule', async () => {
  const f = fixture({ role: 'manager', active: false }); delete f.env.SOCIAL_FACEBOOK_PHOTO_CONSENT_ENABLED
  const r = await f.reporting(), url = new URL(r.url)
  assert.equal(r.ok, true); assert.deepEqual(url.searchParams.get('scope').split(','), reportingScopes)
  assert.equal(url.searchParams.get('auth_type'), null); assert.equal(r.publishing_ready, undefined)
  assert.equal(f.calls.filter(c => c.path.endsWith('/profiles')).length, 0)
})
