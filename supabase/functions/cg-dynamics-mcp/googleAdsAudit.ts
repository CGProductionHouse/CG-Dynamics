import { validateGoogleAdsDateRange } from '../_shared/google-ads-policy.ts'

export const GOOGLE_ADS_MISSING_SURFACES = [
  'search_terms', 'keywords', 'negative_keywords', 'ad_groups', 'ads_and_assets',
  'device_segments', 'geography_segments', 'time_segments', 'change_history',
  'google_recommendations', 'ai_max_controls', 'conversion_goal_detail',
] as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface GoogleAdsAuditInput { client_id: string; start_date: string; end_date: string }
export interface AuditAccount { id: string; customer_id: string; account_name: string; account_mode: 'dedicated' | 'shared'; currency_code: string; time_zone: string; is_active: boolean }
export interface AuditLink { google_ads_account_id: string; client_id: string; customer_id?: string; campaign_id?: string; campaign_name?: string; is_active: boolean }
export interface AuditMetric { google_ads_account_id: string; client_id: string | null; customer_id: string; campaign_id: string; campaign_name: string; campaign_status: string | null; campaign_type: string | null; metric_date: string; impressions: number | string | null; clicks: number | string | null; interactions: number | string | null; cost_micros: number | string | null; conversions: number | string | null; conversion_value: number | string | null; native_settings: Record<string, unknown> | null }
export interface AuditSync { google_ads_account_id: string; status: string; period_start: string; period_end: string; finished_at: string | null; rows_upserted: number | null; unmapped_campaigns: number | null }

export function validateGoogleAdsAuditInput(input: Record<string, unknown>): string | null {
  if (typeof input.client_id !== 'string' || !UUID.test(input.client_id)) return 'Exact Dynamics client_id UUID is required.'
  // Reuse the provider's format/order/366-day policy without comparing a requested
  // account-local calendar date to the MCP server's unrelated operating timezone.
  return validateGoogleAdsDateRange(input.start_date, input.end_date, '9999-12-31')
}

/** A metric read that is already narrowed to this exact client before it reaches the database. */
export interface GoogleAdsMetricRead { google_ads_account_id: string; customer_id: string; campaign_ids: string[] | null }

/**
 * Plans one metric read per eligible account, using the same eligibility rules as the
 * projection. A shared account is read by its exact active campaign IDs for this client;
 * a dedicated account is read only once it is proven uniquely linked to this client.
 * Accounts that qualify for neither are never read at all.
 */
export function planGoogleAdsMetricReads(clientId: string, rows: {
  accounts: AuditAccount[]; dedicatedLinks: AuditLink[]; campaignLinks: AuditLink[]
}): GoogleAdsMetricRead[] {
  const reads: GoogleAdsMetricRead[] = []
  for (const account of [...rows.accounts].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!account.is_active) continue
    if (account.account_mode === 'dedicated') {
      const mine = rows.dedicatedLinks.some(link => link.is_active && link.client_id === clientId && link.google_ads_account_id === account.id)
      const shared = rows.dedicatedLinks.some(link => link.is_active && link.client_id !== clientId && link.google_ads_account_id === account.id)
      if (mine && !shared) reads.push({ google_ads_account_id: account.id, customer_id: account.customer_id, campaign_ids: null })
      continue
    }
    if (account.account_mode !== 'shared') continue
    const campaignIds = [...new Set(rows.campaignLinks
      .filter(link => link.is_active && link.client_id === clientId && link.google_ads_account_id === account.id
        && link.customer_id === account.customer_id)
      .map(link => link.campaign_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0))].sort()
    if (campaignIds.length) reads.push({ google_ads_account_id: account.id, customer_id: account.customer_id, campaign_ids: campaignIds })
  }
  return reads
}

