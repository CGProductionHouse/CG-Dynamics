import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { PublishingIntent, PublishingObservation, TikTokStatusAudit } from './socialPublishing.ts'
import type { SocialProviderBindings } from './socialPublishingQueue.ts'
import { socialPublicationFingerprint } from './socialPublicationAuthorization.ts'
import { boundedPublishingRead } from './socialPublishingRead.ts'
import { isTikTokBusinessReceipt, TIKTOK_PUBLIC_POST_ID } from './tiktokBusinessPublishingStatus.ts'
import { readStoredTikTokBusinessStatus } from './tiktokBusinessStatusRuntime.ts'
import type { TikTokBusinessStatusCredentialConfig } from './tiktokBusinessStatusCredential.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATES = ['submitting', 'processing', 'provider_scheduled', 'unknown_outcome']
const NATIVE_STATES = ['processing', 'provider_scheduled', 'posted', 'failed', 'unknown_outcome']
const MAX_READS = 5, READ_DELAY_MS = 180_000, MAX_AGE_MS = 20 * 60_000
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const instant = (v: unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) ? Date.parse(v) : NaN
const sameSource = (a: Record<string, unknown>, b: Readonly<PublishingIntent>) =>
  ['key', 'clientId', 'deliverableId', 'reviewVersionId', 'platform', 'route', 'connectionId', 'accountId', 'assetPath', 'assetSha256', 'mediaType', 'caption', 'scheduledAt', 'authorizationId']
    .every(k => a[k] === b[k as keyof PublishingIntent])
function fail(): never { throw new Error('TIKTOK_DURABLE_RECEIPT_REQUIRED') }
interface Options { fetch?: typeof fetch; now?: () => number; signal?: AbortSignal; readTimeoutMs?: number }

function audit(value: unknown, i: Readonly<PublishingIntent>, now: number): TikTokStatusAudit | null {
  if (value === undefined) return null
  if (!object(value)) fail()
  // The existing SQL receipt writer strips nested null fields. Accept that
  // exact compact terminal representation; processing still needs its deadline.
  const notBefore = value.notBefore ?? null
  const keys = value.notBefore === undefined ? 'businessId,checkedAt,nativeState,publicPostIds,publishId,statusReads,version'
    : 'businessId,checkedAt,nativeState,notBefore,publicPostIds,publishId,statusReads,version'
  if (Object.keys(value).sort().join(',') !== keys
    || value.version !== 1 || value.businessId !== i.accountId || value.publishId !== i.providerOperationId
    || !Array.isArray(value.publicPostIds) || value.publicPostIds.length > 32 || new Set(value.publicPostIds).size !== value.publicPostIds.length
    || value.publicPostIds.some(id => typeof id !== 'string' || !TIKTOK_PUBLIC_POST_ID.test(id))
    || typeof value.nativeState !== 'string' || !NATIVE_STATES.includes(value.nativeState) || !Number.isSafeInteger(value.statusReads) || (value.statusReads as number) < 1 || (value.statusReads as number) > MAX_READS
    || (value.nativeState === 'posted' && value.publicPostIds.length !== 1)
    || (['processing', 'failed', 'provider_scheduled'].includes(value.nativeState) && value.publicPostIds.length !== 0)
    || !Number.isFinite(instant(value.checkedAt)) || instant(value.checkedAt) > now
    || (notBefore !== null && (instant(notBefore) !== instant(value.checkedAt) + READ_DELAY_MS || value.nativeState !== 'processing'))
    || (value.nativeState === 'processing' && notBefore === null)) fail()
  return Object.freeze({ ...value, notBefore, publicPostIds: Object.freeze([...value.publicPostIds]) }) as unknown as TikTokStatusAudit
}

/** PRIVATE status-only queue bridge. Reuses background_jobs JSON/lease RPCs;
 * no migration, endpoint, worker registration, env gate or publishing method.
 * Native success stays UNKNOWN until a qualified uploader durably proves the
 * immutable source-to-share_id link. This bridge cannot invent that proof.
 */
