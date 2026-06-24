import type { ManualPlatformMetric } from './db/manualMetrics'
import type { MasterReportData, PlatformView, ReportStatsPost } from './reportStats'
import {
  PLATFORM_LABELS,
  totalManualFollowers,
  totalManualProfileVisits,
} from './reportStats'

// ── CG Dynamics report performance model ─────────────────────────────────────
//
// Turns synced Meta metrics (current + previous month) into a client-safe
// performance story: metric cards with growth, a growth series for the chart,
// auto recommendations, an honest content tone, and an overall performance
// level. It never invents 0s — a metric with no real value is simply omitted.

export type TrendStatus = 'positive' | 'negative' | 'neutral'
export type Direction = 'up' | 'down' | 'flat'
export type PerformanceLevel =
  | 'strong'
  | 'improving'
  | 'steady'
  | 'needs_attention'
  | 'baseline_only'
export type ContentTone = 'top' | 'learning' | 'baseline'

// Engagement threshold below which a "best" post is NOT celebrated as a win.
export const WEAK_CONTENT_THRESHOLD = 25

export interface PerformanceMetric {
  key: string
  label: string
  current: number
  previous: number | null
  change: number | null
  percent: number | null
  // null when there is no previous month to compare against.
  direction: Direction | null
  trend: TrendStatus
  // e.g. "vs April 2026" — null when there is no comparison.
  comparisonLabel: string | null
}

export interface GrowthSeriesItem {
  key: string
  label: string
  current: number
  previous: number
  percent: number | null
  direction: Direction
}

export interface TopContent {
  post: ReportStatsPost
  tone: ContentTone
  platformLabel: string | null
  // The single headline number we are comfortable showing for this tone.
  interactions: number
}

export interface ReportPerformance {
  monthLabel: string
  previousMonthLabel: string | null
  hasComparison: boolean

  // Client-safe metric cards (only metrics with real values).
  metrics: PerformanceMetric[]

  // Pairs for the growth chart (only metrics with BOTH months available).
  growthSeries: GrowthSeriesItem[]

  bestPlatform: PlatformView | null
  weakestArea: string | null
  contentVolume: number
  audienceSize: number | null

  performanceLevel: PerformanceLevel
  performanceHeadline: string
  recommendations: string[]

  topContent: TopContent | null

  // Admin-only: client-safe metrics that could not be synced this month.
  adminMissingMetrics: string[]
}

interface BuildInput {
  master: MasterReportData
  previousMaster: MasterReportData | null
  currentManual: ManualPlatformMetric[]
  previousManual: ManualPlatformMetric[]
  monthLabel: string
  previousMonthLabel: string | null
}

function totalPosts(master: MasterReportData): number {
  return master.platforms.reduce((sum, view) => sum + view.postCount, 0)
}

function trendFor(direction: Direction | null): TrendStatus {
  if (direction === 'up') return 'positive'
  if (direction === 'down') return 'negative'
  return 'neutral'
}

function buildMetric(
  key: string,
  label: string,
  current: number | null,
  previous: number | null,
  previousMonthLabel: string | null,
): PerformanceMetric | null {
  // Omit metrics with no real current value — never show a fake 0.
  if (typeof current !== 'number') return null

  const hasPrev = typeof previous === 'number'
  const change = hasPrev ? current - (previous as number) : null
  const percent =
    hasPrev && (previous as number) !== 0 ? (change! / (previous as number)) * 100 : null
  const direction: Direction | null =
    change === null ? null : change > 0 ? 'up' : change < 0 ? 'down' : 'flat'

  return {
    key,
    label,
    current,
    previous: hasPrev ? (previous as number) : null,
    change,
    percent,
    direction,
    trend: trendFor(direction),
    comparisonLabel: hasPrev && previousMonthLabel ? `vs ${previousMonthLabel}` : null,
  }
}

