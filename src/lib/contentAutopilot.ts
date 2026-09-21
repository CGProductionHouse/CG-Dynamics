// ── #450 Content Production Autopilot — pure rules (no I/O) ──────────────────
//
// Everything here is deterministic and framework-free so the Vite app, the
// Edge Functions and the tests share one answer. No Supabase, no Deno, no fetch.
//
// Hard rules encoded here:
//   * `monthly_deliverables` is read-only: a video LINKS to a deliverable and
//     nothing in this module ever proposes writing one.
//   * A human-edited field is never overwritten, and an approved or published
//     guideline is never touched.
//   * Unreadable or unmapped evidence is UNVERIFIED — never "missing".
//   * The client short code is configured data. It is never inferred from a
//     client display name or a folder name.
//   * No rename/move/delete is expressible here.

import { buildMonthFolderName, buildVideoFolderName, buildYearFolderName, normalizeShortCode } from './onedriveCanonical'
import { guidelineVideoName } from './contentGuidelineNaming'
import type { VideoProductionStatus } from './videoPipelineRules'

// ── Coverage window (Phase 3) ────────────────────────────────────────────────

/** How many months ahead a run may plan when the schedule has nothing further out. */
export const DEFAULT_COVERAGE_MONTHS = 3

/** First day of the month `offset` months after `month` ("2026-09-01" + 1 => "2026-10-01"). */
export function shiftMonth(month: string, offset: number): string {
  const year = Number(month.slice(0, 4))
  const index = Number(month.slice(5, 7)) - 1 + offset
  const shifted = new Date(Date.UTC(year, index, 1))
  return shifted.toISOString().slice(0, 10)
}

