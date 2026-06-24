import type { ManualPlatformMetric } from './db/manualMetrics'
import type { MasterReportData, Platform, PlatformView, ReportStatsPost } from './reportStats'
import {
  PLATFORM_LABELS,
  isMetaSyncedManualMetric,
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
// Views / reach a post needs before it can be celebrated as "top performing"
// even when interactions are thin — mirrors Meta defaulting to top-by-views.
export const STRONG_VIEWS_THRESHOLD = 100
export const STRONG_REACH_THRESHOLD = 100

// Decides how a single post should be framed. A post can be "top" on the
// strength of views or reach even with low interactions (Meta's top-by-views
// behaviour), but a low-interaction post with no strong views/reach is framed
// as learning — never celebrated as a win.
export function contentToneFor(post: ReportStatsPost): {
  tone: ContentTone
  rankingMetricLabel: string | null
  reason: string
} {
  const views = post.impressions
  const reach = post.reach
  const interactions = post.engagements

  const strongViews = typeof views === 'number' && views >= STRONG_VIEWS_THRESHOLD
  const strongReach = typeof reach === 'number' && reach >= STRONG_REACH_THRESHOLD
  const strongInteractions = interactions >= WEAK_CONTENT_THRESHOLD

  if (strongViews || strongReach || strongInteractions) {
    const rankingMetricLabel = strongViews ? 'views' : strongReach ? 'reach' : 'content interactions'
    return {
      tone: 'top',
      rankingMetricLabel,
      reason: `Strong ${rankingMetricLabel} — shown as top performing content.`,
    }
  }

  const hasSignal = interactions > 0 || typeof views === 'number' || typeof reach === 'number'
  if (hasSignal) {
    return {
      tone: 'learning',
      rankingMetricLabel:
        typeof views === 'number' ? 'views' : typeof reach === 'number' ? 'reach' : 'content interactions',
      reason: `Top content interactions (${interactions}) are below ${WEAK_CONTENT_THRESHOLD} with no stronger views/reach signal — framed as content learning, not a win.`,
    }
  }

  return { tone: 'baseline', rankingMetricLabel: null, reason: 'No engagement signal yet — shown as a content baseline.' }
}

function topContentFor(post: ReportStatsPost): TopContent {
  const { tone, rankingMetricLabel, reason } = contentToneFor(post)
  return {
    post,
    tone,
    platformLabel: post.platform ? PLATFORM_LABELS[post.platform] : null,
    interactions: post.engagements,
    rankingMetricLabel,
    toneReason: reason,
  }
}

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
  // Which metric earned this post the top slot ("views" / "reach" / ...).
  rankingMetricLabel: string | null
  // Admin-only: why this tone was chosen.
  toneReason: string
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
  const topContent: TopContent | null = best ? topContentFor(best) : null

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
    performanceHeadline: overallHeadline(metrics, performanceLevel, monthLabel, hasComparison),
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
      return `${monthLabel} set a clearer baseline — the next step is converting reach into stronger audience response.`
    case 'baseline_only':
      return `${monthLabel} sets the baseline we will grow from next month.`
  }
}

function directionOf(metrics: PerformanceMetric[], key: string): Direction | null {
  return metrics.find(m => m.key === key)?.direction ?? null
}

