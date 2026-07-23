import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import {
  CONTENT_GUIDE_STATUSES,
  CONTENT_RUN_STATUSES,
  canAddGuideToRun,
  canRunGuideAction,
  deliverableHasActiveGuideline,
  isBlankExtraShot,
  isMicrosoftOwnedEvent,
  splitRunItems,
  type ContentGuideStatus,
  type ContentRunStatus,
} from '../../lib/contentWorkflowRules'
import {
  addApprovedIdeaToRun,
  addRunItem,
  createGuideIdea,
  createRunWithCalendarEvent,
  listDeliverableLabels,
  listGuideIdeas,
  listRunItems,
  listRuns,
  listStaffProfiles,
  removeRunItem,
  runGuideAction,
  transitionVideo,
  unlinkGuidelineFromRun,
  updateGuideIdea,
  updateRunLinked,
  updateRunItem,
  type ContentGuideIdea,
  type ContentGuideInput,
  type ContentRun,
  type ContentRunInput,
  type ContentRunItem,
  type DeliverableLabel,
  type StaffProfileOption,
} from '../../lib/contentWorkflow'
import { listCompanyEventsByIds, type CompanyCalendarEvent } from '../../lib/companyCalendar'
import {
  GuidelineBrief,
  GuidelineCard,
  GuidelineForm,
  ShootMode,
} from './contentGuideline'
import {
  clientName,
  deliverableLabelText,
  guideStatusTone,
  humanizeStatus,
  INPUT_CLS,
  LABEL_CLS,
} from './contentGuidelineHelpers'
import VideoPipelineTab from './VideoPipelineTab'

// ── Content Workflow — Content Guidelines · Video Pipeline · Content Runs ──────
// One content_guide_ideas row is one real Content Guideline: it powers planning,
// the filming brief, the Content Run shoot workflow and the editing pipeline.
// The full guideline is visible where staff work — including inside a run — so
// nobody jumps between disconnected tabs. All data goes through contentWorkflow.ts.

type Tab = 'guides' | 'pipeline' | 'runs'

function runStatusTone(status: ContentRunStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'completed' || status === 'ready') return 'teal'
  if (status === 'cancelled') return 'neutral'
  return 'amber'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL_CLS}>{label}</span>
      {children}
    </label>
  )
}

function ClientSelect({ value, clients, onChange, disabled = false }: { value: string; clients: ClientOption[]; onChange: (id: string) => void; disabled?: boolean }) {
  return (
    <select className={INPUT_CLS} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
      <option value="">No client</option>
      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select>
  )
}

// ── Run form ──────────────────────────────────────────────────────────────────

interface RunFormState {
  client_id: string
  name: string
  run_date: string
  start_time: string
  location: string
  lead_name: string
  helpers: string
  internal_notes: string
}

function runToForm(run: ContentRun | null): RunFormState {
  return {
    client_id: run?.client_id ?? '', name: run?.name ?? '', run_date: run?.run_date ?? '',
    start_time: run?.start_time ? run.start_time.slice(0, 5) : '', location: run?.location ?? '',
    lead_name: run?.lead_name ?? '', helpers: (run?.helper_names ?? []).join(', '),
    internal_notes: run?.internal_notes ?? '',
  }
}

function formToRunInput(form: RunFormState): ContentRunInput {
  return {
    client_id: form.client_id || null,
    name: form.name.trim(),
    run_date: form.run_date || null,
    start_time: form.start_time || null,
    location: form.location.trim() || null,
    lead_name: form.lead_name.trim() || null,
    helper_names: form.helpers.split(',').map(part => part.trim()).filter(Boolean),
    internal_notes: form.internal_notes.trim() || null,
  }
}

