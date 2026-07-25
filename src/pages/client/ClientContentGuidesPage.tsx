import { useEffect, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { fetchPublishedGuides, type PublishedContentGuideline } from '../../lib/clientContentGuides'
import { getClient, type Client } from '../../lib/db/clients'
import { monthDisplayLabel } from '../../lib/reportPeriod'

export default function ClientContentGuidesPage() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [guidelines, setGuidelines] = useState<PublishedContentGuideline[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    let active = true
    async function load() {
      if (!profile?.client_id) { setLoading(false); return }
      setLoading(true)
      setError(null)
      const [clientResult, guidelineResult] = await Promise.all([
        getClient(profile.client_id),
        fetchPublishedGuides(profile.client_id, currentMonth),
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
  }, [profile?.client_id, currentMonth])

  return (
    <ClientPortalShell client={client}>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content production</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Content Guidelines</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          Published filming documents for {monthDisplayLabel(currentMonth)}, with every video name and complete script in order.
        </p>
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
            <article key={guideline.row_key} className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.035] shadow-[0_18px_55px_rgba(0,0,0,0.2)]">
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
    </ClientPortalShell>
  )
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
