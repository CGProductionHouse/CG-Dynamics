import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readTiktokBusinessStoredToken, validateTiktokBusinessTokenEncryptionConfig } from './tiktokBusinessTokenStorage.ts'
import { normalizeBusinessHandle } from './tiktokBusinessOAuth.ts'
import { boundedPublishingRead, readPublishingJson } from './socialPublishingRead.ts'
import { TIKTOK_BUSINESS_ACCOUNT_ID, TikTokBusinessReadError, tiktokReadDeadlineError, type TikTokBusinessReadBinding } from './tiktokBusinessPublishingStatus.ts'
import type { PrivateTikTokBusinessReadCredential } from './tiktokBusinessPublishingStatusTransport.ts'

export interface TikTokBusinessStatusCredentialConfig { appId: string; encryptionKey: string; keyVersion: string }
type Target = Omit<TikTokBusinessReadBinding, 'publishId'>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const REQUIRED = ['video.publish', 'user.info.username'] as const
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function fail(): never { throw new TikTokBusinessReadError('TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED') }
function scopes(input: unknown): string[] {
  if (!Array.isArray(input) || input.length > 128 || input.some(s => typeof s !== 'string' || !/^[a-z][a-z0-9._]{0,127}$/.test(s))) fail()
  return [...new Set(input as string[])].sort()
}

/** PRIVATE read-only resolver for the EXISTING Business OAuth store. Native
 * token inspection is a documented POST read, never a publish/refresh mutation.
 * No consumer credentials, app-secret requirement, scope/eligibility write,
 * caller flags or inferred client mapping. This is NOT a release/entrypoint.
 */
