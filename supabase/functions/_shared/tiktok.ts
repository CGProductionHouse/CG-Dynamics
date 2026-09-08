// ============================================================================
// _shared/tiktok.ts — TikTok API client helper
//
// Verified against current TikTok developer docs (Sep 2026):
//   - OAuth token: POST /v2/oauth/token/ (top-level response, NOT nested data)
//   - Refresh token: POST /v2/oauth/token/refresh/ (top-level response)
//   - Video create_time: int64 Unix epoch in SECONDS
//   - Publish status: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, SENDING_TO_USER_INBOX,
//     FAILED, PUBLISH_COMPLETE; publicaly_available_post_id[] (not video.id)
//
// Provides:
//   - Types (TiktokVideo.create_time is number — Unix seconds)
//   - resolveTiktokConfig() for env var resolution
//   - tiktokFetch() with timeout + retry/backoff
//   - redact() for token-safe logging
//   - getTiktokAccessToken() to read token from DB
//   - refreshTiktokToken() to refresh expired tokens
//   - getTiktokUserInfo(), getTiktokVideos(), queryTiktokVideos()
//   - Content Posting API: queryTiktokCreatorInfo(), initTiktokDirectPost(), getTiktokPublishStatus()
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Config resolution ──────────────────────────────────────────────────────

export class TiktokConfigurationError extends Error {
  constructor(message: string) {
    super(`Internal TikTok configuration error: ${message}`)
    this.name = 'TiktokConfigurationError'
  }
}

export interface TiktokDisplayConfig {
  clientKey: string
  clientSecret: string
  redirectUri: string
}

