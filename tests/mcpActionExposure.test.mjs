import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, catalog, oauth
before(async () => {
  server = await createServer({
    root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  catalog = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/toolCatalog.ts')
  oauth = await server.ssrLoadModule('/supabase/functions/cg-dynamics-mcp/oauthDiscovery.ts')
})
after(async () => { await server?.close() })

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const INDEX = read('../supabase/functions/cg-dynamics-mcp/index.ts')

const PRM = 'https://ehtjfntukiwbgptqgbzy.supabase.co/functions/v1/cg-dynamics-mcp/.well-known/oauth-protected-resource'

/** Mirror of the descriptor handleToolsList returns, so the shape is asserted, not assumed. */
const listedTools = () => catalog.CG_DYNAMICS_MCP_TOOLS.map(tool => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  inputSchema: tool.inputSchema,
  annotations: tool.annotations,
  securitySchemes: catalog.CG_DYNAMICS_MCP_SECURITY_SCHEMES,
}))

// ── Action exposure ─────────────────────────────────────────────────────────

test('tools/list exposes exactly 34 tools including resolve_project_context', () => {
  const tools = listedTools()
  assert.equal(tools.length, 34)
  const names = tools.map(t => t.name)
  assert.ok(names.includes('resolve_project_context'), 'context bootstrap must be exposed')
  assert.equal(names[0], 'resolve_project_context', 'bootstrap is listed first')
  assert.equal(new Set(names).size, 34, 'no duplicate tool names')
})

test('every listed tool advertises the OAuth securityScheme with the narrowed #318 scopes', () => {
  for (const tool of listedTools()) {
    assert.deepEqual(
      JSON.parse(JSON.stringify(tool.securitySchemes)),
      [{ type: 'oauth2', scopes: ['email', 'profile'] }],
      `${tool.name} must declare per-tool oauth2`,
    )
  }
})

test('advertised scopes never include openid or offline_access', () => {
  const scopes = catalog.CG_DYNAMICS_MCP_SECURITY_SCHEMES[0].scopes
  assert.ok(!scopes.includes('openid'))
  assert.ok(!scopes.includes('offline_access'))
  // Consistent with the live protected-resource metadata (#318).
  const meta = oauth.buildProtectedResourceMetadata(oauth.deriveMcpOAuthUrls('https://ehtjfntukiwbgptqgbzy.supabase.co'))
  assert.deepEqual([...scopes], meta.scopes_supported)
})

test('handleToolsList attaches securitySchemes to each returned descriptor', () => {
  assert.match(INDEX, /securitySchemes: CG_DYNAMICS_MCP_SECURITY_SCHEMES/)
  assert.match(INDEX, /CG_DYNAMICS_MCP_TOOLS, CG_DYNAMICS_MCP_SECURITY_SCHEMES/)
})

// ── Context bootstrap stays non-circular ────────────────────────────────────

test('resolve_project_context has no circular context requirement', () => {
  const bootstrap = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'resolve_project_context')
  assert.ok(bootstrap)
  const required = bootstrap.inputSchema.required ?? []
  assert.ok(!required.includes('context'), 'bootstrap must not require the context it produces')
  assert.ok(!bootstrap.inputSchema.properties.context, 'bootstrap exposes no context property')
  assert.deepEqual(required, ['context_kind'])
  // …while every operational tool still requires it (#319 preserved).
  for (const tool of catalog.CG_DYNAMICS_MCP_TOOLS.filter(t => t.name !== 'resolve_project_context')) {
    assert.ok(tool.inputSchema.required.includes('context'), `${tool.name} still requires context`)
  }
})

// ── Runtime auth challenge in the OpenAI-compatible MCP shape ───────────────

test('buildMcpAuthChallengeMeta emits the documented _meta key and challenge string', () => {
  const meta = oauth.buildMcpAuthChallengeMeta(PRM, 'invalid_token', 'The bearer token is invalid or expired.')
  assert.deepEqual(Object.keys(meta), ['mcp/www_authenticate'])
  assert.ok(Array.isArray(meta['mcp/www_authenticate']))
  assert.equal(
    meta['mcp/www_authenticate'][0],
    `Bearer resource_metadata="${PRM}", error="invalid_token", error_description="The bearer token is invalid or expired."`,
  )
})

