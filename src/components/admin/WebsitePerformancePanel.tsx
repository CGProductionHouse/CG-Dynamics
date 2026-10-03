import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Client } from '../../lib/db/clients'
import { getWebsiteLeadMetrics, type LeadLoad } from '../../lib/db/websiteLeads'
import {
  getWebsitePerformance,
  saveWebsitePerformanceDraft,
  type WebsitePerformanceResult,
} from '../../lib/websitePerformance'
import { websitePerformanceDashboardModel } from '../../lib/websitePerformanceDashboard'
import { currentReportingMonth, monthWindow, type WebsiteLeadMetrics } from '../../lib/websiteLeads'
import { PremiumCard, PremiumCardHeader } from '../ui/PremiumCard'
import { WebsitePerformanceDashboard } from '../website/WebsitePerformanceDashboard'

const monthLabel = (month: string) => new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))

/**
 * Staff Website Performance: the same premium story the client sees, for any selected client
 * and month. Traffic comes from the provider snapshot; enquiries and lead outcomes come only
 * from canonical #405 lead truth (never a provider conversion aggregate).
 */
export function WebsitePerformancePanel({ clients, canSave }: { clients: Client[]; canSave: boolean }) {
  const [clientId, setClientId] = useState('')
  const [month, setMonth] = useState(() => currentReportingMonth())
  const [performance, setPerformance] = useState<{ key: string; result: WebsitePerformanceResult | null; failed: boolean } | null>(null)
  const [leads, setLeads] = useState<{ key: string; load: LeadLoad<WebsiteLeadMetrics> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<WebsitePerformanceResult['saved'] | null>(null)
  const period = useMemo(() => monthWindow(month), [month])
  const key = `${clientId}:${month}`
  const client = clients.find((item) => item.id === clientId) ?? null

  useEffect(() => {
    if (!clientId || !period) return
    let active = true
    void getWebsitePerformance(clientId, period.from, period.to)
      .then((result) => { if (active) setPerformance({ key, result, failed: false }) })
      .catch(() => { if (active) setPerformance({ key, result: null, failed: true }) })
    void getWebsiteLeadMetrics(clientId, period.from, period.to)
      .then((load) => { if (active) setLeads({ key, load }) })
      .catch(() => { if (active) setLeads({ key, load: { state: 'error', message: 'Lead metrics could not be loaded.' } }) })
    return () => { active = false }
  }, [clientId, period, key])

  const currentPerformance = performance?.key === key ? performance : null
  const currentLeads = leads?.key === key ? leads.load : null
  const model = useMemo(() => currentPerformance
    ? websitePerformanceDashboardModel({ performance: currentPerformance.result, performanceFailed: currentPerformance.failed, leads: currentLeads })
    : null, [currentPerformance, currentLeads])

  const report = currentPerformance?.result?.report ?? null
  const canSaveSnapshot = canSave && report?.identity.environment === 'production' && ['available', 'partial'].includes(currentPerformance?.result?.state ?? '')

  const saveDraft = () => {
    if (!period) return
    setSaving(true)
    setSaveError(null)
    void saveWebsitePerformanceDraft(clientId, period.from, period.to)
      .then((result) => { setPerformance({ key, result, failed: false }); setSaved(result.saved ?? null) })
      .catch(() => setSaveError('The snapshot could not be saved. Check the migration and reporting configuration.'))
      .finally(() => setSaving(false))
  }

  return <section className="mt-6" aria-label="Website performance">
    <PremiumCard padding="lg" className="bg-white/[0.035]">
      <PremiumCardHeader title="Website performance" subtitle="The client's website story: traffic plus canonical website enquiries and lead outcomes." />
      <div className="flex flex-wrap gap-3">
        <label className="text-sm text-brand-primary/75">Client<br />
          <select className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" value={clientId}
            onChange={(event) => { setClientId(event.target.value); setSaveError(null); setSaved(null) }}>
            <option value="">Select a client</option>
            {clients.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-brand-primary/75">Month<br />
          <input className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" type="month" value={month}
            onChange={(event) => { setMonth(event.target.value); setSaveError(null); setSaved(null) }} />
        </label>
      </div>

      {clientId && period && !model && <p className="mt-5 text-sm text-brand-primary/75">Loading website performance…</p>}
      {client && period && model && <div className="mt-6">
        <WebsitePerformanceDashboard
          model={model}
          clientName={client.name}
          monthLabel={monthLabel(month)}
          clientId={clientId}
          period={period}
          leadInboxHref={`/admin/website-leads?client=${clientId}`}
          toolbar={canSaveSnapshot ? <button type="button" disabled={saving} onClick={saveDraft}
            className="rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-brand-bg disabled:opacity-50">
            {saving ? 'Saving…' : 'Save to monthly report draft'}
          </button> : undefined}
        />
        {saved && <p className="mt-4 text-sm text-brand-primary/80">
          Snapshot revision {saved.revision} saved for staff review.{' '}
          <Link className="font-semibold text-brand-accent underline" to={`/admin/reports/${saved.reportId}/edit`}>Open report draft</Link>
        </p>}
        {saveError && <p className="mt-4 text-sm text-amber-200">{saveError}</p>}
      </div>}
    </PremiumCard>
  </section>
}
