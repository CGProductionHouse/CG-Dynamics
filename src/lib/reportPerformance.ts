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
// level. It never invents 0s - a metric with no real value is simply omitted.

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
// even when interactions are thin - mirrors Meta defaulting to top-by-views.
export const STRONG_VIEWS_THRESHOLD = 100
export const STRONG_REACH_THRESHOLD = 100

// Decides how a single post should be framed. A post can be "top" on the
// strength of views or reach even with low interactions (Meta's top-by-views
// behaviour), but a low-interaction post with no strong views/reach is framed
// as learning - never celebrated as a win.
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
      reason: `Strong ${rankingMetricLabel} - shown as top performing content.`,
    }
  }

  const hasSignal = interactions > 0 || typeof views === 'number' || typeof reach === 'number'
  if (hasSignal) {
    return {
      tone: 'learning',
      rankingMetricLabel:
        typeof views === 'number' ? 'views' : typeof reach === 'number' ? 'reach' : 'content interactions',
      reason: `Top content interactions (${interactions}) are below ${WEAK_CONTENT_THRESHOLD} with no stronger views/reach signal - framed as content learning, not a win.`,
    }
  }

  return { tone: 'baseline', rankingMetricLabel: null, reason: 'No engagement signal yet - shown as a content baseline.' }
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
  // e.g. "vs April 2026" - null when there is no comparison.
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
  nextSteps: NextStep[]

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
  // Omit metrics with no real current value - never show a fake 0.
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
    // Current followers is a point-in-time snapshot (audience base), NOT a period
    // metric. Pass no previous value so it never shows month-over-month growth.
    buildMetric('current_followers', 'Current followers', curFollowers, null, prevLabel),
    buildMetric('posts', 'Posts published', curPosts > 0 ? curPosts : null, hasComparison ? prevPosts : null, prevLabel),
  ]
  const metrics = candidates.filter((m): m is PerformanceMetric => m !== null)

  // Growth chart: true period metrics only (Reach, Content interactions, Posts,
  // Views) where BOTH months have a real value. Followers are deliberately
  // excluded — a snapshot cannot show growth.
  const growthKeys = ['reach', 'content_interactions', 'posts', 'views']
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
    nextSteps: buildNextSteps({ master, metrics, best, curPosts, performanceLevel }),
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
      return `${monthLabel} was a strong month - momentum is building.`
    case 'improving':
      return `${monthLabel} moved in the right direction with clear gains.`
    case 'steady':
      return `${monthLabel} held steady - a stable base to build on.`
    case 'needs_attention':
      return `${monthLabel} set a clearer baseline - the next step is converting reach into stronger audience response.`
    case 'baseline_only':
      return `${monthLabel} sets the baseline we will grow from next month.`
  }
}

function directionOf(metrics: PerformanceMetric[], key: string): Direction | null {
  return metrics.find(m => m.key === key)?.direction ?? null
}

// Professional, honest, constructive headline - no panic wording, no fake
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
      return `${monthLabel} earned stronger engagement - the next step is widening reach.`
    }
  }
  return headlineFor(level, monthLabel)
}

export interface NextStep {
  priority: number
  title: string
  why: string
  action: string
}

