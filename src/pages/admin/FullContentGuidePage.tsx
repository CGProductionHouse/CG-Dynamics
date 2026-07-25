import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { LoadingState } from '../../components/ui/States'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import {
  listGuideIdeas,
  updateGuideIdea,
  type ContentGuideIdea,
  type ContentGuideInput,
} from '../../lib/contentWorkflow'
import {
  guideStatusTone,
  humanizeStatus,
} from './contentGuidelineHelpers'

type PublishAction = 'publish' | 'unpublish'

export default function FullContentGuidePage() {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [guides, setGuides] = useState<ContentGuideIdea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  useEffect(() => {
    listActiveClients().then(result => {
      if (result.data) setClients(result.data)
    })
  }, [])

  function loadGuides() {
    if (!selectedClientId) { setGuides([]); return }
    setLoading(true)
    setError(null)
    listGuideIdeas()
      .then(result => {
        if (result.error) { setError(result.error); setGuides([]); return }
        setGuides(
          result.data.filter(
            g => g.client_id === selectedClientId && g.month === selectedMonth,
          ),
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadGuides() }, [selectedClientId, selectedMonth])

  async function togglePublish(guide: ContentGuideIdea) {
    if (publishingId) return
    setPublishingId(guide.id)
    const action: PublishAction = guide.client_published_at ? 'unpublish' : 'publish'
    const patch: Partial<ContentGuideIdea> = {
      client_published_at: action === 'publish' ? new Date().toISOString() : null,
    }
    const result = await updateGuideIdea(guide.id, patch as ContentGuideInput)
    if (!result.error) loadGuides()
    setPublishingId(null)
  }

  const sortedGuides = useMemo(
    () => [...guides].sort((a, b) => (a.video_number ?? 999) - (b.video_number ?? 999)),
    [guides],
  )

  const publishedGuides = sortedGuides.filter(g => g.client_published_at)
  const draftGuides = sortedGuides.filter(g => !g.client_published_at)
  const client = clients.find(c => c.id === selectedClientId)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8">
      <header className="overflow-hidden rounded-3xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.18),transparent_38%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-5 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">Content production</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">Full Content Guide</h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-primary/70 sm:text-base">
              One complete guide per client and month. Every scheduled video, concept, script and production detail in one document-style workspace.
            </p>
          </div>
        </div>
      </header>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="text-xs text-white/45">
          Client
          <select
            value={selectedClientId ?? ''}
            onChange={e => setSelectedClientId(e.target.value || null)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"
          >
            <option value="">Select a client</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/45">
          Month
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-white"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date()
              d.setMonth(d.getMonth() + i)
              const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              return <option key={v} value={v}>{monthDisplayLabel(v)}</option>
            })}
          </select>
        </label>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/[0.06] p-4 text-sm text-red-100">{error}</div>
      )}

      {!selectedClientId ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <p className="text-sm text-white/50">Select a client and month to view the full content guide.</p>
        </div>
      ) : loading ? (
        <LoadingState message="Loading content guides..." />
      ) : guides.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-8 text-center">
          <p className="text-sm text-white/50">No content guides exist for {client?.name ?? 'this client'} in {monthDisplayLabel(selectedMonth)}.</p>
          <p className="mt-3 text-xs text-white/35">
            Create individual guides from the{' '}
            <Link to="/admin/content-workflow" className="text-brand-teal hover:text-white">Content Workflow</Link> page, then return here to see them in the full workspace.
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-teal">
                  {client?.name} · {monthDisplayLabel(selectedMonth)}
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {guides.length} guide{guides.length === 1 ? '' : 's'}
                  {publishedGuides.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-white/40">
                      · {publishedGuides.length} published
                    </span>
                  )}
                </h2>
              </div>
            </div>
          </section>

          {draftGuides.length > 0 && (
            <section className="mt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200/60">Draft guides — not client-visible</p>
              <div className="mt-3 space-y-4">
                {draftGuides.map(guide => (
                  <GuideBlock key={guide.id} guide={guide} onPublish={() => void togglePublish(guide)} publishing={publishingId === guide.id} />
                ))}
              </div>
            </section>
          )}

          {publishedGuides.length > 0 && (
            <section className="mt-8">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/60">Published guides — client-visible</p>
              <div className="mt-3 space-y-4">
                {publishedGuides.map(guide => (
                  <GuideBlock key={guide.id} guide={guide} onPublish={() => void togglePublish(guide)} publishing={publishingId === guide.id} isPublished />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function GuideBlock({
  guide,
  onPublish,
  publishing,
  isPublished = false,
}: {
  guide: ContentGuideIdea
  onPublish: () => void
  publishing: boolean
  isPublished?: boolean
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-brand-teal/75">
            {guide.canonical_name ?? `Video ${guide.video_number ?? '—'}`}
          </p>
          <h3 className="mt-1 text-lg font-black text-white">{guide.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${guideStatusTone(guide.status)}`}>
              {humanizeStatus(guide.status)}
            </span>
            {guide.platform && (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-black text-white/50">{guide.platform}</span>
            )}
            {guide.format && (
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-black text-white/50">{guide.format}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/admin/content-workflow?guide=${guide.id}`}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
          >
            Edit
          </Link>
          <ActionButton size="sm" variant={isPublished ? 'secondary' : 'primary'} onClick={onPublish} disabled={publishing}>
            {publishing ? '...' : isPublished ? 'Unpublish' : 'Publish to client'}
          </ActionButton>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {guide.objective && <GuideSection label="Objective" value={guide.objective} />}
        {guide.hook && <GuideSection label="Hook" value={guide.hook} />}
        {guide.script && <GuideSection label="Script / Dialogue" value={guide.script} />}
        {guide.shot_breakdown && <GuideSection label="Shot breakdown" value={guide.shot_breakdown} />}
        {guide.cta && <GuideSection label="Call to action" value={guide.cta} />}
        {guide.visual_notes && <GuideSection label="Visual notes" value={guide.visual_notes} />}
        {guide.notes && <GuideSection label="Production notes" value={guide.notes} />}
      </div>
    </article>
  )
}

function GuideSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/35">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/80">{value}</p>
    </div>
  )
}
