/* eslint-disable @typescript-eslint/no-explicit-any -- Structural Edge query builders. */
import { resolveMicrosoftPlanMapping } from '../../../src/lib/microsoftImportMap.ts'
import type { MicrosoftSnapshot } from '../../../src/lib/microsoftSnapshot.ts'
import { assembleSnapshot, requiredSourcesComplete, type JobSourceRow } from './job-machine.ts'

/** Use the canonical plan authority, never a second list of plan-name aliases. */
export function automaticSourceDomain(source: Pick<JobSourceRow, 'source_type' | 'source_name'>) {
  return source.source_type === 'outlook_calendar' ? 'cg_calendar'
    : source.source_type === 'planner_plan' ? resolveMicrosoftPlanMapping(source.source_name).target
      : 'review'
}

export function isAutomaticMirrorSource(source: Pick<JobSourceRow, 'source_type' | 'source_name'>): boolean {
  const domain = automaticSourceDomain(source)
  return domain === 'planner' || domain === 'cg_calendar'
}

export function plannerAssigneeIds(source: JobSourceRow, automaticSystem = false): string[] {
  if (automaticSystem && !isAutomaticMirrorSource(source)) return []
  return (source.records ?? []).flatMap(record => (record.assigneeMicrosoftIds as string[]) ?? [])
}

/** Completeness/counts describe ALL enumerated sources; payload/enrichment is
 * restricted to writable mirrors. Protected sources need not be deserialized. */
export function assembleAutomaticSnapshot(sources: JobSourceRow[], assigneeMap: Record<string, unknown>, exportedAt: string): MicrosoftSnapshot {
  if (!requiredSourcesComplete(sources) || sources.some(s => s.required && (s.safe_error !== null || s.pagination_cursor))) {
    throw new Error('Required Microsoft sources are incomplete.')
  }
  const scoped = sources.map(source => ({ ...source, records: isAutomaticMirrorSource(source) ? source.records ?? [] : [] }))
  for (const source of scoped.filter(isAutomaticMirrorSource)) {
    if (source.records.length !== source.record_count) throw new Error('Automatic Microsoft mirror payload coverage is incomplete.')
    for (const record of source.records) {
      const matches = source.source_type === 'outlook_calendar'
        ? record.sourceType === 'outlook_event' && record.sourceCalendarId === source.source_id
        : record.sourceType === 'planner_task' && record.sourcePlanId === source.source_id && record.sourcePlanName === source.source_name
      if (!matches) throw new Error('Automatic Microsoft record does not match its exact source.')
    }
  }
  const assembled = assembleSnapshot(scoped, assigneeMap, exportedAt)
  return {
    ...assembled, format: 'cg-dynamics-microsoft-snapshot', version: 3, triggerType: 'agent', plannerCompletedCutoff: null,
    sources: scoped.map(source => ({ sourceType: source.source_type as 'outlook_calendar' | 'planner_plan', sourceId: source.source_id, sourceName: source.source_name,
      complete: source.complete, rangeStart: source.range_start, rangeEnd: source.range_end, recordCount: source.record_count, safeError: source.safe_error })),
    records: assembled.records as unknown as MicrosoftSnapshot['records'],
    assigneeMap: assigneeMap as MicrosoftSnapshot['assigneeMap'],
  }
}

/** Existing automatic jobs may have queued unnecessary detail work before this
 * repair. Only a fully enumerated, error-free protected source may finish without
 * that enrichment. Errors/cursors/count mismatches must still fail closed. */
export function canFinishAutomaticProtectedDetails(source: JobSourceRow): boolean {
  return automaticSourceDomain(source) === 'client_schedule'
    && source.stage === 'fetching_details' && source.safe_error === null && !source.pagination_cursor
    && Array.isArray(source.records) && source.records.length === source.record_count
}

/** Separate small coverage metadata from payload reads: never transfer the
 * 5,500 protected schedule records into automatic apply preparation. */
export async function readAutomaticJobSnapshot(db: { from: (table: string) => any }, jobId: string, now: string) {
  const [jobResult, sourceResult] = await Promise.all([
    db.from('microsoft_sync_jobs').select('assignee_map,exported_at').eq('id', jobId).single(),
    db.from('microsoft_sync_job_sources').select('id,position,source_type,source_id,source_name,required,stage,record_count,complete,safe_error,range_start,range_end,pagination_cursor').eq('job_id', jobId),
  ])
  if (jobResult.error || sourceResult.error || !jobResult.data) throw new Error('Microsoft automatic snapshot read failed.')
  const sources = (sourceResult.data ?? []) as Array<JobSourceRow & { id: string }>
  if (!requiredSourcesComplete(sources)) throw new Error('Required Microsoft sources are incomplete.')
  const mirrorIds = sources.filter(isAutomaticMirrorSource).map(source => source.id)
  const payloadResult = mirrorIds.length > 0
    ? await db.from('microsoft_sync_job_sources').select('id,records').eq('job_id', jobId).in('id', mirrorIds)
    : { data: [], error: null }
  if (payloadResult.error) throw new Error('Microsoft automatic mirror payload read failed.')
  const payloads = new Map<string, Array<Record<string, unknown>>>((payloadResult.data ?? []).map((row: any) => [row.id, Array.isArray(row.records) ? row.records : []]))
  const snapshot = assembleAutomaticSnapshot(sources.map(source => ({ ...source, records: payloads.get(source.id) ?? [] })), jobResult.data.assignee_map ?? {}, jobResult.data.exported_at ?? now)
  return { snapshot, needsExportTimestamp: !jobResult.data.exported_at }
}
