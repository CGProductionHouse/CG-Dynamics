import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPublishedGuides, type PublishedContentGuideline } from '../../lib/clientContentGuides'
import { getClient, type Client } from '../../lib/db/clients'
import { monthDisplayLabel } from '../../lib/reportPeriod'

export default function ClientContentGuidesPage({ preview = false }: { preview?: boolean }) {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [client, setClient] = useState<Client | null>(null)
  const [guidelines, setGuidelines] = useState<PublishedContentGuideline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const requestedMonth = searchParams.get('month')
  const currentMonth = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : fallbackMonth
  const selectedGuideKey = searchParams.get('guide')
  const canPreview = preview && (profile?.role === 'admin' || profile?.role === 'manager')
  const clientId = canPreview ? searchParams.get('client') : profile?.client_id

  useEffect(() => {
    let active = true
    async function load() {
      if (!clientId) { setLoading(false); return }
      setLoading(true)
      setError(null)
      const [clientResult, guidelineResult] = await Promise.all([
        getClient(clientId),
        fetchPublishedGuides(clientId, currentMonth),
      ])
      if (!active) return
      if (clientResult.error) { setError('Could not load client data.'); setLoading(false); return }
      setClient(clientResult.data)
      if (guidelineResult.error) { setError(guidelineResult.error); setLoading(false); return }
      setGuidelines(guidelineResult.data ?? [])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [clientId, currentMonth])

  const content = (
    <>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content production</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Content Guidelines</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          Published filming documents for {monthDisplayLabel(currentMonth)}, with every video name and complete script in order.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSearchParams(current => { current.set('month', shiftMonth(currentMonth, -1)); return current })}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-report-muted transition hover:border-report-accent/35 hover:text-white"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setSearchParams(current => { current.set('month', shiftMonth(currentMonth, 1)); return current })}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-report-muted transition hover:border-report-accent/35 hover:text-white"
          >
            Next
          </button>
        </div>
      </section>

      {loading ? (
        <Message>Loading published Content Guidelines...</Message>
      ) : error ? (
        <Message error>{error}</Message>
      ) : guidelines.length === 0 ? (
        <Message>No published Content Guidelines are available for {monthDisplayLabel(currentMonth)}.</Message>
      ) : (
        <div className="mt-8 space-y-8">
          {guidelines.map(guideline => (
            <article
              key={guideline.row_key}
              id={`guide-${guideline.row_key}`}
              ref={element => {
                if (element && selectedGuideKey === guideline.row_key) {
                  window.requestAnimationFrame(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                }
              }}
              className={`scroll-mt-6 overflow-hidden rounded-lg border bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,0.2)] ${
                selectedGuideKey === guideline.row_key
                  ? 'border-report-accent/45 ring-1 ring-report-accent/20'
                  : 'border-white/[0.08]'
              }`}
            >
              <header className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_42%)] p-5 sm:p-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-report-accent">Content Guideline</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-normal text-white">{guideline.title}</h2>
                <p className="mt-2 text-sm text-report-muted">
                  {guideline.run_name}{guideline.filming_date ? ` | Filming ${guideline.filming_date}` : ''}
                </p>
              </header>

              <ol className="divide-y divide-white/[0.08]">
                {guideline.videos.map((video, index) => (
                  <li key={`${guideline.row_key}-${video.position}`} className="p-5 sm:p-7">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-report-accent">Video {index + 1}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">{video.title}</h3>
                    <div className="mt-5 rounded-lg border border-white/[0.08] bg-black/15 p-4 sm:p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-report-faint">Complete script</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-report-text">{video.script}</p>
                    </div>
                    {(video.objective || video.hook || video.shot_breakdown || video.cta || video.visual_notes) && (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        {video.objective && <ClientGuideSection label="Objective" value={video.objective} />}
                        {video.hook && <ClientGuideSection label="Hook" value={video.hook} />}
                        {video.shot_breakdown && <ClientGuideSection label="Shot direction" value={video.shot_breakdown} />}
                        {video.cta && <ClientGuideSection label="Call to action" value={video.cta} />}
                        {video.visual_notes && <ClientGuideSection label="Visual direction" value={video.visual_notes} />}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      )}
    </>
  )
  if (preview) return canPreview
    ? <div className="min-w-0 p-4 sm:p-6"><p className="mb-4 text-sm text-report-muted">Client preview · Published content only</p>{content}</div>
    : <Message error>Only managers and admins can preview client guides.</Message>
  return <ClientPortalShell client={client}>{content}</ClientPortalShell>
}

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`mt-8 rounded-lg border px-5 py-6 ${error ? 'border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] text-[#d8a07a]' : 'border-white/[0.08] bg-white/[0.03] text-report-muted'}`}>
      <p className="text-sm leading-6">{children}</p>
    </div>
  )
}

function ClientGuideSection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-report-faint">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-report-text">{value}</p>
    </div>
  )
}
