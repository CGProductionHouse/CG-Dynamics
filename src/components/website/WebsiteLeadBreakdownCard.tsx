import { useEffect, useState } from 'react'
import { getWebsiteLeadBreakdown, type LeadLoad } from '../../lib/db/websiteLeads'
import {
  breakdownKeyLabel,
  formatQualificationRate,
  type LeadBreakdownDimension,
  type WebsiteLeadBreakdown,
} from '../../lib/websiteLeads'

const number = (value: number) => new Intl.NumberFormat('en-ZA').format(value)

const DIMENSIONS: Array<{ dimension: LeadBreakdownDimension; title: string }> = [
  { dimension: 'landing_page', title: 'Qualified leads by landing page' },
  { dimension: 'source', title: 'Qualified leads by source' },
]

/**
 * Which landing pages and sources bring qualified (Good) leads for one exact client and
 * period. Rows below the minimum sample are shown but labelled, so one or two leads never
 * read as a signal. Aggregate keys only; no visitor details.
 */
export function WebsiteLeadBreakdownCard({ clientId, from, to }: { clientId: string | null; from: string; to: string }) {
  return <div className="mt-5 grid gap-5 md:grid-cols-2">
    {DIMENSIONS.map(({ dimension, title }) => <BreakdownPanel key={dimension} clientId={clientId} from={from} to={to} dimension={dimension} title={title} />)}
  </div>
}

function BreakdownPanel({ clientId, from, to, dimension, title }: {
  clientId: string | null
  from: string
  to: string
  dimension: LeadBreakdownDimension
  title: string
}) {
  const [result, setResult] = useState<LeadLoad<WebsiteLeadBreakdown> | null>(null)
  const key = `${clientId ?? 'self'}:${from}:${to}:${dimension}`
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void getWebsiteLeadBreakdown(clientId, from, to, dimension)
      .then((value) => { if (active) { setResult(value); setLoadedKey(key) } })
      .catch(() => { if (active) { setResult({ state: 'error', message: 'Lead sources could not be loaded.' }); setLoadedKey(key) } })
    return () => { active = false }
  }, [clientId, from, to, dimension, key])

  const current = loadedKey === key ? result : null
  // Nothing to say until lead tracking exists; the metrics card already explains why.
  if (current?.state === 'unavailable' || (current?.state === 'ready' && current.data.state === 'not_connected')) return null

  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4" aria-label={title}>
    <h3 className="text-sm font-bold text-white">{title}</h3>
    {!current && <p className="mt-2 text-sm text-brand-primary/75">Loading…</p>}
    {current?.state === 'error' && <p className="mt-2 text-sm text-amber-200">{current.message}</p>}
    {current?.state === 'ready' && (current.data.rows.length === 0
      ? <p className="mt-2 text-sm text-brand-primary/75">No website enquiries were received in this period.</p>
      : <>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-[0.68rem] uppercase tracking-widest text-brand-primary/60">
                <th className="pb-2 font-semibold">{dimension === 'landing_page' ? 'Page' : 'Source'}</th>
                <th className="pb-2 text-right font-semibold">Leads</th>
                <th className="pb-2 text-right font-semibold">Qualified</th>
                <th className="pb-2 text-right font-semibold">Rate</th>
              </tr>
            </thead>
            <tbody>
              {current.data.rows.map((row) => <tr key={row.key ?? '(not recorded)'} className="border-t border-white/5">
                <td className="max-w-[14rem] truncate py-1.5 pr-2 text-white" title={breakdownKeyLabel(dimension, row.key)}>
                  {row.key === null ? <span className="text-brand-primary/60">{breakdownKeyLabel(dimension, row.key)}</span> : row.key}
                </td>
                <td className="py-1.5 text-right text-white">{number(row.total)}</td>
                <td className="py-1.5 text-right text-white">{number(row.qualified)}</td>
                <td className="py-1.5 text-right text-white">
                  {formatQualificationRate(row.qualificationRate)}
                  {!row.sufficientSample && <span className="ml-1 text-[0.68rem] text-brand-primary/60" title={`Fewer than ${current.data.minSample} leads`}>low sample</span>}
                </td>
              </tr>)}
            </tbody>
          </table>
          {current.data.otherRows > 0 && <p className="mt-2 text-xs text-brand-primary/60">+{number(current.data.otherRows)} more with fewer qualified leads.</p>}
          <p className="mt-2 text-xs text-brand-primary/60">Rows with fewer than {number(current.data.minSample)} leads are marked “low sample” and are not used for optimisation decisions.</p>
        </>)}
  </div>
}
