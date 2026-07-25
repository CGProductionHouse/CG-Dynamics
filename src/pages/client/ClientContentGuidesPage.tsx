import { useEffect, useState } from 'react'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { fetchPublishedGuides, type PublishedGuide } from '../../lib/clientContentGuides'

export default function ClientContentGuidesPage() {
  const { profile } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [guides, setGuides] = useState<PublishedGuide[]>([])
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
      const [clientResult, guidesResult] = await Promise.all([
        getClient(profile.client_id),
        fetchPublishedGuides(profile.client_id, currentMonth),
      ])
      if (!active) return
      if (clientResult.error) { setError('Could not load client data.'); setLoading(false); return }
      setClient(clientResult.data)
      if (guidesResult.error) { setError(guidesResult.error); setLoading(false); return }
      setGuides(guidesResult.data ?? [])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [profile?.client_id, currentMonth])

  return (
    <ClientPortalShell client={client}>
      <section className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content production</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Content Guides</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">
          Published guides for {monthDisplayLabel(currentMonth)} — every approved concept, script, shot breakdown and direction note for your upcoming content.
        </p>
      </section>

      {loading ? (
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
          <p className="text-sm leading-6 text-report-muted">Loading published guides…</p>
        </div>
      ) : error ? (
        <div className="mt-8 rounded-lg border border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] px-5 py-6">
          <p className="text-sm leading-6 text-[#d8a07a]">{error}</p>
        </div>
      ) : guides.length === 0 ? (
        <div className="mt-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-5 py-6">
          <p className="text-sm leading-6 text-report-muted">
            No published content guides are available for {monthDisplayLabel(currentMonth)}. Check back as your team publishes approved concepts.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {guides.map(guide => (
            <article
              key={guide.row_key}
              className="rounded-lg border border-white/[0.08] bg-white/[0.035] p-5 shadow-[0_18px_55px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-report-faint">
                    {guide.canonical_name ?? guide.deliverable_title ?? 'Content guide'}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-normal text-white">{guide.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {guide.platform && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-report-faint">{guide.platform}</span>
                    )}
                    {guide.format && (
                      <span className="rounded-full border border-white/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-report-faint">{guide.format}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {guide.objective && <ClientGuideSection label="Objective" value={guide.objective} />}
                {guide.hook && <ClientGuideSection label="Hook" value={guide.hook} />}
                {guide.script && <ClientGuideSection label="Script / Dialogue" value={guide.script} />}
                {guide.shot_breakdown && <ClientGuideSection label="Shot breakdown" value={guide.shot_breakdown} />}
                {guide.cta && <ClientGuideSection label="Call to action" value={guide.cta} />}
                {guide.visual_notes && <ClientGuideSection label="Visual notes" value={guide.visual_notes} />}
              </div>
            </article>
          ))}
        </div>
      )}
    </ClientPortalShell>
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
