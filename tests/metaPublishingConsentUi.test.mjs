import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { FunctionsClient } from '@supabase/functions-js'
import { metaConsentFixture } from './fixtures/metaPublishingConsent.mjs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

let server, consent
before(async () => {
  server = await createServer({ configFile: false, esbuild: { jsx: 'automatic' }, server: { middlewareMode: true, hmr: false },
    define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://fixture.supabase.co'), 'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('fixture-only') },
    optimizeDeps: { noDiscovery: true }, logLevel: 'error' })
  consent = await server.ssrLoadModule('/src/lib/metaPublishingConsent.ts')
})
after(async () => server?.close())

const scopes = ['pages_show_list', 'pages_read_engagement', 'read_insights', 'instagram_basic', 'instagram_manage_insights', 'business_management', 'pages_manage_posts']
function response() {
  const params = new URLSearchParams({ client_id: '123456', redirect_uri: 'https://fixture.supabase.co/functions/v1/meta-oauth-callback',
    response_type: 'code', state: 'a'.repeat(43), scope: scopes.join(','), auth_type: 'rerequest' })
  return { ok: true, consent_purpose: 'facebook_photo_publishing', publishing_ready: false,
    url: `https://www.facebook.com/v27.0/dialog/oauth?${params}` }
}

test('permission setup never calls OAuth without an explicit confirmation', async () => {
  let calls = 0
  for (const confirmed of [false, undefined, 'true']) {
    const result = await consent.startFacebookPublishingConsent(confirmed, async () => { calls++; return { data: response(), error: null } })
    assert.equal(result.state, 'blocked')
  }
  assert.equal(calls, 0)
})

test('explicit permission setup calls only the existing opted-in endpoint and validates its purpose', async () => {
  const calls = []
  const result = await consent.startFacebookPublishingConsent(true, async (...args) => { calls.push(args); return { data: response(), error: null } })
  assert.deepEqual(calls, [['meta-oauth-start?purpose=facebook_photo_publishing&confirm_permission_request=true', { method: 'POST' }]])
  assert.equal(result.state, 'redirect'); assert.equal(result.url, response().url)
})

test('an older backend reporting response cannot be mistaken for publishing consent', async () => {
  for (const data of [{ ok: true, url: response().url }, { ...response(), publishing_ready: true }, { ...response(), consent_purpose: 'reporting' }]) {
    assert.equal((await consent.startFacebookPublishingConsent(true, async () => ({ data, error: null }))).state, 'blocked')
  }
})

test('publishing setup refuses unsafe URLs, ambiguous parameters or widened scopes', async () => {
  const valid = response()
  const mutate = change => { const url = new URL(valid.url); change(url); return { ...valid, url: url.href } }
  for (const data of [
    { ...valid, url: 'javascript:alert(1)' }, { ...valid, url: valid.url.replace('www.facebook.com', 'www.facebook.com.evil.invalid') },
    { ...valid, url: valid.url.replace('https:', 'http:') }, mutate(u => { u.username = 'private' }),
    mutate(u => { u.hash = 'private' }), mutate(u => { u.pathname = '/dialog/other' }),
    mutate(u => u.searchParams.append('scope', scopes.join(','))), mutate(u => u.searchParams.set('scope', [...scopes, 'ads_management'].join(','))),
    mutate(u => u.searchParams.set('scope', scopes.slice(0, -1).join(','))), mutate(u => u.searchParams.set('auth_type', 'reauthorize')),
    mutate(u => u.searchParams.set('response_type', 'token')), mutate(u => u.searchParams.set('state', 'short')),
    mutate(u => u.searchParams.append('access_token', 'PRIVATE_TOKEN')),
  ]) {
    const result = await consent.startFacebookPublishingConsent(true, async () => ({ data, error: null }))
    assert.equal(result.state, 'blocked'); assert.equal(result.url, undefined)
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_TOKEN|javascript|evil\.invalid/)
  }
})

