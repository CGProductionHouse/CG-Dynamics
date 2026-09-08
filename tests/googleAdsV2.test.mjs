import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, native
before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  native = await server.ssrLoadModule('/supabase/functions/_shared/google-ads-native.ts')
})
after(async () => { await server?.close() })

test('budget snapshot retains daily/shared settings and never infers budget from cost', () => {
  const result = native.googleAdsNativeSnapshot({
    campaign: { primaryStatus: 'ELIGIBLE' },
    campaignBudget: { amountMicros: '100000000', period: 'DAILY', explicitlyShared: true },
    metrics: { costMicros: '572320000' },
  }, '2026-09-08T12:00:00Z')
  assert.equal(result.budget_amount_micros, 100000000)
  assert.equal(result.budget_total_amount_micros, null)
  assert.equal(result.budget_shared, true)
  assert.equal(result.observed_at, '2026-09-08T12:00:00Z')
})

test('missing provider fields remain unavailable while explicit zero survives', () => {
  assert.equal(native.nullableGoogleAdsNumber(undefined), null)
  assert.equal(native.nullableGoogleAdsNumber(null), null)
  assert.equal(native.nullableGoogleAdsNumber(''), null)
  assert.equal(native.nullableGoogleAdsNumber('0'), 0)
  assert.equal(native.googleAdsNativeSnapshot({}, 'now').budget_shared, null)
})
