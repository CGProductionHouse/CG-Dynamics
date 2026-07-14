import { useMemo, useState } from 'react'
import {
  requestMicrosoftImportPreview,
  summarizeMicrosoftPreview,
  type MicrosoftImportPreviewItem,
  type MicrosoftPreviewResponse,
  type MicrosoftPreviewSource,
  type MicrosoftPreviewStatus,
} from '../../lib/microsoftImport'

const SOURCE_OPTIONS: Array<{ id: MicrosoftPreviewSource; name: string; detail: string; destination: string }> = [
  { id: 'outlook-calendar', name: 'Outlook Calendar', detail: 'Operational events only', destination: 'CG Calendar' },
  { id: 'planner-to-do', name: 'Planner To Do', detail: 'General operations', destination: 'Planner' },
  { id: 'planner-master-client-to-do', name: 'MASTER CLIENT TO DO', detail: 'Client operations backlog', destination: 'Planner' },
  { id: 'planner-cg-socials', name: 'CG Socials', detail: 'Internal CG content', destination: 'Planner' },
  { id: 'planner-monthly-client-socials', name: 'Monthly Client Socials', detail: 'Client package cards', destination: 'Client Schedule' },
]

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

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
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

export default function MicrosoftImportPage() {
  const today = useMemo(() => new Date(), [])
  const [source, setSource] = useState<MicrosoftPreviewSource>('outlook-calendar')
  const [rangeStart, setRangeStart] = useState(() => localDateKey(addDays(today, -14)))
  const [rangeEnd, setRangeEnd] = useState(() => localDateKey(addDays(today, 30)))
  const [response, setResponse] = useState<MicrosoftPreviewResponse | null>(null)
  const [activeStatus, setActiveStatus] = useState<MicrosoftPreviewStatus>('new')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = response?.status === 'ready' ? response.items : []
  const summary = response?.status === 'ready' ? response.summary : summarizeMicrosoftPreview([])
  const visibleItems = items.filter(item => item.previewStatus === activeStatus)
  const unresolvedClients = items.filter(item => item.conflictCode === 'unresolved_client' || item.conflictCode === 'ambiguous_client_match')
  const rangeDays = Math.ceil((Date.parse(`${rangeEnd}T00:00:00`) - Date.parse(`${rangeStart}T00:00:00`)) / 86_400_000)

  async function runPreview() {
    setError(null)
    setResponse(null)
    if (!rangeStart || !rangeEnd || rangeDays < 0 || rangeDays > 93) {
      setError('Choose a valid date range of 93 days or fewer.')
      return
    }

    setLoading(true)
    try {
      const result = await requestMicrosoftImportPreview({ source, rangeStart, rangeEnd })
      setResponse(result)
      if (result.status === 'ready') {
        const firstPopulated = STATUS_OPTIONS.find(option => result.summary[option.value] > 0)
        setActiveStatus(firstPopulated?.value ?? 'new')
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Microsoft preview is unavailable.'
      setError(`${message} The Microsoft server connector may still require deployment and credentials.`)
    } finally {
      setLoading(false)
    }
  }

  function resetPreview() {
    setResponse(null)
    setError(null)
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.16),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Read-only migration preview</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Microsoft 365 Import</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/75 sm:text-base">
          Inspect exact Planner and Outlook mappings before any data enters CG Dynamics. This phase cannot apply or write records.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-bold text-amber-100">
          No-write mode: Microsoft and Supabase remain unchanged
        </div>
      </header>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Step 1</p>
            <h2 className="mt-1 text-lg font-black text-white">Choose a source</h2>
          </div>
          <p className="text-xs text-white/35">One source per preview</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {SOURCE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => { setSource(option.id); resetPreview() }}
              className={`rounded-2xl border p-4 text-left transition-colors ${source === option.id ? 'border-brand-teal/55 bg-brand-teal/[0.09]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}
            >
              <span className="block text-sm font-black text-white">{option.name}</span>
              <span className="mt-1 block text-xs leading-relaxed text-white/45">{option.detail}</span>
              <span className="mt-3 block text-[10px] font-black uppercase tracking-[0.12em] text-brand-teal/75">To {option.destination}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block text-xs font-bold text-white/60">
            From
            <input type="date" value={rangeStart} onChange={event => { setRangeStart(event.target.value); resetPreview() }} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-brand-teal/50" />
          </label>
          <label className="block text-xs font-bold text-white/60">
            To
            <input type="date" value={rangeEnd} onChange={event => { setRangeEnd(event.target.value); resetPreview() }} className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-brand-teal/50" />
          </label>
          <button type="button" onClick={runPreview} disabled={loading} className="rounded-xl bg-brand-teal px-5 py-3 text-sm font-black text-black transition-opacity disabled:cursor-wait disabled:opacity-55">
            {loading ? 'Checking Microsoft...' : 'Preview'}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/35">Bounded to 93 days. Outlook immutable IDs and local event offsets must be preserved by the server connector.</p>
      </section>

      {error && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.07] p-4 text-sm leading-relaxed text-red-100">{error}</div>}

      {response?.status === 'setup_required' && (
        <section className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Setup required</p>
          <h2 className="mt-2 text-xl font-black text-white">Microsoft runtime access is not configured</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{response.message}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-white/35">Required permissions</p>
          <p className="mt-2 text-sm text-white/70">{response.requiredPermissions.join(', ')}</p>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-white/35">Missing configuration</p>
          <ul className="mt-2 space-y-1 text-sm text-white/70">{response.missingConfiguration.map(item => <li key={item}>{item}</li>)}</ul>
        </section>
      )}

      {!response && !error && !loading && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Connector status</p>
          <h2 className="mt-2 text-xl font-black text-white">Setup check runs with Preview</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">No Microsoft records are loaded in the browser. Preview asks the authenticated server endpoint to confirm credentials and return only normalized records.</p>
        </section>
      )}

      {response?.status === 'ready' && (
        <>
          <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase text-white/35">Total</p><p className="mt-1 text-2xl font-black text-white">{summary.total}</p></div>
            {STATUS_OPTIONS.map(option => <div key={option.value} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-[10px] font-black uppercase text-white/35">{option.label}</p><p className="mt-1 text-2xl font-black text-white">{summary[option.value]}</p></div>)}
          </section>

          {unresolvedClients.length > 0 && (
            <section className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/[0.055] p-4 sm:p-5">
              <h2 className="text-lg font-black text-white">Unresolved client mapping</h2>
              <p className="mt-1 text-sm text-white/55">No client ID is guessed. These exact-name conflicts require an admin decision in the future Apply phase.</p>
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
        </>
      )}

      <footer className="mt-8 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-white/45">Review only. No Microsoft or Supabase write endpoint is connected.</p>
        <button type="button" disabled className="rounded-xl border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-black text-white/30">Apply phase comes next</button>
      </footer>
    </div>
  )
}
