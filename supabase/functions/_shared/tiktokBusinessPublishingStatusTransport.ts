import { boundedPublishingRead, readPublishingJson } from './socialPublishingRead.ts'
import { isTikTokBusinessReceipt, TikTokBusinessReadError, tiktokReadDeadlineError,
  type TikTokBusinessReadBinding, type TikTokBusinessStatusReadPort } from './tiktokBusinessPublishingStatus.ts'
import type { PublishingIntent } from './socialPublishing.ts'

export interface PrivateTikTokBusinessReadCredential extends Omit<TikTokBusinessReadBinding, 'publishId'> {
  accessToken: string; verifiedAt: string; tokenValidUntil: string; grantedScopes: readonly string[]
}
const MAX_READ_BYTES = 65_536
function fail(code: ConstructorParameters<typeof TikTokBusinessReadError>[0]): never { throw new TikTokBusinessReadError(code) }

/** PRIVATE fixed-host GET-only adapter. The required credential port must check
 * actual current app entitlement, active exact mapping, app-specific open_id,
 * account identity and grants from the Business OAuth connection. No passing
 * default, consumer/browser credential fallback, refresh or scope write.
 */
export async function tiktokBusinessPublishingStatusTransport(input: {
  intent: Readonly<PublishingIntent>
  resolveCredential(target: Readonly<Omit<TikTokBusinessReadBinding, 'publishId'>>, signal: AbortSignal): Promise<PrivateTikTokBusinessReadCredential>
  fetch?: typeof fetch; now?: () => number; readTimeoutMs?: number; signal?: AbortSignal
}): Promise<TikTokBusinessStatusReadPort> {
  const i = Object.freeze({ ...input.intent }), now = input.now ?? Date.now, start = now(), fetcher = input.fetch ?? fetch
  if (!isTikTokBusinessReceipt(i) || !Number.isFinite(start)) fail('TIKTOK_EXACT_RECEIPT_REQUIRED')
  const binding: Readonly<TikTokBusinessReadBinding> = Object.freeze({ clientId: i.clientId, connectionId: i.connectionId,
    accountId: i.accountId, route: 'tiktok_accounts', publishId: i.providerOperationId! })
  const target = Object.freeze({ clientId: binding.clientId, connectionId: binding.connectionId, accountId: binding.accountId, route: binding.route })
  const resolveCredential = input.resolveCredential, timeout = input.readTimeoutMs, upstream = input.signal
  let credential: PrivateTikTokBusinessReadCredential
  try { credential = await boundedPublishingRead(signal => resolveCredential(target, signal), {
    milliseconds: timeout, upstream, error: tiktokReadDeadlineError,
  }) } catch { return fail('TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED') }
  if (!credential || typeof credential !== 'object') fail('TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED')
  const received = now(), expiry = Date.parse(credential.tokenValidUntil), verified = Date.parse(credential.verifiedAt)
  if (credential.clientId !== binding.clientId || credential.connectionId !== binding.connectionId || credential.accountId !== binding.accountId || credential.route !== binding.route
    || typeof credential.accessToken !== 'string' || !credential.accessToken || credential.accessToken.length > 16_384 || /\s/.test(credential.accessToken)
    || !Number.isFinite(received) || received < start || received - start >= 120_000 || !(verified >= received - 60_000 && verified <= received)
    || !(expiry > received + 60_000) || !Array.isArray(credential.grantedScopes) || !credential.grantedScopes.includes('video.publish')) fail('TIKTOK_CURRENT_READ_CREDENTIAL_REQUIRED')
  const accessToken = credential.accessToken
  let readStarted = false
  return Object.freeze({ binding, async readStatus(callerSignal: AbortSignal) {
    if (readStarted) fail('TIKTOK_READ_ALREADY_USED')
    readStarted = true
    const time = now()
    if (!Number.isFinite(time) || time < received || time - received >= 120_000 || expiry <= time + 15_000) fail('TIKTOK_READ_CREDENTIAL_RECHECK_REQUIRED')
    return await boundedPublishingRead(async signal => {
      const url = new URL('https://business-api.tiktok.com/open_api/v1.3/business/publish/status/')
      url.search = new URLSearchParams({ business_id: binding.accountId, publish_id: binding.publishId }).toString()
      try {
        const response = await fetcher(url.href, { method: 'GET', headers: { 'Access-Token': accessToken, Accept: 'application/json' }, redirect: 'error', signal })
        if (signal.aborted) fail('TIKTOK_READ_ABORTED')
        if (!response.ok) {
          void response.body?.cancel().catch(() => {})
          fail(response.status === 401 || response.status === 403 ? 'TIKTOK_READ_ACCESS_UNVERIFIED'
            : response.status === 429 ? 'TIKTOK_READ_RATE_LIMITED' : 'TIKTOK_READ_HTTP_UNVERIFIED')
        }
        const result = await readPublishingJson(response, signal, { maxBytes: MAX_READ_BYTES,
          invalid: () => new TikTokBusinessReadError('TIKTOK_READ_RESPONSE_UNVERIFIED'), aborted: () => new TikTokBusinessReadError('TIKTOK_READ_ABORTED') })
        const complete = now()
        if (!Number.isFinite(complete) || complete < time || complete - received >= 120_000 || expiry <= complete + 15_000) fail('TIKTOK_READ_CREDENTIAL_RECHECK_REQUIRED')
        return result
      } catch (error) { if (error instanceof TikTokBusinessReadError) throw error; return fail('TIKTOK_READ_RESPONSE_UNVERIFIED') }
    }, { milliseconds: timeout, upstream: upstream ? AbortSignal.any([upstream, callerSignal]) : callerSignal, error: tiktokReadDeadlineError })
  } })
}
