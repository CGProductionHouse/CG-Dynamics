export interface MetaAssetRunPresentation {
  run_type?: string | null
  period_month?: string | null
  status?: string | null
  health_state?: string | null
  finished_at?: string | null
  created_at?: string | null
  retrying?: boolean | null
}

function readableState(value: string | null | undefined, fallback: string): string {
  const normalized = value?.trim()
  return normalized ? normalized.replaceAll('_', ' ') : fallback
}

function formatObservedAt(value: string): string | null {
  const observedAt = new Date(value)
  if (!Number.isFinite(observedAt.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(observedAt)
}

export function metaAssetRunLabel(
  platform: 'Facebook' | 'Instagram',
  run: MetaAssetRunPresentation | null | undefined,
  nowMs = Date.now(),
): string {
  if (!run) return `${platform}: no durable checkpoint recorded`

  const timestamp = run.finished_at ?? run.created_at
  const formattedTimestamp = timestamp ? formatObservedAt(timestamp) : null
  if (!timestamp || !formattedTimestamp) {
    return `${platform}: no durable checkpoint recorded${run.retrying ? ' · recovery in progress' : ''}`
  }

  const observedAtMs = new Date(timestamp).getTime()
  const failure = run.status === 'failed'
    || ['sync_error', 'permission_blocked', 'reconnection_required'].includes(run.health_state ?? '')
  const freshness = failure ? 'needs attention' : nowMs - observedAtMs > 48 * 60 * 60 * 1000 ? 'stale' : 'current'
  const kind = run.run_type === 'scheduled'
    ? 'incremental'
    : readableState(run.run_type, 'sync kind unavailable')
  const health = readableState(run.health_state, 'health unavailable')

  return `${platform}: ${formattedTimestamp} · ${kind} · ${health} · ${freshness}${run.period_month ? ` · ${run.period_month}` : ''}`
}
