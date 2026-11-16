import type { InstagramPublishingTransport } from './instagramPublishing.ts'
import { PUBLISHING_PATHS, type PublishingIntent } from './socialPublishing.ts'

export class InstagramPublishingTransportError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'InstagramPublishingTransportError' }
}
interface PrivateInstagramCredential {
  clientId: string; connectionId: string; accountId: string; route: 'instagram_login' | 'instagram_facebook_login'
  accessToken: string; tokenValidUntil: string; verifiedAt: string; grantedScopes: readonly string[]
}
const token = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 16_384 && !/\s/.test(s)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
function fail(code: string): never { throw new InstagramPublishingTransportError(code) }

/** PRIVATE, unregistered transport factory. The existing login-specific store
 * adapter must resolve/decrypt and verify CURRENT app, professional account,
 * scopes, roles and exact mapping; it must NOT return analytics-only evidence.
 * This factory is not that credential verifier and cannot authorize a job.
 * No request body/UI/MCP receives or supplies these private ports/settings.
 */
export async function instagramPhotoTransport(input: {
  intent: Readonly<PublishingIntent>; stage: 'create' | 'publish' | 'status'; graphVersion: string; appSecret?: string
  resolveCredential(intent: Readonly<PublishingIntent>): Promise<PrivateInstagramCredential>
  qualifiedMediaUrl(intent: Readonly<PublishingIntent>): Promise<string>
  fetch?: typeof fetch; now?: () => number
}): Promise<InstagramPublishingTransport> {
  const i = Object.freeze({ ...input.intent }), stage = input.stage, now = input.now ?? Date.now, version = input.graphVersion
  if (i.platform !== 'instagram' || !['instagram_login', 'instagram_facebook_login'].includes(i.route) || !/^\d+$/.test(i.accountId)
    || !/^v\d+\.\d+$/.test(version) || !['create', 'publish', 'status'].includes(stage) || i.mediaType !== 'image/jpeg'
    || (i.route === 'instagram_facebook_login' && !token(input.appSecret))) fail('INSTAGRAM_TRANSPORT_CONTRACT_REQUIRED')
  if ((stage === 'create' && (!['queued', 'retry_wait'].includes(i.state) || i.providerOperationId || i.providerPostId))
    || (stage === 'publish' && (i.state !== 'processing' || !/^\d+$/.test(i.providerOperationId ?? '') || i.providerPostId))
    || (stage === 'status' && !/^\d+$/.test(i.providerOperationId ?? ''))) fail('INSTAGRAM_TRANSPORT_STAGE_REQUIRED')
  const appSecret = input.appSecret, base = `https://${i.route === 'instagram_login' ? 'graph.instagram.com' : 'graph.facebook.com'}/${version}`
  const fetcher = input.fetch ?? fetch, resolved = now()
  const c = await input.resolveCredential(i).catch(() => fail('INSTAGRAM_CURRENT_CREDENTIAL_REQUIRED'))
  const checked = Date.parse(c.verifiedAt), expiry = Date.parse(c.tokenValidUntil)
  if (c.clientId !== i.clientId || c.connectionId !== i.connectionId || c.accountId !== i.accountId || c.route !== i.route || !token(c.accessToken)
    || !Number.isFinite(resolved) || !Number.isFinite(checked) || checked < resolved - 60_000 || checked > resolved
    || !(expiry > resolved + 120_000) || !Array.isArray(c.grantedScopes) || PUBLISHING_PATHS[i.route].scopes.some(s => !c.grantedScopes.includes(s))) fail('INSTAGRAM_CURRENT_CREDENTIAL_REQUIRED')
  // Copy credential scalars so a caller cannot change the token after validation.
  const accessToken = c.accessToken
  let appProof: string | undefined
  if (i.route === 'instagram_facebook_login') {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    appProof = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(accessToken))), n => n.toString(16).padStart(2, '0')).join('')
  }
  function fresh() { const current = now(); if (!Number.isFinite(current) || current < resolved || current - resolved >= 120_000 || expiry <= current + 30_000) fail('INSTAGRAM_CREDENTIAL_RECHECK_REQUIRED') }
  async function graph(method: 'GET' | 'POST', path: string, fields: Record<string, string>) {
    fresh()
    const url = new URL(base + path), params = new URLSearchParams(fields)
    if (appProof) params.set('appsecret_proof', appProof)
    if (method === 'GET') url.search = params.toString()
    try {
      const response = await fetcher(url.href, { method, headers: { Authorization: `Bearer ${accessToken}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? params.toString() : undefined, redirect: 'error', signal: AbortSignal.timeout(15_000) })
      const data: unknown = await response.json()
      if (!response.ok || !object(data) || data.error) fail('INSTAGRAM_REQUEST_UNVERIFIED')
      return data
    } catch (error) {
      if (error instanceof InstagramPublishingTransportError) throw error
      fail('INSTAGRAM_RESPONSE_UNVERIFIED')
    }
  }
  if ((await graph('GET', `/${i.accountId}`, { fields: 'id' })).id !== i.accountId) fail('INSTAGRAM_EXACT_ACCOUNT_REQUIRED')
  let delivery: string | undefined, mutationStarted = false
  return {
    async approvedMediaUrl(candidate) {
      fresh()
      const fields = ['key', 'platform', 'clientId', 'connectionId', 'accountId', 'route', 'reviewVersionId', 'deliverableId', 'assetSha256', 'assetPath', 'mediaType', 'caption', 'scheduledAt', 'authorizationId'] as const
      if (stage !== 'create' || fields.some(f => candidate[f] !== i[f])) fail('INSTAGRAM_EXACT_SNAPSHOT_REQUIRED')
      const raw = await input.qualifiedMediaUrl(i).catch(() => fail('INSTAGRAM_QUALIFIED_JPEG_REQUIRED'))
      let url: URL
      try { url = new URL(raw) } catch { fail('INSTAGRAM_QUALIFIED_JPEG_REQUIRED') }
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('INSTAGRAM_QUALIFIED_JPEG_REQUIRED')
      delivery = raw
      return raw
    },
    async request(method, path, fields = {}) {
      fresh()
      if (method === 'POST') {
        const create = stage === 'create' && path === `/${i.accountId}/media` && !!delivery
          && fields.image_url === delivery && fields.caption === i.caption && Object.keys(fields).sort().join(',') === 'caption,image_url'
        const publish = stage === 'publish' && /^\d+$/.test(i.providerOperationId ?? '') && !i.providerPostId
          && path === `/${i.accountId}/media_publish` && fields.creation_id === i.providerOperationId && Object.keys(fields).join(',') === 'creation_id'
        if (mutationStarted || !(create || publish)) fail('INSTAGRAM_MUTATION_CONTRACT_REQUIRED')
        mutationStarted = true // Also consumed by an ambiguous timeout.
      } else if (method === 'GET') {
        const quota = stage !== 'status' && path === `/${i.accountId}/content_publishing_limit` && fields.fields === 'quota_usage,config'
        const container = stage !== 'create' && /^\d+$/.test(i.providerOperationId ?? '') && path === `/${i.providerOperationId}` && fields.fields === 'id,status_code'
        const media = stage === 'status' && /^\d+$/.test(i.providerPostId ?? '') && path === `/${i.providerPostId}` && fields.fields === 'id,owner,media_type'
        if (!(quota || container || media) || Object.keys(fields).join(',') !== 'fields') fail('INSTAGRAM_STATUS_CONTRACT_REQUIRED')
      } else fail('INSTAGRAM_METHOD_REQUIRED')
      return await graph(method, path, fields)
    },
  }
}
