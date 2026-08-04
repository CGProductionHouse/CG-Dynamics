import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { addBusinessDays, businessDateKey } from '../../lib/businessTime'
import {
  summarizeMicrosoftReconciliation,
  type MicrosoftConflictCode,
  type MicrosoftImportPreviewItem,
  type MicrosoftReconciliationAction,
} from '../../lib/microsoftImport'
import {
  applyMicrosoftReconciliation,
  startMicrosoftPreviewJob,
  processMicrosoftPreviewJob,
  retryMicrosoftJobFailedSources,
  getMicrosoftLatestJob,
  getMicrosoftPreviewResult,
  type MicrosoftJobState,
  getMicrosoftConnectionStatus,
  loadMicrosoftExistingTargets,
  loadMicrosoftMappingContext,
  loadMicrosoftProfiles,
  loadMicrosoftRecoveryContext,
  loadMicrosoftUserMappings,
  loadMicrosoftSyncRunItems,
  loadMicrosoftSyncState,
  updateMicrosoftTransitionStatus,
  type MicrosoftConnectionStatus,
  type MicrosoftReconciliationApplyResult,
  type MicrosoftSyncRunSummary,
  type MicrosoftSyncRunItem,
  type MicrosoftTransitionStatus,
} from '../../lib/microsoftImportData'
import {
  buildMicrosoftRecoveryPlan,
  getMicrosoftExecutableItems,
  getMicrosoftReviewedItems,
  type MicrosoftRecoveryPlan,
} from '../../lib/microsoftRecovery'
import { buildMicrosoftReconciliation } from '../../lib/microsoftSync'
import {
  buildMicrosoftConflictBreakdown,
  filterMicrosoftPreviewItems,
  microsoftIncomingStatus,
  microsoftIncomingStatusLabel,
  summarizeMicrosoftCreateStatuses,
  type MicrosoftIncomingStatus,
} from '../../lib/microsoftSyncPresentation'
import { parseMicrosoftSnapshot, type MicrosoftSnapshot } from '../../lib/microsoftSnapshot'
import { resolvePreviewAssignees } from '../../lib/microsoftAssigneeMapping'

