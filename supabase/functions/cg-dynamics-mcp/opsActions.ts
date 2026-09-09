// opsActions.ts — pure helpers for the #325 Morning Ops / coexistence actions.
// Import-free so every rule here is unit-tested without Deno or a live database.
//
// Scope discipline: this module SHAPES and CLASSIFIES. It owns no sync engine, no second
// calendar authority and no OneDrive folder convention. Execution is delegated to the
// existing durable Edge Functions and canonical RPCs.

// ── Microsoft reconciliation run verdict ────────────────────────────────────

export type RunVerdict = 'PASS' | 'DEGRADED' | 'FAIL'

export interface JobSourceState {
  sourceType?: unknown
  sourceId?: unknown
  sourceName?: unknown
  required?: unknown
  stage?: unknown
  complete?: unknown
  recordCount?: unknown
  safeError?: unknown
}

export interface RunOutcome {
  verdict: RunVerdict
  reason: string
  sources_total: number
  sources_complete: number
  sources_failed: number
  required_incomplete: string[]
  records_fetched: number
}

const truthy = (v: unknown) => v === true
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Grade a durable reconciliation job from its per-source completion state.
 *
 * PASS     - every required source completed.
 * DEGRADED - optional source incomplete, or a source reported a safe error but required
 *            coverage still completed. Usable, but coverage must be reported as partial.
 * FAIL     - a required source did not complete, or the job itself failed.
 *
 * Source-completeness aware by design: a job that "finished" while a required Planner plan
 * or the Outlook calendar never completed is NOT a pass, because the resulting mirror would
 * be silently incomplete.
 */
export function gradeSyncRun(
  jobStatus: string | null | undefined,
  sources: ReadonlyArray<JobSourceState> | null | undefined,
): RunOutcome {
  const list = sources ?? []
  const total = list.length
  const complete = list.filter(s => truthy(s.complete)).length
  const failed = list.filter(s => text(s.safeError) !== null || s.stage === 'failed').length
  const requiredIncomplete = list
    .filter(s => s.required !== false && !truthy(s.complete))
    .map(s => text(s.sourceName) ?? text(s.sourceId) ?? 'unnamed source')
  const records = list.reduce((n, s) => n + (Number(s.recordCount) || 0), 0)

  const base = {
    sources_total: total,
    sources_complete: complete,
    sources_failed: failed,
    required_incomplete: requiredIncomplete,
    records_fetched: records,
  }

  if (jobStatus === 'failed' || jobStatus === 'cancelled') {
    return { ...base, verdict: 'FAIL', reason: `The reconciliation job ended as ${jobStatus}. Dynamics mirrors are unverified — flag SYNC FAILED and use the live Microsoft read.` }
  }
  if (total === 0) {
    return { ...base, verdict: 'FAIL', reason: 'No reconciliation sources were enumerated, so nothing was verified. Flag SYNC FAILED.' }
  }
  if (requiredIncomplete.length > 0) {
    return { ...base, verdict: 'FAIL', reason: `Required source(s) did not complete: ${requiredIncomplete.join(', ')}. Coverage is incomplete — flag SYNC FAILED rather than trusting the mirror.` }
  }
  if (jobStatus === 'running') {
    return { ...base, verdict: 'DEGRADED', reason: 'The reconciliation is still running. Required coverage is not yet proven — prefer the live Microsoft read.' }
  }
  if (failed > 0 || complete < total) {
    return { ...base, verdict: 'DEGRADED', reason: `Required coverage completed, but ${failed || (total - complete)} source(s) reported errors or did not finish. Report partial source coverage.` }
  }
  return { ...base, verdict: 'PASS', reason: `All ${total} reconciliation source(s) completed and ${records} record(s) were fetched. Still perform the live Microsoft read — sync never replaces it.` }
}

// ── Content Run discovery / OneDrive readiness ──────────────────────────────

export type OneDriveReadiness = 'mapped' | 'unmapped'

export interface OneDriveMappingRow {
  drive_id?: unknown
  month_folder_item_id?: unknown
  folder_name?: unknown
  last_verified_at?: unknown
  web_url?: unknown
}

export interface OneDriveReadinessResult {
  readiness: OneDriveReadiness
  folder_name: string | null
  last_verified_at: string | null
  /** True once the durable Graph identifiers required for verification are present. */
  durable_ids_present: boolean
  note: string
}

/**
 * Classify OneDrive readiness for a Content Run WITHOUT exposing raw Graph identifiers or
 * URLs. #325 keeps drive/item IDs and web URLs internal-only, so they are deliberately not
 * returned — only whether the durable mapping exists and when it was last verified.
 *
 * This never proposes or creates a folder: the month-folder vs run-subfolder convention is
 * still an open CA decision, and guessing it here would pre-empt that decision.
 */
export function classifyOneDriveReadiness(mapping: OneDriveMappingRow | null | undefined): OneDriveReadinessResult {
  const driveId = text(mapping?.drive_id)
  const itemId = text(mapping?.month_folder_item_id)
  const durable = !!(driveId && itemId)
  if (!mapping || !durable) {
    return {
      readiness: 'unmapped',
      folder_name: text(mapping?.folder_name),
      last_verified_at: text(mapping?.last_verified_at),
      durable_ids_present: false,
      note: 'No durable OneDrive mapping is recorded for this Content Run. Upload evidence cannot be verified until the exact mapping exists. Do not guess or create a folder — the month-folder vs run-subfolder convention is an open CA decision.',
    }
  }
  return {
    readiness: 'mapped',
    folder_name: text(mapping.folder_name),
    last_verified_at: text(mapping.last_verified_at),
    durable_ids_present: true,
    note: 'Durable OneDrive mapping present. Raw drive/item identifiers and URLs are internal-only and intentionally withheld.',
  }
}

