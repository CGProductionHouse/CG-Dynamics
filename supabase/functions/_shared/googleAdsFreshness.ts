import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { fetchAllRows } from './paginatedRows.ts'
import { normalizeCustomerId, validGoogleAdsDate } from './google-ads-policy.ts'

export const GOOGLE_ADS_REFRESH_JOB_TYPE = 'google_ads_refresh'
export const GOOGLE_ADS_REFRESH_ENABLED_FLAG = 'GOOGLE_ADS_REFRESH_ENABLED'
const LOOKBACK_DAYS = 35
const MAX_ENQUEUES = 2
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Account = { id: string; customer_id: string; account_mode: string; time_zone: string }
type Link = { id: string; google_ads_account_id: string; client_id: string; campaign_id?: string }
type Run = { id: string; google_ads_account_id: string; status: string; period_start: string; period_end: string; updated_at: string; finished_at: string | null }

export type GoogleAdsRefreshPayload = {
  accountIds: [string]
  expectedCustomerId: string
  expectedTimeZone: string
  operatingDate: string
  startDate: string
  endDate: string
  clientId?: never
  mappingIds?: never
}

function localDate(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Never query an incomplete account-local day; re-read 35 days for delayed conversions. */
export function googleAdsRefreshWindow(timeZone: string, now = new Date()) {
  const today = localDate(now, timeZone)
  const end = new Date(`${today}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS + 1)
  return { operatingDate: localDate(now, 'Africa/Johannesburg'), startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) }
}

export function googleAdsRefreshKey(accountId: string, operatingDate: string) {
  return `google-ads-refresh:${accountId}:${operatingDate}`
}

export function googleAdsRefreshWorkerAuthorized(input: {
  serviceKey: string; bearer: string; workerToken: string; suppliedToken: string
}) {
  return input.serviceKey.length > 0 && input.bearer === `Bearer ${input.serviceKey}` &&
    input.workerToken.length >= 32 && input.suppliedToken === input.workerToken
}

export function validGoogleAdsRefreshPayload(value: unknown, now = new Date()): value is GoogleAdsRefreshPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  if (!Array.isArray(item.accountIds) || item.accountIds.length !== 1 || typeof item.accountIds[0] !== 'string' || !UUID.test(item.accountIds[0]) ||
      typeof item.expectedCustomerId !== 'string' || normalizeCustomerId(item.expectedCustomerId) !== item.expectedCustomerId || typeof item.expectedTimeZone !== 'string' ||
      !validGoogleAdsDate(item.operatingDate) || !validGoogleAdsDate(item.startDate) || !validGoogleAdsDate(item.endDate) ||
      item.clientId !== undefined || item.mappingIds !== undefined) return false
  try {
    const expected = googleAdsRefreshWindow(item.expectedTimeZone, now)
    return item.operatingDate === expected.operatingDate && item.startDate === expected.startDate && item.endDate === expected.endDate
  } catch { return false }
}

/** Existing queue and unique idempotency key provide cross-invocation deduplication. */
export async function ensureGoogleAdsFreshnessJobs(supabase: SupabaseClient, enabled: boolean, now = new Date()): Promise<Record<string, unknown>> {
  if (!enabled) return { state: 'disabled' }
  const operatingDate = localDate(now, 'Africa/Johannesburg')
  const cutoff = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  const results = await Promise.all([
    fetchAllRows<Account>((from, to) => supabase.from('google_ads_accounts').select('id,customer_id,account_mode,time_zone')
      .eq('is_active', true).in('account_mode', ['dedicated', 'shared']).order('id').range(from, to)),
    fetchAllRows<{ id: string }>((from, to) => supabase.from('clients').select('id').eq('active', true).order('id').range(from, to)),
    fetchAllRows<Link>((from, to) => supabase.from('google_ads_account_links').select('id,google_ads_account_id,client_id')
      .eq('is_active', true).order('id').range(from, to)),
    fetchAllRows<Link>((from, to) => supabase.from('google_ads_campaign_links').select('id,google_ads_account_id,client_id,campaign_id')
      .eq('is_active', true).order('id').range(from, to)),
    fetchAllRows<Run>((from, to) => supabase.from('google_ads_sync_runs')
      .select('id,google_ads_account_id,status,period_start,period_end,updated_at,finished_at')
      .gte('created_at', cutoff).order('id').range(from, to)),
    fetchAllRows<{ idempotency_key: string }>((from, to) => supabase.from('background_jobs').select('id,idempotency_key')
      .eq('job_type', GOOGLE_ADS_REFRESH_JOB_TYPE).gte('created_at', cutoff).order('id').range(from, to)),
  ])
  // A partial inventory must never admit work. Keep raw database errors out of job receipts.
  if (results.some(result => result.error)) return { state: 'unavailable', reason: 'Google Ads refresh inventory could not be read.' }
  const [accounts, clients, dedicated, campaigns, runs, jobs] = results
  const active = new Set(clients.data.map(client => client.id))
  const existing = new Set(jobs.data.map(job => job.idempotency_key))
  let enqueued = 0, fresh = 0, running = 0, held = 0
  for (const account of accounts.data) {
    const direct = dedicated.data.filter(link => link.google_ads_account_id === account.id)
    const shared = campaigns.data.filter(link => link.google_ads_account_id === account.id)
    const campaignOwners = new Map<string, string>()
    const validShared = shared.every(link => {
      if (!link.campaign_id || !/^\d+$/.test(link.campaign_id)) return false
      const previous = campaignOwners.get(link.campaign_id)
      campaignOwners.set(link.campaign_id, link.client_id)
      return !previous || previous === link.client_id
    })
    const mapped = account.account_mode === 'dedicated'
      ? direct.length === 1 && shared.length === 0 && active.has(direct[0].client_id)
      : direct.length === 0 && validShared && shared.some(link => active.has(link.client_id))
    if (!mapped || !UUID.test(account.id) || typeof account.customer_id !== 'string' ||
        normalizeCustomerId(account.customer_id) !== account.customer_id) { held++; continue }
    let window
    try { window = googleAdsRefreshWindow(account.time_zone, now) } catch { held++; continue }
    const key = googleAdsRefreshKey(account.id, operatingDate)
    if (existing.has(key)) continue
    const accountRuns = runs.data.filter(run => run.google_ads_account_id === account.id)
    if (accountRuns.some(run => ['queued', 'running'].includes(run.status) &&
        Date.parse(run.updated_at) > now.getTime() - 15 * 60_000)) { running++; continue }
    if (accountRuns.some(run => run.status === 'succeeded' && run.period_start <= window.startDate && run.period_end >= window.endDate &&
        run.finished_at && Date.parse(run.finished_at) >= now.getTime() - 12 * 3_600_000 && Date.parse(run.finished_at) <= now.getTime())) { fresh++; continue }
    if (enqueued >= MAX_ENQUEUES) continue
    const { error } = await supabase.from('background_jobs').upsert({
      job_type: GOOGLE_ADS_REFRESH_JOB_TYPE,
      payload: { accountIds: [account.id], expectedCustomerId: account.customer_id, expectedTimeZone: account.time_zone, ...window },
      idempotency_key: key,
      max_attempts: 3,
    }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    if (error) return { state: 'unavailable', reason: 'Google Ads refresh could not be queued.', operatingDate, enqueued }
    existing.add(key)
    enqueued++
  }
  return { state: 'ready', operatingDate, enqueued, fresh, running, held, maxEnqueuesPerPass: MAX_ENQUEUES }
}

/** HTTP success alone is insufficient: the exact account and range must complete. */
export async function runGoogleAdsRefreshJob(input: {
  payload: unknown; enabled: boolean; url: string; serviceKey: string; workerToken: string
}, fetcher: typeof fetch = fetch, now = new Date()): Promise<Record<string, unknown>> {
  if (!input.enabled) return { ok: true, state: 'disabled' }
  if (input.workerToken.length < 32) throw new Error('Google Ads refresh worker authentication is not configured.')
  if (!validGoogleAdsRefreshPayload(input.payload, now)) throw new Error('Google Ads refresh job identity or date window is no longer valid.')
  const payload = input.payload
  const response = await fetcher(`${input.url}/functions/v1/google-ads-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${input.serviceKey}`, 'X-Internal-Worker-Token': input.workerToken },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45_000),
  })
  const body = await response.json().catch(() => null)
  const exact = Array.isArray(body?.results) && body.results.length === 1 &&
    body.results[0]?.accountId === payload.accountIds[0] && body.results[0].status === 'success' &&
    body.results[0].customerId === payload.expectedCustomerId &&
    Number.isSafeInteger(body.results[0].rows) && body.results[0].rows >= 0
  if (!response.ok || body?.ok !== true || body.status !== 'success' || body.totalAccounts !== 1 || body.completedAccounts !== 1 ||
      body.failedAccounts !== 0 || body.skippedAccounts !== 0 || !exact || !Array.isArray(body.runIds) || body.runIds.length !== 1 ||
      typeof body.runIds[0] !== 'string' || !UUID.test(body.runIds[0]) ||
      body.period?.startDate !== payload.startDate || body.period?.endDate !== payload.endDate) {
    throw new Error(`Google Ads refresh did not complete for the requested account (HTTP ${response.status}).`)
  }
  return { ok: true, accountId: payload.accountIds[0], period: body.period, runIds: body.runIds, rows: body.results[0].rows }
}