/** Pure, fail-closed projection over canonical stored rows. No provider or database calls. */
export function buildGoogleAdsAudit(input: GoogleAdsAuditInput, rows: {
  accounts: AuditAccount[]; dedicatedLinks: AuditLink[]; campaignLinks: AuditLink[]; metrics: AuditMetric[]; syncRuns: AuditSync[]; truncated?: boolean
}) {
  const accounts = rows.accounts.filter(account => account.is_active && (account.account_mode === 'dedicated' || account.account_mode === 'shared'))
    .filter(account => account.account_mode === 'dedicated'
      ? rows.dedicatedLinks.some(link => link.is_active && link.client_id === input.client_id && link.google_ads_account_id === account.id)
        && !rows.dedicatedLinks.some(link => link.is_active && link.client_id !== input.client_id && link.google_ads_account_id === account.id)
      : rows.campaignLinks.some(link => link.is_active && link.client_id === input.client_id && link.google_ads_account_id === account.id && link.customer_id === account.customer_id))
    .sort((a, b) => a.id.localeCompare(b.id))
  const mapped = accounts.map(account => {
    const links = rows.campaignLinks.filter(link => link.is_active && link.client_id === input.client_id
      && link.google_ads_account_id === account.id && link.customer_id === account.customer_id)
    const campaignAllowed = (metric: AuditMetric) => account.account_mode === 'dedicated'
      ? metric.client_id === input.client_id || metric.client_id === null
      : (metric.client_id === input.client_id || metric.client_id === null) && links.some(link => link.campaign_id === metric.campaign_id)
    const metrics = rows.metrics.filter(metric => metric.google_ads_account_id === account.id && metric.customer_id === account.customer_id
      && metric.metric_date >= input.start_date && metric.metric_date <= input.end_date && campaignAllowed(metric))
      .sort((a, b) => a.campaign_id.localeCompare(b.campaign_id) || a.metric_date.localeCompare(b.metric_date))
    const runs = rows.syncRuns.filter(run => run.google_ads_account_id === account.id && run.status === 'succeeded' && run.finished_at)
      .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    const last = runs[0] ?? null
    const covering = runs.find(run => run.period_start <= input.start_date && run.period_end >= input.end_date) ?? null
    const freshness = !last ? 'not_synced' : covering ? 'available' : 'stale'
    const campaignIds = [...new Set([...metrics.map(metric => metric.campaign_id),
      ...(account.account_mode === 'shared' ? links.map(link => link.campaign_id).filter((id): id is string => Boolean(id)) : [])])].sort()
    return {
      account: { id: account.id, customer_id: account.customer_id, account_name: account.account_name,
        account_mode: account.account_mode, currency_code: account.currency_code, time_zone: account.time_zone },
      mapping_state: 'mapped', freshness,
      last_successful_sync: last ? { finished_at: last.finished_at, period_start: last.period_start, period_end: last.period_end,
        rows_upserted: last.rows_upserted, unmapped_campaigns: last.unmapped_campaigns } : null,
      period_coverage: covering ? 'complete_sync' : metrics.length ? 'partial' : 'not_synced',
      campaigns: campaignIds.map(id => {
        const daily = metrics.filter(metric => metric.campaign_id === id)
        const latest = [...daily].filter(metric => metric.native_settings && typeof metric.native_settings.observed_at === 'string')
          .sort((a, b) => String(b.native_settings?.observed_at).localeCompare(String(a.native_settings?.observed_at)))[0]
        return { campaign_id: id, campaign_name: daily.at(-1)?.campaign_name ?? links.find(link => link.campaign_id === id)?.campaign_name ?? null,
          period_state: daily.length ? 'stored' : 'not_synced',
          campaign_status: daily.at(-1)?.campaign_status ?? null, campaign_type: daily.at(-1)?.campaign_type ?? null,
          current_settings: latest ? { observed_at: latest.native_settings?.observed_at, values: latest.native_settings } : null,
          daily_metrics: daily.map(metric => ({ date: metric.metric_date, impressions: metric.impressions, clicks: metric.clicks,
            interactions: metric.interactions, cost_micros: metric.cost_micros, conversions: metric.conversions,
            conversion_value: metric.conversion_value })) }
      }),
    }
  })
  return {
    client_id: input.client_id, period: { start_date: input.start_date, end_date: input.end_date, semantics: 'Google Ads account-local dates' },
    mapping_state: mapped.length ? 'mapped' : 'not_mapped',
    data_state: rows.truncated ? 'partial' : !mapped.length ? 'not_mapped'
      : mapped.every(account => account.freshness === 'not_synced') ? 'not_synced'
        : mapped.some(account => account.freshness === 'stale') ? 'stale'
          : mapped.some(account => account.period_coverage !== 'complete_sync') ? 'partial' : 'available',
    accounts: mapped,
    conversion_facts: 'Stored campaign daily conversions and conversion_value only; conversion action/goal definitions are unavailable.',
    missing_surfaces: GOOGLE_ADS_MISSING_SURFACES,
    mutation_capability: false,
  }
}
