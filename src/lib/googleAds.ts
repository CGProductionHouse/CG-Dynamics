import { supabase } from './supabase'

const CURRENCY_CODE = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/

type JsonObject = Record<string, unknown>

export interface GoogleAdsConnectionStatus {
  configured: boolean
  connected: boolean
  message: string | null
  lastCheckedAt: string | null
}

export interface GoogleAdsAccount {
  customerId: string
  name: string
  currencyCode: string
  timeZone: string | null
  isManager: boolean
}

export interface GoogleAdsClientLink {
  id: string
  clientId: string
  customerId: string
  accountName: string
  currencyCode: string
  active: boolean
  lastSyncedAt: string | null
}

export interface GoogleAdsWorkspace {
  status: GoogleAdsConnectionStatus
  accounts: GoogleAdsAccount[]
  links: GoogleAdsClientLink[]
}

export interface GoogleAdsSyncRequest {
  startDate: string
  endDate: string
  clientId?: string
  mappingIds?: string[]
}

export interface GoogleAdsSyncItemResult {
  mappingId: string | null
  clientId: string | null
  customerId: string | null
  ok: boolean
  rowsWritten: number
  message: string
}

export interface GoogleAdsSyncResult {
  ok: boolean
  results: GoogleAdsSyncItemResult[]
}

export interface GoogleAdsCampaignRow {
  date: string | null
  customerId: string
  campaignId: string
  campaignName: string
  campaignStatus: string | null
  currencyCode: string
  spendMicros: number
  impressions: number
  clicks: number
  conversions: number
  conversionValue: number
}

export interface GoogleAdsCampaignSummary extends Omit<GoogleAdsCampaignRow, 'date'> {
  ctr: number | null
  averageCpcMicros: number | null
}

export interface GoogleAdsReportSummary {
  spendMicros: number | null
  impressions: number
  clicks: number
  ctr: number | null
  averageCpcMicros: number | null
  conversions: number
  conversionValue: number | null
  campaignCount: number
  currencyCode: string | null
  hasMixedCurrencies: boolean
  campaigns: GoogleAdsCampaignSummary[]
}

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, 500) : fallback
}

function nullableString(value: unknown): string | null {
  const parsed = string(value)
  return parsed || null
}

function boolean(value: unknown): boolean {
  return value === true
}

