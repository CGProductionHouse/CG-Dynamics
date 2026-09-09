import { calendarMonthBounds } from './reportPeriod'
import { supabase } from './supabase'

export type GoogleAdsDashboardState =
  | 'disconnected'
  | 'unmapped'
  | 'not-synced'
  | 'no-activity'
  | 'data'
  | 'error'

export interface GoogleAdsNativeSettings {
  apiVersion: string | null
  observedAt: string | null
  primaryStatus: string | null
  primaryStatusReasons: string[]
  startDate: string | null
  endDate: string | null
  biddingStrategyType: string | null
  budgetAmountMicros: number | null
  budgetTotalAmountMicros: number | null
  budgetPeriod: string | null
  budgetShared: boolean | null
  budgetReferenceCount: number | null
  budgetDeliveryMethod: string | null
  budgetStatus: string | null
  budgetType: string | null
}

export interface GoogleAdsReportCampaign {
  campaignId: string
  timeZone: string | null
  nativeSettings: GoogleAdsNativeSettings | null
  firstActivity: string | null
  lastActivity: string | null
  name: string
  status: string | null
  type: string | null
  campaignName: string
  campaignStatus: string | null
  campaignType: string | null
  currencyCode: string | null
  spendMicros: number
  impressions: number
  clicks: number
  interactions: number | null
  ctr: number | null
  averageCpcMicros: number | null
  conversions: number
  conversionRate: number | null
  costPerConversionMicros: number | null
  conversionValue: number
}

export interface GoogleAdsSevenDayWindow {
  startDate: string
  endDate: string
  spendMicros: number
  impressions: number
  clicks: number
  conversions: number
}

export interface GoogleAdsSevenDayTrend {
  current: GoogleAdsSevenDayWindow
  previous: GoogleAdsSevenDayWindow
}

export interface GoogleAdsReportSummary {
  month: string
  periodStart: string
  periodEnd: string
  timeZone: string | null
  hasMixedTimeZones: boolean
  lastSyncedAt: string | null
  dataThroughDate: string | null
  monthlyTargetMicros: number | null
  targetCurrencyCode: string | null
  spendToTargetPercent: number | null
  daysRemaining: number | null
  projectedMonthEndSpendMicros: number | null
  sevenDayTrend: GoogleAdsSevenDayTrend | null
  spendMicros: number | null
  impressions: number
  clicks: number
  interactions: number | null
  ctr: number | null
  averageCpcMicros: number | null
  conversions: number
  conversionRate: number | null
  costPerConversionMicros: number | null
  conversionValue: number | null
  campaignCount: number
  currencyCode: string | null
  hasMixedCurrencies: boolean
  campaigns: GoogleAdsReportCampaign[]
}

export type GoogleAdsDashboardData = GoogleAdsReportSummary

export const GOOGLE_ADS_DASHBOARD_STATES: GoogleAdsDashboardState[] = [
  'disconnected', 'unmapped', 'not-synced', 'no-activity', 'data', 'error',
]

export function formatGoogleAdsSpend(
  dashboard: GoogleAdsDashboardData,
): string {
  if (dashboard.spendMicros === null || !dashboard.currencyCode || dashboard.hasMixedCurrencies) {
    return 'Unavailable'
  }
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: dashboard.currencyCode,
    maximumFractionDigits: 2,
  }).format(dashboard.spendMicros / 1_000_000)
}

export function formatGoogleAdsCTR(ctr: number | null): string {
  return ctr === null ? 'Unavailable' : `${ctr.toFixed(2)}%`
}

