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
  // reach / impressions are null when the source genuinely did not return the
  // metric (e.g. Meta did not provide insights). They are only 0 when a source
  // explicitly reported 0. Engagements come from likes/comments/etc. which are
  // generally available, so they stay numeric.
  reach: number | null
  impressions: number | null
  engagements: number
  post_type: string | null
  platform: Platform | null
  imageUrl: string | null
}

export interface ReportStats {
  totalReach: number | null
  totalImpressions: number | null
  totalEngagements: number
  postCount: number
  bestPost: ReportStatsPost | null
  topPosts: ReportStatsPost[]
}

// Sums a set of possibly-missing metric values. Returns null when EVERY value
// is missing (so the UI can show "Data not available"); otherwise sums only the
// values that are real numbers. A real 0 counts as data.
export function sumOrNull(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number')
  if (nums.length === 0) return null
  return nums.reduce((sum, v) => sum + v, 0)
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
  const raw = (post.raw ?? {}) as {
    impressions?: number | null
    views?: number | null
    reach?: number | null
    engagements?: number | null
    video_views?: number | null
    full_picture?: string
    thumbnail_url?: string
    media_url?: string
    content_type?: string
    source?: string
    synced_at?: string
  }

  // Meta-synced posts record the TRUE availability of each metric in `raw`
  // (a number, or null when Meta did not return it). Legacy CSV/import posts
  // carry real numbers in raw.views/impressions and the integer columns.
  const isSynced = raw.source === 'meta_sync' || typeof raw.synced_at === 'string'

  let impressions: number | null
  let reach: number | null
  if (isSynced) {
    impressions = typeof raw.views === 'number' ? raw.views : null
    reach = typeof raw.reach === 'number' ? raw.reach : null
  } else {
    impressions =
      typeof raw.views === 'number'
        ? raw.views
        : typeof raw.impressions === 'number'
          ? raw.impressions
          : post.views
    reach = post.reach
  }

  const engagements =
    typeof raw.engagements === 'number'
      ? raw.engagements
      : post.reactions + post.comments + post.shares + post.total_clicks

  return {
    id: post.id,
    caption: post.caption,
    permalink: post.permalink,
    publish_time: post.publish_time,
    reach,
    impressions,
    engagements,
    post_type: raw.content_type ?? post.meta_post_type,
    platform: post.platform,
    imageUrl: raw.full_picture ?? raw.thumbnail_url ?? raw.media_url ?? null,
  }
}

