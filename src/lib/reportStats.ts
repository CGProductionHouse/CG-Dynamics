import type { ImportedMetaPost } from './db/importedMetaPosts'
import type { ReportPost } from './db/reports'

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

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
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
