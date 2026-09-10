// microsoftSourceFields.ts — durable Microsoft source identity + freshness for the MCP
// reads that #325 requires for safe cross-reference. Pure and import-free so it is
// unit-tested without Deno.
//
// #325 forbids title-only reconciliation. The canonical tables already store durable
// Microsoft identities; the connector simply was not returning them. These select fragments
// and classifiers expose exactly those existing columns — no schema change, no new subsystem.
//
// Column names below are the live production columns added by the applied legacy phases
// (phase-15a source tracking, phase-17a transition sync) and verified against the live
// schema before use.

/** Durable Microsoft identity + freshness on planner_tasks. */
export const PLANNER_MICROSOFT_FIELDS = [
  'microsoft_source_type',
  'microsoft_plan_id',
  'microsoft_bucket_id',
  'microsoft_task_id',
  'microsoft_last_synced_at',
  'microsoft_last_seen_at',
  'microsoft_source_removed_at',
  'microsoft_source_modified_at',
  'microsoft_source_hash',
] as const

/** Durable Microsoft identity + freshness on company_calendar_events. */
export const CALENDAR_MICROSOFT_FIELDS = [
  'microsoft_source_type',
  'microsoft_calendar_id',
  'microsoft_event_id',
  'microsoft_last_synced_at',
  'microsoft_last_seen_at',
  'microsoft_source_removed_at',
  'microsoft_source_modified_at',
  'microsoft_source_hash',
] as const

/** Durable Microsoft identity + provenance on monthly_deliverables (read-only audit). */
export const DELIVERABLE_MICROSOFT_FIELDS = [
  'microsoft_source_type',
  'microsoft_plan_id',
  'microsoft_task_id',
  'microsoft_last_synced_at',
  'microsoft_source_removed_at',
] as const

/** Package/template provenance on monthly_deliverables. Read-only; write rules unchanged. */
export const DELIVERABLE_PROVENANCE_FIELDS = ['package_id', 'template_id'] as const

export type SourceClassification = 'microsoft_backed' | 'dynamics_only' | 'microsoft_source_removed'