export function calculateReportStats(posts: ReportStatsPost[]): ReportStats {
  const sorted = [...posts].sort((a, b) => b.engagements - a.engagements)

  return {
    totalReach: sumOrNull(posts.map(post => post.reach)),
    totalImpressions: sumOrNull(posts.map(post => post.impressions)),
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

// Best platform is ranked by reach first (missing reach sorts low), then
// engagements as a tie-breaker.
export function bestPlatform(breakdowns: PlatformBreakdown[]): PlatformBreakdown | null {
  const withData = breakdowns.filter(breakdown => breakdown.hasData)
  if (withData.length === 0) return null

  return [...withData].sort((a, b) => {
    const ar = a.stats.totalReach ?? -1
    const br = b.stats.totalReach ?? -1
    if (br !== ar) return br - ar
    return b.stats.totalEngagements - a.stats.totalEngagements
  })[0]
}

// ─── Master report: CSV posts + manual metrics combined ─────────────────────

export type PlatformSource = 'posts' | 'manual' | 'none'

export interface PlatformView {
  platform: Platform
  label: string
  source: PlatformSource
  // null when the metric was not available from this platform's source.
  reach: number | null
  views: number | null
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
  totalReach: number | null
  totalViews: number | null
  totalEngagements: number
  bestPlatform: PlatformView | null
  bestPostOverall: ReportStatsPost | null
}

export function isMetaSyncedManualMetric(metric: ManualPlatformMetric | null): boolean {
  return metric?.source_type === 'other' && metric.general_notes?.startsWith('Meta sync account totals') === true
}

function metaMetricAvailable(metric: ManualPlatformMetric | null, key: 'views' | 'reach' | 'engagements' | 'profile_visits' | 'followers'): boolean {
  if (!metric) return false
  if (!isMetaSyncedManualMetric(metric)) return true
  // For Meta synced metrics, 0 means "unavailable" (we couldn't fetch it).
  return metric[key] > 0
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
      // Meta synced manual metric is the PRIMARY source for account-level totals.
      // Post data provides post count, top content, captions, and engagement fallback.
      const viewsAvailable = metaMetricAvailable(manual, 'views')
      const reachAvailable = metaMetricAvailable(manual, 'reach')
      const engagementsAvailable = metaMetricAvailable(manual, 'engagements')
      return {
        platform,
        label: PLATFORM_LABELS[platform],
        source: 'posts',
        reach: reachAvailable ? manual!.reach : stats.totalReach,
        views: viewsAvailable ? manual!.views : stats.totalImpressions,
        engagements: engagementsAvailable ? manual!.engagements : stats.totalEngagements,
        postCount: stats.postCount,
        bestPost: stats.bestPost,
        topPosts: stats.topPosts,
        manual,
      }
    }

    if (manual) {
      const viewsAvailable = metaMetricAvailable(manual, 'views')
      const reachAvailable = metaMetricAvailable(manual, 'reach')
      const engagementsAvailable = metaMetricAvailable(manual, 'engagements')
      return {
        platform,
        label: PLATFORM_LABELS[platform],
        source: 'manual',
        reach: reachAvailable ? manual.reach : null,
        views: viewsAvailable ? manual.views : null,
        engagements: engagementsAvailable ? manual.engagements : 0,
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
      reach: null,
      views: null,
      engagements: 0,
      postCount: 0,
      bestPost: null,
      topPosts: [],
      manual: null,
    }
  })

  const withData = platforms.filter(view => view.source !== 'none')

  const bestPlatform = [...withData].sort((a, b) => {
    const ar = a.reach ?? -1
    const br = b.reach ?? -1
    if (br !== ar) return br - ar
    return b.engagements - a.engagements
  })[0] ?? null

  return {
    platforms,
    // Totals stay null when no platform reported the metric; otherwise sum only
    // the platforms that did. Never invent a 0.
    totalReach: sumOrNull(withData.map(view => view.reach)),
    totalViews: sumOrNull(withData.map(view => view.views)),
    totalEngagements: withData.reduce((sum, view) => sum + view.engagements, 0),
    bestPlatform,
    bestPostOverall: posts.length > 0 ? calculateReportStats(posts).bestPost : null,
  }
}

export function totalManualProfileVisits(manualMetrics: ManualPlatformMetric[]): number | null {
  if (manualMetrics.length === 0) return null
  const available = manualMetrics.filter(metric => metaMetricAvailable(metric, 'profile_visits'))
  if (available.length === 0) return null
  return available.reduce((sum, metric) => sum + metric.profile_visits, 0)
}

export function totalManualFollowers(manualMetrics: ManualPlatformMetric[]) {
  if (manualMetrics.length === 0) return null
  const available = manualMetrics.filter(metric => metaMetricAvailable(metric, 'followers'))
  if (available.length === 0) return null
  return available.reduce((sum, metric) => sum + metric.followers, 0)
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

// Like compareMetric, but treats a null current value as "not available" so the
// UI never shows a fake 0 for a missing metric.
export function compareNullable(
  current: number | null | undefined,
  previous: number | null | undefined
): MetricMovement {
  if (typeof current !== 'number') return unavailableMetric()
  return compareMetric(current, typeof previous === 'number' ? previous : null)
}

// Formats a possibly-missing metric for display. Returns null for
// null/undefined (callers should omit the metric entirely), and the
// formatted number (including a real 0) otherwise.
export function formatMetric(value: number | null | undefined): string | null {
  return typeof value === 'number' ? formatNumber(value) : null
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
    // Views/reach are null when neither source reported them → "not available".
    views: compareNullable(current.totalViews, previous?.totalViews),
    reach: compareNullable(current.totalReach, previous?.totalReach),
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
