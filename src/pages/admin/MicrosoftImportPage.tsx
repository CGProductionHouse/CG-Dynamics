import { useRef, useState } from 'react'
import {
  summarizeMicrosoftPreview,
  type MicrosoftImportPreviewItem,
  type MicrosoftPreviewStatus,
} from '../../lib/microsoftImport'
import {
  buildMicrosoftImportPreview,
  classifyMicrosoftPreviewAgainstExisting,
  flagDeliverableSlotConflicts,
} from '../../lib/microsoftImportPreview'
import {
  applyMicrosoftImport,
  loadMicrosoftExistingTargets,
  loadMicrosoftMappingContext,
  type MicrosoftApplyResult,
} from '../../lib/microsoftImportData'
import { parseMicrosoftSnapshot, type MicrosoftSnapshot } from '../../lib/microsoftSnapshot'

// ── Microsoft 365 Import (Option A: operator-assisted, once-off) ─────────────
//
// The deployed app never talks to Microsoft. An operator with delegated Graph
// access exports a normalized JSON snapshot (docs/microsoft-365-import-map.md
// documents the exact shape); an admin uploads it here. Preview runs entirely
// in the browser against live Supabase mapping data, conflicts stay conflicts,
// and Apply inserts only `new` rows — never updates, never deletes, and never
// writes anything back to Microsoft.

const STATUS_OPTIONS: Array<{ value: MicrosoftPreviewStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
  { value: 'changed', label: 'Changed' },
  { value: 'conflict', label: 'Conflicts' },
  { value: 'skipped', label: 'Skipped' },
]

const STATUS_TONES: Record<MicrosoftPreviewStatus, string> = {
  new: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
  existing: 'border-white/15 bg-white/[0.05] text-white/65',
  changed: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
  conflict: 'border-red-300/25 bg-red-300/10 text-red-200',
  skipped: 'border-slate-300/15 bg-slate-300/[0.05] text-slate-300/70',
}

function sourceKey(item: MicrosoftImportPreviewItem) {
  if (item.sourceEventId) return `${item.sourceCalendarId}:${item.sourceEventId}`
  if (item.sourceTaskId) return `${item.sourcePlanId}:${item.sourceTaskId}`
  return `${item.sourceName}:${item.title}`
}

function destinationLabel(destination: MicrosoftImportPreviewItem['destination']) {
  if (destination === 'cg_calendar') return 'CG Calendar'
  if (destination === 'client_schedule') return 'Client Schedule'
  if (destination === 'planner') return 'Planner'
  return 'Review required'
}

function displayDate(item: MicrosoftImportPreviewItem) {
  return item.dueDate ?? item.startDate ?? 'No date'
}

