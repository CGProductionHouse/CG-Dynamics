import { useEffect, useState } from 'react'
import { WebsitePerformancePanel } from '../../components/admin/WebsitePerformancePanel'
import { listClients, type Client } from '../../lib/db/clients'
import { reviewedNolanWebsites } from '../../lib/nolanWebsiteConnections'

export function NolanWebsiteConnections() {
  const [requested, setRequested] = useState(false)
  const [retry, setRetry] = useState(0)
  const [clients, setClients] = useState<Client[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!requested) return
    let cancelled = false
    void listClients('active').then(result => {
      if (cancelled) return
      if (result.error) { setError('Active client directory unavailable. Retry to load reviewed connections.'); return }
      setClients(result.data)
      setCheckedAt(new Date().toISOString())
    }).catch(() => { if (!cancelled) setError('Active client directory unavailable. Retry to load reviewed connections.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [requested, retry])
  const reviewed = reviewedNolanWebsites(clients ?? [])
  return <section aria-label="Reviewed website connections">
    <div className="coverage"><strong>Partial coverage: 4 reviewed reporting mappings, not the full website fleet.</strong>
      <p>The complete CG Builder inventory remains unavailable here. Mapping is not proof of live health, indexing or reporting availability. Unmapped and maintenance-only sites are not included.</p>
      <p>Reports load only after choosing a client and month below, through the existing Dynamics reporting service. Refresh resets this panel; choose the client again to fetch a new report. Directory read time is not the reporting source's freshness.</p>
      <button className="refresh-data" disabled={loading} onClick={() => { setLoading(true); setClients(null); setCheckedAt(null); setError(null); setRequested(true); setRetry(value => value + 1) }}>{loading ? 'Reading connections…' : error ? 'Retry connections' : requested ? 'Refresh connections and reset report' : 'Load reviewed connections'}</button>
      {error && <p role="alert">{error}</p>}
      {checkedAt && <p>{reviewed.length} of 4 reviewed mappings matched accessible active client records. Directory read: {new Date(checkedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST.</p>}
    </div>
    {clients && <><div className="grid list">{reviewed.map(({client, website}) => <article className="card" key={client.id}><h3>{client.name}</h3><span className="badge">Reviewed mapping</span><p className="next">{website.canonicalHost}</p><a className="native-owner" href={`https://${website.canonicalHost}`} target="_blank" rel="noopener noreferrer">Visit ↗</a></article>)}</div>
      {reviewed.length === 0 ? <p role="status">No reviewed reporting mappings matched this active-client read. This is not an empty-fleet result.</p> : <div className="nolan-report-panel" key={retry}><WebsitePerformancePanel clients={reviewed.map(item => item.client)} canSave={false} showFreshness /></div>}
    </>}
  </section>
}