export function googleAdsCampaignPeriodLabel(campaign: GoogleAdsReportCampaign, month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const period = Number.isFinite(year) && Number.isFinite(monthNumber)
    ? new Date(year, monthNumber - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    : 'reporting period'
  const hadActivity = campaign.spendMicros > 0 || campaign.impressions > 0 || campaign.clicks > 0 || campaign.conversions > 0
  return hadActivity ? `Active during ${period}` : `No activity in ${period}`
}

export interface GoogleAdsDashboardResult {
  data: GoogleAdsDashboardData | null
  state: GoogleAdsDashboardState
  error: string | null
}

type UnknownRecord = Record<string, unknown>

const MONTH = /^\d{4}-\d{2}$/
const CURRENCY = /^[A-Z]{3}$/
const LOAD_ERROR = 'Google Ads data could not be loaded.'

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const wrapper = record(value)
  return wrapper && Array.isArray(wrapper.data) ? wrapper.data : []
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null
}

function nonNegativeNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export interface GoogleAdsWeeklyReportData {
  provider: 'google_ads'
  timeZone: string | null
  currencyCode: string | null
  dataThroughDate: string
  lastSyncedAt: string | null
  monthlyTargetMicros: number | null
  projectedMonthEndSpendMicros: number | null
  current: GoogleAdsSevenDayWindow
  previous: GoogleAdsSevenDayWindow
}

/** Serializable, canonical payload for a future scheduled weekly-report sender. */
export function buildGoogleAdsWeeklyReportData(dashboard: GoogleAdsDashboardData): GoogleAdsWeeklyReportData | null {
  if (!dashboard.dataThroughDate || !dashboard.sevenDayTrend) return null
  return {
    provider: 'google_ads',
    timeZone: dashboard.timeZone,
    currencyCode: dashboard.currencyCode,
    dataThroughDate: dashboard.dataThroughDate,
    lastSyncedAt: dashboard.lastSyncedAt,
    monthlyTargetMicros: dashboard.monthlyTargetMicros,
    projectedMonthEndSpendMicros: dashboard.projectedMonthEndSpendMicros,
    current: dashboard.sevenDayTrend.current,
    previous: dashboard.sevenDayTrend.previous,
  }
}

function optionalNonNegativeNumber(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : nonNegativeNumber(value)
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((item): item is string => item !== null)
    : []
}

function parseNativeSettings(value: unknown): GoogleAdsNativeSettings | null {
  const settings = record(value)
  if (!settings) return null
  const rawBudgetShared = settings.budget_shared ?? settings.budgetShared
  return {
    apiVersion: text(settings.api_version ?? settings.apiVersion),
    observedAt: text(settings.observed_at ?? settings.observedAt),
    primaryStatus: text(settings.primary_status ?? settings.primaryStatus),
    primaryStatusReasons: textArray(settings.primary_status_reasons ?? settings.primaryStatusReasons),
    startDate: text(settings.start_date ?? settings.startDate),
    endDate: text(settings.end_date ?? settings.endDate),
    biddingStrategyType: text(settings.bidding_strategy_type ?? settings.biddingStrategyType),
    budgetAmountMicros: optionalNonNegativeNumber(settings.budget_amount_micros ?? settings.budgetAmountMicros),
    budgetTotalAmountMicros: optionalNonNegativeNumber(settings.budget_total_amount_micros ?? settings.budgetTotalAmountMicros),
    budgetPeriod: text(settings.budget_period ?? settings.budgetPeriod),
    budgetShared: typeof rawBudgetShared === 'boolean' ? rawBudgetShared : null,
    budgetReferenceCount: optionalNonNegativeNumber(settings.budget_reference_count ?? settings.budgetReferenceCount),
    budgetDeliveryMethod: text(settings.budget_delivery_method ?? settings.budgetDeliveryMethod),
    budgetStatus: text(settings.budget_status ?? settings.budgetStatus),
    budgetType: text(settings.budget_type ?? settings.budgetType),
  }
}

