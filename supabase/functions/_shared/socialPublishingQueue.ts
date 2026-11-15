import { executePublishingIntent, type PublishingExecutionPorts } from './socialPublishingExecution.ts'
import type { PublishingContext, PublishingIntent, PublishingObservation } from './socialPublishing.ts'

export const SOCIAL_PUBLICATION_JOB = 'social_publish'
interface RpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }> }
interface Claim { key: string; fence: string; intent: PublishingIntent; state: PublishingIntent['state']; observation?: PublishingObservation; attempt: number }
export interface SocialProviderBindings {
  // Must resolve current canonical review, source hash, Teams date, private token
  // health and exact provider mapping server-side. Never accept caller proofs.
  readCurrent(intent: PublishingIntent): Promise<PublishingContext>
  submit(intent: Readonly<PublishingIntent>): Promise<PublishingObservation>
  reconcile(intent: Readonly<PublishingIntent>): Promise<PublishingObservation>
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
  return ports
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
    let observation: PublishingObservation
    try { observation = await input.bindings.reconcile(claim.intent) }
    catch { observation = { state: 'unknown_outcome', errorCode: 'STATUS_READ_UNVERIFIED' } }
    return await save(observation)
  }
  const result = await executePublishingIntent(ports, input.key, input.now)
  if (['posted', 'processing', 'provider_scheduled', 'failed', 'unknown_outcome'].includes(result.state)) return { managed: true, publication: result }
  return await save({ state: 'blocked', errorCode: result.state.toUpperCase() })
}
