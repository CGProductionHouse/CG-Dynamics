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
  imageUrl: string | null
}

export interface ReportStats {
  totalReach: number
  totalImpressions: number
  totalEngagements: number
  postCount: number
  bestPost: ReportStatsPost | null
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
    imageUrl: null,
  }
}

export function reportPostToStatsPost(post: ReportPost): ReportStatsPost {
  const raw = post.raw as {
    impressions?: number
    views?: number
    engagements?: number
    video_views?: number
    full_picture?: string
    thumbnail_url?: string
    media_url?: string
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
    imageUrl: raw.full_picture ?? raw.thumbnail_url ?? raw.media_url ?? null,
  }
}

export function calculateReportStats(posts: ReportStatsPost[]): ReportStats {
  const sorted = [...posts].sort((a, b) => b.engagements - a.engagements)

  return {
    totalReach: posts.reduce((sum, post) => sum + post.reach, 0),
    totalImpressions: posts.reduce((sum, post) => sum + post.impressions, 0),
    totalEngagements: posts.reduce((sum, post) => sum + post.engagements, 0),
    postCount: posts.length,
    bestPost: sorted[0] ?? null,
    topPosts: sorted.slice(0, 3),
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
  // True when the underlying metric is not available from the data source (e.g.
  // profile visits from a CSV-only report). Distinguishes "genuinely 0" from
  // "data not available".
  notAvailable?: boolean
}

// Sentinel for metrics whose source does not provide the data at all.
export function unavailableMetric(): MetricMovement {
  return { current: 0, previous: null, difference: null, percent: null, direction: 'missing', notAvailable: true }
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

// Returns null when no manual metrics exist — callers must treat null as
// "data not available" rather than 0.
export function totalManualProfileVisits(manualMetrics: ManualPlatformMetric[]): number | null {
  if (manualMetrics.length === 0) return null
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
  const currentProfileVisits = totalManualProfileVisits(currentManualMetrics)
  const previousProfileVisits = totalManualProfileVisits(previousManualMetrics)

  return {
    views: compareMetric(current.totalViews, previous?.totalViews),
    reach: compareMetric(current.totalReach, previous?.totalReach),
    engagements: compareMetric(current.totalEngagements, previous?.totalEngagements),
    // Profile visits and followers are only available from manual summaries.
    // Show "not available" rather than 0 when no manual data exists.
    profileVisits: currentProfileVisits === null ? unavailableMetric() : compareMetric(currentProfileVisits, previousProfileVisits),
    followers: currentFollowers === null ? unavailableMetric() : compareMetric(currentFollowers, previousFollowers),
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

// Maps raw Meta CSV post_type values to friendly display labels.
// Returns null when postType is absent so callers can choose to hide it.
export function displayContentType(postType: string | null | undefined): string | null {
  if (!postType) return null
  const t = postType.toLowerCase().replace(/\s+/g, ' ').trim()
  if (t === 'ig reel' || t === 'reel') return 'Reel'
  if (t === 'ig carousel' || t === 'ig album' || t === 'carousel') return 'Carousel'
  if (t === 'ig image' || t === 'image') return 'Photo post'
  if (t === 'photo') return 'Photo post'
  if (t.includes('video')) return 'Video'
  if (t === 'link') return 'Link post'
  if (t === 'status') return 'Status'
  return postType
}
