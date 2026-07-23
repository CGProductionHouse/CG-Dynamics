import { supabase } from './supabase'

const CURRENCY_CODE = /^[A-Z]{3}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
const HARMLESS_SUFFIXES = new Set(['pty', 'ltd', 'sa', 'group', 'marketing'])

type JsonObject = Record<string, unknown>

export type GoogleAdsAccountMode = 'shared' | 'dedicated'
export type GoogleAdsSuggestionConfidence = 'high' | 'medium' | 'low' | 'ambiguous'

export interface GoogleAdsAccount {
  id: string
  customerId: string
  name: string
  currencyCode: string
  timeZone: string | null
  mode: GoogleAdsAccountMode | null
}

export interface GoogleAdsCampaign {
  id: string
  accountId: string
  customerId: string
  campaignId: string
  name: string
  status: string
  channelType: string
}

export interface GoogleAdsAccountLink {
  id: string
  accountId: string
  clientId: string
  active: boolean
}

export interface GoogleAdsCampaignLink {
  id: string
  accountId: string
  campaignId: string
  clientId: string
  active: boolean
}

export interface GoogleAdsSyncRun {
  id: string
  accountId: string
  status: string
  rowsWritten: number
  finishedAt: string | null
}

export interface GoogleAdsWorkspace {
  accounts: GoogleAdsAccount[]
  accountLinks: GoogleAdsAccountLink[]
  campaignLinks: GoogleAdsCampaignLink[]
  runs: GoogleAdsSyncRun[]
}

export interface GoogleAdsClientName {
  id: string
  name: string
}

export interface GoogleAdsNameSuggestion {
  clientId: string | null
  clientName: string | null
  confidence: GoogleAdsSuggestionConfidence
  score: number
  preselected: boolean
  reason: string
}

export interface GoogleAdsCampaignReviewState {
  draftClientIds: Record<string, string>
  selectedCampaignIds: string[]
  suggestions: Record<string, GoogleAdsNameSuggestion>
}

export interface GoogleAdsCampaignMapping {
  accountId: string
  campaignId: string
  clientId: string
}

export interface GoogleAdsSyncRequest {
  accountIds: string[]
  startDate: string
  endDate: string
}

