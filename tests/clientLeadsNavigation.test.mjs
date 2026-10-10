import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('Leads navigation uses exact tracking and retained-history evidence', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true }, define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:1'),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('local-public-fixture'),
  } })
  try {
    const { hasClientLeadsDestination } = await server.ssrLoadModule('/src/lib/clientLeadsNavigation.ts')
    const calls = []
    const metrics = async (id, from, to) => {
      calls.push(['metrics', id, from, to])
      return { state: 'ready', data: { state: 'not_connected' } }
    }
    const history = async (id, limit) => {
      calls.push(['history', id, limit])
      return { state: 'ready', data: [] }
    }
    assert.equal(await hasClientLeadsDestination('exact-client', metrics, history), false)
    assert.deepEqual(calls.map(row => row.slice(0, 2)), [['metrics', 'exact-client'], ['history', 'exact-client']])
    assert.equal(calls[1][2], 1)
    const pinned = []
    await hasClientLeadsDestination(null,
      async (id) => { pinned.push(id); return { state: 'ready', data: { state: 'not_connected' } } },
      async (id) => { pinned.push(id); return { state: 'ready', data: [] } })
    assert.deepEqual(pinned, [null, undefined], 'Client-role reads stay pinned by the server')
    assert.equal(await hasClientLeadsDestination('exact-client', async () => ({ state: 'ready', data: { state: 'available' } }), history), true)
    assert.equal(await hasClientLeadsDestination('exact-client', metrics, async () => ({ state: 'ready', data: [{ enquiryId: 'old' }] })), true)
    assert.equal(await hasClientLeadsDestination('exact-client', metrics, async () => ({ state: 'error', message: 'read failed' })), true)
    assert.equal(await hasClientLeadsDestination('exact-client', async () => ({ state: 'error', message: 'read failed' }), history), true)
    assert.equal(await hasClientLeadsDestination('exact-client', async () => { throw new Error('network') }, history), true)
  } finally { await server.close() }
})
