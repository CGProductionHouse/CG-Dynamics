// ============================================================================
// overviewModel.ts — availability-aware, comparability-gated Overview model
//
// Consumes normalized platform facts (platform_metric_facts_monthly) and turns
// them into client-safe Overview sections. Enforces the non-negotiable rules:
//   • missing/unavailable is never rendered as zero (valid_zero ≠ unavailable);
//   • unique audiences (reach / viewers) are never summed across platforms;
//   • a month-on-month % renders only when the two periods are truly comparable
//     (same platform, canonical metric, source definition, aggregation and both
//     complete/valid_zero) — otherwise the movement is suppressed with a reason.
//
// Pure module: no DB or React imports, so it is unit-testable in isolation.
// ============================================================================

export type Availability =
  | 'complete'
  | 'valid_zero'
  | 'unavailable'
  | 'permission_blocked'
  | 'partial'
  | 'error'
  | 'stale'

export interface PlatformFact {
  platform: string          // 'facebook' | 'instagram' | 'google_ads'
  metricKey: string         // canonical, e.g. 'brand_views'
  value: number | null
  availability: Availability
  comparableGroup: string | null
  aggregation: string | null // 'sum' | 'unique' | 'snapshot' | 'reconstructed'
  includesPaid?: string | null
  sourceMetric?: string | null
  periodStart?: string | null
  periodEnd?: string | null
}

// A metric has a shown value when the provider gave a definitive figure — a real
// number (complete), an explicit zero (valid_zero), or a reconstructed/partial
// figure. Unavailable / permission_blocked / error / stale have NO shown value.
export function hasShownValue(a: Availability): boolean {
  return a === 'complete' || a === 'valid_zero' || a === 'partial'
}

export function isDefinitive(a: Availability): boolean {
  return a === 'complete' || a === 'valid_zero'
}

export function hasRenderableFact(fact: PlatformFact): boolean {
  return hasShownValue(fact.availability) && typeof fact.value === 'number'
}

function isFullCalendarMonth(start: string | null | undefined, end: string | null | undefined): boolean {
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false
  const [year, month, day] = start.split('-').map(Number)
  if (day !== 1 || end.slice(0, 7) !== start.slice(0, 7)) return false
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Number(end.slice(8, 10)) === lastDay
}

// A unique-audience metric (reach / unique viewers) must never be summed across
// platforms because the same person can appear on more than one platform.
export function isUniqueAudience(aggregation: string | null): boolean {
  return aggregation === 'unique'
}

export interface ComparisonResult {
  comparable: boolean
  changePercent: number | null
  reason: string | null // why a comparison was suppressed (admin-facing)
}

// The comparability gate. A movement may render only when BOTH periods share the
// same canonical metric, the same source definition, the same aggregation and
// the same comparable_group, and both are definitive (complete or valid_zero).
export function compareFacts(current: PlatformFact, previous: PlatformFact | null): ComparisonResult {
  if (!previous) return { comparable: false, changePercent: null, reason: 'No comparable previous period.' }
  if (!isDefinitive(current.availability) || !isDefinitive(previous.availability)) {
    return { comparable: false, changePercent: null, reason: 'One period is not verified (missing or unavailable data).' }
  }
  if (typeof current.value !== 'number' || typeof previous.value !== 'number') {
    return { comparable: false, changePercent: null, reason: 'One period has no verified numeric value.' }
  }
  if (current.metricKey !== previous.metricKey || current.platform !== previous.platform) {
    return { comparable: false, changePercent: null, reason: 'Metric or platform differs.' }
  }
  if ((current.comparableGroup ?? '') !== (previous.comparableGroup ?? '')) {
    return { comparable: false, changePercent: null, reason: 'Comparison unavailable because the reporting source changed.' }
  }
  if ((current.aggregation ?? '') !== (previous.aggregation ?? '')) {
    return { comparable: false, changePercent: null, reason: 'Comparison unavailable because the aggregation method changed.' }
  }
  if ((current.sourceMetric ?? '') !== (previous.sourceMetric ?? '')) {
    return { comparable: false, changePercent: null, reason: 'Comparison unavailable because the reporting source changed.' }
  }
  if ((current.includesPaid ?? '') !== (previous.includesPaid ?? '')) {
    return { comparable: false, changePercent: null, reason: 'Comparison unavailable because paid and organic coverage changed.' }
  }
  if (!isFullCalendarMonth(current.periodStart, current.periodEnd)
      || !isFullCalendarMonth(previous.periodStart, previous.periodEnd)) {
    return { comparable: false, changePercent: null, reason: 'Comparison unavailable because one period is incomplete.' }
  }
  const cur = current.value
  const prev = previous.value
  const changePercent = prev === 0 ? null : ((cur - prev) / prev) * 100
  return { comparable: true, changePercent, reason: null }
}

