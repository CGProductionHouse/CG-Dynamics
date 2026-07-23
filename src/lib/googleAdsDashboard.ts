import { calendarMonthBounds } from './reportPeriod'
import { supabase } from './supabase'

export type GoogleAdsDashboardState =
  | 'disconnected'
  | 'unmapped'
  | 'not-synced'
  | 'no-activity'
  | 'data'
  | 'error'

export interface GoogleAdsReportCampaign {
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
  ctr: number | null
  averageCpcMicros: number | null
  conversions: number
  conversionValue: number
}

export interface GoogleAdsReportSummary {
  month: string
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
  campaigns: GoogleAdsReportCampaign[]
}

export type GoogleAdsDashboardData = GoogleAdsReportSummary

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

function nonNegativeNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

type ParsedCampaign = GoogleAdsReportCampaign

function parseCampaign(value: unknown): ParsedCampaign | null {
  const row = record(value)
  if (!row) return null
  const name = text(row.campaign_name ?? row.campaignName)
  if (!name) return null
  const rawCurrency = text(row.currency ?? row.currency_code ?? row.currencyCode)?.toUpperCase() ?? null
  const spendMicros = row.cost !== undefined
    ? nonNegativeNumber(row.cost) * 1_000_000
    : nonNegativeNumber(row.cost_micros ?? row.spend_micros ?? row.spendMicros)
  const impressions = Math.round(nonNegativeNumber(row.impressions))
  const clicks = Math.round(nonNegativeNumber(row.clicks))
  const status = text(row.campaign_status ?? row.campaignStatus)
  const type = text(row.campaign_type ?? row.campaignType)
  return {
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
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: clicks > 0 ? spendMicros / clicks : null,
    conversions: nonNegativeNumber(row.conversions),
    conversionValue: nonNegativeNumber(row.value ?? row.conversion_value ?? row.conversionValue),
  }
}

function parseStatus(value: unknown): Exclude<GoogleAdsDashboardState, 'no-activity' | 'data' | 'error'> | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw === 'string') return normalizeStatus(raw)
  const status = record(raw)
  if (!status) return null

  if (status.connected === false || status.is_connected === false) return 'disconnected'
  if (status.mapped === false || status.is_mapped === false || status.has_mapping === false) return 'unmapped'
  if (status.synced === false || status.is_synced === false || status.has_synced === false || status.has_successful_sync === false) return 'not-synced'
  return normalizeStatus(text(status.state ?? status.status) ?? '')
}

function normalizeStatus(value: string): Exclude<GoogleAdsDashboardState, 'no-activity' | 'data' | 'error'> | null {
  const status = value.trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-')
  if (status === 'disconnected' || status === 'unmapped' || status === 'not-synced') return status
  return null
}

function summarize(month: string, parsedCampaigns: ParsedCampaign[]): GoogleAdsDashboardData {
  const campaigns = [...parsedCampaigns].sort((left, right) => right.spendMicros - left.spendMicros)
  const currencies = new Set(campaigns.map(campaign => campaign.currencyCode).filter((code): code is string => code !== null))
  const hasMixedCurrencies = currencies.size > 1
  const impressions = campaigns.reduce((total, campaign) => total + campaign.impressions, 0)
  const clicks = campaigns.reduce((total, campaign) => total + campaign.clicks, 0)
  const spendMicros = hasMixedCurrencies ? null : campaigns.reduce((total, campaign) => total + campaign.spendMicros, 0)
  return {
    month,
    spendMicros,
    impressions,
    clicks,
    ctr: impressions > 0 ? clicks / impressions * 100 : null,
    averageCpcMicros: spendMicros !== null && clicks > 0 ? spendMicros / clicks : null,
    conversions: campaigns.reduce((total, campaign) => total + campaign.conversions, 0),
    conversionValue: hasMixedCurrencies ? null : campaigns.reduce((total, campaign) => total + campaign.conversionValue, 0),
    campaignCount: campaigns.length,
    currencyCode: currencies.size === 1 ? [...currencies][0] : null,
    hasMixedCurrencies,
    campaigns,
  }
}

export async function loadGoogleAdsDashboard(reportId: string, month: string): Promise<GoogleAdsDashboardResult> {
  if (!reportId || !MONTH.test(month)) {
    return { data: null, state: 'error', error: LOAD_ERROR }
  }

  const { start, end } = calendarMonthBounds(month)
  try {
    const args = { p_report_id: reportId, p_period_start: start, p_period_end: end }
    const [metricsResult, statusResult] = await Promise.all([
      supabase.rpc('get_google_ads_dashboard_campaign_metrics', args),
      supabase.rpc('get_google_ads_dashboard_status', args),
    ])
    if (metricsResult.error || statusResult.error) {
      return { data: null, state: 'error', error: LOAD_ERROR }
    }

    const setupState = parseStatus(statusResult.data)
    if (setupState) return { data: null, state: setupState, error: null }

    const metricRows = rows(metricsResult.data)
    const campaigns = metricRows
      .map(parseCampaign)
      .filter((campaign): campaign is ParsedCampaign => campaign !== null)
    if (metricRows.length > 0 && campaigns.length === 0) {
      return { data: null, state: 'error', error: LOAD_ERROR }
    }
    if (campaigns.length === 0) return { data: null, state: 'no-activity', error: null }
    return { data: summarize(month, campaigns), state: 'data', error: null }
  } catch {
    return { data: null, state: 'error', error: LOAD_ERROR }
  }
}
