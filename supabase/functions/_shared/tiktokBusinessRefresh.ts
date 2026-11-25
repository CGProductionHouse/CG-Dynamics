import { businessRequest, TIKTOK_BUSINESS_SCOPES, validateBusinessOAuthConfig, type BusinessOAuthConfig } from './tiktokBusinessOAuth.ts'
import { encryptTiktokBusinessStoredToken, readTiktokBusinessStoredToken } from './tiktokBusinessTokenStorage.ts'

interface RefreshClaim { id: string; connectionId: string; openId: string; fence: string; refresh: string }
interface RefreshClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
/** Refresh is leased separately from publishing. No automatic retry after an
 * ambiguous credential rotation; fresh consent cannot be overwritten by an
 * older refresh response. No analytics token or mapping is touched.
 */
export async function refreshBusinessAuthorization(sb: RefreshClient, authorizationId: string, c: BusinessOAuthConfig, fetcher: typeof fetch = fetch, now = Date.now()): Promise<boolean> {
  await validateBusinessOAuthConfig(c)
  const claim = await sb.rpc('claim_tiktok_business_refresh', { p_authorization: authorizationId })
  if (claim.error) throw new Error('TikTok Business refresh storage unavailable.')
  const a = claim.data as RefreshClaim | null
  if (!a) return false
  try {
    const { accessToken: refreshToken } = await readTiktokBusinessStoredToken(a.refresh, `${a.connectionId}:refresh`, c.key, c.keyVersion)
    const token = await businessRequest(fetcher, '/tt_user/oauth2/refresh_token/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: c.appId, client_secret: c.appSecret, grant_type: 'refresh_token', refresh_token: refreshToken }) })
    const scopes = typeof token.scope === 'string' ? token.scope.split(',').map(s => s.trim()).filter(Boolean) : []
    if (token.open_id !== a.openId || TIKTOK_BUSINESS_SCOPES.some(s => !scopes.includes(s)) || typeof token.access_token !== 'string' || typeof token.refresh_token !== 'string'
      || !Number.isInteger(token.expires_in) || Number(token.expires_in)<=0 || Number(token.expires_in)>86400
      || !Number.isInteger(token.refresh_token_expires_in) || Number(token.refresh_token_expires_in)<=0 || Number(token.refresh_token_expires_in)>31622400) throw new Error('Unverified refresh response.')
    const access = await encryptTiktokBusinessStoredToken(token.access_token, `${a.connectionId}:access`, c.key, c.keyVersion)
    const refresh = await encryptTiktokBusinessStoredToken(token.refresh_token, `${a.connectionId}:refresh`, c.key, c.keyVersion)
    const saved = await sb.rpc('save_tiktok_business_refresh', { p_authorization: a.id, p_fence: a.fence, p_open_id: a.openId,
      p_access: access, p_refresh: refresh, p_scopes: scopes, p_access_expiry: new Date(now+Number(token.expires_in)*1000).toISOString(), p_refresh_expiry: new Date(now+Number(token.refresh_token_expires_in)*1000).toISOString() })
    if (saved.error || saved.data !== true) throw new Error('Refresh receipt unverified.')
    return true
  } catch {
    // The fenced failure cannot invalidate a newer completed OAuth connection.
    const failed = await sb.rpc('fail_tiktok_business_refresh', { p_authorization: a.id, p_fence: a.fence })
    if (failed.error) throw new Error('Refresh outcome requires reconciliation.')
    return false
  }
}