export function monthOf(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export interface CoverageWindow {
  start: string
  end: string
  months: string[]
  /** 'schedule' when real future deliverables define the window; 'planned' when they do not reach far enough. */
  basis: 'schedule' | 'planned'
}

/**
 * The months a run should plan for. Real future Client Schedule months win. When the
 * schedule only reaches the run's own month, the window is extended with *planned*
 * months so future concepts can exist unallocated — it never fabricates deliverables.
 */
export function planCoverageWindow(input: {
  runDate: string
  scheduleMonths?: string[]
  minimumMonths?: number
}): CoverageWindow {
  const start = monthOf(input.runDate)
  const minimum = Math.max(1, input.minimumMonths ?? DEFAULT_COVERAGE_MONTHS)
  const scheduled = [...new Set((input.scheduleMonths ?? []).map(monthOf))].filter(month => month >= start).sort()
  const months = [...scheduled]
  for (let offset = 0; months.length < minimum || !months.includes(start); offset += 1) {
    const month = shiftMonth(start, offset)
    if (!months.includes(month)) months.push(month)
    if (offset > 24) break
  }
  months.sort()
  const trimmed = months.slice(0, Math.max(minimum, scheduled.length))
  return {
    start: trimmed[0],
    end: trimmed[trimmed.length - 1],
    months: trimmed,
    basis: scheduled.length >= minimum ? 'schedule' : 'planned',
  }
}

// ── Draft preparation (Phase 3) ──────────────────────────────────────────────

export type GenerationBlockedReason =
  | 'GUIDELINE_APPROVED'
  | 'CLIENT_CONTEXT_NOT_READY'
  | 'NO_AI_PROVIDER'
  | 'NO_COVERAGE_WINDOW'

export interface AutopilotVideo {
  id: string
  position: number | null
  title: string
  month: string | null
  deliverable_id: string | null
  script: string | null
  shot_breakdown: string | null
  requirements: string | null
  cta: string | null
  production_status: VideoProductionStatus
  /** True once any human has edited this video. The autopilot then only fills empty fields. */
  human_edited?: boolean
  updated_at?: string
}

export interface PreparationPlan {
  /** Ideas are requested only when the guideline has fewer saved videos than the window wants. */
  requestIdeas: boolean
  ideasWanted: number
  /** Saved videos with no script yet — the `develop` step's exact targets, in saved order. */
  developVideoIds: string[]
  /** Videos whose month has no real deliverable link: truthfully unallocated, not an error. */
  unallocatedVideoIds: string[]
  blocked: GenerationBlockedReason | null
  coverage: CoverageWindow | null
}

const PLACEHOLDER_SCRIPT = /^script pending/i

export function hasRealScript(video: Pick<AutopilotVideo, 'script'>): boolean {
  const script = (video.script ?? '').trim()
  return script.length > 0 && !PLACEHOLDER_SCRIPT.test(script)
}

/**
 * What the autopilot should prepare for one run, idempotently. Running it twice over
 * the same state asks for the same work; once a video has a real script it is never
 * regenerated, and a guideline a human approved or published is left alone entirely.
 */
export function planGuidelinePreparation(input: {
  guidelineStatus: 'draft' | 'ready' | 'published' | 'archived'
  runDate: string | null
  videos: AutopilotVideo[]
  scheduleMonths?: string[]
  deliverableMonths?: string[]
  clientContextReady: boolean
  aiProviderAvailable: boolean
  targetVideoCount?: number
  minimumMonths?: number
}): PreparationPlan {
  const idle = (blocked: GenerationBlockedReason, coverage: CoverageWindow | null = null): PreparationPlan => ({
    requestIdeas: false, ideasWanted: 0, developVideoIds: [], unallocatedVideoIds: [], blocked, coverage,
  })
  if (input.guidelineStatus !== 'draft') return idle('GUIDELINE_APPROVED')
  if (!input.runDate) return idle('NO_COVERAGE_WINDOW')
  const coverage = planCoverageWindow({ runDate: input.runDate, scheduleMonths: input.scheduleMonths, minimumMonths: input.minimumMonths })
  if (!input.clientContextReady) return idle('CLIENT_CONTEXT_NOT_READY', coverage)
  if (!input.aiProviderAvailable) return idle('NO_AI_PROVIDER', coverage)

  const ordered = orderVideos(input.videos)
  const target = Math.max(input.targetVideoCount ?? coverage.months.length, coverage.months.length)
  const deliverableMonths = new Set((input.deliverableMonths ?? []).map(monthOf))
  return {
    requestIdeas: ordered.length < target,
    ideasWanted: Math.max(0, target - ordered.length),
    developVideoIds: ordered.filter(video => !hasRealScript(video)).map(video => video.id),
    unallocatedVideoIds: ordered
      .filter(video => !video.deliverable_id && (!video.month || !deliverableMonths.has(monthOf(video.month))))
      .map(video => video.id),
    blocked: null,
    coverage,
  }
}

/** Saved order is the authority: `position` first, then a stable fallback. */
export function orderVideos<T extends { id: string; position: number | null }>(videos: T[]): T[] {
  return [...videos].sort((a, b) => {
    const left = a.position ?? Number.MAX_SAFE_INTEGER
    const right = b.position ?? Number.MAX_SAFE_INTEGER
    return left - right || a.id.localeCompare(b.id)
  })
}

/**
 * Which fields of a generated draft may be written to a saved video. A field a human
 * wrote is reported as a conflict and never overwritten; only empty fields are filled.
 */
export function applyDraftSafely(
  video: AutopilotVideo,
  draft: Partial<Pick<AutopilotVideo, 'script' | 'shot_breakdown' | 'requirements' | 'cta'>>,
): { fill: Partial<AutopilotVideo>; conflicts: string[] } {
  const fill: Partial<AutopilotVideo> = {}
  const conflicts: string[] = []
  for (const field of ['script', 'shot_breakdown', 'requirements', 'cta'] as const) {
    const proposed = (draft[field] ?? '').trim()
    if (!proposed) continue
    const current = (video[field] ?? '').trim()
    const occupied = field === 'script' ? hasRealScript(video) : current.length > 0
    if (occupied) conflicts.push(field)
    else fill[field] = proposed
  }
  return { fill, conflicts }
}

// ── Canonical destinations (Phase 5) ─────────────────────────────────────────

export type FolderBlockedReason = 'BLOCKED_MISSING_SHORT_CODE' | 'BLOCKED_MISSING_ONEDRIVE_MAPPING'

export interface VideoFolderPlan {
  /** Canonical folder name, e.g. "2026_09_ECONO_VIDEO_02". Null while blocked. */
  folderName: string | null
  /** Human-readable canonical path, for staff text. Contains no Graph id or URL. */
  path: string | null
  /** Durable identity once mapped; the plan is advisory only while this is null. */
  itemId: string | null
  driveId: string | null
  state: 'mapped' | 'ready_to_create' | 'blocked'
  blocked: FolderBlockedReason | null
}

export interface RunFolderMapping {
  driveId: string
  monthFolderItemId: string
  /** The mapped client folder's real name, used only to render a readable path. */
  clientFolderName: string
}

/**
 * The exact canonical production folder for one saved video. The short code is
 * configured data — a missing one blocks, it is never derived from a display name.
 * An existing mapping wins: this never proposes a second near-match folder.
 */
export function planVideoProductionFolder(input: {
  shortCode: string | null | undefined
  monthDate: string | null
  position: number
  runFolder: RunFolderMapping | null
  existing?: { driveId: string; itemId: string; folderName: string } | null
}): VideoFolderPlan {
  const blocked = (reason: FolderBlockedReason): VideoFolderPlan => ({
    folderName: null, path: null, itemId: null, driveId: null, state: 'blocked', blocked: reason,
  })
  if (input.existing) {
    return {
      folderName: input.existing.folderName, path: null,
      itemId: input.existing.itemId, driveId: input.existing.driveId,
      state: 'mapped', blocked: null,
    }
  }
  let code: string
  try {
    code = normalizeShortCode(input.shortCode ?? '')
  } catch {
    return blocked('BLOCKED_MISSING_SHORT_CODE')
  }
  if (!input.runFolder || !input.monthDate) return blocked('BLOCKED_MISSING_ONEDRIVE_MAPPING')
  const year = Number(input.monthDate.slice(0, 4))
  const month = Number(input.monthDate.slice(5, 7))
  const folderName = buildVideoFolderName(year, month, code, input.position)
  return {
    folderName,
    path: [
      'Clients', input.runFolder.clientFolderName, 'Videos',
      buildYearFolderName(year), buildMonthFolderName(year, month), folderName,
    ].join(' / '),
    itemId: null, driveId: null, state: 'ready_to_create', blocked: null,
  }
}

export type FinalOutputState = 'published' | 'mapped' | 'not_published' | 'unverified' | 'blocked_no_portal'

export interface FinalOutputPlan {
  state: FinalOutputState
  /** Durable portal identity, internal only — never rendered to a client. */
  itemId: string | null
  driveId: string | null
  reason: string
}

/**
 * The client-safe final destination for one video, resolved through the EXISTING
 * Client Portal Library `video` category. Internal production folders are never
 * offered here, and no Graph id or URL is placed in staff- or client-facing text.
 */
export function planPortalFinalOutput(input: {
  portalVideoCategory: { driveId: string; folderItemId: string } | null
  publishedAsset?: { driveId: string; itemId: string; active: boolean } | null
  portalReadable?: boolean
}): FinalOutputPlan {
  if (input.portalReadable === false) {
    return { state: 'unverified', itemId: null, driveId: null, reason: 'The client portal library could not be read.' }
  }
  if (!input.portalVideoCategory) {
    return { state: 'blocked_no_portal', itemId: null, driveId: null, reason: 'This client has no mapped Client Portal Video folder yet.' }
  }
  if (input.publishedAsset?.active) {
    return {
      state: 'published', itemId: input.publishedAsset.itemId, driveId: input.publishedAsset.driveId,
      reason: 'A client-safe final output is published for this video.',
    }
  }
  return {
    state: input.publishedAsset ? 'mapped' : 'not_published',
    itemId: input.publishedAsset?.itemId ?? null,
    driveId: input.publishedAsset?.driveId ?? null,
    reason: input.publishedAsset
      ? 'A final output exists for this video but is not currently published to the client.'
      : 'No final output has been published to the client portal for this video yet.',
  }
}

// ── Raw evidence and edit readiness (Phase 6) ────────────────────────────────

export type RawEvidenceState = 'UNVERIFIED' | 'MISSING' | 'PARTIAL' | 'VERIFIED'

export type EditReadiness =
  | 'BLOCKED_NO_MAPPING' | 'BLOCKED_RAW_MISSING' | 'RAW_UNVERIFIED' | 'RAW_PARTIAL'
  | 'READY_TO_EDIT' | 'IN_EDIT' | 'IN_REVIEW' | 'FINAL_READY'

/**
 * Per-video raw evidence. Unreadable OneDrive, an unmapped folder or an unchecked
 * closeout are all UNVERIFIED: this never reports "no files" for evidence nobody read.
 */
export function deriveRawEvidence(input: {
  folderState: VideoFolderPlan['state']
  providerReadable?: boolean
  /** The run's existing closeout verification (#313). */
  closeoutUploadStatus?: 'verified' | 'missing' | 'partial' | 'unverified' | null
  /** Exact per-video evidence where a verification has actually run against its folder. */
  videoUploadStatus?: 'verified' | 'missing' | 'partial' | null
}): RawEvidenceState {
  if (input.providerReadable === false) return 'UNVERIFIED'
  if (input.folderState !== 'mapped') return 'UNVERIFIED'
  const status = input.videoUploadStatus ?? input.closeoutUploadStatus ?? null
  switch (status) {
    case 'verified': return 'VERIFIED'
    case 'partial': return 'PARTIAL'
    case 'missing': return 'MISSING'
    default: return 'UNVERIFIED'
  }
}

const IN_EDIT_STATUSES = new Set<VideoProductionStatus>(['editing', 'internal_changes'])
const IN_REVIEW_STATUSES = new Set<VideoProductionStatus>(['internal_review', 'ready_for_client', 'sent_to_client', 'client_changes'])

export interface ReadinessAnswer {
  readiness: EditReadiness
  raw: RawEvidenceState
  reason: string
  nextAction: string
}

/**
 * One truthful answer to "can this video be edited yet?". Work a human has already
 * started wins — the autopilot never drags a video backwards out of edit or review.
 */
export function deriveEditReadiness(input: {
  folder: VideoFolderPlan
  raw: RawEvidenceState
  productionStatus: VideoProductionStatus
  finalOutput?: FinalOutputPlan
}): ReadinessAnswer {
  const answer = (readiness: EditReadiness, reason: string, nextAction: string): ReadinessAnswer =>
    ({ readiness, raw: input.raw, reason, nextAction })

  if (input.productionStatus === 'client_approved' || input.finalOutput?.state === 'published') {
    return answer('FINAL_READY', 'This video is approved and its final output is settled.', 'No action — confirm the client has the final output.')
  }
  if (IN_REVIEW_STATUSES.has(input.productionStatus)) {
    return answer('IN_REVIEW', 'This video is already in review.', 'Chase the outstanding review decision.')
  }
  if (IN_EDIT_STATUSES.has(input.productionStatus)) {
    return answer('IN_EDIT', 'An editor is already working on this video.', 'No action — editing is in progress.')
  }
  if (input.folder.state === 'blocked') {
    return answer('BLOCKED_NO_MAPPING',
      input.folder.blocked === 'BLOCKED_MISSING_SHORT_CODE'
        ? 'This client has no configured short code, so the canonical production folder cannot be named.'
        : 'This run has no mapped OneDrive production folder yet.',
      input.folder.blocked === 'BLOCKED_MISSING_SHORT_CODE'
        ? 'An admin must set the client short code in Dynamics.'
        : 'An admin must map this client folder and the run month folder.')
  }
  if (input.folder.state === 'ready_to_create') {
    return answer('BLOCKED_NO_MAPPING', 'The canonical production folder for this video does not exist yet.', 'Create the canonical production folder from the run.')
  }
  if (input.productionStatus === 'ready_to_edit') {
    return answer('READY_TO_EDIT', 'This video has been marked ready to edit.', 'Assign an editor.')
  }
  switch (input.raw) {
    case 'VERIFIED':
      return answer('READY_TO_EDIT', 'Raw footage is verified in the canonical production folder.', 'Assign an editor.')
    case 'PARTIAL':
      return answer('RAW_PARTIAL', 'Only part of the raw footage is present.', 'Confirm the remaining raw footage is uploaded.')
    case 'MISSING':
      return answer('BLOCKED_RAW_MISSING', 'The canonical production folder was checked and holds no raw footage.', 'Upload the raw footage for this video.')
    default:
      return answer('RAW_UNVERIFIED', 'Raw footage has not been verified yet — this is unknown, not empty.', 'Run upload verification for this run.')
  }
}

// ── Run and client readiness (Phases 7 and 8) ────────────────────────────────

export type RunBlocker =
  | FolderBlockedReason | GenerationBlockedReason
  | 'NO_GUIDELINE' | 'NO_FUTURE_CONTENT_RUN' | 'RAW_UNVERIFIED' | 'RAW_MISSING'

export interface VideoReadiness {
  videoId: string
  name: string
  position: number
  month: string | null
  allocated: boolean
  folder: VideoFolderPlan
  finalOutput: FinalOutputPlan
  readiness: ReadinessAnswer
}

export interface RunReadiness {
  runId: string
  clientId: string | null
  clientName: string | null
  runDate: string | null
  guidelineId: string | null
  guidelineStatus: 'draft' | 'ready' | 'published' | 'archived' | null
  coverageMonths: string[]
  plannedVideos: number
  linkedVideos: number
  unallocatedVideos: number
  folderReadyVideos: number
  rawCounts: Record<RawEvidenceState, number>
  readinessCounts: Record<EditReadiness, number>
  videos: VideoReadiness[]
  blockers: RunBlocker[]
  preparation: PreparationPlan | null
}

function emptyCounts<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map(key => [key, 0])) as Record<T, number>
}

