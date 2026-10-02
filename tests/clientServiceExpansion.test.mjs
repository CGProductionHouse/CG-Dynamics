import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

test('actual four-state presentation never converts unknown or disconnection into an upsell', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] }, configFile: false })
  try {
    const { SERVICE_KEYS, SERVICE_COPY, servicePresentation, parseServiceEntitlements } = await server.ssrLoadModule('/src/lib/clientServicePresentation.ts')
    assert.equal(SERVICE_KEYS.length, 7)
    for (const service_key of SERVICE_KEYS) {
      assert.ok(SERVICE_COPY[service_key].benefit.length > 80)
      for (const connection of ['connected','needs_connection','unavailable']) {
        for (const state of ['unknown','not_applicable','included']) {
          assert.equal(servicePresentation({ service_key, state, connection, requested_at: null }).canRequest, false)
        }
        assert.equal(servicePresentation({ service_key, state: 'not_included', connection, requested_at: null }).canRequest, true)
        assert.equal(servicePresentation({ service_key, state: 'not_included', connection, requested_at: '2026-10-02' }).canRequest, false)
      }
    }
    assert.equal(servicePresentation({ state: 'included', connection: 'connected' }).kind, 'connected')
    assert.equal(servicePresentation({ state: 'included', connection: 'needs_connection' }).kind, 'connection')
    assert.equal(servicePresentation({ state: 'included', connection: 'unavailable' }).kind, 'neutral')
    const rows = SERVICE_KEYS.map(service_key => ({ service_key, state: 'unknown', connection: 'unavailable', verified_at: null, requested_at: null }))
    assert.equal(parseServiceEntitlements(rows).length, 7)
    assert.throws(() => parseServiceEntitlements(rows.slice(0, 6)))
    assert.throws(() => parseServiceEntitlements([...rows.slice(0, 6), rows[0]]))
    assert.throws(() => parseServiceEntitlements(rows.map((row, i) => i ? row : { ...row, state: 'not_included' })))
  } finally { await server.close() }
})

test('client submission helper sends no trusted client/actor/board/price or package writes', () => {
  const source = readFileSync(new URL('../src/lib/clientServiceEntitlements.ts', import.meta.url), 'utf8')
  const seam = source.slice(source.indexOf('export async function requestServiceExpansion'), source.indexOf('export async function recordServiceSurface'))
  assert.doesNotMatch(seam, /client_id|actor|board|bucket|price|assigned/)
  assert.doesNotMatch(source, /package_settings|socialProviderEligibility|\.insert\(|\.update\(|\.upsert\(/)
})
