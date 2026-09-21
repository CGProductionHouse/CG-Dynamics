export type FreshnessVerdict = 'PASS' | 'PARTIAL' | 'STALE' | 'FAILED' | 'UNAVAILABLE'

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
    return { verdict: 'PARTIAL', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker, recoveryInProgress: Boolean(input.recoveryInProgress || input.applyStatus === 'applying') }
  }
  const success = input.lastSuccessfulReconciliationAt ? Date.parse(input.lastSuccessfulReconciliationAt) : Number.NaN
  const now = Date.parse(input.now)
  if (!Number.isFinite(success) || !Number.isFinite(now) || now - success > staleAfterMinutes * 60_000) {
    return { verdict: 'STALE', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete, blocker: input.blocker ?? 'No full Microsoft reconciliation exists inside the freshness window.', recoveryInProgress: Boolean(input.recoveryInProgress) }
  }
  return { verdict: 'PASS', lastAttemptedAt: input.lastJobStartedAt, lastSuccessfulAt: input.lastSuccessfulReconciliationAt, staleAfterMinutes, incomplete: [], blocker: null, recoveryInProgress: false }
}

export interface MetaCheckpointInput {
  clientId: string
  assetId: string
  platform: 'facebook' | 'instagram'
  mapped: boolean
  lastAttemptedAt: string | null
  lastSuccessfulAt: string | null
  lastSuccessfulMonth: string | null
  highWatermarkAt: string | null
  nextDueAt: string | null
  status: string | null
  healthState: string | null
  errorCode: string | null
  retrying: boolean
}

export interface MetaFleetFreshness {
  verdict: FreshnessVerdict
  mappedClients: number
  mappedAssets: number
  platforms: Array<MetaCheckpointInput & { verdict: FreshnessVerdict; reason: string | null }>
  stale: number
  partial: number
  unavailable: number
  recoveryInProgress: boolean
}

export function metaFleetFreshnessEvidence(checkpoints: MetaCheckpointInput[], now: string): MetaFleetFreshness {
  const nowMs = Date.parse(now)
  const platforms = checkpoints.map(checkpoint => {
    let verdict: FreshnessVerdict = 'PASS'
    let reason: string | null = null
    if (!checkpoint.mapped) {
      verdict = 'UNAVAILABLE'; reason = 'Platform is not mapped for this asset.'
    } else if (!checkpoint.lastAttemptedAt) {
      verdict = 'STALE'; reason = 'Mapped platform has never completed its bootstrap checkpoint.'
    } else if (checkpoint.status === 'failed') {
      verdict = checkpoint.lastSuccessfulAt ? 'PARTIAL' : 'FAILED'; reason = checkpoint.errorCode ?? 'Latest sync attempt failed.'
    } else if (checkpoint.healthState === 'partial' || checkpoint.healthState === 'verified_partial') {
      verdict = 'PARTIAL'; reason = 'Latest verified coverage is partial.'
    } else if (!checkpoint.lastSuccessfulAt || (checkpoint.nextDueAt && Number.isFinite(nowMs) && Date.parse(checkpoint.nextDueAt) <= nowMs)) {
      verdict = 'STALE'; reason = checkpoint.lastSuccessfulAt ? 'Checkpoint is due for refresh.' : 'No successful checkpoint exists.'
    }
    return { ...checkpoint, verdict, reason }
  })
  const unavailable = platforms.filter(item => item.verdict === 'UNAVAILABLE').length
  const failed = platforms.filter(item => item.verdict === 'FAILED').length
  const partial = platforms.filter(item => item.verdict === 'PARTIAL').length
  const stale = platforms.filter(item => item.verdict === 'STALE').length
  const verdict: FreshnessVerdict = failed > 0 ? 'FAILED' : partial > 0 ? 'PARTIAL' : stale > 0 ? 'STALE' : unavailable > 0 ? 'UNAVAILABLE' : 'PASS'
  return {
    verdict,
    mappedClients: new Set(checkpoints.filter(item => item.mapped).map(item => item.clientId)).size,
    mappedAssets: new Set(checkpoints.filter(item => item.mapped).map(item => item.assetId)).size,
    platforms,
    stale,
    partial,
    unavailable,
    recoveryInProgress: platforms.some(item => item.retrying),
  }
}