function parseSevenDayWindow(value: unknown): GoogleAdsSevenDayWindow | null {
  const window = record(value)
  if (!window) return null
  const startDate = text(window.start_date ?? window.startDate)
  const endDate = text(window.end_date ?? window.endDate)
  const spendMicros = nonNegativeNumber(window.spend_micros ?? window.spendMicros)
  const impressions = nonNegativeNumber(window.impressions)
  const clicks = nonNegativeNumber(window.clicks)
  const conversions = nonNegativeNumber(window.conversions)
  if (!startDate || !endDate || spendMicros === null || impressions === null || clicks === null || conversions === null) return null
  return { startDate, endDate, spendMicros, impressions, clicks, conversions }
}

function parseSevenDayTrend(row: UnknownRecord): GoogleAdsSevenDayTrend | null {
  const current = parseSevenDayWindow(row.current_7d ?? row.current7d)
  const previous = parseSevenDayWindow(row.previous_7d ?? row.previous7d)
  return current && previous ? { current, previous } : null
}

type ParsedCampaign = GoogleAdsReportCampaign

function parseCampaign(value: unknown): ParsedCampaign | null {
  const row = record(value)
  if (!row) return null
  const name = text(row.campaign_name ?? row.campaignName)
  if (!name) return null
  // Fail closed on incomplete metrics; an absent API/RPC field is not zero.
  const impressionsValue = nonNegativeNumber(row.impressions)
  const clicksValue = nonNegativeNumber(row.clicks)
  const conversions = nonNegativeNumber(row.conversions)
  const conversionValue = nonNegativeNumber(row.value ?? row.conversion_value ?? row.conversionValue)
  const rawSpend = nonNegativeNumber(row.cost ?? row.cost_micros ?? row.spend_micros ?? row.spendMicros)
  if (impressionsValue === null || clicksValue === null || conversions === null || conversionValue === null || rawSpend === null) return null
  const interactionsRaw = row.interactions
  const interactions = optionalNonNegativeNumber(interactionsRaw)
  if (interactionsRaw !== null && interactionsRaw !== undefined && interactionsRaw !== '' && interactions === null) return null
  const rawCurrency = text(row.currency ?? row.currency_code ?? row.currencyCode)?.toUpperCase() ?? null
  const spendMicros = row.cost !== undefined ? rawSpend * 1_000_000 : rawSpend
  const impressions = Math.round(impressionsValue)
  const clicks = Math.round(clicksValue)
  const status = text(row.campaign_status ?? row.campaignStatus)
  const type = text(row.campaign_type ?? row.campaignType)
  return {
    campaignId: text(row.campaign_id ?? row.campaignId) ?? name,
    timeZone: text(row.time_zone ?? row.timeZone),
    nativeSettings: parseNativeSettings(row.native_settings ?? row.nativeSettings),
    firstActivity: text(row.first_activity),
    lastActivity: text(row.last_activity),
    name,
    status,
    type,
    campaignName: name,
    campaignStatus: status,
    campaignType: type,
    currencyCode: rawCurrency && CURRENCY.test(rawCurrency) ? rawCurrency : null,
    spendMicros,
    impressions,
    clicks,
    interactions: interactions === null ? null : Math.round(interactions),
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: clicks > 0 ? spendMicros / clicks : null,
    conversions,
    conversionRate: interactions !== null && interactions > 0 ? conversions / interactions * 100 : null,
    costPerConversionMicros: conversions > 0 ? spendMicros / conversions : null,
    conversionValue,
  }
}

type GoogleAdsStatusSnapshot = {
  state: Exclude<GoogleAdsDashboardState, 'no-activity' | 'data' | 'error'> | null
  lastSyncedAt: string | null
}

