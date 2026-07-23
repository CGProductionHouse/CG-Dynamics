import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import {
  googleAdsConfig,
  listAccessibleAccounts,
  normalizeCustomerId,
  refreshGoogleAccessToken,
  safeGoogleAdsError,
} from '../_shared/google-ads.ts'

type LinkBody = {
  action?: 'create' | 'update' | 'deactivate'
  mappingId?: string
  clientId?: string
  customerId?: string | number
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
  if (!body.action || !['create', 'update', 'deactivate'].includes(body.action)) {
    return jsonResponse({ ok: false, error: 'An explicit create, update, or deactivate action is required.' }, 400)
  }

  const { supabase, user } = auth.value
  if (body.action === 'deactivate') {
    if (!body.mappingId) return jsonResponse({ ok: false, error: 'mappingId is required.' }, 400)
    const { data, error } = await supabase
      .from('google_ads_account_links')
      .update({ is_active: false })
      .eq('id', body.mappingId)
      .eq('is_active', true)
      .select('id')
      .maybeSingle()
    if (error) return jsonResponse({ ok: false, error: 'Could not deactivate Google Ads mapping.' }, 500)
    if (!data) return jsonResponse({ ok: false, error: 'Active Google Ads mapping not found.' }, 404)
    return jsonResponse({ ok: true, action: 'deactivate', mappingId: data.id })
  }

  if (!body.clientId) return jsonResponse({ ok: false, error: 'clientId is required.' }, 400)
  if (body.action === 'update' && !body.mappingId) {
    return jsonResponse({ ok: false, error: 'mappingId is required for update.' }, 400)
  }
  const customerId = normalizeCustomerId(body.customerId)
  if (!customerId) return jsonResponse({ ok: false, error: 'A valid Google Ads customerId is required.' }, 400)

  if (body.action === 'update') {
    const { data: existing, error: existingError } = await supabase
      .from('google_ads_account_links')
      .select('client_id, customer_id')
      .eq('id', body.mappingId)
      .maybeSingle()
    if (existingError) return jsonResponse({ ok: false, error: 'Could not validate Google Ads mapping.' }, 500)
    if (!existing) return jsonResponse({ ok: false, error: 'Google Ads mapping not found.' }, 404)
    if (existing.client_id !== body.clientId || existing.customer_id !== customerId) {
      return jsonResponse({ ok: false, error: 'A mapping identity cannot be reassigned. Deactivate it and create an explicit new link.' }, 409)
    }
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, active')
    .eq('id', body.clientId)
    .maybeSingle()
  if (clientError) return jsonResponse({ ok: false, error: 'Could not validate client.' }, 500)
  if (!client?.active) return jsonResponse({ ok: false, error: 'Active client not found.' }, 404)

  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)

  try {
    const accessToken = await refreshGoogleAccessToken(config)
    const account = (await listAccessibleAccounts(config, accessToken)).find(item => item.customerId === customerId)
    if (!account) return jsonResponse({ ok: false, error: 'Google Ads account is not accessible from the configured hierarchy.' }, 400)
    if (account.manager) return jsonResponse({ ok: false, error: 'Manager accounts cannot be linked for campaign reporting.' }, 400)
    if (account.status && account.status !== 'ENABLED') {
      return jsonResponse({ ok: false, error: 'Only enabled Google Ads accounts can be linked.' }, 400)
    }

    const { data: duplicates, error: duplicateError } = await supabase
      .from('google_ads_account_links')
      .select('id, client_id, customer_id')
      .eq('is_active', true)
    if (duplicateError) return jsonResponse({ ok: false, error: 'Could not validate existing mappings.' }, 500)
    const duplicate = (duplicates ?? []).find(row =>
      row.id !== body.mappingId && (row.client_id === body.clientId || row.customer_id === customerId)
    )
    if (duplicate) return jsonResponse({ ok: false, error: 'Client or Google Ads account already has an active mapping.' }, 409)

    const payload = {
      client_id: body.clientId,
      customer_id: account.customerId,
      customer_name: account.name ?? `Google Ads ${account.customerId}`,
      currency_code: account.currencyCode,
      time_zone: account.timeZone,
      is_active: true,
    }
    if (body.action === 'create') {
      const { data: inactiveMatch, error: inactiveError } = await supabase
        .from('google_ads_account_links')
        .select('id')
        .eq('client_id', body.clientId)
        .eq('customer_id', customerId)
        .eq('is_active', false)
        .maybeSingle()
      if (inactiveError) return jsonResponse({ ok: false, error: 'Could not validate previous Google Ads mappings.' }, 500)
      if (inactiveMatch) {
        const { data, error } = await supabase
          .from('google_ads_account_links')
          .update(payload)
          .eq('id', inactiveMatch.id)
          .select('id')
          .single()
        if (error) return jsonResponse({ ok: false, error: 'Could not reactivate Google Ads mapping.' }, 500)
        return jsonResponse({ ok: true, action: 'update', mappingId: data.id, account })
      }

      const { data, error } = await supabase
        .from('google_ads_account_links')
        .insert({ ...payload, created_by: user.id })
        .select('id')
        .single()
      if (error || !data) return jsonResponse({ ok: false, error: 'Could not create Google Ads mapping.' }, 500)
      return jsonResponse({ ok: true, action: 'create', mappingId: data.id, account })
    }

    const { data, error } = await supabase
      .from('google_ads_account_links')
      .update(payload)
      .eq('id', body.mappingId)
      .select('id')
      .maybeSingle()
    if (error) return jsonResponse({ ok: false, error: 'Could not update Google Ads mapping.' }, 500)
    if (!data) return jsonResponse({ ok: false, error: 'Google Ads mapping not found.' }, 404)
    return jsonResponse({ ok: true, action: 'update', mappingId: data.id, account })
  } catch (error) {
    return jsonResponse({ ok: false, ...safeGoogleAdsError(error) }, 502)
  }
})
