import { Suspense, useEffect, useState, type ComponentType } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ClientPortalContext } from '../../components/client/ClientPortalContext'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { listClients, type Client } from '../../lib/db/clients'
import { previewClientId } from '../../lib/clientPortalPreviewPolicy'
import { lazyRoute } from '../../lib/lazyRoute'

const ClientPortalHome = lazyRoute(() => import('../client/ClientPortalHome'))
const ClientPlanPage = lazyRoute(() => import('../client/ClientPlanPage'))
const Dashboard = lazyRoute(() => import('../client/Dashboard'))
const ContentReviewsPage = lazyRoute(() => import('./ContentReviewsPage'))
const ClientSetupPage = lazyRoute(() => import('../../features/client-onboarding/ClientSetupPage'))
// #672 owns the canonical read-only LeadInbox seam. Do not duplicate that lane.
type LeadPreviewProps = { clientId: string; preview: { clientName: string } }
const LeadPreview = lazyRoute<ComponentType<LeadPreviewProps>>(() => import('../client/ClientLeadsPage').then(module => {
  const inbox = 'LeadInbox' in module ? module.LeadInbox : null
  return { default: typeof inbox === 'function' ? inbox as ComponentType<LeadPreviewProps> : () => <ClientPortalErrorState title="Lead preview awaits the Website lane release" message="No unscoped or write-enabled inbox is substituted." /> }
}))

const AREAS = ['overview', 'plan', 'performance', 'approvals', 'brand-hub', 'leads'] as const

/** An explicit staff read scope, never an impersonated client authentication session. */
export default function ClientPortalPreview() {
  const { profile } = useAuth()
  const [params, setParams] = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const requested = params.get('client')
  const exactId = previewClientId(profile?.role, requested)
  const client = clients.find(row => row.id === exactId) ?? null
  const area = AREAS.find(value => value === params.get('area')) ?? 'overview'

  useEffect(() => {
    let active = true
    if (!['admin', 'manager'].includes(profile?.role ?? '')) return
    void listClients('active').then(result => {
      if (!active) return
      setClients(result.data)
      setFailed(Boolean(result.error))
      setLoading(false)
    }).catch(() => { if (active) { setFailed(true); setLoading(false) } })
    return () => { active = false }
  }, [profile?.role])

  if (!['admin', 'manager'].includes(profile?.role ?? '')) return <ClientPortalErrorState title="Manager preview access required" />
  const context = { client, previewClientId: exactId ?? undefined }
  return <ClientPortalContext.Provider value={context}>
    <ClientPortalShell client={client} previewClientId={exactId}>
      <section className="mb-7 rounded-2xl border border-teal-300/20 bg-teal-300/[0.04] p-4">
        <p className="text-xs font-black uppercase tracking-widest text-teal-300">Read-only client preview · your staff login is unchanged</p>
        <label className="mt-3 block text-sm text-slate-300">Selected client
          <select value={client?.id ?? ''} disabled={loading || failed} onChange={event => setParams({ client: event.target.value, area })} className="mt-2 block min-h-11 w-full max-w-lg rounded-xl border border-white/15 bg-[#071311] px-3 text-white">
            <option value="">Choose an active client</option>
            {clients.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </label>
      </section>
      {loading ? <ClientPortalLoadingState /> : failed ? <ClientPortalErrorState title="Client options could not be loaded" /> : !client ? <p className="text-sm text-slate-400">Select an exact active client to preview. No other client is substituted.</p>
        : <div key={`${client.id}:${area}`}><Suspense fallback={<ClientPortalLoadingState />}>
          {area === 'overview' ? <ClientPortalHome /> : area === 'plan' ? <ClientPlanPage /> : area === 'performance' ? <Dashboard /> : area === 'approvals' ? <ContentReviewsPage clientView /> : area === 'brand-hub' ? <ClientSetupPage />
            : <LeadPreview clientId={client.id} preview={{ clientName: client.name }} />}
        </Suspense></div>}
    </ClientPortalShell>
  </ClientPortalContext.Provider>
}
