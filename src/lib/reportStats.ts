import type { ImportedMetaPost } from './db/importedMetaPosts'
import type { ClientReportPost, ReportPost } from './db/reports'
import type { ReportManualMetric } from './db/manualMetrics'
import { projectMetaPostEngagement } from '../../supabase/functions/_shared/metaPostEngagement.ts'

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
  // null unless every component in the labelled definition was observed.
  reach: number | null
  impressions: number | null
  engagements: number | null
  engagementKnownSubtotal: number | null
  engagementDefinitionId: string | null
  engagementDefinitionLabel: string | null
  engagementSource: string | null
  engagementObservedAt: string | null
  engagementCoverage: { observed: number; required: number } | null
  engagementCompleteness: 'complete' | 'partial' | 'unavailable' | 'invalid'
  post_type: string | null
  platform: Platform | null
  imageUrl: string | null
  metaObjectId: string | null
}

export interface ReportStats {
  totalReach: number | null
  totalImpressions: number | null
  totalEngagements: number | null
  knownEngagementSubtotal: number | null
  engagementDefinitionId: string | null
  engagementDefinitionLabel: string | null
  engagementObservedAt: string | null
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
  const engagement = projectMetaPostEngagement(
    {
      engagements: post.engagements,
      imported_meta_post_id: post.id,
      import_source: post.source,
    },
    post.platform,
    null,
  )
  return {
    id: post.id,
    caption: post.caption,
    permalink: post.permalink,
    publish_time: post.publish_time,
    reach: post.reach,
    impressions: post.impressions,
    engagements: engagement.completeTotal,
    engagementKnownSubtotal: engagement.knownSubtotal,
    engagementDefinitionId: engagement.definitionId,
    engagementDefinitionLabel: engagement.definitionLabel,
    engagementSource: engagement.source,
    engagementObservedAt: engagement.observedAt,
    engagementCoverage: engagement.coverage,
    engagementCompleteness: engagement.completeness,
    post_type: post.post_type,
    platform: post.platform,
    imageUrl: null,
    metaObjectId: post.meta_post_id,
  }
}

export function reportPostToStatsPost(post: ReportPost | ClientReportPost): ReportStatsPost {
  if ('impressions' in post) {
    return {
      id: post.id,
      caption: post.caption,
      permalink: post.permalink,
      publish_time: post.publish_time,
      reach: post.reach,
      impressions: post.impressions,
      engagements: post.engagements,
      engagementKnownSubtotal: post.engagement_known_subtotal,
      engagementDefinitionId: post.engagement_definition_id,
      engagementDefinitionLabel: post.engagement_definition_label,
      engagementSource: post.engagement_source,
      engagementObservedAt: post.engagement_observed_at,
      engagementCoverage: post.engagement_coverage,
      engagementCompleteness: post.engagement_completeness,
      post_type: post.post_type,
      platform: post.platform,
      imageUrl: null,
      metaObjectId: post.id,
    }
  }
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

  const engagement = projectMetaPostEngagement(raw, post.platform, post.created_at)

  return {
    id: post.id,
    caption: post.caption,
    permalink: post.permalink,
    publish_time: post.publish_time,
    reach,
    impressions,
    engagements: engagement.completeTotal,
    engagementKnownSubtotal: engagement.knownSubtotal,
    engagementDefinitionId: engagement.definitionId,
    engagementDefinitionLabel: engagement.definitionLabel,
    engagementSource: engagement.source,
    engagementObservedAt: engagement.observedAt,
    engagementCoverage: engagement.coverage,
    engagementCompleteness: engagement.completeness,
    post_type: raw.content_type ?? post.meta_post_type,
    platform: post.platform,
    imageUrl: raw.full_picture ?? raw.thumbnail_url ?? raw.media_url ?? null,
    metaObjectId: post.meta_post_id,
  }
}

export type RankingMetric = 'views' | 'reach' | 'interactions'

