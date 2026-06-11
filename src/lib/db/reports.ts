import { supabase } from '../supabase'
import type { ImportedMetaPost } from './importedMetaPosts'

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
