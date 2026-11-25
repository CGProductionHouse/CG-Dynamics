import { encryptTiktokBusinessStoredToken, validateTiktokBusinessTokenEncryptionConfig } from './tiktokBusinessTokenStorage.ts'

export const TIKTOK_BUSINESS_SCOPES = ['video.list', 'video.insights', 'video.publish', 'user.info.basic', 'user.info.username', 'user.info.stats', 'user.info.profile', 'user.account.type'] as const
export interface BusinessOAuthConfig { appId: string; appSecret: string; redirectUri: string; key: string; keyVersion: string; appUrl: string }
export interface BusinessOAuthState { id: string; client_id: string; connection_id: string; requested_by: string; expected_handle: string }
export interface BusinessOAuthStore {
  // Authenticate active manager, active exact client and existing connected
  // tiktok_connections row; retain explicit expected-handle confirmation.
  prepare(input: { clientId: string; connectionId: string; actorId: string; handle: string; stateHash: string; expiresAt: string }): Promise<boolean>
  consume(hash: string): Promise<BusinessOAuthState | null>
  complete(input: { state: BusinessOAuthState; openId: string; handle: string; displayName: string; scopes: string[]; access: string; refresh: string; accessExpiry: string; refreshExpiry: string }): Promise<boolean>
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export const normalizeBusinessHandle = (value: unknown) => typeof value === 'string' && /^@?[a-zA-Z0-9._]{2,24}$/.test(value) ? value.replace(/^@/, '').toLowerCase() : null
export async function businessStateHash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
}
export async function validateBusinessOAuthConfig(c: BusinessOAuthConfig) {
  if (!/^\d+$/.test(c.appId) || !c.appSecret || /\s/.test(c.appSecret)) throw new Error('TikTok Business OAuth configuration unavailable.')
  const redirect = new URL(c.redirectUri), app = new URL(c.appUrl)
  if (redirect.protocol !== 'https:' || redirect.pathname !== '/functions/v1/tiktok-business-oauth-callback'
    || redirect.username || redirect.password || redirect.search || redirect.hash
    || app.protocol !== 'https:' || app.username || app.password || app.search || app.hash || app.pathname !== '/') throw new Error('TikTok Business OAuth origin configuration invalid.')
  await validateTiktokBusinessTokenEncryptionConfig(c.key, c.keyVersion)
}
export async function startBusinessOAuth(c: BusinessOAuthConfig, store: BusinessOAuthStore, input: {
  clientId: string; connectionId: string; actorId: string; expectedHandle: string; confirmExactAccount: boolean
}, now = Date.now()) {
  await validateBusinessOAuthConfig(c)
  const handle = normalizeBusinessHandle(input.expectedHandle)
  if (!handle || !input.confirmExactAccount || ![input.clientId, input.connectionId, input.actorId].every(v => uuid.test(v))) throw new Error('Confirm one exact existing client/account before connecting.')
  const raw = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
  if (!await store.prepare({ ...input, handle, stateHash: await businessStateHash(raw), expiresAt: new Date(now + 5 * 60_000).toISOString() })) throw new Error('Exact client/account authorization unavailable.')
  const url = new URL('https://www.tiktok.com/v2/auth/authorize/')
  url.search = new URLSearchParams({ client_key: c.appId, scope: TIKTOK_BUSINESS_SCOPES.join(','), response_type: 'code', redirect_uri: c.redirectUri, state: raw }).toString()
  return url.href // Only returned to the authenticated initiating staff browser.
}
const API = 'https://business-api.tiktok.com/open_api/v1.3'
export async function businessRequest(fetcher: typeof fetch, path: string, init: RequestInit) {
  const response = await fetcher(`${API}${path}`, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error('TikTok Business request unavailable.')
  const body = await response.json() as { code?: unknown; data?: Record<string, unknown> }
  if (body.code !== 0 || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) throw new Error('TikTok Business response unavailable.')
  return body.data
}
/** No retry of single-use code exchange. Never return/log codes or credentials. */
export async function finishBusinessOAuth(c: BusinessOAuthConfig, store: BusinessOAuthStore, url: URL, fetcher: typeof fetch = fetch, now = Date.now()) {
  await validateBusinessOAuthConfig(c)
  const raw = url.searchParams.get('state')
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return false
  const state = await store.consume(await businessStateHash(raw))
  if (!state || ![state.id, state.client_id, state.connection_id, state.requested_by].every(v => uuid.test(v))) return false
  const code = url.searchParams.get('code') ?? url.searchParams.get('auth_code')
  if (url.searchParams.has('error') || !code || code.length > 4096 || /\s/.test(code)
    || (url.searchParams.has('code') && url.searchParams.has('auth_code') && url.searchParams.get('code') !== url.searchParams.get('auth_code'))) return false
  const token = await businessRequest(fetcher, '/tt_user/oauth2/token/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: c.appId, client_secret: c.appSecret, grant_type: 'authorization_code', auth_code: code, redirect_uri: c.redirectUri }) })
  const scopes = typeof token.scope === 'string' ? token.scope.split(',').map(v => v.trim()).filter(Boolean) : []
  if (TIKTOK_BUSINESS_SCOPES.some(scope => !scopes.includes(scope)) || typeof token.open_id !== 'string' || !token.open_id
    || typeof token.access_token !== 'string' || typeof token.refresh_token !== 'string'
    || !Number.isInteger(token.expires_in) || Number(token.expires_in) <= 0 || Number(token.expires_in) > 86400
    || !Number.isInteger(token.refresh_token_expires_in) || Number(token.refresh_token_expires_in) <= 0 || Number(token.refresh_token_expires_in) > 31622400) return false
  const profile = await businessRequest(fetcher, `/business/get/?${new URLSearchParams({ business_id: token.open_id, fields: JSON.stringify(['username', 'display_name']) })}`,
    { method: 'GET', headers: { 'Access-Token': token.access_token } })
  const handle = normalizeBusinessHandle(profile.username)
  if (!handle || handle !== state.expected_handle) return false
  const access = await encryptTiktokBusinessStoredToken(token.access_token, `${state.connection_id}:access`, c.key, c.keyVersion)
  const refresh = await encryptTiktokBusinessStoredToken(token.refresh_token, `${state.connection_id}:refresh`, c.key, c.keyVersion)
  const saved = await store.complete({ state, openId: token.open_id, handle, displayName: typeof profile.display_name === 'string' ? profile.display_name.slice(0, 200) : handle,
    scopes, access, refresh, accessExpiry: new Date(now + Number(token.expires_in) * 1000).toISOString(), refreshExpiry: new Date(now + Number(token.refresh_token_expires_in) * 1000).toISOString() })
  return saved ? { clientId: state.client_id, connectionId: state.connection_id, handle } : false
}
