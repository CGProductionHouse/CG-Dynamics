import { useEffect, useState } from 'react'
import { readServiceEvidence, readServiceExpansionReview, verifyServiceEvidence, type ServiceEvidence, type ServiceExpansionReview } from '../../lib/clientServiceEntitlements'
import { Link } from 'react-router-dom'
import { SERVICE_COPY, SERVICE_KEYS, type EntitlementState, type ServiceKey } from '../../lib/clientServicePresentation'

export function ServiceEntitlementReview({ clientId, service, onVerified }: { clientId: string; service?: ServiceKey; onVerified?: () => void }) {
  const [result, setResult] = useState<{ clientId: string; rows: ServiceEvidence[]; review: ServiceExpansionReview[] } | null>(null)
  const [error, setError] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let current = true
    void Promise.all([readServiceEvidence(clientId), readServiceExpansionReview(clientId)]).then(([rows, review]) => {
      if (current) { setResult({ clientId, rows, review }); setError(false) }
    }).catch(() => { if (current) setError(true) })
    return () => { current = false }
  }, [clientId, reload])
  const rows = result?.clientId === clientId ? result.rows : null
  return <section className="mb-8 rounded-2xl border border-brand-teal/20 bg-brand-teal/[0.025] p-5">
    <h2 className="text-xl font-bold text-white">Verified service scope</h2>
    <p className="mt-2 text-sm leading-6 text-white/60">Separate from deliverable quantities. Verify from an approved package or agreement, never a missing connection or inferred notes. No package, provider or billing change is made here.</p>
    <Link to="/admin/work?tab=board" className="mt-3 inline-block text-sm text-brand-teal underline underline-offset-4">Review expansion requests in Operations → CLIENT REQUESTS</Link>
    {result?.clientId === clientId && <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">{result.review.filter(row => row.surface_views || row.requests).map(row => <p key={row.service_key}>{SERVICE_COPY[row.service_key].name}: {row.surface_views} service views · {row.requests} requests</p>)}</div>}
    {error ? <p role="alert" className="mt-4 text-sm text-amber-300">Evidence could not be loaded. Migration application and verification remain protected rollout gates.</p> : !rows ? <p role="status" className="mt-4 text-white/50">Loading evidence…</p> : SERVICE_KEYS.filter(key => !service || key === service).map(key => <EvidenceEditor key={`${clientId}:${key}:${rows.find(row => row.service_key === key)?.revision ?? 0}`} clientId={clientId} service={key} evidence={rows.find(row => row.service_key === key)} onSaved={() => { setReload(value => value + 1); onVerified?.() }} />)}
  </section>
}

function EvidenceEditor({ clientId, service, evidence, onSaved }: { clientId: string; service: ServiceKey; evidence?: ServiceEvidence; onSaved: () => void }) {
  const [state, setState] = useState<EntitlementState>(evidence?.state ?? 'unknown')
  const [note, setNote] = useState(evidence?.evidence_note ?? '')
  const [sources, setSources] = useState(evidence?.source_references.join('\n') ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  return <form onSubmit={event => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setStatus('')
    void verifyServiceEvidence(clientId, service, state, note, sources.split('\n').map(value => value.trim()).filter(Boolean), evidence?.revision ?? 0)
      .then(() => { setStatus('Verified and audited.'); onSaved() })
      .catch(() => setStatus('Not saved. Check authority, provenance and reload if another reviewer changed this evidence.'))
      .finally(() => setBusy(false))
  }} className="mt-5 border-t border-white/10 pt-5">
    <div className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
      <div><h3 className="font-bold text-white">{SERVICE_COPY[service].name}</h3><p className="mt-1 text-xs text-white/50">{evidence ? `Verified ${new Date(evidence.verified_at).toLocaleDateString()}` : 'No verified evidence · unknown'}</p>
        <label className="mt-3 block text-xs text-white/60">Service scope<select aria-label={`${SERVICE_COPY[service].name} scope`} value={state} onChange={event => setState(event.target.value as EntitlementState)} className="mt-1 block w-full rounded-lg border border-white/15 bg-brand-bg p-2 text-sm text-white">{(['unknown', 'included', 'not_included', 'not_applicable'] as const).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
      </div>
      <div><label className="block text-xs text-white/60">Evidence summary<textarea required maxLength={2000} value={note} onChange={event => setNote(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-brand-bg p-2 text-sm text-white" /></label>
        <label className="mt-3 block text-xs text-white/60">Approved source references (one per line)<textarea required={state !== 'unknown'} value={sources} onChange={event => setSources(event.target.value)} className="mt-1 block w-full rounded-lg border border-white/15 bg-brand-bg p-2 text-sm text-white" /></label>
        <button disabled={busy} className="mt-3 min-h-11 rounded-full border border-brand-teal/40 px-4 text-sm text-brand-teal disabled:opacity-50">{busy ? 'Verifying…' : 'Verify service scope'}</button>
        {status && <p role="status" className="mt-2 text-sm text-white/60">{status}</p>}
      </div>
    </div>
  </form>
}
