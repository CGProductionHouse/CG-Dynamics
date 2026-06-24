import type { Platform, PlatformView, ReportStatsPost } from './reportStats'
import { isMetaSyncedManualMetric } from './reportStats'

export interface MetaMetricValue {
  key: string
  label: string
  value: number
}

function metaMetricAvailable(metric: PlatformView['manual'], key: 'views' | 'reach' | 'engagements' | 'profile_visits' | 'followers'): boolean {
  if (!metric) return false
  if (!isMetaSyncedManualMetric(metric)) return true
  return metric[key] > 0
}

export function metaPrimaryMetricLabel(platform: Platform | null | undefined): string {
  if (platform === 'facebook') return 'Viewers'
  if (platform === 'instagram') return 'Reach'
  return 'Reach / viewers'
}

export function metaEngagementLabel(): string {
  return 'Content interactions'
}

export function buildMetaPlatformMetrics(view: PlatformView): MetaMetricValue[] {
  const items: MetaMetricValue[] = []

  if (view.platform === 'facebook') {
    if (view.views !== null) items.push({ key: 'views', label: 'Views', value: view.views })
    if (view.reach !== null) items.push({ key: 'viewers', label: 'Viewers', value: view.reach })
    if (metaMetricAvailable(view.manual, 'engagements') && view.engagements > 0) items.push({ key: 'content_interactions', label: 'Content interactions', value: view.engagements })
    if (metaMetricAvailable(view.manual, 'profile_visits')) items.push({ key: 'visits', label: 'Visits', value: view.manual!.profile_visits })
    if (metaMetricAvailable(view.manual, 'followers')) items.push({ key: 'follows', label: 'Follows', value: view.manual!.followers })
    if (view.postCount > 0) items.push({ key: 'posts', label: 'Posts', value: view.postCount })
    return items
  }

  if (view.platform === 'instagram') {
    if (view.views !== null) items.push({ key: 'views', label: 'Views', value: view.views })
    if (view.reach !== null) items.push({ key: 'reach', label: 'Reach', value: view.reach })
    if (metaMetricAvailable(view.manual, 'engagements') && view.engagements > 0) items.push({ key: 'content_interactions', label: 'Content interactions', value: view.engagements })
    if (metaMetricAvailable(view.manual, 'profile_visits')) items.push({ key: 'profile_visits', label: 'Profile visits', value: view.manual!.profile_visits })
    if (metaMetricAvailable(view.manual, 'followers')) items.push({ key: 'follows', label: 'Follows', value: view.manual!.followers })
    if (view.postCount > 0) items.push({ key: 'posts', label: 'Posts', value: view.postCount })
    return items
  }

  // TikTok / other
  if (view.views !== null) items.push({ key: 'views', label: 'Views', value: view.views })
  if (view.reach !== null) items.push({ key: 'reach', label: 'Reach', value: view.reach })
  if (view.engagements > 0) items.push({ key: 'content_interactions', label: 'Content interactions', value: view.engagements })
  if (view.postCount > 0) items.push({ key: 'posts', label: 'Posts', value: view.postCount })
  return items
}

export function buildMetaContentMetrics(post: ReportStatsPost): MetaMetricValue[] {
  const items: MetaMetricValue[] = []
  if (post.impressions !== null) items.push({ key: 'views', label: 'Views', value: post.impressions })
  if (post.reach !== null) items.push({ key: 'reach_or_viewers', label: metaPrimaryMetricLabel(post.platform), value: post.reach })
  if (post.engagements > 0) items.push({ key: 'content_interactions', label: 'Content interactions', value: post.engagements })
  return items
}
