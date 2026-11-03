import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { AutomaticReconciliationResult } from './automatic-reconciliation.ts'

export interface SharedScheduleDateRefresh {
  checked: number
  changed: number
  held: number
  bounded?: boolean
  blocked?: string
  observed_at?: string
}

/** One existing service cycle, one reviewed DB transaction. It reads only the
 * exact completed job; no second Graph collector, browser credential or model. */
export async function finishSharedScheduleDateRefresh(
  db: Pick<SupabaseClient, 'rpc' | 'from'>,
  mirror: AutomaticReconciliationResult,
): Promise<AutomaticReconciliationResult & { sharedScheduleDates?: SharedScheduleDateRefresh }> {
  if (!mirror.runId || !['completed', 'partial'].includes(mirror.status)) return mirror
  const { data, error } = await db.rpc('refresh_shared_client_schedule_source_dates', { p_run_id: mirror.runId })
  const valid = data && typeof data === 'object'
    && ['checked', 'changed', 'held'].every(key => Number.isInteger(data[key]) && data[key] >= 0 && data[key] <= 1000)
    && data.changed + data.held <= data.checked
  if (error || !valid || data.blocked || data.bounded || data.held > 0) {
    const message = mirror.error ?? (data?.held > 0
      ? 'Some shared posting dates retain staff edits or need exact-source review.'
      : 'Shared posting-date refresh is incomplete; existing dates remain in use.')
    const saved = await db.from('microsoft_sync_runs').update({ status: 'partial', safe_error: message })
      .eq('id', mirror.runId).eq('trigger_type', 'agent').in('status', ['completed', 'partial']).select('id').maybeSingle()
    return { ...mirror, status: saved.error || !saved.data ? 'failed' : 'partial',
      error: saved.error || !saved.data ? 'Could not record incomplete posting-date refresh.' : message,
      ...(valid ? { sharedScheduleDates: data as SharedScheduleDateRefresh } : {}) }
  }
  return { ...mirror, sharedScheduleDates: data as SharedScheduleDateRefresh }
}
