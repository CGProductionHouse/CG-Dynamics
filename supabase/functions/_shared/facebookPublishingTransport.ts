import type { FacebookPublishingTransport } from './facebookPublishing.ts'
import type { PublishingIntent } from './socialPublishing.ts'

export class FacebookPublishingTransportError extends Error {
  constructor(readonly code: string, readonly httpStatus?: number, readonly retryAfterSeconds?: number) {
    super(code)
    this.name = 'FacebookPublishingTransportError'
  }
}

const tokenValid = (value: string) => typeof value === 'string' && value.length > 0 && value.length <= 16_384 && !/\s/.test(value)
function failure(code: string): never { throw new FacebookPublishingTransportError(code) }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

async function proof(token: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(token))), b => b.toString(16).padStart(2, '0')).join('')
}

/** Private Graph transport. No arbitrary URL/path/header, redirect or retry.
 * resolveUserToken must enforce the current exact client/connection mapping and
 * decrypt through metaTokenStorage; analytics user-token fallback is forbidden.
 * Call only behind server preflight and the durable begin-attempt barrier.
 */
interface FacebookPageAccessInput {
  intent: Readonly<Pick<PublishingIntent, 'platform' | 'route' | 'accountId'>>; graphVersion: string; appSecret: string
  resolveUserToken: () => Promise<string>
  fetch?: typeof fetch; now?: () => number
}

async function resolveFacebookPageAccess(input: FacebookPageAccessInput) {
  // Copy caller data so later mutation cannot change the credential's target.
  const intent = Object.freeze({ ...input.intent })
  if (intent.platform !== 'facebook' || intent.route !== 'facebook_page' || !/^\d+$/.test(intent.accountId)
    || !/^v\d+\.\d+$/.test(input.graphVersion) || !tokenValid(input.appSecret)) failure('FACEBOOK_CONFIGURATION_INVALID')
  const base = `https://graph.facebook.com/${input.graphVersion}`
  const fetcher = input.fetch ?? fetch
  const now = input.now ?? Date.now
  const resolvedAt = now()
  if (!Number.isFinite(resolvedAt)) failure('FACEBOOK_CONFIGURATION_INVALID')
  async function graph(token: string, method: 'GET' | 'POST', path: string, fields: Record<string, string | boolean>) {
    const elapsed = now() - resolvedAt
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 120_000) failure('FACEBOOK_CREDENTIAL_RECHECK_REQUIRED')
    const url = new URL(`${base}${path}`)
    const params = new URLSearchParams(Object.entries(fields).map(([k, v]) => [k, String(v)]))
    params.set('appsecret_proof', await proof(token, input.appSecret))
    if (method === 'GET') url.search = params.toString()
    let response: Response
    try {
      response = await fetcher(url.href, { method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: method === 'POST' ? params.toString() : undefined, redirect: 'error', signal: AbortSignal.timeout(15_000) })
      // Parse inside the timeout/error boundary. Never propagate raw provider text.
      const data: unknown = await response.json()
      if (!response.ok || !object(data) || data.error) {
        const retry = response.headers.get('retry-after')
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry) : undefined
        throw new FacebookPublishingTransportError('FACEBOOK_REQUEST_UNVERIFIED', response.status, seconds !== undefined && seconds <= 86_400 ? seconds : undefined)
      }
      return data
    } catch (error) {
      if (error instanceof FacebookPublishingTransportError) throw error
      throw new FacebookPublishingTransportError('FACEBOOK_RESPONSE_UNVERIFIED')
    }
  }
  const userToken = await input.resolveUserToken().catch(() => failure('FACEBOOK_CREDENTIAL_UNAVAILABLE'))
  if (!tokenValid(userToken)) failure('FACEBOOK_CREDENTIAL_UNAVAILABLE')
  // Live scopes, rather than the UI's stored analytics connection label.
  const permissions = await graph(userToken, 'GET', '/me/permissions', {})
  const rows = Array.isArray(permissions.data) ? permissions.data : []
  for (const scope of ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement']) {
    if (!rows.some(r => object(r) && r.permission === scope && r.status === 'granted')) failure('FACEBOOK_PUBLISHING_PERMISSION_MISSING')
  }
  let pageToken: string | undefined
  let after: string | undefined
  const cursors = new Set<string>()
  for (let page = 0; page < 100; page++) {
    const result = await graph(userToken, 'GET', '/me/accounts', { fields: 'id,access_token,tasks', limit: '100', ...(after ? { after } : {}) })
    if (!Array.isArray(result.data)) failure('FACEBOOK_PAGE_ACCESS_UNVERIFIED')
    const matches = result.data.filter(r => object(r) && r.id === intent.accountId)
    if (matches.length > 1) failure('FACEBOOK_PAGE_ACCESS_UNVERIFIED')
    if (matches.length === 1) {
      const match = matches[0] as Record<string, unknown>
      if (!Array.isArray(match.tasks) || !match.tasks.includes('CREATE_CONTENT') || typeof match.access_token !== 'string' || !tokenValid(match.access_token)) failure('FACEBOOK_PAGE_ACCESS_UNVERIFIED')
      pageToken = match.access_token as string
      break
    }
    const paging = object(result.paging) ? result.paging : null
    if (!paging?.next) break
    const cursor = object(paging.cursors) ? paging.cursors.after : null
    if (typeof cursor !== 'string' || !cursor || cursor.length > 4096 || cursors.has(cursor)) failure('FACEBOOK_PAGE_PAGINATION_UNVERIFIED')
    cursors.add(cursor); after = cursor
    // Never follow provider paging.next URLs carrying tokens or another host.
  }
  if (!pageToken) failure('FACEBOOK_EXACT_PAGE_REQUIRED')
  const pageIdentity = await graph(pageToken, 'GET', '/me', { fields: 'id,name' })
  if (pageIdentity.id !== intent.accountId) failure('FACEBOOK_PAGE_TOKEN_MISMATCH')
  const accountName = typeof pageIdentity.name === 'string' && pageIdentity.name.trim() && pageIdentity.name.length <= 200
    && ![...pageIdentity.name].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ? pageIdentity.name.trim() : null
  const checkedAt = now()
  if (!Number.isFinite(checkedAt) || checkedAt < resolvedAt || checkedAt - resolvedAt >= 120_000) failure('FACEBOOK_CREDENTIAL_RECHECK_REQUIRED')
  // Tokens remain captured by this PRIVATE server closure. Only the timestamp
  // is used in preparation receipts; neither the closure nor tokens are a DTO.
  function assertFresh() {
    const current = now()
    if (!Number.isFinite(current) || current < resolvedAt || current - resolvedAt >= 120_000) failure('FACEBOOK_CREDENTIAL_RECHECK_REQUIRED')
  }
  return { checkedAt: new Date(checkedAt).toISOString(), accountName, assertFresh, async request(method: 'GET' | 'POST', path: string, fields: Record<string, string | boolean>) {
    assertFresh()
    return await graph(pageToken, method, path, fields)
  } }
}

