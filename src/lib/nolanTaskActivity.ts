import { listPlannerActivity } from './planner'
import { nolanLatestTaskActivity } from './nolanTaskEvidence'

/** Existing signed-in reader and RLS remain authoritative; no new grant or write. */
export async function loadNolanTaskActivity(taskId: string, role: string, reader = listPlannerActivity) {
  if (!['admin', 'manager'].includes(role)) throw new Error('Manager access required.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)) throw new Error('Native task identity unavailable.')
  const result = await reader(taskId)
  if (result.error) throw new Error(result.error.message || 'Activity reader unavailable.')
  return { taskId, row: nolanLatestTaskActivity(taskId, result.data), checkedAt: new Date().toISOString() }
}