function buildNextSteps(input: {
  master: MasterReportData
  metrics: PerformanceMetric[]
  best: ReportStatsPost | null
  curPosts: number
  performanceLevel: PerformanceLevel
}): NextStep[] {
  const { master, metrics, best, curPosts } = input
  const steps: NextStep[] = []

  const reach = master.totalReach
  const interactions = master.totalEngagements
  const bestEng = best?.engagements ?? 0
  const dir = (key: string) => metrics.find(m => m.key === key)?.direction

  const reachUp = dir('reach') === 'up' || dir('views') === 'up'
  const interDown = dir('content_interactions') === 'down'
  const profileDown = dir('profile_visits') === 'down'

  // 1. Visibility up, response quality is the next focus.
  if (reachUp && interDown) {
    steps.push({
      priority: 1,
      title: 'Convert visibility into response',
      why: 'Visibility improved while response quality is the next focus - more people saw the content without taking action.',
      action: 'Test stronger opening hooks, question-led captions and product comparison posts.',
    })
  } else if (typeof reach === 'number' && reach >= 500 && interactions > 0 && interactions / reach < 0.02) {
    steps.push({
      priority: 1,
      title: 'Convert reach into engagement',
      why: 'Visibility is building while response quality is the next focus - the content is being seen but action is still building.',
      action: 'Use stronger opening hooks, question-led captions and product comparison posts.',
    })
  } else if (bestEng > 0 && bestEng < WEAK_CONTENT_THRESHOLD) {
    steps.push({
      priority: 1,
      title: 'Sharpen content hooks',
      why: 'Individual post interactions are still building, making it harder to create momentum from the content itself.',
      action: 'Test opening hooks that stop the scroll and make the product value clearer in the first line.',
    })
  }

  // 2. Posting consistency.
  if (curPosts > 0 && curPosts < 8) {
    steps.push({
      priority: 2,
      title: 'Build posting consistency',
      why: `Fewer posts were published (${curPosts} total) than the recommended weekly rhythm - consistency is the next focus.`,
      action: 'Keep a steady weekly rhythm before judging campaign direction.',
    })
  }

  // 3. Profile action needs focus.
  if (profileDown) {
    steps.push({
      priority: 3,
      title: 'Profile action needs focus',
      why: 'Profile visits changed while visibility improved - the content can drive more curiosity to the profile.',
      action: 'Add clearer product intent, stronger CTA copy and direct enquiry prompts.',
    })
  }

  // 4. Channel strategy.
  if (master.bestPlatform?.platform === 'instagram') {
    steps.push({
      priority: 4,
      title: 'Use Instagram as the visibility driver',
      why: 'Instagram created the strongest reach this month, making it the primary channel for visibility.',
      action: 'Lead with Instagram-first posts, then repurpose the strongest creatives to Facebook.',
    })
  } else if (master.bestPlatform?.platform === 'facebook') {
    steps.push({
      priority: 4,
      title: 'Extend Facebook reach to Instagram',
      why: 'Facebook is leading on reach this month, with formats that could perform well on Instagram too.',
      action: 'Repurpose Facebooks strongest formats to Instagram for compounding visibility.',
    })
  }

  // 5. Strong top post exists - use it as a format signal.
  if (best && bestEng >= WEAK_CONTENT_THRESHOLD) {
    steps.push({
      priority: 5,
      title: 'Build on what worked',
      why: 'The strongest post this month shows clear audience preference - use its format as a creative signal.',
      action: 'Create variations of the top posts format and posting time while testing one new angle.',
    })
  }

  // 6. No previous baseline - content direction is becoming clearer.
  if (!input.performanceLevel || input.performanceLevel === 'baseline_only') {
    steps.push({
      priority: 5,
      title: 'Content direction is becoming clearer',
      why: 'This month sets the content baseline - next month we will have a clearer picture of what is gaining traction.',
      action: 'Keep the same posting rhythm and note which posts earn the most attention.',
    })
  }

  // 7. Audience retention.
  const followers = metrics.find(m => m.key === 'current_followers')
  if (followers && followers.direction === 'down') {
    steps.push({
      priority: 6,
      title: 'Prioritise audience retention',
      why: 'Follower count moved differently this month - content can create more repeat-visit value.',
      action: 'Publish saveable, repeat-value content like how-to posts, carousel comparisons and educational reels.',
    })
  }

  // Always at least one step.
  if (steps.length === 0) {
    steps.push({
      priority: 1,
      title: 'Build on this months momentum',
      why: 'The current trajectory is positive - the next step is to compound it with consistent execution.',
      action: 'Double down on the formats that earned the most visibility and plan one campaign moment for next month.',
    })
  }

  return steps.slice(0, 5)
}

function buildRecommendations(input: {
  master: MasterReportData
  metrics: PerformanceMetric[]
  best: ReportStatsPost | null
  curPosts: number
  performanceLevel: PerformanceLevel
}): string[] {
  return buildNextSteps(input).map(s => `${s.title}: ${s.action}`)
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

  // Period metric cards (never current followers - that lives in audienceBase).
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
    return `${label} earned stronger engagement - the next step is widening reach.`
  }
  return `${label} held steady this month - a stable base to build on.`
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
      'Reach improved while response quality is the next focus - test stronger hooks and clearer calls to action.',
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

  const candidateMap: Array<PerformanceMetric | null> = [
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
  // Platform-aware reordering: Facebook leads with content interactions and posts
  // (since views/reach may be absent), Instagram leads with views and reach.
  const preferOrder = view.platform === 'facebook'
    ? ['content_interactions', 'posts', 'views', 'reach', 'profile_visits']
    : ['views', 'reach', 'content_interactions', 'profile_visits', 'posts']
  const candidates = [...candidateMap].sort((a, b) => {
    if (!a && !b) return 0
    if (!a) return 1
    if (!b) return -1
    const ai = preferOrder.indexOf(a.key)
    const bi = preferOrder.indexOf(b.key)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
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
