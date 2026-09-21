const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 366

export function normalizeCustomerId(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const candidate = String(value).replace(/^customers\//i, '').trim()
  if (!/^[0-9\s-]+$/.test(candidate)) return null
  const digits = candidate.replace(/[\s-]/g, '')
  return /^\d{10}$/.test(digits) ? digits : null
}

export function isGoogleAdsManagerRole(role: unknown): role is 'admin' | 'manager' {
  return role === 'admin' || role === 'manager'
}

export function validGoogleAdsDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateGoogleAdsDateRange(startDate: unknown, endDate: unknown, today: string): string | null {
  if (!validGoogleAdsDate(startDate) || !validGoogleAdsDate(endDate)) {
    return 'Valid startDate and endDate values are required (YYYY-MM-DD).'
  }
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (end < start) return 'endDate must not be before startDate.'
  if ((end - start) / 86_400_000 + 1 > MAX_RANGE_DAYS) {
    return `Date range cannot exceed ${MAX_RANGE_DAYS} days.`
  }
  if (endDate > today) return 'endDate cannot be in the future.'
  return null
}

export function googleAdsCampaignQuery(startDate: string, endDate: string): string {
  if (!validGoogleAdsDate(startDate) || !validGoogleAdsDate(endDate)) {
    throw new Error('Cannot build Google Ads query for invalid dates.')
  }
  return `
    SELECT
      customer.id,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
    ORDER BY segments.date, campaign.id`
}
