import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import type { ClientOption } from '../../lib/commandCentre'
import {
  listDeliverableLabels,
  listPipelineVideos,
  transitionVideo,
  updateGuideIdea,
  type ContentGuideIdea,
  type DeliverableLabel,
  type StaffProfileOption,
} from '../../lib/contentWorkflow'
import {
  VIDEO_PRODUCTION_STATUSES,
  VIDEO_STATUS_LABELS,
  availableVideoActions,
  buildCanonicalName,
  deriveClientCode,
  isSafeHttpUrl,
  videoNumberFromInstance,
  type VideoAction,
  type VideoProductionStatus,
} from '../../lib/videoPipelineRules'

// ── Video production pipeline workspace ───────────────────────────────────────
// Board grouped by production status + a readable video brief with the guarded
// workflow actions. All writes go through contentWorkflow.ts. The Client
// Schedule deliverable label is shown read-only; nothing here mutates it.

const INPUT_CLS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50'
const LABEL_CLS = 'block text-[11px] font-black uppercase tracking-[0.12em] text-white/40'

const ACTION_LABELS: Record<VideoAction, string> = {
  mark_shot: 'Mark shot',
  mark_footage_uploaded: 'Mark footage uploaded',
  start_editing: 'Start editing',
  send_to_internal_review: 'Send to internal review',
  request_internal_changes: 'Request internal changes',
  approve_internal: 'Approve internally · ready for client',
  resume_editing: 'Resume editing',
  mark_sent_to_client: 'Mark sent to client',
  request_client_changes: 'Request client changes',
  mark_client_approved: 'Mark client approved',
}

function statusTone(status: VideoProductionStatus): 'teal' | 'amber' | 'neutral' {
  if (status === 'client_approved' || status === 'ready_for_client') return 'teal'
  if (status === 'internal_changes' || status === 'client_changes') return 'amber'
  if (status === 'not_shot') return 'neutral'
  return 'amber'
}

function copyToClipboard(text: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(text)
}

function deliverableLabelText(label: DeliverableLabel | undefined): string | null {
  if (!label) return null
  return `${label.code} ${label.instance_number} · ${label.title}`
}

function clientName(clients: ClientOption[], id: string | null): string {
  if (!id) return 'No client'
  return clients.find(client => client.id === id)?.name ?? 'Unknown client'
}

// ── Edit form ─────────────────────────────────────────────────────────────────

interface VideoFormState {
  title: string
  folder_client_code: string
  video_number: string
  objective: string
  hook: string
  script: string
  shot_breakdown: string
  cta: string
  requirements: string
  visual_notes: string
  notes: string
  editor_user_id: string
  onedrive_footage_url: string
  onedrive_internal_review_url: string
  onedrive_client_approval_url: string
  onedrive_final_url: string
  production_note: string
}

function toForm(idea: ContentGuideIdea, defaultVideoNumber: number | null): VideoFormState {
  return {
    title: idea.title,
    folder_client_code: idea.folder_client_code ?? '',
    video_number: idea.video_number != null ? String(idea.video_number) : (defaultVideoNumber != null ? String(defaultVideoNumber) : ''),
    objective: idea.objective ?? '',
    hook: idea.hook ?? '',
    script: idea.script ?? '',
    shot_breakdown: idea.shot_breakdown ?? '',
    cta: idea.cta ?? '',
    requirements: idea.requirements ?? '',
    visual_notes: idea.visual_notes ?? '',
    notes: idea.notes ?? '',
    editor_user_id: idea.editor_user_id ?? '',
    onedrive_footage_url: idea.onedrive_footage_url ?? '',
    onedrive_internal_review_url: idea.onedrive_internal_review_url ?? '',
    onedrive_client_approval_url: idea.onedrive_client_approval_url ?? '',
    onedrive_final_url: idea.onedrive_final_url ?? '',
    production_note: idea.production_note ?? '',
  }
}