export function buildReportPerformance(input: BuildInput): ReportPerformance {
  const { master, previousMaster, currentManual, previousManual, monthLabel, previousMonthLabel } = input

  const hasComparison = Boolean(
    previousMonthLabel &&
      (previousMaster !== null ||
        previousManual.length > 0) &&
      // Only treat it as a real comparison if at least one previous figure exists.
      (previousMaster?.totalReach != null ||
        previousMaster?.totalViews != null ||
        (previousMaster?.totalEngagements ?? 0) > 0 ||
        totalManualFollowers(previousManual) !== null ||
        totalManualProfileVisits(previousManual) !== null ||
        totalPosts(previousMaster ?? emptyMaster()) > 0),
  )

  const prevLabel = hasComparison ? previousMonthLabel : null

  const curFollowers = totalManualFollowers(currentManual)
  const prevFollowers = hasComparison ? totalManualFollowers(previousManual) : null
  const curVisits = totalManualProfileVisits(currentManual)
  const prevVisits = hasComparison ? totalManualProfileVisits(previousManual) : null

  const curPosts = totalPosts(master)
  const prevPosts = previousMaster ? totalPosts(previousMaster) : null

  // Build the ordered, client-safe metric set. Order mirrors Meta's overview.
  const candidates: Array<PerformanceMetric | null> = [
    buildMetric('views', 'Views', master.totalViews, hasComparison ? previousMaster?.totalViews ?? null : null, prevLabel),
    buildMetric('reach', 'Reach', master.totalReach, hasComparison ? previousMaster?.totalReach ?? null : null, prevLabel),
    buildMetric(
      'content_interactions',
      'Content interactions',
      master.totalEngagements > 0 ? master.totalEngagements : null,
      hasComparison ? previousMaster?.totalEngagements ?? null : null,
      prevLabel,
    ),
    buildMetric('profile_visits', 'Profile visits', curVisits, prevVisits, prevLabel),
    buildMetric('current_followers', 'Current followers', curFollowers, prevFollowers, prevLabel),
    buildMetric('posts', 'Posts published', curPosts > 0 ? curPosts : null, hasComparison ? prevPosts : null, prevLabel),
  ]
  const metrics = candidates.filter((m): m is PerformanceMetric => m !== null)

  // Growth chart: prefer Reach, Content interactions, Posts, Current followers —
  // only where BOTH months have a real value so we can draw a true comparison.
  const growthKeys = ['reach', 'content_interactions', 'posts', 'current_followers', 'views']
  const growthSeries: GrowthSeriesItem[] = metrics
    .filter(m => growthKeys.includes(m.key) && m.previous !== null && m.direction !== null)
    .sort((a, b) => growthKeys.indexOf(a.key) - growthKeys.indexOf(b.key))
    .slice(0, 4)
    .map(m => ({
      key: m.key,
      label: m.label,
      current: m.current,
      previous: m.previous as number,
      percent: m.percent,
      direction: m.direction as Direction,
    }))

  // Top content tone (Part 6: never celebrate weak content).
  const best = master.bestPostOverall
  let topContent: TopContent | null = null
  if (best) {
    const interactions = best.engagements
    const tone: ContentTone =
      interactions >= WEAK_CONTENT_THRESHOLD ? 'top' : interactions > 0 ? 'learning' : 'baseline'
    topContent = {
      post: best,
      tone,
      platformLabel: best.platform ? PLATFORM_LABELS[best.platform] : null,
      interactions,
    }
  }

  // Weakest area: the comparable metric that declined the most; otherwise an
  // engagement-quality flag when reach is healthy but interactions are thin.
  const declined = metrics
    .filter(m => m.direction === 'down' && m.percent !== null)
    .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))
  let weakestArea: string | null = declined[0]?.label ?? null
  const reachVal = master.totalReach ?? 0
  const engVal = master.totalEngagements
  if (!weakestArea && reachVal >= 500 && engVal > 0 && engVal / reachVal < 0.01) {
    weakestArea = 'Engagement quality'
  }
  if (!weakestArea && (best?.engagements ?? 0) < WEAK_CONTENT_THRESHOLD && curPosts > 0) {
    weakestArea = 'Audience response'
  }

  const performanceLevel = computeLevel(metrics, master, hasComparison)

  return {
    monthLabel,
    previousMonthLabel: prevLabel,
    hasComparison,
    metrics,
    growthSeries,
    bestPlatform: master.bestPlatform,
    weakestArea,
    contentVolume: curPosts,
    audienceSize: curFollowers,
    performanceLevel,
    performanceHeadline: headlineFor(performanceLevel, monthLabel),
    recommendations: buildRecommendations({ master, metrics, best, curPosts, performanceLevel }),
    topContent,
    adminMissingMetrics: buildAdminMissing(master),
  }
}

