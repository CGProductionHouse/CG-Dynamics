import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ClientOption } from '../../lib/commandCentre'
import { CONTENT_RUN_STATUSES } from '../../lib/contentWorkflowRules'
import type { ContentGuidelineDocument, ContentRun, StaffProfileOption } from '../../lib/contentWorkflow'
import { VIDEO_PRODUCTION_STATUSES, VIDEO_STATUS_LABELS } from '../../lib/videoPipelineRules'
import { EmptyState } from '../../components/ui/States'
import { humanizeStatus } from './contentGuidelineHelpers'

type ContentOverviewProps = {
  clients: ClientOption[]
  staff: StaffProfileOption[]
  runs: ContentRun[]
  documents: ContentGuidelineDocument[]
  onOpenRun: (runId: string) => void
  onOpenGuideline: (guidelineId: string) => void
  onOpenPipeline: () => void
}

type AttentionItem = {
  key: string
  title: string
  detail: string
  runId?: string
  guidelineId?: string
}

function inDateRange(value: string | null, from: string, to: string) {
  if (!value) return !from && !to
  const date = value.slice(0, 10)
  return (!from || date >= from) && (!to || date <= to)
}

function personMatches(run: ContentRun, document: ContentGuidelineDocument | null, person: StaffProfileOption | null) {
  if (!person) return true
  const name = person.full_name?.trim().toLowerCase() ?? ''
  if (run.lead_user_id === person.id) return true
  if (name && run.lead_name?.trim().toLowerCase() === name) return true
  if (name && run.helper_names.some(helper => helper.trim().toLowerCase() === name)) return true
  return Boolean(document?.videos.some(video => (
    video.editor_user_id === person.id
    || video.owner_user_id === person.id
    || (name && video.editor_name?.trim().toLowerCase() === name)
    || (name && video.owner_name?.trim().toLowerCase() === name)
  )))
}

function Section({ eyebrow, title, count, children }: { eyebrow: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal/75">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-black text-white">{title}</h2>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-white/45">{count}</span>
      </div>
      {children}
    </section>
  )
}

function RunCard({ run, document, onOpenRun, onOpenGuideline }: { run: ContentRun; document: ContentGuidelineDocument | null; onOpenRun: (id: string) => void; onOpenGuideline: (id: string) => void }) {
  const linkedScheduleVideos = document?.videos.filter(video => video.deliverable_id).length ?? 0
  return (
    <article className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-black text-white">{run.name}</h3>
          <p className="mt-1 text-xs text-white/45">{run.client_name ?? 'Client not linked'} | {run.run_date ?? 'Date not set'}{run.lead_name ? ` | ${run.lead_name}` : ''}</p>
        </div>
        <span className="rounded-full border border-brand-teal/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand-teal">{humanizeStatus(run.status)}</span>
      </div>
      <p className="mt-2 text-xs text-white/45">{document ? `${document.videos.length} ordered video${document.videos.length === 1 ? '' : 's'} | ${linkedScheduleVideos} Client Schedule link${linkedScheduleVideos === 1 ? '' : 's'}` : 'Canonical guideline not created'}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpenRun(run.id)} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-white/70 hover:border-brand-teal/30 hover:text-white">Open run</button>
        {document && <button type="button" onClick={() => onOpenGuideline(document.guideline.id)} className="min-h-10 rounded-lg border border-brand-teal/30 px-3 text-xs font-black text-brand-teal hover:bg-brand-teal/10 hover:text-white">Open guideline</button>}
      </div>
    </article>
  )
}

