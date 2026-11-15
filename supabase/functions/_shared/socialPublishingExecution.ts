import { publishingDispatchDecision, type PublishingContext, type PublishingIntent, type PublishingObservation } from './socialPublishing.ts'

// Storage is an interface to the existing durable-job substrate. No in-memory
// implementation may be used in production. Activation requires an audited
// transaction for unique intent, claim/fencing, attempt and receipt persistence.
export interface PublishingExecutionPorts {
  claim(key: string): Promise<{ intent: PublishingIntent; fence: string } | null>
  readCurrent(intent: PublishingIntent): Promise<PublishingContext>
  // Atomically verify fence + source revision/authorization and persist
  // 'submitting' BEFORE any provider mutation. Expired submitting leases must
  // reconcile, never be returned by claim as a new queued submission.
  // Also fence unresolved/posted attempts for this deliverable + platform +
  // account across review versions; a revised review cannot bypass recovery.
  beginAttempt(intent: PublishingIntent, fence: string): Promise<boolean>
  submit(intent: Readonly<PublishingIntent>): Promise<PublishingObservation>
  saveObservation(intent: PublishingIntent, fence: string, observation: PublishingObservation): Promise<boolean>
}

/** A single due channel, not a calendar scanner or a Microsoft sync worker. */
export async function executePublishingIntent(ports: PublishingExecutionPorts, key: string, now: string) {
  const claim = await ports.claim(key)
  if (!claim) return { state: 'not_claimed' } as const
  const { intent, fence } = claim
  const decision = publishingDispatchDecision(intent, await ports.readCurrent(intent), now)
  if (decision !== 'submit') return { state: decision } as const
  if (!await ports.beginAttempt(intent, fence)) return { state: 'claim_or_source_lost' } as const
  let observation: PublishingObservation
  try {
    observation = await ports.submit(Object.freeze({ ...intent }))
  } catch {
    // Timeout, network loss and unclassified exceptions may follow acceptance.
    observation = { state: 'unknown_outcome', errorCode: 'SUBMISSION_OUTCOME_UNVERIFIED' }
  }
  // A broken adapter cannot manufacture completion from an upload/container ID.
  if (observation.state === 'posted' && !observation.postId?.trim()) {
    observation = { ...observation, state: 'unknown_outcome', errorCode: 'POST_ID_REQUIRED' }
  }
  try {
    if (await ports.saveObservation(intent, fence, observation)) return observation
  } catch { /* Keep the durable pre-dispatch submitting attempt as the recovery barrier. */ }
  return { state: 'unknown_outcome', errorCode: 'RECEIPT_PERSISTENCE_UNVERIFIED' } as const
}
