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
  health?: {
    access: 'connected' | 'reconnect_required' | 'permission_required' | 'provider_error' | 'unavailable'
    coverage: 'complete' | 'partial' | 'unavailable'
    completeness: 'complete' | 'partial' | 'unavailable'
    freshness: 'fresh' | 'stale' | 'never'
    clientState: 'available' | 'partial' | 'unavailable'
    staffDiagnostic: string
    clientMessage: string
    lastAttemptedAt: string | null
    lastSuccessfulAt: string | null
    ageHours: number | null
    staleAfterHours: number
  }
}

export type TiktokQueueState = 'connected' | 'refresh_pending' | 'reconnect_required' | 'not_connected'

export interface TiktokConnectionQueueItem {
  clientId: string
  clientName: string
  state: TiktokQueueState
  account: { displayName: string | null; avatarUrl: string | null; lastConnectedAt: string | null } | null
  missingScopes?: string[]
  tokenExpiresAt?: string | null
  diagnostic: string
}

export interface TiktokConnectionQueue {
  ok: boolean
  items: TiktokConnectionQueueItem[]
  summary: { activeClients: number; eligible: number; excluded: number; unresolved: number; connected: number; reconnectRequired: number; notConnected: number }
  error?: string
}

export interface TiktokSyncResult {
  ok: boolean
  health: 'verified' | 'partial' | 'sync_error'
  periodMonth: string
  videosSynced: number | null
  paginationComplete: boolean
  metrics: {
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
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

export async function getTiktokConnectionQueue(): Promise<TiktokConnectionQueue> {
  const { data, error } = await supabase.functions.invoke('tiktok-connection-queue', { method: 'POST', body: {} })
  if (error) return { ok: false, items: [], summary: { activeClients: 0, eligible: 0, excluded: 0, unresolved: 0, connected: 0, reconnectRequired: 0, notConnected: 0 }, error: error.message }
  return data
}

export async function syncTiktokAnalytics(clientId: string, periodMonth?: string): Promise<TiktokSyncResult> {
  const { data, error } = await supabase.functions.invoke('tiktok-sync', {
    method: 'POST',
    body: { clientId, periodMonth },
  })
  if (error) return { ok: false, health: 'sync_error', periodMonth: periodMonth ?? '', videosSynced: null, paginationComplete: false, metrics: { views: null, likes: null, comments: null, shares: null, followers: null }, error: error.message }
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
