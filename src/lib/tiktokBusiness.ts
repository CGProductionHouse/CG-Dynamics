import { supabase } from './supabase'

export interface TiktokBusinessAuthorization {
  accountHandle: string | null
  displayName: string | null
  grantedPermissions: string[]
  publishingEligibility: 'not_approved' | 'video_only' | 'photo_only' | 'video_and_photo' | 'suspended'
  tokenExpiresAt: string | null
  refreshTokenExpiresAt: string | null
  accessTokenExpired: boolean
  refreshTokenExpired: boolean
  lastTokenRefreshAt: string | null
  lastVerifiedAt: string | null
}

export interface TiktokBusinessConnectionStatus {
  ok: boolean
  connected: boolean
  status: string
  publishingEnabled: boolean
  rolloutEnabled?: boolean
  providerEligible?: boolean
  message?: string
  error?: string
  authorization?: TiktokBusinessAuthorization
}

export async function getTiktokBusinessConnectionStatus(
  clientId: string,
): Promise<TiktokBusinessConnectionStatus> {
  const { data, error } = await supabase.functions.invoke('tiktok-business-connection-status', {
    method: 'POST',
    body: { clientId },
  })
  if (error) {
    return {
      ok: false,
      connected: false,
      status: 'unavailable',
      publishingEnabled: false,
      error: error.message,
    }
  }
  return data as TiktokBusinessConnectionStatus
}

export async function scheduleTiktokBusinessPublish(
  monthlyDeliverableId: string,
): Promise<{ ok: boolean; jobId?: string; message?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke('tiktok-business-schedule', {
    method: 'POST',
    body: { monthlyDeliverableId },
  })
  if (error) return { ok: false, error: error.message }
  return data
}

