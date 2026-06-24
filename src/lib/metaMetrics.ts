import type { Platform, PlatformView, ReportStatsPost } from './reportStats'
import { formatNumber } from './reportStats'

export type MetaMetricAvailability = 'available' | 'unavailable'

export interface MetaMetricValue {
  key: string
  label: string
  value: number | null
  availability: MetaMetricAvailability
  unavailableLabel?: string
}

export const META_UNAVAILABLE_LABEL = 'Data not available from Meta API'

export const META_SOURCE_NOTE =
  'Data source: Meta Business Sync. Some metrics may be unavailable where Meta does not expose them through the API.'

function hasMetaSyncedMetric(manual: PlatformView['manual']): boolean {
  return manual?.source_type === 'other' && manual.general_notes?.startsWith('Meta sync account totals') === true
}

function metric(key: string, label: string, value: number | null | undefined): MetaMetricValue {
  return {
    key,
    label,
    value: typeof value === 'number' ? value : null,
    availability: typeof value === 'number' ? 'available' : 'unavailable',
    unavailableLabel: META_UNAVAILABLE_LABEL,
  }
}

export function metaPrimaryMetricLabel(platform: Platform | null | undefined): string {
  if (platform === 'facebook') return 'Viewers'
  if (platform === 'instagram') return 'Reach'
  return 'Reach / viewers'
}

export function metaEngagementLabel(): string {
  return 'Content interactions'
}

export function formatMetaMetric(value: number | null | undefined): string {
  return typeof value === 'number' ? formatNumber(value) : META_UNAVAILABLE_LABEL
}

export function buildMetaPlatformMetrics(view: PlatformView): MetaMetricValue[] {
  // Check if the attached manual metric is Meta synced regardless of view source
  // so 0 values from Meta (meaning "unavailable") are shown as "Data not available".
  const metaSyncedMetric = hasMetaSyncedMetric(view.manual)
  const interactions = metaSyncedMetric && view.engagements === 0 ? null : view.engagements
  const visits = metaSyncedMetric && view.manual?.profile_visits === 0 ? null : view.manual?.profile_visits
  const follows = metaSyncedMetric && view.manual?.followers === 0 ? null : view.manual?.followers

  if (view.platform === 'facebook') {
    return [
      metric('views', 'Views', view.views),
      metric('viewers', 'Viewers', view.reach),
      metric('content_interactions', 'Content interactions', interactions),
      metric('visits', 'Visits', visits),
      metric('follows', 'Follows', follows),
      metric('posts', 'Posts', view.postCount),
    ]
  }

  if (view.platform === 'instagram') {
    return [
      metric('views', 'Views', view.views),
      metric('reach', 'Reach', view.reach),
      metric('content_interactions', 'Content interactions', interactions),
      metric('profile_visits', 'Profile visits', visits),
      metric('follows', 'Follows', follows),
      metric('posts', 'Posts', view.postCount),
    ]
  }

  return [
    metric('views', 'Views', view.views),
    metric('reach', 'Reach', view.reach),
    metric('content_interactions', 'Content interactions', interactions),
    metric('posts', 'Posts', view.postCount),
  ]
}

export function buildMetaContentMetrics(post: ReportStatsPost): MetaMetricValue[] {
  return [
    metric('views', 'Views', post.impressions),
    metric('reach_or_viewers', metaPrimaryMetricLabel(post.platform), post.reach),
    metric('content_interactions', 'Content interactions', post.engagements),
  ]
}

export function formatCompactMetaMetric(value: number | null | undefined): string {
  return typeof value === 'number' ? formatNumber(value) : 'Data not available'
}
