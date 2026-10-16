// Shared by Integrations and the ChatGPT provider-health read. One freshness authority.
export type FreshnessVerdict = 'PASS' | 'PARTIAL' | 'STALE' | 'FAILED' | 'UNAVAILABLE'

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

export interface MetaInventoryInput {
  clientId: string
  assetId: string
  facebookMapped: boolean
  instagramMapped: boolean
}

export interface MetaFleetFreshness {
  verdict: FreshnessVerdict
  mappedClients: number
  mappedAssets: number
  platforms: Array<MetaCheckpointInput & { verdict: FreshnessVerdict; reason: string | null }>
  stale: number
  partial: number
  failed: number
  unavailable: number
  recoveryInProgress: boolean
}

export function metaFleetFreshnessEvidence(
  checkpoints: MetaCheckpointInput[],
  now: string,
  inventory: MetaInventoryInput[] = [],
  checkpointEvidenceAvailable = true,
): MetaFleetFreshness {
  const nowMs = Date.parse(now)
  const checkpointByPlatform = new Map(checkpoints.map(checkpoint => [`${checkpoint.assetId}:${checkpoint.platform}`, checkpoint]))
  const mappedInventory = inventory.flatMap(asset => (['facebook', 'instagram'] as const)
    .filter(platform => asset[`${platform}Mapped`])
    .map(platform => ({ clientId: asset.clientId, assetId: asset.assetId, platform })))
  const effectiveCheckpoints: MetaCheckpointInput[] = mappedInventory.length > 0
    ? mappedInventory.map(mapped => checkpointByPlatform.get(`${mapped.assetId}:${mapped.platform}`) ?? {
        ...mapped,
        mapped: true,
        lastAttemptedAt: null,
        lastSuccessfulAt: null,
        lastSuccessfulMonth: null,
        highWatermarkAt: null,
        nextDueAt: null,
        status: null,
        healthState: null,
        errorCode: null,
        retrying: false,
      })
    : checkpoints
  const platforms = effectiveCheckpoints.map(checkpoint => {
    let verdict: FreshnessVerdict = 'PASS'
    let reason: string | null = null
    if (!checkpoint.mapped) {
      verdict = 'UNAVAILABLE'; reason = 'Platform is not mapped for this asset.'
    } else if (!checkpointEvidenceAvailable) {
      verdict = 'UNAVAILABLE'; reason = 'Checkpoint freshness evidence is unavailable and has not been verified.'
    } else if (!Number.isFinite(nowMs) || [
      checkpoint.lastAttemptedAt,
      checkpoint.lastSuccessfulAt,
      checkpoint.highWatermarkAt,
      checkpoint.nextDueAt,
    ].some(value => value != null && !Number.isFinite(Date.parse(value)))) {
      verdict = 'UNAVAILABLE'; reason = 'Freshness evidence contains an invalid timestamp and cannot be verified.'
    } else if (checkpoint.errorCode?.startsWith('Meta permission/access blocked.')) {
      verdict = checkpoint.lastSuccessfulAt ? 'PARTIAL' : 'STALE'; reason = checkpoint.errorCode
    } else if (!checkpoint.lastAttemptedAt) {
      verdict = 'STALE'; reason = checkpoint.errorCode ?? 'Mapped platform has never completed its bootstrap checkpoint.'
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
  const verdict: FreshnessVerdict = platforms.length === 0
    ? 'UNAVAILABLE'
    : failed > 0 ? 'FAILED' : partial > 0 ? 'PARTIAL' : stale > 0 ? 'STALE' : unavailable > 0 ? 'UNAVAILABLE' : 'PASS'
  return {
    verdict,
    mappedClients: new Set(effectiveCheckpoints.filter(item => item.mapped).map(item => item.clientId)).size,
    mappedAssets: new Set(effectiveCheckpoints.filter(item => item.mapped).map(item => item.assetId)).size,
    platforms,
    stale,
    partial,
    failed,
    unavailable,
    recoveryInProgress: platforms.some(item => item.retrying),
  }
}
