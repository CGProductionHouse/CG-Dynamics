import type { PlatformView, ReportStatsPost } from './reportStats'
import { isMetaSyncedManualMetric } from './reportStats'

// ── Truthful CG Reporting Metric Model ──────────────────────
// Each metric has a defined source type, exact meaning, and
// clear rules for when it can appear in client-facing reports.

export type MetricSourceType =
  | 'account_monthly_total'
  | 'account_current_snapshot'
  | 'period_delta'
  | 'post_aggregation'
  | 'media_insight'
  | 'manual_fallback'

export interface MetricDefinition {
  key: string
  label: string
  sourceType: MetricSourceType
  meaning: string
  safeForClient: boolean
  adminOnly: boolean
  sumAcrossPlatforms: boolean
  showInOverview: boolean
  showInPlatformBreakdown: boolean
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  views: {
    key: 'views',
    label: 'Views',
    sourceType: 'account_monthly_total',
    meaning: 'Content or profile views during the reporting period. Platform-specific: Instagram account-level views, or per-post impressions on Facebook posts.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: true,
    showInPlatformBreakdown: true,
  },
  reach: {
    key: 'reach',
    label: 'Reach',
    sourceType: 'account_monthly_total',
    meaning: 'Unique accounts that saw any content during the reporting period.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: false,
    showInOverview: true,
    showInPlatformBreakdown: true,
  },
  content_interactions: {
    key: 'content_interactions',
    label: 'Content interactions',
    sourceType: 'account_monthly_total',
    meaning: 'Total interactions on all content: likes, comments, shares, saves, reactions. Source depends on platform (account-level total or post aggregation).',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: true,
    showInPlatformBreakdown: true,
  },
  posts: {
    key: 'posts',
    label: 'Posts',
    sourceType: 'post_aggregation',
    meaning: 'Number of posts published during the reporting period.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: true,
    showInPlatformBreakdown: true,
  },
  current_followers: {
    key: 'current_followers',
    label: 'Current followers',
    sourceType: 'account_current_snapshot',
    meaning: 'Total follower count at the time of sync. Not "new follows" - only total audience size.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: true,
    showInPlatformBreakdown: true,
  },
  profile_visits: {
    key: 'profile_visits',
    label: 'Profile visits',
    sourceType: 'account_monthly_total',
    meaning: 'Number of times the profile was visited during the reporting period.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: false,
    showInPlatformBreakdown: true,
  },
  website_clicks: {
    key: 'website_clicks',
    label: 'Website clicks',
    sourceType: 'account_monthly_total',
    meaning: 'Clicks on the website link in the profile during the reporting period.',
    safeForClient: true,
    adminOnly: false,
    sumAcrossPlatforms: true,
    showInOverview: false,
    showInPlatformBreakdown: true,
  },
}

export interface MetaMetricValue {
  key: string
  label: string
  value: number
}

function metaMetricAvailable(metric: PlatformView['manual'] | null, key: 'views' | 'reach' | 'engagements' | 'profile_visits' | 'followers'): boolean {
  if (!metric) return false
  if (!isMetaSyncedManualMetric(metric)) return true
  return metric[key] > 0
}

// Returns the correct client-facing label for the reach-type metric on a
// given platform. Always "Reach" - never "Viewers" or "Reach / viewers".
export function metaPrimaryMetricLabel(): string {
  return 'Reach'
}

export function metaEngagementLabel(): string {
  return 'Content interactions'
}

export function buildMetaPlatformMetrics(view: PlatformView): MetaMetricValue[] {
  const items: MetaMetricValue[] = []

  if (view.platform === 'facebook') {
    if (view.views !== null) items.push({ key: 'views', label: METRIC_DEFINITIONS.views.label, value: view.views })
    if (view.reach !== null) items.push({ key: 'reach', label: METRIC_DEFINITIONS.reach.label, value: view.reach })
    if (metaMetricAvailable(view.manual, 'engagements') && view.engagements > 0) items.push({ key: 'content_interactions', label: METRIC_DEFINITIONS.content_interactions.label, value: view.engagements })
    if (metaMetricAvailable(view.manual, 'profile_visits')) items.push({ key: 'profile_visits', label: METRIC_DEFINITIONS.profile_visits.label, value: view.manual!.profile_visits })
    if (metaMetricAvailable(view.manual, 'followers')) items.push({ key: 'current_followers', label: METRIC_DEFINITIONS.current_followers.label, value: view.manual!.followers })
    if (view.postCount > 0) items.push({ key: 'posts', label: METRIC_DEFINITIONS.posts.label, value: view.postCount })
    return items
  }

  if (view.platform === 'instagram') {
    if (view.views !== null) items.push({ key: 'views', label: METRIC_DEFINITIONS.views.label, value: view.views })
    if (view.reach !== null) items.push({ key: 'reach', label: METRIC_DEFINITIONS.reach.label, value: view.reach })
    if (metaMetricAvailable(view.manual, 'engagements') && view.engagements > 0) items.push({ key: 'content_interactions', label: METRIC_DEFINITIONS.content_interactions.label, value: view.engagements })
    if (metaMetricAvailable(view.manual, 'profile_visits')) items.push({ key: 'profile_visits', label: METRIC_DEFINITIONS.profile_visits.label, value: view.manual!.profile_visits })
    if (metaMetricAvailable(view.manual, 'followers')) items.push({ key: 'current_followers', label: METRIC_DEFINITIONS.current_followers.label, value: view.manual!.followers })
    if (view.postCount > 0) items.push({ key: 'posts', label: METRIC_DEFINITIONS.posts.label, value: view.postCount })
    return items
  }

  // TikTok / other
  if (view.views !== null) items.push({ key: 'views', label: METRIC_DEFINITIONS.views.label, value: view.views })
  if (view.reach !== null) items.push({ key: 'reach', label: METRIC_DEFINITIONS.reach.label, value: view.reach })
  if (view.engagements > 0) items.push({ key: 'content_interactions', label: METRIC_DEFINITIONS.content_interactions.label, value: view.engagements })
  if (view.postCount > 0) items.push({ key: 'posts', label: METRIC_DEFINITIONS.posts.label, value: view.postCount })
  return items
}

export function buildMetaContentMetrics(post: ReportStatsPost): MetaMetricValue[] {
  const items: MetaMetricValue[] = []
  if (post.impressions !== null) items.push({ key: 'views', label: METRIC_DEFINITIONS.views.label, value: post.impressions })
  if (post.reach !== null) items.push({ key: 'reach', label: METRIC_DEFINITIONS.reach.label, value: post.reach })
  if (post.engagements > 0) items.push({ key: 'content_interactions', label: METRIC_DEFINITIONS.content_interactions.label, value: post.engagements })
  return items
}

// Visibility helpers based on the metric model.
export function isClientSafe(metricKey: string): boolean {
  return METRIC_DEFINITIONS[metricKey]?.safeForClient !== false
}

export function canSumAcrossPlatforms(metricKey: string): boolean {
  return METRIC_DEFINITIONS[metricKey]?.sumAcrossPlatforms !== false
}