function number(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function integer(value: unknown): number {
  return Math.round(number(value))
}

function currency(value: unknown): string {
  const parsed = string(value).toUpperCase()
  return CURRENCY_CODE.test(parsed) ? parsed : 'XXX'
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function payload(value: unknown): JsonObject {
  const root = object(value) ?? {}
  return object(root.data) ?? root
}

function safeFunctionError(value: unknown, fallback: string): Error {
  const root = object(value)
  const message = string(root?.message) || string(root?.error)
  return new Error(message || fallback)
}

async function invoke(functionName: string, body: JsonObject = {}, allowPartial = false): Promise<JsonObject> {
  const { data, error } = await supabase.functions.invoke<unknown>(functionName, {
    body,
  })
  if (error) throw new Error(error.message || 'Google Ads request failed.')

  const root = object(data)
  if (!root) throw new Error('Google Ads returned an invalid response.')
  if (root.ok === false && !allowPartial) throw safeFunctionError(root, 'Google Ads request failed.')
  return payload(root)
}

function parseStatus(value: unknown): GoogleAdsConnectionStatus {
  const row = object(value) ?? {}
  return {
    configured: boolean(row.configured),
    connected: boolean(row.connected),
    message: nullableString(row.message),
    lastCheckedAt: nullableString(row.lastCheckedAt ?? row.last_checked_at),
  }
}

function parseAccount(value: unknown): GoogleAdsAccount | null {
  const row = object(value)
  if (!row) return null
  const customerId = string(row.customerId ?? row.customer_id)
  if (!customerId) return null
  return {
    customerId,
    name: string(row.name ?? row.descriptiveName ?? row.descriptive_name, 'Unnamed account'),
    currencyCode: currency(row.currencyCode ?? row.currency_code),
    timeZone: nullableString(row.timeZone ?? row.time_zone),
    isManager: boolean(row.isManager ?? row.is_manager ?? row.manager),
  }
}

function parseLink(value: unknown): GoogleAdsClientLink | null {
  const row = object(value)
  if (!row) return null
  const id = string(row.id)
  const clientId = string(row.clientId ?? row.client_id)
  const customerId = string(row.customerId ?? row.customer_id)
  if (!id || !clientId || !customerId) return null
  return {
    id,
    clientId,
    customerId,
    accountName: string(row.accountName ?? row.account_name ?? row.customer_name ?? row.descriptiveName, 'Unnamed account'),
    currencyCode: currency(row.currencyCode ?? row.currency_code),
    active: row.active === undefined && row.is_active === undefined
      ? true
      : boolean(row.active ?? row.is_active),
    lastSyncedAt: nullableString(row.lastSyncedAt ?? row.last_synced_at),
  }
}

export async function getGoogleAdsWorkspace(): Promise<GoogleAdsWorkspace> {
  const status = parseStatus(await invoke('google-ads-connection-status'))
  const [accounts, links] = await Promise.all([
    status.connected ? listGoogleAdsAccounts() : Promise.resolve([]),
    listGoogleAdsLinks(),
  ])
  return { status, accounts, links }
}

export async function testGoogleAdsConnection(): Promise<GoogleAdsConnectionStatus> {
  const status = parseStatus(await invoke('google-ads-connection-status'))
  if (status.connected) await listGoogleAdsAccounts()
  return status
}

async function listGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
  const result = await invoke('google-ads-list-accounts')
  return array(result.accounts)
    .map(parseAccount)
    .filter((account): account is GoogleAdsAccount => account !== null && !account.isManager)
}

async function listGoogleAdsLinks(): Promise<GoogleAdsClientLink[]> {
  const [linksResult, runsResult] = await Promise.all([
    supabase
      .from('google_ads_account_links')
      .select('id, client_id, customer_id, customer_name, currency_code, is_active')
      .order('created_at', { ascending: false }),
    supabase
      .from('google_ads_sync_runs')
      .select('account_link_id, finished_at')
      .eq('status', 'succeeded')
      .order('finished_at', { ascending: false }),
  ])
  if (linksResult.error) throw new Error(linksResult.error.message)
  if (runsResult.error) throw new Error(runsResult.error.message)
  const lastSync = new Map<string, string>()
  for (const run of runsResult.data ?? []) {
    if (typeof run.account_link_id === 'string' && typeof run.finished_at === 'string' && !lastSync.has(run.account_link_id)) {
      lastSync.set(run.account_link_id, run.finished_at)
    }
  }
  return (linksResult.data ?? []).map(row => parseLink({
    ...row,
    last_synced_at: typeof row.id === 'string' ? lastSync.get(row.id) : null,
  })).filter((link): link is GoogleAdsClientLink => link !== null)
}

export async function refreshGoogleAdsAccounts(): Promise<GoogleAdsWorkspace> {
  const [statusResult, accounts, links] = await Promise.all([
    invoke('google-ads-connection-status'),
    listGoogleAdsAccounts(),
    listGoogleAdsLinks(),
  ])
  return { status: parseStatus(statusResult), accounts, links }
}

export async function linkGoogleAdsAccount(input: { clientId: string; customerId: string }): Promise<void> {
  if (!input.clientId || !input.customerId) throw new Error('Select a client and Google Ads account.')
  await invoke('google-ads-link-account', {
    action: 'create',
    clientId: input.clientId,
    customerId: input.customerId,
  })
}

export async function deactivateGoogleAdsLink(linkId: string): Promise<void> {
  if (!linkId) throw new Error('A Google Ads link is required.')
  await invoke('google-ads-link-account', { action: 'deactivate', mappingId: linkId })
}

function assertDateRange(startDate: string, endDate: string): void {
  if (!DATE.test(startDate) || !DATE.test(endDate) || startDate > endDate) {
    throw new Error('Choose a valid date range.')
  }
}

export function monthDateRange(month: string): { startDate: string; endDate: string } {
  if (!MONTH.test(month)) throw new Error('Choose a valid month.')
  const [year, monthNumber] = month.split('-').map(Number)
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { startDate: `${month}-01`, endDate: `${month}-${String(endDay).padStart(2, '0')}` }
}

export async function syncGoogleAds(input: GoogleAdsSyncRequest): Promise<GoogleAdsSyncResult> {
  assertDateRange(input.startDate, input.endDate)
  const result = await invoke('google-ads-sync', {
    startDate: input.startDate,
    endDate: input.endDate,
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.mappingIds ? { mappingIds: input.mappingIds } : {}),
  }, true)
  const results = array(result.results).map(value => {
    const row = object(value) ?? {}
    return {
      mappingId: nullableString(row.mappingId ?? row.mapping_id),
      clientId: nullableString(row.clientId ?? row.client_id),
      customerId: nullableString(row.customerId ?? row.customer_id),
      ok: row.status === 'success' || row.ok === true,
      rowsWritten: integer(row.rowsWritten ?? row.rows_written ?? row.rows),
      message: string(row.message ?? row.error, row.status === 'failed' ? 'Sync failed.' : 'Sync completed.'),
    }
  })
  return { ok: result.ok !== false && results.every(item => item.ok), results }
}

