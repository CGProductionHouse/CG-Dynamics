import type { ImportedMetaPost } from './db/importedMetaPosts'
import type { ReportPost } from './db/reports'
import type { ManualPlatformMetric } from './db/manualMetrics'

export type Platform = 'facebook' | 'instagram' | 'tiktok'

export const PLATFORMS: Platform[] = ['facebook', 'instagram', 'tiktok']

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

export interface ReportStatsPost {
  id: string
  caption: string | null
  permalink: string | null
  publish_time: string | null
  reach: number
  impressions: number
  engagements: number
  post_type: string | null
  platform: Platform | null
}

export interface ReportStats {
  totalReach: number
  totalImpressions: number
  totalEngagements: number
  postCount: number
  bestPost: ReportStatsPost | null
  worstPost: ReportStatsPost | null
  topPosts: ReportStatsPost[]
}

export function importedToStatsPost(post: ImportedMetaPost): ReportStatsPost {
  return {
    id: post.id,
    caption: post.caption,
    permalink: post.permalink,
    publish_time: post.publish_time,
    reach: post.reach,
    impressions: post.impressions,
    engagements: post.engagements,
    post_type: post.post_type,
    platform: post.platform,
  }
}

export function reportPostToStatsPost(post: ReportPost): ReportStatsPost {
  const raw = post.raw as {
    impressions?: number
    views?: number
    engagements?: number
    video_views?: number
  }

  return {
    id: post.id,
    caption: post.caption,
    permalink: post.permalink,
    publish_time: post.publish_time,
    reach: post.reach,
    impressions: raw.views ?? raw.impressions ?? post.views,
    engagements: raw.engagements ?? post.reactions + post.comments + post.shares + post.total_clicks,
    post_type: post.meta_post_type,
    platform: post.platform,
  }
}

export function calculateReportStats(posts: ReportStatsPost[]): ReportStats {
  const sorted = [...posts].sort((a, b) => b.engagements - a.engagements)
  const worstSorted = [...posts].sort((a, b) => a.engagements - b.engagements)

  return {
    totalReach: posts.reduce((sum, post) => sum + post.reach, 0),
    totalImpressions: posts.reduce((sum, post) => sum + post.impressions, 0),
    totalEngagements: posts.reduce((sum, post) => sum + post.engagements, 0),
    postCount: posts.length,
    bestPost: sorted[0] ?? null,
    worstPost: worstSorted[0] ?? null,
    topPosts: sorted.slice(0, 5),
  }
}

export interface PlatformBreakdown {
  platform: Platform
  label: string
  stats: ReportStats
  hasData: boolean
}

export function calculatePlatformBreakdowns(posts: ReportStatsPost[]): PlatformBreakdown[] {
  return PLATFORMS.map(platform => {
    const platformPosts = posts.filter(post => post.platform === platform)
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      stats: calculateReportStats(platformPosts),
      hasData: platformPosts.length > 0,
    }
  })
}

// Best platform is ranked by reach first, then engagements as a tie-breaker.
export function bestPlatform(breakdowns: PlatformBreakdown[]): PlatformBreakdown | null {
  const withData = breakdowns.filter(breakdown => breakdown.hasData)
  if (withData.length === 0) return null

  return [...withData].sort((a, b) => {
    if (b.stats.totalReach !== a.stats.totalReach) {
      return b.stats.totalReach - a.stats.totalReach
    }
    return b.stats.totalEngagements - a.stats.totalEngagements
  })[0]
}

// ─── Master report: CSV posts + manual metrics combined ─────────────────────

export type PlatformSource = 'posts' | 'manual' | 'none'

export interface PlatformView {
  platform: Platform
  label: string
  source: PlatformSource
  reach: number
  views: number
  engagements: number
  // Populated when source === 'posts'
  postCount: number
  bestPost: ReportStatsPost | null
  topPosts: ReportStatsPost[]
  // Populated when source === 'manual'
  manual: ManualPlatformMetric | null
}

export interface MasterReportData {
  platforms: PlatformView[]
  totalReach: number
  totalViews: number
  totalEngagements: number
  bestPlatform: PlatformView | null
  bestPostOverall: ReportStatsPost | null
}

export interface MetricMovement {
  current: number
  previous: number | null
  difference: number | null
  percent: number | null
  direction: 'up' | 'down' | 'flat' | 'missing'
}