export const RAW_EVIDENCE_STATES: readonly RawEvidenceState[] = ['UNVERIFIED', 'MISSING', 'PARTIAL', 'VERIFIED']
export const EDIT_READINESS_STATES: readonly EditReadiness[] = [
  'BLOCKED_NO_MAPPING', 'BLOCKED_RAW_MISSING', 'RAW_UNVERIFIED', 'RAW_PARTIAL',
  'READY_TO_EDIT', 'IN_EDIT', 'IN_REVIEW', 'FINAL_READY',
]

export interface RunReadinessInput {
  run: { id: string; client_id: string | null; client_name: string | null; run_date: string | null }
  guideline: { id: string; status: 'draft' | 'ready' | 'published' | 'archived' } | null
  videos: AutopilotVideo[]
  shortCode: string | null
  runFolder: RunFolderMapping | null
  videoFolders?: Record<string, { driveId: string; itemId: string; folderName: string }>
  portalVideoCategory?: { driveId: string; folderItemId: string } | null
  portalAssets?: Record<string, { driveId: string; itemId: string; active: boolean }>
  portalReadable?: boolean
  providerReadable?: boolean
  closeoutUploadStatus?: 'verified' | 'missing' | 'partial' | 'unverified' | null
  videoUploadStatuses?: Record<string, 'verified' | 'missing' | 'partial'>
  scheduleMonths?: string[]
  deliverableMonths?: string[]
  clientContextReady?: boolean
  aiProviderAvailable?: boolean
  targetVideoCount?: number
  minimumMonths?: number
}

