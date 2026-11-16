import type { PlannerActivityLog } from './planner'

/** Age is a display warning, never completion, liveness or execution proof. */
export function nolanEvidenceAge(timestamp: string | null | undefined, now = Date.now()): string {
  const time = timestamp ? Date.parse(timestamp) : NaN
  if (!Number.isFinite(time) || time > now) return 'Unknown age — timestamp missing, invalid or in the future'
  const days = Math.floor((now - time) / 86_400_000)
  return days >= 7 ? `Historical evidence — ${days} days old (7-day review threshold)` : `Recorded within the last 7 days — not live execution proof`
}

/** Do not accept a different task's audit rows as evidence for this task. */
export function nolanLatestTaskActivity(taskId: string, rows: PlannerActivityLog[] | null): PlannerActivityLog | null {
  if (!Array.isArray(rows)) throw new Error('Activity reader returned no verifiable result.')
  if (rows.some(row => row.entity_type !== 'planner_task' || row.entity_id !== taskId)) {
    throw new Error('Activity identity mismatch; no action evidence displayed.')
  }
  if (rows.some(row => !row.id || !row.action?.trim() || !Number.isFinite(Date.parse(row.created_at)) || Date.parse(row.created_at) > Date.now())) {
    throw new Error('Activity evidence is incomplete or has an invalid timestamp.')
  }
  return [...rows].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id))[0] ?? null
}
