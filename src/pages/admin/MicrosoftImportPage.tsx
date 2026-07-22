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
  fetchLatestMicrosoftSnapshot,
  getMicrosoftConnectionStatus,
  loadMicrosoftExistingTargets,
  loadMicrosoftMappingContext,
  loadMicrosoftProfiles,
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
  { value: 'create', label: 'Create' }, { value: 'update', label: 'Update' },
  { value: 'complete', label: 'Complete' }, { value: 'reopen', label: 'Reopen' },
  { value: 'move', label: 'Moved' }, { value: 'cancel', label: 'Cancelled' },
  { value: 'archive', label: 'Source removed' }, { value: 'unchanged', label: 'Unchanged' },
  { value: 'conflict', label: 'Conflicts' }, { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
]

const ACTION_TONES: Record<MicrosoftReconciliationAction, string> = {
  create: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
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
      <div><p className="text-sm font-black text-white">{new Date(run.createdAt).toLocaleString('en-ZA')} · {run.triggerType}</p><p className="mt-1 text-xs text-white/45">Source {new Date(run.snapshotExportedAt).toLocaleString('en-ZA')} · {run.sourceCompleteness.filter(source => source.complete).length}/{run.sourceCompleteness.length} complete</p></div>
      <div className="text-left sm:text-right"><p className="text-xs font-black uppercase text-brand-teal">{run.status}</p><p className="mt-1 text-xs text-white/45">{run.summary.create ?? 0} create · {run.summary.update ?? 0} update · {run.summary.conflict ?? 0} conflict</p></div>
    </button>
  ))}</div>
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

  const summary = summarizeMicrosoftReconciliation(items)
  const visibleItems = filterMicrosoftPreviewItems(items, { source: sourceFilter, action: actionFilter, status: statusFilter, conflict: conflictFilter })
  const sourceOptions = [...new Set(items.map(item => item.sourceName))].sort()
  const statusOptions = [...new Set(items.map(microsoftIncomingStatus))].sort()
  const conflictOptions = [...new Set(items.filter(item => item.reconciliationAction === 'conflict').map(item => item.conflictCode ?? 'uncoded'))].sort()
  const conflictBreakdown = buildMicrosoftConflictBreakdown(items)
  const createStatusCounts = summarizeMicrosoftCreateStatuses(items)
  const completedOperationalSkipped = items.filter(item => item.skipCode === 'completed_operational_not_imported' && item.reconciliationAction === 'skipped').length
  const removalCount = items.filter(item => item.requiresRemovalApproval).length
  const lastSuccess = runs.find(run => run.status === 'completed')
  const writableCount = summary.create + summary.update + summary.complete + summary.reopen + summary.move + summary.cancel + summary.archive
  const applicableCount = writableCount - (approveRemovals ? 0 : removalCount)

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

  async function prepareSnapshot(nextSnapshot: MicrosoftSnapshot) {
    setLoading(true)
    setError(null)
    setItems([])
    setReviewed(false)
    setApproveRemovals(false)
    setApplyResult(null)
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
      )
      setSnapshot(nextSnapshot)
      setItems(resolved)
      const first = ACTIONS.find(option => resolved.some(item => item.reconciliationAction === option.value))
      setSourceFilter('all')
      setActionFilter(first?.value ?? 'all')
      setStatusFilter('all')
      setConflictFilter('all')
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Reconciliation preview failed.')
    } finally {
      setLoading(false)
    }
  }

  async function previewLatest() {
    if (loading || transitionStatus !== 'active') return
    setLoading(true)
    setError(null)
    const fetched = await fetchLatestMicrosoftSnapshot(`${rangeStart}T00:00:00+02:00`, `${rangeEnd}T00:00:00+02:00`)
    setLoading(false)
    if (!fetched.snapshot) { setError(fetched.error ?? 'Microsoft fetch failed.'); return }
    await prepareSnapshot(fetched.snapshot)
  }

  async function onSnapshotFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setParseErrors([])
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
    setProgress({ completed: 0, total: items.length })
    try {
      const result = await applyMicrosoftReconciliation(items, snapshot, approveRemovals, (completed, total) => setProgress({ completed, total }))
      setApplyResult(result)
      await loadStatus()
      if (result.errors.length > 0) setError(result.errors[0])
      else {
        await prepareSnapshot(snapshot)
        setApplyResult(result)
      }
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
    const result = await loadMicrosoftSyncRunItems(runId)
    if (result.error) { setError(result.error); return }
    setRunItems(result.data)
  }

  const actionCounts = useMemo(() => new Map(ACTIONS.map(action => [action.value, summary[action.value]])), [summary])
  const canApply = Boolean(snapshot) && transitionStatus === 'active' && reviewed && !migrationNeeded && !applying && applicableCount > 0

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Temporary one-way coexistence bridge</p><h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Microsoft Sync</h1><p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-primary/70 sm:text-base">Preview and reconcile Outlook, Planner and active Client Socials into CG Dynamics. Microsoft is read-only; every destination change remains reviewable and auditable.</p></div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Transition mode</p><select value={transitionStatus} onChange={event => void changeTransitionStatus(event.target.value as MicrosoftTransitionStatus)} className="mt-2 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm font-black text-white"><option value="active">Active</option><option value="paused">Paused</option><option value="complete">Complete</option></select></div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Connection</p><h2 className="mt-1 text-xl font-black text-white">{connection?.connected ? 'Microsoft available' : 'Microsoft setup required'}</h2><p className="mt-1 text-sm text-white/50">{connection?.message ?? connectionError ?? 'Checking server-side connection...'}</p></div><span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${connection?.connected ? 'bg-emerald-300/10 text-emerald-200' : 'bg-amber-300/10 text-amber-100'}`}>{connection?.connected ? 'Connected' : 'Unavailable'}</span></div>
          {connection?.sources && connection.sources.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{connection.sources.map(source => <span key={`${source.type}:${source.id}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/65">{source.name}</span>)}</div>}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Last successful sync</p><p className="mt-2 text-xl font-black text-white">{lastSuccess ? new Date(lastSuccess.finishedAt ?? lastSuccess.createdAt).toLocaleString('en-ZA') : 'Not run yet'}</p><p className="mt-1 text-xs text-white/45">{lastSuccess ? `${lastSuccess.summary.create ?? 0} created · ${lastSuccess.summary.update ?? 0} updated` : 'A reviewed run will appear here.'}</p></div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Preview latest changes</p><h2 className="mt-1 text-xl font-black text-white">Fetch complete configured sources</h2><p className="mt-1 text-sm text-white/45">Newly completed operational tasks are not imported (they are automatically skipped). Existing linked tasks can still complete. Client Socials items are never skipped.</p></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs text-white/45">Outlook from<input type="date" value={rangeStart} onChange={event => setRangeStart(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" /></label><label className="text-xs text-white/45">Outlook to<input type="date" value={rangeEnd} onChange={event => setRangeEnd(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white" /></label><button type="button" onClick={() => void previewLatest()} disabled={!connection?.connected || transitionStatus !== 'active' || loading} className="self-end rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-black text-black disabled:opacity-35">{loading ? 'Fetching...' : 'Preview latest changes'}</button></div></div>
        <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="mt-4 text-xs font-bold text-white/40 hover:text-white/70">{advancedOpen ? 'Hide' : 'Show'} connected-agent snapshot transport</button>
        {advancedOpen && <div className="mt-3 rounded-xl border border-dashed border-white/10 p-4"><p className="text-xs leading-relaxed text-white/45">For an authorised connected agent or recovery only. Version 3 snapshots include assignee identity metadata for staff assignment resolution. Version 2 and legacy snapshots are also accepted.</p><button type="button" disabled={transitionStatus !== 'active'} onClick={() => fileInputRef.current?.click()} className="mt-3 rounded-lg border border-white/10 px-4 py-2 text-xs font-black text-white disabled:opacity-35">Choose normalized snapshot</button><input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={event => { void onSnapshotFile(event.target.files); event.target.value = '' }} /></div>}
        {parseErrors.length > 0 && <div className="mt-3 rounded-xl border border-red-300/20 bg-red-300/[0.06] p-3 text-xs text-red-100">{parseErrors.join(' ')}</div>}
      </section>

      {migrationNeeded && <section className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5"><h2 className="text-lg font-black text-white">Phase 17a review is required</h2><p className="mt-2 text-sm text-white/60">Preview is available after the transition-sync schema is reviewed and applied. Apply remains blocked; no migration is run from this page.</p></section>}
      {error && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</div>}
      {applyResult && <section className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4"><p className="font-black text-white">Run {applyResult.runId ?? 'not created'}: {applyResult.applied} applied, {applyResult.failed} failed.</p><p className="mt-1 text-xs text-white/50">No Microsoft writes were made.</p></section>}

      {snapshot && <section className="mt-6"><div className="mb-3"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Source completeness</p><h2 className="mt-1 text-xl font-black text-white">{snapshot.records.length} records · {new Date(snapshot.exportedAt).toLocaleString('en-ZA')}</h2><p className="mt-1 text-xs text-white/45">Newly completed operational tasks (Planner status "done") are automatically skipped — they represent finished history. Existing linked tasks can still complete. Client Socials items are never skipped and map 100% to "scheduled" in the Client Schedule.</p></div><SourceCompleteness snapshot={snapshot} /></section>}

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
        <section className="mt-7 rounded-2xl border border-white/10 bg-black/25 p-5"><div className="space-y-3"><label className="flex items-start gap-3 text-sm text-white/65"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} className="mt-1 accent-teal-400" />I reviewed the reconciliation preview and approve the safe Microsoft-owned field changes.</label>{removalCount > 0 && <label className="flex items-start gap-3 text-sm text-orange-100/80"><input type="checkbox" checked={approveRemovals} onChange={event => setApproveRemovals(event.target.checked)} className="mt-1 accent-orange-400" />Approve {removalCount} source-removal actions from complete successful source fetches. Records are archived or cancelled, never hard-deleted.</label>}</div>{applying && <div className="mt-4"><p className="mb-3 rounded-lg border border-brand-teal/20 bg-brand-teal/[0.06] px-3 py-2 text-xs text-brand-teal">Sync continues while this Microsoft Sync tab remains open. You may use CG Dynamics in another tab.</p><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-brand-teal" style={{ width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%` }} /></div><p className="mt-2 text-xs text-white/45">{progress.completed} of {progress.total}</p></div>}<div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-white/40">{summary.conflict} conflicts will not be applied. CG-only notes and workflow fields remain untouched.</p><button type="button" disabled={!canApply} onClick={() => void applyReviewed()} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black disabled:opacity-35">{applying ? 'Applying...' : `Apply reviewed changes (${applicableCount})`}</button></div></section>
      </>}

      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-white/35">Sync history</p><h2 className="mb-4 mt-1 text-xl font-black text-white">Recent reconciliation runs</h2><RunHistory runs={runs} onSelect={runId => void selectRun(runId)} />{selectedRunId && <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-3 text-xs font-black uppercase tracking-wider text-white/40">Per-item results</p><div className="max-h-96 space-y-2 overflow-y-auto">{runItems.map(item => <article key={item.id} className="rounded-lg border border-white/10 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-white">{item.details.title ?? 'Microsoft item'}</p><p className="mt-1 text-xs text-white/40">{item.sourceName} · {item.destination}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${ACTION_TONES[item.action]}`}>{item.action} · {item.resultStatus}</span></div>{item.safeError && <p className="mt-2 text-xs text-red-200">{item.safeError}</p>}</article>)}{runItems.length === 0 && <p className="text-sm text-white/35">No per-item results are available for this run.</p>}</div></div>}</section>
    </div>
  )
}