export interface PerformanceMovement {
  views: MetricMovement
  reach: MetricMovement
  engagements: MetricMovement
  profileVisits: MetricMovement
  followers: MetricMovement
}

// Combines snapshotted CSV posts with manual platform metrics into one
// master view. For each platform we prefer post-level CSV data when it
// exists, otherwise fall back to the manual aggregate, so totals are never
// double counted.
export function buildMasterReport(
  posts: ReportStatsPost[],
  manualMetrics: ManualPlatformMetric[]
): MasterReportData {
  const platforms: PlatformView[] = PLATFORMS.map(platform => {
    const platformPosts = posts.filter(post => post.platform === platform)
    const manual = manualMetrics.find(metric => metric.platform === platform) ?? null

    if (platformPosts.length > 0) {
      const stats = calculateReportStats(platformPosts)
      return {
        platform,
        label: PLATFORM_LABELS[platform],
        source: 'posts',
        reach: stats.totalReach,
        views: stats.totalImpressions,
        engagements: stats.totalEngagements,
        postCount: stats.postCount,
        bestPost: stats.bestPost,
        topPosts: stats.topPosts,
        manual,
      }
    }

    if (manual) {
      return {
        platform,
        label: PLATFORM_LABELS[platform],
        source: 'manual',
        reach: manual.reach,
        views: manual.views,
        engagements: manual.engagements,
        postCount: 0,
        bestPost: null,
        topPosts: [],
        manual,
      }
    }

    return {
      platform,
      label: PLATFORM_LABELS[platform],
      source: 'none',
      reach: 0,
      views: 0,
      engagements: 0,
      postCount: 0,
      bestPost: null,
      topPosts: [],
      manual: null,
    }
  })

  const withData = platforms.filter(view => view.source !== 'none')

  const bestPlatform = [...withData].sort((a, b) => {
    if (b.reach !== a.reach) return b.reach - a.reach
    return b.engagements - a.engagements
  })[0] ?? null

  return {
    platforms,
    totalReach: withData.reduce((sum, view) => sum + view.reach, 0),
    totalViews: withData.reduce((sum, view) => sum + view.views, 0),
    totalEngagements: withData.reduce((sum, view) => sum + view.engagements, 0),
    bestPlatform,
    bestPostOverall: posts.length > 0 ? calculateReportStats(posts).bestPost : null,
  }
}

export function totalManualProfileVisits(manualMetrics: ManualPlatformMetric[]) {
  return manualMetrics.reduce((sum, metric) => sum + metric.profile_visits, 0)
}

export function totalManualFollowers(manualMetrics: ManualPlatformMetric[]) {
  const withFollowers = manualMetrics.filter(metric => metric.followers > 0)
  if (withFollowers.length === 0) return null
  return withFollowers.reduce((sum, metric) => sum + metric.followers, 0)
}

export function compareMetric(current: number, previous: number | null | undefined): MetricMovement {
  if (previous === null || previous === undefined) {
    return {
      current,
      previous: null,
      difference: null,
      percent: null,
      direction: 'missing',
    }
  }

  const difference = current - previous
  return {
    current,
    previous,
    difference,
    percent: previous === 0 ? null : (difference / previous) * 100,
    direction: difference > 0 ? 'up' : difference < 0 ? 'down' : 'flat',
  }
}

export function buildPerformanceMovement(
  current: MasterReportData,
  previous: MasterReportData | null,
  currentManualMetrics: ManualPlatformMetric[],
  previousManualMetrics: ManualPlatformMetric[]
): PerformanceMovement {
  const currentFollowers = totalManualFollowers(currentManualMetrics)
  const previousFollowers = totalManualFollowers(previousManualMetrics)
  const previousProfileVisits = previousManualMetrics.length > 0
    ? totalManualProfileVisits(previousManualMetrics)
    : null

  return {
    views: compareMetric(current.totalViews, previous?.totalViews),
    reach: compareMetric(current.totalReach, previous?.totalReach),
    engagements: compareMetric(current.totalEngagements, previous?.totalEngagements),
    profileVisits: compareMetric(
      totalManualProfileVisits(currentManualMetrics),
      previousProfileVisits
    ),
    followers: compareMetric(currentFollowers ?? 0, previousFollowers),
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function shortCaption(caption: string | null, fallback = 'Untitled post') {
  if (!caption) return fallback
  return caption.length > 120 ? `${caption.slice(0, 120)}...` : caption
}
