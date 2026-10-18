import { supabase } from './supabase'
import { getReportWithPosts, type ClientReport, type ClientReportWithPosts, type Report } from './db/reports'
import type { StrategyData } from './strategyEngine'
import { reportPostToStatsPost } from './reportStats'
import { projectClientReviewQueue } from './contentReviews'
import { listManualMetricsForClientMonth, type ReportManualMetric } from './db/manualMetrics'

export { previewClientId, portalPreviewPath } from './clientPortalPreviewPolicy'

/** Explicit allowlist: staff read authority never implies client display authority. */
export function projectPreviewReport(row: Report, clientId: string): ClientReport | null {
  if (row.client_id !== clientId || row.status !== 'published' || row.platform !== null) return null
  return {
    id: row.id, platform: row.platform, period_start: row.period_start, period_end: row.period_end,
    status: row.status, report_title: row.report_title, published_at: row.published_at,
    website_report: row.website_report ?? null,
    previous_month_strategy: null, previous_month_reflection: null, performance_comments: null,
    strategy_next_month: null, content_direction_next_month: null, boost_recommendation: null,
    strategy_data: null,
  }
}

export async function listPreviewReports(clientId: string) {
  try {
    const { data, error } = await supabase.from('reports').select('*')
      .eq('client_id', clientId).eq('status', 'published').is('platform', null)
      .order('period_start', { ascending: false })
    if (error || !Array.isArray(data)) throw new Error('Published report evidence unavailable')
    return { data: (data as Report[]).flatMap(row => {
      const projected = projectPreviewReport(row, clientId)
      return projected ? [projected] : []
    }), error: null }
  } catch {
    return { data: [], error: { message: 'Published reports could not be loaded.' } }
  }
}

export async function getPreviewReport(clientId: string, reportId: string): Promise<{ data: ClientReportWithPosts | null; error: { message: string } | null }> {
  const unavailable = { data: null, error: { message: 'Published report unavailable.' } }
  try {
    // Prove ownership/publication before fetching child facts or website snapshot.
    const owned = await supabase.from('reports').select('id').eq('id', reportId)
      .eq('client_id', clientId).eq('status', 'published').is('platform', null).maybeSingle()
    if (owned.error || owned.data?.id !== reportId) return unavailable
    const result = await getReportWithPosts(reportId)
    if (result.error || !result.data) return unavailable
    const report = projectPreviewReport(result.data, clientId)
    if (!report || report.id !== reportId || !Array.isArray(result.data.posts)
      || result.data.posts.some(post => !post || typeof post.id !== 'string' || !post.id.trim() || post.report_id !== reportId)
      || new Set(result.data.posts.map(post => post.id)).size !== result.data.posts.length) return unavailable
    const exclusions = await supabase.from('report_content_exclusions').select('post_id,excluded', { count: 'exact' })
      .eq('report_id', reportId).eq('client_id', clientId)
    const visibilityUnavailable = { data: null, error: { message: 'Content visibility unavailable.' } }
    // Never interpret a truncated/default-limited decision list as permission.
    if (exclusions.error || !Array.isArray(exclusions.data)
      || !Number.isSafeInteger(exclusions.count) || exclusions.count !== exclusions.data.length) return visibilityUnavailable
    const postIds = new Set(result.data.posts.map(post => post.id))
    const decisions = new Map<string, boolean>()
    for (const row of exclusions.data) {
      if (!row || typeof row.post_id !== 'string' || !postIds.has(row.post_id)
        || typeof row.excluded !== 'boolean' || decisions.has(row.post_id)) return visibilityUnavailable
      decisions.set(row.post_id, row.excluded)
    }
    return { data: { ...report, posts: result.data.posts.map(post => {
      const stats = reportPostToStatsPost(post)
      return {
        id: post.id, platform: post.platform, publish_time: post.publish_time,
        post_type: stats.post_type, caption: post.caption, permalink: post.permalink,
        impressions: stats.impressions, reach: stats.reach, engagements: stats.engagements,
        engagement_known_subtotal: stats.engagementKnownSubtotal,
        engagement_definition_id: stats.engagementDefinitionId, engagement_definition_label: stats.engagementDefinitionLabel,
        engagement_source: stats.engagementSource, engagement_observed_at: stats.engagementObservedAt,
        engagement_coverage: stats.engagementCoverage, engagement_completeness: stats.engagementCompleteness,
        excluded: decisions.get(post.id) ?? false,
      }
    }) }, error: null }
  } catch {
    return unavailable
  }
}

export async function getPreviewMetrics(clientId: string, month: string) {
  const result = await listManualMetricsForClientMonth(clientId, month)
  if (result.error) return { error: result.error, data: [] }
  // Match client_published_report_manual_metrics exactly: legacy automated
  // unavailable placeholders are not observations, even when numeric.
  return { error: null, data: result.data.filter(row => row.client_id === clientId && row.month === month
    && !(row.source_type === 'other' && /^Meta sync account totals for unavailable metrics/i.test(row.general_notes ?? ''))).map(row => ({
    month: row.month, platform: row.platform, source_type: row.source_type,
    views: row.views, reach: row.reach, engagements: row.engagements, accounts_engaged: row.accounts_engaged,
    profile_visits: row.profile_visits, external_link_taps: row.external_link_taps, followers: row.followers,
  } as ReportManualMetric)) }
}

export async function getPreviewStrategy(clientId: string, month: string) {
  // Match client_monthly_strategy: the immutable published copy survives later
  // draft amendments. The editable strategy_data is never client display truth.
  const result = await supabase.from('monthly_client_strategies')
    .select('client_id,strategy_month,published_strategy_data,published_at')
    .eq('client_id', clientId).eq('strategy_month', `${month}-01`)
    .not('published_strategy_data', 'is', null).maybeSingle()
  const row = result.data
  return { error: result.error, data: row && row.client_id === clientId && row.strategy_month === `${month}-01`
    && row.published_strategy_data && row.published_at
    ? { strategy_month: row.strategy_month, strategy_data: row.published_strategy_data as StrategyData, published_at: row.published_at as string }
    : null }
}

export async function listPreviewApprovals(clientId: string) {
  // Same visibility predicates and public fields as client_content_review_queue.
  try {
    const { data, error } = await supabase.from('content_review_versions')
      .select('id,title,asset_path,media_type,caption,channels,scheduled_at,state')
      .eq('client_id', clientId).eq('client_approval_required', true)
      .in('state', ['client_review', 'approved']).not('internal_approved_at', 'is', null)
      .order('scheduled_at')
    const projected = projectClientReviewQueue(data)
    if (error || !projected) throw new Error('Approval evidence unavailable')
    return { data: projected, error: null }
  } catch {
    return { data: [], error: { message: 'Approvals could not be loaded.' } }
  }
}