export function resolveTiktokConfig(): TiktokDisplayConfig {
  const clientKey = (Deno.env.get('TIKTOK_CLIENT_KEY') ?? '').trim()
  const clientSecret = (Deno.env.get('TIKTOK_CLIENT_SECRET') ?? '').trim()
  const redirectUri = (Deno.env.get('TIKTOK_REDIRECT_URI') ?? '').trim()

  if (!clientKey) throw new TiktokConfigurationError('TIKTOK_CLIENT_KEY is missing.')
  if (!clientSecret) throw new TiktokConfigurationError('TIKTOK_CLIENT_SECRET is missing.')
  if (!redirectUri) throw new TiktokConfigurationError('TIKTOK_REDIRECT_URI is missing.')

  return { clientKey, clientSecret, redirectUri }
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface TiktokUserInfo {
  open_id: string
  union_id?: string
  avatar_url: string
  display_name: string
  bio_description?: string
  profile_deep_link?: string
  is_verified?: boolean
  follower_count?: number
  following_count?: number
  likes_count?: number
  video_count?: number
}

export interface TiktokVideo {
  id: string
  /** UTC Unix epoch in SECONDS (int64 from TikTok). Multiply by 1000 for Date constructor. */
  create_time: number
  title?: string
  video_description?: string
  duration?: number
  cover_image_url?: string
  share_url?: string
  embed_link?: string
  view_count?: number
  like_count?: number
  comment_count?: number
  share_count?: number
}

export interface TiktokCreatorInfo {
  creator_avatar_url?: string
  creator_username?: string
  creator_nickname?: string
  privacy_level_options: string[]
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
  max_video_post_duration_sec?: number
}

export interface TiktokPublishResult {
  publish_id: string
  upload_url?: string
}

/** Current TikTok Content Posting API publish status values (Sep 2026). */
export type TiktokPublishStatusValue =
  | 'PUBLISH_COMPLETE'
  | 'FAILED'
  | 'PROCESSING_UPLOAD'
  | 'PROCESSING_DOWNLOAD'
  | 'SENDING_TO_USER_INBOX'

export interface TiktokPublishStatus {
  status: TiktokPublishStatusValue
  fail_reason?: string
  publish_id?: string
  uploaded_bytes?: number
  /** TikTok returns public post IDs here. NOT status.video.id. */
  publicaly_available_post_id?: string[]
}

// ── Error classification ───────────────────────────────────────────────────

export interface TiktokErrorInfo {
  message: string
  code?: number
  logId?: string
}

export function readTiktokError(body: unknown): TiktokErrorInfo {
  const data = body as Record<string, unknown> | null
  if (!data) return { message: 'Unknown error' }

  const error = data.error as Record<string, unknown> | undefined
  if (!error) return { message: String(data.message ?? 'Unknown error') }

  return {
    message: String(error.message ?? 'Unknown error'),
    code: typeof error.code === 'number' ? error.code : undefined,
    logId: typeof error.log_id === 'string' ? error.log_id : undefined,
  }
}

// ── Token-safe redaction ───────────────────────────────────────────────────

export function redact(text: string, tokens: Array<string | null | undefined>): string {
  let out = text
  for (const t of tokens) if (t && t.length >= 8) out = out.split(t).join('[redacted]')
  return out
    .replace(/access_token=[^&\s"']+/gi, 'access_token=[redacted]')
    .replace(/client_secret=[^&\s"']+/gi, 'client_secret=[redacted]')
    .replace(/code=[^&\s"']+/gi, 'code=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, 'Bearer [redacted]')
    .replace(/eyJ[A-Za-z0-9._~+/=-]{20,}/g, '[redacted]')
}

// ── Fetch with timeout + bounded retry ─────────────────────────────────────

const RETRYABLE = new Set([429, 500, 502, 503, 504])
const BACKOFF = [500, 1200]

export async function tiktokFetch(
  url: string,
  init?: RequestInit & { timeout?: number },
): Promise<Response> {
  const timeout = init?.timeout ?? 30_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    let lastError: unknown
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        const res = await fetch(url, { ...init, signal: controller.signal })
        if (RETRYABLE.has(res.status) && attempt < 1) {
          await new Promise(r => setTimeout(r, BACKOFF[attempt] ?? 1000))
          continue
        }
        return res
      } catch (err) {
        lastError = err
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, BACKOFF[attempt] ?? 1000))
        }
      }
    }
    throw lastError
  } finally {
    clearTimeout(timer)
  }
}

// ── Token management ───────────────────────────────────────────────────────

export async function getTiktokAccessToken(
  sb: ReturnType<typeof createClient>,
  connectionId: string,
): Promise<{ accessToken: string; expiresAt: string | null } | null> {
  const { data } = await sb
    .from('tiktok_connection_tokens')
    .select('access_token, token_expires_at')
    .eq('connection_id', connectionId)
    .limit(1)
    .single()

  if (!data) return null

  return {
    accessToken: data.access_token as string,
    expiresAt: data.token_expires_at as string | null,
  }
}

/**
 * Refresh a TikTok access token.
 *
 * Current TikTok API (Sep 2026):
 *   POST https://open.tiktokapis.com/v2/oauth/token/refresh/
 *   Body: application/x-www-form-urlencoded (client_key, client_secret, grant_type=refresh_token, refresh_token)
 *   Response: TOP-LEVEL fields (NOT nested under data):
 *     { access_token, expires_in, open_id, refresh_expires_in, refresh_token, scope, token_type }
 */
export async function refreshTiktokToken(
  sb: ReturnType<typeof createClient>,
  connectionId: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number; refreshToken: string } | null> {
  const config = resolveTiktokConfig()

  const params = new URLSearchParams({
    client_key: config.clientKey,
    client_secret: config.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await tiktokFetch('https://open.tiktokapis.com/v2/oauth/token/refresh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    console.error('TikTok token refresh failed:', res.status)
    return null
  }

  // TikTok returns token fields at the TOP LEVEL, not nested under data
  const body = await res.json() as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    open_id?: string
    scope?: string
    error?: { message?: string; code?: string }
  }

  if (body.error?.code && body.error.code !== 'ok') {
    console.error('TikTok token refresh error:', body.error.message)
    return null
  }

  if (!body.access_token) {
    console.error('TikTok token refresh missing access_token')
    return null
  }

  // Update stored tokens
  await sb
    .from('tiktok_connection_tokens')
    .update({
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? refreshToken,
      token_expires_at: new Date(Date.now() + (body.expires_in ?? 86400) * 1000).toISOString(),
    })
    .eq('connection_id', connectionId)

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 86400,
    refreshToken: body.refresh_token ?? refreshToken,
  }
}

// ── Client-account resolution ──────────────────────────────────────────────

/**
 * Resolve the exact TikTok connection for a given client_id.
 * NEVER uses "first connected" — returns null if no connection exists for this client.
 * This prevents Client A's sync/publish from using Client B's TikTok account.
 */
export async function resolveTiktokConnectionForClient(
  sb: ReturnType<typeof createClient>,
  clientId: string,
): Promise<{ connectionId: string | null; error: string | null }> {
  if (!clientId) return { connectionId: null, error: 'clientId is required.' }

  const { data: connections, error } = await sb
    .from('tiktok_connections')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'connected')
    .limit(1)

  if (error) {
    console.error('Failed to resolve TikTok connection for client:', error.message)
    return { connectionId: null, error: 'Could not look up TikTok connection.' }
  }

  if (!connections || connections.length === 0) {
    return { connectionId: null, error: 'No active TikTok connection for this client.' }
  }

  return { connectionId: connections[0].id, error: null }
}

// ── Display API helpers ────────────────────────────────────────────────────

