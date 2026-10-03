import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listClients, type Client } from '../../lib/db/clients'
import { LeadInbox } from '../client/ClientLeadsPage'

/**
 * Staff, read-only preview of one client's Lead Inbox (#405 x #335 reviewability). The same
 * component the client uses, scoped server-side to the named client; staff cannot change lead
 * progress here and contact actions are inert.
 */
export default function WebsiteLeadsPreviewPage() {
  const [params, setParams] = useSearchParams()
  const clientId = params.get('client') ?? ''
  const [clients, setClients] = useState<Client[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void listClients('active')
      .then(({ data, error }) => { if (!active) return; if (error) setFailed(true); else setClients(data) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [])

  const client = clients?.find((item) => item.id === clientId) ?? null

  return <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <Link to="/admin/client-performance" className="text-sm font-semibold text-brand-accent">← Website performance</Link>
        <h1 className="mt-2 text-2xl font-black text-white">Client Lead Inbox preview</h1>
      </div>
      <label className="text-sm text-brand-primary/75">Client<br />
        <select className="mt-1 rounded-lg border border-white/15 bg-[#14222a] px-3 py-2 text-white" value={clientId}
          onChange={(event) => setParams(event.target.value ? { client: event.target.value } : {})}>
          <option value="">Select a client</option>
          {(clients ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
    </div>
    {failed && <p className="text-sm text-amber-200">Clients could not be loaded.</p>}
    {!failed && clients && !client && <p className="text-sm text-brand-primary/75">{clientId ? 'That client is not active.' : 'Select a client to preview their Lead Inbox.'}</p>}
    {client && <LeadInbox key={client.id} clientId={client.id} preview={{ clientName: client.name }} />}
  </div>
}