function GuidelineCard({ document, onOpenGuideline, onOpenRun }: { document: ContentGuidelineDocument; onOpenGuideline: (id: string) => void; onOpenRun: (id: string) => void }) {
  const incomplete = document.videos.filter(video => !video.title.trim() || !video.script?.trim()).length
  return (
    <article className="rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-black text-white">{document.guideline.title}</h3>
          <p className="mt-1 text-xs text-white/45">{document.run.client_name ?? 'Client not linked'} | {document.run.name} | {document.guideline.month?.slice(0, 7) ?? 'Month not set'}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wide ${document.guideline.status === 'published' ? 'border-emerald-300/25 text-emerald-200' : 'border-amber-300/25 text-amber-200'}`}>{document.guideline.status}</span>
      </div>
      <p className="mt-2 text-xs text-white/45">{document.videos.length} ordered video{document.videos.length === 1 ? '' : 's'}{incomplete > 0 ? ` | ${incomplete} missing name or script` : ''}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpenGuideline(document.guideline.id)} className="min-h-10 rounded-lg border border-brand-teal/30 px-3 text-xs font-black text-brand-teal hover:bg-brand-teal/10 hover:text-white">Open guideline</button>
        <button type="button" onClick={() => onOpenRun(document.run.id)} className="min-h-10 rounded-lg border border-white/10 px-3 text-xs font-black text-white/60 hover:text-white">Open run</button>
      </div>
    </article>
  )
}

export default function ContentOverview({ clients, staff, runs, documents, onOpenRun, onOpenGuideline, onOpenPipeline }: ContentOverviewProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = searchParams.get('client') ?? 'all'
  const status = searchParams.get('status') ?? 'all'
  const assigneeId = searchParams.get('assignee') ?? 'all'
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const selectedPerson = staff.find(person => person.id === assigneeId) ?? null
  const documentByRun = useMemo(() => new Map(documents.map(document => [document.run.id, document])), [documents])

  function updateFilter(key: string, value: string, emptyValue = 'all') {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (!value || value === emptyValue) next.delete(key)
      else next.set(key, value)
      return next
    }, { replace: true })
  }

  const filteredRuns = useMemo(() => runs.filter(run => {
    const document = documentByRun.get(run.id) ?? null
    if (clientId !== 'all' && run.client_id !== clientId) return false
    if (!inDateRange(run.run_date, from, to)) return false
    if (!personMatches(run, document, selectedPerson)) return false
    if (status === 'all') return true
    if (status.startsWith('run:')) return run.status === status.slice(4)
    if (status.startsWith('guideline:')) return document?.guideline.status === status.slice(10)
    if (status.startsWith('video:')) return Boolean(document?.videos.some(video => video.production_status === status.slice(6)))
    return true
  }), [runs, documentByRun, clientId, from, to, selectedPerson, status])

  const filteredDocuments = useMemo(() => documents.filter(document => filteredRuns.some(run => run.id === document.run.id)), [documents, filteredRuns])
  const activeRuns = filteredRuns.filter(run => !['completed', 'cancelled'].includes(run.status)).sort((left, right) => (left.run_date ?? '9999').localeCompare(right.run_date ?? '9999'))
  const draftDocuments = filteredDocuments.filter(document => document.guideline.status === 'draft' || document.guideline.status === 'ready')
  const publishedDocuments = filteredDocuments.filter(document => document.guideline.status === 'published' && Boolean(document.guideline.client_published_at)).sort((left, right) => (right.guideline.client_published_at ?? '').localeCompare(left.guideline.client_published_at ?? ''))
  const completedRuns = filteredRuns.filter(run => run.status === 'completed').sort((left, right) => right.updated_at.localeCompare(left.updated_at))

  const attentionItems = useMemo(() => {
    const items: AttentionItem[] = []
    for (const run of activeRuns) {
      const document = documentByRun.get(run.id)
      if (!run.client_id) items.push({ key: `${run.id}-client`, title: run.name, detail: 'Content Run needs an explicit client link.', runId: run.id })
      if (!run.run_date) items.push({ key: `${run.id}-date`, title: run.name, detail: 'Content Run has no filming date.', runId: run.id })
      if (!document) items.push({ key: `${run.id}-guideline`, title: run.name, detail: 'Canonical Content Guideline has not been created.', runId: run.id })
    }
    for (const document of filteredDocuments) {
      if (document.videos.length === 0 && document.guideline.status !== 'archived') items.push({ key: `${document.guideline.id}-empty`, title: document.guideline.title, detail: 'Guideline has no ordered videos.', guidelineId: document.guideline.id })
      for (const video of document.videos) {
        if (!video.title.trim() || !video.script?.trim()) items.push({ key: `${video.id}-script`, title: video.title || document.guideline.title, detail: 'Video needs a complete name and script.', guidelineId: document.guideline.id })
        else if (video.migration_review_reason) items.push({ key: `${video.id}-migration`, title: video.title, detail: 'Imported video needs migration review.', guidelineId: document.guideline.id })
        else if (video.production_status === 'ready_to_edit' && !video.editor_user_id) items.push({ key: `${video.id}-editor`, title: video.title, detail: 'Ready-to-edit video has no editor.', guidelineId: document.guideline.id })
        else if (['internal_review', 'internal_changes', 'client_changes'].includes(video.production_status)) items.push({ key: `${video.id}-review`, title: video.title, detail: `Production attention: ${VIDEO_STATUS_LABELS[video.production_status]}.`, guidelineId: document.guideline.id })
      }
    }
    return items.slice(0, 12)
  }, [activeRuns, documentByRun, filteredDocuments])

  const hasAnyResults = activeRuns.length + attentionItems.length + draftDocuments.length + publishedDocuments.length + completedRuns.length > 0

  return (
    <div className="mt-6 space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5" aria-label="Content filters">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-bold text-white/50">Client<select value={clientId} onChange={event => updateFilter('client', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white"><option value="all">All clients</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="text-xs font-bold text-white/50">Status<select value={status} onChange={event => updateFilter('status', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white"><option value="all">All statuses</option><optgroup label="Content Runs">{CONTENT_RUN_STATUSES.map(value => <option key={value} value={`run:${value}`}>{humanizeStatus(value)}</option>)}</optgroup><optgroup label="Guidelines">{['draft', 'ready', 'published', 'archived'].map(value => <option key={value} value={`guideline:${value}`}>{humanizeStatus(value)}</option>)}</optgroup><optgroup label="Video production">{VIDEO_PRODUCTION_STATUSES.map(value => <option key={value} value={`video:${value}`}>{VIDEO_STATUS_LABELS[value]}</option>)}</optgroup></select></label>
          <label className="text-xs font-bold text-white/50">Assignee<select value={assigneeId} onChange={event => updateFilter('assignee', event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white"><option value="all">All assignees</option>{staff.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
          <label className="text-xs font-bold text-white/50">From<input type="date" value={from} onChange={event => updateFilter('from', event.target.value, '')} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white" /></label>
          <label className="text-xs font-bold text-white/50">To<input type="date" value={to} onChange={event => updateFilter('to', event.target.value, '')} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white" /></label>
        </div>
      </section>

      {!hasAnyResults ? <EmptyState title="No Content records match" message="Adjust the client, status, assignee or date filters." /> : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Section eyebrow="Plan and prepare" title="Active and upcoming Content Runs" count={activeRuns.length}>
            {activeRuns.length === 0 ? <p className="text-sm text-white/40">No active runs match these filters.</p> : <div className="space-y-2">{activeRuns.slice(0, 8).map(run => <RunCard key={run.id} run={run} document={documentByRun.get(run.id) ?? null} onOpenRun={onOpenRun} onOpenGuideline={onOpenGuideline} />)}</div>}
          </Section>

          <Section eyebrow="Action queue" title="Needs attention" count={attentionItems.length}>
            {attentionItems.length === 0 ? <p className="text-sm text-white/40">No deterministic attention items match these filters.</p> : <ul className="space-y-2">{attentionItems.map(item => <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3"><div><p className="text-sm font-black text-white">{item.title}</p><p className="mt-1 text-xs text-amber-100/65">{item.detail}</p></div><button type="button" onClick={() => item.guidelineId ? onOpenGuideline(item.guidelineId) : item.runId && onOpenRun(item.runId)} className="min-h-10 rounded-lg border border-amber-300/20 px-3 text-xs font-black text-amber-100">Open</button></li>)}</ul>}
          </Section>

          <Section eyebrow="Canonical documents" title="Draft guidelines" count={draftDocuments.length}>
            {draftDocuments.length === 0 ? <p className="text-sm text-white/40">No draft guidelines match these filters.</p> : <div className="space-y-2">{draftDocuments.slice(0, 8).map(document => <GuidelineCard key={document.guideline.id} document={document} onOpenGuideline={onOpenGuideline} onOpenRun={onOpenRun} />)}</div>}
          </Section>

          <Section eyebrow="Client-ready" title="Published guidelines" count={publishedDocuments.length}>
            {publishedDocuments.length === 0 ? <p className="text-sm text-white/40">No published guidelines match these filters.</p> : <div className="space-y-2">{publishedDocuments.slice(0, 8).map(document => <GuidelineCard key={document.guideline.id} document={document} onOpenGuideline={onOpenGuideline} onOpenRun={onOpenRun} />)}</div>}
          </Section>

          <Section eyebrow="Recent history" title="Completed Content Runs" count={completedRuns.length}>
            {completedRuns.length === 0 ? <p className="text-sm text-white/40">No recently completed runs match these filters.</p> : <div className="space-y-2">{completedRuns.slice(0, 8).map(run => <RunCard key={run.id} run={run} document={documentByRun.get(run.id) ?? null} onOpenRun={onOpenRun} onOpenGuideline={onOpenGuideline} />)}</div>}
          </Section>

          <section className="flex flex-col justify-between rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.035] p-5">
            <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">Production progress</p><h2 className="mt-2 text-xl font-black text-white">Video Pipeline</h2><p className="mt-2 text-sm leading-relaxed text-white/55">Track ordered guideline videos through filming, editing, internal review, client review and approval.</p></div>
            <button type="button" onClick={onOpenPipeline} className="mt-5 min-h-11 self-start rounded-lg bg-brand-teal px-4 text-sm font-black text-black">Open Video Pipeline</button>
          </section>
        </div>
      )}
    </div>
  )
}
