import { useEffect, useState } from 'react'
import { getWebsiteLeadMetrics, type LeadLoad } from '../../lib/db/websiteLeads'
import { formatQualificationRate, type WebsiteLeadMetrics } from '../../lib/websiteLeads'

const number = (value: number) => new Intl.NumberFormat('en-ZA').format(value)

/**
 * Aggregate website lead outcomes for one exact client and period. Counts only
 * production enquiries from the canonical #405 transaction; nothing is
 * estimated, back-filled or sent to analytics.
 */
export function WebsiteLeadMetricsCard({ clientId, from, to, title = 'Website leads' }: {
  clientId: string | null
  from: string
  to: string
  title?: string
}) {
  const [result, setResult] = useState<LeadLoad<WebsiteLeadMetrics> | null>(null)
  const key = `${clientId ?? 'self'}:${from}:${to}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getWebsiteLeadMetrics(clientId, from, to)
      .then((value) => { if (active) { setResult(value); setLoadedKey(key) } })
      .catch(() => { if (active) { setResult({ state: 'error', message: 'Lead metrics could not be loaded.' }); setLoadedKey(key) } })
    return () => { active = false }
  }, [clientId, from, to, key])

  const current = loadedKey === key ? result : null

  return <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-label={title}>
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {!current && <p className="mt-2 text-sm text-brand-primary/75">Loading lead outcomes…</p>}
    {current?.state === 'unavailable' && <p className="mt-2 text-sm text-brand-primary/75">Lead tracking is not activated yet. No lead numbers are being reported.</p>}
    {current?.state === 'error' && <p className="mt-2 text-sm text-amber-200">{current.message}</p>}
    {current?.state === 'ready' && current.data.state === 'not_connected' && (
      <p className="mt-2 text-sm text-brand-primary/75">No website enquiry form is connected for this client yet. No lead numbers are being reported.</p>
    )}
    {current?.state === 'ready' && current.data.state === 'available' && (current.data.total === 0
      ? <p className="mt-2 text-sm text-brand-primary/75">No website enquiries were received in this period.</p>
      : <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Total leads" value={number(current.data.total)} />
          <Tile label="Qualified" value={number(current.data.qualified)} />
          <Tile label="Poor" value={number(current.data.poor)} />
          <Tile label="Qualification rate" value={formatQualificationRate(current.data.qualificationRate)} />
          <Tile label="Won" value={number(current.data.won)} />
          {current.data.unreviewed > 0 && <p className="text-xs text-brand-primary/60 sm:col-span-3 lg:col-span-5">{number(current.data.unreviewed)} lead{current.data.unreviewed === 1 ? '' : 's'} not yet marked Good or Poor.</p>}
        </div>)}
  </div>
}

function Tile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
    <p className="text-[0.68rem] uppercase tracking-widest text-brand-primary/60">{label}</p>
    <p className="mt-1 text-xl font-black text-white">{value}</p>
  </div>
}
