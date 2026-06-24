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

function isMetaSyncedManual(view: PlatformView): boolean {
  return view.source === 'manual' && view.manual?.source_type === 'other' && view.manual.general_notes?.startsWith('Meta sync account totals') === true
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
  const metaManual = isMetaSyncedManual(view)
  const interactions = metaManual && view.engagements === 0 ? null : view.engagements
  const visits = metaManual && view.manual?.profile_visits === 0 ? null : view.manual?.profile_visits
  const follows = metaManual && view.manual?.followers === 0 ? null : view.manual?.followers

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
