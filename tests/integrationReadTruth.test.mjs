import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, project, label
before(async () => {
  server = await createServer({ root: process.cwd(), configFile: false, server: { hmr: false } })
  ;({ observedConnectionState: project, integrationConnectionLabel: label } = await server.ssrLoadModule('/src/lib/integrationReadTruth.ts'))
})
after(async () => { await server?.close() })

test('verified boolean connection and disconnection remain distinct', () => {
  assert.equal(project(true, true), 'connected')
  assert.equal(project(false, true), 'disconnected')
})
test('failed reads cannot assert either connection or disconnection', () => {
  assert.equal(project(true, false), 'unavailable')
  assert.equal(project(false, false), 'unavailable')
  assert.equal(project(null, false), 'unavailable')
})
test('missing and malformed values fail closed, never through Boolean coercion', () => {
  for (const value of [undefined, null, 0, 1, '', 'false', 'true', [], {}]) {
    assert.equal(project(value, true), 'unavailable')
  }
})
test('presentation keeps checking, unavailable and observed not-connected wording distinct', () => {
  assert.equal(label('loading'), 'Checking...')
  assert.equal(label('unavailable'), 'Unavailable')
  assert.equal(label('connected'), 'Connected')
  assert.equal(label('disconnected'), 'Not connected')
})
test('repeated read projection is deterministic and preserves evidence input', () => {
  const input = { connected: true, readAvailable: false }
  const original = structuredClone(input)
  assert.equal(project(input.connected, input.readAvailable), project(input.connected, input.readAvailable))
  assert.deepEqual(input, original)
})