export async function getTiktokUserInfo(
  accessToken: string,
  fields?: string,
): Promise<{ user: TiktokUserInfo | null; error: TiktokErrorInfo | null }> {
  const fieldList = fields ?? 'open_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count'

  const res = await tiktokFetch(
    `https://open.tiktokapis.com/v2/user/info/?fields=${fieldList}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  )

  const body = await res.json() as {
    data?: { user?: TiktokUserInfo }
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (body.error && body.error.code !== 'ok') {
    return { user: null, error: readTiktokError(body) }
  }

  return { user: body.data?.user ?? null, error: null }
}

export async function getTiktokVideos(
  accessToken: string,
  maxCount = 20,
  cursor?: string,
  fields?: string,
): Promise<{
  videos: TiktokVideo[]
  cursor: string | null
  hasMore: boolean
  error: TiktokErrorInfo | null
}> {
  const fieldList = fields ?? 'id,create_time,title,video_description,duration,cover_image_url,share_url,embed_link,view_count,like_count,comment_count,share_count'

  const body: Record<string, unknown> = { max_count: maxCount }
  if (cursor) body.cursor = cursor

  const res = await tiktokFetch(
    `https://open.tiktokapis.com/v2/video/list/?fields=${fieldList}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )

  const responseBody = await res.json() as {
    data?: { videos?: TiktokVideo[]; cursor?: number; has_more?: boolean }
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (responseBody.error && responseBody.error.code !== 'ok') {
    return { videos: [], cursor: null, hasMore: false, error: readTiktokError(responseBody) }
  }

  return {
    videos: responseBody.data?.videos ?? [],
    cursor: responseBody.data?.cursor != null ? String(responseBody.data.cursor) : null,
    hasMore: responseBody.data?.has_more ?? false,
    error: null,
  }
}

export async function queryTiktokVideos(
  accessToken: string,
  videoIds: string[],
  fields?: string,
): Promise<{ videos: TiktokVideo[]; error: TiktokErrorInfo | null }> {
  const fieldList = fields ?? 'id,create_time,title,video_description,duration,cover_image_url,share_url,embed_link,view_count,like_count,comment_count,share_count'

  const res = await tiktokFetch(
    `https://open.tiktokapis.com/v2/video/query/?fields=${fieldList}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filters: { video_ids: videoIds } }),
    },
  )

  const body = await res.json() as {
    data?: { videos?: TiktokVideo[] }
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (body.error && body.error.code !== 'ok') {
    return { videos: [], error: readTiktokError(body) }
  }

  return { videos: body.data?.videos ?? [], error: null }
}

// ── Content Posting API helpers ────────────────────────────────────────────

export async function queryTiktokCreatorInfo(
  accessToken: string,
): Promise<{ creator: TiktokCreatorInfo | null; error: TiktokErrorInfo | null }> {
  const res = await tiktokFetch(
    'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  )

  const body = await res.json() as {
    data?: TiktokCreatorInfo
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (body.error && body.error.code !== 'ok') {
    return { creator: null, error: readTiktokError(body) }
  }

  return { creator: body.data ?? null, error: null }
}

export async function initTiktokDirectPost(
  accessToken: string,
  videoUrl: string,
  postInfo: {
    title?: string
    privacy_level?: string
    disable_duet?: boolean
    disable_stitch?: boolean
    disable_comment?: boolean
    brand_content_toggle?: boolean
    brand_organic_toggle?: boolean
  },
): Promise<{ result: TiktokPublishResult | null; error: TiktokErrorInfo | null }> {
  const res = await tiktokFetch(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: postInfo.title ?? '',
          privacy_level: postInfo.privacy_level ?? 'PUBLIC_TO_EVERYONE',
          disable_duet: postInfo.disable_duet ?? false,
          disable_stitch: postInfo.disable_stitch ?? false,
          disable_comment: postInfo.disable_comment ?? false,
          brand_content_toggle: postInfo.brand_content_toggle ?? false,
          brand_organic_toggle: postInfo.brand_organic_toggle ?? false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }),
    },
  )

  const body = await res.json() as {
    data?: TiktokPublishResult
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (body.error && body.error.code !== 'ok') {
    return { result: null, error: readTiktokError(body) }
  }

  return { result: body.data ?? null, error: null }
}

/**
 * Fetch TikTok publish status.
 *
 * Current TikTok API (Sep 2026):
 *   POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
 *   Response:
 *     {
 *       data: {
 *         status: PROCESSING_UPLOAD | PROCESSING_DOWNLOAD | SENDING_TO_USER_INBOX | FAILED | PUBLISH_COMPLETE,
 *         fail_reason?: string,
 *         publicaly_available_post_id?: string[],
 *         publish_id?: string,
 *         uploaded_bytes?: number
 *       }
 *     }
 *
 * NOTE: publicaly_available_post_id is ONLY available for recent publishes.
 * For older publishes, fall back to /v2/video/list/ lookup.
 */
export async function getTiktokPublishStatus(
  accessToken: string,
  publishId: string,
): Promise<{ status: TiktokPublishStatus | null; error: TiktokErrorInfo | null }> {
  const res = await tiktokFetch(
    'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    },
  )

  const body = await res.json() as {
    data?: TiktokPublishStatus
    error?: { code?: string; message?: string; log_id?: string }
  }

  if (body.error && body.error.code !== 'ok') {
    return { status: null, error: readTiktokError(body) }
  }

  return { status: body.data ?? null, error: null }
}