// Ranks posts by the strongest available metric, mirroring Meta's "Top content"
// (which defaults to top content by views). Prefers views, then reach, then
// content interactions — using whichever metric is actually present in the set.
// Returns the ranked list and which metric decided the order.
export function rankPostsByStrength(posts: ReportStatsPost[]): {
  posts: ReportStatsPost[]
  metric: RankingMetric | null
} {
  if (posts.length === 0) return { posts: [], metric: null }

  const anyViews = posts.some(post => typeof post.impressions === 'number')
  const anyReach = posts.some(post => typeof post.reach === 'number')
  const completePosts = posts
    .filter(post => typeof post.engagements === 'number' && post.engagementDefinitionId)
  const completeDefinitions = new Set(completePosts.map(post => post.engagementDefinitionId))
  const comparableInteractions = completeDefinitions.size === 1 && completePosts.length > 0
  const metric: RankingMetric | null = anyViews ? 'views' : anyReach ? 'reach' : comparableInteractions ? 'interactions' : null

  if (!metric) return { posts: [], metric: null }
  const rankingPool = metric === 'interactions' ? completePosts : posts

  const valueFor = (post: ReportStatsPost) =>
    metric === 'views'
      ? post.impressions ?? -1
      : metric === 'reach'
        ? post.reach ?? -1
        : post.engagements ?? -1

  const ranked = [...rankingPool].sort((a, b) => {
    const diff = valueFor(b) - valueFor(a)
    if (diff !== 0) return diff
    // Interactions only break ties when both rows share one complete definition.
    if (a.engagementDefinitionId === b.engagementDefinitionId
      && typeof a.engagements === 'number' && typeof b.engagements === 'number') {
      const engagementDiff = b.engagements - a.engagements
      if (engagementDiff !== 0) return engagementDiff
    }
    return a.id.localeCompare(b.id)
  })

  return { posts: ranked, metric }
}

