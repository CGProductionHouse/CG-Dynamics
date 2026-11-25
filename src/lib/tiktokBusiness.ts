import { supabase } from './supabase'

export interface TiktokBusinessStatus {
  available: boolean
  connected: boolean
  accountHandle: string | null
  expiresAt: string | null
  message: string
}

export async function getTiktokBusinessStatus(clientId: string, connectionId: string): Promise<TiktokBusinessStatus> {
  const unavailable: TiktokBusinessStatus = { available: false, connected: false, accountHandle: null, expiresAt: null, message: 'Publishing connection setup is not available yet.' }
  try {
    const { data: result, error } = await supabase.functions.invoke('tiktok-business-connection-status', { method: 'POST', body: { clientId, connectionId } })
    if (error || result?.ok !== true) return unavailable
    const data = result.data
    if (data === undefined) return unavailable
    if (!data) return { ...unavailable, available: true, message: 'This account has no Business publishing authorization yet.' }
    if (data.client_id !== clientId || data.connection_id !== connectionId || typeof data.account_handle !== 'string'
      || !Array.isArray(data.granted_permissions) || !Number.isFinite(Date.parse(data.token_expires_at))) return unavailable
    const connected = data.status === 'connected' && Date.parse(data.token_expires_at) > Date.now() && data.granted_permissions.includes('video.publish')
    return { available: true, connected, accountHandle: data.account_handle, expiresAt: data.token_expires_at,
      message: connected ? 'Business authorization is saved. Live permissions must be checked before publishing; automated publishing remains disabled during rollout review.'
        : data.refresh_pending === true ? 'Credential refresh is in progress. Check this account again shortly.' : 'Business authorization needs reconnection or permission review.' }
  } catch { return unavailable }
}

export async function startTiktokBusinessOAuth(input: { clientId: string; connectionId: string; expectedHandle: string; confirmExactAccount: boolean }): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!input.confirmExactAccount || !/^@?[a-zA-Z0-9._]{2,24}$/.test(input.expectedHandle)) return { ok: false, error: 'Confirm the exact client and TikTok username first.' }
  try {
    const { data, error } = await supabase.functions.invoke('tiktok-business-oauth-start', { method: 'POST', body: input })
    if (error || data?.ok !== true || typeof data.url !== 'string') return { ok: false, error: 'Business connection setup is unavailable. Your analytics connection is unchanged.' }
    const url = new URL(data.url)
    if (url.origin !== 'https://www.tiktok.com' || url.pathname !== '/v2/auth/authorize/' || url.hash || url.username || url.password
      || !/^[a-f0-9]{64}$/.test(url.searchParams.get('state') ?? '')
      || url.searchParams.get('redirect_uri') !== `${String(import.meta.env.VITE_SUPABASE_URL).replace(/\/$/, '')}/functions/v1/tiktok-business-oauth-callback`) return { ok: false, error: 'TikTok authorization URL could not be verified.' }
    return { ok: true, url: url.href }
  } catch { return { ok: false, error: 'Business connection setup could not be reached. Please try again.' } }
}