/** The whole operational answer for one Content Run. Pure: every input is already resolved. */
export function buildRunReadiness(input: RunReadinessInput): RunReadiness {
  const ordered = orderVideos(input.videos)
  const blockers = new Set<RunBlocker>()
  const rawCounts = emptyCounts(RAW_EVIDENCE_STATES)
  const readinessCounts = emptyCounts(EDIT_READINESS_STATES)

  const videos: VideoReadiness[] = ordered.map((video, index) => {
    const position = video.position ?? index + 1
    const folder = planVideoProductionFolder({
      shortCode: input.shortCode,
      monthDate: video.month ?? input.run.run_date,
      position,
      runFolder: input.runFolder,
      existing: input.videoFolders?.[video.id] ?? null,
    })
    if (folder.blocked) blockers.add(folder.blocked)
    const finalOutput = planPortalFinalOutput({
      portalVideoCategory: input.portalVideoCategory ?? null,
      publishedAsset: input.portalAssets?.[video.id] ?? null,
      portalReadable: input.portalReadable,
    })
    const raw = deriveRawEvidence({
      folderState: folder.state,
      providerReadable: input.providerReadable,
      closeoutUploadStatus: input.closeoutUploadStatus ?? null,
      videoUploadStatus: input.videoUploadStatuses?.[video.id] ?? null,
    })
    const readiness = deriveEditReadiness({ folder, raw, productionStatus: video.production_status, finalOutput })
    rawCounts[raw] += 1
    readinessCounts[readiness.readiness] += 1
    if (raw === 'MISSING') blockers.add('RAW_MISSING')
    if (raw === 'UNVERIFIED') blockers.add('RAW_UNVERIFIED')
    return {
      videoId: video.id,
      name: guidelineVideoName(position, video.title),
      position,
      month: video.month,
      allocated: Boolean(video.deliverable_id),
      folder, finalOutput, readiness,
    }
  })

  const preparation = input.guideline
    ? planGuidelinePreparation({
      guidelineStatus: input.guideline.status,
      runDate: input.run.run_date,
      videos: ordered,
      scheduleMonths: input.scheduleMonths,
      deliverableMonths: input.deliverableMonths,
      clientContextReady: input.clientContextReady ?? false,
      aiProviderAvailable: input.aiProviderAvailable ?? false,
      targetVideoCount: input.targetVideoCount,
      minimumMonths: input.minimumMonths,
    })
    : null
  if (!input.guideline) blockers.add('NO_GUIDELINE')
  if (preparation?.blocked && preparation.blocked !== 'GUIDELINE_APPROVED') blockers.add(preparation.blocked)

  return {
    runId: input.run.id,
    clientId: input.run.client_id,
    clientName: input.run.client_name,
    runDate: input.run.run_date,
    guidelineId: input.guideline?.id ?? null,
    guidelineStatus: input.guideline?.status ?? null,
    coverageMonths: preparation?.coverage?.months ?? [],
    plannedVideos: videos.length,
    linkedVideos: videos.filter(video => video.allocated).length,
    unallocatedVideos: videos.filter(video => !video.allocated).length,
    folderReadyVideos: videos.filter(video => video.folder.state === 'mapped').length,
    rawCounts,
    readinessCounts,
    videos,
    blockers: [...blockers],
    preparation,
  }
}

