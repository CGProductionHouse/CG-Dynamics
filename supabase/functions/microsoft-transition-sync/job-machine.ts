// ============================================================================
// Durable Microsoft preview job — pure state-machine + assembly logic.
//
// No Deno / network APIs here so it is unit-testable (tests/microsoftDurableJob).
// The Edge Function (index.ts) owns Graph I/O and DB persistence; this module
// owns source enumeration, the bounded detail-batch cursor, snapshot assembly,
// and the completeness/apply gate.
// ============================================================================

export interface SourceManifest {
  userId: string
  calendar?: { id: string; name: string }
  plans: Array<{ id: string; name: string }>
}

export interface JobSourceSeed {
  position: number
  source_type: 'outlook_calendar' | 'planner_plan'
  source_id: string
  source_name: string
  required: boolean
  range_start: string | null
  range_end: string | null
}

// Every configured source becomes a queued row. Outlook is bounded by the range;
// Planner plans (the heavy sources) are fetched one at a time in later steps.
export function enumerateJobSources(
  manifest: SourceManifest,
  rangeStart: string,
  rangeEnd: string,
): JobSourceSeed[] {
  const seeds: JobSourceSeed[] = []
  let position = 0
  if (manifest.calendar) {
    seeds.push({
      position: position++, source_type: 'outlook_calendar',
      source_id: manifest.calendar.id, source_name: manifest.calendar.name,
      required: true, range_start: rangeStart, range_end: rangeEnd,
    })
  }
  for (const plan of manifest.plans) {
    if (!plan?.id || !plan?.name) continue
    seeds.push({
      position: position++, source_type: 'planner_plan',
      source_id: String(plan.id), source_name: String(plan.name),
      required: true, range_start: null, range_end: null,
    })
  }
  return seeds
}

export const DETAIL_BATCH_SIZE = 300

// Split the pending detail-id list into the next bounded batch + the remainder.
export function nextDetailBatch(pending: string[], size = DETAIL_BATCH_SIZE): { batch: string[]; rest: string[] } {
  return { batch: pending.slice(0, size), rest: pending.slice(size) }
}

export interface JobSourceRow {
  position: number
  source_type: string
  source_id: string
  source_name: string
  required: boolean
  stage: 'queued' | 'fetching_tasks' | 'fetching_details' | 'complete' | 'failed'
  record_count: number
  complete: boolean
  safe_error: string | null
  records?: Array<Record<string, unknown>>
  pending_detail_ids?: string[]
  range_start: string | null
  range_end: string | null
}

export interface JobProgress {
  total: number
  complete: number
  failed: number
  fetching: number
  queued: number
  detailsRemaining: number
  allRequiredComplete: boolean
  anyFailed: boolean
  finished: boolean // no more work claimable (all complete or failed)
}

export function jobProgress(sources: JobSourceRow[]): JobProgress {
  let complete = 0, failed = 0, fetching = 0, queued = 0, detailsRemaining = 0
  let requiredIncomplete = 0
  for (const s of sources) {
    if (s.stage === 'complete') complete++
    else if (s.stage === 'failed') { failed++; if (s.required) requiredIncomplete++ }
    else if (s.stage === 'queued') { queued++; if (s.required) requiredIncomplete++ }
    else { fetching++; if (s.required) requiredIncomplete++ }
    detailsRemaining += (s.pending_detail_ids?.length ?? 0)
  }
  void requiredIncomplete
  return {
    total: sources.length,
    complete, failed, fetching, queued, detailsRemaining,
    allRequiredComplete: sources.length > 0 && sources.every((s) => !s.required || s.stage === 'complete'),
    anyFailed: failed > 0,
    finished: sources.every((s) => s.stage === 'complete' || s.stage === 'failed'),
  }
}

// The reconciliation preview may only be assembled/applied when every required
// source has completed (completeness safeguard — never a partial preview).
export function requiredSourcesComplete(sources: JobSourceRow[]): boolean {
  return sources.length > 0 && sources.every((s) => !s.required || s.stage === 'complete')
}

// Pick the next unit of work: continue an in-progress detail fetch first (so a
// heavy plan finishes before new sources start), else claim a queued source.
export function pickNextSource(sources: JobSourceRow[]): JobSourceRow | null {
  const ordered = [...sources].sort((a, b) => a.position - b.position)
  return ordered.find((s) => s.stage === 'fetching_details')
    ?? ordered.find((s) => s.stage === 'fetching_tasks')
    ?? ordered.find((s) => s.stage === 'queued')
    ?? null
}

export interface AssembledSnapshot {
  format: string
  version: number
  exportedAt: string
  exportedBy: string
  triggerType: string
  sources: Array<Record<string, unknown>>
  records: Array<Record<string, unknown>>
  assigneeMap: Record<string, unknown>
  assigneeLookup: { requested: number; resolved: number; unresolved: number; statusCounts: Record<string, number> }
}

export function assembleSnapshot(
  sources: JobSourceRow[],
  assigneeMap: Record<string, unknown>,
  exportedAt: string,
): AssembledSnapshot {
  const ordered = [...sources].sort((a, b) => a.position - b.position)
  const records: Array<Record<string, unknown>> = []
  const sourceSummaries: Array<Record<string, unknown>> = []
  for (const s of ordered) {
    for (const record of s.records ?? []) records.push(record)
    sourceSummaries.push({
      sourceType: s.source_type, sourceId: s.source_id, sourceName: s.source_name,
      complete: s.complete, rangeStart: s.range_start, rangeEnd: s.range_end,
      recordCount: s.record_count, safeError: s.safe_error ?? null,
    })
  }
  const resolved = Object.keys(assigneeMap).length
  const requested = records.reduce((total, record) => {
    const ids = record.assigneeMicrosoftIds
    return total + (Array.isArray(ids) ? ids.length : 0)
  }, 0)
  return {
    format: 'cg-dynamics-microsoft-snapshot', version: 3, exportedAt,
    exportedBy: 'CG Dynamics Microsoft transition sync', triggerType: 'admin',
    sources: sourceSummaries, records, assigneeMap,
    assigneeLookup: { requested, resolved, unresolved: Math.max(0, requested - resolved), statusCounts: {} },
  }
}