export interface MicrosoftLinkage {
  /** Where this record's freshness authority lies during coexistence. */
  classification: SourceClassification
  /** Durable composite key for cross-reference. Null when Dynamics-only. */
  source_key: string | null
  microsoft: Record<string, unknown> | null
  freshness: {
    last_synced_at: string | null
    last_seen_at: string | null
    source_modified_at: string | null
    source_removed_at: string | null
  }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Classify one row's Microsoft linkage from its durable identity columns.
 *
 * `kind` selects which identity pair forms the durable key:
 *   planner  -> (plan_id, task_id)
 *   calendar -> (calendar_id, event_id)
 *
 * A row with no Microsoft identity is legitimate Dynamics-only work (#325 §3) — never
 * treated as an error or hidden. A row whose Microsoft source was removed is reported as
 * such so it can be suppressed from active views without deleting history (#325 §4).
 */
export function classifyMicrosoftLinkage(
  row: Record<string, unknown> | null | undefined,
  kind: 'planner' | 'calendar',
): MicrosoftLinkage {
  const r = row ?? {}
  const containerId = kind === 'planner' ? str(r.microsoft_plan_id) : str(r.microsoft_calendar_id)
  const itemId = kind === 'planner' ? str(r.microsoft_task_id) : str(r.microsoft_event_id)
  const removedAt = str(r.microsoft_source_removed_at)

  const freshness = {
    last_synced_at: str(r.microsoft_last_synced_at),
    last_seen_at: str(r.microsoft_last_seen_at),
    source_modified_at: str(r.microsoft_source_modified_at),
    source_removed_at: removedAt,
  }

  if (!itemId) {
    // No durable Microsoft item identity => Dynamics-native work.
    return { classification: 'dynamics_only', source_key: null, microsoft: null, freshness }
  }

  const microsoft = kind === 'planner'
    ? {
        source_type: str(r.microsoft_source_type) ?? 'planner_plan',
        plan_id: containerId,
        bucket_id: str(r.microsoft_bucket_id),
        task_id: itemId,
        source_hash: str(r.microsoft_source_hash),
      }
    : {
        source_type: str(r.microsoft_source_type) ?? 'outlook_calendar',
        calendar_id: containerId,
        event_id: itemId,
        source_hash: str(r.microsoft_source_hash),
      }

  return {
    classification: removedAt ? 'microsoft_source_removed' : 'microsoft_backed',
    source_key: `${kind}:${containerId ?? 'missing'}:${itemId}`,
    microsoft,
    freshness,
  }
}

/**
 * Attach `source` linkage to a row and strip the raw microsoft_* columns, so callers get one
 * structured block instead of a flat column dump. Existing human-facing fields are preserved
 * exactly — this is additive per #325 ("add fields rather than title-based shortcuts").
 */
export function withSourceLinkage(
  rows: ReadonlyArray<Record<string, unknown>> | null | undefined,
  kind: 'planner' | 'calendar',
): Array<Record<string, unknown>> {
  const microsoftCols = new Set<string>([...PLANNER_MICROSOFT_FIELDS, ...CALENDAR_MICROSOFT_FIELDS])
  return (rows ?? []).map(row => {
    const linkage = classifyMicrosoftLinkage(row, kind)
    const rest: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) {
      if (!microsoftCols.has(k)) rest[k] = v
    }
    return { ...rest, source: linkage }
  })
}

// ── Sync freshness ──────────────────────────────────────────────────────────

export type SyncHealthState = 'healthy' | 'stale' | 'failed' | 'in_progress' | 'never_run'

export interface SyncHealth {
  state: SyncHealthState
  /** True when the Assistant must flag SYNC STALE / SYNC FAILED before relying on mirrors. */
  degraded: boolean
  age_minutes: number | null
  freshness_threshold_minutes: number
  reason: string
}

/** A daily operating cycle: a reconciliation older than this is stale for today's brief. */
export const DEFAULT_SYNC_FRESHNESS_MINUTES = 12 * 60

/**
 * Derive the sync-health verdict the Assistant needs BEFORE a daily brief (#325 §2).
 * Deterministic and clock-injected so it is testable. Unknown state is reported as degraded
 * rather than silently assumed healthy.
 */
export function summarizeSyncHealth(
  run: { status?: unknown; finished_at?: unknown; applied_at?: unknown; started_at?: unknown; safe_error?: unknown } | null | undefined,
  nowIso: string,
  thresholdMinutes: number = DEFAULT_SYNC_FRESHNESS_MINUTES,
): SyncHealth {
  const base = { freshness_threshold_minutes: thresholdMinutes }

  if (!run) {
    return { ...base, state: 'never_run', degraded: true, age_minutes: null, reason: 'No Microsoft to Dynamics reconciliation run has been recorded. Treat Dynamics mirrors as unverified and flag SYNC STALE.' }
  }

  const status = str(run.status)
  if (status === 'failed') {
    return { ...base, state: 'failed', degraded: true, age_minutes: null, reason: `The latest reconciliation failed${str(run.safe_error) ? `: ${str(run.safe_error)}` : ''}. Flag SYNC FAILED and prefer the live Microsoft read.` }
  }
  if (status === 'previewed' || status === 'applying') {
    return { ...base, state: 'in_progress', degraded: true, age_minutes: null, reason: 'A reconciliation is previewed or still applying, so Dynamics mirrors are not yet settled. Prefer the live Microsoft read.' }
  }

  const completedAt = str(run.finished_at) ?? str(run.applied_at)
  if (!completedAt) {
    return { ...base, state: 'in_progress', degraded: true, age_minutes: null, reason: 'The latest reconciliation has no completion timestamp, so its freshness cannot be proven. Treat mirrors as unverified.' }
  }

  const completedMs = Date.parse(completedAt)
  const nowMs = Date.parse(nowIso)
  if (Number.isNaN(completedMs) || Number.isNaN(nowMs)) {
    return { ...base, state: 'stale', degraded: true, age_minutes: null, reason: 'Reconciliation completion time could not be parsed, so freshness is unknown. Treat mirrors as unverified.' }
  }

  const ageMinutes = Math.max(0, Math.round((nowMs - completedMs) / 60000))
  if (ageMinutes > thresholdMinutes) {
    return { ...base, state: 'stale', degraded: true, age_minutes: ageMinutes, reason: `The latest reconciliation completed ${ageMinutes} minutes ago, beyond the ${thresholdMinutes}-minute daily-cycle threshold. Flag SYNC STALE and prefer the live Microsoft read.` }
  }

  // `partial` completed within the window is usable but still explicitly degraded.
  if (status === 'partial') {
    return { ...base, state: 'healthy', degraded: true, age_minutes: ageMinutes, reason: `The latest reconciliation completed ${ageMinutes} minutes ago but was PARTIAL. Report degraded source coverage for any source that did not complete.` }
  }

  return { ...base, state: 'healthy', degraded: false, age_minutes: ageMinutes, reason: `The latest reconciliation completed successfully ${ageMinutes} minutes ago, within the ${thresholdMinutes}-minute daily-cycle threshold. Still perform the live Microsoft read.` }
}
