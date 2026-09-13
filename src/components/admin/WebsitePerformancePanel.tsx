import { useEffect, useState } from 'react'
import type { Client } from '../../lib/db/clients'
import { getWebsitePerformance, type WebsiteReport } from '../../lib/websitePerformance'
import { PremiumCard, PremiumCardHeader } from '../ui/PremiumCard'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const label = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-ZA').format(value)

export function WebsitePerformancePanel({ clients }: { clients: Client[] }) {
  const [clientId, setClientId] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [report, setReport] = useState<WebsiteReport | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!clientId || !/^\d{4}-\d{2}$/.test(month)) return
    let active = true
    const from = `${month}-01`
    const to = new Date(`${from}T00:00:00Z`)
    to.setUTCMonth(to.getUTCMonth() + 1)
    void getWebsitePerformance(clientId, from, to.toISOString().slice(0, 10))
      .then((value) => { if (active) { setReport(value); setState('idle') } })
      .catch(() => { if (active) { setReport(null); setState('error') } })
    return () => { active = false }
  }, [clientId, month])

  return <section className="mt-6" aria-label="Website performance">
    <PremiumCard padding="lg" className="bg-white/[0.035]">
      <PremiumCardHeader title="Website performance" />
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm text-brand-primary/75">Client<br />
          <select className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" value={clientId} onChange={(event) => { setClientId(event.target.value); setReport(null); setState(event.target.value ? 'loading' : 'idle') }}>
            <option value="">Select a client</option>
            {clients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-brand-primary/75">Month<br />
          <input className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setReport(null); setState(clientId && event.target.value ? 'loading' : 'idle') }} />
        </label>
      </div>
      {state === 'loading' && <p className="mt-4 text-sm text-brand-primary/75">Loading website data…</p>}
      {state === 'error' && <p className="mt-4 text-sm text-brand-primary/75">No approved website mapping or reporting data is available for this client.</p>}
      {report && <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Visitors" value={label(report.traffic.visitors)} />
          <Metric title="Page views" value={label(report.traffic.pageviews)} />
          <Metric title="Actions" value={label(report.conversions.total)} />
          <Metric title="Enquiries" value={label(report.conversions.byType.find((item) => item.type === 'enquiry_submit')?.count ?? (report.conversions.total === null ? null : 0))} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Breakdown title="Traffic sources" rows={report.traffic.sources.map((item) => [item.label, item.visitors])} />
          <Breakdown title="Top pages" rows={report.traffic.topPages.map((item) => [item.label, item.pageviews])} />
          <Breakdown title="Visitor actions" rows={report.conversions.byType.map((item) => [item.type.replaceAll('_', ' '), item.count])} />
          {report.commerce && <Breakdown title="Commerce" rows={[
            ['Orders', report.commerce.orderCount], ['Tracked revenue (R)', report.commerce.trackedRevenue / 100],
            ['Refunds', report.commerce.refunds], ['Units sold', report.commerce.unitsSold],
          ]} />}
        </div>
        {report.dataQuality.gaps.length > 0 && <p className="mt-5 text-xs leading-relaxed text-brand-primary/60">Measurement notes: {report.dataQuality.gaps.join(' ')}</p>}
      </>}
    </PremiumCard>
  </section>
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-widest text-brand-primary/60">{title}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <div><h3 className="text-sm font-bold text-white">{title}</h3><ul className="mt-2 space-y-1 text-sm text-brand-primary/75">{rows.length ? rows.slice(0, 8).map(([name, value]) => <li className="flex justify-between gap-3" key={name}><span className="truncate">{name}</span><span className="text-white">{label(value)}</span></li>) : <li>No tracked data</li>}</ul></div>
}
