import { useEffect, useState, type ReactNode } from 'react'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import type { ClientOption } from '../../lib/commandCentre'
import { listMonthlyDeliverablesByMonth, type MonthlyDeliverable } from '../../lib/planner'
import type { ContentGuideIdea, ContentGuideInput, StaffProfileOption } from '../../lib/contentWorkflow'
import {
  VIDEO_STATUS_LABELS,
  buildCanonicalName,
  deriveClientCode,
  isSafeHttpUrl,
  videoNumberFromInstance,
} from '../../lib/videoPipelineRules'
import {
  INPUT_CLS,
  LABEL_CLS,
  clientName,
  contentGuidelineDeliverableLabel,
  contentGuidelineVideoChoices,
  copyToClipboard,
  guideStatusTone,
  humanizeStatus,
  videoStatusTone,
} from './contentGuidelineHelpers'

// ── Shared Content Guideline UI ──────────────────────────────────────────────
//
// One content_guide_ideas row is one real video Content Guideline. These shared
// components render the SAME record as a full brief everywhere staff work — the
// Content Guidelines tab, the Video Pipeline board and inside a Content Run —
// so nobody has to jump between disconnected screens to see what to film. No
// second guideline/video table, no duplicated form logic. Non-component helpers
// live in ./contentGuidelineHelpers so this file exports only components.

// A copy-to-clipboard button for the canonical folder name.
export function CopyFolderButton({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false)
  return (
    <ActionButton size={size} variant="secondary" onClick={() => { copyToClipboard(name); setCopied(true); window.setTimeout(() => setCopied(false), 1500) }}>
      {copied ? 'Copied' : 'Copy folder name'}
    </ActionButton>
  )
}

// A brief section that preserves line breaks and hides itself when empty.
export function Section({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className={LABEL_CLS}>{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{value}</p>
    </div>
  )
}

export function LinkRow({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/40">{label}</span>
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="truncate text-brand-teal hover:text-white">Open</a> : <span className="text-white/30">Not set</span>}
    </div>
  )
}

// ── Full guideline form (create + edit) ──────────────────────────────────────

interface GuidelineFormState {
  client_id: string
  month: string            // YYYY-MM
  deliverable_id: string
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
  owner_name: string
  editor_user_id: string
  proposed_post_date: string
  production_note: string
  onedrive_footage_url: string
  onedrive_internal_review_url: string
  onedrive_client_approval_url: string
  onedrive_final_url: string
}

function toFormState(idea: ContentGuideIdea | null): GuidelineFormState {
  return {
    client_id: idea?.client_id ?? '',
    month: idea?.month ? idea.month.slice(0, 7) : '',
    deliverable_id: idea?.deliverable_id ?? '',
    title: idea?.title ?? '',
    folder_client_code: idea?.folder_client_code ?? '',
    video_number: idea?.video_number != null ? String(idea.video_number) : '',
    objective: idea?.objective ?? '',
    hook: idea?.hook ?? '',
    script: idea?.script ?? '',
    shot_breakdown: idea?.shot_breakdown ?? '',
    cta: idea?.cta ?? '',
    requirements: idea?.requirements ?? '',
    visual_notes: idea?.visual_notes ?? '',
    notes: idea?.notes ?? '',
    owner_name: idea?.owner_name ?? '',
    editor_user_id: idea?.editor_user_id ?? '',
    proposed_post_date: idea?.proposed_post_date ?? '',
    production_note: idea?.production_note ?? '',
    onedrive_footage_url: idea?.onedrive_footage_url ?? '',
    onedrive_internal_review_url: idea?.onedrive_internal_review_url ?? '',
    onedrive_client_approval_url: idea?.onedrive_client_approval_url ?? '',
    onedrive_final_url: idea?.onedrive_final_url ?? '',
  }
}