function parseStatus(value: unknown): GoogleAdsStatusSnapshot {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw === 'string') return { state: normalizeStatus(raw), lastSyncedAt: null }
  const status = record(raw)
  if (!status) return { state: null, lastSyncedAt: null }

  const lastSyncedAt = text(status.last_successful_sync ?? status.lastSuccessfulSync ?? status.last_synced_at)

  if (status.connected === false || status.is_connected === false) return { state: 'disconnected', lastSyncedAt }
  if (status.mapped === false || status.is_mapped === false || status.has_mapping === false) return { state: 'unmapped', lastSyncedAt }
  if (status.synced === false || status.is_synced === false || status.has_synced === false || status.has_successful_sync === false) return { state: 'not-synced', lastSyncedAt }
  return { state: normalizeStatus(text(status.state ?? status.status) ?? ''), lastSyncedAt }
}

function normalizeStatus(value: string): Exclude<GoogleAdsDashboardState, 'no-activity' | 'data' | 'error'> | null {
  const status = value.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  if (status === 'disconnected' || status === 'unmapped' || status === 'not-synced') return status
  return null
}

function summarize(
  month: string,
  periodStart: string,
  periodEnd: string,
  parsedCampaigns: ParsedCampaign[],
  lastSyncedAt: string | null,
  projection: UnknownRecord | null,
): GoogleAdsDashboardData {
  const campaigns = [...parsedCampaigns].sort((left, right) => right.spendMicros - left.spendMicros)
  const currencies = new Set(campaigns.map(campaign => campaign.currencyCode).filter((code): code is string => code !== null))
  const hasMixedCurrencies = currencies.size > 1 || campaigns.some(campaign => campaign.currencyCode === null)
  const timeZones = new Set(campaigns.map(campaign => campaign.timeZone).filter((zone): zone is string => zone !== null))
  const hasMixedTimeZones = timeZones.size > 1 || campaigns.some(campaign => campaign.timeZone === null)
  const impressions = campaigns.reduce((total, campaign) => total + campaign.impressions, 0)
  const clicks = campaigns.reduce((total, campaign) => total + campaign.clicks, 0)
  const interactions = campaigns.every(campaign => campaign.interactions !== null)
    ? campaigns.reduce((total, campaign) => total + (campaign.interactions ?? 0), 0)
    : null
  const spendMicros = hasMixedCurrencies ? null : campaigns.reduce((total, campaign) => total + campaign.spendMicros, 0)
  const conversions = campaigns.reduce((total, campaign) => total + campaign.conversions, 0)
  const dataThroughDate = campaigns
    .map(campaign => campaign.lastActivity)
    .filter((date): date is string => date !== null)
    .sort()
    .at(-1) ?? null
  const targetMicros = optionalNonNegativeNumber(projection?.monthly_target_micros ?? projection?.monthlyTargetMicros)
  const targetCurrencyRaw = text(projection?.target_currency ?? projection?.targetCurrencyCode)?.toUpperCase() ?? null
  const targetCurrencyCode = targetCurrencyRaw && CURRENCY.test(targetCurrencyRaw) ? targetCurrencyRaw : null
  const explicitDataThrough = text(projection?.data_through_date ?? projection?.dataThroughDate)
  const effectiveDataThrough = explicitDataThrough ?? dataThroughDate
  const periodStartTime = Date.parse(`${periodStart}T00:00:00Z`)
  const periodEndTime = Date.parse(`${periodEnd}T00:00:00Z`)
  const throughTime = effectiveDataThrough ? Date.parse(`${effectiveDataThrough}T00:00:00Z`) : Number.NaN
  const totalDays = Math.round((periodEndTime - periodStartTime) / 86_400_000) + 1
  const elapsedDays = Number.isFinite(throughTime)
    ? Math.min(totalDays, Math.max(0, Math.round((throughTime - periodStartTime) / 86_400_000) + 1))
    : 0
  const daysRemaining = effectiveDataThrough ? Math.max(0, totalDays - elapsedDays) : null
  const projectedMonthEndSpendMicros = spendMicros !== null && elapsedDays > 0
    ? daysRemaining === 0 ? spendMicros : spendMicros / elapsedDays * totalDays
    : null
  const sevenDayTrend = projection ? parseSevenDayTrend(projection) : null
  return {
    month,
    periodStart,
    periodEnd,
    timeZone: timeZones.size === 1 ? [...timeZones][0] : null,
    hasMixedTimeZones,
    lastSyncedAt,
    dataThroughDate: effectiveDataThrough,
    monthlyTargetMicros: targetMicros,
    targetCurrencyCode,
    spendToTargetPercent: spendMicros !== null && targetMicros !== null && targetMicros > 0 && currencyCodeMatches(currencies, targetCurrencyCode)
      ? spendMicros / targetMicros * 100
      : null,
    daysRemaining,
    projectedMonthEndSpendMicros,
    sevenDayTrend,
    spendMicros,
    impressions,
    clicks,
    interactions,
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: spendMicros !== null && clicks > 0 ? spendMicros / clicks : null,
    conversions,
    conversionRate: interactions !== null && interactions > 0 ? conversions / interactions * 100 : null,
    costPerConversionMicros: spendMicros !== null && conversions > 0 ? spendMicros / conversions : null,
    // Google Ads conversion value follows conversion-action configuration. It is
    // not account currency by default, so currency mixing does not null the sum.
    conversionValue: campaigns.reduce((total, campaign) => total + campaign.conversionValue, 0),
    campaignCount: campaigns.length,
    currencyCode: currencies.size === 1 ? [...currencies][0] : null,
    hasMixedCurrencies,
    campaigns,
  }
}

