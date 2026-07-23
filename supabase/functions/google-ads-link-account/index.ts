import { requireAdminOrManager } from '../_shared/auth.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import {
  getAccessibleNonManagerAccount,
  googleAdsConfig,
  listAccountCampaigns,
  refreshGoogleAccessToken,
  safeGoogleAdsError,
} from '../_shared/google-ads.ts'

type AccountMode = 'dedicated' | 'shared'
type CampaignInput = { campaignId?: string | number; clientId?: string }
type LinkBody = {
  action?: 'set_mode' | 'save_dedicated' | 'deactivate_dedicated' | 'save_campaigns' | 'deactivate_campaign'
  googleAdsAccountId?: string
  accountId?: string
  accountMode?: AccountMode
  confirmModeChange?: boolean
  clientId?: string
  mappingId?: string
  campaignLinkId?: string
  campaignIds?: Array<string | number>
  campaigns?: CampaignInput[]
}
type CanonicalAccount = {
  id: string
  customer_id: string
  account_mode: AccountMode | null
  is_active: boolean
}
type CampaignAssignment = { campaignId: string; campaignName: string; clientId: string }

const MAX_CAMPAIGNS_PER_SAVE = 200

function accountId(body: LinkBody): string | null {
  const value = body.googleAdsAccountId ?? body.accountId
  return typeof value === 'string' && value ? value : null
}

