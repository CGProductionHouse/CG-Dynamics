import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPublishedGuides, type PublishedContentGuideline } from '../../lib/clientContentGuides'
import { getClient, type Client } from '../../lib/db/clients'
import { ContentGuidelineDocument } from '../../components/client/ContentGuidelineDocument'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { businessMonthKey } from '../../lib/businessTime'
import { useOptionalClientPortal } from '../../components/client/ClientPortalContext'

export default function ClientContentGuidesPage({ preview = false, embedded = false, month }: { preview?: boolean; embedded?: boolean; month?: string }) {
  const { profile } = useAuth()
  const scopedPreviewClientId = useOptionalClientPortal()?.previewClientId
  const [searchParams, setSearchParams] = useSearchParams()
  const [client, setClient] = useState<Client | null>(null)
  const [guidelines, setGuidelines] = useState<PublishedContentGuideline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readRevision, setReadRevision] = useState(0)

  const fallbackMonth = businessMonthKey()
  const requestedMonth = searchParams.get('month')
  const currentMonth = month ?? (requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth) ? requestedMonth : fallbackMonth)
  const selectedGuideKey = searchParams.get('guide')
  const canPreview = preview && (profile?.role === 'admin' || profile?.role === 'manager')
  const clientId = scopedPreviewClientId ?? (canPreview ? searchParams.get('client') : profile?.client_id)

  useEffect(() => {
    let active = true
    async function load() {
      if (!clientId) { setLoading(false); return }
      setLoading(true)
      setGuidelines([])
      setClient(null)
      setError(null)
      try {
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
      } catch {
        if (!active) return
        setError('Published guidelines could not be loaded safely.')
        setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [clientId, currentMonth, readRevision])

  const content = (
    <>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content production</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-white sm:text-5xl">Content guidelines</h2>
        {!embedded && <p className="mt-3 text-sm text-report-muted">{monthDisplayLabel(currentMonth)}</p>}
        {!embedded && <div className="mt-5 flex items-center gap-2">
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
        </div>}
      </section>

      {loading ? (
        <ClientPortalLoadingState />
      ) : error ? (
        <ClientPortalErrorState title="Content Guidelines could not be loaded" message="Your published guidance is temporarily unavailable. Please try again shortly." onRetry={() => setReadRevision(value => value + 1)} />
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
              className="scroll-mt-6"
            >
              <ContentGuidelineDocument guide={guideline} client={client ?? { name: 'Your content' }} selected={selectedGuideKey === guideline.row_key}
                clientPath={`/client/plan?tab=guidelines&month=${currentMonth}&guide=${encodeURIComponent(guideline.row_key)}`} />
            </article>
          ))}
        </div>
      )}
    </>
  )
  if (preview) return canPreview
    ? <div className="min-w-0 p-4 sm:p-6"><p className="mb-4 text-sm text-report-muted">Client preview · Published content only</p>{content}</div>
    : <ClientPortalErrorState title="Preview unavailable" message="Only managers and admins can preview client guides." />
  return embedded ? content : <ClientPortalShell client={client}>{content}</ClientPortalShell>
}

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7)
}

function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`mt-8 rounded-3xl border px-6 py-8 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.95)] ${error ? 'border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] text-[#d8a07a]' : 'border-white/[0.08] bg-white/[0.04] text-report-muted'}`}>
      <p className="text-sm leading-6">{children}</p>
    </div>
  )
}
