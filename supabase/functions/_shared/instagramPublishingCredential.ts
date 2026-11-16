import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveMetaPublishingCredential, type MetaPublishingCredentialConfig, type MetaPublishingCredentialPorts } from './metaPublishingCredential.ts'
import { decryptInstagramAccessToken, INSTAGRAM_TOKEN_ENCRYPTION_VERSION } from './instagramTokenEncryption.ts'
import { parseInstagramProfessionalIdentity } from './instagramLogin.ts'
import type { PrivateInstagramCredential } from './instagramPublishingTransport.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'
import type { PublishingBinding } from './socialPublishing.ts'

export interface InstagramPublishingCredentialConfig {
  facebook?: MetaPublishingCredentialConfig
  instagram?: { graphVersion: string; appId: string; encryptionKey: string; keyVersion: string }
}
const numeric = (v: unknown): v is string => typeof v === 'string' && /^\d+$/.test(v)
const token = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 16_384 && !/\s/.test(v)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const required = {
  instagram_login: ['instagram_business_basic', 'instagram_business_content_publish'],
  instagram_facebook_login: ['pages_show_list', 'instagram_basic', 'instagram_content_publish', 'pages_read_engagement'],
} as const
function fail(): never { throw new Error('Exact Instagram publishing credential unavailable.') }

/** Read-only PRIVATE adapter over existing exact mappings + encrypted stores.
 * No analytics token fallback, credential refresh/write or scope enlargement.
 * Stored OAuth app provenance + current app-scoped /me identity authenticate
 * Instagram Login; Facebook's debug_token is never sent an Instagram token.
 */