export interface ClientReadiness {
  clientId: string
  clientName: string | null
  runs: RunReadiness[]
  blockers: RunBlocker[]
}

/**
 * Per-client rollup. A client with no upcoming real Content Run reports
 * NO_FUTURE_CONTENT_RUN — the autopilot never invents a shoot date to fill the gap.
 */
export function buildClientReadiness(
  client: { id: string; name: string | null },
  runs: RunReadiness[],
  today: string,
): ClientReadiness {
  const upcoming = runs
    .filter(run => run.clientId === client.id && run.runDate && run.runDate >= today)
    .sort((a, b) => (a.runDate ?? '').localeCompare(b.runDate ?? ''))
  const blockers = new Set<RunBlocker>()
  for (const run of upcoming) for (const blocker of run.blockers) blockers.add(blocker)
  if (!upcoming.length) blockers.add('NO_FUTURE_CONTENT_RUN')
  return { clientId: client.id, clientName: client.name, runs: upcoming, blockers: [...blockers] }
}

export interface AutopilotPassSummary {
  ranAt: string
  clients: number
  runsPrepared: number
  videosPlanned: number
  readyToEdit: number
  blockers: Record<string, number>
}

/** The truthful record of one autopilot pass, stored so the daily cycle knows it ran. */
export function summariseAutopilotPass(ranAt: string, clients: ClientReadiness[]): AutopilotPassSummary {
  const blockers: Record<string, number> = {}
  let runsPrepared = 0
  let videosPlanned = 0
  let readyToEdit = 0
  for (const client of clients) {
    for (const blocker of client.blockers) blockers[blocker] = (blockers[blocker] ?? 0) + 1
    for (const run of client.runs) {
      runsPrepared += 1
      videosPlanned += run.plannedVideos
      readyToEdit += run.readinessCounts.READY_TO_EDIT
    }
  }
  return { ranAt, clients: clients.length, runsPrepared, videosPlanned, readyToEdit, blockers }
}
