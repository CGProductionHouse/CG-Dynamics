import type { FreshnessVerdict } from '../../supabase/functions/_shared/metaFleetFreshness.ts'
export type { FreshnessVerdict } from '../../supabase/functions/_shared/metaFleetFreshness.ts'
export { metaFleetFreshnessEvidence } from '../../supabase/functions/_shared/metaFleetFreshness.ts'
export type { MetaCheckpointInput, MetaInventoryInput, MetaFleetFreshness } from '../../supabase/functions/_shared/metaFleetFreshness.ts'

export interface FreshnessEvidence {
  verdict: FreshnessVerdict
  lastAttemptedAt: string | null
  lastSuccessfulAt: string | null
  staleAfterMinutes: number
  incomplete: string[]
  blocker: string | null
  recoveryInProgress: boolean
}

export interface MicrosoftFreshnessInput {
  now: string
  staleAfterMinutes?: number
  connected: boolean
  lastJobStartedAt: string | null
  lastJobCompletedAt: string | null
  lastSuccessfulReconciliationAt: string | null
  requiredSources: Array<{ name: string; complete: boolean; error: string | null }>
  applyStatus: 'completed' | 'partial' | 'failed' | 'applying' | null
  recoveryInProgress?: boolean
  blocker?: string | null
}

export function microsoftFreshnessEvidence(input: MicrosoftFreshnessInput): FreshnessEvidence {
  const staleAfterMinutes = input.staleAfterMinutes ?? 180
  const incomplete = input.requiredSources.filter(source => !source.complete).map(source => source.name).sort()
  if (!input.connected) {
    return { verdict: 'UNAVAILABLE', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker ?? 'Microsoft transition sync is unavailable.', recoveryInProgress: false }
  }
  if (input.applyStatus === 'failed') {
    return { verdict: 'FAILED', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker ?? 'The latest Microsoft reconciliation failed.', recoveryInProgress: Boolean(input.recoveryInProgress) }
  }
  if (incomplete.length > 0 || input.applyStatus === 'partial' || input.applyStatus === 'applying') {
    return { verdict: 'PARTIAL', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker ?? null, recoveryInProgress: Boolean(input.recoveryInProgress || input.applyStatus === 'applying') }
  }
  const success = input.lastSuccessfulReconciliationAt ? Date.parse(input.lastSuccessfulReconciliationAt) : Number.NaN
  const now = Date.parse(input.now)
  if (!Number.isFinite(success) || !Number.isFinite(now) || now - success > staleAfterMinutes * 60_000) {
    return { verdict: 'STALE', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker ?? 'No full Microsoft reconciliation exists inside the freshness window.', recoveryInProgress: Boolean(input.recoveryInProgress) }
  }
  return { verdict: 'PASS', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete: [], blocker: null, recoveryInProgress: false }
}
