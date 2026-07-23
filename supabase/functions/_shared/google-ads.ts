import { normalizeCustomerId } from './google-ads-policy.ts'

export { normalizeCustomerId } from './google-ads-policy.ts'

const GOOGLE_ADS_API_ROOT = 'https://googleads.googleapis.com/v25'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MAX_ATTEMPTS = 4
const REQUEST_TIMEOUT_MS = 30_000
const MAX_RETRY_DELAY_MS = 10_000

export interface GoogleAdsConfig {
  clientId: string
  clientSecret: string
  refreshToken: string
  developerToken: string
  loginCustomerId: string
}

export interface GoogleAdsAccount {
  customerId: string
  resourceName: string
  name: string | null
  currencyCode: string | null
  timeZone: string | null
  manager: boolean
  level: number
  status: string | null
}

export interface GoogleAdsCampaign {
  campaignId: string
  name: string
  status: 'ENABLED' | 'PAUSED' | 'REMOVED'
  advertisingChannelType: string | null
  customerId: string
  customerName: string | null
  currencyCode: string | null
  timeZone: string | null
}

export class GoogleAdsError extends Error {
  status: number
  requestId: string | null

  constructor(message: string, status = 502, requestId: string | null = null) {
    super(message)
    this.name = 'GoogleAdsError'
    this.status = status
    this.requestId = requestId
  }
}

export function googleAdsConfig(): GoogleAdsConfig | null {
  const clientId = Deno.env.get('GOOGLE_ADS_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET')
  const refreshToken = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN')
  const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')
  const loginCustomerId = normalizeCustomerId(Deno.env.get('GOOGLE_ADS_LOGIN_CUSTOMER_ID') ?? '')
  if (!clientId || !clientSecret || !refreshToken || !developerToken || !loginCustomerId) return null
  return { clientId, clientSecret, refreshToken, developerToken, loginCustomerId }
}

export function customerResourceName(customerId: string): string {
  return `customers/${customerId}`
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

function requestId(response: Response): string | null {
  return response.headers.get('request-id') ?? response.headers.get('x-request-id')
}

function retryDelay(response: Response | null, attempt: number): number {
  const retryAfter = response?.headers.get('Retry-After')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 0), MAX_RETRY_DELAY_MS)
    const date = Date.parse(retryAfter)
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_RETRY_DELAY_MS)
  }
  return Math.min(500 * (2 ** attempt), MAX_RETRY_DELAY_MS)
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      lastResponse = response
      if (response.ok || (response.status !== 429 && response.status < 500)) return response
    } catch {
      lastResponse = null
    }
    if (attempt < MAX_ATTEMPTS - 1) await sleep(retryDelay(lastResponse, attempt))
  }
  throw new GoogleAdsError(
    lastResponse ? 'Google Ads is temporarily unavailable.' : 'Google Ads request timed out.',
    503,
    lastResponse ? requestId(lastResponse) : null,
  )
}

export async function refreshGoogleAccessToken(config: GoogleAdsConfig): Promise<string> {
  const response = await fetchWithRetry(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) {
    throw new GoogleAdsError('Google Ads authorization needs attention.', response.status, requestId(response))
  }
  const body = await response.json() as { access_token?: unknown }
  if (typeof body.access_token !== 'string' || !body.access_token) {
    throw new GoogleAdsError('Google Ads authorization returned an invalid response.', 502, requestId(response))
  }
  return body.access_token
}

export async function searchStream(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
  query: string,
): Promise<Array<Record<string, unknown>>> {
  const normalizedId = normalizeCustomerId(customerId)
  if (!normalizedId) throw new GoogleAdsError('Invalid Google Ads customer ID.', 400)
  const response = await fetchWithRetry(
    `${GOOGLE_ADS_API_ROOT}/customers/${normalizedId}/googleAds:searchStream`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': config.developerToken,
        'login-customer-id': config.loginCustomerId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    },
  )
  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 502 : response.status
    throw new GoogleAdsError('Google Ads rejected the request.', status, requestId(response))
  }
  const batches = await response.json() as Array<{ results?: Array<Record<string, unknown>> }>
  if (!Array.isArray(batches)) throw new GoogleAdsError('Google Ads returned an invalid response.', 502, requestId(response))
  return batches.flatMap(batch => Array.isArray(batch.results) ? batch.results : [])
}