function VideoEditForm({
  idea, clients, staff, deliverableNumber, deliverableLinked, saving, error, onCancel, onSave,
}: {
  idea: ContentGuideIdea
  clients: ClientOption[]
  staff: StaffProfileOption[]
  deliverableNumber: number | null
  deliverableLinked: boolean
  saving: boolean
  error: string | null
  onCancel: () => void
  onSave: (patch: Partial<ContentGuideIdea>) => void
}) {
  const [form, setForm] = useState<VideoFormState>(toForm(idea, deliverableNumber))
  const set = <K extends keyof VideoFormState>(key: K, value: VideoFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  const effectiveCode = (form.folder_client_code.trim() || deriveClientCode(clientName(clients, idea.client_id)))
  const effectiveNumber = form.video_number.trim() ? Number(form.video_number) : deliverableNumber
  const canonical = buildCanonicalName({
    month: idea.month,
    clientCode: effectiveCode,
    videoNumber: Number.isFinite(effectiveNumber as number) ? (effectiveNumber as number) : null,
    conceptTitle: form.title,
  })
  const canonicalChanged = Boolean(idea.onedrive_footage_url) && canonical !== (idea.canonical_name ?? '')

  const urlFields: Array<[keyof VideoFormState, string]> = [
    ['onedrive_footage_url', 'Footage folder'],
    ['onedrive_internal_review_url', 'Internal review'],
    ['onedrive_client_approval_url', 'Client approval'],
    ['onedrive_final_url', 'Final export'],
  ]
  const invalidUrl = urlFields.find(([key]) => form[key].trim() && !isSafeHttpUrl(form[key]))

  function submit() {
    if (invalidUrl) return
    const editor = staff.find(person => person.id === form.editor_user_id) ?? null
    const num = form.video_number.trim() ? Number(form.video_number) : null
    onSave({
      title: form.title.trim(),
      folder_client_code: form.folder_client_code.trim() || null,
      video_number: Number.isFinite(num as number) ? (num as number) : null,
      canonical_name: canonical || null,
      objective: form.objective.trim() || null,
      hook: form.hook.trim() || null,
      script: form.script.trim() || null,
      shot_breakdown: form.shot_breakdown.trim() || null,
      cta: form.cta.trim() || null,
      requirements: form.requirements.trim() || null,
      visual_notes: form.visual_notes.trim() || null,
      notes: form.notes.trim() || null,
      editor_user_id: form.editor_user_id || null,
      editor_name: editor?.full_name ?? null,
      onedrive_footage_url: form.onedrive_footage_url.trim() || null,
      onedrive_internal_review_url: form.onedrive_internal_review_url.trim() || null,
      onedrive_client_approval_url: form.onedrive_client_approval_url.trim() || null,
      onedrive_final_url: form.onedrive_final_url.trim() || null,
      production_note: form.production_note.trim() || null,
    })
  }

  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (form.title.trim()) submit() }}>
      <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/[0.05] p-3">
        <p className={LABEL_CLS}>Canonical video / folder name</p>
        <p className="mt-1 break-all font-mono text-sm font-bold text-white">{canonical || '—'}</p>
        {canonicalChanged && <p className="mt-1 text-xs text-amber-200">Footage already exists — changing this name will not rename the OneDrive folder. Update the folder manually if needed.</p>}
      </div>

      <label className="block space-y-1.5"><span className={LABEL_CLS}>Concept title *</span><input className={INPUT_CLS} value={form.title} onChange={event => set('title', event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Folder client code</span><input className={INPUT_CLS} value={form.folder_client_code} onChange={event => set('folder_client_code', event.target.value)} placeholder={deriveClientCode(clientName(clients, idea.client_id))} /></label>
        <label className="block space-y-1.5">
          <span className={LABEL_CLS}>Video number{deliverableLinked ? ' (from schedule)' : ''}</span>
          <input className={INPUT_CLS} inputMode="numeric" value={form.video_number} onChange={event => set('video_number', event.target.value)} disabled={deliverableLinked} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Objective</span><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.objective} onChange={event => set('objective', event.target.value)} /></label>
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Hook / opening</span><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.hook} onChange={event => set('hook', event.target.value)} /></label>
      </div>
      <label className="block space-y-1.5"><span className={LABEL_CLS}>Script / dialogue</span><textarea className={`${INPUT_CLS} min-h-[72px]`} value={form.script} onChange={event => set('script', event.target.value)} /></label>
      <label className="block space-y-1.5"><span className={LABEL_CLS}>Shot-by-shot breakdown</span><textarea className={`${INPUT_CLS} min-h-[88px]`} value={form.shot_breakdown} onChange={event => set('shot_breakdown', event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className={LABEL_CLS}>On-screen text / CTA</span><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.cta} onChange={event => set('cta', event.target.value)} /></label>
        <label className="block space-y-1.5"><span className={LABEL_CLS}>People, products & props</span><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.requirements} onChange={event => set('requirements', event.target.value)} /></label>
      </div>
      <label className="block space-y-1.5"><span className={LABEL_CLS}>Visual / filming notes</span><textarea className={`${INPUT_CLS} min-h-[56px]`} value={form.visual_notes} onChange={event => set('visual_notes', event.target.value)} /></label>
      <label className="block space-y-1.5"><span className={LABEL_CLS}>Internal notes</span><textarea className={`${INPUT_CLS} min-h-[48px]`} value={form.notes} onChange={event => set('notes', event.target.value)} /></label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={LABEL_CLS}>Editor</span>
          <select className={INPUT_CLS} value={form.editor_user_id} onChange={event => set('editor_user_id', event.target.value)}>
            <option value="">Unassigned</option>
            {staff.map(person => <option key={person.id} value={person.id}>{person.full_name ?? person.id}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Latest production note</span><input className={INPUT_CLS} value={form.production_note} onChange={event => set('production_note', event.target.value)} /></label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {urlFields.map(([key, label]) => (
          <label key={key} className="block space-y-1.5">
            <span className={LABEL_CLS}>{label} link</span>
            <input className={`${INPUT_CLS} ${form[key].trim() && !isSafeHttpUrl(form[key]) ? 'border-red-400/50' : ''}`} value={form[key]} onChange={event => set(key, event.target.value)} placeholder="https://…" />
          </label>
        ))}
      </div>
      {invalidUrl && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">Links must be ordinary https:// URLs.</p>}
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!form.title.trim() || Boolean(invalidUrl)}>Save video</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Readable brief + actions ──────────────────────────────────────────────────

function LinkRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/40">{label}</span>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-teal hover:text-white">Open</a> : <span className="text-white/30">Not set</span>}
    </div>
  )
}