export const METRIC_LABELS: Record<string, string> = {
  brand_views: 'Views',
  unique_viewers: 'Viewers',
  reach: 'Reach',
  content_interactions: 'Content interactions',
  profile_visits: 'Profile visits',
  page_visits: 'Page visits',
  website_clicks: 'Website clicks',
  follows_gained: 'Follows gained',
  current_followers: 'Current followers',
  ads_impressions: 'Impressions',
  ads_clicks: 'Clicks',
  ads_spend: 'Spend',
  ads_conversions: 'Conversions',
}

export const PLATFORM_TITLES: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  google_ads: 'Google Ads',
}

export interface OverviewLine {
  platform: string
  metricKey: string
  label: string          // e.g. "Facebook views"
  value: number | null
  hasValue: boolean
  isValidZero: boolean
  reconstructed: boolean
  isSnapshot: boolean    // current_followers — never shown as period growth
  availability: Availability
  changePercent: number | null
  comparable: boolean
  comparisonReason: string | null
}

export interface OverviewSection {
  key: 'brand_visibility' | 'audience_response' | 'commercial_intent'
  title: string
  lines: OverviewLine[]
}

const SECTION_METRICS: Record<OverviewSection['key'], string[]> = {
  brand_visibility: ['brand_views', 'unique_viewers', 'reach'],
  audience_response: ['content_interactions', 'profile_visits', 'follows_gained', 'current_followers'],
  commercial_intent: ['website_clicks', 'page_visits'],
}

const SECTION_TITLES: Record<OverviewSection['key'], string> = {
  brand_visibility: 'Brand visibility',
  audience_response: 'Audience response',
  commercial_intent: 'Commercial intent',
}

// Platform display order — Facebook first, then Instagram, for stable layout.
const PLATFORM_ORDER = ['facebook', 'instagram']

function lineFor(current: PlatformFact, previous: PlatformFact | null): OverviewLine {
  const isSnapshot = current.aggregation === 'snapshot'
  const cmp = isSnapshot
    ? { comparable: false, changePercent: null, reason: 'Snapshot metric — not shown as month-on-month growth.' }
    : compareFacts(current, previous)
  const label = `${PLATFORM_TITLES[current.platform] ?? current.platform} ${(METRIC_LABELS[current.metricKey] ?? current.metricKey).toLowerCase()}`
  return {
    platform: current.platform,
    metricKey: current.metricKey,
    label,
    value: hasRenderableFact(current) ? current.value : null,
    hasValue: hasRenderableFact(current),
    isValidZero: current.availability === 'valid_zero',
    reconstructed: current.aggregation === 'reconstructed',
    isSnapshot,
    availability: current.availability,
    changePercent: cmp.changePercent,
    comparable: cmp.comparable,
    comparisonReason: cmp.reason,
  }
}

// Builds the client-safe Overview. Each metric is emitted PER PLATFORM — there
// is no combined "all channels" total for views/reach/viewers, so Instagram-only
// figures can never masquerade as an all-channel number.
export function buildOverviewSections(
  current: PlatformFact[],
  previous: PlatformFact[] = [],
): OverviewSection[] {
  const prevIndex = new Map<string, PlatformFact>()
  for (const f of previous) prevIndex.set(`${f.platform}:${f.metricKey}`, f)

  const sections: OverviewSection[] = []
  for (const key of Object.keys(SECTION_METRICS) as OverviewSection['key'][]) {
    const lines: OverviewLine[] = []
    for (const metricKey of SECTION_METRICS[key]) {
      const facts = current
        .filter(f => f.metricKey === metricKey && hasRenderableFact(f))
        .sort((a, b) => {
          const ai = PLATFORM_ORDER.indexOf(a.platform); const bi = PLATFORM_ORDER.indexOf(b.platform)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })
      for (const fact of facts) {
        lines.push(lineFor(fact, prevIndex.get(`${fact.platform}:${fact.metricKey}`) ?? null))
      }
    }
    if (lines.length > 0) sections.push({ key, title: SECTION_TITLES[key], lines })
  }
  return sections
}

// Safe summing helper: only sums values that share a platform-additive nature.
// Refuses to sum unique-audience metrics across platforms (returns null so the
// UI shows "not available" rather than an inflated, meaningless total).
export function sumComparableValues(facts: PlatformFact[]): number | null {
  if (facts.length === 0) return null
  if (facts.some(f => isUniqueAudience(f.aggregation)) && new Set(facts.map(f => f.platform)).size > 1) {
    return null
  }
  const nums = facts.filter(f => hasShownValue(f.availability) && typeof f.value === 'number').map(f => f.value as number)
  if (nums.length === 0) return null
  return nums.reduce((s, v) => s + v, 0)
}
