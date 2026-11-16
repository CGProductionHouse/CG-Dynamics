import { executePublishingIntent, type PublishingExecutionPorts } from './socialPublishingExecution.ts'
import { instagramPublishingContinuationDecision, type InstagramPublicationProtocol, type PublishingContext, type PublishingIntent, type PublishingObservation } from './socialPublishing.ts'

export const SOCIAL_PUBLICATION_JOB = 'social_publish'
interface RpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
interface Claim { key: string; fence: string; intent: PublishingIntent; state: PublishingIntent['state']; observation?: PublishingObservation; attempt: number; instagram?: InstagramPublicationProtocol }
export interface SocialProviderBindings {
  // Must resolve current canonical review, source hash, Teams date, private token
  // health and exact provider mapping server-side. Never accept caller proofs.
  readCurrent(intent: PublishingIntent): Promise<PublishingContext>
  submit(intent: Readonly<PublishingIntent>): Promise<PublishingObservation>
  reconcile(intent: Readonly<PublishingIntent>, protocol?: InstagramPublicationProtocol): Promise<PublishingObservation>
  // Only the separately fenced continuation path may invoke this second POST.
  publishReadyContainer?(intent: Readonly<PublishingIntent>): Promise<PublishingObservation>
}

/** Adapter over the EXISTING worker's claimed background_jobs row. */
export function socialPublishingQueuePorts(sb: RpcClient, jobId: string, worker: string, bindings: SocialProviderBindings) {
  let claimed: Promise<Claim | null> | undefined
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const result = await sb.rpc(name, { p_id: jobId, p_worker: worker, ...args })
    if (result.error) throw new Error('Publication queue persistence unavailable.')
    return result.data
  }
  const claim = () => claimed ??= rpc('claim_social_publication', {}).then(value => value as Claim | null)
  const ports: PublishingExecutionPorts = {
    async claim(key) {
      const row = await claim()
      if (!row || row.key !== key) return null
      return { fence: row.fence, intent: { ...row.intent, state: row.state, attempt: row.attempt,
        providerOperationId: row.observation?.operationId ?? null, providerPostId: row.observation?.postId ?? null } }
    },
    readCurrent: bindings.readCurrent,
    submit: bindings.submit,
    async beginAttempt(_intent, fence) { return await rpc('begin_social_publication', { p_fence: fence }) === true },
    async saveObservation(_intent, fence, observation) { return await rpc('save_social_publication', { p_fence: fence, p_observation: observation }) === true },
  }
  return { ...ports,
    async readInstagramProtocol(): Promise<InstagramPublicationProtocol | null> {
      const value = (await claim())?.instagram
      if (!value || !['container_creating', 'container_processing', 'container_ready', 'publishing', 'verifying'].includes(value.phase)
        || typeof value.publishAttempted !== 'boolean' || !Number.isSafeInteger(value.statusReads) || value.statusReads < 0
        || typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt))) return null
      return { ...value }
    },
    async beginInstagramPublish(intent: PublishingIntent, fence: string) {
      return await rpc('begin_instagram_publication_publish', { p_fence: fence, p_container_id: intent.providerOperationId }) === true
    },
  }
}

/** A resumed submitting job is reconciled even when the generic queue retried
 * its lease. No provider ID means manual reconciliation, never a fresh POST.
 */
