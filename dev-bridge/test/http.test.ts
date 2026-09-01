import assert from 'node:assert/strict'
import test from 'node:test'
import { handleMcp } from '../src/http.js'
import { protectedResourceMetadata } from '../src/auth.js'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { createOwnerDevServer } from '../src/tools.js'

process.env.OWNER_BRIDGE_PUBLIC_URL = 'https://bridge.example.com'
process.env.OWNER_BRIDGE_OAUTH_ISSUER = 'https://issuer.example.com/'
process.env.OWNER_BRIDGE_OAUTH_AUDIENCE = 'https://bridge.example.com/mcp'
process.env.OWNER_BRIDGE_OAUTH_JWKS_URI = 'https://issuer.example.com/.well-known/jwks.json'
process.env.OWNER_BRIDGE_ALLOWED_SUBJECTS = 'provider|owner'

async function readMcpResponse(response: Response): Promise<{ result?: Record<string, unknown> }> {
  const text = await response.text()
  const payload = response.headers.get('content-type')?.includes('text/event-stream')
    ? text.split(/\r?\n/).find(line => line.startsWith('data: '))?.slice(6)
    : text
  if (!payload) throw new Error('MCP response did not contain a result payload.')
  return JSON.parse(payload) as { result?: Record<string, unknown> }
}

test('protected resource metadata is OAuth 2.1/MCP discoverable', () => {
  assert.deepEqual(protectedResourceMetadata(), {
    resource: 'https://bridge.example.com/mcp',
    authorization_servers: ['https://issuer.example.com/'],
    scopes_supported: ['dev:read', 'dev:write'],
    resource_documentation: 'https://github.com/CGProductionHouse/CG-Dynamics/blob/main/docs/owner-dev-bridge.md',
  })
})

test('anonymous MCP requests are denied with a discovery challenge', async () => {
  const oauthNames = ['OWNER_BRIDGE_OAUTH_ISSUER', 'OWNER_BRIDGE_OAUTH_AUDIENCE', 'OWNER_BRIDGE_OAUTH_JWKS_URI', 'OWNER_BRIDGE_ALLOWED_SUBJECTS']
  const saved = new Map(oauthNames.map(name => [name, process.env[name]]))
  oauthNames.forEach(name => delete process.env[name])
  try {
    const response = await handleMcp(new Request('https://bridge.example.com/mcp', {
      method: 'POST',
      headers: { host: 'bridge.example.com', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    }))
    assert.equal(response.status, 401)
    assert.match(response.headers.get('www-authenticate') ?? '', /oauth-protected-resource/)
  } finally {
    saved.forEach((value, name) => { if (value === undefined) delete process.env[name]; else process.env[name] = value })
  }
})

test('wrong origins and oversized requests fail before tool execution', async () => {
  const wrongOrigin = await handleMcp(new Request('https://bridge.example.com/mcp', {
    method: 'POST', headers: { host: 'bridge.example.com', origin: 'https://evil.example' }, body: '{}',
  }))
  assert.equal(wrongOrigin.status, 403)

  const tooLarge = await handleMcp(new Request('https://bridge.example.com/mcp', {
    method: 'POST', headers: { host: 'bridge.example.com', 'content-length': '1000001' }, body: '{}',
  }))
  assert.equal(tooLarge.status, 413)

  const chunkedBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_000_001))
      controller.close()
    },
  })
  const chunked = await handleMcp(new Request('https://bridge.example.com/mcp', {
    method: 'POST', headers: { host: 'bridge.example.com' }, body: chunkedBody, duplex: 'half',
  } as RequestInit))
  assert.equal(chunked.status, 413)
})

test('stateless streamable HTTP initializes and advertises narrow tools', async () => {
  const handler = createMcpHandler(() => createOwnerDevServer({
    subject: 'provider|owner', scopes: new Set(['dev:read', 'dev:write']), claims: {},
  }), { responseMode: 'json' })
  const initialize = await handler.fetch(new Request('https://bridge.example.com/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'test', version: '1' } } }),
  }))
  assert.equal(initialize.status, 200)
  const initializeBody = await readMcpResponse(initialize) as { result?: { serverInfo?: { name?: string } } }
  assert.equal(initializeBody.result?.serverInfo?.name, 'cg-dynamics-owner-dev-bridge')

  const listed = await handler.fetch(new Request('https://bridge.example.com/mcp', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
  }))
  const listedBody = await readMcpResponse(listed) as { result?: { tools?: Array<{ name: string }> } }
  const names = listedBody.result?.tools?.map(tool => tool.name) ?? []
  assert.ok(names.includes('dev_repo_status'))
  assert.ok(names.includes('dev_apply_changes'))
  assert.ok(!names.some(name => /shell|exec|sql|merge|production/i.test(name)))
  await handler.close()
})