function Section({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className={LABEL_CLS}>{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{value}</p>
    </div>
  )
}

function VideoBrief({
  idea, clients, deliverableLabel, busy, actionError, onEdit, onAction,
}: {
  idea: ContentGuideIdea
  clients: ClientOption[]
  deliverableLabel: string | null
  busy: boolean
  actionError: string | null
  onEdit: () => void
  onAction: (action: VideoAction) => void
}) {
  const [copied, setCopied] = useState(false)
  const actions = availableVideoActions(idea.production_status)
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_45%)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={LABEL_CLS}>Canonical name</p>
            <p className="mt-1 break-all font-mono text-sm font-black text-white">{idea.canonical_name ?? '—'}</p>
          </div>
          {idea.canonical_name && (
            <ActionButton size="sm" variant="secondary" onClick={() => { copyToClipboard(idea.canonical_name as string); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied' : 'Copy folder name'}</ActionButton>
          )}
        </div>
        <h2 className="mt-3 break-words text-xl font-black text-white">{idea.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill>{clientName(clients, idea.client_id)}</Pill>
          {idea.month && <Pill>{idea.month.slice(0, 7)}</Pill>}
          {deliverableLabel && <Pill tone="teal">{deliverableLabel}</Pill>}
          <Pill tone={statusTone(idea.production_status)}>{VIDEO_STATUS_LABELS[idea.production_status]}</Pill>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Production brief</h3>
        <ActionButton size="sm" variant="secondary" onClick={onEdit}>Edit video</ActionButton>
      </div>
      <div className="space-y-4">
        <Section label="Objective" value={idea.objective} />
        <Section label="Hook / opening" value={idea.hook} />
        <Section label="Script / dialogue" value={idea.script} />
        <Section label="Shot-by-shot breakdown" value={idea.shot_breakdown} />
        <Section label="On-screen text / CTA" value={idea.cta} />
        <Section label="People, products & props" value={idea.requirements} />
        <Section label="Visual / filming notes" value={idea.visual_notes} />
        <Section label="Internal notes" value={idea.notes} />
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Production</h3>
        <div className="grid gap-2 text-sm text-white/70 sm:grid-cols-2">
          <p><span className="text-white/40">Editor: </span>{idea.editor_name ?? 'Unassigned'}</p>
          <p><span className="text-white/40">Status: </span>{VIDEO_STATUS_LABELS[idea.production_status]}</p>
        </div>
        {idea.production_note && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">{idea.production_note}</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <LinkRow label="Footage folder" url={idea.onedrive_footage_url} />
          <LinkRow label="Internal review" url={idea.onedrive_internal_review_url} />
          <LinkRow label="Client approval" url={idea.onedrive_client_approval_url} />
          <LinkRow label="Final export" url={idea.onedrive_final_url} />
        </div>
        {idea.production_status === 'client_approved' && (
          <p className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-2 text-xs text-emerald-100">Client approved. The linked Client Schedule item now owns Scheduled / Posted — this pipeline does not change it.</p>
        )}
        {actionError && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{actionError}</p>}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {actions.map(action => (
              <ActionButton key={action} size="sm" variant={action.startsWith('request') ? 'secondary' : 'primary'} loading={busy} disabled={busy} onClick={() => onAction(action)}>
                {ACTION_LABELS[action]}
              </ActionButton>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Board card ────────────────────────────────────────────────────────────────

function BoardCard({ idea, clients, deliverableLabel, selected, onOpen }: { idea: ContentGuideIdea; clients: ClientOption[]; deliverableLabel: string | null; selected: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`w-full rounded-xl border p-3 text-left transition-colors ${selected ? 'border-brand-teal/45 bg-brand-teal/[0.07]' : 'border-white/10 bg-white/[0.025] hover:border-white/20'}`}>
      <p className="break-all font-mono text-[11px] text-white/50">{idea.canonical_name ?? '(no canonical name)'}</p>
      <p className="mt-1 break-words text-sm font-black text-white">{idea.title}</p>
      <p className="mt-1 text-xs text-white/45">{clientName(clients, idea.client_id)}{idea.month ? ` · ${idea.month.slice(0, 7)}` : ''}</p>
      {deliverableLabel && <p className="mt-1 text-[11px] text-brand-teal/80">{deliverableLabel}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill tone={statusTone(idea.production_status)}>{VIDEO_STATUS_LABELS[idea.production_status]}</Pill>
        {idea.editor_name && <span className="text-[11px] text-white/45">{idea.editor_name}</span>}
        {idea.onedrive_footage_url && <span className="text-[11px] text-emerald-300/70">footage ✓</span>}
      </div>
    </button>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function VideoPipelineTab({ clients, staff }: { clients: ClientOption[]; staff: StaffProfileOption[] }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [migrationNeeded, setMigrationNeeded] = useState(false)
  const [videos, setVideos] = useState<ContentGuideIdea[]>([])
  const [labels, setLabels] = useState<Map<string, DeliverableLabel>>(new Map())

  const [clientFilter, setClientFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [editorFilter, setEditorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<VideoProductionStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const result = await listPipelineVideos()
    if (result.migrationNeeded) { setMigrationNeeded(true); setLoading(false); return }
    setMigrationNeeded(false)
    if (result.error) { setError(result.error); setLoading(false); return }
    setVideos(result.data)
    const deliverableIds = [...new Set(result.data.map(video => video.deliverable_id).filter((id): id is string => Boolean(id)))]
    const labelResult = await listDeliverableLabels(deliverableIds)
    if (!labelResult.error) setLabels(new Map(labelResult.data.map(label => [label.id, label])))
    setLoading(false)
  }
  const loadEvent = useEffectEvent(load)
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const selected = videos.find(video => video.id === selectedId) ?? null
  const selectedDeliverable = selected?.deliverable_id ? labels.get(selected.deliverable_id) : undefined
  const selectedDeliverableNumber = selectedDeliverable ? videoNumberFromInstance(selectedDeliverable.instance_number) : null

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return videos.filter(video => {
      if (clientFilter && video.client_id !== clientFilter) return false
      if (monthFilter && (video.month ?? '').slice(0, 7) !== monthFilter) return false
      if (editorFilter && video.editor_user_id !== editorFilter) return false
      if (statusFilter !== 'all' && video.production_status !== statusFilter) return false
      if (!query) return true
      return [video.title, video.canonical_name ?? '', clientName(clients, video.client_id)].some(field => field.toLowerCase().includes(query))
    })
  }, [videos, clientFilter, monthFilter, editorFilter, statusFilter, search, clients])

  const grouped = useMemo(() => {
    const map = new Map<VideoProductionStatus, ContentGuideIdea[]>()
    for (const status of VIDEO_PRODUCTION_STATUSES) map.set(status, [])
    for (const video of filtered) map.get(video.production_status)?.push(video)
    return map
  }, [filtered])

  const months = useMemo(() => [...new Set(videos.map(video => (video.month ?? '').slice(0, 7)).filter(Boolean))].sort(), [videos])

  async function saveVideo(patch: Partial<ContentGuideIdea>) {
    if (!selected) return
    setSaving(true); setActionError(null)
    const result = await updateGuideIdea(selected.id, patch)
    setSaving(false)
    if (result.error) { setActionError(result.error); return }
    await load()
    setEditing(false)
  }

  async function runAction(action: VideoAction) {
    if (!selected) return
    setBusy(true); setActionError(null)
    const result = await transitionVideo(selected, action, {
      footageUrl: selected.onedrive_footage_url,
      clientApprovalUrl: selected.onedrive_client_approval_url,
      editorUserId: selected.editor_user_id,
      editorName: selected.editor_name,
    })
    setBusy(false)
    if (result.error) { setActionError(result.error); return }
    await load()
  }

  if (migrationNeeded) {
    return (
      <div className="mt-6 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/70">Migration required</p>
        <h2 className="mt-2 text-xl font-black text-white">The video pipeline columns are not in the database yet</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">Review and apply <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs text-amber-100">supabase/phase-19e-video-production-pipeline.sql</code> in the Supabase SQL editor.</p>
      </div>
    )
  }
  if (loading) return <LoadingState className="mt-8" message="Loading video pipeline…" />
  if (error) return <EmptyState className="mt-8" title="Could not load the video pipeline" message={error} action={<ActionButton variant="secondary" onClick={() => void load()}>Try again</ActionButton>} />

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap gap-2">
        <input className={`${INPUT_CLS} w-auto flex-1`} placeholder="Search canonical name or concept" value={search} onChange={event => setSearch(event.target.value)} />
        <select className={`${INPUT_CLS} w-auto`} value={clientFilter} onChange={event => setClientFilter(event.target.value)}>
          <option value="">All clients</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <select className={`${INPUT_CLS} w-auto`} value={monthFilter} onChange={event => setMonthFilter(event.target.value)}>
          <option value="">All months</option>
          {months.map(month => <option key={month} value={month}>{month}</option>)}
        </select>
        <select className={`${INPUT_CLS} w-auto`} value={editorFilter} onChange={event => setEditorFilter(event.target.value)}>
          <option value="">All editors</option>
          {staff.map(person => <option key={person.id} value={person.id}>{person.full_name ?? person.id}</option>)}
        </select>
        <select className={`${INPUT_CLS} w-auto`} value={statusFilter} onChange={event => setStatusFilter(event.target.value as VideoProductionStatus | 'all')}>
          <option value="all">All statuses</option>
          {VIDEO_PRODUCTION_STATUSES.map(status => <option key={status} value={status}>{VIDEO_STATUS_LABELS[status]}</option>)}
        </select>
      </div>

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.5fr)]">
          <section className="space-y-2">
            <ActionButton size="sm" variant="ghost" onClick={() => { setSelectedId(null); setEditing(false) }}>← Back to board</ActionButton>
            {filtered.map(video => (
              <BoardCard key={video.id} idea={video} clients={clients} deliverableLabel={deliverableLabelText(video.deliverable_id ? labels.get(video.deliverable_id) : undefined)} selected={video.id === selectedId} onOpen={() => { setSelectedId(video.id); setEditing(false); setActionError(null) }} />
            ))}
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
            {editing ? (
              <VideoEditForm
                idea={selected}
                clients={clients}
                staff={staff}
                deliverableNumber={selectedDeliverableNumber}
                deliverableLinked={Boolean(selected.deliverable_id)}
                saving={saving}
                error={actionError}
                onCancel={() => setEditing(false)}
                onSave={saveVideo}
              />
            ) : (
              <VideoBrief
                idea={selected}
                clients={clients}
                deliverableLabel={deliverableLabelText(selectedDeliverable)}
                busy={busy}
                actionError={actionError}
                onEdit={() => { setEditing(true); setActionError(null) }}
                onAction={runAction}
              />
            )}
          </section>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={videos.length === 0 ? 'No videos yet' : 'No videos match your filters'} message={videos.length === 0 ? 'Create a content idea linked to a Client Schedule deliverable in the Content Guides tab — it becomes a tracked video here.' : 'Adjust the filters above.'} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {VIDEO_PRODUCTION_STATUSES.map(status => {
            const items = grouped.get(status) ?? []
            return (
              <div key={status} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white/45">{VIDEO_STATUS_LABELS[status]}</p>
                  <span className="text-[11px] text-white/35">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map(video => (
                    <BoardCard key={video.id} idea={video} clients={clients} deliverableLabel={deliverableLabelText(video.deliverable_id ? labels.get(video.deliverable_id) : undefined)} selected={false} onOpen={() => { setSelectedId(video.id); setEditing(false); setActionError(null) }} />
                  ))}
                  {items.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-2 py-3 text-center text-[11px] text-white/25">—</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
