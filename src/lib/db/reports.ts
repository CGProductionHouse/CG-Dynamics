import { supabase } from '../supabase'
import type { ImportedMetaPost } from './importedMetaPosts'
import type { StrategyData } from '../strategyEngine'

export type ReportStatus = 'draft' | 'published'

export type Platform = 'facebook' | 'instagram' | 'tiktok'

export interface Report {
  id: string
  client_id: string
  // Master monthly reports are not tied to a single platform (null).
  // Legacy per-platform reports may still carry a platform value.
  platform: Platform | null
  period_start: string
  period_end: string
  status: ReportStatus
  report_title: string | null
  previous_month_strategy: string | null
  previous_month_reflection: string | null
  performance_comments: string | null
  strategy_next_month: string | null
  content_direction_next_month: string | null
  boost_recommendation: string | null
  general_notes: string | null
  // Guided strategy engine structured data (added by phase-3j). Optional so the
  // app keeps working before the migration is applied.
  strategy_data?: StrategyData | null
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at?: string | null
}

export interface ReportPost {
  id: string
  report_id: string
  meta_post_id: string | null
  platform: Platform | null
  publish_time: string | null
  meta_post_type: string | null
  caption: string | null
  permalink: string | null
  views: number
  reach: number
  reactions: number
  comments: number
  shares: number
  total_clicks: number
  raw: Record<string, unknown>
  created_at: string
}

export interface ReportWithPosts extends Report {
  posts: ReportPost[]
}

export interface ReportInput {
  id?: string
  client_id: string
  period_start: string
  period_end: string
  status: ReportStatus
  report_title: string
  previous_month_strategy: string
  previous_month_reflection: string
  performance_comments: string
  strategy_next_month: string
  content_direction_next_month: string
  boost_recommendation: string
  general_notes: string
  created_by: string | null
  importedPosts?: ImportedMetaPost[]
}

function reportPayload(input: ReportInput) {
  return {
    client_id: input.client_id,
    // Master monthly report: not tied to a single platform.
    platform: null,
    period_start: input.period_start,
    period_end: input.period_end,
    status: input.status,
    report_title: input.report_title,
    previous_month_strategy: input.previous_month_strategy,
    previous_month_reflection: input.previous_month_reflection,
    performance_comments: input.performance_comments,
    strategy_next_month: input.strategy_next_month,
    content_direction_next_month: input.content_direction_next_month,
    boost_recommendation: input.boost_recommendation,
    general_notes: input.general_notes,
    published_at: input.status === 'published' ? new Date().toISOString() : null,
    created_by: input.created_by,
  }
}

export async function saveReport(input: ReportInput) {
  const payload = reportPayload(input)
  const reportResult = input.id
    ? await supabase.from('reports').update(payload).eq('id', input.id).select('*').single()
    : await supabase.from('reports').insert(payload).select('*').single()

  if (reportResult.error || !reportResult.data) {
    return { data: null, error: reportResult.error }
  }

  const report = reportResult.data as Report

  if (input.importedPosts) {
    const deleteResult = await supabase.from('posts').delete().eq('report_id', report.id)
    if (deleteResult.error) return { data: null, error: deleteResult.error }
  }

  if (input.importedPosts && input.importedPosts.length > 0) {
    const posts = input.importedPosts.map(post => ({
      report_id: report.id,
      meta_post_id: post.meta_post_id,
      platform: post.platform,
      publish_time: post.publish_time,
      meta_post_type: post.post_type,
      caption: post.caption,
      permalink: post.permalink,
      views: post.impressions,
      reach: post.reach,
      reactions: post.reactions,
      comments: post.comments,
      shares: post.shares,
      total_clicks: post.clicks,
      raw: {
        ...post.raw,
        imported_meta_post_id: post.id,
        views: post.impressions,
        impressions: post.impressions,
        engagements: post.engagements,
        video_views: post.video_views,
      },
    }))
    const insertResult = await supabase.from('posts').insert(posts)
    if (insertResult.error) return { data: null, error: insertResult.error }
  }

  return { data: report, error: null }
}

export async function listReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as Report[], error }
}

