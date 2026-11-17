import type { MonthlyDeliverable } from './planner'

/** Existing Client Schedule supports these query fields and its canonical drawer.
 * All-status mode avoids hiding a completed target behind the default action filter. */
export function nolanScheduleRecordHref(record: Pick<MonthlyDeliverable, 'id' | 'client_id' | 'month'>): string {
  const params = new URLSearchParams({ id: record.id, client: record.client_id, month: record.month, mode: 'all' })
  return `/admin/client-schedule?${params.toString()}`
}