export interface GoogleAdsSyncItemResult {
  accountId: string | null
  ok: boolean
  mappedCampaigns: number
  unmappedCampaigns: number
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
  return string(value) || null
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
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

async function invoke(functionName: string, body: JsonObject = {}, allowPartial = false): Promise<JsonObject> {
  const { data, error } = await supabase.functions.invoke<unknown>(functionName, { body })
  if (error) throw new Error(error.message || 'Google Ads request failed.')
  const root = object(data)
  if (!root) throw new Error('Google Ads returned an invalid response.')
  if (root.ok === false && !allowPartial) {
    throw new Error(string(root.message ?? root.error, 'Google Ads request failed.'))
  }
  return payload(root)
}

function parseMode(value: unknown): GoogleAdsAccountMode | null {
  return value === 'shared' || value === 'dedicated' ? value : null
}

export function formatGoogleAdsCustomerId(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : value
}

function parseAccount(value: unknown): GoogleAdsAccount | null {
  const row = object(value)
  if (!row) return null
  const id = string(row.googleAdsAccountId ?? row.google_ads_account_id ?? row.id ?? row.accountId ?? row.account_id)
  const customerId = string(row.customerId ?? row.customer_id ?? row.customer)
  if (!id || !customerId) return null
  const providerName = string(row.name ?? row.descriptiveName ?? row.descriptive_name)
  const name = !providerName || providerName.toLowerCase() === 'unnamed account'
    ? `Shared Google Ads account · ${formatGoogleAdsCustomerId(customerId)}`
    : providerName
  return {
    id,
    customerId,
    name,
    currencyCode: currency(row.currencyCode ?? row.currency_code ?? row.currency),
    timeZone: nullableString(row.timeZone ?? row.time_zone ?? row.timezone),
    mode: parseMode(row.accountMode ?? row.account_mode ?? row.mode),
  }
}

function parseCampaign(value: unknown, account: GoogleAdsAccount): GoogleAdsCampaign | null {
  const row = object(value)
  if (!row) return null
  const campaignId = string(row.campaignId ?? row.campaign_id ?? row.id)
  if (!campaignId) return null
  return {
    id: string(row.id, `${account.id}:${campaignId}`),
    accountId: account.id,
    customerId: account.customerId,
    campaignId,
    name: string(row.name ?? row.campaignName ?? row.campaign_name, 'Unnamed campaign'),
    status: string(row.status ?? row.campaignStatus ?? row.campaign_status, 'UNKNOWN').toUpperCase(),
    channelType: string(row.channelType ?? row.channel_type ?? row.advertisingChannelType ?? row.advertising_channel_type, 'UNKNOWN').toUpperCase(),
  }
}

function parseAccountLink(value: unknown): GoogleAdsAccountLink | null {
  const row = object(value)
  if (!row) return null
  const id = string(row.id)
  const accountId = string(row.account_id ?? row.accountId ?? row.google_ads_account_id)
  const clientId = string(row.client_id ?? row.clientId)
  if (!id || !accountId || !clientId) return null
  return { id, accountId, clientId, active: boolean(row.is_active ?? row.active, true) }
}

function parseCampaignLink(value: unknown): GoogleAdsCampaignLink | null {
  const row = object(value)
  if (!row) return null
  const id = string(row.id)
  const accountId = string(row.account_id ?? row.accountId ?? row.google_ads_account_id)
  const campaignId = string(row.campaign_id ?? row.campaignId)
  const clientId = string(row.client_id ?? row.clientId)
  if (!id || !accountId || !campaignId || !clientId) return null
  return { id, accountId, campaignId, clientId, active: boolean(row.is_active ?? row.active, true) }
}

function parseRun(value: unknown): GoogleAdsSyncRun | null {
  const row = object(value)
  if (!row) return null
  const id = string(row.id)
  const accountId = string(row.account_id ?? row.accountId ?? row.google_ads_account_id)
  if (!id || !accountId) return null
  return {
    id,
    accountId,
    status: string(row.status, 'unknown'),
    rowsWritten: integer(row.rows_upserted ?? row.rows_written ?? row.rowsWritten),
    finishedAt: nullableString(row.finished_at ?? row.finishedAt),
  }
}

export function normalizeGoogleAdsName(value: string): string {
  const tokens = value
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  while (tokens.length > 0 && HARMLESS_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return tokens.join(' ')
}

function tokenScore(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean))
  const rightTokens = new Set(right.split(' ').filter(Boolean))
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0
  let shared = 0
  for (const token of leftTokens) if (rightTokens.has(token)) shared += 1
  return shared / Math.max(leftTokens.size, rightTokens.size)
}

export function suggestGoogleAdsClient(campaignName: string, clients: GoogleAdsClientName[]): GoogleAdsNameSuggestion {
  const normalizedCampaign = normalizeGoogleAdsName(campaignName)
  const candidates = clients
    .map(client => {
      const normalizedClient = normalizeGoogleAdsName(client.name)
      const score = normalizedCampaign && normalizedCampaign === normalizedClient
        ? 1
        : tokenScore(normalizedCampaign, normalizedClient)
      return { client, score }
    })
    .filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.client.name.localeCompare(right.client.name))
  const best = candidates[0]
  if (!best) {
    return { clientId: null, clientName: null, confidence: 'low', score: 0, preselected: false, reason: 'No client name overlap' }
  }
  const tied = candidates.filter(candidate => candidate.score === best.score)
  if (tied.length > 1) {
    return { clientId: null, clientName: null, confidence: 'ambiguous', score: best.score, preselected: false, reason: `Matches ${tied.length} clients` }
  }
  const confidence: GoogleAdsSuggestionConfidence = best.score === 1 ? 'high' : best.score >= 0.6 ? 'medium' : 'low'
  return {
    clientId: best.client.id,
    clientName: best.client.name,
    confidence,
    score: best.score,
    preselected: confidence === 'high',
    reason: confidence === 'high' ? 'Exact normalized name' : 'Partial name overlap',
  }
}