const ACTIONS: Array<{ value: MicrosoftReconciliationAction; label: string }> = [
  { value: 'create', label: 'Create' }, { value: 'link_existing', label: 'Link existing' },
  { value: 'package_template_create', label: 'Add template' }, { value: 'update', label: 'Update' },
  { value: 'complete', label: 'Complete' }, { value: 'reopen', label: 'Reopen' },
  { value: 'move', label: 'Moved' }, { value: 'cancel', label: 'Cancelled' },
  { value: 'archive', label: 'Source removed' }, { value: 'unchanged', label: 'Unchanged' },
  { value: 'conflict', label: 'Conflicts' }, { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
]

const ACTION_TONES: Record<MicrosoftReconciliationAction, string> = {
  create: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  link_existing: 'border-sky-300/25 bg-sky-300/10 text-sky-200',
  package_template_create: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  update: 'border-blue-300/25 bg-blue-300/10 text-blue-200',
  unchanged: 'border-white/15 bg-white/[0.05] text-white/60',
  complete: 'border-teal-300/25 bg-teal-300/10 text-teal-200',
  reopen: 'border-cyan-300/25 bg-cyan-300/10 text-cyan-200',
  move: 'border-violet-300/25 bg-violet-300/10 text-violet-200',
  cancel: 'border-orange-300/25 bg-orange-300/10 text-orange-200',
  archive: 'border-orange-300/25 bg-orange-300/10 text-orange-200',
  conflict: 'border-red-300/25 bg-red-300/10 text-red-200',
  skipped: 'border-slate-300/15 bg-slate-300/[0.05] text-slate-300/70',
  failed: 'border-red-300/25 bg-red-300/10 text-red-200',
}

function destinationLabel(item: MicrosoftImportPreviewItem) {
  if (item.destination === 'cg_calendar') return 'CG Calendar'
  if (item.destination === 'client_schedule') return 'Client Schedule'
  if (item.destination === 'planner') return 'Planner / My Day'
  return 'Review required'
}

function itemKey(item: MicrosoftImportPreviewItem, index: number) {
  return `${item.sourceCalendarId ?? item.sourcePlanId}:${item.sourceEventId ?? item.sourceTaskId}:${index}`
}

function SourceCompleteness({ snapshot }: { snapshot: MicrosoftSnapshot }) {
  return (
    <>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {snapshot.sources.map(source => (
        <article key={`${source.sourceType}:${source.sourceId}`} className={`rounded-xl border p-3 ${source.complete ? 'border-emerald-300/15 bg-emerald-300/[0.045]' : 'border-amber-300/20 bg-amber-300/[0.055]'}`}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-black text-white">{source.sourceName}</p>
            <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase ${source.complete ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{source.complete ? 'Complete' : 'Incomplete'}</span>
          </div>
          <p className="mt-1 text-xs text-white/45">{source.recordCount} source records{source.rangeStart ? ` · ${source.rangeStart.slice(0, 10)} to ${source.rangeEnd?.slice(0, 10)}` : ''}</p>
          {source.safeError && <p className="mt-2 text-xs text-amber-100/80">{source.safeError}</p>}
        </article>
      ))}
      </div>
      <AssigneeLookupDiagnostic snapshot={snapshot} />
    </>
  )
}

function AssigneeLookupDiagnostic({ snapshot }: { snapshot: MicrosoftSnapshot }) {
  const lookup = snapshot.assigneeLookup
  if (!lookup || lookup.requested === 0) return null
  const permissionBlocked = lookup.resolved === 0 && Boolean(lookup.statusCounts['401'] || lookup.statusCounts['403'])

  return (
    <article className={`mt-3 rounded-xl border p-3 ${lookup.unresolved === 0 ? 'border-emerald-300/15 bg-emerald-300/[0.045]' : 'border-amber-300/20 bg-amber-300/[0.055]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-black text-white">Teams staff assignments</p>
        <p className="text-xs text-white/55">{lookup.resolved} resolved · {lookup.unresolved} unresolved · {lookup.requested} requested</p>
      </div>
      {permissionBlocked
        ? <p className="mt-2 text-xs text-amber-100/80">Microsoft directory lookup is blocked. Grant the Entra application read-only <strong>User.Read.All</strong> application permission with admin consent, then run Preview again.</p>
        : lookup.unresolved > 0
          ? <p className="mt-2 text-xs text-amber-100/70">Some Teams assignees could not be resolved. They will remain unassigned until their Microsoft identity is mapped to a CG Dynamics staff profile.</p>
          : <p className="mt-2 text-xs text-emerald-100/70">All Teams assignee identities were resolved for staff matching.</p>}
      {Object.keys(lookup.statusCounts).length > 0 && (
        <p className="mt-2 text-[10px] uppercase tracking-wider text-white/35">
          Directory response: {Object.entries(lookup.statusCounts).map(([status, count]) => `${status}: ${count}`).join(' · ')}
        </p>
      )}
    </article>
  )
}

function PreviewItem({ item }: { item: MicrosoftImportPreviewItem }) {
  const action = item.reconciliationAction ?? 'skipped'
  const incomingStatus = microsoftIncomingStatus(item)
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-teal/75">{item.sourceName}</p>
          <h3 className="mt-1 break-words text-sm font-black text-white">{item.title || 'Untitled Microsoft item'}</h3>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${ACTION_TONES[action]}`}>{action}</span>
          {action === 'create' && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black text-white/70">Create as {microsoftIncomingStatusLabel(incomingStatus)}</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
        <span>{destinationLabel(item)}</span>
        <span>{item.dueDate ?? item.startDate ?? 'No date'}</span>
        {item.mappedClientName && <span>{item.mappedClientName}</span>}
      </div>
      {item.resolvedAssignees && item.resolvedAssignees.length > 0 && <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {item.resolvedAssignees.map(resolution => (
          <span key={resolution.microsoftUserId} className={`${resolution.resolved ? 'text-emerald-200/80' : 'text-amber-200/60'}`}>
            {resolution.resolved ? `${resolution.cgProfileName ?? resolution.displayName}` : `Unresolved: ${resolution.displayName}`}
          </span>
        ))}
      </div>}
      {item.requiresRemovalApproval && <p className="mt-3 rounded-lg border border-orange-300/15 bg-orange-300/[0.06] px-3 py-2 text-xs text-orange-100">Missing from a complete source fetch. Explicit source-removal approval is required.</p>}
      {item.conflictCode && <p className="mt-3 text-[10px] font-black uppercase tracking-wider text-red-200/70">Conflict: {item.conflictCode.replaceAll('_', ' ')}</p>}
      {item.conflictReason && <p className="mt-3 rounded-lg border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-xs text-red-100">{item.conflictReason}</p>}
      {item.warnings.map(warning => <p key={warning} className="mt-2 text-xs text-amber-100/70">{warning}</p>)}
    </article>
  )
}

function RunHistory({ runs, onSelect }: { runs: MicrosoftSyncRunSummary[]; onSelect: (runId: string) => void }) {
  if (runs.length === 0) return <p className="text-sm text-white/40">No transition sync runs have been recorded yet.</p>
  return <div className="space-y-2">{runs.map(run => (
    <button type="button" onClick={() => onSelect(run.id)} key={run.id} className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-3 text-left transition-colors hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="text-sm font-black text-white">{new Date(run.createdAt).toLocaleString('en-ZA')} · {run.triggerType}</p><p className="mt-1 text-xs text-white/45">Source {new Date(run.snapshotExportedAt).toLocaleString('en-ZA')} · {run.sourceCompleteness.filter(source => source.complete).length}/{run.sourceCompleteness.length} complete</p>{run.safeError && <p className="mt-1 truncate text-xs text-red-200" title={run.safeError}>{run.safeError}</p>}</div>
      <div className="text-left sm:text-right"><p className={`text-xs font-black uppercase ${run.status === 'failed' ? 'text-red-300' : run.status === 'partial' ? 'text-amber-200' : 'text-brand-teal'}`}>{run.status}</p><p className="mt-1 text-xs text-white/45">{run.summary.applied ?? 0} applied · {run.summary.previouslyApplied ?? 0} previous · {run.summary.failed ?? 0} failed · {(run.summary.conflict ?? 0) || (run.summary.conflictsUntouched ?? 0)} conflicts</p></div>
    </button>
  ))}</div>
}

// Which preview job has already been applied.
//
// Kept in sessionStorage so a refresh or a reopen in the same tab cannot bring a
// finished reconciliation back as the active workflow. Deliberately NOT
// localStorage: this is about the current working session, not a durable record
// — the durable record is the run in Sync history.
const APPLIED_PREVIEW_JOB_KEY = 'cg-microsoft-applied-preview-job-v1'

function rememberAppliedPreviewJob(jobId: string | null) {
  if (!jobId) return
  try {
    window.sessionStorage.setItem(APPLIED_PREVIEW_JOB_KEY, jobId)
  } catch {
    // Private mode / storage disabled. The server-side completeness check still
    // stops a finished preview being resumed; this is belt and braces.
  }
}

function readAppliedPreviewJob(): string | null {
  try {
    return window.sessionStorage.getItem(APPLIED_PREVIEW_JOB_KEY)
  } catch {
    return null
  }
}

export default function MicrosoftImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [connection, setConnection] = useState<MicrosoftConnectionStatus | null>(null)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [transitionStatus, setTransitionStatus] = useState<MicrosoftTransitionStatus>('active')
  const [runs, setRuns] = useState<MicrosoftSyncRunSummary[]>([])
  const [runItems, setRunItems] = useState<MicrosoftSyncRunItem[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [rangeStart, setRangeStart] = useState(addBusinessDays(businessDateKey(), -31))
  const [rangeEnd, setRangeEnd] = useState(addBusinessDays(businessDateKey(), 93))
  const [snapshot, setSnapshot] = useState<MicrosoftSnapshot | null>(null)
  const [items, setItems] = useState<MicrosoftImportPreviewItem[]>([])
  const [sourceFilter, setSourceFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState<MicrosoftReconciliationAction | 'all'>('create')
  const [statusFilter, setStatusFilter] = useState<MicrosoftIncomingStatus | 'all'>('all')
  const [conflictFilter, setConflictFilter] = useState<MicrosoftConflictCode | 'uncoded' | 'all'>('all')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [reviewed, setReviewed] = useState(false)
  const [approveRemovals, setApproveRemovals] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [applyResult, setApplyResult] = useState<MicrosoftReconciliationApplyResult | null>(null)
  const [job, setJob] = useState<MicrosoftJobState | null>(null)
  const [recovery, setRecovery] = useState<{
    sourceRun: MicrosoftSyncRunSummary
    previewJobId: string
    plan: MicrosoftRecoveryPlan
  } | null>(null)
  const jobCancelledRef = useRef(false)

  const summary = summarizeMicrosoftReconciliation(items)
  const visibleItems = filterMicrosoftPreviewItems(items, { source: sourceFilter, action: actionFilter, status: statusFilter, conflict: conflictFilter })
  const sourceOptions = [...new Set(items.map(item => item.sourceName))].sort()
  const statusOptions = [...new Set(items.map(microsoftIncomingStatus))].sort()
  const conflictOptions = [...new Set(items.filter(item => item.reconciliationAction === 'conflict').map(item => item.conflictCode ?? 'uncoded'))].sort()
  const conflictBreakdown = buildMicrosoftConflictBreakdown(items)
  const createStatusCounts = summarizeMicrosoftCreateStatuses(items)
  const completedOperationalSkipped = items.filter(item => item.skipCode === 'completed_operational_not_imported' && item.reconciliationAction === 'skipped').length
  const removalCount = items.filter(item => item.requiresRemovalApproval).length
  const lastSuccess = runs.find(run => run.status === 'completed' || (run.summary.applied ?? 0) > 0)
  const applicableCount = getMicrosoftExecutableItems(items, approveRemovals).length
  const selectedRun = runs.find(run => run.id === selectedRunId) ?? null
  const meaningfulRunItems = runItems.filter(item => item.resultStatus !== 'skipped')
  const failedRunItems = runItems.filter(item => item.resultStatus === 'failed')

  async function loadStatus() {
    const [syncState, connectionState] = await Promise.all([loadMicrosoftSyncState(), getMicrosoftConnectionStatus()])
    setTransitionStatus(syncState.transitionStatus)
    setRuns(syncState.runs)
    setMigrationNeeded(syncState.migrationNeeded)
    setConnection(connectionState.data)
    setConnectionError(connectionState.error ?? syncState.error)
  }
  const loadStatusEvent = useEffectEvent(loadStatus)

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadStatusEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Return the workspace to a clean "Ready to sync" state. This is the ONLY
  // thing that clears a finished reconciliation; it deliberately does not touch
  // `runs` (Sync history) or `applyResult` (the success confirmation), and it
  // never starts another sync.
  function resetToReadyState() {
    setSnapshot(null)
    setItems([])
    setJob(null)
    setReviewed(false)
    setApproveRemovals(false)
    setRecovery(null)
    setError(null)
    setParseErrors([])
    setProgress({ completed: 0, total: 0 })
    setSourceFilter('all')
    setActionFilter('create')
    setStatusFilter('all')
    setConflictFilter('all')
  }

  // Nothing is in flight and no preview is open: the next action really is a
  // fresh fetch. Drives the "Ready to sync" badge on the fetch panel.
  const workspaceReady = !snapshot && !job && !recovery && !loading && !applying

  function scrollWorkspaceToTop() {
    // The apply button sits at the bottom of a long preview, so without this the
    // admin is left staring at the workspace that was just cleared.
    //
    // Deliberately INSTANT, and written directly to scrollTop rather than via
    // scrollTo({ behavior: 'smooth' }). Smooth scrolling is animation-frame
    // driven: measured in-browser it did not move the element at all when
    // frames were not being produced (1281.6px -> 1281.6px), while an instant
    // scroll landed at 0 every time. Returning to the top is the whole point of
    // this fix, so it must not depend on a frame that may never arrive — and
    // animating through a preview that has just been cleared would be odd
    // anyway.
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    // On desktop the page scrolls inside AdminLayout's <main>, not the window,
    // so this is the one that actually matters there.
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }

  // Resume any in-flight preview job after a refresh or navigation. The job lives
  // server-side, so its per-source progress is restored; the admin resumes/retries.
  //
  // A preview that has already been APPLIED is never resumed, even if the server
  // still reports it as running with incomplete sources — reopening the page
  // must not bring a finished reconciliation back as the active workflow.
  const resumeJobEvent = useEffectEvent(async () => {
    const latest = await getMicrosoftLatestJob()
    if (!latest.job) return
    if (latest.job.jobId === readAppliedPreviewJob()) return
    if (!latest.job.progress.allRequiredComplete && latest.job.status === 'running') setJob(latest.job)
  })
  useEffect(() => {
    const timer = window.setTimeout(() => { void resumeJobEvent() }, 0)
    return () => { window.clearTimeout(timer); jobCancelledRef.current = true }
  }, [])

  async function prepareSnapshot(nextSnapshot: MicrosoftSnapshot, clearRecovery = true): Promise<MicrosoftImportPreviewItem[] | null> {
    setLoading(true)
    setError(null)
    setItems([])
    setReviewed(false)
    setApproveRemovals(false)
    setApplyResult(null)
    if (clearRecovery) setRecovery(null)
    try {
      const [contextResult, existingResult, profilesResult, mappingsResult] = await Promise.all([loadMicrosoftMappingContext(), loadMicrosoftExistingTargets(), loadMicrosoftProfiles(), loadMicrosoftUserMappings()])
      if (contextResult.error || !contextResult.context) throw new Error(contextResult.error ?? 'Could not load mapping context.')
      if (existingResult.error) throw new Error(existingResult.error)
      if (profilesResult.error) throw new Error(profilesResult.error)
      setMigrationNeeded(existingResult.migrationNeeded)
      const resolved = buildMicrosoftReconciliation(
        nextSnapshot,
        contextResult.context,
        existingResult.targets,
        existingResult.deliverableSlotKeys,
        mapped => resolvePreviewAssignees(mapped, nextSnapshot.assigneeMap ?? {}, mappingsResult.data, profilesResult.data),
        existingResult.unlinkedSlotRows,
      )
      setSnapshot(nextSnapshot)
      setItems(resolved)
      const first = ACTIONS.find(option => resolved.some(item => item.reconciliationAction === option.value))
      setSourceFilter('all')
      setActionFilter(first?.value ?? 'all')
      setStatusFilter('all')
      setConflictFilter('all')
      return resolved
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Reconciliation preview failed.')
      return null
    } finally {
      setLoading(false)
    }
  }

  // Drive a durable job: process one bounded source-unit at a time, updating the
  // per-source progress UI, until every source is finished. Assemble + reconcile
  // only when all required sources complete; surface failed sources for retry.
  async function driveJob(jobId: string) {
    jobCancelledRef.current = false
    setLoading(true)
    setError(null)
    let guard = 0
    let last: MicrosoftJobState | null = null
    // Generous ceiling: even a 4,000-task plan is ~16 detail batches + a handful
    // of other sources. This only guards against an unexpected non-terminating loop.
    while (guard < 400 && !jobCancelledRef.current) {
      guard += 1
      const step = await processMicrosoftPreviewJob(jobId)
      if (step.error) { setLoading(false); setError(step.error); return }
      if (step.job) { last = step.job; setJob(step.job) }
      if (step.finished || step.job?.progress.finished) break
    }
    if (jobCancelledRef.current) { setLoading(false); return }
    const progress = last?.progress
    if (!progress || !progress.allRequiredComplete) {
      setLoading(false)
      setError(progress?.anyFailed ? 'Some sources failed. Retry the failed sources to complete the preview.' : 'The preview did not finish. Retry the failed sources.')
      return
    }
    const result = await getMicrosoftPreviewResult(jobId)
    if (!result.snapshot) { setLoading(false); setError(result.error ?? 'The preview is not complete yet.'); return }
    await prepareSnapshot(result.snapshot)
  }

  async function previewLatest() {
    if (loading || transitionStatus !== 'active') return
    setSnapshot(null)
    setItems([])
    setError(null)
    const started = await startMicrosoftPreviewJob(`${rangeStart}T00:00:00+02:00`, `${rangeEnd}T00:00:00+02:00`)
    if (!started.job) { setError(started.error ?? 'Could not start the Microsoft preview job.'); return }
    setJob(started.job)
    await driveJob(started.job.jobId)
  }

  async function retryFailedSources() {
    if (!job || loading) return
    const retried = await retryMicrosoftJobFailedSources(job.jobId)
    if (!retried.job) { setError(retried.error ?? 'Could not retry the failed sources.'); return }
    setJob(retried.job)
    await driveJob(retried.job.jobId)
  }

  async function onSnapshotFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setParseErrors([])
    setJob(null)
    const parsed = parseMicrosoftSnapshot(await file.text())
    if (!parsed.snapshot) { setParseErrors(parsed.errors); return }
    await prepareSnapshot(parsed.snapshot)
  }

  async function applyReviewed() {
    if (!snapshot || applying || !reviewed || migrationNeeded) return
    const currentState = await loadMicrosoftSyncState()
    if (currentState.error || currentState.migrationNeeded || currentState.transitionStatus !== 'active') {
      setTransitionStatus(currentState.transitionStatus)
      setError(currentState.error ?? (currentState.migrationNeeded ? 'Phase 17a is required before apply.' : `Microsoft transition sync is ${currentState.transitionStatus}. Preview was not applied.`))
      return
    }
    setApplying(true)
    setError(null)
    setProgress({ completed: 0, total: applicableCount })
    try {
      const appliedJobId = job?.jobId ?? null
      const result = await applyMicrosoftReconciliation(
        items,
        snapshot,
        approveRemovals,
        (completed, total) => setProgress({ completed, total }),
        { previewJobId: appliedJobId },
      )
      // Refresh Sync history first so the completed run is present the moment the
      // workspace clears — the run must never disappear from the page.
      await loadStatus()

      if (result.errors.length > 0) {
        // Something still needs attention. Keep the preview as the active
        // workspace and re-reconcile it so what remains is accurate, and leave
        // the page where the admin was working.
        await prepareSnapshot(snapshot)
        setApplyResult(result)
        setError(result.errors[0])
        return
      }

      // Clean success: the reconciliation is finished, so it stops being the
      // active workflow. Previously this re-ran prepareSnapshot on the SAME
      // snapshot, which rebuilt the completed preview as though it were still
      // live and left the admin scrolled at the bottom of it.
      rememberAppliedPreviewJob(appliedJobId)
      resetToReadyState()
      setApplyResult(result)
      scrollWorkspaceToTop()
    } catch {
      setError('Microsoft reconciliation apply stopped unexpectedly. Check sync history before retrying.')
    } finally {
      setApplying(false)
    }
  }

  async function changeTransitionStatus(status: MicrosoftTransitionStatus) {
    const statusError = await updateMicrosoftTransitionStatus(status)
    if (statusError) { setError(statusError); return }
    setTransitionStatus(status)
    setReviewed(false)
    await loadStatus()
  }

  async function selectRun(runId: string) {
    setSelectedRunId(runId)
    setRunItems([])
    const result = await loadMicrosoftSyncRunItems(runId)
    if (result.error) { setError(result.error); return }
    setRunItems(result.data)
  }

  async function prepareRunRecovery(runId: string) {
    if (loading || applying) return
    setLoading(true)
    setError(null)
    const context = await loadMicrosoftRecoveryContext(runId)
    if (!context.data) {
      setLoading(false)
      setError(context.error ?? 'The reviewed run could not be recovered.')
      return
    }
    const resolved = await prepareSnapshot(context.data.snapshot, false)
    if (!resolved) return
    const plan = buildMicrosoftRecoveryPlan(
      context.data.sourceRun.reviewedItems,
      resolved,
      context.data.auditItems,
    )
    setRecovery({ sourceRun: context.data.sourceRun, previewJobId: context.data.previewJobId, plan })
    setActionFilter('complete')
    setLoading(false)
  }

  async function retryRecovered() {
    if (!snapshot || !recovery || applying || recovery.plan.retryItems.length === 0) return
    const currentState = await loadMicrosoftSyncState()
    if (currentState.error || currentState.migrationNeeded || currentState.transitionStatus !== 'active') {
      setError(currentState.error ?? 'Microsoft transition sync is not active. Recovery was not applied.')
      return
    }
    setApplying(true)
    setError(null)
    setProgress({ completed: 0, total: recovery.plan.retryItems.length })
    try {
      const approveRecoveredRemovals = recovery.plan.retryItems.some(item => item.requiresRemovalApproval)
      const result = await applyMicrosoftReconciliation(
        recovery.plan.retryItems,
        snapshot,
        approveRecoveredRemovals,
        (completed, total) => setProgress({ completed, total }),
        {
          previewJobId: recovery.previewJobId,
          retryOfRunId: recovery.sourceRun.id,
          reviewedItems: getMicrosoftReviewedItems(recovery.plan.retryItems, approveRecoveredRemovals),
          previouslyApplied: recovery.plan.previouslyApplied.length,
          conflictsUntouched: recovery.sourceRun.summary.conflict ?? recovery.sourceRun.summary.conflictsUntouched ?? 0,
        },
      )
      await loadStatus()
      await prepareSnapshot(snapshot)
      setApplyResult(result)
      if (result.errors.length > 0) setError(result.errors[0])
    } catch {
      setError('Microsoft recovery stopped unexpectedly. Applied item history was retained; inspect the run before retrying.')
    } finally {
      setApplying(false)
    }
  }

  const actionCounts = useMemo(() => new Map(ACTIONS.map(action => [action.value, summary[action.value]])), [summary])
  const canApply = Boolean(snapshot) && !recovery && transitionStatus === 'active' && reviewed && !migrationNeeded && !applying && applicableCount > 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Temporary one-way coexistence bridge</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Microsoft Sync</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-primary/70 sm:text-base">Preview and reconcile Outlook, Planner and active Client Socials into CG Dynamics. Microsoft is read-only; every destination change remains reviewable and auditable.</p></div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Transition mode</p><select value={transitionStatus} onChange={event => void changeTransitionStatus(event.target.value as MicrosoftTransitionStatus)} className="mt-2 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm font-black text-white"><option value="active">Active</option><option value="paused">Paused</option><option value="complete">Complete</option></select></div>
        </div>
      </header>

      <section className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/80">Transition status · beta</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-50/90">
          Microsoft transition reconciliation is available for reviewed preview and apply. Final live package
          parity verification is still pending. Do not retire Microsoft Planner until the full dated reconciliation
          has been reviewed.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Connection</p><h2 className="mt-1 text-xl font-black text-white">{connection?.connected ? 'Microsoft available' : 'Microsoft setup required'}</h2><p className="mt-1 text-sm text-white/50">{connection?.message ?? connectionError ?? 'Checking server-side connection...'}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${connection?.connected ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{connection?.connected ? 'Connected' : 'Unavailable'}</span></div>
          {connection?.sources && connection.sources.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{connection.sources.map(source => <span key={`${source.type}:${source.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65">{source.name}</span>)}</div>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Last successful sync</p><p className="mt-2 text-xl font-black text-white">{lastSuccess ? new Date(lastSuccess.finishedAt ?? lastSuccess.createdAt).toLocaleString('en-ZA') : 'Not run yet'}</p><p className="mt-1 text-xs text-white/45">{lastSuccess ? `${lastSuccess.summary.create ?? 0} created · ${lastSuccess.summary.update ?? 0} updated` : 'A reviewed run will appear here.'}</p></div>
      </section>

      {/* Apply confirmation. Sits directly ABOVE the fetch panel so that after a
          successful apply scrolls the page to the top, the admin reads the
          result and then immediately sees the next action. Shown once, and
          dismissable. */}
      {applyResult && (
        <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-4" role="status" aria-live="polite" data-testid="apply-confirmation">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200/80">
                {applyResult.failed > 0 ? 'Reconciliation applied with failures' : 'Reconciliation applied'}
              </p>
              <p className="mt-2 font-black text-white">
                Run {applyResult.runId ?? 'not created'}: {applyResult.applied} applied now · {applyResult.previouslyApplied} previously applied · {applyResult.failed} still failed · {applyResult.conflictsUntouched} conflicts untouched.
              </p>
              <p className="mt-1 text-xs text-white/50">CG Dynamics only. No Microsoft writes were made.</p>
              <p className="mt-1 text-xs text-white/45">
                This run is kept under <span className="font-bold text-white/70">Recent reconciliation runs</span> below. Fetch again when you are ready — nothing starts on its own.
              </p>
            </div>
            <button type="button" onClick={() => setApplyResult(null)} className="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white">Dismiss</button>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Preview latest changes</p>{workspaceReady && <span data-testid="ready-to-sync" className="rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-teal">Ready to sync</span>}</div><h2 className="mt-1 text-xl font-black text-white">Fetch complete configured sources</h2><p className="mt-1 text-sm text-white/45">Newly completed operational tasks are not imported (they are automatically skipped). Existing linked tasks can still complete. Client Socials items are never skipped.</p></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-white/45">Outlook from<input type="date" value={rangeStart} onChange={event => setRangeStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" /></label><label className="text-xs text-white/45">Outlook to<input type="date" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" /></label><button type="button" onClick={() => void previewLatest()} disabled={!connection?.connected || transitionStatus !== 'active' || loading} className="self-end rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-black text-black disabled:opacity-35">{loading ? 'Fetching...' : 'Preview latest changes'}</button></div></div>
        <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="mt-4 text-xs font-bold text-white/40 hover:text-white/70">{advancedOpen ? 'Hide' : 'Show'} connected-agent snapshot transport</button>
        {advancedOpen && <div className="mt-3 rounded-xl border border-dashed border-white/10 p-4"><p className="text-xs leading-relaxed text-white/45">For an authorised connected agent or recovery only. Version 3 snapshots include assignee identity metadata for staff assignment resolution. Version 2 and legacy snapshots are also accepted.</p><button type="button" disabled={transitionStatus !== 'active'} onClick={() => fileInputRef.current?.click()} className="mt-3 rounded-lg border border-white/10 px-4 py-2 text-xs font-black text-white disabled:opacity-35">Choose normalized snapshot</button><input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => { void onSnapshotFile(event.target.files); event.target.value = '' }} /></div>}
        {parseErrors.length > 0 && <div className="mt-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs text-red-100">{parseErrors.join(' ')}</div>}
      </section>

      {job && (
        <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Preview job</p>
              <h2 className="mt-1 text-lg font-black text-white">
                {job.progress.complete}/{job.progress.total} sources complete
                {job.progress.detailsRemaining > 0 ? ` · ${job.progress.detailsRemaining} task details remaining` : ''}
              </h2>
              <p className="mt-1 text-xs text-white/45">{loading ? 'Fetching sources in batches — safe to leave this page and return.' : job.progress.allRequiredComplete ? 'All required sources complete.' : job.progress.anyFailed ? 'Some sources failed.' : 'Paused.'}</p>
            </div>
            <div className="flex gap-2">
              {!loading && job.progress.anyFailed && <button type="button" onClick={() => void retryFailedSources()} className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200">Retry failed sources</button>}
              {!loading && job.status === 'running' && !job.progress.allRequiredComplete && !job.progress.anyFailed && <button type="button" onClick={() => void driveJob(job.jobId)} className="rounded-lg border border-brand-teal/40 bg-brand-teal/10 px-4 py-2 text-xs font-black text-brand-teal">Resume</button>}
            </div>
          </div>
          <div className="mt-4 space-y-1.5">
            {job.sources.map(source => {
              const tone = source.stage === 'complete' ? 'border-brand-teal/30 bg-brand-teal/[0.06]' : source.stage === 'failed' ? 'border-red-400/30 bg-red-400/[0.06]' : source.stage === 'queued' ? 'border-white/10 bg-white/[0.02]' : 'border-sky-300/30 bg-sky-300/[0.06]'
              return (
                <div key={source.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${tone}`}>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{source.sourceName}</p><p className="text-[11px] text-white/45">{source.sourceType === 'planner_plan' ? 'Planner plan' : 'Outlook calendar'}{source.required ? ' · required' : ''}</p></div>
                  <div className="flex items-center gap-3 text-right">
                    {source.recordCount > 0 && <span className="text-[11px] text-white/55">{source.recordCount} records</span>}
                    {source.detailsRemaining > 0 && <span className="text-[11px] text-sky-200/80">{source.detailsRemaining} details left</span>}
                    {source.safeError && <span className="max-w-[16rem] truncate text-[11px] text-amber-200/80" title={source.safeError}>{source.safeError}</span>}
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${source.stage === 'complete' ? 'border-brand-teal/40 text-brand-teal' : source.stage === 'failed' ? 'border-red-400/40 text-red-300' : source.stage === 'queued' ? 'border-white/20 text-white/50' : 'border-sky-300/40 text-sky-200'}`}>{source.stage.replace('_', ' ')}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
      {migrationNeeded && <section className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5"><h2 className="text-lg font-black text-white">Phase 17a review is required</h2><p className="mt-2 text-sm text-white/60">Preview is available after the transition-sync schema is reviewed and applied. Apply remains blocked; no migration is run from this page.</p></section>}
      {error && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</div>}

      {recovery && (
        <section className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/75">Recovered reviewed snapshot</p>
          <h2 className="mt-2 text-xl font-black text-white">Retry only unapplied reviewed changes</h2>
          <p className="mt-2 text-sm text-white/65">The preserved preview was restored without fetching Microsoft again. Prior approvals remain valid for these exact source identities.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-white/40">Previously applied</p><p className="mt-1 text-xl font-black text-emerald-200">{recovery.plan.previouslyApplied.length}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-white/40">Failed</p><p className="mt-1 text-xl font-black text-red-200">{recovery.plan.failedBeforeRetry}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-white/40">Not attempted</p><p className="mt-1 text-xl font-black text-amber-100">{recovery.plan.notAttemptedBeforeRetry}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-white/40">Retryable now</p><p className="mt-1 text-xl font-black text-brand-teal">{recovery.plan.retryItems.length}</p></div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3"><p className="text-[10px] uppercase text-white/40">Conflicts untouched</p><p className="mt-1 text-xl font-black text-white">{recovery.sourceRun.summary.conflict ?? recovery.sourceRun.summary.conflictsUntouched ?? 0}</p></div>
          </div>
          {recovery.plan.retryItems.length > 0 && <div className="mt-4 space-y-2">{recovery.plan.retryItems.map(item => <div key={`${item.sourceType}:${item.sourceTaskId ?? item.sourceEventId}`} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2"><p className="text-sm font-bold text-white">{item.title}</p><p className="text-xs text-white/45">{item.mappedClientName ?? item.sourceName} · {item.destination} · {item.reconciliationAction}</p></div>)}</div>}
          {recovery.plan.blocked.length > 0 && <div className="mt-4 rounded-lg border border-red-300/20 bg-red-300/[0.05] p-3"><p className="text-xs font-black uppercase text-red-200">Still blocked ({recovery.plan.blocked.length})</p>{recovery.plan.blocked.map(item => <p key={item.reviewed.key} className="mt-1 text-xs text-red-100/75">{item.reviewed.title}: {item.reason}</p>)}</div>}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-white/45">No new approval checkbox is required; these are the original reviewed actions only.</p><button type="button" disabled={applying || recovery.plan.retryItems.length === 0} onClick={() => void retryRecovered()} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black disabled:opacity-35">{applying ? 'Retrying...' : `Retry failed changes (${recovery.plan.retryItems.length})`}</button></div>
        </section>
      )}

      {snapshot && <section className="mt-6"><div className="mb-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Source completeness</p><h2 className="mt-1 text-xl font-black text-white">{snapshot.records.length} records · {new Date(snapshot.exportedAt).toLocaleString('en-ZA')}</h2><p className="mt-1 text-xs text-white/45">Newly completed operational tasks (Planner status "done") are automatically skipped — they represent finished history. Existing linked tasks can still complete. Client Socials items are never skipped and map 100% to "scheduled" in the Client Schedule.</p></div><SourceCompleteness snapshot={snapshot} /></section>}

      {selectedRun?.status === 'applying' && (
        <section className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-4">
          <p className="text-sm font-black text-white">This apply run did not finish.</p>
          <p className="mt-1 text-xs text-white/55">Reviewed identities and completed audit rows are preserved. Recovery will retry only actions with no successful audit result.</p>
          <button type="button" disabled={loading || applying} onClick={() => void prepareRunRecovery(selectedRun.id)} className="mt-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200 disabled:opacity-35">Prepare interrupted-run recovery</button>
        </section>
      )}

      {items.length > 0 && <>
        <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">{ACTIONS.map(action => <button key={action.value} type="button" onClick={() => { setSourceFilter('all'); setActionFilter(action.value); setStatusFilter('all'); setConflictFilter('all') }} className={`rounded-xl border p-3 text-left ${actionFilter === action.value ? 'border-brand-teal/50 bg-brand-teal/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}><p className="text-[9px] font-black uppercase text-white/40">{action.label}</p><p className="mt-1 text-2xl font-black text-white">{actionCounts.get(action.value) ?? 0}</p></button>)}</section>

        <section className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Incoming create status</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(['to_do', 'in_progress', 'completed', 'scheduled', 'planned', 'cancelled'] as MicrosoftIncomingStatus[]).filter(status => createStatusCounts[status] > 0).map(status => <button key={status} type="button" onClick={() => { setSourceFilter('all'); setActionFilter('create'); setStatusFilter(status); setConflictFilter('all') }} className="rounded-xl border border-white/10 bg-black/20 p-3 text-left"><p className="text-[10px] font-bold text-white/45">Create as {microsoftIncomingStatusLabel(status)}</p><p className="mt-1 text-xl font-black text-white">{createStatusCounts[status]}</p></button>)}
            </div>
            <p className="mt-3 text-xs text-white/45">Newly done operational skipped: <span className="font-black text-white">{completedOperationalSkipped}</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-white/35">Conflict breakdown by source and type</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{conflictBreakdown.map(entry => <button key={`${entry.source}:${entry.code}`} type="button" onClick={() => { setSourceFilter(entry.source); setActionFilter('conflict'); setStatusFilter('all'); setConflictFilter(entry.code) }} className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left"><span className="min-w-0 truncate text-xs text-white/65">{entry.source} · {entry.code.replaceAll('_', ' ')}</span><span className="text-sm font-black text-red-200">{entry.count}</span></button>)}</div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-white/45">Source<select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"><option value="all">All sources</option>{sourceOptions.map(source => <option key={source} value={source}>{source}</option>)}</select></label>
            <label className="text-xs text-white/45">Action<select value={actionFilter} onChange={event => { const action = event.target.value as MicrosoftReconciliationAction | 'all'; setActionFilter(action); if (action !== 'conflict') setConflictFilter('all') }} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"><option value="all">All actions</option>{ACTIONS.map(action => <option key={action.value} value={action.value}>{action.label}</option>)}</select></label>
            <label className="text-xs text-white/45">Incoming status<select value={statusFilter} onChange={event => setStatusFilter(event.target.value as MicrosoftIncomingStatus | 'all')} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"><option value="all">All statuses</option>{statusOptions.map(status => <option key={status} value={status}>{microsoftIncomingStatusLabel(status)}</option>)}</select></label>
            <label className="text-xs text-white/45">Conflict type<select value={conflictFilter} onChange={event => setConflictFilter(event.target.value as MicrosoftConflictCode | 'uncoded' | 'all')} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"><option value="all">All conflict types</option>{conflictOptions.map(code => <option key={code} value={code}>{code.replaceAll('_', ' ')}</option>)}</select></label>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-white/40">Showing {visibleItems.length} of {items.length} records</p><button type="button" onClick={() => { setSourceFilter('all'); setActionFilter('all'); setStatusFilter('all'); setConflictFilter('all') }} className="text-xs font-black text-brand-teal">Clear filters</button></div>
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleItems.map((item, index) => <PreviewItem key={itemKey(item, index)} item={item} />)}</section>
        {visibleItems.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/35">No items match these filters.</p>}
        {!recovery && <section className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5"><div className="space-y-3"><label className="flex items-start gap-3 text-sm text-white/65"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1 accent-teal-400" />I reviewed the reconciliation preview and approve the safe Microsoft-owned field changes.</label>{removalCount > 0 && <label className="flex items-start gap-3 text-sm text-orange-100/80"><input type="checkbox" checked={approveRemovals} onChange={event => setApproveRemovals(event.target.checked)} className="mt-1 accent-orange-400" />Approve {removalCount} source-removal actions from complete successful source fetches. Records are archived or cancelled, never hard-deleted.</label>}</div>{applying && <div className="mt-4"><p className="mb-3 rounded-lg border border-brand-teal/20 bg-brand-teal/[0.06] px-3 py-2 text-xs text-brand-teal">Only the reviewed executable actions are processed. Per-item audit history is retained if this tab closes.</p><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-teal" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} /></div><p className="mt-2 text-xs text-white/45">{progress.completed} of {progress.total}</p></div>}<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white/40">{summary.conflict} conflicts will not be applied. CG-only notes and workflow fields remain untouched.</p><button type="button" disabled={!canApply} onClick={() => void applyReviewed()} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black disabled:opacity-35">{applying ? 'Applying...' : `Apply reviewed changes (${applicableCount})`}</button></div></section>}
      </>}

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Sync history</p><h2 className="mb-4 mt-1 text-xl font-black text-white">Recent reconciliation runs</h2><RunHistory runs={runs} onSelect={runId => void selectRun(runId)} />{selectedRunId && <div className="mt-5 border-t border-white/10 pt-4">{selectedRun && (selectedRun.status === 'failed' || selectedRun.status === 'partial') && <div className="mb-4 rounded-xl border border-red-300/20 bg-red-300/[0.05] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-red-200">{failedRunItems.length} failed reviewed actions</p><p className="mt-1 text-sm text-red-100/80">{selectedRun.safeError ?? 'Inspect the failed items below.'}</p></div><button type="button" disabled={loading || applying} onClick={() => void prepareRunRecovery(selectedRun.id)} className="rounded-lg border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-black text-amber-200 disabled:opacity-35">Prepare failed-change recovery</button></div></div>}<p className="mb-3 text-xs font-black uppercase tracking-wider text-white/40">Applied, failed and not-attempted results</p><div className="max-h-96 space-y-2 overflow-y-auto">{meaningfulRunItems.map(item => <article key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">{item.details.title ?? 'Microsoft item'}</p><p className="mt-1 text-xs text-white/40">{item.sourceName} · {item.destination}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${ACTION_TONES[item.action]}`}>{item.action} · {item.resultStatus === 'previewed' ? 'not attempted' : item.resultStatus}</span></div>{item.safeError && <p className="mt-2 text-xs text-red-200">{item.safeError}</p>}</article>)}{meaningfulRunItems.length === 0 && <p className="text-sm text-white/35">No applied, failed or not-attempted items are available for this run.</p>}</div><p className="mt-3 text-xs text-white/35">{runItems.length - meaningfulRunItems.length} unchanged, skipped or conflict items remain untouched.</p></div>}</section>
    </div>
  )
}