function PreviewCard({ item }: { item: MicrosoftImportPreviewItem }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-teal/80">{item.sourceName}</p>
          <h3 className="mt-1 break-words text-base font-black text-white">{item.title || 'Untitled Microsoft item'}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${STATUS_TONES[item.previewStatus]}`}>
          {item.previewStatus}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="font-bold uppercase tracking-[0.1em] text-white/35">Destination</dt>
          <dd className="mt-1 font-bold text-white/80">{destinationLabel(item.destination)}</dd>
        </div>
        <div>
          <dt className="font-bold uppercase tracking-[0.1em] text-white/35">Date</dt>
          <dd className="mt-1 font-bold text-white/80">{displayDate(item)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="font-bold uppercase tracking-[0.1em] text-white/35">Mapped client</dt>
          <dd className="mt-1 font-bold text-white/80">{item.mappedClientName ?? 'Not linked'}</dd>
        </div>
      </dl>

      {item.conflictReason && (
        <p className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-xs leading-relaxed text-red-100">
          {item.conflictReason}
        </p>
      )}
      {item.warnings.map(warning => <p key={warning} className="mt-3 text-xs leading-relaxed text-amber-100/75">{warning}</p>)}
    </article>
  )
}

interface PreviewState {
  items: MicrosoftImportPreviewItem[]
  migrationNeeded: boolean
}

export default function MicrosoftImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [snapshot, setSnapshot] = useState<MicrosoftSnapshot | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeStatus, setActiveStatus] = useState<MicrosoftPreviewStatus>('new')
  const [reviewed, setReviewed] = useState(false)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<MicrosoftApplyResult | null>(null)

  const items = preview?.items ?? []
  const summary = summarizeMicrosoftPreview(items)
  const visibleItems = items.filter(item => item.previewStatus === activeStatus)
  const unresolvedClients = items.filter(item => item.conflictCode === 'unresolved_client' || item.conflictCode === 'ambiguous_client_match')

  async function buildPreview(records: MicrosoftSnapshot['records']) {
    setLoading(true)
    setError(null)
    setPreview(null)
    setApplyResult(null)
    setReviewed(false)
    try {
      const [contextResult, existingResult] = await Promise.all([
        loadMicrosoftMappingContext(),
        loadMicrosoftExistingTargets(),
      ])
      if (contextResult.error || !contextResult.context) {
        setError(`Could not load CG Dynamics mapping data: ${contextResult.error ?? 'unknown error'}`)
        return
      }
      if (existingResult.error) {
        setError(`Could not load existing import targets: ${existingResult.error}`)
        return
      }
      const mapped = buildMicrosoftImportPreview(records, contextResult.context)
      const classified = classifyMicrosoftPreviewAgainstExisting(mapped, existingResult.targets)
      const guarded = flagDeliverableSlotConflicts(classified, existingResult.deliverableSlotKeys)
      setPreview({ items: guarded, migrationNeeded: existingResult.migrationNeeded })
      const firstPopulated = STATUS_OPTIONS.find(option => summarizeMicrosoftPreview(guarded)[option.value] > 0)
      setActiveStatus(firstPopulated?.value ?? 'new')
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Preview failed.')
    } finally {
      setLoading(false)
    }
  }

  async function onFileChange(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    setFileName(file.name)
    setSnapshot(null)
    setPreview(null)
    setApplyResult(null)
    setParseErrors([])
    setError(null)
    const text = await file.text()
    const parsed = parseMicrosoftSnapshot(text)
    if (!parsed.snapshot) {
      setParseErrors(parsed.errors)
      return
    }
    setSnapshot(parsed.snapshot)
    await buildPreview(parsed.snapshot.records)
  }

  async function runApply() {
    if (!snapshot || !preview || applying) return
    setApplying(true)
    setError(null)
    try {
      const result = await applyMicrosoftImport(preview.items, snapshot.exportedAt)
      setApplyResult(result)
      // Re-preview so applied rows now show as `existing`.
      await buildPreview(snapshot.records)
      setApplyResult(result)
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Apply failed.')
    } finally {
      setApplying(false)
    }
  }

  const canApply = Boolean(snapshot) && !loading && !applying && summary.new > 0 && preview !== null && !preview.migrationNeeded

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Once-off migration - preview first</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Microsoft 365 Import</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/75 sm:text-base">
          Upload a Microsoft snapshot file exported by the operator. Every record is previewed and classified before
          anything is written. Only new records are inserted - nothing is updated, deleted, or written back to Microsoft.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-100">
          One-way import: Microsoft is never modified
        </div>
      </header>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Step 1</p>
            <h2 className="mt-1 text-lg font-black text-white">Upload the snapshot file</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              JSON produced from Microsoft Graph by the operator - see docs/microsoft-365-import-map.md for the exact format.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black transition-opacity disabled:opacity-55"
            disabled={loading || applying}
          >
            {fileName ? 'Choose another file' : 'Choose snapshot file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={event => { void onFileChange(event.target.files); event.target.value = '' }}
          />
        </div>
        {fileName && (
          <p className="mt-3 text-xs font-bold text-white/60">
            {fileName}
            {snapshot && (
              <span className="ml-2 font-semibold text-white/40">
                {snapshot.records.length} records · exported {new Date(snapshot.exportedAt).toLocaleString('en-ZA')} · {snapshot.exportedBy}
              </span>
            )}
          </p>
        )}
        {parseErrors.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.07] p-4">
            <p className="text-sm font-black text-red-100">The file was rejected - nothing was previewed or written.</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-100/85">
              {parseErrors.slice(0, 30).map(problem => <li key={problem}>{problem}</li>)}
              {parseErrors.length > 30 && <li>...and {parseErrors.length - 30} more.</li>}
            </ul>
          </div>
        )}
      </section>

      {loading && <p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-6 text-sm text-white/55">Building preview against live CG Dynamics data...</p>}
      {error && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-sm leading-relaxed text-red-100">{error}</div>}

      {preview?.migrationNeeded && (
        <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Migration required</p>
          <h2 className="mt-2 text-xl font-black text-white">Apply is blocked until phase-15a is applied</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
            The Microsoft source-tracking columns (supabase/phase-15a-microsoft-source-tracking.sql) are not present in the
            database yet, so imported rows could not be deduplicated on re-runs. Preview still works; Apply stays disabled.
          </p>
        </section>
      )}

      {applyResult && (
        <section className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">Apply result</p>
          <p className="mt-2 text-sm font-bold text-white">
            Inserted {applyResult.plannerInserted} Planner tasks, {applyResult.deliverablesInserted} Client Schedule deliverables,
            {' '}{applyResult.eventsInserted} CG Calendar events. {applyResult.skippedNotNew} records were not new and were left untouched.
          </p>
          {applyResult.errors.map(message => (
            <p key={message} className="mt-2 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-3 py-2 text-xs text-red-100">{message}</p>
          ))}
        </section>
      )}

      {preview && !loading && (
        <>
          <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase text-white/35">Total</p><p className="mt-1 text-2xl font-black text-white">{summary.total}</p></div>
            {STATUS_OPTIONS.map(option => <div key={option.value} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase text-white/35">{option.label}</p><p className="mt-1 text-2xl font-black text-white">{summary[option.value]}</p></div>)}
          </section>

          {unresolvedClients.length > 0 && (
            <section className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/[0.055] p-4 sm:p-5">
              <h2 className="text-lg font-black text-white">Unresolved client mapping</h2>
              <p className="mt-1 text-sm text-white/55">No client ID is ever guessed. These stay conflicts until the client names match exactly or an admin resolves them manually.</p>
              <div className="mt-3 flex flex-wrap gap-2">{unresolvedClients.map(item => <span key={sourceKey(item)} className="rounded-full border border-red-200/15 bg-black/20 px-3 py-1.5 text-xs font-bold text-red-100">{item.title}</span>)}</div>
            </section>
          )}

          <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
            {STATUS_OPTIONS.map(option => (
              <button key={option.value} type="button" onClick={() => setActiveStatus(option.value)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black ${activeStatus === option.value ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45'}`}>
                {option.label} {summary[option.value]}
              </button>
            ))}
          </div>

          <section className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map(item => <PreviewCard key={`${item.destination}:${sourceKey(item)}`} item={item} />)}
          </section>
          {visibleItems.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/40">No {activeStatus} items in this preview.</p>}

          <footer className="mt-8 flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
            <label className="flex items-start gap-3 text-xs leading-relaxed text-white/60">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={event => setReviewed(event.target.checked)}
                disabled={!canApply}
                className="mt-0.5 h-4 w-4 accent-teal-400"
              />
              I reviewed the preview. Apply inserts only the {summary.new} new records; existing, changed, conflict and
              skipped records are left untouched.
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-white/45">
                Changed rows are never auto-overwritten - newer CG Dynamics edits always win until resolved manually.
              </p>
              <button
                type="button"
                onClick={() => void runApply()}
                disabled={!canApply || !reviewed}
                className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              >
                {applying ? 'Applying...' : `Apply ${summary.new} new records`}
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  )
}