function campaignInputs(body: LinkBody): Array<{ campaignId: string; clientId: string }> | null {
  const inputs = body.campaigns ?? body.campaignIds?.map(campaignId => ({ campaignId, clientId: body.clientId }))
  if (!inputs || inputs.length === 0 || inputs.length > MAX_CAMPAIGNS_PER_SAVE) return null
  const parsed = inputs.map(input => ({
    campaignId: input.campaignId === undefined ? '' : String(input.campaignId),
    clientId: typeof input.clientId === 'string' ? input.clientId : '',
  }))
  if (parsed.some(input => !/^\d+$/.test(input.campaignId) || !input.clientId)) return null
  return new Set(parsed.map(input => input.campaignId)).size === parsed.length ? parsed : null
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  let body: LinkBody
  try {
    body = await request.json() as LinkBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  const actions = ['set_mode', 'save_dedicated', 'deactivate_dedicated', 'save_campaigns', 'deactivate_campaign']
  if (!body.action || !actions.includes(body.action)) {
    return jsonResponse({ ok: false, error: 'An explicit supported mapping action is required.' }, 400)
  }

  const canonicalId = accountId(body)
  if (!canonicalId) return jsonResponse({ ok: false, error: 'googleAdsAccountId is required.' }, 400)
  const { supabase, user } = auth.value

  if (body.action === 'deactivate_dedicated') {
    if (!body.mappingId) return jsonResponse({ ok: false, error: 'mappingId is required.' }, 400)
    const { data, error } = await supabase.from('google_ads_account_links')
      .update({ is_active: false })
      .eq('id', body.mappingId)
      .eq('google_ads_account_id', canonicalId)
      .eq('is_active', true)
      .select('id, google_ads_account_id')
      .maybeSingle()
    if (error) return jsonResponse({ ok: false, error: 'Could not deactivate dedicated mapping.' }, 500)
    if (!data) return jsonResponse({ ok: false, error: 'Active dedicated mapping not found for this account.' }, 404)
    return jsonResponse({ ok: true, action: body.action, mappingId: data.id, googleAdsAccountId: data.google_ads_account_id })
  }

  if (body.action === 'deactivate_campaign') {
    const linkId = body.campaignLinkId ?? body.mappingId
    if (!linkId) return jsonResponse({ ok: false, error: 'campaignLinkId is required.' }, 400)
    const { data, error } = await supabase.from('google_ads_campaign_links')
      .update({ is_active: false })
      .eq('id', linkId)
      .eq('google_ads_account_id', canonicalId)
      .eq('is_active', true)
      .select('id, google_ads_account_id, campaign_id')
      .maybeSingle()
    if (error) return jsonResponse({ ok: false, error: 'Could not deactivate campaign mapping.' }, 500)
    if (!data) return jsonResponse({ ok: false, error: 'Active campaign mapping not found for this account.' }, 404)
    return jsonResponse({ ok: true, action: body.action, campaignLinkId: data.id, googleAdsAccountId: data.google_ads_account_id, campaignId: data.campaign_id })
  }

  const { data: accountRow, error: accountError } = await supabase.from('google_ads_accounts')
    .select('id, customer_id, account_mode, is_active')
    .eq('id', canonicalId)
    .maybeSingle()
  if (accountError) return jsonResponse({ ok: false, error: 'Could not validate canonical Google Ads account.' }, 500)
  const canonical = accountRow as CanonicalAccount | null
  if (!canonical?.is_active) return jsonResponse({ ok: false, error: 'Active canonical Google Ads account not found.' }, 404)

  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)

  try {
    const accessToken = await refreshGoogleAccessToken(config)
    const liveAccount = await getAccessibleNonManagerAccount(config, accessToken, canonical.customer_id)
    if (!liveAccount) {
      return jsonResponse({ ok: false, error: 'The Google Ads account is not currently accessible, enabled, and non-manager.' }, 400)
    }
    const { error: metadataError } = await supabase.from('google_ads_accounts').update({
      account_name: liveAccount.name ?? `Google Ads ${liveAccount.customerId}`,
      currency_code: liveAccount.currencyCode ?? 'XXX',
      time_zone: liveAccount.timeZone ?? 'UTC',
      last_discovered_at: new Date().toISOString(),
    }).eq('id', canonical.id).eq('is_active', true)
    if (metadataError) return jsonResponse({ ok: false, error: 'Could not refresh Google Ads account metadata.' }, 500)

    if (body.action === 'set_mode') {
      if (body.accountMode !== 'dedicated' && body.accountMode !== 'shared') {
        return jsonResponse({ ok: false, error: 'accountMode must be dedicated or shared.' }, 400)
      }
      const changing = canonical.account_mode !== null && canonical.account_mode !== body.accountMode
      if (changing && body.confirmModeChange !== true) {
        return jsonResponse({ ok: false, error: 'Changing account mode requires explicit confirmation.' }, 409)
      }
      const { error } = await supabase.rpc('set_google_ads_account_mode', {
        p_account_id: canonical.id,
        p_account_mode: body.accountMode,
        p_confirm_mode_change: body.confirmModeChange === true,
      })
      if (error) return jsonResponse({ ok: false, error: 'Could not atomically set Google Ads account mode.' }, 500)
      return jsonResponse({ ok: true, action: body.action, googleAdsAccountId: canonical.id, accountMode: body.accountMode, changed: changing })
    }

    if (body.action === 'save_dedicated') {
      if (!body.clientId) return jsonResponse({ ok: false, error: 'clientId is required.' }, 400)
      if (canonical.account_mode !== 'dedicated') {
        return jsonResponse({ ok: false, error: 'Set this account to dedicated mode before saving a dedicated mapping.' }, 409)
      }
      const { data: client, error: clientError } = await supabase.from('clients')
        .select('id, active').eq('id', body.clientId).maybeSingle()
      if (clientError) return jsonResponse({ ok: false, error: 'Could not validate client.' }, 500)
      if (!client?.active) return jsonResponse({ ok: false, error: 'Active client not found.' }, 404)

      const { error } = await supabase.rpc('save_google_ads_account_mapping', {
        p_account_id: canonical.id,
        p_account_mode: 'dedicated',
        p_confirm_mapping_changes: true,
        p_dedicated_client_id: body.clientId,
        p_campaign_mappings: [],
        p_created_by: user.id,
      })
      if (error) return jsonResponse({ ok: false, error: 'Could not atomically save dedicated mapping.' }, 500)
      const { data: mapping } = await supabase.from('google_ads_account_links').select('id')
        .eq('google_ads_account_id', canonical.id).eq('client_id', body.clientId).eq('is_active', true).maybeSingle()
      return jsonResponse({ ok: true, action: body.action, mappingId: mapping?.id ?? null, account: liveAccount })
    }

    if (canonical.account_mode !== 'shared') {
      return jsonResponse({ ok: false, error: 'Set this account to shared mode before saving campaign mappings.' }, 409)
    }
    const inputs = campaignInputs(body)
    if (!inputs) {
      return jsonResponse({ ok: false, error: `Supply 1-${MAX_CAMPAIGNS_PER_SAVE} unique campaigns with explicit clientId values.` }, 400)
    }

    const [{ data: existingLinks, error: linksError }, liveCampaigns] = await Promise.all([
      supabase.from('google_ads_campaign_links')
        .select('campaign_id, campaign_name, client_id')
        .eq('google_ads_account_id', canonical.id)
        .eq('is_active', true),
      listAccountCampaigns(config, accessToken, liveAccount.customerId),
    ])
    if (linksError) return jsonResponse({ ok: false, error: 'Could not load existing campaign mappings.' }, 500)

    const desired = new Map<string, CampaignAssignment>()
    for (const link of existingLinks ?? []) {
      desired.set(link.campaign_id, {
        campaignId: link.campaign_id,
        campaignName: link.campaign_name,
        clientId: link.client_id,
      })
    }
    for (const input of inputs) {
      desired.set(input.campaignId, { campaignId: input.campaignId, campaignName: '', clientId: input.clientId })
    }
    if (desired.size > MAX_CAMPAIGNS_PER_SAVE) {
      return jsonResponse({ ok: false, error: `An account can save at most ${MAX_CAMPAIGNS_PER_SAVE} campaign mappings at once.` }, 400)
    }

    const liveById = new Map(liveCampaigns.map(campaign => [campaign.campaignId, campaign]))
    const unavailable = [...desired.keys()].filter(campaignId => !liveById.has(campaignId))
    if (unavailable.length > 0) {
      return jsonResponse({ ok: false, error: 'Every existing and selected campaign mapping must still exist in live Google Ads discovery.' }, 400)
    }
    for (const assignment of desired.values()) {
      assignment.campaignName = liveById.get(assignment.campaignId)?.name ?? assignment.campaignName
    }

    const clientIds = [...new Set([...desired.values()].map(mapping => mapping.clientId))]
    const { data: clients, error: clientsError } = await supabase.from('clients').select('id, active').in('id', clientIds)
    if (clientsError) return jsonResponse({ ok: false, error: 'Could not validate clients.' }, 500)
    const activeClientIds = new Set((clients ?? []).filter(client => client.active).map(client => client.id))
    if (clientIds.some(clientId => !activeClientIds.has(clientId))) {
      return jsonResponse({ ok: false, error: 'Every campaign mapping requires an active client.' }, 404)
    }

    const campaignMappings = [...desired.values()].map(mapping => ({
      campaign_id: mapping.campaignId,
      campaign_name: mapping.campaignName,
      client_id: mapping.clientId,
      is_active: true,
    }))
    const { error } = await supabase.rpc('save_google_ads_account_mapping', {
      p_account_id: canonical.id,
      p_account_mode: 'shared',
      p_confirm_mapping_changes: true,
      p_dedicated_client_id: null,
      p_campaign_mappings: campaignMappings,
      p_created_by: user.id,
    })
    if (error) return jsonResponse({ ok: false, error: 'Could not atomically save campaign mappings.' }, 500)

    const { data: mappings, error: resultError } = await supabase.from('google_ads_campaign_links')
      .select('id, client_id, campaign_id').eq('google_ads_account_id', canonical.id).eq('is_active', true)
    if (resultError) return jsonResponse({ ok: false, error: 'Campaign mappings were saved but could not be reloaded.' }, 500)
    return jsonResponse({ ok: true, action: body.action, googleAdsAccountId: canonical.id, saved: inputs.length, mappings })
  } catch (error) {
    return jsonResponse({ ok: false, ...safeGoogleAdsError(error) }, 502)
  }
})
