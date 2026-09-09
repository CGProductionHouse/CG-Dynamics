import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, oauth
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  })
  oauth = await server.ssrLoadModule('/src/lib/oauthConsent.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const APP = read('../src/App.tsx')
const PAGE = read('../src/pages/OAuthConsentPage.tsx')
const LOGIN = read('../src/pages/Login.tsx')

// ── Pure helper behaviour ─────────────────────────────────────────────────────

test('readAuthorizationId returns the exact id or fails closed on missing/blank', () => {
  assert.equal(oauth.readAuthorizationId('?authorization_id=abc123'), 'abc123')
  assert.equal(oauth.readAuthorizationId('?authorization_id=%20%20'), null)
  assert.equal(oauth.readAuthorizationId('?foo=bar'), null)
  assert.equal(oauth.readAuthorizationId(''), null)
})

test('consentReturnPath preserves the exact authorization request as a same-origin path', () => {
  assert.equal(oauth.consentReturnPath('abc 123'), '/oauth/consent?authorization_id=abc%20123')
})

test('isSafeOAuthReturnPath accepts only internal /oauth/consent, never an external URL', () => {
  assert.equal(oauth.isSafeOAuthReturnPath('/oauth/consent?authorization_id=x'), true)
  assert.equal(oauth.isSafeOAuthReturnPath('/oauth/consent'), true)
  assert.equal(oauth.isSafeOAuthReturnPath('https://evil.example.com/oauth/consent'), false)
  assert.equal(oauth.isSafeOAuthReturnPath('//evil.example.com'), false)
  assert.equal(oauth.isSafeOAuthReturnPath('/admin/cg-hub'), false)
  assert.equal(oauth.isSafeOAuthReturnPath(null), false)
})

test('needsConsent narrows details vs redirect responses', () => {
  assert.equal(oauth.needsConsent({ authorization_id: 'x', client: { name: 'ChatGPT' }, scope: 'openid' }), true)
  assert.equal(oauth.needsConsent({ redirect_url: 'https://client/cb?code=1' }), false)
  assert.equal(oauth.needsConsent(null), false)
})

test('redirectUrlFrom returns a ready redirect only when present', () => {
  assert.equal(oauth.redirectUrlFrom({ redirect_url: 'https://c/cb?code=1' }), 'https://c/cb?code=1')
  assert.equal(oauth.redirectUrlFrom({ authorization_id: 'x', scope: 'openid' }), null)
  assert.equal(oauth.redirectUrlFrom(null), null)
})

test('parseScopes splits, trims and de-duplicates the scope string', () => {
  assert.deepEqual(oauth.parseScopes('openid  profile openid email'), ['openid', 'profile', 'email'])
  assert.deepEqual(oauth.parseScopes(''), [])
  assert.deepEqual(oauth.parseScopes(null), [])
})

// ── Route wiring ──────────────────────────────────────────────────────────────

test('/oauth/consent is a public route outside staff/client guards but inside AuthProvider', () => {
  assert.match(APP, /<Route path="\/oauth\/consent" element=\{<OAuthConsentPage \/>\} \/>/)
  // Route is declared before the RequireStaff guard block (i.e. not guarded).
  const consentIdx = APP.indexOf('path="/oauth/consent"')
  const guardIdx = APP.indexOf('<Route element={<RequireStaff />}>')
  assert.ok(consentIdx > 0 && guardIdx > 0 && consentIdx < guardIdx, 'consent route must be outside the staff guard')
  // AuthProvider wraps the Routes.
  assert.ok(APP.indexOf('<AuthProvider>') < consentIdx, 'consent route must be inside AuthProvider')
})

// ── Page contract: exact Supabase OAuth calls + safe redirect + fail-closed ────

test('page calls the exact Supabase OAuth server methods', () => {
  assert.match(PAGE, /supabase\.auth\.oauth\.getAuthorizationDetails\(authorizationId\)/)
  assert.match(PAGE, /supabase\.auth\.oauth\.approveAuthorization\(authorizationId, \{ skipBrowserRedirect: true \}\)/)
  assert.match(PAGE, /supabase\.auth\.oauth\.denyAuthorization\(authorizationId, \{ skipBrowserRedirect: true \}\)/)
})

test('page follows the Supabase-returned redirect URL via a full-page navigation', () => {
  assert.match(PAGE, /window\.location\.assign\(url\)/)
  // Approve/Deny both route through the returned redirect_url, never a hand-built URL.
  assert.match(PAGE, /redirectUrlFrom\(data\)/)
})

test('page fails closed on missing authorization_id and preserves it across login', () => {
  assert.match(PAGE, /!authorizationId/)
  assert.match(PAGE, /missing or invalid/i)
  assert.match(PAGE, /navigate\('\/login', \{ replace: true, state: \{ from: consentReturnPath\(authorizationId\) \} \}\)/)
})

test('page shows only client name + scopes + approve/deny, never tokens/secrets', () => {
  assert.match(PAGE, /is requesting access to your CG Dynamics account/)
  assert.match(PAGE, /: 'Approve'/)
  assert.match(PAGE, /: 'Deny'/)
  assert.match(PAGE, /onClick=\{\(\) => decide\('approve'\)\}/)
  assert.match(PAGE, /onClick=\{\(\) => decide\('deny'\)\}/)
  assert.doesNotMatch(PAGE, /access_token|refresh_token|client_secret|service_role|VITE_SUPABASE_PUBLISHABLE_KEY/)
})

test('page does not build a second auth/session system', () => {
  assert.doesNotMatch(PAGE, /signInWithPassword|createClient\(/)
  assert.match(PAGE, /useAuth\(\)/)
})

// ── Login preserves the consent request ───────────────────────────────────────

test('login routes a post-auth user back to a safe /oauth/consent return', () => {
  assert.match(LOGIN, /isSafeOAuthReturnPath\(requestedPath\)/)
  assert.match(LOGIN, /oauthReturnPath/)
})
