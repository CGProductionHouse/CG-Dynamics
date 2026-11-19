import type { PublishingIntent } from './socialPublishing.ts'
import { boundedLinkedInRead, LinkedInReadError, LINKEDIN_ORGANIZATION_URN, LINKEDIN_POST_URN, LINKEDIN_IMAGE_URN,
  type LinkedInPhotoReadPort, type LinkedInReadBinding } from './linkedInPhotoStatus.ts'

export interface PrivateLinkedInReadCredential extends LinkedInReadBinding {
  accessToken: string; verifiedAt: string; tokenValidUntil: string; grantedScopes: readonly string[]
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const MAX_READ_BYTES = 262_144
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function fail(code: string): never { throw new LinkedInReadError(code) }

/** PRIVATE GET-only transport. OAuth/current organization role + exact active
 * mapping resolution is deliberately a REQUIRED, unimplemented server port;
 * there is no token/config store, browser credential reuse or passing default.
 * Never register this until that separate provider milestone is accepted.
 */
export async function linkedInPhotoReadTransport(input: {
  intent: Readonly<PublishingIntent>; apiVersion: string
  resolveCredential(target: Readonly<LinkedInReadBinding>, signal: AbortSignal): Promise<PrivateLinkedInReadCredential>
  fetch?: typeof fetch; now?: () => number; readTimeoutMs?: number
}): Promise<LinkedInPhotoReadPort> {
  const i = Object.freeze({ ...input.intent }), version = input.apiVersion, now = input.now ?? Date.now, start = now(), timeout = input.readTimeoutMs
  const fetcher = input.fetch ?? fetch, resolveCredential = input.resolveCredential
  if (i.platform !== 'linkedin' || i.route !== 'linkedin_organization' || !LINKEDIN_ORGANIZATION_URN.test(i.accountId)
    || !UUID.test(i.clientId) || !UUID.test(i.connectionId)
    || !LINKEDIN_POST_URN.test(i.providerPostId ?? '') || !LINKEDIN_IMAGE_URN.test(i.providerOperationId ?? '') || !Number.isFinite(start)) fail('LINKEDIN_EXACT_RECEIPT_REQUIRED')
  // Conservative rolling pilot window; no unversioned/latest or fallback. A
  // supported monthly version still needs exact native endpoint acceptance.
  if (typeof version !== 'string' || !/^20\d{2}(0[1-9]|1[0-2])$/.test(version)) fail('LINKEDIN_API_VERSION_REQUIRED')
  const calendar = new Date(start), month = calendar.getUTCFullYear() * 12 + calendar.getUTCMonth()
  const selectedMonth = Number(version.slice(0, 4)) * 12 + Number(version.slice(4)) - 1
  if (selectedMonth > month || month - selectedMonth >= 12) fail('LINKEDIN_API_VERSION_REVIEW_REQUIRED')
  const binding = Object.freeze({ clientId: i.clientId, connectionId: i.connectionId, accountId: i.accountId, route: i.route as 'linkedin_organization' })
  let credential: PrivateLinkedInReadCredential
  try { credential = await boundedLinkedInRead(signal => resolveCredential(binding, signal), timeout) }
  catch { return fail('LINKEDIN_CURRENT_READ_CREDENTIAL_REQUIRED') }
  const received = now(), verified = Date.parse(credential.verifiedAt), expiry = Date.parse(credential.tokenValidUntil)
  if (credential.clientId !== binding.clientId || credential.connectionId !== binding.connectionId || credential.accountId !== binding.accountId || credential.route !== binding.route
    || typeof credential.accessToken !== 'string' || !credential.accessToken || credential.accessToken.length > 16_384 || /\s/.test(credential.accessToken)
    || !Number.isFinite(received) || received < start || received - start >= 120_000 || !(verified >= received - 60_000 && verified <= received)
    || !(expiry > received + 60_000) || !Array.isArray(credential.grantedScopes) || !credential.grantedScopes.includes('r_organization_social')) fail('LINKEDIN_CURRENT_READ_CREDENTIAL_REQUIRED')
  const accessToken = credential.accessToken, scopes = [...credential.grantedScopes]
  function fresh() {
    const time = now()
    if (!Number.isFinite(time) || time < received || time - received >= 120_000 || expiry <= time + 15_000) fail('LINKEDIN_READ_CREDENTIAL_RECHECK_REQUIRED')
  }
  async function get(path: string, fields: Record<string, string>, callerSignal: AbortSignal) {
    fresh()
    if (callerSignal.aborted) fail('LINKEDIN_READ_ABORTED')
    return await boundedLinkedInRead(async signal => {
      const abort = () => fail('LINKEDIN_READ_ABORTED')
      // Share caller cancellation and bound fetch plus body consumption. No
      // automatic retry even if a custom transport ignores cancellation.
      const url = new URL(`https://api.linkedin.com/rest/${path}`)
      url.search = new URLSearchParams(fields).toString()
      try {
        const response = await fetcher(url.href, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`,
          'LinkedIn-Version': version, 'X-Restli-Protocol-Version': '2.0.0', Accept: 'application/json' }, redirect: 'error', signal })
        if (callerSignal.aborted) abort()
        if (!response.ok) fail(response.status === 404 && fields.viewContext === 'READER' ? 'LINKEDIN_PUBLIC_READER_UNAVAILABLE'
          : response.status === 401 || response.status === 403 ? 'LINKEDIN_READ_ACCESS_UNVERIFIED'
          : response.status === 429 ? 'LINKEDIN_READ_RATE_LIMITED' : 'LINKEDIN_READ_HTTP_UNVERIFIED')
        const declared = response.headers.get('content-length')
        if ((declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_READ_BYTES))
          || response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json' || !response.body) fail('LINKEDIN_READ_RESPONSE_UNVERIFIED')
        const reader = response.body.getReader(), chunks: Uint8Array[] = []
        let size = 0
        try {
          while (true) {
            const next = await reader.read()
            if (callerSignal.aborted) abort()
            if (next.done) break
            size += next.value.length
            if (size > MAX_READ_BYTES) fail('LINKEDIN_READ_RESPONSE_UNVERIFIED')
            chunks.push(next.value)
          }
        } finally { void reader.cancel().catch(() => {}); reader.releaseLock() }
        const bytes = new Uint8Array(size)
        let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
        const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
        if (!object(data) || data.error || typeof data.status === 'number' && data.status >= 400) fail('LINKEDIN_READ_RESPONSE_UNVERIFIED')
        fresh()
        return data
      } catch (error) { if (error instanceof LinkedInReadError) throw error; return fail('LINKEDIN_READ_RESPONSE_UNVERIFIED') }
    }, timeout, callerSignal)
  }
  return Object.freeze({ binding,
    async readPost(postUrn: string, view: 'AUTHOR' | 'READER', signal: AbortSignal) {
      if (postUrn !== i.providerPostId || !['AUTHOR', 'READER'].includes(view)) fail('LINKEDIN_EXACT_POST_REQUIRED')
      return await get(`posts/${encodeURIComponent(postUrn)}`, { viewContext: view }, signal)
    },
    async readImage(imageUrn: string, signal: AbortSignal) {
      if (imageUrn !== i.providerOperationId) fail('LINKEDIN_EXACT_IMAGE_REQUIRED')
      // Versioned Images GET needs its own eligible scope; never enlarge it to
      // ads/member grants or infer image access merely from post-read access.
      if (!scopes.includes('w_organization_social')) fail('LINKEDIN_IMAGE_READ_ACCESS_REQUIRED')
      return await get(`images/${encodeURIComponent(imageUrn)}`, {}, signal)
    },
  })
}
