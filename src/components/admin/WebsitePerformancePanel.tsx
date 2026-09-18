import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Client } from '../../lib/db/clients'
import {
  getWebsitePerformance,
  saveWebsitePerformanceDraft,
  type WebsitePerformanceResult,
  type WebsitePerformanceState,
} from '../../lib/websitePerformance'
import { PremiumCard, PremiumCardHeader } from '../ui/PremiumCard'

const currentMonth = () => new Date().toISOString().slice(0, 7)
const label = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-ZA').format(value)

export function WebsitePerformancePanel({ clients, canSave }: { clients: Client[]; canSave: boolean }) {
  const [clientId, setClientId] = useState('')
  const [month, setMonth] = useState(currentMonth)
  const [result, setResult] = useState<WebsitePerformanceResult | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId || !/^\d{4}-\d{2}$/.test(month)) return
    let active = true
    const from = `${month}-01`
    const to = new Date(`${from}T00:00:00Z`)
    to.setUTCMonth(to.getUTCMonth() + 1)
    void getWebsitePerformance(clientId, from, to.toISOString().slice(0, 10))
      .then((value) => { if (active) { setResult(value); setState('idle') } })
      .catch(() => { if (active) { setResult(null); setState('error') } })
    return () => { active = false }
  }, [clientId, month])

  return <section className="mt-6" aria-label="Website performance">
    <PremiumCard padding="lg" className="bg-white/[0.035]">
      <PremiumCardHeader title="Website performance" />
      <div className="mt-4 flex flex-wrap gap-3">
        <label className="text-sm text-brand-primary/75">Client<br />
          <select className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" value={clientId} onChange={(event) => { setClientId(event.target.value); setResult(null); setSaveError(null); setState(event.target.value ? 'loading' : 'idle') }}>
            <option value="">Select a client</option>
            {clients.filter((client) => client.active).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-brand-primary/75">Month<br />
          <input className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" type="month" value={month} onChange={(event) => { setMonth(event.target.value); setResult(null); setSaveError(null); setState(clientId && event.target.value ? 'loading' : 'idle') }} />
        </label>
      </div>
      {state === 'loading' && <p className="mt-4 text-sm text-brand-primary/75">Loading website data…</p>}
      {state === 'error' && <StateNotice state="unavailable" />}
      {result && !result.report && <StateNotice state={result.state} />}
      {result?.report && <>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <StateNotice state={result.state} compact />
          {canSave && result.report.identity.environment === 'production' && ['available', 'partial'].includes(result.state) && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSaving(true)
                setSaveError(null)
                const from = `${month}-01`
                const to = new Date(`${from}T00:00:00Z`)
                to.setUTCMonth(to.getUTCMonth() + 1)
                void saveWebsitePerformanceDraft(clientId, from, to.toISOString().slice(0, 10))
                  .then(setResult)
                  .catch(() => setSaveError('The snapshot could not be saved. Check the migration and reporting configuration.'))
                  .finally(() => setSaving(false))
              }}
              className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-bold text-brand-bg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save to monthly report draft'}
            </button>
          )}
        </div>
        {result.saved && (
          <p className="mt-3 text-sm text-brand-primary/80">
            Snapshot revision {result.saved.revision} saved for staff review.{' '}
            <Link className="font-semibold text-brand-accent underline" to={`/admin/reports/${result.saved.reportId}/edit`}>Open report draft</Link>
          </p>
        )}
        {saveError && <p className="mt-3 text-sm text-amber-200">{saveError}</p>}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric title="Visitors" value={label(result.report.traffic.visitors)} />
          <Metric title="Page views" value={label(result.report.traffic.pageviews)} />
          <Metric title="Actions" value={label(result.report.conversions.total)} />
          <Metric title="Enquiries" value={label(result.report.conversions.byType.find((item) => item.type === 'enquiry_submit')?.count ?? (result.report.conversions.total === null ? null : 0))} />
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Breakdown title="Traffic sources" rows={result.report.traffic.sources.map((item) => [item.label, item.visitors])} />
          <Breakdown title="Top pages" rows={result.report.traffic.topPages.map((item) => [item.label, item.pageviews])} />
          <Breakdown title="Visitor actions" rows={result.report.conversions.byType.map((item) => [item.type.replaceAll('_', ' '), item.count])} />
          {result.report.commerce && <Breakdown title="Commerce" rows={[
            ['Orders', result.report.commerce.orderCount], ['Tracked revenue (R)', result.report.commerce.trackedRevenue / 100],
            ['Refunds', result.report.commerce.refunds], ['Units sold', result.report.commerce.unitsSold],
          ]} />}
        </div>
        {result.report.dataQuality.gaps.length > 0 && <p className="mt-5 text-xs leading-relaxed text-brand-primary/60">Measurement notes: {result.report.dataQuality.gaps.join(' ')}</p>}
      </>}
    </PremiumCard>
  </section>
}

const stateCopy: Record<WebsitePerformanceState, string> = {
  not_connected: 'This client does not yet have one verified website, domain and provider connection.',
  not_tracked: 'The selected period predates verified traffic collection.',
  collecting: 'This period is still collecting and cannot be published yet.',
  partial: 'Only part of this period is covered. The limitation will stay visible in the client report.',
  available: 'Provider data is available for this exact website and period.',
  permission_required: 'The provider connection needs reviewed permission before data is available.',
  provider_error: 'The provider failed to return data. Nothing is being reported as zero.',
  unavailable: 'Website reporting is temporarily unavailable. Nothing is being reported as zero.',
}

function StateNotice({ state, compact = false }: { state: WebsitePerformanceState; compact?: boolean }) {
  return <p className={compact ? 'text-sm text-brand-primary/75' : 'mt-4 text-sm text-brand-primary/75'}>{stateCopy[state]}</p>
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs uppercase tracking-widest text-brand-primary/60">{title}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return <div><h3 className="text-sm font-bold text-white">{title}</h3><ul className="mt-2 space-y-1 text-sm text-brand-primary/75">{rows.length ? rows.slice(0, 8).map(([name, value]) => <li className="flex justify-between gap-3" key={name}><span className="truncate">{name}</span><span className="text-white">{label(value)}</span></li>) : <li>No tracked data</li>}</ul></div>
}
