import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { requireAdminOrManager } from '../_shared/auth.ts'
import {
  googleAdsConfig,
  normalizeCustomerId,
  refreshGoogleAccessToken,
  safeGoogleAdsError,
  searchStream,
} from '../_shared/google-ads.ts'
import {
  googleAdsCampaignQuery,
  validGoogleAdsDate,
  validateGoogleAdsDateRange,
} from '../_shared/google-ads-policy.ts'

type SyncBody = { startDate?: string; endDate?: string; clientId?: string; mappingIds?: string[] }
type LinkedAccount = { id: string; client_id: string; customer_id: string; customer_name: string | null }
type SyncItemResult = { mappingId: string; customerId: string; status: 'success' | 'failed'; rows: number; error?: string; requestId?: string }

const MAX_ACCOUNTS_PER_RUN = 10

function numberValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value !== '' && Number.isFinite(Number(value))) return Number(value)
  return 0
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const auth = await requireAdminOrManager(request)
  if (!auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  let body: SyncBody
  try {
    body = await request.json() as SyncBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  const dateError = validateGoogleAdsDateRange(body.startDate, body.endDate, new Date().toISOString().slice(0, 10))
  if (dateError) return jsonResponse({ ok: false, error: dateError }, 400)
  const startDate = body.startDate as string
  const endDate = body.endDate as string
  if (body.mappingIds && (!Array.isArray(body.mappingIds) || body.mappingIds.length === 0 || body.mappingIds.length > MAX_ACCOUNTS_PER_RUN || body.mappingIds.some(id => typeof id !== 'string'))) {
    return jsonResponse({ ok: false, error: `mappingIds must contain between 1 and ${MAX_ACCOUNTS_PER_RUN} IDs.` }, 400)
  }

  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)
  const { supabase } = auth.value
  let accountQuery = supabase
    .from('google_ads_account_links')
    .select('id, client_id, customer_id, customer_name')
    .eq('is_active', true)
  if (body.mappingIds) accountQuery = accountQuery.in('id', [...new Set(body.mappingIds)])
  if (body.clientId) accountQuery = accountQuery.eq('client_id', body.clientId)
  const { data: accountRows, error: accountError } = await accountQuery
  if (accountError) return jsonResponse({ ok: false, error: 'Could not load linked Google Ads accounts.' }, 500)
  const accounts = (accountRows ?? []) as LinkedAccount[]
  if (accounts.length === 0) return jsonResponse({ ok: true, status: 'skipped', message: 'No active linked accounts found.', accounts: [] })
  if (accounts.length > MAX_ACCOUNTS_PER_RUN) {
    return jsonResponse({ ok: false, error: `A sync can process at most ${MAX_ACCOUNTS_PER_RUN} accounts. Select one client and retry.` }, 400)
  }

  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString()
  await supabase
    .from('google_ads_sync_runs')
    .update({ status: 'failed', error_message: 'Sync execution expired before completion.', finished_at: new Date().toISOString() })
    .in('status', ['queued', 'running'])
    .lt('updated_at', staleBefore)

  const { data: runs, error: runError } = await supabase
    .from('google_ads_sync_runs')
    .insert(accounts.map(account => ({
      account_link_id: account.id,
      client_id: account.client_id,
      customer_id: account.customer_id,
      period_start: startDate,
      period_end: endDate,
      status: 'queued',
    })))
    .select('id, account_link_id')
  if (runError || !runs || runs.length !== accounts.length) {
    return jsonResponse({ ok: false, error: 'Could not create Google Ads sync runs.' }, 500)
  }
  const runIds = new Map(runs.map(run => [run.account_link_id as string, run.id as string]))

  let accessToken: string
  try {
    accessToken = await refreshGoogleAccessToken(config)
  } catch (error) {
    const safe = safeGoogleAdsError(error)
    await supabase.from('google_ads_sync_runs').update({
      status: 'failed', error_message: safe.requestId ? `${safe.error} Request ID: ${safe.requestId}` : safe.error,
      finished_at: new Date().toISOString(),
    }).in('id', [...runIds.values()])
    return jsonResponse({
      ok: false,
      status: 'failed',
      runIds: [...runIds.values()],
      ...safe,
      results: accounts.map(account => ({
        mappingId: account.id,
        customerId: account.customer_id,
        status: 'failed',
        rows: 0,
        error: safe.error,
        ...(safe.requestId ? { requestId: safe.requestId } : {}),
      })),
    })
  }

  const results = await Promise.all(accounts.map(async (account): Promise<SyncItemResult> => {
    const runId = runIds.get(account.id) as string
    await supabase.from('google_ads_sync_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId)
    const customerId = normalizeCustomerId(account.customer_id)
    if (!customerId) {
      await supabase.from('google_ads_sync_runs').update({
        status: 'failed', error_message: 'Linked account has an invalid customer ID.', finished_at: new Date().toISOString(),
      }).eq('id', runId)
      return { mappingId: account.id, customerId: '', status: 'failed', rows: 0, error: 'Linked account has an invalid customer ID.' }
    }

    try {
      const rows = await searchStream(config, accessToken, customerId, googleAdsCampaignQuery(startDate, endDate))
      const metrics = rows.flatMap(row => {
        const campaign = row.campaign as Record<string, unknown> | undefined
        const segments = row.segments as Record<string, unknown> | undefined
        const values = row.metrics as Record<string, unknown> | undefined
        const campaignId = campaign?.id === undefined ? '' : String(campaign.id)
        const date = typeof segments?.date === 'string' ? segments.date : ''
        if (!/^\d+$/.test(campaignId) || !validGoogleAdsDate(date)) return []
        return [{
          campaign_id: campaignId,
          metric_date: date,
          campaign_name: typeof campaign?.name === 'string' && campaign.name ? campaign.name : `Campaign ${campaignId}`,
          campaign_status: typeof campaign?.status === 'string' ? campaign.status : null,
          impressions: numberValue(values?.impressions),
          clicks: numberValue(values?.clicks),
          cost_micros: numberValue(values?.costMicros),
          conversions: numberValue(values?.conversions),
          conversion_value: numberValue(values?.conversionsValue),
        }]
      })
      const { data: rowsWritten, error: replaceError } = await supabase.rpc('replace_google_ads_campaign_metrics', {
        p_account_link_id: account.id,
        p_client_id: account.client_id,
        p_customer_id: customerId,
        p_period_start: startDate,
        p_period_end: endDate,
        p_metrics: metrics,
      })
      if (replaceError || typeof rowsWritten !== 'number') throw new Error('Could not store Google Ads campaign metrics.')
      const syncedAt = new Date().toISOString()
      await supabase.from('google_ads_sync_runs').update({
        status: 'succeeded', rows_upserted: rowsWritten, finished_at: syncedAt,
      }).eq('id', runId)
      return { mappingId: account.id, customerId, status: 'success', rows: rowsWritten }
    } catch (error) {
      const safe = error instanceof Error && error.message === 'Could not store Google Ads campaign metrics.'
        ? { error: error.message }
        : safeGoogleAdsError(error)
      await supabase.from('google_ads_sync_runs').update({
        status: 'failed',
        error_message: safe.requestId ? `${safe.error} Request ID: ${safe.requestId}` : safe.error,
        finished_at: new Date().toISOString(),
      }).eq('id', runId)
      return { mappingId: account.id, customerId, status: 'failed', rows: 0, ...safe }
    }
  }))

  const completed = results.filter(result => result.status === 'success').length
  const failed = results.length - completed

  const status = failed === 0 ? 'success' : completed === 0 ? 'failed' : 'partial'

  return jsonResponse({
    ok: failed === 0,
    status,
    runIds: [...runIds.values()],
    period: { startDate, endDate },
    totalAccounts: accounts.length,
    completedAccounts: completed,
    failedAccounts: failed,
    results,
  })
})