function RunForm({
  initial, clients, saving, error, microsoftOwned = false, onCancel, onSubmit,
}: {
  initial: ContentRun | null
  clients: ClientOption[]
  saving: boolean
  error: string | null
  // The linked calendar event is Microsoft-owned: its date/title/location and
  // client/status are source-controlled and shown read-only.
  microsoftOwned?: boolean
  onCancel: () => void
  onSubmit: (input: ContentRunInput) => void
}) {
  const [form, setForm] = useState<RunFormState>(runToForm(initial))
  const set = <K extends keyof RunFormState>(key: K, value: RunFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const resolvedClientName = form.client_id ? (clients.find(client => client.id === form.client_id)?.name ?? null) : null
  const isNew = initial === null
  // A new CG run also creates its linked calendar event, which needs a start —
  // so a date is required on create. Calendar-owned fields lock for Microsoft events.
  const dateMissing = isNew && !form.run_date
  const lockCalendarFields = microsoftOwned
  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (form.name.trim() && !dateMissing) onSubmit({ ...formToRunInput(form), client_name: resolvedClientName }) }}>
      {lockCalendarFields && (
        <p className="rounded-lg border border-blue-300/20 bg-blue-300/[0.07] px-3 py-2 text-xs text-blue-100">
          Name, client, date, time and location for this run are managed in Microsoft/Outlook and are read-only here. Crew, guides and the shot list stay editable.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Run name *"><input className={INPUT_CLS} value={form.name} disabled={lockCalendarFields} onChange={event => set('name', event.target.value)} /></Field>
        <Field label="Client"><ClientSelect value={form.client_id} clients={clients} disabled={lockCalendarFields} onChange={id => set('client_id', id)} /></Field>
        <Field label={isNew ? 'Date *' : 'Date'}><input type="date" className={INPUT_CLS} value={form.run_date} disabled={lockCalendarFields} onChange={event => set('run_date', event.target.value)} /></Field>
        <Field label="Start time"><input type="time" className={INPUT_CLS} value={form.start_time} disabled={lockCalendarFields} onChange={event => set('start_time', event.target.value)} /></Field>
        <Field label="Location"><input className={INPUT_CLS} value={form.location} disabled={lockCalendarFields} onChange={event => set('location', event.target.value)} /></Field>
        <Field label="Lead staff member"><input className={INPUT_CLS} value={form.lead_name} onChange={event => set('lead_name', event.target.value)} placeholder="Staff name" /></Field>
      </div>
      <Field label="Helpers (comma-separated names)"><input className={INPUT_CLS} value={form.helpers} onChange={event => set('helpers', event.target.value)} /></Field>
      <Field label="Internal notes"><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.internal_notes} onChange={event => set('internal_notes', event.target.value)} /></Field>
      {dateMissing && <p className="text-xs text-amber-100/80">A date is required — a new run also creates its CG Calendar event.</p>}
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!form.name.trim() || dateMissing}>Save run</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentWorkflowPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => {
    const initial = searchParams.get('tab')
    return initial === 'pipeline' || initial === 'runs' ? initial : 'guides'
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [staff, setStaff] = useState<StaffProfileOption[]>([])
  const [guides, setGuides] = useState<ContentGuideIdea[]>([])
  const [runs, setRuns] = useState<ContentRun[]>([])
  const [labels, setLabels] = useState<Map<string, DeliverableLabel>>(new Map())
  // Linked CG Calendar events for the loaded runs, keyed by event id — used to
  // detect Microsoft-owned (source-controlled) runs in the UI.
  const [linkedEvents, setLinkedEvents] = useState<Record<string, CompanyCalendarEvent>>({})

  const [guideSearch, setGuideSearch] = useState('')
  const [guideStatusFilter, setGuideStatusFilter] = useState<ContentGuideStatus | 'all'>('all')
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)
  const [guideMode, setGuideMode] = useState<'view' | 'edit' | 'create'>('view')
  const [guideSaving, setGuideSaving] = useState(false)
  const [guideError, setGuideError] = useState<string | null>(null)
  const [addToRunId, setAddToRunId] = useState('')

  const [runSearch, setRunSearch] = useState('')
  const [runStatusFilter, setRunStatusFilter] = useState<ContentRunStatus | 'all'>('all')
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [runMode, setRunMode] = useState<'view' | 'edit' | 'create'>('view')
  const [runSaving, setRunSaving] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [runItems, setRunItems] = useState<ContentRunItem[]>([])
  // Run-detail interaction state.
  const [cardBusyId, setCardBusyId] = useState<string | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [pendingUnlink, setPendingUnlink] = useState<ContentRunItem | null>(null)
  const [addGuideOpen, setAddGuideOpen] = useState(false)
  const [addGuideSearch, setAddGuideSearch] = useState('')
  const [shootMode, setShootMode] = useState(false)

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    const [clientResult, staffResult, guideResult, runResult] = await Promise.all([listActiveClients(), listStaffProfiles(), listGuideIdeas(), listRuns()])
    if (guideResult.migrationNeeded || runResult.migrationNeeded) {
      setMigrationNeeded(true); setLoading(false); return
    }
    setMigrationNeeded(false)
    setLoadError(guideResult.error ?? runResult.error ?? clientResult.error?.message ?? null)
    setClients((clientResult.data ?? []) as ClientOption[])
    setStaff(staffResult.migrationNeeded ? [] : staffResult.data)
    setGuides(guideResult.data)
    setRuns(runResult.data)
    // Read-only Client Schedule labels for linked guidelines (display only).
    const deliverableIds = [...new Set(guideResult.data.map(guide => guide.deliverable_id).filter((id): id is string => Boolean(id)))]
    const labelResult = await listDeliverableLabels(deliverableIds)
    setLabels(new Map((labelResult.error ? [] : labelResult.data).map(label => [label.id, label])))
    // Best-effort: fetch the calendar events linked to these runs so the UI can
    // mark Microsoft-owned runs read-only. Silent if the calendar layer is absent.
    const linkedIds = runResult.data.map(run => run.calendar_event_id).filter((id): id is string => Boolean(id))
    if (linkedIds.length > 0) {
      const eventsResult = await listCompanyEventsByIds(linkedIds)
      const map: Record<string, CompanyCalendarEvent> = {}
      for (const event of eventsResult.data ?? []) map[event.id] = event
      setLinkedEvents(map)
    } else {
      setLinkedEvents({})
    }
    setLoading(false)
  }
  const loadAllEvent = useEffectEvent(loadAll)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Deep link from the CG Calendar: ?tab=runs&event=<calendar_event_id> opens the
  // matching run. Runs once the runs are loaded, then clears the param.
  const openFromCalendarEvent = useEffectEvent((eventId: string) => {
    const match = runs.find(run => run.calendar_event_id === eventId)
    if (match) { setTab('runs'); setSelectedRunId(match.id); setRunMode('view') }
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('event'); return next }, { replace: true })
  })
  useEffect(() => {
    const eventId = searchParams.get('event')
    if (!eventId || runs.length === 0) return
    const timer = window.setTimeout(() => openFromCalendarEvent(eventId), 0)
    return () => window.clearTimeout(timer)
  }, [searchParams, runs])

  // Direct guideline deep link: ?tab=guides&guide=<guide-id>.
  const openFromGuideParam = useEffectEvent((guideId: string) => {
    const match = guides.find(guide => guide.id === guideId)
    if (match) { setTab('guides'); setSelectedGuideId(match.id); setGuideMode('view') }
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.delete('guide'); return next }, { replace: true })
  })
  useEffect(() => {
    const guideId = searchParams.get('guide')
    if (!guideId || guides.length === 0) return
    const timer = window.setTimeout(() => openFromGuideParam(guideId), 0)
    return () => window.clearTimeout(timer)
  }, [searchParams, guides])

  async function loadRunItems(runId: string) {
    const result = await listRunItems(runId)
    if (!result.error) setRunItems(result.data)
  }
  const loadRunItemsEvent = useEffectEvent(loadRunItems)
  useEffect(() => {
    // Deferred so state updates don't run synchronously in the effect body.
    const timer = window.setTimeout(() => {
      if (selectedRunId) void loadRunItemsEvent(selectedRunId)
      else setRunItems([])
    }, 0)
    return () => window.clearTimeout(timer)
  }, [selectedRunId])

  const selectedGuide = guides.find(guide => guide.id === selectedGuideId) ?? null
  const selectedRun = runs.find(run => run.id === selectedRunId) ?? null
  const selectedRunEvent = selectedRun?.calendar_event_id ? (linkedEvents[selectedRun.calendar_event_id] ?? null) : null
  const selectedRunMicrosoftOwned = isMicrosoftOwnedEvent(selectedRunEvent)
  const openRuns = useMemo(() => runs.filter(run => run.status !== 'completed' && run.status !== 'cancelled'), [runs])

  function guideLabel(guide: ContentGuideIdea | null): string | null {
    if (!guide?.deliverable_id) return null
    return deliverableLabelText(labels.get(guide.deliverable_id))
  }

  const filteredGuides = useMemo(() => {
    const query = guideSearch.trim().toLowerCase()
    return guides.filter(guide => {
      if (guideStatusFilter !== 'all' && guide.status !== guideStatusFilter) return false
      if (!query) return true
      return [guide.title, guide.canonical_name ?? '', guide.objective ?? '', clientName(clients, guide.client_id)].some(field => field.toLowerCase().includes(query))
    })
  }, [guides, guideSearch, guideStatusFilter, clients])

  const filteredRuns = useMemo(() => {
    const query = runSearch.trim().toLowerCase()
    return runs.filter(run => {
      if (runStatusFilter !== 'all' && run.status !== runStatusFilter) return false
      if (!query) return true
      return [run.name, run.location ?? '', run.lead_name ?? '', clientName(clients, run.client_id)].some(field => field.toLowerCase().includes(query))
    })
  }, [runs, runSearch, runStatusFilter, clients])

  // Split the selected run's items into linked guidelines (primary) and extra
  // standalone shots (secondary). Linked items resolve to the guideline record.
  const { linked: linkedItems, extra: extraItems } = useMemo(() => splitRunItems(runItems), [runItems])
  const linkedGuidelines = useMemo(
    () => linkedItems
      .map(item => ({ item, guide: guides.find(guide => guide.id === item.guide_idea_id) ?? null }))
      .filter((entry): entry is { item: ContentRunItem; guide: ContentGuideIdea } => entry.guide !== null),
    [linkedItems, guides],
  )

  // Approved guidelines that can be added to the selected run: not already linked,
  // matching the run's client when it has one, searchable, month-preferred.
  const eligibleToAdd = useMemo(() => {
    if (!selectedRun) return []
    const runMonth = (selectedRun.run_date ?? '').slice(0, 7)
    const query = addGuideSearch.trim().toLowerCase()
    return guides
      .filter(guide => canAddGuideToRun(guide.status))
      .filter(guide => !linkedItems.some(item => item.guide_idea_id === guide.id))
      .filter(guide => !selectedRun.client_id || guide.client_id === selectedRun.client_id)
      .filter(guide => !query || [guide.title, guide.canonical_name ?? ''].some(field => field.toLowerCase().includes(query)))
      .sort((a, b) => {
        const am = (a.month ?? '').slice(0, 7) === runMonth ? 0 : 1
        const bm = (b.month ?? '').slice(0, 7) === runMonth ? 0 : 1
        return am - bm
      })
  }, [selectedRun, guides, linkedItems, addGuideSearch])

  async function submitGuide(input: ContentGuideInput) {
    // One active guideline per Client Schedule deliverable.
    if (input.deliverable_id && deliverableHasActiveGuideline(guides, input.deliverable_id, guideMode === 'edit' ? selectedGuideId : null)) {
      setGuideError('Another active guideline is already linked to that Client Schedule deliverable.')
      return
    }
    setGuideSaving(true); setGuideError(null)
    const withCreator = guideMode === 'create' ? { ...input, created_by: profile?.id ?? null } : input
    const response = guideMode === 'create' ? await createGuideIdea(withCreator) : await updateGuideIdea(selectedGuideId as string, input)
    setGuideSaving(false)
    if (response.error) { setGuideError(response.error); return }
    if (response.migrationNeeded) { setMigrationNeeded(true); return }
    await loadAll()
    if (response.data) setSelectedGuideId(response.data.id)
    setGuideMode('view')
  }

  async function guideAction(action: 'submit_review' | 'approve' | 'return_to_review' | 'archive') {
    if (!selectedGuide) return
    setGuideError(null)
    const response = await runGuideAction(selectedGuide.id, action)
    if (response.error) { setGuideError(response.error); return }
    await loadAll()
  }

  async function addSelectedGuideToRun() {
    if (!selectedGuide || !addToRunId) return
    const run = runs.find(candidate => candidate.id === addToRunId)
    if (!run) return
    setGuideError(null)
    const existing = await listRunItems(run.id)
    const response = await addApprovedIdeaToRun(run, selectedGuide, existing.data.length)
    if (response.error) { setGuideError(response.error); return }
    setAddToRunId('')
    await loadAll()
  }

  // Add an approved guideline to the currently-selected run (from the run screen).
  async function addGuideFromRun(guide: ContentGuideIdea) {
    if (!selectedRun) return
    setCardError(null)
    const response = await addApprovedIdeaToRun(selectedRun, guide, runItems.length)
    if (response.error) { setCardError(response.error); return }
    setAddGuideSearch('')
    await loadRunItems(selectedRun.id)
    await loadAll()
  }

  async function confirmUnlink() {
    if (!pendingUnlink || !selectedRunId) return
    const item = pendingUnlink
    setPendingUnlink(null)
    setCardError(null)
    const response = await unlinkGuidelineFromRun(item)
    if (response.error) { setCardError(response.error); return }
    await loadRunItems(selectedRunId)
    await loadAll()
  }

  // Mark a linked guideline's video as shot through the guarded transition.
  async function markGuideShot(guide: ContentGuideIdea) {
    setCardBusyId(guide.id); setCardError(null)
    const response = await transitionVideo(guide, 'mark_shot', {
      footageUrl: guide.onedrive_footage_url,
      clientApprovalUrl: guide.onedrive_client_approval_url,
      editorUserId: guide.editor_user_id,
      editorName: guide.editor_name,
    })
    setCardBusyId(null)
    if (response.error) { setCardError(response.error); return }
    await loadAll()
  }

  function openGuideline(guide: ContentGuideIdea, mode: 'view' | 'edit') {
    setTab('guides'); setSelectedGuideId(guide.id); setGuideMode(mode); setGuideError(null)
  }

  async function submitRun(input: ContentRunInput) {
    setRunSaving(true); setRunError(null)
    const response = runMode === 'create'
      ? await createRunWithCalendarEvent({ ...input, created_by: profile?.id ?? null })
      : selectedRun ? await updateRunLinked(selectedRun, input) : { data: null, error: 'No run selected.', migrationNeeded: false }
    setRunSaving(false)
    if (response.error) { setRunError(response.error); return }
    if (response.migrationNeeded) { setMigrationNeeded(true); return }
    await loadAll()
    if (response.data) setSelectedRunId(response.data.id)
    setRunMode('view')
  }

  async function setRunStatus(status: ContentRunStatus) {
    if (!selectedRun) return
    // Cancelling/completing keeps the linked calendar event aligned (no hard delete).
    await updateRunLinked(selectedRun, { status })
    await loadAll()
  }

  async function addExtraShot() {
    if (!selectedRun) return
    await addRunItem(selectedRun.id, { sort_order: runItems.length })
    await loadRunItems(selectedRun.id)
  }
  async function toggleShotComplete(item: ContentRunItem) {
    await updateRunItem(item.id, { completed: !item.completed })
    if (selectedRunId) await loadRunItems(selectedRunId)
  }
  async function removeExtraShot(item: ContentRunItem) {
    await removeRunItem(item.id)
    if (selectedRunId) await loadRunItems(selectedRunId)
  }
  async function moveShot(item: ContentRunItem, direction: -1 | 1) {
    const index = extraItems.findIndex(entry => entry.id === item.id)
    const swapWith = extraItems[index + direction]
    if (!swapWith) return
    await updateRunItem(item.id, { sort_order: swapWith.sort_order })
    await updateRunItem(swapWith.id, { sort_order: item.sort_order })
    if (selectedRunId) await loadRunItems(selectedRunId)
  }

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`rounded-full border px-4 py-2 text-sm font-black transition-colors ${tab === value ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/45 hover:text-white/70'}`}
    >
      {label} {count > 0 && <span className="opacity-60">{count}</span>}
    </button>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 sm:pt-8">
      {shootMode && selectedRun && (
        <ShootMode
          runName={selectedRun.name}
          runDate={selectedRun.run_date}
          runLocation={selectedRun.location}
          guidelines={linkedGuidelines.map(entry => entry.guide)}
          clients={clients}
          marking={cardBusyId !== null}
          onClose={() => setShootMode(false)}
          onMarkShot={markGuideShot}
        />
      )}

      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_40%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Operations</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Content Workflow</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/75">
          Plan the video, use the guideline during the shoot, then track editing and approvals.
        </p>
      </header>

      {!migrationNeeded && <div className="mt-6 flex flex-wrap gap-2">{tabButton('guides', 'Content Guidelines', guides.length)}{tabButton('pipeline', 'Video Pipeline', 0)}{tabButton('runs', 'Content Runs', runs.length)}</div>}

      {migrationNeeded ? (
        <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Migration required</p>
          <h2 className="mt-2 text-xl font-black text-white">The Content Workflow tables are not in the database yet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">
            Review and apply <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-100">supabase/phase-19d-content-workflow-mvp.sql</code> in the Supabase SQL editor.
          </p>
        </div>
      ) : loading ? (
        <LoadingState className="mt-8" message="Loading Content Workflow…" />
      ) : loadError ? (
        <EmptyState className="mt-8" title="Could not load Content Workflow" message={loadError} action={<ActionButton variant="secondary" onClick={() => void loadAll()}>Try again</ActionButton>} />
      ) : tab === 'guides' ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${INPUT_CLS} flex-1`} placeholder="Search guidelines" value={guideSearch} onChange={event => setGuideSearch(event.target.value)} />
              <ActionButton size="sm" onClick={() => { setGuideMode('create'); setSelectedGuideId(null); setGuideError(null) }}>New guideline</ActionButton>
            </div>
            <select className={`${INPUT_CLS} w-auto`} value={guideStatusFilter} onChange={event => setGuideStatusFilter(event.target.value as ContentGuideStatus | 'all')}>
              <option value="all">All statuses</option>
              {CONTENT_GUIDE_STATUSES.map(status => <option key={status} value={status}>{humanizeStatus(status)}</option>)}
            </select>
            {filteredGuides.length === 0 ? (
              <EmptyState title={guides.length === 0 ? 'No content guidelines yet' : 'No guidelines match'} message={guides.length === 0 ? 'Create the first content guideline.' : 'Adjust search or status.'} />
            ) : (
              <ul className="space-y-2">
                {filteredGuides.map(guide => (
                  <li key={guide.id}>
                    <button type="button" onClick={() => { setSelectedGuideId(guide.id); setGuideMode('view'); setAddToRunId('') }} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedGuideId === guide.id && guideMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
                      <p className="break-all font-mono text-[11px] text-white/45">{guide.canonical_name ?? '(no canonical name)'}</p>
                      <div className="mt-1 flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{guide.title}</p>
                        <Pill tone={guideStatusTone(guide.status)}>{humanizeStatus(guide.status)}</Pill>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{clientName(clients, guide.client_id)}{guide.month ? ` · ${guide.month.slice(0, 7)}` : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            {guideMode === 'create' ? (
              <><h2 className="mb-4 text-lg font-black text-white">New content guideline</h2><GuidelineForm initial={null} clients={clients} staff={staff} saving={guideSaving} error={guideError} onCancel={() => setGuideMode('view')} onSubmit={submitGuide} /></>
            ) : guideMode === 'edit' && selectedGuide ? (
              <><h2 className="mb-4 text-lg font-black text-white">Edit guideline</h2><GuidelineForm initial={selectedGuide} clients={clients} staff={staff} saving={guideSaving} error={guideError} onCancel={() => setGuideMode('view')} onSubmit={submitGuide} /></>
            ) : selectedGuide ? (
              <GuidelineBrief
                idea={selectedGuide}
                clients={clients}
                deliverableLabel={guideLabel(selectedGuide)}
                onEdit={() => { setGuideMode('edit'); setGuideError(null) }}
                footer={
                  <div className="space-y-3">
                    {guideError && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{guideError}</p>}
                    <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                      {canRunGuideAction(selectedGuide.status, 'submit_review') && <ActionButton size="sm" variant="secondary" onClick={() => void guideAction('submit_review')}>Submit for review</ActionButton>}
                      {canRunGuideAction(selectedGuide.status, 'approve') && <ActionButton size="sm" onClick={() => void guideAction('approve')}>Approve</ActionButton>}
                      {canRunGuideAction(selectedGuide.status, 'return_to_review') && <ActionButton size="sm" variant="secondary" onClick={() => void guideAction('return_to_review')}>Return to review</ActionButton>}
                      {canRunGuideAction(selectedGuide.status, 'archive') && <ActionButton size="sm" variant="ghost" onClick={() => void guideAction('archive')}>Archive</ActionButton>}
                    </div>
                    {canAddGuideToRun(selectedGuide.status) && (
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                        <span className="text-xs font-bold text-white/60">Add to run:</span>
                        <select className={`${INPUT_CLS} w-auto flex-1`} value={addToRunId} onChange={event => setAddToRunId(event.target.value)}>
                          <option value="">Choose a run…</option>
                          {openRuns.map(run => <option key={run.id} value={run.id}>{run.name}{run.run_date ? ` (${run.run_date})` : ''}</option>)}
                        </select>
                        <ActionButton size="sm" disabled={!addToRunId} onClick={() => void addSelectedGuideToRun()}>Add</ActionButton>
                      </div>
                    )}
                  </div>
                }
              />
            ) : (
              <EmptyState title="Select a content guideline" message="Choose a guideline to view its full brief, or create a new one." />
            )}
          </section>
        </div>
      ) : tab === 'pipeline' ? (
        <VideoPipelineTab clients={clients} staff={staff} />
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${INPUT_CLS} flex-1`} placeholder="Search runs" value={runSearch} onChange={event => setRunSearch(event.target.value)} />
              <ActionButton size="sm" onClick={() => { setRunMode('create'); setSelectedRunId(null); setRunError(null) }}>New run</ActionButton>
            </div>
            <select className={`${INPUT_CLS} w-auto`} value={runStatusFilter} onChange={event => setRunStatusFilter(event.target.value as ContentRunStatus | 'all')}>
              <option value="all">All statuses</option>
              {CONTENT_RUN_STATUSES.map(status => <option key={status} value={status}>{humanizeStatus(status)}</option>)}
            </select>
            {filteredRuns.length === 0 ? (
              <EmptyState title={runs.length === 0 ? 'No runs yet' : 'No runs match'} message={runs.length === 0 ? 'Create the first content run.' : 'Adjust search or status.'} />
            ) : (
              <ul className="space-y-2">
                {filteredRuns.map(run => (
                  <li key={run.id}>
                    <button type="button" onClick={() => { setSelectedRunId(run.id); setRunMode('view'); setAddGuideOpen(false); setCardError(null) }} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedRunId === run.id && runMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{run.name}</p>
                        <Pill tone={runStatusTone(run.status)}>{humanizeStatus(run.status)}</Pill>
                      </div>
                      <p className="mt-1 text-xs text-white/45">{clientName(clients, run.client_id)}{run.run_date ? ` · ${run.run_date}` : ''}{run.lead_name ? ` · ${run.lead_name}` : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            {runMode === 'create' ? (
              <><h2 className="mb-4 text-lg font-black text-white">New content run</h2><RunForm initial={null} clients={clients} saving={runSaving} error={runError} onCancel={() => setRunMode('view')} onSubmit={submitRun} /></>
            ) : runMode === 'edit' && selectedRun ? (
              <><h2 className="mb-4 text-lg font-black text-white">Edit run</h2><RunForm initial={selectedRun} clients={clients} saving={runSaving} error={runError} microsoftOwned={selectedRunMicrosoftOwned} onCancel={() => setRunMode('view')} onSubmit={submitRun} /></>
            ) : selectedRun ? (
              <div className="space-y-5">
                {/* Run overview */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">{clientName(clients, selectedRun.client_id)}</p>
                    <h2 className="mt-1 break-words text-xl font-black text-white">{selectedRun.name}</h2>
                    <p className="mt-1 text-xs text-white/45">{selectedRun.run_date ?? 'No date'}{selectedRun.start_time ? ` · ${selectedRun.start_time.slice(0, 5)}` : ''}{selectedRun.location ? ` · ${selectedRun.location}` : ''}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {linkedGuidelines.length > 0 && <ActionButton size="sm" onClick={() => setShootMode(true)}>Open shoot mode</ActionButton>}
                    <ActionButton size="sm" variant="secondary" onClick={() => { setRunMode('edit'); setRunError(null) }}>Edit</ActionButton>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={runStatusTone(selectedRun.status)}>{humanizeStatus(selectedRun.status)}</Pill>
                  {selectedRun.lead_name && <Pill tone="teal">Lead: {selectedRun.lead_name}</Pill>}
                  {selectedRun.helper_names.map(helper => <Pill key={helper}>{helper}</Pill>)}
                  {selectedRun.calendar_event_id && <Pill tone="teal">On CG Calendar</Pill>}
                  {selectedRunMicrosoftOwned && <Pill>Outlook-managed</Pill>}
                </div>
                {selectedRunMicrosoftOwned && (
                  <p className="rounded-lg border border-blue-300/20 bg-blue-300/[0.07] px-3 py-2 text-xs text-blue-100">
                    Date, name and location come from Microsoft/Outlook and are read-only here. Crew, guides and the shot list stay editable.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">Set status:</span>
                  {CONTENT_RUN_STATUSES.map(status => (
                    <button key={status} type="button" onClick={() => void setRunStatus(status)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${selectedRun.status === status ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/50 hover:text-white/80'}`}>{humanizeStatus(status)}</button>
                  ))}
                </div>

                {/* Videos & Content Guidelines — the primary shoot content */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-brand-teal">Videos & Content Guidelines ({linkedGuidelines.length})</h3>
                    <ActionButton size="sm" variant="secondary" onClick={() => { setAddGuideOpen(prev => !prev); setAddGuideSearch('') }}>{addGuideOpen ? 'Close' : 'Add guideline to run'}</ActionButton>
                  </div>
                  {cardError && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{cardError}</p>}

                  {addGuideOpen && (
                    <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
                      <input className={`${INPUT_CLS}`} placeholder="Search approved guidelines" value={addGuideSearch} onChange={event => setAddGuideSearch(event.target.value)} />
                      {eligibleToAdd.length === 0 ? (
                        <p className="px-1 py-2 text-xs text-white/45">No approved guidelines available{selectedRun.client_id ? ' for this client' : ''}. Approve a guideline first.</p>
                      ) : (
                        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                          {eligibleToAdd.map(guide => (
                            <li key={guide.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white">{guide.title}</p>
                                <p className="truncate font-mono text-[11px] text-white/45">{guide.canonical_name ?? '—'}{guide.month ? ` · ${guide.month.slice(0, 7)}` : ''}</p>
                              </div>
                              <ActionButton size="sm" onClick={() => void addGuideFromRun(guide)}>Add</ActionButton>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {pendingUnlink && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100">
                      <span>Unlink “{pendingUnlink.title ?? 'this guideline'}” from the run? The guideline itself is kept.</span>
                      <div className="ml-auto flex gap-2">
                        <button type="button" onClick={() => void confirmUnlink()} className="font-bold text-red-300 hover:text-red-200">Yes, unlink</button>
                        <button type="button" onClick={() => setPendingUnlink(null)} className="text-white/60 hover:text-white">Cancel</button>
                      </div>
                    </div>
                  )}

                  {linkedGuidelines.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">No content guidelines linked yet. Use “Add guideline to run”.</p>
                  ) : (
                    <div className="space-y-2">
                      {linkedGuidelines.map(({ item, guide }) => (
                        <GuidelineCard
                          key={item.id}
                          idea={guide}
                          clients={clients}
                          deliverableLabel={guideLabel(guide)}
                          marking={cardBusyId === guide.id}
                          actionError={null}
                          onOpen={() => openGuideline(guide, 'view')}
                          onEdit={() => openGuideline(guide, 'edit')}
                          onMarkShot={() => void markGuideShot(guide)}
                          onUnlink={() => setPendingUnlink(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Extra shots / run notes — secondary standalone items */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Extra shots / run notes ({extraItems.length})</h3>
                    <ActionButton size="sm" variant="ghost" onClick={() => void addExtraShot()}>Add extra shot</ActionButton>
                  </div>
                  {extraItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-white/35">No extra shots. Linked guidelines above are the main content.</p>
                  ) : (
                    <ol className="space-y-2">
                      {extraItems.map((item, index) => (
                        <li key={item.id} className={`rounded-lg border p-3 ${item.completed ? 'border-emerald-300/25 bg-emerald-300/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">{index + 1}. {isBlankExtraShot(item) ? <span className="text-white/50">Extra shot — details not added</span> : (item.title ?? 'Extra shot')}</p>
                              {item.shot_notes && <p className="mt-1 text-xs text-white/55">{item.shot_notes}</p>}
                              {item.requirements && <p className="mt-1 text-xs text-amber-100/70">Needs: {item.requirements}</p>}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => void moveShot(item, -1)} disabled={index === 0} className="rounded px-1.5 text-white/50 hover:text-white disabled:opacity-30">↑</button>
                              <button type="button" onClick={() => void moveShot(item, 1)} disabled={index === extraItems.length - 1} className="rounded px-1.5 text-white/50 hover:text-white disabled:opacity-30">↓</button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={item.completed} onChange={() => void toggleShotComplete(item)} />Done</label>
                            <button type="button" onClick={() => void removeExtraShot(item)} className="text-xs text-red-300/80 hover:text-red-200">Remove</button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {selectedRun.internal_notes && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">{selectedRun.internal_notes}</p>}
              </div>
            ) : (
              <EmptyState title="Select a run" message="Choose a run to manage its linked guidelines and shoot workflow, or create a new one." />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
