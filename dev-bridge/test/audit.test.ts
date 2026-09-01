import assert from 'node:assert/strict'
import test from 'node:test'
import { audit, requireDurableAudit } from '../src/audit.js'

test('audit persists a private immutable record without raw error secrets', async () => {
  let stored: { pathname: string, body: string } | undefined

  await audit({
    requestId: '63bf30ff-9459-42be-835f-fd4af0dcb97a',
    actor: 'auth0|owner',
    tool: 'dev_read_file',
    risk: 'low',
    target: 'src/App.tsx',
    outcome: 'failed',
    durationMs: 24,
    error: 'Authorization: Bearer secret-token',
  }, async (pathname, body) => {
    stored = { pathname, body }
  })

  assert.ok(stored)
  assert.match(stored.pathname, /^owner-dev-bridge\/\d{4}\/\d{2}\/\d{2}\/.+-63bf30ff-9459-42be-835f-fd4af0dcb97a\.json$/)
  const record = JSON.parse(stored.body) as Record<string, unknown>
  assert.equal(record.event, 'owner_dev_bridge_tool')
  assert.equal(record.actor, 'auth0|owner')
  assert.equal(record.error, 'Authorization: Bearer [REDACTED]')
})

test('durable audit preflight requires Vercel OIDC and a connected store', () => {
  const previousStore = process.env.BLOB_STORE_ID
  const previousToken = process.env.VERCEL_OIDC_TOKEN
  delete process.env.BLOB_STORE_ID
  delete process.env.VERCEL_OIDC_TOKEN

  try {
    assert.throws(() => requireDurableAudit(), /Durable audit storage is unavailable/)
    process.env.BLOB_STORE_ID = 'store_test'
    process.env.VERCEL_OIDC_TOKEN = 'oidc-test'
    assert.doesNotThrow(() => requireDurableAudit())
  } finally {
    if (previousStore === undefined) delete process.env.BLOB_STORE_ID
    else process.env.BLOB_STORE_ID = previousStore
    if (previousToken === undefined) delete process.env.VERCEL_OIDC_TOKEN
    else process.env.VERCEL_OIDC_TOKEN = previousToken
  }
})
