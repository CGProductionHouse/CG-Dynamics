import { requireAdminOrManager } from '../_shared/auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GOOGLE_ADS_REFRESH_ENABLED_FLAG, googleAdsRefreshWorkerAuthorized, validGoogleAdsRefreshPayload } from '../_shared/googleAdsFreshness.ts'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
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

type SyncBody = {
  startDate?: string
  endDate?: string
  clientId?: string
  accountIds?: string[]
  mappingIds?: string[]
  expectedCustomerId?: string
  expectedTimeZone?: string
}
type AccountMode = 'dedicated' | 'shared'
type CanonicalAccount = {
  id: string
  customer_id: string
  account_mode: AccountMode | null
  account_name: string
  is_active: boolean
  time_zone: string
}
type DedicatedLink = { id: string; google_ads_account_id: string; client_id: string }
type CampaignLink = { id: string; google_ads_account_id: string; client_id: string; campaign_id: string }
type ConfiguredAccount = CanonicalAccount & { account_mode: AccountMode; dedicatedLinks: DedicatedLink[]; campaignLinks: CampaignLink[] }
type SyncItemResult = {
  accountId: string
  googleAdsAccountId: string
  customerId: string
  accountMode: AccountMode | null
  status: 'success' | 'failed' | 'skipped'
  rows: number
  mappedCampaigns: number
  unmappedCampaigns: number
  error?: string
  requestId?: string
}

const MAX_ACCOUNTS_PER_RUN = 10

function requiredMetricNumber(value: unknown, field: string): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value))) return Number(value)
  throw new Error(`Google Ads returned an incomplete ${field} metric.`)
}

function validIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_ACCOUNTS_PER_RUN &&
    value.every(id => typeof id === 'string' && id.length > 0)
}