export function deriveGoogleAdsCampaignReview(
  campaigns: GoogleAdsCampaign[],
  clients: GoogleAdsClientName[],
  campaignLinks: GoogleAdsCampaignLink[],
): GoogleAdsCampaignReviewState {
  const draftClientIds: Record<string, string> = {}
  const selectedCampaignIds: string[] = []
  const suggestions: Record<string, GoogleAdsNameSuggestion> = {}
  for (const campaign of campaigns) {
    const existing = campaignLinks.find(link =>
      link.active && link.accountId === campaign.accountId && link.campaignId === campaign.campaignId
    )
    const suggestion = suggestGoogleAdsClient(campaign.name, clients)
    suggestions[campaign.campaignId] = suggestion
    draftClientIds[campaign.campaignId] = existing?.clientId ?? (suggestion.preselected ? suggestion.clientId ?? '' : '')
    if (!existing && suggestion.preselected) selectedCampaignIds.push(campaign.campaignId)
  }
  return { draftClientIds, selectedCampaignIds, suggestions }
}

export function isGoogleAdsAccountReady(
  account: Pick<GoogleAdsAccount, 'id' | 'mode'>,
  accountLinks: Pick<GoogleAdsAccountLink, 'accountId' | 'active'>[],
  campaignLinks: Pick<GoogleAdsCampaignLink, 'accountId' | 'active'>[],
): boolean {
  if (account.mode === 'dedicated') return accountLinks.some(link => link.active && link.accountId === account.id)
  if (account.mode === 'shared') return campaignLinks.some(link => link.active && link.accountId === account.id)
  return false
}

export function validateGoogleAdsCampaignMappings(mappings: GoogleAdsCampaignMapping[]): string | null {
  const owners = new Map<string, string>()
  for (const mapping of mappings) {
    if (!mapping.accountId || !mapping.campaignId || !mapping.clientId) return 'Every selected campaign requires an account, campaign, and client.'
    const key = `${mapping.accountId}\u0000${mapping.campaignId}`
    const existingClientId = owners.get(key)
    if (existingClientId && existingClientId !== mapping.clientId) return 'A campaign cannot be mapped to more than one client.'
    owners.set(key, mapping.clientId)
  }
  return null
}

export function validateGoogleAdsModeCoexistence(
  mode: GoogleAdsAccountMode,
  dedicatedLinks: Pick<GoogleAdsAccountLink, 'active'>[],
  campaignLinks: Pick<GoogleAdsCampaignLink, 'active'>[],
): string | null {
  const hasDedicated = dedicatedLinks.some(link => link.active)
  const hasCampaigns = campaignLinks.some(link => link.active)
  if (mode === 'shared' && hasDedicated) return 'Deactivate the dedicated client link before using shared mode.'
  if (mode === 'dedicated' && hasCampaigns) return 'Deactivate campaign mappings before using dedicated mode.'
  return null
}

export async function listGoogleAdsAccounts(): Promise<GoogleAdsAccount[]> {
  const result = await invoke('google-ads-list-accounts')
  return array(result.accounts).map(parseAccount).filter((account): account is GoogleAdsAccount => account !== null)
}

export async function listGoogleAdsCampaigns(account: GoogleAdsAccount): Promise<GoogleAdsCampaign[]> {
  const result = await invoke('google-ads-list-campaigns', { customerId: account.customerId })
  return array(result.campaigns).map(value => parseCampaign(value, account)).filter((campaign): campaign is GoogleAdsCampaign => campaign !== null)
}

