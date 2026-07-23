import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  getAccessibleNonManagerAccount,
  googleAdsConfig,
  listAccountCampaigns,
  normalizeCustomerId,
  refreshGoogleAccessToken,
  safeGoogleAdsError,
} from '../_shared/google-ads.ts'

function label(value: string): string {
  return value.toLowerCase().split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  let body: { customerId?: string | number }
  try {
    body = await request.json() as { customerId?: string | number }
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  const customerId = normalizeCustomerId(body.customerId)
  if (!customerId) return jsonResponse({ ok: false, error: 'A valid customerId is required.' }, 400)

  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)

  try {
    const accessToken = await refreshGoogleAccessToken(config)
    const account = await getAccessibleNonManagerAccount(config, accessToken, customerId)
    if (!account) {
      return jsonResponse({ ok: false, error: 'An accessible enabled non-manager Google Ads account is required.' }, 400)
    }
    const campaigns = (await listAccountCampaigns(config, accessToken, customerId)).map(campaign => ({
      ...campaign,
      statusLabel: label(campaign.status),
      advertisingChannelTypeLabel: campaign.advertisingChannelType
        ? label(campaign.advertisingChannelType)
        : 'Unknown',
    }))
    return jsonResponse({ ok: true, account, campaigns, count: campaigns.length })
  } catch (error) {
    return jsonResponse({ ok: false, ...safeGoogleAdsError(error) }, 502)
  }
})