export function parseGoogleAdsDashboardData(
  month: string,
  value: unknown,
  lastSyncedAt: string | null = null,
): GoogleAdsDashboardData | null {
  if (!MONTH.test(month)) return null
  const metricRows = rows(value)
  if (metricRows.length === 0) return null
  const campaigns = metricRows.map(parseCampaign).filter((campaign): campaign is ParsedCampaign => campaign !== null)
  if (metricRows.length !== campaigns.length) return null
  const { start, end } = calendarMonthBounds(month)
  return summarize(month, start, end, campaigns, lastSyncedAt, record(metricRows[0]))
}

function currencyCodeMatches(currencies: Set<string>, targetCurrency: string | null): boolean {
  return currencies.size === 1 && targetCurrency !== null && currencies.has(targetCurrency)
}

export async function loadGoogleAdsDashboard(reportId: string, month: string): Promise<GoogleAdsDashboardResult> {
  if (!reportId || !MONTH.test(month)) {
    return { data: null, state: 'error', error: LOAD_ERROR }
  }

  const { start, end } = calendarMonthBounds(month)
  try {
    const args = { p_report_id: reportId, p_period_start: start, p_period_end: end }
    const [metricsResult, statusResult] = await Promise.all([
      supabase.rpc('get_google_ads_dashboard_campaign_metrics_v2', args).then(async result => {
        // Safe staged rollout: legacy projection remains exact-client scoped.
        if (result.error?.code === 'PGRST202') return supabase.rpc('get_google_ads_dashboard_campaign_metrics', args)
        return result
      }),
      supabase.rpc('get_google_ads_dashboard_status_v2', args).then(async result => {
        if (result.error?.code === 'PGRST202') return supabase.rpc('get_google_ads_dashboard_status', args)
        return result
      }),
    ])
    if (metricsResult.error || statusResult.error) {
      return { data: null, state: 'error', error: LOAD_ERROR }
    }

    const status = parseStatus(statusResult.data)
    if (status.state) return { data: null, state: status.state, error: null }

    const metricRows = rows(metricsResult.data)
    if (metricRows.length === 0) return { data: null, state: 'no-activity', error: null }
    const data = parseGoogleAdsDashboardData(month, metricRows, status.lastSyncedAt)
    if (!data) return { data: null, state: 'error', error: LOAD_ERROR }
    return { data, state: 'data', error: null }
  } catch {
    return { data: null, state: 'error', error: LOAD_ERROR }
  }
}