export async function readTikTokBusinessQueueObservation(sb: SupabaseClient, configuration: TikTokBusinessStatusCredentialConfig,
  jobId: string, input: Readonly<PublishingIntent>, settings: Options = {}): Promise<PublishingObservation> {
  const i = Object.freeze({ ...input }), config = Object.freeze({ ...configuration }), options = Object.freeze({ ...settings }), clock = options.now ?? Date.now
  const operationId = isTikTokBusinessReceipt(i) ? i.providerOperationId! : undefined
  const postId = typeof i.providerPostId === 'string' && TIKTOK_PUBLIC_POST_ID.test(i.providerPostId) ? i.providerPostId : undefined
  const unknown = (errorCode: string): PublishingObservation => ({ state: 'unknown_outcome', operationId, postId, errorCode })
  if (!UUID.test(jobId) || !isTikTokBusinessReceipt(i) || !STATES.includes(i.state)
    || ![i.deliverableId, i.reviewVersionId, i.authorizationId].every(id => UUID.test(id))
    || typeof i.key !== 'string' || !i.key || typeof i.assetSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(i.assetSha256)
    || typeof i.assetPath !== 'string' || !i.assetPath.startsWith(`${i.deliverableId}/`)) return unknown('TIKTOK_DURABLE_RECEIPT_REQUIRED')
  try {
    return await boundedPublishingRead(async signal => {
      const live = () => { if (signal.aborted) throw new Error('TIKTOK_STATUS_RECONCILIATION_UNAVAILABLE') }
      const start = clock(), fingerprint = await socialPublicationFingerprint(i)
      live()
      if (!Number.isFinite(start)) fail()
      async function snapshot() {
        live()
        const result = await sb.from('background_jobs').select('id,job_type,idempotency_key,status,locked_by,locked_at,payload,publication')
          .eq('id', jobId).eq('job_type', 'social_publish').abortSignal(signal).maybeSingle()
        live()
        const row = result.data, p = row?.publication, stored = row?.payload?.intent, a = p?.authorization, current = clock()
        if (result.error || !row || row.id !== jobId || row.job_type !== 'social_publish' || row.idempotency_key !== i.key || row.status !== 'running'
          || typeof row.locked_by !== 'string' || !row.locked_by.trim() || !Number.isFinite(instant(row.locked_at))
          || !Number.isFinite(current) || current < start || instant(row.locked_at) > current || instant(row.locked_at) <= current - 300_000
          || !object(p) || typeof p.fence !== 'string' || !UUID.test(p.fence) || p.state !== i.state
          || !STATES.includes(String(p.state)) || !Number.isFinite(instant(p.started_at)) || instant(p.started_at) > current
          || !UUID.test(String(p.submission_fence)) || typeof p.submission_worker !== 'string' || !p.submission_worker.trim()
          || !object(stored) || !sameSource(stored, i) || !object(a) || a.id !== i.authorizationId || a.actorId !== row.payload.authorized_by
          || !UUID.test(String(a.actorId)) || a.fingerprint !== fingerprint) fail()
        // Withdrawal must not conceal an already-started task. No current
        // publication authority or live source approval is manufactured here.
        if (p.observation !== undefined && !object(p.observation) || p.late_observation !== undefined && !object(p.late_observation)) fail()
        const observation = { ...(object(p.observation) ? p.observation : {}), ...(object(p.late_observation) ? p.late_observation : {}) }
        if (observation.operationId !== i.providerOperationId || (observation.postId ?? null) !== i.providerPostId) fail()
        const previous = audit(observation.tiktokStatus, i, current)
        return { previous, started: instant(p.started_at), identity: JSON.stringify([row.locked_by, row.locked_at, p.fence, p.state, p.started_at,
          p.submission_fence, p.submission_worker, stored, a.id, a.actorId, a.fingerprint, observation]) }
      }
      const before = await snapshot(), previous = before.previous
      if (previous && previous.nativeState !== 'processing') return {
        ...unknown('TIKTOK_RECEIPT_REVIEW_REQUIRED'), tiktokStatus: previous,
      }
      if (start - before.started >= MAX_AGE_MS || previous && previous.statusReads >= MAX_READS) return {
        ...unknown('TIKTOK_BOUNDED_REVIEW_REQUIRED'), ...(previous ? { tiktokStatus: previous } : {}),
      }
      if (previous?.notBefore && instant(previous.notBefore) > start) return {
        state: 'processing', operationId, postId, errorCode: 'TIKTOK_STATUS_READ_NOT_DUE', tiktokStatus: previous,
      }
      // The concrete resolver privately verifies native app/account/scopes and
      // decrypts only the access envelope; no credential enters audit JSON.
      const result = await readStoredTikTokBusinessStatus(sb, config, i, { ...options, signal })
      live()
      const after = await snapshot()
      if (after.identity !== before.identity) return unknown('TIKTOK_DURABLE_RECEIPT_CHANGED')
      const checked = clock()
      if (!Number.isFinite(checked) || checked < start || checked - before.started >= MAX_AGE_MS) return unknown('TIKTOK_BOUNDED_REVIEW_REQUIRED')
      const publicPostIds = [...new Set([...(previous?.publicPostIds ?? []), ...result.publicPostIds])]
      if (publicPostIds.length > 32) return unknown('TIKTOK_PUBLIC_POST_IDS_UNVERIFIED')
      const evidence: TikTokStatusAudit = Object.freeze({ version: 1, businessId: i.accountId, publishId: operationId!, publicPostIds: Object.freeze(publicPostIds),
        nativeState: result.observation.state, checkedAt: new Date(checked).toISOString(), statusReads: (previous?.statusReads ?? 0) + 1,
        notBefore: result.readAfterSeconds === 180 ? new Date(checked + READ_DELAY_MS).toISOString() : null })
      // Processing preserves the duplicate barrier. Every terminal native
      // result needs source provenance before changing canonical completion.
      const observation = result.observation.state === 'processing' ? result.observation : {
        ...result.observation, state: 'unknown_outcome' as const,
        errorCode: result.observation.state === 'posted' || result.observation.state === 'failed'
          ? 'TIKTOK_SOURCE_TO_RECEIPT_UNVERIFIED' : result.observation.errorCode,
      }
      return { ...observation, tiktokStatus: evidence }
    }, { milliseconds: options.readTimeoutMs, upstream: options.signal, error: () => new Error('TIKTOK_STATUS_RECONCILIATION_UNAVAILABLE') })
  } catch { return unknown('TIKTOK_STATUS_RECONCILIATION_UNAVAILABLE') }
}

/** Bind only to a FUTURE explicitly registered reconciliation lane. Queued or
 * retry_wait jobs cannot use this object to create a publication or preflight.
 */
export function tiktokBusinessQueueStatusBindings(sb: SupabaseClient, config: TikTokBusinessStatusCredentialConfig, jobId: string, options: Options = {}): SocialProviderBindings {
  const configuration = Object.freeze({ ...config }), settings = Object.freeze({ ...options })
  return Object.freeze({
    async readCurrent() { throw new Error('TikTok submission is not configured.') },
    async submit() { throw new Error('TikTok submission is not configured.') },
    async reconcile(intent: Readonly<PublishingIntent>) { return await readTikTokBusinessQueueObservation(sb, configuration, jobId, intent, settings) },
  })
}
