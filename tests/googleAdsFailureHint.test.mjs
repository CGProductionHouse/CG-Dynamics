import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, api
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  api = await server.ssrLoadModule('/supabase/functions/_shared/google-ads.ts')
})
after(async () => { await server?.close() })

test('Google Ads failure hint exposes only an enum and known GAQL field', () => {
  const body = { details: [{ errors: [{ errorCode: { queryError: 'UNRECOGNIZED_FIELD' }, message: "Unknown campaign_budget.delivery_method; token=PRIVATE and customer 1234567890" }] }] }
  assert.equal(api.safeGoogleAdsFailureHint(body), 'queryError.UNRECOGNIZED_FIELD at campaign_budget.delivery_method')
  assert.equal(api.safeGoogleAdsFailureHint({ error: body }), 'queryError.UNRECOGNIZED_FIELD at campaign_budget.delivery_method')
  assert.equal(api.safeGoogleAdsFailureHint({ details: [{ errors: [{ errorCode: { authorizationError: 'USER_PERMISSION_DENIED' }, message: 'private-account' }] }] }), 'authorizationError.USER_PERMISSION_DENIED')
  assert.equal(api.safeGoogleAdsFailureHint({ details: [{ errors: [{ errorCode: { queryError: 'BAD;secret' }, message: 'private' }] }] }), null)
  assert.equal(api.safeGoogleAdsFailureHint({ error: { message: 'private' } }), null)
})

test('failed search returns safe code and request ID without the raw error text', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ details: [{ errors: [{ errorCode: { queryError: 'UNRECOGNIZED_FIELD' }, message: 'campaign_budget.delivery_method token=PRIVATE' }] }] }), { status: 400, headers: { 'request-id': 'request-123' } })
  try {
    await assert.rejects(api.searchStream({ developerToken: 'PRIVATE', loginCustomerId: '1234567890' }, 'PRIVATE', '1234567890', 'SELECT campaign.id FROM campaign'), error => {
      assert.equal(error.status, 400)
      assert.equal(error.requestId, 'request-123')
      assert.match(error.message, /queryError\.UNRECOGNIZED_FIELD at campaign_budget\.delivery_method/)
      assert.doesNotMatch(error.message, /PRIVATE/)
      return true
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('campaign discovery uses identity fields only and marks native settings unavailable', async () => {
  const originalFetch = globalThis.fetch
  let query = ''
  globalThis.fetch = async (_url, init) => {
    query = JSON.parse(init.body).query
    return new Response(JSON.stringify([{ results: [{
      campaign: { id: '23937664317', name: 'Cape Lumber', status: 'ENABLED', advertisingChannelType: 'SMART' },
      customer: { id: '4951506884', descriptiveName: 'CG', currencyCode: 'ZAR', timeZone: 'Africa/Johannesburg' },
    }] }]), { status: 200 })
  }
  try {
    const campaigns = await api.listAccountCampaigns({ developerToken: 'test', loginCustomerId: '4951506884' }, 'test', '4951506884')
    assert.equal(campaigns.length, 1)
    assert.equal(campaigns[0].campaignId, '23937664317')
    assert.equal(campaigns[0].nativeSettings, null)
    assert.match(query, /campaign\.id/)
    assert.doesNotMatch(query, /campaign_budget\.|campaign\.primary_status|metrics\./)
  } finally {
    globalThis.fetch = originalFetch
  }
})
