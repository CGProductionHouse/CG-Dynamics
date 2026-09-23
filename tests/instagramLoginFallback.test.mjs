import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  INSTAGRAM_LOGIN_SCOPES,
  INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER,
  buildInstagramAuthorizationUrl,
  isInstagramStandaloneActivationEnabled,
  missingInstagramLoginScopes,
  parseInstagramProfessionalIdentity,
  parseInstagramShortLivedToken,
  resolveInstagramGraphConfig,
} from '../supabase/functions/_shared/instagramLogin.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260922140000_instagram_login_fallback_foundation.sql')
const start = read('../supabase/functions/instagram-oauth-start/index.ts')
const callback = read('../supabase/functions/instagram-oauth-callback/index.ts')

test('authorization uses only official Instagram Login reporting scopes and exact state', () => {
  const url = new URL(buildInstagramAuthorizationUrl({
    appId: '123456',
    redirectUri: 'https://example.test/callback',
    state: 'csrf-state',
  }))
  assert.equal(url.origin, 'https://www.instagram.com')
  assert.equal(url.pathname, '/oauth/authorize')
  assert.deepEqual(url.searchParams.get('scope')?.split(','), [...INSTAGRAM_LOGIN_SCOPES])
  assert.equal(url.searchParams.get('state'), 'csrf-state')
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.test/callback')
})

test('short-lived token response requires one numeric app-scoped identity', () => {
  assert.deepEqual(parseInstagramShortLivedToken({ data: [{
    access_token: 'secret-token', user_id: '102030',
    permissions: 'instagram_business_basic,instagram_business_manage_insights',
  }] }), {
    accessToken: 'secret-token',
    appScopedUserId: '102030',
    permissions: ['instagram_business_basic', 'instagram_business_manage_insights'],
  })
  assert.throws(() => parseInstagramShortLivedToken({ data: [] }), /one account/)
})

test('identity parses the provider single-object Business fixture and preserves both IDs', () => {
  assert.deepEqual(parseInstagramProfessionalIdentity({
    id: '102030', user_id: '998877', username: 'official.client', account_type: 'BUSINESS',
  }), {
    appScopedUserId: '102030',
    instagramAccountId: '998877',
    username: 'official.client',
    accountType: 'business',
  })
})

test('identity parses the provider single-object Creator fixture', () => {
  assert.deepEqual(parseInstagramProfessionalIdentity({
    id: '203040', user_id: '887766', username: 'creator.client', account_type: 'MEDIA_CREATOR',
  }), {
    appScopedUserId: '203040',
    instagramAccountId: '887766',
    username: 'creator.client',
    accountType: 'creator',
  })
})

test('identity rejects malformed, personal, legacy-case and collection response shapes', () => {
  assert.throws(() => parseInstagramProfessionalIdentity(null), /one profile object/)
  assert.throws(() => parseInstagramProfessionalIdentity([]), /one profile object/)
  assert.throws(() => parseInstagramProfessionalIdentity({ data: [{
    id: '1', user_id: '2', username: 'one', account_type: 'BUSINESS',
  }] }), /one profile object/)
  assert.throws(() => parseInstagramProfessionalIdentity({
    id: '1', user_id: '2', username: 'mixed', account_type: 'BUSINESS', data: [],
  }), /one profile object/)
  assert.throws(() => parseInstagramProfessionalIdentity({
    id: '1', user_id: '2', username: 'personal.user', account_type: 'PERSONAL',
  }), /Business or Creator/)
  assert.throws(() => parseInstagramProfessionalIdentity({
    id: '1', user_id: '2', username: 'legacy.case', account_type: 'Business',
  }), /Business or Creator/)
})

test('missing reporting permission remains an explicit blocker', () => {
  assert.deepEqual(missingInstagramLoginScopes(['instagram_business_basic']), ['instagram_business_manage_insights'])
  assert.deepEqual(missingInstagramLoginScopes([...INSTAGRAM_LOGIN_SCOPES]), [])
})

test('graph version fails closed instead of silently selecting a provider version', () => {
  assert.deepEqual(resolveInstagramGraphConfig('v26.0'), {
    version: 'v26.0', baseUrl: 'https://graph.instagram.com/v26.0',
  })
  assert.throws(() => resolveInstagramGraphConfig(undefined), /must be an explicit version/)
  assert.throws(() => resolveInstagramGraphConfig('latest'), /must be an explicit version/)
})

test('OAuth intent is exact-client and refuses an existing canonical Instagram mapping', () => {
  assert.match(start, /meta_instagram_oauth_states/)
  assert.match(start, /client_id: clientId/)
  assert.match(start, /meta_client_assets/)
  assert.match(start, /already has a canonical Instagram mapping/)
  assert.match(start, /\['admin', 'manager'\]/)
})

test('standalone Instagram activation is a strict fail-closed server configuration gate', () => {
  assert.equal(isInstagramStandaloneActivationEnabled(undefined), false)
  assert.equal(isInstagramStandaloneActivationEnabled(''), false)
  assert.equal(isInstagramStandaloneActivationEnabled('TRUE'), false)
  assert.equal(isInstagramStandaloneActivationEnabled('1'), false)
  assert.equal(isInstagramStandaloneActivationEnabled('true '), false)
  assert.equal(isInstagramStandaloneActivationEnabled('true'), true)
  assert.match(INSTAGRAM_STANDALONE_ACTIVATION_BLOCKER, /not enabled/)
  assert.match(start, /Deno\.env\.get\('INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED'\)/)
  assert.match(callback, /Deno\.env\.get\('INSTAGRAM_STANDALONE_LIVE_ACTIVATION_ENABLED'\)/)
  assert.match(migration, /PRODUCTION DEPLOYMENT\/CONSENT IS BLOCKED/)
  assert.match(migration, /Production deployment and consent remain blocked until reviewed token-at-rest encryption/)
})

test('callback verifies token identity and stops at pending review', () => {
  assert.match(callback, /identity\.appScopedUserId !== shortToken\.appScopedUserId/)
  assert.match(callback, /complete_instagram_login_connection/)
  assert.match(callback, /review_required/)
  assert.doesNotMatch(callback, /from\('meta_client_assets'\)/)
})

test('server-only persistence is atomic, exact-client and cannot become a second reporting store', () => {
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(migration, /set search_path = ''/)
  assert.doesNotMatch(migration, /set search_path = public/)
  assert.match(migration, /Active admin or manager connecting user required/)
  assert.match(migration, /Instagram account is already assigned to another client/)
  assert.match(migration, /Client already has a canonical Instagram mapping/)
  assert.match(migration, /instagram_business_basic', 'instagram_business_manage_insights/)
  assert.match(migration, /status = 'pending_review'/)
  assert.match(migration, /confirmed_asset_id uuid unique references public\.meta_client_assets/)
  assert.match(migration, /revoke all on public\.meta_instagram_connection_tokens from anon, authenticated/)
  assert.match(migration, /grant select on public\.meta_instagram_connections to authenticated/)
  assert.match(migration, /grant execute on function public\.complete_instagram_login_connection[\s\S]*to service_role/)
  assert.doesNotMatch(migration, /create table[^;]+(?:reports|posts|metric_facts|sync_checkpoints)/i)
})