// ── Assistant-owned guideline linkage ───────────────────────────────────────

export interface GuidelineVideoRow {
  id?: unknown
  title?: unknown
  position?: unknown
  status?: unknown
  deliverable_id?: unknown
  client_id?: unknown
}

export interface DeliverableRow {
  id?: unknown
  client_id?: unknown
  title?: unknown
  deliverable_type?: unknown
  scheduled_date?: unknown
}

export type LinkOutcome = 'already_linked' | 'linkable' | 'blocked_cross_client' | 'no_candidate'

export interface VideoLinkPlan {
  video_id: string
  title: string | null
  position: number | null
  outcome: LinkOutcome
  deliverable_id: string | null
  reason: string
}

/**
 * Resolve, on the Assistant's behalf, which same-client monthly deliverable each ordered
 * guideline video links to. Franco confirms what happened on the shoot; he is never asked to
 * choose an ID.
 *
 * Fails closed: a video already carrying a deliverable from a DIFFERENT client is reported
 * as blocked rather than silently relinked, and a video with no unambiguous same-client
 * candidate is reported as `no_candidate` rather than guessed. Deliverables already claimed
 * by an earlier video are not reused, preserving the one-active-link constraint.
 */
export function planGuidelineVideoLinks(
  videos: ReadonlyArray<GuidelineVideoRow> | null | undefined,
  deliverables: ReadonlyArray<DeliverableRow> | null | undefined,
  runClientId: string,
): VideoLinkPlan[] {
  const ordered = [...(videos ?? [])].sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0))
  const sameClient = (deliverables ?? []).filter(d => text(d.client_id) === runClientId)
  const claimed = new Set<string>()

  // Deliverables already referenced by a video are off the table for auto-assignment.
  for (const v of ordered) {
    const existing = text(v.deliverable_id)
    if (existing) claimed.add(existing)
  }

  return ordered.map(v => {
    const videoId = text(v.id) ?? ''
    const title = text(v.title)
    const position = v.position === null || v.position === undefined ? null : Number(v.position)
    const existing = text(v.deliverable_id)
    const videoClient = text(v.client_id)

    if (videoClient && videoClient !== runClientId) {
      return { video_id: videoId, title, position, outcome: 'blocked_cross_client', deliverable_id: existing, reason: 'This guideline video belongs to a different client than the Content Run. Cross-client linkage is refused.' }
    }
    if (existing) {
      const match = sameClient.find(d => text(d.id) === existing)
      if (!match) {
        return { video_id: videoId, title, position, outcome: 'blocked_cross_client', deliverable_id: existing, reason: 'This video is already linked to a deliverable that does not belong to the Content Run client. Refusing to silently relink; resolve it explicitly.' }
      }
      return { video_id: videoId, title, position, outcome: 'already_linked', deliverable_id: existing, reason: 'Already linked to an exact same-client deliverable. Left unchanged.' }
    }

    const candidates = sameClient.filter(d => !claimed.has(text(d.id) ?? ''))
    if (candidates.length === 0) {
      return { video_id: videoId, title, position, outcome: 'no_candidate', deliverable_id: null, reason: 'No unclaimed same-client monthly deliverable is available for this video. Reported rather than guessed.' }
    }
    // Deterministic: earliest scheduled, then id, so repeated runs plan identically.
    const chosen = [...candidates].sort((a, b) => {
      const sa = text(a.scheduled_date) ?? '9999-12-31'
      const sb = text(b.scheduled_date) ?? '9999-12-31'
      return sa === sb ? (text(a.id) ?? '').localeCompare(text(b.id) ?? '') : sa.localeCompare(sb)
    })[0]
    const chosenId = text(chosen.id) ?? ''
    claimed.add(chosenId)
    return { video_id: videoId, title, position, outcome: 'linkable', deliverable_id: chosenId, reason: `Resolved to the earliest unclaimed same-client deliverable (${text(chosen.title) ?? chosenId}).` }
  })
}

// ── Provider health ─────────────────────────────────────────────────────────

export type ProviderState = 'connected' | 'degraded' | 'not_connected' | 'unavailable'

export interface ProviderHealth {
  provider: string
  state: ProviderState
  degraded: boolean
  detail: string
}

/**
 * Normalise one provider connection-status response into a compact Morning Ops verdict.
 * An unreachable or unparseable provider is `unavailable` and degraded — never reported as
 * healthy, and never as "0 accounts" which would read as a real, confirmed empty state.
 */
export function summarizeProviderHealth(
  provider: string,
  response: { ok?: unknown; connected?: unknown; error?: unknown } | null | undefined,
  transportError?: string | null,
): ProviderHealth {
  if (transportError) {
    return { provider, state: 'unavailable', degraded: true, detail: `Status could not be read: ${transportError}. Treat as unknown, not as disconnected.` }
  }
  if (!response) {
    return { provider, state: 'unavailable', degraded: true, detail: 'No status response was returned. Treat as unknown, not as disconnected.' }
  }
  const err = text(response.error)
  if (err) {
    return { provider, state: 'degraded', degraded: true, detail: err }
  }
  if (response.connected === false) {
    return { provider, state: 'not_connected', degraded: false, detail: 'No authorised connection is configured. This is a known state, not a failure.' }
  }
  if (response.connected === true) {
    return { provider, state: 'connected', degraded: false, detail: 'Authorised connection present.' }
  }
  return { provider, state: 'unavailable', degraded: true, detail: 'Connection state could not be determined from the provider response. Treat as unknown.' }
}