/** Read-only Page preflight. It cannot sign media or expose a mutation port. */
export async function verifyFacebookPageAccess(input: FacebookPageAccessInput): Promise<{ checkedAt: string; accountName: string | null }> {
  const access = await resolveFacebookPageAccess(input)
  return { checkedAt: access.checkedAt, accountName: access.accountName }
}

export async function facebookPhotoTransport(input: {
  intent: Readonly<PublishingIntent>; graphVersion: string; appSecret: string
  resolveUserToken: () => Promise<string>
  approvedMediaUrl: (intent: Readonly<PublishingIntent>) => Promise<string>
  fetch?: typeof fetch; now?: () => number
}): Promise<FacebookPublishingTransport> {
  const intent = Object.freeze({ ...input.intent }), now = input.now ?? Date.now
  const access = await resolveFacebookPageAccess({ ...input, intent })
  let delivery: { url: string; expires: number } | null = null
  let mutationStarted = false
  return {
    async approvedMediaUrl(candidate) {
      const fields = ['key', 'clientId', 'deliverableId', 'reviewVersionId', 'accountId', 'connectionId', 'assetPath', 'assetSha256', 'mediaType', 'caption', 'scheduledAt', 'authorizationId', 'route', 'platform'] as const
      if (fields.some(f => candidate[f] !== intent[f])) failure('FACEBOOK_INTENT_CHANGED')
      const url = await input.approvedMediaUrl(intent).catch(() => failure('FACEBOOK_MEDIA_UNVERIFIED'))
      delivery = { url, expires: now() + 300_000 }
      return url
    },
    async request(method, path, fields = {}) {
      access.assertFresh()
      if (method !== 'GET' && method !== 'POST') failure('FACEBOOK_REQUEST_METHOD_INVALID')
      if (method === 'POST') {
        if (mutationStarted || path !== `/${intent.accountId}/photos` || !delivery || now() >= delivery.expires
          || fields.url !== delivery.url || fields.caption !== intent.caption || fields.published !== true
          || Object.keys(fields).some(k => !['url', 'caption', 'published'].includes(k))) failure('FACEBOOK_SUBMISSION_CONTRACT_INVALID')
        mutationStarted = true // Even an ambiguous timeout cannot retry this transport.
      } else if (!new RegExp(`^/${intent.accountId}_\\d+$`).test(path) || fields.fields !== 'id,is_published,scheduled_publish_time'
        || Object.keys(fields).length !== 1) failure('FACEBOOK_STATUS_CONTRACT_INVALID')
      return await access.request(method, path, fields)
    },
  }
}
