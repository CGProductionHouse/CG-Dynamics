// ============================================================================
// src/lib/tiktok.ts — TikTok provider frontend client library
//
// Wraps Edge Function invocations for TikTok OAuth, connection status,
// analytics sync, and content posting. Mirrors the pattern of googleAds.ts
// and metaIntegration patterns.
// ============================================================================

import { supabase } from './supabase'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TiktokConnection {
  id: string
  clientId: string | null
  tiktokOpenId: string | null
  displayName: string | null
  avatarUrl: string | null
  lastConnectedAt: string | null
  grantedScopes: string[]
  tokenExpiresAt: string | null
  tokenExpired: boolean
}

export interface TiktokConnectionStatus {
  ok: boolean
  connected: boolean
  status: string
  message: string
  missingScopes: string[]
  schemaReady: boolean
  connection?: TiktokConnection
}

export interface TiktokSyncResult {
  ok: boolean
  health: 'verified' | 'partial' | 'sync_error'
  periodMonth: string
  videosSynced: number
  paginationComplete: boolean
  metrics: {
    views: number
    likes: number
    comments: number
    shares: number
    followers: number | null
  }
  errors?: string[]
  error?: string
}

export interface TiktokPublishResult {
  ok: boolean
  publishId: string
  creatorInfo: {
    privacyLevelOptions: string[]
    maxVideoDuration: number | null
  }
  message?: string
  error?: string
}

export interface TiktokPublishStatusResult {
  ok: boolean
  status: string
  tiktokStatus: string
  publicPostIds: string[]
  failReason: string | null
  uploadedBytes: number | null
  error?: string
}

export interface TiktokMetricDefinition {
  key: string
  label: string
  sourceMetric: string
  meaning: string
  aggregation: 'sum' | 'snapshot'
  clientSafe: boolean
  crossPlatformAdditive: boolean
}

// TikTok-native metric definitions — preserving TikTok's exact metric names
// and semantics. No invented or relabeled metrics.
export const TIKTOK_METRICS: TiktokMetricDefinition[] = [
  {
    key: 'views',
    label: 'Views',
    sourceMetric: 'view_count',
    meaning: 'Cumulative video plays including replays. Snapshot at sync time — not a period total.',
    aggregation: 'sum',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'likes',
    label: 'Likes',
    sourceMetric: 'like_count',
    meaning: 'Cumulative likes on videos published in period. Snapshot at sync time.',
    aggregation: 'sum',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'comments',
    label: 'Comments',
    sourceMetric: 'comment_count',
    meaning: 'Cumulative comments on videos published in period. Snapshot at sync time.',
    aggregation: 'sum',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'shares',
    label: 'Shares',
    sourceMetric: 'share_count',
    meaning: 'Cumulative shares of videos published in period. Snapshot at sync time.',
    aggregation: 'sum',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'current_followers',
    label: 'Current followers',
    sourceMetric: 'follower_count',
    meaning: 'Follower count at time of sync. Point-in-time snapshot — not attributable to any period. Not additive across platforms.',
    aggregation: 'snapshot',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'following_count',
    label: 'Following',
    sourceMetric: 'following_count',
    meaning: 'Number of accounts the user follows. Snapshot.',
    aggregation: 'snapshot',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'total_likes',
    label: 'Total likes',
    sourceMetric: 'likes_count',
    meaning: 'Cumulative likes across all videos on the account. Snapshot.',
    aggregation: 'snapshot',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
  {
    key: 'video_count',
    label: 'Videos',
    sourceMetric: 'video_count',
    meaning: 'Total number of videos on the account. Snapshot.',
    aggregation: 'snapshot',
    clientSafe: true,
    crossPlatformAdditive: false,
  },
]

// ── Edge Function invocations ──────────────────────────────────────────────

export async function startTiktokOAuth(clientId: string): Promise<{ ok: boolean; url?: string; clientName?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('tiktok-oauth-start', {
    method: 'POST',
    body: { clientId },
  })
  if (error) return { ok: false, error: error.message }
  return data
}

export async function getTiktokConnectionStatus(clientId?: string): Promise<TiktokConnectionStatus> {
  const { data, error } = await supabase.functions.invoke('tiktok-connection-status', {
    method: 'POST',
    body: clientId ? { clientId } : {},
  })
  if (error) return { ok: false, connected: false, status: 'error', message: error.message, missingScopes: [], schemaReady: false }
  return data
}

export async function syncTiktokAnalytics(clientId: string, periodMonth?: string): Promise<TiktokSyncResult> {
  const { data, error } = await supabase.functions.invoke('tiktok-sync', {
    method: 'POST',
    body: { clientId, periodMonth },
  })
  if (error) return { ok: false, health: 'sync_error', periodMonth: periodMonth ?? '', videosSynced: 0, paginationComplete: false, metrics: { views: 0, likes: 0, comments: 0, shares: 0, followers: null }, error: error.message }
  return data
}

export async function initTiktokPublish(options: {
  clientId: string
  monthlyDeliverableId: string
  contentReviewVersionId: string
  publishNowConfirmed: true
  title?: string
  privacyLevel: string
  disableDuet: boolean
  disableStitch: boolean
  disableComment: boolean
  brandContentToggle?: boolean
  brandOrganicToggle?: boolean
}): Promise<TiktokPublishResult> {
  const { data, error } = await supabase.functions.invoke('tiktok-post-init', {
    method: 'POST',
    body: options,
  })
  if (error) return { ok: false, publishId: '', creatorInfo: { privacyLevelOptions: [], maxVideoDuration: null }, error: error.message }
  return data
}

export async function getTiktokPublishStatus(publishId: string): Promise<TiktokPublishStatusResult> {
  const { data, error } = await supabase.functions.invoke('tiktok-post-status', {
    method: 'POST',
    body: { publishId },
  })
  if (error) return { ok: false, status: 'error', tiktokStatus: '', publicPostIds: [], failReason: null, uploadedBytes: null, error: error.message }
  return data
}