export async function runClaimedSocialPublication(input: {
  sb: RpcClient; jobId: string; key: string; worker: string; now: string; enabled: boolean; bindings?: SocialProviderBindings
}) {
  const fallback: SocialProviderBindings = {
    async readCurrent() { throw new Error('Private provider binding is not configured.') },
    async submit() { throw new Error('Publishing is disabled.') },
    async reconcile() { return { state: 'unknown_outcome', errorCode: 'PROVIDER_BINDING_NOT_CONFIGURED' } },
  }
  const ports = socialPublishingQueuePorts(input.sb, input.jobId, input.worker, input.bindings ?? fallback)
  const claim = await ports.claim(input.key)
  if (!claim) throw new Error('Publication lease unavailable.')
  const save = async (observation: PublishingObservation | { state: 'blocked'; errorCode: string }) => {
    const { error, data } = await input.sb.rpc('save_social_publication', { p_id: input.jobId, p_worker: input.worker, p_fence: claim.fence, p_observation: observation })
    if (error || data !== true) throw new Error('Publication receipt persistence unavailable.')
    return { managed: true, publication: observation }
  }
  if (!input.enabled || !input.bindings) {
    // Preserve ambiguity if a previously accepted operation has lost its binding.
    return await save(['queued', 'retry_wait'].includes(claim.intent.state)
      ? { state: 'blocked', errorCode: input.enabled ? 'PROVIDER_BINDING_NOT_CONFIGURED' : 'PUBLISHING_DISABLED' }
      : { state: 'unknown_outcome', errorCode: 'RECONCILIATION_ACCESS_REQUIRED' })
  }
  if (['submitting', 'processing', 'provider_scheduled', 'unknown_outcome'].includes(claim.intent.state)) {
    if (!claim.intent.providerOperationId && !claim.intent.providerPostId) return await save({ state: 'unknown_outcome', errorCode: 'NO_PROVIDER_RECEIPT_RECONCILE_MANUALLY' })
    const protocol = claim.intent.platform === 'instagram' ? await ports.readInstagramProtocol() : undefined
    if (claim.intent.platform === 'instagram') {
      const started = Date.parse(protocol?.startedAt ?? ''), current = Date.parse(input.now)
      if (!protocol || !Number.isFinite(current) || current < started || current - started > 300_000 || protocol.statusReads >= 5) {
        return await save({ state: 'unknown_outcome', operationId: claim.intent.providerOperationId ?? undefined, errorCode: 'INSTAGRAM_BOUNDED_REVIEW_REQUIRED' })
      }
      if (claim.intent.state === 'processing' && protocol.phase === 'container_ready' && !protocol.publishAttempted) {
        if (!input.bindings.publishReadyContainer) return await save({ state: 'unknown_outcome', errorCode: 'INSTAGRAM_PUBLISH_BINDING_REQUIRED' })
        let currentAllowed = false
        try { currentAllowed = instagramPublishingContinuationDecision(claim.intent, await input.bindings.readCurrent(claim.intent), input.now) === 'submit' }
        catch { /* No new mutation when current private/source evidence fails. */ }
        if (!currentAllowed) return await save({ state: 'unknown_outcome', errorCode: 'INSTAGRAM_CURRENT_AUTHORITY_REQUIRED' })
        let began = false
        try { began = await ports.beginInstagramPublish(claim.intent, claim.fence) }
        catch { /* The atomic source/lease/authorization guard may have changed. */ }
        if (!began) return await save({ state: 'unknown_outcome', errorCode: 'INSTAGRAM_PUBLISH_BARRIER_REQUIRED' })
        let observation: PublishingObservation
        try {
          observation = await input.bindings.publishReadyContainer(Object.freeze({ ...claim.intent }))
          // A successful media_publish response is still a mutation receipt,
          // not an independent public-media/owner verification.
          if (observation.state === 'posted') observation = { ...observation, state: 'unknown_outcome', errorCode: 'INSTAGRAM_PUBLICATION_READBACK_REQUIRED' }
        } catch { observation = { state: 'unknown_outcome', operationId: claim.intent.providerOperationId ?? undefined, errorCode: 'INSTAGRAM_PUBLISH_OUTCOME_UNVERIFIED' } }
        return await save(observation)
      }
    }
    let observation: PublishingObservation
    try { observation = await input.bindings.reconcile(claim.intent, protocol ?? undefined) }
    catch { observation = { state: 'unknown_outcome', errorCode: 'STATUS_READ_UNVERIFIED' } }
    return await save(observation)
  }
  const result = await executePublishingIntent(ports, input.key, input.now)
  if (['posted', 'processing', 'provider_scheduled', 'failed', 'unknown_outcome'].includes(result.state)) return { managed: true, publication: result }
  return await save({ state: 'blocked', errorCode: result.state.toUpperCase() })
}