// The single full-brief form used to CREATE and EDIT a Content Guideline. The
// canonical name uses the tested helper; a linked deliverable supplies the
// video number (and is shown read-only). OneDrive links are optional during
// planning and validated only when present. Nothing here mutates the Client
// Schedule deliverable — its label is shown for reference only.
export function GuidelineForm({
  initial, clients, staff, saving, error, onCancel, onSubmit,
}: {
  initial: ContentGuideIdea | null
  clients: ClientOption[]
  staff: StaffProfileOption[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: ContentGuideInput) => void
}) {
  const [form, setForm] = useState<GuidelineFormState>(toFormState(initial))
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const set = <K extends keyof GuidelineFormState>(key: K, value: GuidelineFormState[K]) => setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const clientId = form.client_id
    const month = form.month
    let active = true
    const timer = window.setTimeout(() => {
      if (!clientId || !month) {
        setDeliverables([])
        return
      }
      void listMonthlyDeliverablesByMonth(month, { clientId, deliverableType: 'video' }).then(({ data }) => {
        if (active) setDeliverables(contentGuidelineVideoChoices((data ?? []) as MonthlyDeliverable[], clientId, month))
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [form.client_id, form.month])

  const resolvedClientName = form.client_id ? (clients.find(client => client.id === form.client_id)?.name ?? null) : null
  const linkedDeliverable = form.deliverable_id ? deliverables.find(d => d.id === form.deliverable_id) : undefined
  const deliverableNumber = linkedDeliverable ? videoNumberFromInstance(linkedDeliverable.instance_number) : null
  const deliverableLinked = Boolean(form.deliverable_id)

  const effectiveCode = form.folder_client_code.trim() || deriveClientCode(resolvedClientName)
  const effectiveNumber = deliverableLinked && deliverableNumber != null
    ? deliverableNumber
    : (form.video_number.trim() ? Number(form.video_number) : null)
  const canonical = buildCanonicalName({
    month: form.month ? `${form.month}-01` : null,
    clientCode: effectiveCode,
    videoNumber: Number.isFinite(effectiveNumber as number) ? (effectiveNumber as number) : null,
    conceptTitle: form.title,
  })

  const urlFields: Array<[keyof GuidelineFormState, string]> = [
    ['onedrive_footage_url', 'Footage folder'],
    ['onedrive_internal_review_url', 'Internal review'],
    ['onedrive_client_approval_url', 'Client approval'],
    ['onedrive_final_url', 'Final export'],
  ]
  const invalidUrl = urlFields.find(([key]) => form[key].trim() && !isSafeHttpUrl(form[key]))

  function submit() {
    if (invalidUrl || !form.title.trim()) return
    const editor = staff.find(person => person.id === form.editor_user_id) ?? null
    const num = deliverableLinked && deliverableNumber != null
      ? deliverableNumber
      : (form.video_number.trim() ? Number(form.video_number) : null)
    onSubmit({
      client_id: form.client_id || null,
      client_name: resolvedClientName,
      month: form.month ? `${form.month}-01` : null,
      deliverable_id: form.deliverable_id || null,
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
      owner_name: form.owner_name.trim() || null,
      editor_user_id: form.editor_user_id || null,
      editor_name: editor?.full_name ?? null,
      proposed_post_date: form.proposed_post_date || null,
      production_note: form.production_note.trim() || null,
      onedrive_footage_url: form.onedrive_footage_url.trim() || null,
      onedrive_internal_review_url: form.onedrive_internal_review_url.trim() || null,
      onedrive_client_approval_url: form.onedrive_client_approval_url.trim() || null,
      onedrive_final_url: form.onedrive_final_url.trim() || null,
    })
  }

  return (
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); submit() }}>
      <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/[0.05] p-3">
        <p className={LABEL_CLS}>Canonical video / folder name</p>
        <p className="mt-1 break-all font-mono text-sm font-bold text-white">{canonical || '—'}</p>
      </div>

      {/* Schedule identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={LABEL_CLS}>Client</span>
          <select className={INPUT_CLS} value={form.client_id} onChange={event => { setDeliverables([]); setForm(prev => ({ ...prev, client_id: event.target.value, deliverable_id: '', video_number: '' })) }}>
            <option value="">No client</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Month</span><input type="month" className={INPUT_CLS} value={form.month} onChange={event => { setDeliverables([]); setForm(prev => ({ ...prev, month: event.target.value, deliverable_id: '', video_number: '' })) }} /></label>
      </div>
      <label className="block space-y-1.5">
        <span className={LABEL_CLS}>Linked Client Schedule deliverable</span>
        <select className={INPUT_CLS} value={form.deliverable_id} onChange={event => set('deliverable_id', event.target.value)} disabled={!form.client_id || !form.month}>
          <option value="">Not linked</option>
          {deliverables.map(deliverable => <option key={deliverable.id} value={deliverable.id}>{contentGuidelineDeliverableLabel(deliverable)}</option>)}
        </select>
      </label>

      <label className="block space-y-1.5"><span className={LABEL_CLS}>Concept title *</span><input className={INPUT_CLS} value={form.title} onChange={event => set('title', event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Folder client code</span><input className={INPUT_CLS} value={form.folder_client_code} onChange={event => set('folder_client_code', event.target.value)} placeholder={deriveClientCode(resolvedClientName)} /></label>
        <label className="block space-y-1.5">
          <span className={LABEL_CLS}>Video number{deliverableLinked ? ' (from schedule)' : ''}</span>
          <input className={INPUT_CLS} inputMode="numeric" value={deliverableLinked && deliverableNumber != null ? String(deliverableNumber) : form.video_number} onChange={event => set('video_number', event.target.value)} disabled={deliverableLinked} />
        </label>
      </div>

      {/* Planning brief */}
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

      {/* Responsibility & production */}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Guide owner</span><input className={INPUT_CLS} value={form.owner_name} onChange={event => set('owner_name', event.target.value)} placeholder="Staff name" /></label>
        <label className="block space-y-1.5">
          <span className={LABEL_CLS}>Assigned editor</span>
          <select className={INPUT_CLS} value={form.editor_user_id} onChange={event => set('editor_user_id', event.target.value)}>
            <option value="">Unassigned</option>
            {staff.map(person => <option key={person.id} value={person.id}>{person.full_name ?? person.id}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5"><span className={LABEL_CLS}>Proposed posting date</span><input type="date" className={INPUT_CLS} value={form.proposed_post_date} onChange={event => set('proposed_post_date', event.target.value)} /></label>
      </div>
      <label className="block space-y-1.5"><span className={LABEL_CLS}>Latest production note</span><input className={INPUT_CLS} value={form.production_note} onChange={event => set('production_note', event.target.value)} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        {urlFields.map(([key, label]) => (
          <label key={key} className="block space-y-1.5">
            <span className={LABEL_CLS}>{label} link</span>
            <input className={`${INPUT_CLS} ${form[key].trim() && !isSafeHttpUrl(form[key]) ? 'border-red-400/50' : ''}`} value={form[key]} onChange={event => set(key, event.target.value)} placeholder="https://… (optional during planning)" />
          </label>
        ))}
      </div>
      {invalidUrl && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">Links must be ordinary https:// URLs.</p>}
      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="flex items-center gap-3">
        <ActionButton type="submit" loading={saving} disabled={!form.title.trim() || Boolean(invalidUrl)}>Save guideline</ActionButton>
        <ActionButton type="button" variant="ghost" onClick={onCancel}>Cancel</ActionButton>
      </div>
    </form>
  )
}

// ── Full readable brief ──────────────────────────────────────────────────────

// The full production brief for one guideline: canonical name + copy, concept
// title, schedule identity, statuses, owner/editor, all brief sections and the
// production links. `onEdit` renders an Edit button; `footer` is a slot for
// context actions (guideline approval actions, or pipeline transitions).
export function GuidelineBrief({
  idea, clients, deliverableLabel, onEdit, footer,
}: {
  idea: ContentGuideIdea
  clients: ClientOption[]
  deliverableLabel: string | null
  onEdit?: () => void
  footer?: ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_45%)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={LABEL_CLS}>Canonical name</p>
            <p className="mt-1 break-all font-mono text-sm font-black text-white">{idea.canonical_name ?? '—'}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {idea.canonical_name && <CopyFolderButton name={idea.canonical_name} />}
            {onEdit && <ActionButton size="sm" variant="secondary" onClick={onEdit}>Edit guideline</ActionButton>}
          </div>
        </div>
        <h2 className="mt-3 break-words text-xl font-black text-white">{idea.title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Pill>{clientName(clients, idea.client_id)}</Pill>
          {idea.month && <Pill>{idea.month.slice(0, 7)}</Pill>}
          {deliverableLabel && <Pill tone="teal">{deliverableLabel}</Pill>}
          <Pill tone={guideStatusTone(idea.status)}>{humanizeStatus(idea.status)}</Pill>
          <Pill tone={videoStatusTone(idea.production_status)}>{VIDEO_STATUS_LABELS[idea.production_status]}</Pill>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55">
          <span>Owner: {idea.owner_name ?? '—'}</span>
          <span>Editor: {idea.editor_name ?? 'Unassigned'}</span>
          {idea.proposed_post_date && <span>Proposed post: {idea.proposed_post_date}</span>}
        </div>
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
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Production links</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <LinkRow label="Footage" url={idea.onedrive_footage_url} />
          <LinkRow label="Internal review" url={idea.onedrive_internal_review_url} />
          <LinkRow label="Client approval" url={idea.onedrive_client_approval_url} />
          <LinkRow label="Final export" url={idea.onedrive_final_url} />
        </div>
        {idea.production_note && <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">{idea.production_note}</p>}
      </div>

      {footer}
    </div>
  )
}

// ── Linked guideline card (inside a Content Run) ─────────────────────────────

// A linked guideline shown inside a Content Run. Collapsed it shows identity and
// status; expanded it shows the full filming brief so staff never leave the run
// to see what to film. Actions: open/edit the guideline, copy the folder name,
// mark the video shot (guarded transition), open footage, and unlink.
export function GuidelineCard({
  idea, clients, deliverableLabel, marking, actionError, onOpen, onEdit, onMarkShot, onUnlink,
}: {
  idea: ContentGuideIdea
  clients: ClientOption[]
  deliverableLabel: string | null
  marking: boolean
  actionError: string | null
  onOpen: () => void
  onEdit: () => void
  onMarkShot: () => void
  onUnlink: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasBrief = Boolean(idea.objective || idea.hook || idea.script || idea.shot_breakdown || idea.cta || idea.requirements || idea.visual_notes || idea.notes)
  return (
    <div className="rounded-xl border border-brand-teal/20 bg-brand-teal/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-all font-mono text-[11px] text-white/50">{idea.canonical_name ?? '(no canonical name)'}</p>
          <p className="mt-0.5 break-words text-sm font-black text-white">{idea.title}</p>
          <p className="mt-1 text-xs text-white/45">{clientName(clients, idea.client_id)}{deliverableLabel ? ` · ${deliverableLabel}` : ''}</p>
        </div>
        <button type="button" onClick={() => setExpanded(prev => !prev)} className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[11px] font-bold text-white/60 hover:text-white" aria-expanded={expanded}>
          {expanded ? 'Hide brief' : 'Show brief'}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill tone={guideStatusTone(idea.status)}>{humanizeStatus(idea.status)}</Pill>
        <Pill tone={videoStatusTone(idea.production_status)}>{VIDEO_STATUS_LABELS[idea.production_status]}</Pill>
        {idea.editor_name && <span className="text-[11px] text-white/45">{idea.editor_name}</span>}
        {idea.onedrive_footage_url ? <span className="text-[11px] text-emerald-300/70">footage ✓</span> : <span className="text-[11px] text-white/30">no footage yet</span>}
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          {hasBrief ? (
            <>
              <Section label="Objective" value={idea.objective} />
              <Section label="Hook / opening" value={idea.hook} />
              <Section label="Script / dialogue" value={idea.script} />
              <Section label="Shot-by-shot breakdown" value={idea.shot_breakdown} />
              <Section label="On-screen text / CTA" value={idea.cta} />
              <Section label="People, products & props" value={idea.requirements} />
              <Section label="Visual / filming notes" value={idea.visual_notes} />
              <Section label="Internal notes" value={idea.notes} />
            </>
          ) : (
            <p className="text-xs text-white/40">No brief details captured yet — open the guideline to add them.</p>
          )}
        </div>
      )}

      {actionError && <p className="mt-2 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-1.5 text-xs text-red-200">{actionError}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <ActionButton size="sm" variant="secondary" onClick={onOpen}>Open full guideline</ActionButton>
        <ActionButton size="sm" variant="ghost" onClick={onEdit}>Edit guideline</ActionButton>
        {idea.canonical_name && <CopyFolderButton name={idea.canonical_name} />}
        {idea.production_status === 'not_shot' && <ActionButton size="sm" loading={marking} disabled={marking} onClick={onMarkShot}>Mark video shot</ActionButton>}
        {idea.onedrive_footage_url && <a href={idea.onedrive_footage_url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-brand-teal hover:text-white">Open footage →</a>}
        <button type="button" onClick={onUnlink} className="ml-auto text-xs text-red-300/80 hover:text-red-200">Unlink</button>
      </div>
    </div>
  )
}

// ── Mobile shoot mode ────────────────────────────────────────────────────────

// A focused, phone-friendly shoot view: one linked guideline at a time with the
// filming essentials (requirements, script, shot breakdown, notes), prev/next
// navigation, copy folder name and mark-shot. No editing-board clutter.
export function ShootMode({
  runName, runDate, runLocation, guidelines, clients, marking, onClose, onMarkShot,
}: {
  runName: string
  runDate: string | null
  runLocation: string | null
  guidelines: ContentGuideIdea[]
  clients: ClientOption[]
  marking: boolean
  onClose: () => void
  onMarkShot: (idea: ContentGuideIdea) => void
}) {
  const [index, setIndex] = useState(0)
  const total = guidelines.length
  const idea = guidelines[Math.min(index, Math.max(0, total - 1))] ?? null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0b0b0b]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{runName}</p>
          <p className="truncate text-[11px] text-white/45">{runDate ?? 'No date'}{runLocation ? ` · ${runLocation}` : ''} · {total} video{total === 1 ? '' : 's'}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white/70 hover:text-white">Exit shoot mode</button>
      </div>

      {idea ? (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mx-auto max-w-lg space-y-4">
            <div className="rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.05] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="break-all font-mono text-xs text-white/60">{idea.canonical_name ?? '—'}</p>
                {idea.canonical_name && <CopyFolderButton name={idea.canonical_name} />}
              </div>
              <h2 className="mt-2 break-words text-2xl font-black text-white">{idea.title}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Pill>{clientName(clients, idea.client_id)}</Pill>
                <Pill tone={videoStatusTone(idea.production_status)}>{VIDEO_STATUS_LABELS[idea.production_status]}</Pill>
              </div>
            </div>

            <Section label="People, products & props" value={idea.requirements} />
            <Section label="Script / dialogue" value={idea.script} />
            <Section label="Shot-by-shot breakdown" value={idea.shot_breakdown} />
            <Section label="Hook / opening" value={idea.hook} />
            <Section label="Visual / filming notes" value={idea.visual_notes} />

            {idea.production_status === 'not_shot' && (
              <ActionButton className="w-full" loading={marking} disabled={marking} onClick={() => onMarkShot(idea)}>Mark video shot</ActionButton>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid place-items-center px-4 text-center text-sm text-white/50">No linked guidelines on this run yet.</div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <ActionButton size="sm" variant="secondary" disabled={index <= 0} onClick={() => setIndex(prev => Math.max(0, prev - 1))}>← Previous</ActionButton>
        <span className="text-xs font-bold text-white/50">{total === 0 ? '0 / 0' : `${Math.min(index + 1, total)} / ${total}`}</span>
        <ActionButton size="sm" variant="secondary" disabled={index >= total - 1} onClick={() => setIndex(prev => Math.min(total - 1, prev + 1))}>Next →</ActionButton>
      </div>
    </div>
  )
}
