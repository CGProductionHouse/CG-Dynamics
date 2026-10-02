import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let server, project
before(async () => {
  server = await createServer({ logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({ tiktokIntegrationSummary: project } = await server.ssrLoadModule('/src/lib/tiktokIntegrationSummary.ts'))
})
after(async () => { await server?.close() })
const queue = () => ({ ok: true, items: [], summary: { activeClients: 57, eligible: 47, excluded: 10, unresolved: 0, connected: 10, reconnectRequired: 0, notConnected: 37 } })

test('fleet summary uses canonical queue counts, not a client-less status call', () => {
  const result = project(queue(), false, true)
  assert.equal(result.status, 'Partially connected')
  assert.match(result.description, /10 of 47 eligible clients connected/)
  assert.match(result.description, /37 not connected/)
  assert.match(result.description, /10 excluded · 0 held/)
  assert.match(result.description, /do not prove reporting freshness/)
  assert.doesNotMatch(result.description, /publish content/)
  const source = readFileSync('src/pages/admin/IntegrationsPage.tsx', 'utf8')
  assert.match(source, /getTiktokConnectionQueue\(\)/)
  assert.doesNotMatch(source, /getTiktokConnectionStatus\(\)/)
})

test('failed, missing, malformed or inconsistent evidence remains unavailable, never fake zero', () => {
  for (const input of [null, { ...queue(), ok: false }, { ok: true }, { ...queue(), summary: { ...queue().summary, connected: null } }, { ...queue(), summary: { ...queue().summary, eligible: 48 } }]) {
    const result = project(input, false, true)
    assert.equal(result.status, 'Unavailable')
    assert.doesNotMatch(result.description, /0 of|0 connected|Not connected/)
  }
})

test('observed zero, complete connection and reconnect states remain distinct', () => {
  const input = queue(); input.summary.connected = 0; input.summary.notConnected = 47
  assert.equal(project(input, false, true).status, 'Not connected')
  input.summary.reconnectRequired = 2; input.summary.notConnected = 45
  assert.equal(project(input, false, true).status, 'Reconnect required')
  input.summary.connected = 47; input.summary.reconnectRequired = 0; input.summary.notConnected = 0
  assert.equal(project(input, false, true).status, 'Connected')
})

test('loading and non-manager states never assert connection counts', () => {
  assert.equal(project(null, true, true).status, 'Checking…')
  assert.equal(project(queue(), false, false).status, 'Manager access')
})