function emptyMaster(): MasterReportData {
  return {
    platforms: [],
    totalReach: null,
    totalViews: null,
    totalEngagements: 0,
    bestPlatform: null,
    bestPostOverall: null,
  }
}

function computeLevel(
  metrics: PerformanceMetric[],
  master: MasterReportData,
  hasComparison: boolean,
): PerformanceLevel {
  if (!hasComparison) return 'baseline_only'

  const comparable = metrics.filter(m => m.direction !== null && m.direction !== 'flat')
  const ups = comparable.filter(m => m.trend === 'positive').length
  const downs = comparable.filter(m => m.trend === 'negative').length
  const score = ups - downs
  const interactions = master.totalEngagements

  if (score >= 2 && interactions >= 50) return 'strong'
  if (score >= 1) return 'improving'
  if (score <= -2 || (downs > ups && downs >= 2)) return 'needs_attention'
  if (downs > ups) return 'needs_attention'
  return 'steady'
}

function headlineFor(level: PerformanceLevel, monthLabel: string): string {
  switch (level) {
    case 'strong':
      return `${monthLabel} was a strong month — momentum is building.`
    case 'improving':
      return `${monthLabel} moved in the right direction with clear gains.`
    case 'steady':
      return `${monthLabel} held steady — a stable base to build on.`
    case 'needs_attention':
      return `${monthLabel} softened in places — here is where we focus next.`
    case 'baseline_only':
      return `${monthLabel} sets the baseline we will grow from next month.`
  }
}

function buildRecommendations(input: {
  master: MasterReportData
  metrics: PerformanceMetric[]
  best: ReportStatsPost | null
  curPosts: number
  performanceLevel: PerformanceLevel
}): string[] {
  const { master, metrics, best, curPosts } = input
  const recs: string[] = []

  const reach = master.totalReach
  const interactions = master.totalEngagements
  const bestEng = best?.engagements ?? 0

  // Reach is decent but interactions are thin → engagement quality.
  if (typeof reach === 'number' && reach >= 500 && interactions > 0 && interactions / reach < 0.02) {
    recs.push('Lift engagement quality with stronger calls to action and reasons to comment.')
    recs.push('Test carousel and product-comparison posts that invite a response.')
    recs.push('Lead more captions with a question to spark conversation.')
  } else if (bestEng > 0 && bestEng < WEAK_CONTENT_THRESHOLD) {
    recs.push('Sharpen opening hooks so the first line stops the scroll.')
    recs.push('Make the product value clearer and add one obvious call to action per post.')
  }

  // Posting consistency.
  if (curPosts > 0 && curPosts < 8) {
    recs.push('Increase posting consistency to keep the audience warm between campaigns.')
  }

  // Audience direction.
  const followers = metrics.find(m => m.key === 'current_followers')
  if (followers && followers.direction === 'down') {
    recs.push('Prioritise audience retention with saveable, repeat-value content.')
  }

  // Channel strategy.
  if (master.bestPlatform?.platform === 'instagram') {
    recs.push('Use Instagram as the primary visibility channel and repurpose the strongest posts to Facebook.')
  } else if (master.bestPlatform?.platform === 'facebook') {
    recs.push('Facebook is leading on reach — extend its best formats to Instagram for compounding visibility.')
  }

  // Always give at least a forward action.
  if (recs.length === 0) {
    recs.push('Double down on the formats that earned the most interactions this month.')
    recs.push('Plan one campaign moment for next month to create a visible spike.')
  }

  // Keep it tight and client-safe.
  return [...new Set(recs)].slice(0, 4)
}

function buildAdminMissing(master: MasterReportData): string[] {
  const missing: string[] = []
  if (master.totalViews === null) missing.push('Views (account total not synced)')
  if (master.totalReach === null) missing.push('Reach (account total not synced)')
  return missing
}
