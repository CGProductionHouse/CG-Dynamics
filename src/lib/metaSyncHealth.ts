export interface MetaBatchHealthInput {
  status: string
  cooldown_until?: string | null
  worker_heartbeat_at?: string | null
  last_worker_error?: string | null
}

export function metaBatchHealth(batch: MetaBatchHealthInput, now: number, noMovement: boolean) {
  const active = batch.status === 'queued' || batch.status === 'running'
  const retryAt = Date.parse(batch.cooldown_until ?? '')
  const heartbeat = Date.parse(batch.worker_heartbeat_at ?? '')
  const coolingDown = active && Number.isFinite(retryAt) && retryAt > now
  const workerAlive = active && Number.isFinite(heartbeat) && now - heartbeat < 120_000
  return {
    coolingDown,
    workerAlive,
    stalled: active && noMovement && !coolingDown && !workerAlive,
    retryAt: coolingDown ? new Date(retryAt).toISOString() : null,
    reason: coolingDown ? batch.last_worker_error ?? 'Meta requested a pause before retrying.' : null,
  }
}
