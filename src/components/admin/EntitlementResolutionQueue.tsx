import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { buildResolutionRows, filterResolutionRows, type ResolutionFilters, type ResolutionClient } from '../../lib/entitlementResolution'
import { readEntitlementResolutionQueue } from '../../lib/entitlementResolutionRead'
import { SERVICE_KEYS, SERVICE_COPY } from '../../lib/clientServicePresentation'
import { ServiceEntitlementReview } from './ServiceEntitlementReview'

const EMPTY_FILTERS: ResolutionFilters = { service: '', client: '', readiness: '', context: '', reviewed: '' }
export function EntitlementResolutionQueue() {
  const { profile } = useAuth()
  const authorized = !!profile?.is_active && ['admin', 'manager'].includes(profile.role)
  const identity = authorized ? profile.id : null
  const [result, setResult] = useState<{ identity: string; clients: ResolutionClient[] } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [limit, setLimit] = useState(20)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (!identity) return
    let current = true
    void readEntitlementResolutionQueue().then(clients => {
      if (current) { setResult({ identity, clients }); setFailure(null) }
    }).catch(() => { if (current) { setResult(null); setFailure(identity) } })
    return () => { current = false }
  }, [identity, reload])
  const clients = result?.identity === identity ? result.clients : null
  const rows = useMemo(() => buildResolutionRows(clients ?? []), [clients])
  const filtered = filterResolutionRows(rows.filter(row => row.unresolved), filters)
  const selection = filtered.find(row => `${row.client.client_id}:${row.service}` === selected)
  if (!authorized) return null
  const change = (key: keyof ResolutionFilters, value: string) => { setFilters(old => ({ ...old, [key]: value })); setLimit(20); setSelected(null) }
  const selectClass = 'mt-1 w-full min-w-0 rounded-lg border border-white/15 bg-brand-bg p-2.5 text-sm text-white'
  return <section className="mb-8 min-w-0 rounded-2xl border border-brand-teal/25 bg-brand-teal/[0.025] p-4 sm:p-6">
    <p className="text-xs uppercase tracking-[0.2em] text-brand-teal">Service agreements · staff resolution</p>
    <h2 className="mt-2 text-2xl font-bold text-white">Entitlement Resolution Queue</h2>
    <p className="mt-3 text-sm leading-6 text-white/60">Package scope is a human decision. Connections and generic social context do not prove a platform entitlement. Review one exact client and service at a time; nothing is bulk-confirmed.</p>
    {failure === identity ? <div role="alert" className="mt-5 text-sm text-amber-300">Resolution read unavailable. Migration/schema/permission/read failures do not mean an empty or reviewed queue. Verification is unavailable here.<button type="button" onClick={() => setReload(n => n + 1)} className="ml-3 min-h-11 underline">Retry read</button></div>
      : !clients ? <p role="status" className="mt-5 text-white/60">Loading exact-client evidence…</p> : <>
        <p role="status" className="mt-5 text-sm text-white/80">{rows.filter(r => r.unresolved).length} decisions needed · {rows.filter(r => r.ready && r.unresolved).length} evidence-ready examples · {rows.filter(r => r.unresolved && !r.ready).length} need exact service agreement · {rows.filter(r => r.reviewed).length} reviewed · {clients.length} active clients</p>
        <p className="mt-2 text-xs text-white/50">Ready examples are accepted evidence hints, not verified entitlements. Website-only evidence does not promise SEO/AEO/GEO, analytics or an update quota.</p>
        <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-white/60">Service<select aria-label="Queue service" value={filters.service} onChange={e => change('service', e.target.value)} className={selectClass}><option value="">All services</option>{SERVICE_KEYS.map(key => <option key={key} value={key}>{SERVICE_COPY[key].name}</option>)}</select></label>
          <label className="text-xs text-white/60">Client<select aria-label="Queue client" value={filters.client} onChange={e => change('client', e.target.value)} className={selectClass}><option value="">All active clients</option>{[...clients].sort((a,b) => a.client_name.localeCompare(b.client_name)).map(c => <option key={c.client_id} value={c.client_id}>{c.client_name}</option>)}</select></label>
          <label className="text-xs text-white/60">Evidence<select aria-label="Queue evidence" value={filters.readiness} onChange={e => change('readiness', e.target.value)} className={selectClass}><option value="">All evidence</option><option value="ready">Evidence-ready examples</option><option value="unresolved">Unresolved agreement</option></select></label>
          <label className="text-xs text-white/60">Generic context (non-decisive)<select aria-label="Queue context" value={filters.context} onChange={e => change('context', e.target.value)} className={selectClass}><option value="">All package context</option><option value="eligible">Recurring social context</option><option value="excluded">Non-social context</option><option value="unresolved">Context unresolved</option></select></label>
          <label className="text-xs text-white/60">Review<select aria-label="Queue review" value={filters.reviewed} onChange={e => change('reviewed', e.target.value)} className={selectClass}><option value="">All reviews</option><option value="unreviewed">Unreviewed</option><option value="reviewed">Reviewed (including unknown)</option></select></label>
        </div>
        <p className="mt-5 text-xs text-white/60">{filtered.length} matching unresolved client × service rows. Showing {Math.min(limit, filtered.length)}. Explicitly resolved services leave this queue.</p>
        {!filtered.length && <p className="mt-4 text-white/60">No rows match these filters.</p>}
        <div className="mt-3 space-y-3">{filtered.slice(0, limit).map(row => {
          const key = `${row.client.client_id}:${row.service}`
          return <article key={key} className="min-w-0 rounded-xl border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-white">{row.client.client_name} · {SERVICE_COPY[row.service].name}</h3><p className="mt-1 text-xs text-white/60">Entitlement: {row.evidence?.state.replaceAll('_', ' ') ?? 'unknown (missing row)'} · {row.reviewed ? 'Reviewed' : 'Unreviewed'} · {row.ready ? 'Evidence-ready example' : row.unresolved ? 'Agreement decision needed' : 'Explicitly resolved'}</p></div>
              <button type="button" onClick={() => setSelected(selected === key ? null : key)} className="min-h-11 rounded-full border border-brand-teal/40 px-4 text-sm text-brand-teal">{selected === key ? 'Close review' : 'Review this service'}</button></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wider text-white/60">Approved package evidence</p><p className="mt-1 text-xs text-white/50">{row.confirmedAt ? `Confirmed ${new Date(row.confirmedAt).toLocaleDateString('en-ZA')}` : 'Package unverified — not agreement authority'}</p>
              <details className="mt-2 text-sm text-white/70"><summary className="cursor-pointer">Evidence and exact source references</summary><div className="mt-2 space-y-2 break-words">{row.packageEvidence.map(text => <p key={text}>{text}</p>)}{row.sources.map(source => <p key={source}>{source}</p>)}{!row.sources.length && <p>No approved references.</p>}{row.evidence && <><p>Service verification: {row.evidence.evidence_note}</p>{row.evidence.source_references.map(source => <p key={source}>{source}</p>)}</>}</div></details>
            </div><div><p className="text-xs font-bold uppercase tracking-wider text-white/60">Provider connection — not package evidence</p><p className="mt-2 text-sm text-white/70">{row.connection === 'connected' ? 'Configured source connected (not metric completeness)' : row.connection === 'needs_connection' ? 'No configured connection proven' : 'Connection adapter unavailable'}</p><p className="mt-2 text-xs text-white/50">Generic {row.context === 'eligible' ? 'recurring-social' : row.context === 'excluded' ? 'non-social' : 'unresolved'} package context · NON-DECISIVE for individual platform scope.</p></div></div>
            {selection && selected === key && <ServiceEntitlementReview key={key} clientId={row.client.client_id} service={row.service} onVerified={() => { setSelected(null); setResult(null); setReload(n => n + 1) }} />}
          </article>
        })}</div>
        {filtered.length > limit && <button type="button" onClick={() => setLimit(n => n + 20)} className="mt-4 min-h-11 text-brand-teal">Show next 20 rows</button>}
      </>}
  </section>
}