function parseCampaign(value: unknown): GoogleAdsCampaignRow | null {
  const row = object(value)
  if (!row) return null
  const campaignId = string(row.campaignId ?? row.campaign_id)
  if (!campaignId) return null
  return {
    date: nullableString(row.date ?? row.metric_date),
    customerId: string(row.customerId ?? row.customer_id),
    campaignId,
    campaignName: string(row.campaignName ?? row.campaign_name, 'Unnamed campaign'),
    campaignStatus: nullableString(row.campaignStatus ?? row.campaign_status),
    currencyCode: currency(row.currencyCode ?? row.currency_code),
    spendMicros: number(row.spendMicros ?? row.spend_micros ?? row.costMicros ?? row.cost_micros),
    impressions: integer(row.impressions),
    clicks: integer(row.clicks),
    conversions: number(row.conversions),
    conversionValue: number(row.conversionValue ?? row.conversion_value ?? row.conversionsValue ?? row.conversions_value),
  }
}

export async function queryGoogleAdsReport(clientId: string, month: string): Promise<GoogleAdsCampaignRow[]> {
  if (!clientId) throw new Error('Select a client.')
  const { startDate, endDate } = monthDateRange(month)
  const { data, error } = await supabase
    .from('google_ads_campaign_daily_metrics')
    .select('customer_id, campaign_id, campaign_name, campaign_status, metric_date, impressions, clicks, cost_micros, conversions, conversion_value, google_ads_account_links!inner(currency_code)')
    .eq('client_id', clientId)
    .gte('metric_date', startDate)
    .lte('metric_date', endDate)
    .order('metric_date')
  if (error) throw new Error(error.message)
  return (data ?? []).map(row => {
    const relation = Array.isArray(row.google_ads_account_links)
      ? row.google_ads_account_links[0]
      : row.google_ads_account_links
    return parseCampaign({ ...row, currency_code: object(relation)?.currency_code })
  }).filter((row): row is GoogleAdsCampaignRow => row !== null)
}

export function calculateGoogleAdsReport(rows: GoogleAdsCampaignRow[]): GoogleAdsReportSummary {
  const campaigns = new Map<string, GoogleAdsCampaignSummary>()
  const currencyCodes = new Set(rows.map(row => row.currencyCode).filter(code => code !== 'XXX'))

  for (const row of rows) {
    const key = `${row.customerId}:${row.campaignId}:${row.currencyCode}`
    const current = campaigns.get(key)
    const next = current ?? {
      campaignId: row.campaignId,
      customerId: row.customerId,
      campaignName: row.campaignName,
      campaignStatus: row.campaignStatus,
      currencyCode: row.currencyCode,
      spendMicros: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
      ctr: null,
      averageCpcMicros: null,
    }
    next.spendMicros += row.spendMicros
    next.impressions += row.impressions
    next.clicks += row.clicks
    next.conversions += row.conversions
    next.conversionValue += row.conversionValue
    next.ctr = next.impressions > 0 ? next.clicks / next.impressions * 100 : null
    next.averageCpcMicros = next.clicks > 0 ? next.spendMicros / next.clicks : null
    campaigns.set(key, next)
  }

  const campaignRows = [...campaigns.values()].sort((a, b) => b.spendMicros - a.spendMicros)
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0)
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0)
  const hasMixedCurrencies = currencyCodes.size > 1
  const spendMicros = hasMixedCurrencies ? null : rows.reduce((sum, row) => sum + row.spendMicros, 0)
  const conversionValue = hasMixedCurrencies ? null : rows.reduce((sum, row) => sum + row.conversionValue, 0)

  return {
    spendMicros,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: spendMicros !== null && clicks > 0 ? spendMicros / clicks : null,
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    conversionValue,
    campaignCount: campaigns.size,
    currencyCode: currencyCodes.size === 1 ? [...currencyCodes][0] : null,
    hasMixedCurrencies,
    campaigns: campaignRows,
  }
}

export function formatGoogleAdsMoney(micros: number | null, currencyCode: string | null): string {
  if (micros === null || !currencyCode || !CURRENCY_CODE.test(currencyCode)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(micros / 1_000_000)
  } catch {
    return `${currencyCode} ${(micros / 1_000_000).toFixed(2)}`
  }
}

export function formatGoogleAdsCurrencyValue(value: number | null, currencyCode: string | null): string {
  if (value === null || !currencyCode || !CURRENCY_CODE.test(currencyCode)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(value)
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`
  }
}
