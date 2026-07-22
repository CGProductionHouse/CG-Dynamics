import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import { listMonthlyDeliverablesByMonth, type MonthlyDeliverable } from '../../lib/planner'
import {
  CONTENT_GUIDE_STATUSES,
  CONTENT_RUN_STATUSES,
  canAddGuideToRun,
  canRunGuideAction,
  type ContentGuideStatus,
  type ContentRunStatus,
} from '../../lib/contentWorkflowRules'
import {
  addApprovedIdeaToRun,
  addRunItem,
  createGuideIdea,
  createRun,
  listGuideIdeas,
  listRunItems,
  listRuns,
  removeRunItem,
  runGuideAction,
  updateGuideIdea,
  updateRun,
  updateRunItem,
  type ContentGuideIdea,
  type ContentGuideInput,
  listStaffProfiles,
  type ContentRun,
  type ContentRunInput,
  type ContentRunItem,
  type StaffProfileOption,
} from '../../lib/contentWorkflow'
import VideoPipelineTab from './VideoPipelineTab'

// ── Content Workflow — staff Content Guides + Content Runs (MVP) ──────────────
// All data goes through src/lib/contentWorkflow.ts. Reuses the existing design
// language. No redesign, no AI generation, no hard deletes of ideas/runs.

type Tab = 'guides' | 'pipeline' | 'runs'

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const LABEL_CLS = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

function guideStatusTone(status: ContentGuideStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'approved' || status === 'completed') return 'teal'
  if (status === 'needs_review' || status === 'in_production' || status === 'added_to_run') return 'amber'
  return 'neutral'
}

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