export async function getGoogleAdsWorkspace(): Promise<GoogleAdsWorkspace> {
  const [accounts, accountLinksResult, campaignLinksResult, runsResult] = await Promise.all([
    listGoogleAdsAccounts(),
    supabase.from('google_ads_account_links').select('*').order('created_at', { ascending: false }),
    supabase.from('google_ads_campaign_links').select('*').order('created_at', { ascending: false }),
    supabase.from('google_ads_sync_runs').select('*').order('created_at', { ascending: false }).limit(100),
  ])
  if (accountLinksResult.error) throw new Error(accountLinksResult.error.message)
  if (campaignLinksResult.error) throw new Error(campaignLinksResult.error.message)
  if (runsResult.error) throw new Error(runsResult.error.message)
  return {
    accounts,
    accountLinks: (accountLinksResult.data ?? []).map(parseAccountLink).filter((link): link is GoogleAdsAccountLink => link !== null),
    campaignLinks: (campaignLinksResult.data ?? []).map(parseCampaignLink).filter((link): link is GoogleAdsCampaignLink => link !== null),
    runs: (runsResult.data ?? []).map(parseRun).filter((run): run is GoogleAdsSyncRun => run !== null),
  }
}

export async function setGoogleAdsAccountMode(accountId: string, mode: GoogleAdsAccountMode, confirmModeChange: boolean): Promise<void> {
  if (!accountId) throw new Error('A Google Ads account is required.')
  await invoke('google-ads-link-account', { action: 'set_mode', googleAdsAccountId: accountId, accountMode: mode, confirmModeChange })
}

export async function saveGoogleAdsDedicatedLink(accountId: string, clientId: string): Promise<void> {
  if (!accountId || !clientId) throw new Error('Select a Google Ads account and client.')
  await invoke('google-ads-link-account', { action: 'save_dedicated', googleAdsAccountId: accountId, clientId })
}

export async function deactivateGoogleAdsDedicatedLink(accountId: string, linkId: string): Promise<void> {
  if (!accountId || !linkId) throw new Error('A dedicated link is required.')
  await invoke('google-ads-link-account', { action: 'deactivate_dedicated', googleAdsAccountId: accountId, mappingId: linkId })
}

export async function saveGoogleAdsCampaignMappings(accountId: string, mappings: GoogleAdsCampaignMapping[]): Promise<void> {
  const error = validateGoogleAdsCampaignMappings(mappings)
  if (error) throw new Error(error)
  if (!accountId || mappings.length === 0 || mappings.some(mapping => mapping.accountId !== accountId)) {
    throw new Error('Select at least one campaign from the same account.')
  }
  await invoke('google-ads-link-account', {
    action: 'save_campaigns',
    googleAdsAccountId: accountId,
    campaigns: mappings.map(mapping => ({ campaignId: mapping.campaignId, clientId: mapping.clientId })),
  })
}

export async function deactivateGoogleAdsCampaignLink(accountId: string, linkId: string): Promise<void> {
  if (!accountId || !linkId) throw new Error('A campaign mapping is required.')
  await invoke('google-ads-link-account', { action: 'deactivate_campaign', googleAdsAccountId: accountId, campaignLinkId: linkId })
}

function assertDateRange(startDate: string, endDate: string): void {
  if (!DATE.test(startDate) || !DATE.test(endDate) || startDate > endDate) throw new Error('Choose a valid date range.')
}

export function monthDateRange(month: string): { startDate: string; endDate: string } {
  if (!MONTH.test(month)) throw new Error('Choose a valid month.')
  const [year, monthNumber] = month.split('-').map(Number)
  const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return { startDate: `${month}-01`, endDate: `${month}-${String(endDay).padStart(2, '0')}` }
}

