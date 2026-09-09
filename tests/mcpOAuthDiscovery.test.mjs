import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, oauth
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  oauth = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/oauthDiscovery.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')

const SUPA = 'https://ehtjfntukiwbgptqgbzy.supabase.co'

// ── Pure discovery/challenge helpers ──────────────────────────────────────────

test('deriveMcpOAuthUrls builds the canonical resource, auth server and PRM URL', () => {
  const urls = oauth.deriveMcpOAuthUrls(SUPA)
  assert.equal(urls.resource, `${SUPA}/functions/v1/cg-dynamics-mcp/mcp`)
  assert.equal(urls.authorizationServer, `${SUPA}/auth/v1`)
  assert.equal(urls.protectedResourceMetadataUrl, `${SUPA}/functions/v1/cg-dynamics-mcp/.well-known/oauth-protected-resource`)
})

test('deriveMcpOAuthUrls tolerates a trailing slash and fails closed on bad input', () => {
  assert.equal(oauth.deriveMcpOAuthUrls(`${SUPA}/`).resource, `${SUPA}/functions/v1/cg-dynamics-mcp/mcp`)
  assert.equal(oauth.deriveMcpOAuthUrls(''), null)
  assert.equal(oauth.deriveMcpOAuthUrls(null), null)
  assert.equal(oauth.deriveMcpOAuthUrls('not-a-url'), null)
  assert.equal(oauth.deriveMcpOAuthUrls('http://insecure.example'), null, 'https only')
})

test('protected resource metadata identifies the resource and Supabase authorization server', () => {
  const meta = oauth.buildProtectedResourceMetadata(oauth.deriveMcpOAuthUrls(SUPA))
  assert.equal(meta.resource, `${SUPA}/functions/v1/cg-dynamics-mcp/mcp`)
  assert.deepEqual(meta.authorization_servers, [`${SUPA}/auth/v1`])
  assert.deepEqual(meta.bearer_methods_supported, ['header'])
  assert.ok(Array.isArray(meta.scopes_supported) && meta.scopes_supported.includes('openid'))
})

test('WWW-Authenticate challenge advertises resource_metadata and optional error', () => {
  const prm = `${SUPA}/functions/v1/cg-dynamics-mcp/.well-known/oauth-protected-resource`
  assert.equal(oauth.buildWwwAuthenticateChallenge(prm), `Bearer resource_metadata="${prm}"`)
  assert.equal(
    oauth.buildWwwAuthenticateChallenge(prm, { error: 'invalid_token', errorDescription: 'bad' }),
    `Bearer resource_metadata="${prm}", error="invalid_token", error_description="bad"`,
  )
})

test('isProtectedResourceMetadataRequest matches the well-known path only', () => {
  assert.equal(oauth.isProtectedResourceMetadataRequest('/functions/v1/cg-dynamics-mcp/.well-known/oauth-protected-resource'), true)
  assert.equal(oauth.isProtectedResourceMetadataRequest('/cg-dynamics-mcp/.well-known/oauth-protected-resource'), true)
  assert.equal(oauth.isProtectedResourceMetadataRequest('/functions/v1/cg-dynamics-mcp/mcp'), false)
})

test('discovery helpers never embed a client id, secret, or callback URL', () => {
  const src = read('../supabase/functions/cg-dynamics-mcp/oauthDiscovery.ts')
  // Guard against an embedded credential/callback VALUE (an assignment), not prose.
  assert.doesNotMatch(src, /client_secret\s*[:=]|client_id\s*[:=]\s*['"]|redirect_uri\s*[:=]\s*['"]|https?:\/\/chat(gpt|\.openai)/i)
})

// ── MCP entry wiring ──────────────────────────────────────────────────────────

test('MCP function serves protected-resource metadata publicly on GET before the auth gate', () => {
  assert.match(INDEX, /isProtectedResourceMetadataRequest\(url\.pathname\)/)
  assert.match(INDEX, /buildProtectedResourceMetadata\(urls\)/)
  const discoveryIdx = INDEX.indexOf('isProtectedResourceMetadataRequest(url.pathname)')
  const authGateIdx = INDEX.indexOf('const auth = await authenticateStaff(req)')
  assert.ok(discoveryIdx > 0 && authGateIdx > 0 && discoveryIdx < authGateIdx, 'discovery must be handled before authentication')
})

test('unauthenticated MCP requests return a 401 OAuth challenge', () => {
  assert.match(INDEX, /function unauthorizedResponse\(/)
  assert.match(INDEX, /status: 401, headers: challengeHeaders\(opts\)/)
  assert.match(INDEX, /'WWW-Authenticate': buildWwwAuthenticateChallenge\(urls\.protectedResourceMetadataUrl/)
  // Both missing-token and invalid-token paths use the challenge response.
  assert.match(INDEX, /return \{ ok: false, response: unauthorizedResponse\('Authentication required\.'\) \}/)
  assert.match(INDEX, /unauthorizedResponse\('Invalid or expired token\.', \{ error: 'invalid_token'/)
})

test('CORS allows GET discovery and exposes the challenge header', () => {
  assert.match(INDEX, /'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'/)
  assert.match(INDEX, /'Access-Control-Expose-Headers': 'WWW-Authenticate'/)
})

test('authenticated MCP tool calls remain gated (tool behavior unchanged)', () => {
  // The POST auth gate still runs before JSON-RPC dispatch, preserving staff auth/RLS.
  assert.match(INDEX, /const auth = await authenticateStaff\(req\)\n\s*if \(!auth\.ok\) return auth\.response/)
  assert.match(INDEX, /case 'tools\/call':/)
  // Discovery is GET-only; tool methods stay POST.
  assert.match(INDEX, /if \(req\.method !== 'POST'\) \{/)
})

test('MCP entry does not hardcode OAuth client credentials or a ChatGPT callback', () => {
  assert.doesNotMatch(INDEX, /client_secret|redirect_uri\s*[:=]|plugin_asdk_app/i)
})