function ClientSelect({ value, clients, onChange }: { value: string; clients: ClientOption[]; onChange: (id: string) => void }) {
  return (
    <select className={INPUT_CLS} value={value} onChange={event => onChange(event.target.value)}>
      <option value="">No client</option>
      {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
    </select>
  )
}

function clientName(clients: ClientOption[], id: string | null): string {
  if (!id) return 'No client'
  return clients.find(client => client.id === id)?.name ?? 'Unknown client'
}

// ── Guide form ────────────────────────────────────────────────────────────────

interface GuideFormState {
  client_id: string
  month: string          // YYYY-MM
  title: string
  objective: string
  platform: string
  format: string
  hook: string
  cta: string
  visual_notes: string
  owner_name: string
  proposed_post_date: string
  deliverable_id: string
  notes: string
}

function guideToForm(idea: ContentGuideIdea | null): GuideFormState {
  return {
    client_id: idea?.client_id ?? '', month: idea?.month ? idea.month.slice(0, 7) : '',
    title: idea?.title ?? '', objective: idea?.objective ?? '', platform: idea?.platform ?? '',
    format: idea?.format ?? '', hook: idea?.hook ?? '', cta: idea?.cta ?? '',
    visual_notes: idea?.visual_notes ?? '', owner_name: idea?.owner_name ?? '',
    proposed_post_date: idea?.proposed_post_date ?? '', deliverable_id: idea?.deliverable_id ?? '',
    notes: idea?.notes ?? '',
  }
}

function formToGuideInput(form: GuideFormState): ContentGuideInput {
  return {
    client_id: form.client_id || null,
    month: form.month ? `${form.month}-01` : null,
    title: form.title.trim(),
    objective: form.objective.trim() || null,
    platform: form.platform.trim() || null,
    format: form.format.trim() || null,
    hook: form.hook.trim() || null,
    cta: form.cta.trim() || null,
    visual_notes: form.visual_notes.trim() || null,
    owner_name: form.owner_name.trim() || null,
    proposed_post_date: form.proposed_post_date || null,
    deliverable_id: form.deliverable_id || null,
    notes: form.notes.trim() || null,
  }
}

function GuideForm({
  initial, clients, saving, error, onCancel, onSubmit,
}: {
  initial: ContentGuideIdea | null
  clients: ClientOption[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: ContentGuideInput) => void
}) {
  const [form, setForm] = useState<GuideFormState>(guideToForm(initial))
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const set = <K extends keyof GuideFormState>(key: K, value: GuideFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  // Load the client's deliverables for the chosen month for the optional link.
  const loadDeliverables = useEffectEvent(async () => {
    if (!form.client_id || !form.month) { setDeliverables([]); return }
    const { data } = await listMonthlyDeliverablesByMonth(form.month, { clientId: form.client_id })
    setDeliverables((data ?? []) as MonthlyDeliverable[])
  })
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDeliverables() }, 0)
    return () => window.clearTimeout(timer)
  }, [form.client_id, form.month])

  const resolvedClientName = form.client_id ? (clients.find(client => client.id === form.client_id)?.name ?? null) : null

  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (form.title.trim()) onSubmit({ ...formToGuideInput(form), client_name: resolvedClientName }) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Client"><ClientSelect value={form.client_id} clients={clients} onChange={id => set('client_id', id)} /></Field>
        <Field label="Month"><input type="month" className={INPUT_CLS} value={form.month} onChange={event => set('month', event.target.value)} /></Field>
      </div>
      <Field label="Title *"><input className={INPUT_CLS} value={form.title} onChange={event => set('title', event.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Objective"><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.objective} onChange={event => set('objective', event.target.value)} /></Field>
        <Field label="Hook / content angle"><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.hook} onChange={event => set('hook', event.target.value)} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Platform"><input className={INPUT_CLS} value={form.platform} onChange={event => set('platform', event.target.value)} placeholder="Instagram, Facebook…" /></Field>
        <Field label="Format"><input className={INPUT_CLS} value={form.format} onChange={event => set('format', event.target.value)} placeholder="Reel, Photo, Story…" /></Field>
        <Field label="CTA"><input className={INPUT_CLS} value={form.cta} onChange={event => set('cta', event.target.value)} /></Field>
      </div>
      <Field label="Visual / filming notes"><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.visual_notes} onChange={event => set('visual_notes', event.target.value)} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Owner"><input className={INPUT_CLS} value={form.owner_name} onChange={event => set('owner_name', event.target.value)} placeholder="Staff name" /></Field>
        <Field label="Proposed posting date"><input type="date" className={INPUT_CLS} value={form.proposed_post_date} onChange={event => set('proposed_post_date', event.target.value)} /></Field>
        <Field label="Linked deliverable (optional)">
          <select className={INPUT_CLS} value={form.deliverable_id} onChange={event => set('deliverable_id', event.target.value)}>
            <option value="">Not linked</option>
            {deliverables.map(deliverable => (
              <option key={deliverable.id} value={deliverable.id}>{deliverable.code}{deliverable.instance_number} — {deliverable.title}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Internal notes"><textarea className={`${INPUT_CLS} min-h-[48px]`} value={form.notes} onChange={event => set('notes', event.target.value)} /></Field>
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!form.title.trim()}>Save idea</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
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
  initial, clients, saving, error, onCancel, onSubmit,
}: {
  initial: ContentRun | null
  clients: ClientOption[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: ContentRunInput) => void
}) {
  const [form, setForm] = useState<RunFormState>(runToForm(initial))
  const set = <K extends keyof RunFormState>(key: K, value: RunFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))
  const resolvedClientName = form.client_id ? (clients.find(client => client.id === form.client_id)?.name ?? null) : null
  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (form.name.trim()) onSubmit({ ...formToRunInput(form), client_name: resolvedClientName }) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Run name *"><input className={INPUT_CLS} value={form.name} onChange={event => set('name', event.target.value)} /></Field>
        <Field label="Client"><ClientSelect value={form.client_id} clients={clients} onChange={id => set('client_id', id)} /></Field>
        <Field label="Date"><input type="date" className={INPUT_CLS} value={form.run_date} onChange={event => set('run_date', event.target.value)} /></Field>
        <Field label="Start time"><input type="time" className={INPUT_CLS} value={form.start_time} onChange={event => set('start_time', event.target.value)} /></Field>
        <Field label="Location"><input className={INPUT_CLS} value={form.location} onChange={event => set('location', event.target.value)} /></Field>
        <Field label="Lead staff member"><input className={INPUT_CLS} value={form.lead_name} onChange={event => set('lead_name', event.target.value)} placeholder="Staff name" /></Field>
      </div>
      <Field label="Helpers (comma-separated names)"><input className={INPUT_CLS} value={form.helpers} onChange={event => set('helpers', event.target.value)} /></Field>
      <Field label="Internal notes"><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.internal_notes} onChange={event => set('internal_notes', event.target.value)} /></Field>
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}
      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!form.name.trim()}>Save run</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentWorkflowPage() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('guides')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)

  const [clients, setClients] = useState<ClientOption[]>([])
  const [staff, setStaff] = useState<StaffProfileOption[]>([])
  const [guides, setGuides] = useState<ContentGuideIdea[]>([])
  const [runs, setRuns] = useState<ContentRun[]>([])

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
    setLoading(false)
  }
  const loadAllEvent = useEffectEvent(loadAll)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAllEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

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
  const approvedGuidesForRun = useMemo(() => guides.filter(guide => canAddGuideToRun(guide.status)), [guides])
  const openRuns = useMemo(() => runs.filter(run => run.status !== 'completed' && run.status !== 'cancelled'), [runs])

  const filteredGuides = useMemo(() => {
    const query = guideSearch.trim().toLowerCase()
    return guides.filter(guide => {
      if (guideStatusFilter !== 'all' && guide.status !== guideStatusFilter) return false
      if (!query) return true
      return [guide.title, guide.objective ?? '', guide.platform ?? '', clientName(clients, guide.client_id)].some(field => field.toLowerCase().includes(query))
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

  async function submitGuide(input: ContentGuideInput) {
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

  async function submitRun(input: ContentRunInput) {
    setRunSaving(true); setRunError(null)
    const withCreator = runMode === 'create' ? { ...input, created_by: profile?.id ?? null } : input
    const response = runMode === 'create' ? await createRun(withCreator) : await updateRun(selectedRunId as string, input)
    setRunSaving(false)
    if (response.error) { setRunError(response.error); return }
    if (response.migrationNeeded) { setMigrationNeeded(true); return }
    await loadAll()
    if (response.data) setSelectedRunId(response.data.id)
    setRunMode('view')
  }

  async function setRunStatus(status: ContentRunStatus) {
    if (!selectedRun) return
    await updateRun(selectedRun.id, { status })
    await loadAll()
  }

  async function addBlankShot() {
    if (!selectedRun) return
    await addRunItem(selectedRun.id, { sort_order: runItems.length })
    await loadRunItems(selectedRun.id)
  }
  async function toggleShotComplete(item: ContentRunItem) {
    await updateRunItem(item.id, { completed: !item.completed })
    if (selectedRunId) await loadRunItems(selectedRunId)
  }
  async function removeShot(item: ContentRunItem) {
    await removeRunItem(item.id)
    if (selectedRunId) await loadRunItems(selectedRunId)
  }
  async function moveShot(item: ContentRunItem, direction: -1 | 1) {
    const index = runItems.findIndex(entry => entry.id === item.id)
    const swapWith = runItems[index + direction]
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
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.14),transparent_40%),linear-gradient(145deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Operations</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Content Workflow</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-brand-primary/75">
          Capture content ideas, approve them, group approved ideas into content runs, and assign the run and its shots.
        </p>
      </header>

      {!migrationNeeded && <div className="mt-6 flex flex-wrap gap-2">{tabButton('guides', 'Content Guides', guides.length)}{tabButton('pipeline', 'Video Pipeline', 0)}{tabButton('runs', 'Content Runs', runs.length)}</div>}

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
              <input className={`${INPUT_CLS} flex-1`} placeholder="Search ideas" value={guideSearch} onChange={event => setGuideSearch(event.target.value)} />
              <ActionButton size="sm" onClick={() => { setGuideMode('create'); setSelectedGuideId(null); setGuideError(null) }}>New idea</ActionButton>
            </div>
            <select className={`${INPUT_CLS} w-auto`} value={guideStatusFilter} onChange={event => setGuideStatusFilter(event.target.value as ContentGuideStatus | 'all')}>
              <option value="all">All statuses</option>
              {CONTENT_GUIDE_STATUSES.map(status => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
            {filteredGuides.length === 0 ? (
              <EmptyState title={guides.length === 0 ? 'No ideas yet' : 'No ideas match'} message={guides.length === 0 ? 'Capture the first content idea.' : 'Adjust search or status.'} />
            ) : (
              <ul className="space-y-2">
                {filteredGuides.map(guide => (
                  <li key={guide.id}>
                    <button type="button" onClick={() => { setSelectedGuideId(guide.id); setGuideMode('view'); setAddToRunId('') }} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedGuideId === guide.id && guideMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{guide.title}</p>
                        <Pill tone={guideStatusTone(guide.status)}>{humanize(guide.status)}</Pill>
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
              <><h2 className="mb-4 text-lg font-black text-white">New content idea</h2><GuideForm initial={null} clients={clients} saving={guideSaving} error={guideError} onCancel={() => setGuideMode('view')} onSubmit={submitGuide} /></>
            ) : guideMode === 'edit' && selectedGuide ? (
              <><h2 className="mb-4 text-lg font-black text-white">Edit idea</h2><GuideForm initial={selectedGuide} clients={clients} saving={guideSaving} error={guideError} onCancel={() => setGuideMode('view')} onSubmit={submitGuide} /></>
            ) : selectedGuide ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">{clientName(clients, selectedGuide.client_id)}</p>
                    <h2 className="mt-1 break-words text-xl font-black text-white">{selectedGuide.title}</h2>
                  </div>
                  <ActionButton size="sm" variant="secondary" onClick={() => { setGuideMode('edit'); setGuideError(null) }}>Edit</ActionButton>
                </div>
                <div className="flex flex-wrap gap-2"><Pill tone={guideStatusTone(selectedGuide.status)}>{humanize(selectedGuide.status)}</Pill>{selectedGuide.platform && <Pill>{selectedGuide.platform}</Pill>}{selectedGuide.format && <Pill>{selectedGuide.format}</Pill>}{selectedGuide.deliverable_id && <Pill tone="teal">Linked to schedule</Pill>}</div>
                <div className="grid gap-2 text-sm text-white/70">
                  {selectedGuide.objective && <p><span className="text-white/35">Objective: </span>{selectedGuide.objective}</p>}
                  {selectedGuide.hook && <p><span className="text-white/35">Hook: </span>{selectedGuide.hook}</p>}
                  {selectedGuide.cta && <p><span className="text-white/35">CTA: </span>{selectedGuide.cta}</p>}
                  {selectedGuide.visual_notes && <p><span className="text-white/35">Visual/filming: </span>{selectedGuide.visual_notes}</p>}
                  {selectedGuide.owner_name && <p><span className="text-white/35">Owner: </span>{selectedGuide.owner_name}</p>}
                  {selectedGuide.proposed_post_date && <p><span className="text-white/35">Proposed post: </span>{selectedGuide.proposed_post_date}</p>}
                </div>
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
            ) : (
              <EmptyState title="Select an idea" message="Choose an idea to view and manage it, or create a new one." />
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
              {CONTENT_RUN_STATUSES.map(status => <option key={status} value={status}>{humanize(status)}</option>)}
            </select>
            {filteredRuns.length === 0 ? (
              <EmptyState title={runs.length === 0 ? 'No runs yet' : 'No runs match'} message={runs.length === 0 ? 'Create the first content run.' : 'Adjust search or status.'} />
            ) : (
              <ul className="space-y-2">
                {filteredRuns.map(run => (
                  <li key={run.id}>
                    <button type="button" onClick={() => { setSelectedRunId(run.id); setRunMode('view') }} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedRunId === run.id && runMode !== 'create' ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 break-words text-sm font-black text-white">{run.name}</p>
                        <Pill tone={runStatusTone(run.status)}>{humanize(run.status)}</Pill>
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
              <><h2 className="mb-4 text-lg font-black text-white">Edit run</h2><RunForm initial={selectedRun} clients={clients} saving={runSaving} error={runError} onCancel={() => setRunMode('view')} onSubmit={submitRun} /></>
            ) : selectedRun ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-brand-teal/80">{clientName(clients, selectedRun.client_id)}</p>
                    <h2 className="mt-1 break-words text-xl font-black text-white">{selectedRun.name}</h2>
                    <p className="mt-1 text-xs text-white/45">{selectedRun.run_date ?? 'No date'}{selectedRun.start_time ? ` · ${selectedRun.start_time.slice(0, 5)}` : ''}{selectedRun.location ? ` · ${selectedRun.location}` : ''}</p>
                  </div>
                  <ActionButton size="sm" variant="secondary" onClick={() => { setRunMode('edit'); setRunError(null) }}>Edit</ActionButton>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={runStatusTone(selectedRun.status)}>{humanize(selectedRun.status)}</Pill>
                  {selectedRun.lead_name && <Pill tone="teal">Lead: {selectedRun.lead_name}</Pill>}
                  {selectedRun.helper_names.map(helper => <Pill key={helper}>{helper}</Pill>)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/40">Set status:</span>
                  {CONTENT_RUN_STATUSES.map(status => (
                    <button key={status} type="button" onClick={() => void setRunStatus(status)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${selectedRun.status === status ? 'border-brand-teal/50 bg-brand-teal/10 text-brand-teal' : 'border-white/10 text-white/50 hover:text-white/80'}`}>{humanize(status)}</button>
                  ))}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Shot list ({runItems.length})</h3>
                    <div className="flex gap-2">
                      <ActionButton size="sm" variant="secondary" onClick={() => void addBlankShot()}>Add shot</ActionButton>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/40">Add approved ideas from the Content Guides tab. {approvedGuidesForRun.length} approved idea{approvedGuidesForRun.length === 1 ? '' : 's'} available there.</p>
                  {runItems.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-white/40">No shots yet.</p>
                  ) : (
                    <ol className="space-y-2">
                      {runItems.map((item, index) => (
                        <li key={item.id} className={`rounded-lg border p-3 ${item.completed ? 'border-emerald-300/25 bg-emerald-300/[0.05]' : 'border-white/10 bg-white/[0.025]'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white">{index + 1}. {item.title ?? 'Untitled shot'}</p>
                              {item.shot_notes && <p className="mt-1 text-xs text-white/55">{item.shot_notes}</p>}
                              {item.requirements && <p className="mt-1 text-xs text-amber-100/70">Needs: {item.requirements}</p>}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button type="button" onClick={() => void moveShot(item, -1)} disabled={index === 0} className="rounded px-1.5 text-white/50 hover:text-white disabled:opacity-30">↑</button>
                              <button type="button" onClick={() => void moveShot(item, 1)} disabled={index === runItems.length - 1} className="rounded px-1.5 text-white/50 hover:text-white disabled:opacity-30">↓</button>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <label className="flex items-center gap-1.5 text-xs text-white/60"><input type="checkbox" className="h-3.5 w-3.5 accent-teal-400" checked={item.completed} onChange={() => void toggleShotComplete(item)} />Done</label>
                            <button type="button" onClick={() => void removeShot(item)} className="text-xs text-red-300/80 hover:text-red-200">Remove</button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                {selectedRun.internal_notes && <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60">{selectedRun.internal_notes}</p>}
              </div>
            ) : (
              <EmptyState title="Select a run" message="Choose a run to manage its shot list and assignments, or create a new one." />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