export async function listAccessibleAccounts(
  config: GoogleAdsConfig,
  accessToken: string,
): Promise<GoogleAdsAccount[]> {
  const query = `
    SELECT
      customer_client.client_customer,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.manager,
      customer_client.level,
      customer_client.status
    FROM customer_client
    WHERE customer_client.level <= 10
    ORDER BY customer_client.level, customer_client.descriptive_name`
  const rows = await searchStream(config, accessToken, config.loginCustomerId, query)
  const accounts = new Map<string, GoogleAdsAccount>()
  for (const row of rows) {
    const entry = row.customerClient as Record<string, unknown> | undefined
    const customerId = normalizeCustomerId(entry?.clientCustomer)
    if (!entry || !customerId) continue
    accounts.set(customerId, {
      customerId,
      resourceName: customerResourceName(customerId),
      name: typeof entry.descriptiveName === 'string' ? entry.descriptiveName : null,
      currencyCode: typeof entry.currencyCode === 'string' ? entry.currencyCode : null,
      timeZone: typeof entry.timeZone === 'string' ? entry.timeZone : null,
      manager: entry.manager === true,
      level: typeof entry.level === 'number' ? entry.level : 0,
      status: typeof entry.status === 'string' ? entry.status : null,
    })
  }
  return [...accounts.values()]
}

export async function getAccessibleNonManagerAccount(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: unknown,
): Promise<GoogleAdsAccount | null> {
  const normalizedId = normalizeCustomerId(customerId)
  if (!normalizedId) return null
  const account = (await listAccessibleAccounts(config, accessToken))
    .find(item => item.customerId === normalizedId)
  if (!account || account.manager || (account.status !== null && account.status !== 'ENABLED')) return null
  return account
}

export async function listAccountCampaigns(
  config: GoogleAdsConfig,
  accessToken: string,
  customerId: string,
): Promise<GoogleAdsCampaign[]> {
  const rows = await searchStream(config, accessToken, customerId, `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone
    FROM campaign
    ORDER BY campaign.name`)

  return rows.flatMap(row => {
    const campaign = row.campaign as Record<string, unknown> | undefined
    const customer = row.customer as Record<string, unknown> | undefined
    const campaignId = campaign?.id === undefined ? '' : String(campaign.id)
    const normalizedCustomerId = normalizeCustomerId(customer?.id)
    const status = campaign?.status
    if (!/^\d+$/.test(campaignId) || !normalizedCustomerId ||
      (status !== 'ENABLED' && status !== 'PAUSED' && status !== 'REMOVED')) return []
    return [{
      campaignId,
      name: typeof campaign?.name === 'string' && campaign.name ? campaign.name : `Campaign ${campaignId}`,
      status,
      advertisingChannelType: typeof campaign?.advertisingChannelType === 'string'
        ? campaign.advertisingChannelType
        : null,
      customerId: normalizedCustomerId,
      customerName: typeof customer?.descriptiveName === 'string' ? customer.descriptiveName : null,
      currencyCode: typeof customer?.currencyCode === 'string' ? customer.currencyCode : null,
      timeZone: typeof customer?.timeZone === 'string' ? customer.timeZone : null,
    }]
  })
}

export function safeGoogleAdsError(error: unknown): { error: string; requestId?: string } {
  if (error instanceof GoogleAdsError) {
    return { error: error.message, ...(error.requestId ? { requestId: error.requestId } : {}) }
  }
  return { error: 'Google Ads request failed.' }
}
