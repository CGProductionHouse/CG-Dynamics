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
export const PAGINATION_BATCH_SIZE = 1000

// Split the pending detail-id list into the next bounded batch + the remainder.
export function nextDetailBatch(pending: string[], size = DETAIL_BATCH_SIZE): { batch: string[]; rest: string[] } {
  return { batch: pending.slice(0, size), rest: pending.slice(size) }
}

export function dedupeRecords(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  idKey: string,
): Array<Record<string, unknown>> {
  const seen = new Set(existing.map(r => String(r[idKey] ?? '')))
  const appended = incoming.filter(r => !seen.has(String(r[idKey] ?? '')))
  return [...existing, ...appended]
}

// ── Graph pagination (pure: the Edge Function injects the page fetch) ────────

export interface GraphPageResult {
  values: Array<Record<string, unknown>>
  complete: boolean
  safeError: string | null
  nextCursor: string | null
}

export interface GraphPageResponse {
  ok: boolean
  status: number
  body: { value?: Array<Record<string, unknown>>; '@odata.nextLink'?: string } | null
}

// Walk Graph pages from `startUrl`. A page is always consumed whole and the resume
// cursor is only ever an `@odata.nextLink` — never the URL of a page already read,
// which would re-fetch it forever. Returns once at least `batchSize` records are
// held and more pages remain, so a >5,000-record plan is fetched across several
// bounded job_process calls instead of being capped. A failure returns no cursor:
// the source fails (planSourceUpdate) and job_retry re-queues it from the start.
export async function paginateGraph(
  startUrl: string,
  fetchPage: (url: string) => Promise<GraphPageResponse | null>,
  describeFailure: (status: number | null) => string,
  batchSize = PAGINATION_BATCH_SIZE,
): Promise<GraphPageResult> {
  const values: Array<Record<string, unknown>> = []
  const seen = new Set<string>()
  let url: string | null = startUrl
  while (url) {
    if (seen.has(url)) return { values, complete: false, safeError: 'Microsoft returned a repeating page link.', nextCursor: null }
    seen.add(url)
    const page = await fetchPage(url)
    if (!page) return { values, complete: false, safeError: describeFailure(null), nextCursor: null }
    if (!page.ok) return { values, complete: false, safeError: describeFailure(page.status), nextCursor: null }
    values.push(...(page.body?.value ?? []))
    const nextLink: string | null = page.body?.['@odata.nextLink'] ?? null
    // A page that links to itself would otherwise be checkpointed and re-read forever.
    if (nextLink !== null && nextLink === url) {
      return { values, complete: false, safeError: 'Microsoft returned a repeating page link.', nextCursor: null }
    }
    if (nextLink !== null && values.length >= batchSize) return { values, complete: false, safeError: null, nextCursor: nextLink }
    url = nextLink
  }
  return { values, complete: true, safeError: null, nextCursor: null }
}

// ── Accumulating a fetched batch into the persisted source ───────────────────

export interface SourceUnitResult {
  records: Array<Record<string, unknown>>
  detailIds: string[]
  complete: boolean
  safeError: string | null
  nextCursor: string | null
}

// Internal marker carried on a Planner record while its plan is still paginating,
// so a page-1 task whose description is needed is not forgotten on resume. It is
// stripped once pagination finishes and never leaves the job.
export const NEEDS_DETAIL_MARKER = '_needsDetail'

function withoutDetailMarker(record: Record<string, unknown>): Record<string, unknown> {
  const { [NEEDS_DETAIL_MARKER]: _marker, ...rest } = record
  void _marker
  return rest
}

export function accumulatePlannerPage(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  taskResult: GraphPageResult,
  bucketResult: GraphPageResult,
): SourceUnitResult {
  const records = dedupeRecords(existing, incoming, 'sourceTaskId')
  const safeError = taskResult.safeError ?? bucketResult.safeError
  const paginationDone = safeError === null && taskResult.nextCursor === null
  if (!paginationDone) {
    // Keep the marker on every accumulated record, including earlier pages.
    return { records, detailIds: [], complete: false, safeError, nextCursor: safeError === null ? taskResult.nextCursor : null }
  }
  const detailIds = records
    .filter(record => Boolean(record[NEEDS_DETAIL_MARKER]))
    .map(record => String(record.sourceTaskId ?? ''))
    .filter(Boolean)
  return {
    records: records.map(withoutDetailMarker),
    detailIds,
    complete: taskResult.complete && bucketResult.complete,
    safeError: null,
    nextCursor: null,
  }
}

export function accumulateOutlookPage(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
  result: GraphPageResult,
): SourceUnitResult {
  return {
    records: dedupeRecords(existing, incoming, 'sourceEventId'),
    detailIds: [],
    complete: result.safeError === null && result.complete,
    safeError: result.safeError,
    nextCursor: result.safeError === null ? result.nextCursor : null,
  }
}

// ── Deciding the persisted source update ─────────────────────────────────────

// Upper bound on bounded fetch calls for one source (~200,000 records at the
// default batch). Replaces the old silent 5,000-record cap with an explicit,
// honest failure, and stops a pathological cursor chain from running forever.
export const MAX_PAGINATION_STEPS = 200

export interface SourceUpdate {
  stage: JobSourceRow['stage']
  complete: boolean
  safe_error: string | null
  records: Array<Record<string, unknown>>
  record_count: number
  pending_detail_ids: string[]
  pagination_cursor: string | null
}

// The single transition rule for a fetch step, applied by job_process:
//   error        → failed (retryable) — never left in fetching_tasks to retry forever
//   cursor       → keep paging (bounded by MAX_PAGINATION_STEPS)
//   detail work  → fetching_details, which completes the source only once drained
//   otherwise    → complete
export function planSourceUpdate(result: SourceUnitResult, attempts: number): SourceUpdate {
  const base = { records: result.records, record_count: result.records.length, pending_detail_ids: [] as string[], pagination_cursor: null }
  if (result.safeError !== null) {
    return { ...base, stage: 'failed', complete: false, safe_error: result.safeError }
  }
  if (result.nextCursor !== null) {
    if (attempts >= MAX_PAGINATION_STEPS) {
      return { ...base, stage: 'failed', complete: false, safe_error: `Microsoft source did not finish within ${MAX_PAGINATION_STEPS} pages. Retry the failed source.` }
    }
    return { ...base, stage: 'fetching_tasks', complete: false, safe_error: null, pagination_cursor: result.nextCursor }
  }
  if (result.detailIds.length > 0) {
    return { ...base, stage: 'fetching_details', complete: false, safe_error: null, pending_detail_ids: result.detailIds }
  }
  return { ...base, stage: 'complete', complete: result.complete, safe_error: null }
}

// job_retry re-queues a failed source from scratch, including its attempt count,
// so MAX_PAGINATION_STEPS applies afresh to the retried run.
export function retrySourceReset() {
  return {
    stage: 'queued' as const,
    safe_error: null,
    records: [] as Array<Record<string, unknown>>,
    pending_detail_ids: [] as string[],
    record_count: 0,
    complete: false,
    pagination_cursor: null,
    attempts: 0,
  }
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
  pagination_cursor?: string | null
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
  for (const s of sources) {
    if (s.stage === 'complete') complete++
    else if (s.stage === 'failed') failed++
    else if (s.stage === 'queued') queued++
    else fetching++
    detailsRemaining += (s.pending_detail_ids?.length ?? 0)
  }
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