export async function resolveTikTokBusinessStatusCredential(sb: SupabaseClient, target: Readonly<Target>, configuration: TikTokBusinessStatusCredentialConfig,
  options: { fetch?: typeof fetch; now?: () => number; signal?: AbortSignal; readTimeoutMs?: number } = {}): Promise<PrivateTikTokBusinessReadCredential> {
  const t = Object.freeze({ ...target }), config = Object.freeze({ ...configuration }), now = options.now ?? Date.now, start = now(), fetcher = options.fetch ?? fetch
  if (t.route !== 'tiktok_accounts' || typeof t.clientId !== 'string' || !UUID.test(t.clientId) || typeof t.connectionId !== 'string' || !UUID.test(t.connectionId)
    || typeof t.accountId !== 'string' || !TIKTOK_BUSINESS_ACCOUNT_ID.test(t.accountId) || typeof config.appId !== 'string' || !/^\d{1,128}$/.test(config.appId) || !Number.isFinite(start)) fail()
  try {
    return await boundedPublishingRead(async signal => {
      function checkpoint() {
        const clock = now()
        if (signal.aborted) throw tiktokReadDeadlineError('aborted')
        if (!Number.isFinite(clock) || clock < start || clock - start >= 120_000) fail()
        return clock
      }
      await validateTiktokBusinessTokenEncryptionConfig(config.encryptionKey, config.keyVersion)
      async function readScope() {
        checkpoint()
        const [client, connection, authorization] = await Promise.all([
          sb.from('clients').select('id,active').eq('id', t.clientId).eq('active', true).abortSignal(signal).maybeSingle(),
          sb.from('tiktok_connections').select('id,client_id,status,profile_deep_link').eq('id', t.connectionId).eq('client_id', t.clientId).eq('status', 'connected').abortSignal(signal).maybeSingle(),
          sb.from('tiktok_business_authorizations').select('id,client_id,connection_id,business_open_id,account_handle,status,granted_permissions,token_expires_at,refresh_fence,refresh_started_at,updated_at')
            .eq('client_id', t.clientId).eq('connection_id', t.connectionId).eq('business_open_id', t.accountId).eq('status', 'connected').abortSignal(signal).maybeSingle(),
        ])
        const clock = checkpoint(), a = authorization.data, c = connection.data
        if (client.error || connection.error || authorization.error || client.data?.id !== t.clientId || client.data.active !== true
          || !c || c.id !== t.connectionId || c.client_id !== t.clientId || c.status !== 'connected'
          || !a || typeof a.id !== 'string' || !UUID.test(a.id) || a.client_id !== t.clientId || a.connection_id !== t.connectionId
          || a.business_open_id !== t.accountId || a.status !== 'connected' || a.refresh_fence !== null || a.refresh_started_at !== null
          || typeof a.token_expires_at !== 'string' || !(Date.parse(a.token_expires_at) > clock + 60_000)
          || typeof a.updated_at !== 'string' || !Number.isFinite(Date.parse(a.updated_at)) || Date.parse(a.updated_at) > clock + 30_000) fail()
        const handle = normalizeBusinessHandle(a.account_handle), granted = scopes(a.granted_permissions)
        if (!handle || handle !== a.account_handle || REQUIRED.some(s => !granted.includes(s))) fail()
        const link = c.profile_deep_link
        if (typeof link === 'string') {
          let parsed: URL | null = null
          try { parsed = new URL(link) } catch { /* No remote URL resolution. The consent handle remains required. */ }
          if (parsed && ['tiktok.com', 'www.tiktok.com'].includes(parsed.hostname)
            && /^\/@[^/]+\/?$/.test(parsed.pathname) && normalizeBusinessHandle(parsed.pathname.split('/')[1]) !== handle) fail()
        }
        return Object.freeze({ id: a.id as string, handle, grants: Object.freeze(granted), expiry: a.token_expires_at as string,
          updated: a.updated_at as string, link: typeof link === 'string' ? link : null })
      }
      async function readAccess(id: string) {
        checkpoint()
        const result = await sb.from('tiktok_business_authorization_tokens').select('authorization_id,access_token').eq('authorization_id', id).abortSignal(signal).maybeSingle()
        checkpoint()
        if (result.error || result.data?.authorization_id !== id || typeof result.data.access_token !== 'string') fail()
        return result.data.access_token as string
      }
      const original = await readScope(), stored = await readAccess(original.id)
      checkpoint()
      const { accessToken } = await readTiktokBusinessStoredToken(stored, `${t.connectionId}:access`, config.encryptionKey, config.keyVersion)
      checkpoint()
      async function request(kind: 'inspect' | 'profile') {
        checkpoint()
        const url = new URL(`https://business-api.tiktok.com/open_api/v1.3/${kind === 'inspect' ? 'tt_user/token_info/get/' : 'business/get/'}`)
        const init: RequestInit = { method: kind === 'inspect' ? 'POST' : 'GET', redirect: 'error', signal }
        if (kind === 'inspect') {
          init.headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
          init.body = JSON.stringify({ app_id: config.appId, access_token: accessToken })
        } else {
          init.headers = { 'Access-Token': accessToken, Accept: 'application/json' }
          url.search = new URLSearchParams({ business_id: t.accountId, fields: JSON.stringify(['username']) }).toString()
        }
        const response = await fetcher(url.href, init)
        checkpoint()
        const data = await readPublishingJson(response, signal, { maxBytes: 65_536, invalid: () => new TikTokBusinessReadError('TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED'), aborted: () => tiktokReadDeadlineError('aborted') })
        checkpoint()
        if (!object(data) || data.code !== 0 || !object(data.data)) fail()
        return data.data
      }
      const inspected = await request('inspect')
      if (inspected.app_id !== config.appId || inspected.creator_id !== t.accountId || typeof inspected.scope !== 'string' || inspected.scope.length > 8192) fail()
      const live = scopes(inspected.scope.split(',').map(s => s.trim()))
      if (REQUIRED.some(s => !live.includes(s))) fail()
      const profile = await request('profile')
      if (normalizeBusinessHandle(profile.username) !== original.handle) fail()
      // Prevent a late read from becoming authority after revocation/rotation.
      const current = await readScope(), currentStored = await readAccess(current.id)
      if (JSON.stringify(current) !== JSON.stringify(original) || currentStored !== stored) fail()
      const clock = checkpoint()
      if (!(Date.parse(original.expiry) > clock + 60_000)) fail()
      return { ...t, accessToken, tokenValidUntil: original.expiry, verifiedAt: new Date(clock).toISOString(),
        grantedScopes: Object.freeze(original.grants.filter(s => live.includes(s))) }
    }, { milliseconds: options.readTimeoutMs, upstream: options.signal, error: tiktokReadDeadlineError })
  } catch (error) {
    if (error instanceof TikTokBusinessReadError && ['TIKTOK_READ_ABORTED', 'TIKTOK_READ_TIMEOUT', 'TIKTOK_READ_TIMEOUT_INVALID'].includes(error.code)) throw error
    return fail()
  }
}