export async function getReportWithPosts(reportId: string) {
  const reportResult = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (reportResult.error || !reportResult.data) {
    return { data: null, error: reportResult.error }
  }

  const postsResult = await supabase
    .from('posts')
    .select('*')
    .eq('report_id', reportId)
    .order('publish_time', { ascending: true, nullsFirst: false })

  if (postsResult.error) {
    return { data: null, error: postsResult.error }
  }

  return {
    data: {
      ...(reportResult.data as Report),
      posts: (postsResult.data ?? []) as ReportPost[],
    },
    error: null,
  }
}

function strategyColumnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === '42703') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('strategy_data') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))
}

// Best-effort save of the guided strategy structured data. Kept separate from
// saveReport so the core report save never fails before the phase-3j migration
// is applied — it simply reports `migrationNeeded` and the UI shows a note.
export async function updateReportStrategyData(reportId: string, data: StrategyData) {
  const { error } = await supabase
    .from('reports')
    .update({ strategy_data: data })
    .eq('id', reportId)

  if (error && strategyColumnMissing(error)) {
    return { error: null, migrationNeeded: true }
  }
  return { error, migrationNeeded: false }
}

// Find an existing report for a client whose period END falls in the given
// month (YYYY-MM). Used so imports update the right monthly report instead of
// creating duplicates.
function nextMonthStart(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month)
  if (!match) return `${month}-01`
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]), 1)) // month is 0-indexed, so this is the 1st of the NEXT month
  return date.toISOString().slice(0, 10)
}

export async function findReportForClientMonth(clientId: string, month: string) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .gte('period_end', `${month}-01`)
    .lt('period_end', nextMonthStart(month))
    .order('platform', { nullsFirst: true })
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }
  const reports = (data ?? []) as Report[]
  // Prefer the master report (platform === null) for the month.
  const master = reports.find(r => r.platform === null) ?? reports[0] ?? null
  return { data: master, error: null }
}

// Create or update (never duplicate) a DRAFT report for a client/month. Used by
// the import flow so imported data automatically lands on a draft report. Never
// publishes and never overwrites an existing report's status or strategy.
export async function upsertDraftReportForMonth(input: {
  clientId: string
  clientName: string
  periodStart: string
  periodEnd: string
  month: string
  createdBy: string | null
}): Promise<{ data: Report | null; error: { message: string } | null; created: boolean }> {
  const existing = await findReportForClientMonth(input.clientId, input.month)
  if (existing.error) return { data: null, error: existing.error, created: false }

  if (existing.data) {
    return { data: existing.data, error: null, created: false }
  }

  const monthLabel = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })
    .format(new Date(`${input.month}-01T00:00:00`))

  const { data, error } = await supabase
    .from('reports')
    .insert({
      client_id: input.clientId,
      platform: null,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      status: 'draft',
      report_title: `${input.clientName} ${monthLabel} Report`,
      created_by: input.createdBy,
    })
    .select('*')
    .single()

  if (error) return { data: null, error, created: false }
  return { data: data as Report, error: null, created: true }
}

// Repair a report's period to a full calendar month without touching status,
// posts, strategy or any other field. Used by the admin "Repair to calendar
// month" action for legacy partial-range reports.
export async function updateReportPeriod(reportId: string, periodStart: string, periodEnd: string) {
  const { data, error } = await supabase
    .from('reports')
    .update({ period_start: periodStart, period_end: periodEnd })
    .eq('id', reportId)
    .select('*')
    .single()

  return { data: data as Report | null, error }
}

export async function updateReportStatus(reportId: string, status: ReportStatus) {
  const { data, error } = await supabase
    .from('reports')
    .update({
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', reportId)
    .select('*')
    .single()

  return { data: data as Report | null, error }
}

export async function deleteReport(reportId: string) {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId)

  return { error }
}

export async function listPublishedReportsForClient(clientId: string) {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .order('period_start', { ascending: false })
    .order('created_at', { ascending: false })

  return { data: (data ?? []) as Report[], error }
}

export async function getLatestPublishedReportForClient(clientId: string) {
  const reportResult = await supabase
    .from('reports')
    .select('*')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .order('period_end', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (reportResult.error || !reportResult.data) {
    return { data: null, error: reportResult.error }
  }

  const report = reportResult.data as Report
  const postsResult = await supabase
    .from('posts')
    .select('*')
    .eq('report_id', report.id)
    .order('publish_time', { ascending: true, nullsFirst: false })

  if (postsResult.error) {
    return { data: null, error: postsResult.error }
  }

  return {
    data: {
      ...report,
      posts: (postsResult.data ?? []) as ReportPost[],
    },
    error: null,
  }
}