export async function resolveInstagramPublishingCredential(sb: SupabaseClient, input: Readonly<PublicationTarget>, configuration: InstagramPublishingCredentialConfig,
  ports: MetaPublishingCredentialPorts & { fetch?: typeof fetch } = {}): Promise<PrivateInstagramCredential> {
  const t = Object.freeze({ ...input }), now = ports.now ?? Date.now, start = now(), fetcher = ports.fetch ?? fetch
  if (!['instagram_login', 'instagram_facebook_login'].includes(t.route) || !numeric(t.accountId) || !Number.isFinite(start)) fail()
  const route = t.route as PrivateInstagramCredential['route']
  const facebook = configuration.facebook ? Object.freeze({ ...configuration.facebook }) : undefined
  const selectedConfig = route === 'instagram_login' ? configuration.instagram : facebook
  if (!selectedConfig) fail()
  const config = Object.freeze({ ...selectedConfig })
  if (!numeric(config.appId) || !/^v\d+\.\d+$/.test(config.graphVersion ?? '') || !config.encryptionKey || !config.keyVersion) fail()
  const base = `https://${route === 'instagram_login' ? 'graph.instagram.com' : 'graph.facebook.com'}/${config.graphVersion}`
  const appSecret = route === 'instagram_facebook_login' ? facebook?.appSecret : undefined
  if (route === 'instagram_facebook_login' && !token(appSecret)) fail()
  async function get(accessToken: string, path: string, fields: Record<string, string>) {
    const clock = now(), remaining = start + 120_000 - clock
    if (!token(accessToken) || !Number.isFinite(clock) || clock < start || remaining <= 0) fail()
    const url = new URL(base + path), params = new URLSearchParams(fields)
    if (route === 'instagram_facebook_login') {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      params.set('appsecret_proof', Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(accessToken))), b => b.toString(16).padStart(2, '0')).join(''))
    }
    url.search = params.toString()
    const response = await fetcher(url.href, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, redirect: 'error', signal: AbortSignal.timeout(Math.min(15_000, remaining)) })
    const data: unknown = await response.json()
    if (!response.ok || !object(data) || data.error) fail()
    return data
  }
  try {
    const [client, asset] = await Promise.all([
      sb.from('clients').select('id').eq('id', t.clientId).eq('active', true).maybeSingle(),
      sb.from('meta_client_assets').select('id,client_id,connection_id,facebook_page_id,instagram_account_id,instagram_username,instagram_connection_id,is_active')
        .eq('client_id', t.clientId).eq('instagram_account_id', t.accountId).eq('is_active', true)
        .eq(route === 'instagram_login' ? 'instagram_connection_id' : 'connection_id', t.connectionId).maybeSingle(),
    ])
    if (client.error || !client.data || asset.error || !asset.data) fail()
    const a = asset.data
    let accessToken: string, expiry: number, grantedScopes: string[]
    if (route === 'instagram_login') {
      if (a.facebook_page_id !== null || a.instagram_connection_id !== t.connectionId) fail()
      const [connection, stored] = await Promise.all([
        sb.from('meta_instagram_connections').select('id,client_id,instagram_account_id,instagram_app_id,app_scoped_user_id,instagram_username,account_type,scopes,status,confirmed_asset_id')
          .eq('id', t.connectionId).eq('client_id', t.clientId).eq('instagram_account_id', t.accountId).eq('status', 'connected').maybeSingle(),
        sb.from('meta_instagram_connection_tokens').select('ciphertext_base64,iv_base64,encryption_version,key_version,token_expires_at').eq('connection_id', t.connectionId).maybeSingle(),
      ])
      const c = connection.data, s = stored.data
      if (connection.error || stored.error || !c || !s || c.confirmed_asset_id !== a.id || c.instagram_app_id !== config.appId
        || !numeric(c.app_scoped_user_id) || !['business', 'creator'].includes(c.account_type) || !Array.isArray(c.scopes)
        || required.instagram_login.some(scope => !c.scopes.includes(scope)) || s.encryption_version !== INSTAGRAM_TOKEN_ENCRYPTION_VERSION || s.key_version !== config.keyVersion) fail()
      expiry = Date.parse(s.token_expires_at ?? '')
      if (!(expiry > start + 120_000)) fail()
      accessToken = await decryptInstagramAccessToken({ encrypted: { ciphertextBase64: s.ciphertext_base64, ivBase64: s.iv_base64,
        encryptionVersion: s.encryption_version, keyVersion: s.key_version }, keyBase64: config.encryptionKey,
        context: { clientId: t.clientId, instagramAccountId: t.accountId, keyVersion: config.keyVersion } })
      const identity = parseInstagramProfessionalIdentity(await get(accessToken, '/me', { fields: 'id,user_id,username,account_type' }))
      if (identity.instagramAccountId !== t.accountId || identity.appScopedUserId !== c.app_scoped_user_id || identity.accountType !== c.account_type
        || identity.username !== c.instagram_username || identity.username !== a.instagram_username) fail()
      // OAuth's server-stored grant receipt plus current identity AND a successful
      // publishing-permission GET are used; there is no undocumented /permissions
      // or Facebook debug-token fallback on graph.instagram.com.
      grantedScopes = [...required.instagram_login]
    } else {
      if (!numeric(a.facebook_page_id) || a.instagram_connection_id !== null || !facebook) fail()
      const credential = await resolveMetaPublishingCredential(sb, t, facebook, 'instagram_facebook_photo', ports)
      expiry = Date.parse(credential.tokenValidUntil)
      const permissions = await get(credential.accessToken, '/me/permissions', {})
      const rows = Array.isArray(permissions.data) ? permissions.data : []
      grantedScopes = credential.grantedScopes.filter(scope => rows.some(r => object(r) && r.permission === scope && r.status === 'granted'))
      if (required.instagram_facebook_login.some(scope => !grantedScopes.includes(scope))) fail()
      let pageToken: string | undefined, after: string | undefined
      const cursors = new Set<string>()
      for (let page = 0; page < 100; page++) {
        const result = await get(credential.accessToken, '/me/accounts', { fields: 'id,access_token,tasks,instagram_business_account', limit: '100', ...(after ? { after } : {}) })
        if (!Array.isArray(result.data)) fail()
        const matches = result.data.filter(r => object(r) && r.id === a.facebook_page_id)
        if (matches.length > 1) fail()
        if (matches.length) {
          const p = matches[0] as Record<string, unknown>
          if (!object(p.instagram_business_account) || p.instagram_business_account.id !== t.accountId || !token(p.access_token)
            || !Array.isArray(p.tasks) || !p.tasks.some(task => ['CREATE_CONTENT', 'MANAGE'].includes(String(task)))) fail()
          pageToken = p.access_token; break
        }
        const paging = object(result.paging) ? result.paging : null
        if (!paging?.next) break
        const cursor = object(paging.cursors) ? paging.cursors.after : null
        if (typeof cursor !== 'string' || !cursor || cursor.length > 4096 || cursors.has(cursor)) fail()
        cursors.add(cursor); after = cursor
      }
      if (!pageToken) fail()
      const page = await get(pageToken, '/me', { fields: 'id,instagram_business_account' })
      if (page.id !== a.facebook_page_id || !object(page.instagram_business_account) || page.instagram_business_account.id !== t.accountId) fail()
      const identity = await get(pageToken, `/${t.accountId}`, { fields: 'id,username' })
      if (identity.id !== t.accountId || identity.username !== a.instagram_username) fail()
      accessToken = pageToken
    }
    // Both documented routes require publishing scopes for this READ endpoint.
    // A missing/revoked grant or account restriction must fail, never fall back
    // to stored reporting scopes or a guessed 50/100-post quota.
    const quota = await get(accessToken, `/${t.accountId}/content_publishing_limit`, { fields: 'quota_usage,config' })
    if (!Array.isArray(quota.data) || quota.data.length !== 1 || !object(quota.data[0])) fail()
    const q = quota.data[0], limits = q.config
    if (!Number.isSafeInteger(q.quota_usage) || (q.quota_usage as number) < 0 || !object(limits)
      || !Number.isSafeInteger(limits.quota_total) || (limits.quota_total as number) <= 0
      || !Number.isSafeInteger(limits.quota_duration) || (limits.quota_duration as number) <= 0) fail()
    const finish = now()
    if (!Number.isFinite(finish) || finish < start || finish - start >= 120_000 || expiry <= finish + 120_000) fail()
    return { clientId: t.clientId, connectionId: t.connectionId, accountId: t.accountId, route,
      accessToken, tokenValidUntil: new Date(expiry).toISOString(), verifiedAt: new Date(finish).toISOString(), grantedScopes,
      availablePublishSlots: Math.max(0, (limits.quota_total as number) - (q.quota_usage as number)) }
  } catch { return fail() }
}

/** Safe metadata projection. Media qualification and rollout/staff authority are
 * separate; this function neither signs a file nor queues/publishes anything.
 */
export async function verifyInstagramPublishingTarget(sb: SupabaseClient, target: Readonly<PublicationTarget>, config: InstagramPublishingCredentialConfig,
  ports: MetaPublishingCredentialPorts & { fetch?: typeof fetch } = {}): Promise<{ binding: PublishingBinding; checkedAt: string }> {
  const c = await resolveInstagramPublishingCredential(sb, target, config, ports)
  if (!c.availablePublishSlots) fail()
  return { checkedAt: c.verifiedAt, binding: { clientId: c.clientId, connectionId: c.connectionId, accountId: c.accountId, route: c.route,
    active: true, grantedScopes: [...c.grantedScopes], tokenValidUntil: c.tokenValidUntil,
    appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: false } }
}
