import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inspectMetaAccessToken, verifiedMetaTokenValidUntil } from '../supabase/functions/_shared/metaTokenDiagnostics.ts'

test('native numeric zero expiry remains distinct from absent expiry metadata', async () => {
  const original = globalThis.fetch
  try {
    for (const [value, kind] of [[0, 'explicit_zero'], [undefined, 'unknown']]) {
      globalThis.fetch = async () => Response.json({ data: { app_id: '789', is_valid: true, type: 'USER',
        expires_at: value, data_access_expires_at: Math.floor(Date.now() / 1000) + 3600, scopes: ['pages_show_list'] } })
      const result = await inspectMetaAccessToken({ graphBaseUrl: 'https://graph.facebook.com/v27.0', appId: '789', appSecret: 'fixture-secret', accessToken: 'fixture-token' })
      assert.equal(result.expiresAt, null)
      assert.equal(result.expiryKind, kind)
    }
  } finally { globalThis.fetch = original }
})

const NOW = Date.parse('2026-11-24T11:00:00Z')
const diagnostic = change => ({ state: 'valid', tokenType: 'USER', expiresAt: null, expiryKind: 'explicit_zero',
  dataAccessExpiresAt: new Date(NOW + 3_600_000).toISOString(), validatedAt: new Date(NOW).toISOString(),
  grantedScopes: [], errorCode: null, errorReason: null, ...change })

test('explicit native zero obtains only a bounded proof, capped by finite data access and fifteen minutes', () => {
  assert.equal(verifiedMetaTokenValidUntil(diagnostic(), NOW), new Date(NOW + 900_000).toISOString())
  assert.equal(verifiedMetaTokenValidUntil(diagnostic({ dataAccessExpiresAt: new Date(NOW + 300_000).toISOString() }), NOW), new Date(NOW + 300_000).toISOString())
  assert.equal(verifiedMetaTokenValidUntil(diagnostic({ expiresAt: new Date(NOW + 3_600_000).toISOString(), expiryKind: 'fixed', dataAccessExpiresAt: null }), NOW), new Date(NOW + 3_600_000).toISOString())
})

test('zero does not bypass invalid app/type, stale proof, missing bounds or expired fixed timestamps', () => {
  for (const change of [{ state: 'invalid' }, { state: 'unverified' }, { tokenType: 'PAGE' }, { tokenType: 'SYSTEM_USER' },
    { expiryKind: undefined }, { expiryKind: 'unknown' }, { dataAccessExpiresAt: null }, { dataAccessExpiresAt: undefined },
    { dataAccessExpiresAt: 'bad' }, { dataAccessExpiresAt: new Date(NOW + 120_000).toISOString() },
    { expiresAt: new Date(NOW - 1).toISOString() }, { validatedAt: new Date(NOW - 120_001).toISOString() },
    { validatedAt: new Date(NOW + 30_001).toISOString() }, { expiresAt: 'bad' }]) {
    assert.equal(verifiedMetaTokenValidUntil(diagnostic(change), NOW), null, JSON.stringify(change))
  }
})

test('absent, string-zero and malformed native expiry cannot acquire explicit-zero classification', async () => {
  const original = globalThis.fetch
  try {
    for (const expires_at of [undefined, null, '0', -1, 'bad']) {
      globalThis.fetch = async () => Response.json({ data: { app_id: '789', is_valid: true, type: 'USER', expires_at,
        data_access_expires_at: Math.floor(Date.now() / 1000) + 3600, scopes: [] } })
      const result = await inspectMetaAccessToken({ graphBaseUrl: 'https://graph.facebook.com/v27.0', appId: '789', appSecret: 'fixture-secret', accessToken: 'fixture-token' })
      assert.equal(result.expiryKind, 'unknown'); assert.equal(verifiedMetaTokenValidUntil(result, Date.now()), null)
    }
  } finally { globalThis.fetch = original }
})