function skippedResult(accountId: string, account: CanonicalAccount | null, error: string): SyncItemResult {
  return {
    accountId,
    googleAdsAccountId: accountId,
    customerId: account?.customer_id ?? '',
    accountMode: account?.account_mode ?? null,
    status: 'skipped',
    rows: 0,
    mappedCampaigns: 0,
    unmappedCampaigns: 0,
    error,
  }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'Method not allowed.' }, 405)

  const workerRequest = request.headers.has('X-Internal-Worker-Token')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  if (workerRequest && !googleAdsRefreshWorkerAuthorized({
    serviceKey, bearer: request.headers.get('Authorization') ?? '',
    workerToken: (Deno.env.get('WORKER_INTERNAL_TOKEN') ?? '').trim(),
    suppliedToken: request.headers.get('X-Internal-Worker-Token') ?? '',
  })) return jsonResponse({ ok: false, error: 'Worker authentication required.' }, 401)
  if (workerRequest && (Deno.env.get(GOOGLE_ADS_REFRESH_ENABLED_FLAG) ?? '').trim().toLowerCase() !== 'true') {
    return jsonResponse({ ok: false, error: 'Automatic Google Ads refresh is disabled.' }, 503)
  }
  const auth = workerRequest ? null : await requireAdminOrManager(request)
  if (auth && !auth.ok) return jsonResponse({ ok: false, error: auth.error }, auth.status)
  if (!url || !serviceKey) return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500)
  const supabase = auth?.ok ? auth.value.supabase : createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let body: SyncBody
  try {
    body = await request.json() as SyncBody
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ ok: false, error: 'JSON object body required.' }, 400)
  }
  if (workerRequest && !validGoogleAdsRefreshPayload(body)) {
    return jsonResponse({ ok: false, error: 'Exact current Google Ads refresh identity and date window required.' }, 400)
  }
  const dateError = validateGoogleAdsDateRange(body.startDate, body.endDate, new Date().toISOString().slice(0, 10))
  if (dateError) return jsonResponse({ ok: false, error: dateError }, 400)
  if (body.accountIds !== undefined && !validIdList(body.accountIds)) {
    return jsonResponse({ ok: false, error: `accountIds must contain between 1 and ${MAX_ACCOUNTS_PER_RUN} IDs.` }, 400)
  }
  if (body.mappingIds !== undefined && !validIdList(body.mappingIds)) {
    return jsonResponse({ ok: false, error: `mappingIds must contain between 1 and ${MAX_ACCOUNTS_PER_RUN} IDs.` }, 400)
  }
  const startDate = body.startDate as string
  const endDate = body.endDate as string
  const requestedAccountIds = body.accountIds ? [...new Set(body.accountIds)] : null
  const config = googleAdsConfig()
  if (!config) return jsonResponse({ ok: false, error: 'Google Ads is not configured.' }, 503)

  let accountQuery = supabase.from('google_ads_accounts')
    .select('id, customer_id, account_mode, account_name, is_active, time_zone')
  if (requestedAccountIds) {
    accountQuery = accountQuery.in('id', requestedAccountIds)
  } else {
    accountQuery = accountQuery.eq('is_active', true).in('account_mode', ['dedicated', 'shared'])
  }
  const [accountsResult, dedicatedResult, campaignsResult] = await Promise.all([
    accountQuery,
    supabase.from('google_ads_account_links')
      .select('id, google_ads_account_id, client_id').eq('is_active', true),
    supabase.from('google_ads_campaign_links')
      .select('id, google_ads_account_id, client_id, campaign_id').eq('is_active', true),
  ])
  if (accountsResult.error || dedicatedResult.error || campaignsResult.error) {
    return jsonResponse({ ok: false, error: 'Could not load configured Google Ads accounts.' }, 500)
  }

  const accountRows = (accountsResult.data ?? []) as CanonicalAccount[]
  if (workerRequest && (accountRows.length !== 1 || accountRows[0].customer_id !== body.expectedCustomerId ||
      accountRows[0].time_zone !== body.expectedTimeZone)) {
    return jsonResponse({ ok: false, error: 'Google Ads refresh account identity changed.' }, 409)
  }
  const accountById = new Map(accountRows.map(account => [account.id, account]))
  const dedicatedLinks = (dedicatedResult.data ?? []) as DedicatedLink[]
  const campaignLinks = (campaignsResult.data ?? []) as CampaignLink[]
  const allClientIds = [...new Set([
    ...dedicatedLinks.map(link => link.client_id),
    ...campaignLinks.map(link => link.client_id),
  ])]
  const { data: clients, error: clientError } = allClientIds.length > 0
    ? await supabase.from('clients').select('id, active').in('id', allClientIds)
    : { data: [], error: null }
  if (clientError) return jsonResponse({ ok: false, error: 'Could not validate mapped clients.' }, 500)
  const activeClients = new Set((clients ?? []).filter(client => client.active).map(client => client.id))
  const requestedMappings = body.mappingIds ? new Set(body.mappingIds) : null
  const skipped: SyncItemResult[] = []
  const configured: ConfiguredAccount[] = []

  if (requestedAccountIds) {
    for (const id of requestedAccountIds) {
      if (!accountById.has(id)) skipped.push(skippedResult(id, null, 'Requested Google Ads account was not found.'))
    }
  }

  for (const account of accountRows) {
    const shouldReportSkip = requestedAccountIds !== null
    if (!account.is_active) {
      if (shouldReportSkip) skipped.push(skippedResult(account.id, account, 'Requested Google Ads account is inactive.'))
      continue
    }
    if (account.account_mode !== 'dedicated' && account.account_mode !== 'shared') {
      if (shouldReportSkip) skipped.push(skippedResult(account.id, account, 'Requested Google Ads account has no configured mode.'))
      continue
    }

    const dedicated = dedicatedLinks.filter(link =>
      link.google_ads_account_id === account.id && activeClients.has(link.client_id) &&
      (!body.clientId || link.client_id === body.clientId) && (!requestedMappings || requestedMappings.has(link.id))
    )
    const campaigns = campaignLinks.filter(link =>
      link.google_ads_account_id === account.id && activeClients.has(link.client_id) &&
      (!body.clientId || link.client_id === body.clientId) && (!requestedMappings || requestedMappings.has(link.id))
    )
    const hasAnyDedicated = dedicatedLinks.some(link => link.google_ads_account_id === account.id)
    const hasAnyCampaign = campaignLinks.some(link => link.google_ads_account_id === account.id)
    if (hasAnyDedicated && hasAnyCampaign) {
      if (shouldReportSkip) skipped.push(skippedResult(account.id, account, 'Dedicated and campaign mappings coexist; repair the account before syncing.'))
      continue
    }
    if (account.account_mode === 'dedicated' && dedicated.length > 0 && !hasAnyCampaign) {
      configured.push({ ...account, account_mode: 'dedicated', dedicatedLinks: dedicated, campaignLinks: [] })
      continue
    }
    if (account.account_mode === 'shared' && campaigns.length > 0 && !hasAnyDedicated) {
      configured.push({ ...account, account_mode: 'shared', dedicatedLinks: [], campaignLinks: campaigns })
      continue
    }
    if (shouldReportSkip) {
      skipped.push(skippedResult(account.id, account, 'Requested Google Ads account has no active mapping to an active client.'))
    }
  }

  if (configured.length > MAX_ACCOUNTS_PER_RUN) {
    return jsonResponse({ ok: false, error: `A sync can process at most ${MAX_ACCOUNTS_PER_RUN} accounts.` }, 400)
  }
  if (configured.length === 0) {
    return jsonResponse({
      ok: requestedAccountIds === null,
      status: 'skipped',
      message: 'No active configured and mapped accounts found.',
      totalAccounts: skipped.length,
      completedAccounts: 0,
      failedAccounts: 0,
      skippedAccounts: skipped.length,
      results: skipped,
    })
  }

  const staleBefore = new Date(Date.now() - 15 * 60_000).toISOString()
  await supabase.from('google_ads_sync_runs').update({
    status: 'failed',
    error_message: 'Sync execution expired before completion.',
    finished_at: new Date().toISOString(),
  }).in('status', ['queued', 'running']).lt('updated_at', staleBefore)

  const { data: runs, error: runError } = await supabase.from('google_ads_sync_runs').insert(configured.map(account => ({
    google_ads_account_id: account.id,
    customer_id: account.customer_id,
    period_start: startDate,
    period_end: endDate,
    status: 'queued',
  }))).select('id, google_ads_account_id')
  if (runError || !runs || runs.length !== configured.length) {
    return jsonResponse({ ok: false, error: 'Could not create canonical Google Ads sync runs.' }, 500)
  }
  const runIds = new Map(runs.map(run => [run.google_ads_account_id as string, run.id as string]))

  let accessToken: string
  // Queue retries own automatic backoff; avoid multiplying provider retries.
  const requestPolicy = workerRequest ? { attempts: 1, timeoutMs: 10_000 } : undefined
  try {
    accessToken = await refreshGoogleAccessToken(config, requestPolicy)
  } catch (error) {
    const safe = safeGoogleAdsError(error)
    await supabase.from('google_ads_sync_runs').update({
      status: 'failed',
      error_message: safe.requestId ? `${safe.error} Request ID: ${safe.requestId}` : safe.error,
      finished_at: new Date().toISOString(),
    }).in('id', [...runIds.values()])
    const failed = configured.map((account): SyncItemResult => ({
      accountId: account.id,
      googleAdsAccountId: account.id,
      customerId: account.customer_id,
      accountMode: account.account_mode,
      status: 'failed',
      rows: 0,
      mappedCampaigns: 0,
      unmappedCampaigns: 0,
      ...safe,
    }))
    return jsonResponse({
      ok: false,
      status: 'failed',
      runIds: [...runIds.values()],
      ...safe,
      totalAccounts: failed.length + skipped.length,
      completedAccounts: 0,
      failedAccounts: failed.length,
      skippedAccounts: skipped.length,
      results: [...skipped, ...failed],
    })
  }

  const synced = await Promise.all(configured.map(async (account): Promise<SyncItemResult> => {
    const runId = runIds.get(account.id) as string
    await supabase.from('google_ads_sync_runs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', runId)
    const customerId = normalizeCustomerId(account.customer_id)
    if (!customerId) {
      const error = 'Canonical account has an invalid customer ID.'
      await supabase.from('google_ads_sync_runs').update({ status: 'failed', error_message: error, finished_at: new Date().toISOString() }).eq('id', runId)
      return { accountId: account.id, googleAdsAccountId: account.id, customerId: '', accountMode: account.account_mode, status: 'failed', rows: 0, mappedCampaigns: 0, unmappedCampaigns: 0, error }
    }

    try {
      // Keep the metric request on the last provider-verified GAQL field set.
      // Optional native settings must not prevent reporting metrics from refreshing.
      const rows = await searchStream(config, accessToken, customerId, googleAdsCampaignQuery(startDate, endDate), requestPolicy)
      // The replacement RPC deletes the entire requested range. Carry forward only
      // previously verified optional facts for the same exact campaign and day.
      const previousOptional = new Map<string, { interactions: number | string | null; native_settings: Record<string, unknown> | null }>()
      const pageSize = 1000
      for (let offset = 0; ; offset += pageSize) {
        const { data: previous, error: previousError } = await supabase
          .from('google_ads_campaign_daily_metrics')
          .select('campaign_id,metric_date,interactions,native_settings')
          .eq('google_ads_account_id', account.id)
          .gte('metric_date', startDate)
          .lte('metric_date', endDate)
          .order('metric_date', { ascending: true })
          .order('campaign_id', { ascending: true })
          .range(offset, offset + pageSize - 1)
        if (previousError || !previous) throw new Error('Could not preserve previously verified Google Ads settings.')
        for (const item of previous) {
          previousOptional.set(`${item.campaign_id}:${item.metric_date}`, {
            interactions: typeof item.interactions === 'number' || typeof item.interactions === 'string'
              ? item.interactions : null,
            native_settings: item.native_settings && typeof item.native_settings === 'object' && !Array.isArray(item.native_settings)
              ? item.native_settings as Record<string, unknown> : null,
          })
        }
        if (previous.length < pageSize) break
      }
      const seenMetrics = new Set<string>()
      const metrics = rows.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Google Ads returned an invalid campaign metric row.')
        const customer = row.customer as Record<string, unknown> | undefined
        const campaign = row.campaign as Record<string, unknown> | undefined
        const segments = row.segments as Record<string, unknown> | undefined
        const values = row.metrics as Record<string, unknown> | undefined
        const campaignId = campaign?.id === undefined ? '' : String(campaign.id)
        const date = typeof segments?.date === 'string' ? segments.date : ''
        if (normalizeCustomerId(customer?.id) !== customerId || !/^\d+$/.test(campaignId) ||
            !validGoogleAdsDate(date) || date < startDate || date > endDate) {
          throw new Error('Google Ads returned an invalid campaign metric row.')
        }
        const identity = `${campaignId}:${date}`
        if (seenMetrics.has(identity)) throw new Error('Google Ads returned a duplicate campaign metric row.')
        seenMetrics.add(identity)
        const optional = previousOptional.get(`${campaignId}:${date}`)
        return {
          campaign_id: campaignId,
          native_settings: optional?.native_settings ?? null,
          metric_date: date,
          campaign_name: typeof campaign?.name === 'string' && campaign.name ? campaign.name : `Campaign ${campaignId}`,
          campaign_status: typeof campaign?.status === 'string' ? campaign.status : null,
          campaign_type: typeof campaign?.advertisingChannelType === 'string' ? campaign.advertisingChannelType : null,
          impressions: requiredMetricNumber(values?.impressions, 'impressions'),
          clicks: requiredMetricNumber(values?.clicks, 'clicks'),
          interactions: optional?.interactions ?? null,
          cost_micros: requiredMetricNumber(values?.costMicros, 'cost'),
          conversions: requiredMetricNumber(values?.conversions, 'conversions'),
          conversion_value: requiredMetricNumber(values?.conversionsValue, 'conversion value'),
        }
      })
      const distinctCampaigns = new Set(metrics.map(metric => metric.campaign_id))
      const configuredCampaigns = account.account_mode === 'shared'
        ? new Set(account.campaignLinks.map(link => link.campaign_id))
        : distinctCampaigns
      const mappedCampaigns = [...distinctCampaigns].filter(id => configuredCampaigns.has(id)).length
      const unmappedCampaigns = distinctCampaigns.size - mappedCampaigns

      const { data: rowsWritten, error: replaceError } = await supabase.rpc('replace_google_ads_account_campaign_metrics', {
        p_google_ads_account_id: account.id,
        p_period_start: startDate,
        p_period_end: endDate,
        p_metrics: metrics,
      })
      if (replaceError || typeof rowsWritten !== 'number') throw new Error('Could not store canonical Google Ads campaign metrics.')
      const { error: finishError } = await supabase.from('google_ads_sync_runs').update({
        status: 'succeeded',
        rows_upserted: rowsWritten,
        mapped_campaigns: mappedCampaigns,
        unmapped_campaigns: unmappedCampaigns,
        finished_at: new Date().toISOString(),
      }).eq('id', runId)
      if (finishError) throw new Error('Could not complete canonical Google Ads sync run.')
      return {
        accountId: account.id,
        googleAdsAccountId: account.id,
        customerId,
        accountMode: account.account_mode,
        status: 'success',
        rows: rowsWritten,
        mappedCampaigns,
        unmappedCampaigns,
      }
    } catch (error) {
      const safe: { error: string; requestId?: string } = error instanceof Error && (
        error.message === 'Could not store canonical Google Ads campaign metrics.' ||
        error.message === 'Could not preserve previously verified Google Ads settings.' ||
        error.message === 'Could not complete canonical Google Ads sync run.'
      )
        ? { error: error.message }
        : safeGoogleAdsError(error)
      await supabase.from('google_ads_sync_runs').update({
        status: 'failed',
        error_message: safe.requestId ? `${safe.error} Request ID: ${safe.requestId}` : safe.error,
        finished_at: new Date().toISOString(),
      }).eq('id', runId)
      return {
        accountId: account.id,
        googleAdsAccountId: account.id,
        customerId,
        accountMode: account.account_mode,
        status: 'failed',
        rows: 0,
        mappedCampaigns: 0,
        unmappedCampaigns: 0,
        ...safe,
      }
    }
  }))

  let results = [...skipped, ...synced]
  if (requestedAccountIds) {
    const order = new Map(requestedAccountIds.map((id, index) => [id, index]))
    results = results.sort((left, right) => (order.get(left.accountId) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.accountId) ?? Number.MAX_SAFE_INTEGER))
  }
  const completed = results.filter(result => result.status === 'success').length
  const failed = results.filter(result => result.status === 'failed').length
  const skippedCount = results.filter(result => result.status === 'skipped').length
  return jsonResponse({
    ok: failed === 0 && skippedCount === 0,
    status: failed === 0 && skippedCount === 0 ? 'success' : completed === 0 && failed > 0 ? 'failed' : 'partial',
    runIds: [...runIds.values()],
    period: { startDate, endDate },
    totalAccounts: results.length,
    completedAccounts: completed,
    failedAccounts: failed,
    skippedAccounts: skippedCount,
    mappedCampaigns: results.reduce((sum, result) => sum + result.mappedCampaigns, 0),
    unmappedCampaigns: results.reduce((sum, result) => sum + result.unmappedCampaigns, 0),
    results,
  })
})