export function calculateReportStats(posts: ReportStatsPost[], evidencePosts: ReportStatsPost[] = posts): ReportStats {
  const { posts: ranked } = rankPostsByStrength(evidencePosts)
  const complete = posts.filter(post => typeof post.engagements === 'number' && post.engagementDefinitionId)
  const definitions = new Set(complete.map(post => post.engagementDefinitionId))
  const observationTimes = new Set(posts.map(post => post.engagementObservedAt).filter(Boolean))
  const engagementDefinitionId = definitions.size === 1 && complete.length === posts.length && observationTimes.size === 1
    ? complete[0]?.engagementDefinitionId ?? null
    : null
  const engagementDefinitionLabel = engagementDefinitionId ? complete[0]?.engagementDefinitionLabel ?? null : null
  const engagementObservedAt = engagementDefinitionId ? complete[0]?.engagementObservedAt ?? null : null
  const subtotalTimes = new Set(posts
    .filter(post => post.engagementKnownSubtotal !== null)
    .map(post => post.engagementObservedAt)
    .filter(Boolean))

  return {
    totalReach: sumOrNull(posts.map(post => post.reach)),
    totalImpressions: sumOrNull(posts.map(post => post.impressions)),
    totalEngagements: engagementDefinitionId === null
      ? null
      : complete.reduce((sum, post) => sum + (post.engagements as number), 0),
    knownEngagementSubtotal: subtotalTimes.size === 1 ? sumOrNull(posts.map(post => post.engagementKnownSubtotal)) : null,
    engagementDefinitionId,
    engagementDefinitionLabel,
    engagementObservedAt,
    postCount: posts.length,
    bestPost: ranked[0] ?? null,
    topPosts: ranked.slice(0, 3),
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
    return a.platform.localeCompare(b.platform)
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
  engagements: number | null
  engagementKnownSubtotal: number | null
  engagementDefinitionId: string | null
  engagementDefinitionLabel: string | null
  engagementObservedAt: string | null
  // Populated when source === 'posts'
  postCount: number
  bestPost: ReportStatsPost | null
  topPosts: ReportStatsPost[]
  // Populated when source === 'manual'
  manual: ReportManualMetric | null
}

export interface MasterReportData {
  platforms: PlatformView[]
  totalReach: number | null
  totalViews: number | null
  totalEngagements: number | null
  bestPlatform: PlatformView | null
  bestPostOverall: ReportStatsPost | null
}

export function isMetaSyncedManualMetric(metric: ReportManualMetric | null): boolean {
  return metric?.source_type === 'other' && metric.general_notes?.startsWith('Meta sync account totals') === true
}

function metaMetricAvailable(metric: ReportManualMetric | null, key: 'views' | 'reach' | 'engagements' | 'profile_visits' | 'followers'): boolean {
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
  manualMetrics: ReportManualMetric[],
  excludedContentKeys: ReadonlySet<string> = new Set(),
): MasterReportData {
  const platforms: PlatformView[] = PLATFORMS.map(platform => {
    const platformPosts = posts.filter(post => post.platform === platform)
    const evidencePosts = platformPosts.filter(post => !excludedContentKeys.has(contentEvidenceKey(post)))
    const manual = manualMetrics.find(metric => metric.platform === platform) ?? null

    if (platformPosts.length > 0) {
      const stats = calculateReportStats(platformPosts, evidencePosts)
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
        engagementKnownSubtotal: engagementsAvailable ? manual!.engagements : stats.knownEngagementSubtotal,
        engagementDefinitionId: engagementsAvailable ? `${platform}_account_content_interactions` : stats.engagementDefinitionId,
        engagementDefinitionLabel: engagementsAvailable ? `${PLATFORM_LABELS[platform]} account content interactions` : stats.engagementDefinitionLabel,
        engagementObservedAt: engagementsAvailable ? null : stats.engagementObservedAt,
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
        engagements: engagementsAvailable ? manual.engagements : null,
        engagementKnownSubtotal: engagementsAvailable ? manual.engagements : null,
        engagementDefinitionId: engagementsAvailable ? `${platform}_account_content_interactions` : null,
        engagementDefinitionLabel: engagementsAvailable ? `${PLATFORM_LABELS[platform]} account content interactions` : null,
        engagementObservedAt: null,
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
      engagements: null,
      engagementKnownSubtotal: null,
      engagementDefinitionId: null,
      engagementDefinitionLabel: null,
      engagementObservedAt: null,
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
    return a.platform.localeCompare(b.platform)
  })[0] ?? null

  // Views and reach are UNIQUE-audience style metrics with different per-platform
  // definitions. They must NEVER produce a cross-platform master total — not even
  // a single-platform value promoted to a combined field, because a combined
  // Overview card must never carry Instagram-only (or Facebook-only) data. The
  // cross-platform master therefore always reports null for these; views, viewers
  // and reach are rendered ONLY in explicitly-labelled per-platform sections
  // (platforms[] here, and the availability-aware Overview in overviewModel.ts).
  // See docs/client-intelligence/META-REPORTING-TRUTH-STRATEGY.md.
  return {
    platforms,
    totalReach: null,
    totalViews: null,
    // Facebook and Instagram expose different engagement definitions. Never
    // promote them into an unlabeled cross-platform total.
    totalEngagements: null,
    bestPlatform,
    bestPostOverall: posts.length > 0
      ? calculateReportStats(posts, posts.filter(post => !excludedContentKeys.has(contentEvidenceKey(post)))).bestPost
      : null,
  }
}

export function contentEvidenceKey(post: Pick<ReportStatsPost, 'platform' | 'metaObjectId'>): string {
  return `${post.platform ?? 'unknown'}:${post.metaObjectId ?? ''}`
}

export function totalManualProfileVisits(manualMetrics: ReportManualMetric[]): number | null {
  if (manualMetrics.length === 0) return null
  const available = manualMetrics.filter(metric => metaMetricAvailable(metric, 'profile_visits'))
  if (available.length === 0) return null
  return available.reduce((sum, metric) => sum + metric.profile_visits, 0)
}

export function totalManualFollowers(manualMetrics: ReportManualMetric[]) {
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
  currentManualMetrics: ReportManualMetric[],
  previousManualMetrics: ReportManualMetric[]
): PerformanceMovement {
  const currentFollowers = totalManualFollowers(currentManualMetrics)
  const previousFollowers = totalManualFollowers(previousManualMetrics)
  const currentProfileVisits = totalManualProfileVisits(currentManualMetrics)
  const previousProfileVisits = totalManualProfileVisits(previousManualMetrics)

  return {
    // Views/reach are null when neither source reported them → "not available".
    views: compareNullable(current.totalViews, previous?.totalViews),
    reach: compareNullable(current.totalReach, previous?.totalReach),
    engagements: compareNullable(current.totalEngagements, previous?.totalEngagements),
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