// Professional, honest, constructive headline — no panic wording, no fake
// positivity. Prefers a data-aware story (e.g. visibility up / engagement soft)
// and otherwise falls back to the level-based copy.
function overallHeadline(
  metrics: PerformanceMetric[],
  level: PerformanceLevel,
  monthLabel: string,
  hasComparison: boolean,
): string {
  if (hasComparison) {
    const reach = directionOf(metrics, 'reach')
    const views = directionOf(metrics, 'views')
    const inter = directionOf(metrics, 'content_interactions')
    const visibilityUp = reach === 'up' || views === 'up'

    if (visibilityUp && inter === 'down') {
      return `${monthLabel} improved visibility, while engagement quality is the next focus.`
    }
    if (visibilityUp && (inter === 'up' || inter === 'flat')) {
      return `${monthLabel} built on both visibility and audience response.`
    }
    if ((reach === 'down' || views === 'down') && inter === 'up') {
      return `${monthLabel} earned stronger engagement — the next step is widening reach.`
    }
  }
  return headlineFor(level, monthLabel)
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

// ── Per-platform performance (Meta-style platform dashboard) ─────────────────

type ManualMetricKey = 'views' | 'reach' | 'engagements' | 'profile_visits' | 'followers'

export interface PlatformCardSource {
  label: string
  source: string
}

export interface PlatformPerformance {
  platform: Platform
  label: string
  hasComparison: boolean
  performanceHeadline: string

  // Period metric cards (never current followers — that lives in audienceBase).
  cards: PerformanceMetric[]
  // Snapshot follower count, shown as a static "Audience base" card.
  audienceBase: number | null
  // True period metrics that have a real previous-month comparison.
  momentum: PerformanceMetric[]

  topContent: TopContent | null
  recommendations: string[]

  // Admin-only diagnostics.
  cardSources: PlatformCardSource[]
  rankingMetricLabel: string | null
  contentToneReason: string | null
  followerGrowthSkippedReason: string | null
}

function manualValueAvailable(manual: ManualPlatformMetric | null, key: ManualMetricKey): boolean {
  if (!manual) return false
  // For Meta-synced totals a 0 means "could not fetch" → unavailable.
  if (!isMetaSyncedManualMetric(manual)) return true
  return manual[key] > 0
}

function cardSourceLabel(view: PlatformView, key: string): string {
  if (key === 'posts') return 'Post count'
  const manualKey: ManualMetricKey =
    key === 'content_interactions' ? 'engagements' : key === 'profile_visits' ? 'profile_visits' : (key as 'views' | 'reach')

  if (view.manual && manualValueAvailable(view.manual, manualKey)) {
    return isMetaSyncedManualMetric(view.manual) ? 'Meta account total' : 'Manual summary'
  }
  return view.source === 'posts' ? 'Post aggregation' : 'Not available'
}

function platformHeadline(label: string, cards: PerformanceMetric[], hasComparison: boolean): string {
  if (!hasComparison) return `${label} sets this month's baseline to grow from.`

  const reach = directionOf(cards, 'reach')
  const views = directionOf(cards, 'views')
  const inter = directionOf(cards, 'content_interactions')
  const visibilityUp = reach === 'up' || views === 'up'

  if (visibilityUp && inter === 'down') {
    return `${label} reached more people this month, while engagement quality is the next focus.`
  }
  if (visibilityUp && (inter === 'up' || inter === 'flat')) {
    return `${label} grew on both reach and audience response this month.`
  }
  if ((reach === 'down' || views === 'down') && inter === 'up') {
    return `${label} earned stronger engagement — the next step is widening reach.`
  }
  return `${label} held steady this month — a stable base to build on.`
}

function buildPlatformRecommendations(input: {
  view: PlatformView
  cards: PerformanceMetric[]
  topContent: TopContent | null
}): string[] {
  const { view, cards, topContent } = input
  const recs: string[] = []
  const dir = (key: string) => directionOf(cards, key)

  const reachUp = dir('reach') === 'up' || dir('views') === 'up'
  const interDown = dir('content_interactions') === 'down'
  const postsDown = dir('posts') === 'down'

  if (reachUp && interDown) {
    recs.push(
      'The content reached more people, but response quality softened. Next month should focus on clearer hooks and stronger calls to action.',
    )
  }

  const weakContent = topContent ? topContent.tone !== 'top' : false
  const reach = view.reach ?? 0
  const thinEngagement = reach >= 500 && view.engagements > 0 && view.engagements / reach < 0.02
  if (weakContent || thinEngagement) {
    recs.push('Test question-led captions, product comparison posts, and carousel-style storytelling to lift engagement.')
  }

  if (postsDown || (view.postCount > 0 && view.postCount < 8)) {
    recs.push('Increase posting consistency before judging performance direction.')
  }

  if (view.platform === 'instagram') {
    recs.push('Use Instagram as the primary visibility channel and repurpose the strongest posts to Facebook.')
  } else if (view.platform === 'facebook') {
    recs.push('Extend Facebook’s strongest formats to Instagram for compounding visibility.')
  }

  if (recs.length === 0) {
    recs.push('Double down on the formats that earned the most attention this month and keep the posting rhythm consistent.')
  }

  return [...new Set(recs)].slice(0, 4)
}

export function buildPlatformPerformance(input: {
  view: PlatformView
  previousView: PlatformView | null
  previousManual: ManualPlatformMetric | null
  monthLabel: string
  previousMonthLabel: string | null
}): PlatformPerformance {
  const { view, previousView, previousManual, previousMonthLabel } = input
  const prev = previousView
  const prevManual = previousManual ?? prev?.manual ?? null

  // Followers is a point-in-time snapshot → audience base card only, never growth.
  const followersAvailable = manualValueAvailable(view.manual, 'followers')
  const audienceBase = followersAvailable ? view.manual!.followers : null

  const profileVisitsAvailable = manualValueAvailable(view.manual, 'profile_visits')
  const prevProfileVisits =
    prevManual && manualValueAvailable(prevManual, 'profile_visits') ? prevManual.profile_visits : null

  const candidates: Array<PerformanceMetric | null> = [
    buildMetric('views', 'Views', view.views, prev?.views ?? null, previousMonthLabel),
    buildMetric('reach', 'Reach', view.reach, prev?.reach ?? null, previousMonthLabel),
    buildMetric(
      'content_interactions',
      'Content interactions',
      view.engagements > 0 ? view.engagements : null,
      prev && prev.engagements > 0 ? prev.engagements : null,
      previousMonthLabel,
    ),
    profileVisitsAvailable
      ? buildMetric(
          'profile_visits',
          'Profile visits',
          view.manual!.profile_visits,
          prevProfileVisits,
          previousMonthLabel,
        )
      : null,
    buildMetric(
      'posts',
      'Posts published',
      view.postCount > 0 ? view.postCount : null,
      prev ? prev.postCount : null,
      previousMonthLabel,
    ),
  ]
  const cards = candidates.filter((m): m is PerformanceMetric => m !== null)

  const hasComparison = cards.some(m => m.direction !== null)
  const momentum = cards.filter(m => m.direction !== null)

  const topContent = view.bestPost ? topContentFor(view.bestPost) : null
  const recommendations = buildPlatformRecommendations({ view, cards, topContent })

  return {
    platform: view.platform,
    label: view.label,
    hasComparison,
    performanceHeadline: platformHeadline(view.label, cards, hasComparison),
    cards,
    audienceBase,
    momentum,
    topContent,
    recommendations,
    cardSources: cards.map(card => ({ label: card.label, source: cardSourceLabel(view, card.key) })),
    rankingMetricLabel: topContent?.rankingMetricLabel ?? null,
    contentToneReason: topContent?.toneReason ?? null,
    followerGrowthSkippedReason:
      audienceBase !== null
        ? 'Follower count is a point-in-time snapshot, not a period metric, so month-over-month follower growth is intentionally not shown.'
        : null,
  }
}
