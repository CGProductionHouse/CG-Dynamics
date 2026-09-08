// Google Ads v25 settings are a snapshot at fetch time, not historical daily facts.
export const GOOGLE_ADS_NATIVE_FIELDS = `
      campaign.primary_status,
      campaign.start_date,
      campaign.end_date,
      campaign.bidding_strategy_type,
      campaign_budget.resource_name,
      campaign_budget.amount_micros,
      campaign_budget.total_amount_micros,
      campaign_budget.period,
      campaign_budget.explicitly_shared,
      campaign_budget.status`

export function nullableGoogleAdsNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function googleAdsNativeSnapshot(row: Record<string, unknown>, observedAt: string) {
  const campaign = (row.campaign ?? {}) as Record<string, unknown>
  const budget = (row.campaignBudget ?? {}) as Record<string, unknown>
  const text = (value: unknown) => typeof value === 'string' && value ? value : null
  return {
    api_version: 'v25',
    observed_at: observedAt,
    primary_status: text(campaign.primaryStatus),
    start_date: text(campaign.startDate),
    end_date: text(campaign.endDate),
    bidding_strategy_type: text(campaign.biddingStrategyType),
    budget_resource_name: text(budget.resourceName),
    budget_amount_micros: nullableGoogleAdsNumber(budget.amountMicros),
    budget_total_amount_micros: nullableGoogleAdsNumber(budget.totalAmountMicros),
    budget_period: text(budget.period),
    budget_shared: typeof budget.explicitlyShared === 'boolean' ? budget.explicitlyShared : null,
    budget_status: text(budget.status),
  }
}