test('insufficient_scope is supported alongside invalid_token', () => {
  const meta = oauth.buildMcpAuthChallengeMeta(PRM, 'insufficient_scope', 'Not an active staff member.')
  assert.match(meta['mcp/www_authenticate'][0], /error="insufficient_scope"/)
  assert.match(meta['mcp/www_authenticate'][0], /resource_metadata="https:\/\//)
})

test('a rejected tools/call returns an MCP error result carrying the auth challenge', () => {
  assert.match(INDEX, /function authChallengeToolResult\(/)
  assert.match(INDEX, /_meta: buildMcpAuthChallengeMeta\(urls\.protectedResourceMetadataUrl, challenge\.error, challenge\.description\)/)
  assert.match(INDEX, /isError: true/)
  assert.match(INDEX, /body\.method === 'tools\/call'/)
  assert.match(INDEX, /return authChallengeResponse\(/)
  assert.match(INDEX, /result: authChallengeToolResult\(challenge\)/)
  assert.match(INDEX, /text: `Authentication required\. \$\{challenge\.description\}`/)
})

test('tool auth challenges preserve the rejected transport status and headers', () => {
  const block = INDEX.slice(INDEX.indexOf('function authChallengeResponse('), INDEX.indexOf('function jsonRpcResponse('))
  assert.match(block, /status: transportResponse\.status/)
  assert.match(block, /headers: transportResponse\.headers/)
  assert.doesNotMatch(block, /status:\s*200/)
})

test('auth rejections carry a challenge descriptor for both error kinds', () => {
  assert.match(INDEX, /challenge: \{ error: 'invalid_token'/)
  assert.match(INDEX, /challenge: \{ error: 'insufficient_scope'/)
})

test('the auth challenge result leaks no token or secret', () => {
  const block = INDEX.slice(INDEX.indexOf('function authChallengeToolResult('), INDEX.indexOf('function authChallengeToolResult(') + 900)
  assert.doesNotMatch(block, /SERVICE_ROLE|access_token|Authorization|match\[1\]/)
})

// ── Preserved transport + safety contracts ──────────────────────────────────

test('RFC 9728 PRM endpoint and HTTP 401 challenge remain intact', () => {
  assert.match(INDEX, /isProtectedResourceMetadataRequest\(url\.pathname\)/)
  assert.match(INDEX, /buildProtectedResourceMetadata\(urls\)/)
  assert.match(INDEX, /status: 401, headers: challengeHeaders\(opts\)/)
  assert.match(INDEX, /'WWW-Authenticate': buildWwwAuthenticateChallenge\(urls\.protectedResourceMetadataUrl/)
})

test('authentication still strictly precedes any use of the request body', () => {
  const entry = INDEX.slice(INDEX.indexOf('Deno.serve(async (req) =>'))
  const authIdx = entry.indexOf('const auth = await authenticateStaff(req)')
  const parseIdx = entry.indexOf('body = await req.json()')
  assert.ok(authIdx > 0 && parseIdx > authIdx, 'authenticateStaff must run before the body is read')
  assert.equal(entry.match(/await req\.json\(\)/g)?.length, 1, 'JSON-RPC body must be parsed exactly once')
  assert.equal(entry.match(/let body\b/g)?.length, 1, 'there must be exactly one JSON-RPC body declaration')
})

test('missing and invalid bearer tokens both fail closed with HTTP 401', () => {
  const authBlock = INDEX.slice(INDEX.indexOf('async function authenticateStaff('), INDEX.indexOf('async function resolveOperatingContext('))
  assert.match(authBlock, /if \(!match\?\.\[1\]\) \{[\s\S]*?unauthorizedResponse\('Authentication required\.'\)/)
  assert.match(authBlock, /if \(authError \|\| !user\) \{[\s\S]*?unauthorizedResponse\('Invalid or expired token\.'/)
  assert.match(INDEX, /status: 401, headers: challengeHeaders\(opts\)/)
})

test('bearer validation, context validation and write policy are unchanged', () => {
  assert.match(INDEX, /supabase\.auth\.getUser\(match\[1\]\)/)
  assert.match(INDEX, /STAFF_ROLES\.has\(profile\.role\)/)
  assert.match(INDEX, /const parsed = parseProjectContext\(rawContext\)/)
  assert.match(INDEX, /assertToolAllowedInContext\(toolName, parsed\.context\.contextKind\)/)
  assert.match(INDEX, /resolveClientScopeForInput\(staff\.contextKind, staff\.effectiveClientId/)
  assert.match(INDEX, /Write tools require an idempotency_key/)
})

test('draft-only email policy is untouched', () => {
  const compose = catalog.CG_DYNAMICS_MCP_TOOLS.find(t => t.name === 'compose_mail_draft')
  assert.match(compose.description, /DRAFT-ONLY/i)
  assert.match(compose.description, /never send/i)
  const names = catalog.CG_DYNAMICS_MCP_TOOLS.map(t => t.name).join(' ')
  assert.doesNotMatch(names, /send_email|send_draft|send_mail/i)
})