export async function syncGoogleAds(input: GoogleAdsSyncRequest): Promise<GoogleAdsSyncResult> {
  assertDateRange(input.startDate, input.endDate)
  const accountIds = [...new Set(input.accountIds.filter(Boolean))]
  if (accountIds.length === 0) throw new Error('Select at least one account to sync.')
  if (accountIds.length > 10) throw new Error('Select no more than 10 accounts per sync.')
  const result = await invoke('google-ads-sync', { accountIds, startDate: input.startDate, endDate: input.endDate }, true)
  const results = array(result.results).map(value => {
    const row = object(value) ?? {}
    return {
      accountId: nullableString(row.googleAdsAccountId ?? row.google_ads_account_id ?? row.accountId ?? row.account_id),
      ok: row.status === 'success' || row.ok === true,
      mappedCampaigns: integer(row.mappedCampaigns ?? row.mapped_campaigns),
      unmappedCampaigns: integer(row.unmappedCampaigns ?? row.unmapped_campaigns),
      rowsWritten: integer(row.rowsWritten ?? row.rows_written ?? row.rows),
      message: string(row.message ?? row.error, row.status === 'failed' ? 'Sync failed.' : 'Sync completed.'),
    }
  })
  return { ok: result.ok !== false && results.every(item => item.ok), results }
}

function parseReportCampaign(value: unknown): GoogleAdsCampaignRow | null {
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
  const { data, error } = await supabase.rpc('get_google_ads_client_campaign_metrics', {
    p_client_id: clientId,
    p_period_start: startDate,
    p_period_end: endDate,
  })
  if (error) throw new Error(error.message)
  return array(data).map(parseReportCampaign).filter((row): row is GoogleAdsCampaignRow => row !== null)
}

export function calculateGoogleAdsReport(rows: GoogleAdsCampaignRow[]): GoogleAdsReportSummary {
  const campaigns = new Map<string, GoogleAdsCampaignSummary>()
  const currencyCodes = new Set(rows.map(row => row.currencyCode).filter(code => code !== 'XXX'))
  for (const row of rows) {
    const key = `${row.customerId}:${row.campaignId}:${row.currencyCode}`
    const next = campaigns.get(key) ?? { ...row, spendMicros: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, ctr: null, averageCpcMicros: null }
    next.spendMicros += row.spendMicros
    next.impressions += row.impressions
    next.clicks += row.clicks
    next.conversions += row.conversions
    next.conversionValue += row.conversionValue
    next.ctr = next.impressions > 0 ? next.clicks / next.impressions * 100 : null
    next.averageCpcMicros = next.clicks > 0 ? next.spendMicros / next.clicks : null
    campaigns.set(key, next)
  }
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0)
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0)
  const hasMixedCurrencies = currencyCodes.size > 1
  const spendMicros = hasMixedCurrencies ? null : rows.reduce((sum, row) => sum + row.spendMicros, 0)
  return {
    spendMicros,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: spendMicros !== null && clicks > 0 ? spendMicros / clicks : null,
    conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
    conversionValue: hasMixedCurrencies ? null : rows.reduce((sum, row) => sum + row.conversionValue, 0),
    campaignCount: campaigns.size,
    currencyCode: currencyCodes.size === 1 ? [...currencyCodes][0] : null,
    hasMixedCurrencies,
    campaigns: [...campaigns.values()].sort((left, right) => right.spendMicros - left.spendMicros),
  }
}

export function formatGoogleAdsMoney(micros: number | null, currencyCode: string | null): string {
  if (micros === null || !currencyCode || !CURRENCY_CODE.test(currencyCode)) return '-'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(micros / 1_000_000)
  } catch {
    return `${currencyCode} ${(micros / 1_000_000).toFixed(2)}`
  }
}

export function formatGoogleAdsCurrencyValue(value: number | null, currencyCode: string | null): string {
  if (value === null || !currencyCode || !CURRENCY_CODE.test(currencyCode)) return '-'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(value)
  } catch {
    return `${currencyCode} ${value.toFixed(2)}`
  }
}
