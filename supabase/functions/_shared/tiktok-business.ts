import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const TIKTOK_BUSINESS_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3'

export class TiktokBusinessConfigurationError extends Error {
  constructor(message: string) {
    super(`Internal TikTok Business configuration error: ${message}`)
    this.name = 'TiktokBusinessConfigurationError'
  }
}

export interface TiktokBusinessConfig {
  appId: string
  appSecret: string
  redirectUri: string
}

export function resolveTiktokBusinessConfig(): TiktokBusinessConfig {
  const appId = (Deno.env.get('TIKTOK_BUSINESS_APP_ID') ?? '').trim()
  const appSecret = (Deno.env.get('TIKTOK_BUSINESS_APP_SECRET') ?? '').trim()
  const redirectUri = (Deno.env.get('TIKTOK_BUSINESS_REDIRECT_URI') ?? '').trim()
  if (!appId) throw new TiktokBusinessConfigurationError('TIKTOK_BUSINESS_APP_ID is missing.')
  if (!appSecret) throw new TiktokBusinessConfigurationError('TIKTOK_BUSINESS_APP_SECRET is missing.')
  if (!redirectUri) throw new TiktokBusinessConfigurationError('TIKTOK_BUSINESS_REDIRECT_URI is missing.')
  return { appId, appSecret, redirectUri }
}

export type TiktokBusinessAuthorizationStatus =
  | 'connected'
  | 'needs_reauth'
  | 'revoked'
  | 'pending_review'
  | 'error'

export type TiktokBusinessPublishingEligibility =
  | 'not_approved'
  | 'video_only'
  | 'photo_only'
  | 'video_and_photo'
  | 'suspended'

export interface TiktokBusinessAuthorizationRow {
  id: string
  connection_id: string
  client_id: string
  account_handle: string | null
  display_name: string | null
  status: TiktokBusinessAuthorizationStatus
  granted_permissions: string[]
  publishing_eligibility: TiktokBusinessPublishingEligibility
  token_expires_at: string | null
  refresh_token_expires_at: string | null
  last_token_refresh_at: string | null
  last_verified_at: string | null
  last_error_code: string | null
  last_error_message: string | null
}

export function tiktokBusinessPublishingEnabled(): boolean {
  return Deno.env.get('TIKTOK_BUSINESS_PUBLISHING_ENABLED') === 'true'
}

export async function resolveTiktokBusinessAuthorizationForClient(
  sb: ReturnType<typeof createClient>,
  clientId: string,
): Promise<{ authorization: TiktokBusinessAuthorizationRow | null; error: string | null }> {
  if (!clientId) return { authorization: null, error: 'clientId is required.' }

  const { data, error } = await sb
    .from('tiktok_business_authorizations')
    .select('id,connection_id,client_id,account_handle,display_name,status,granted_permissions,publishing_eligibility,token_expires_at,refresh_token_expires_at,last_token_refresh_at,last_verified_at,last_error_code,last_error_message,tiktok_connections!inner(client_id,status)')
    .eq('client_id', clientId)
    .eq('tiktok_connections.client_id', clientId)
    .in('status', ['connected', 'needs_reauth', 'pending_review'])
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('TikTok Business authorization lookup failed:', error.code ?? 'unknown')
    return { authorization: null, error: 'Could not look up the TikTok Business authorization.' }
  }

  return { authorization: data as TiktokBusinessAuthorizationRow | null, error: null }
}

export function tokenHealth(authorization: TiktokBusinessAuthorizationRow): {
  accessTokenExpired: boolean
  refreshTokenExpired: boolean
} {
  const now = Date.now()
  const accessExpiry = authorization.token_expires_at
    ? new Date(authorization.token_expires_at).getTime()
    : Number.NaN
  const refreshExpiry = authorization.refresh_token_expires_at
    ? new Date(authorization.refresh_token_expires_at).getTime()
    : Number.NaN

  return {
    accessTokenExpired: !Number.isFinite(accessExpiry) || accessExpiry <= now,
    refreshTokenExpired: !Number.isFinite(refreshExpiry) || refreshExpiry <= now,
  }
}

export interface TiktokBusinessTokenData {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
  open_id: string
  scope: string
}

interface TiktokBusinessEnvelope<T> {
  code?: number
  message?: string
  request_id?: string
  data?: T
}

async function parseBusinessResponse<T>(response: Response): Promise<{
  data: T | null
  error: { code: string; message: string; requestId: string | null } | null
}> {
  const body = await response.json() as TiktokBusinessEnvelope<T>
  if (!response.ok || body.code !== 0 || !body.data) {
    return {
      data: null,
      error: {
        code: String(body.code ?? response.status),
        message: body.message ?? 'TikTok API for Business request failed.',
        requestId: body.request_id ?? null,
      },
    }
  }
  return { data: body.data, error: null }
}

export async function refreshTiktokBusinessToken(
  sb: ReturnType<typeof createClient>,
  authorizationId: string,
): Promise<{ ok: true; token: TiktokBusinessTokenData } | { ok: false; error: string }> {
  const config = resolveTiktokBusinessConfig()
  const { data: stored, error: tokenReadError } = await sb
    .from('tiktok_business_authorization_tokens')
    .select('refresh_token')
    .eq('authorization_id', authorizationId)
    .maybeSingle()

  if (tokenReadError || !stored?.refresh_token) {
    return { ok: false, error: 'TikTok Business refresh credential is unavailable.' }
  }

  const response = await fetch(`${TIKTOK_BUSINESS_API_BASE}/tt_user/oauth2/refresh_token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: 'refresh_token',
      refresh_token: stored.refresh_token,
    }),
  })
  const result = await parseBusinessResponse<TiktokBusinessTokenData>(response)
  if (!result.data) {
    await sb.from('tiktok_business_authorizations').update({
      status: 'needs_reauth',
      last_error_code: result.error?.code ?? 'refresh_failed',
      last_error_message: result.error?.message ?? 'TikTok Business token refresh failed.',
      last_verified_at: new Date().toISOString(),
    }).eq('id', authorizationId)
    return { ok: false, error: 'TikTok Business authorization needs reconnection.' }
  }

  const now = Date.now()
  const { error: tokenWriteError } = await sb
    .from('tiktok_business_authorization_tokens')
    .update({
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
    })
    .eq('authorization_id', authorizationId)
  if (tokenWriteError) return { ok: false, error: 'Could not store refreshed TikTok Business credentials.' }

  const { error: metadataWriteError } = await sb
    .from('tiktok_business_authorizations')
    .update({
      status: 'connected',
      granted_permissions: result.data.scope.split(',').map(scope => scope.trim()).filter(Boolean),
      token_expires_at: new Date(now + result.data.expires_in * 1000).toISOString(),
      refresh_token_expires_at: new Date(now + result.data.refresh_token_expires_in * 1000).toISOString(),
      last_token_refresh_at: new Date(now).toISOString(),
      last_verified_at: new Date(now).toISOString(),
      last_error_code: null,
      last_error_message: null,
    })
    .eq('id', authorizationId)
  if (metadataWriteError) return { ok: false, error: 'Could not store refreshed TikTok Business connection health.' }

  return { ok: true, token: result.data }
}