test('disabled setup, expired access and transport failures are safe and never retried automatically', async () => {
  for (const code of ['META_PUBLISHING_CONSENT_DISABLED', 'ACTIVE_MANAGER_REQUIRED', 'PRIVATE_ERROR']) {
    let calls = 0
    const result = await consent.startFacebookPublishingConsent(true, async () => { calls++; return {
      data: null, error: { context: Response.json({ code, error: 'PRIVATE_SERVICE_TOKEN' }) },
    } })
    assert.equal(calls, 1); assert.equal(result.state, 'blocked'); assert.equal(result.url, undefined)
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ERROR|PRIVATE_SERVICE_TOKEN/)
    if (code === 'META_PUBLISHING_CONSENT_DISABLED') assert.match(result.message, /not enabled/i)
  }
  const result = await consent.startFacebookPublishingConsent(true, async () => { throw Error('PRIVATE_SERVICE_TOKEN') })
  assert.equal(result.state, 'blocked'); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SERVICE_TOKEN/)
})

test('normal reporting connection is unchanged and separate from publishing setup', () => {
  const page = readFileSync('src/pages/admin/MetaIntegrationPage.tsx', 'utf8')
  const handler = page.slice(page.indexOf('async function handleConnect()'), page.indexOf('async function loadAssets()'))
  assert.match(handler, /invoke\('meta-oauth-start',\s*\{\s*method: 'POST'/)
  assert.doesNotMatch(handler, /purpose|confirm_permission_request|pages_manage_posts/)
  assert.match(page, /<FacebookPublishingConsent/)
})

test('actual Supabase SDK and actual OAuth handler preserve the explicit query, role, state and release gates', async () => {
  for (const options of [{ enabled: false }, { enabled: true }, { enabled: true, active: false }, { enabled: true, changedRole: 'staff' }]) {
    const backend = metaConsentFixture(options), requests = []
    const client = new FunctionsClient('https://fixture.invalid/functions/v1', {
      headers: { Authorization: 'Bearer fixture-only' },
      customFetch: async (url, init) => { requests.push(new URL(url)); return backend.handle(new Request(url, init)) },
    })
    const result = await consent.startFacebookPublishingConsent(true, (name, args) => client.invoke(name, args))
    assert.equal(requests.length, 1)
    assert.equal(requests[0].pathname, '/functions/v1/meta-oauth-start')
    assert.equal(requests[0].search, '?purpose=facebook_photo_publishing&confirm_permission_request=true')
    const enabled = options.enabled && options.active !== false && !options.changedRole
    assert.equal(result.state, enabled ? 'redirect' : 'blocked')
    assert.equal(backend.writes.length, enabled ? 1 : 0)
    if (enabled) {
      const url = new URL(result.url)
      assert.equal(url.searchParams.get('scope').split(',').length, 7)
      assert.match(backend.writes[0].state_hash, /^[a-f0-9]{64}$/)
      assert.equal(backend.writes[0].state, undefined)
    }
    assert.equal(backend.envReads.includes('META_APP_SECRET'), false)
    assert.equal(backend.envReads.includes('META_TOKEN_ENCRYPTION_KEY_B64'), false)
  }
})

test('initial React screen makes no permission request and never treats a recorded scope as publishing ready', async () => {
  const { FacebookPublishingConsent } = await server.ssrLoadModule('/src/components/integrations/FacebookPublishingConsent.tsx')
  let calls = 0
  const invoke = async () => { calls++; throw Error('Initial render must not invoke OAuth') }
  for (const state of [
    { checking: true, disabled: true, grantedScopes: null, label: 'Checking recorded permission' },
    { checking: false, disabled: false, grantedScopes: null, label: 'Recorded permission unavailable' },
    { checking: false, disabled: false, grantedScopes: [], label: 'Publishing permission not recorded' },
    { checking: false, disabled: false, grantedScopes: ['pages_manage_posts'], label: 'Permission recorded · Page checks still required' },
  ]) {
    const html = renderToStaticMarkup(React.createElement(FacebookPublishingConsent, { ...state, invoke }))
    assert(html.includes(state.label)); assert.match(html, /Review publishing setup/)
    assert.doesNotMatch(html, /Continue to Facebook|publishing ready|https:\/\/www.facebook.com/)
    assert.equal(html.includes(' disabled=""'), state.disabled)
  }
  assert.equal(calls, 0)
})
