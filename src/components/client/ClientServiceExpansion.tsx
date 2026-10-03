import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { readMyServiceEntitlements, recordServiceSurface, requestServiceExpansion } from '../../lib/clientServiceEntitlements'
import { SERVICE_COPY, servicePresentation, visibleClientServices, type ServiceEntitlement } from '../../lib/clientServicePresentation'
import { PerformanceProviderIcon } from './PerformanceProviderIcon'

export function ClientServiceExpansion({ surface = 'performance' }: { surface?: 'overview' | 'performance' }) {
  const { profile } = useAuth()
  const identity = `${profile?.id}:${profile?.client_id}`
  const [result, setResult] = useState<{ identity: string; surface: string; items: ServiceEntitlement[] } | null>(null)
  const viewKey = useRef(crypto.randomUUID())
  useEffect(() => {
    let current = true
    if (!profile?.client_id) return
    void readMyServiceEntitlements().then(items => {
      if (!current) return
      setResult({ identity, surface, items })
      // Measurement failure must not masquerade as a failed entitlement read.
      if (visibleClientServices(items, surface).length) void recordServiceSurface(surface, viewKey.current).catch(() => undefined)
    }).catch(() => { if (current) setResult({ identity, surface, items: [] }) })
    return () => { current = false }
  }, [identity, profile?.client_id, surface])
  if (!profile?.client_id) return null
  const current = result?.identity === identity && result.surface === surface ? result : null
  const items = visibleClientServices(current?.items ?? null, surface)
  // Absent migration, loading, failed reads and unverified scope are invisible
  // on client surfaces. Rollout diagnostics belong in admin Package Master.
  if (!items.length) return null
  return <section aria-labelledby={`services-${surface}`} className="mt-16 border-t border-report-line pt-10 sm:mt-20 sm:pt-14">
    <p className="text-xs font-black uppercase tracking-[0.24em] text-report-accent">Your next chapter</p>
    <h2 id={`services-${surface}`} className="mt-3 text-3xl font-black tracking-tight text-report-text sm:text-5xl">A presence with purpose.</h2>
    <p className="mt-4 max-w-2xl text-base leading-7 text-report-muted">Your verified services, and thoughtful ways to extend your reach. Every addition starts with a conversation, not an automatic package change.</p>
    <div className="mt-8 divide-y divide-report-line">
      {items.map(item => <ServiceStory key={`${identity}:${item.service_key}`} item={item} surface={surface} />)}
    </div>
  </section>
}

export function ServiceStory({ item, surface }: { item: ServiceEntitlement; surface: 'overview' | 'performance' }) {
  const copy = SERVICE_COPY[item.service_key]
  const presentation = servicePresentation(item)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [receipt, setReceipt] = useState(item.requested_at)
  const [error, setError] = useState(false)
  const attempt = useRef<{ key: string; message: string } | null>(null)
  async function submit() {
    if (pending || receipt) return
    setPending(true); setError(false)
    // Freeze the payload after sending: an ambiguous response must retry the
    // same transaction, never create a second request under a new key.
    if (!attempt.current) attempt.current = { key: crypto.randomUUID(), message }
    try {
      const response = await requestServiceExpansion(item.service_key, attempt.current.message, attempt.current.key, surface)
      setReceipt(response.submitted_at); setOpen(false)
    } catch { setError(true) } finally { setPending(false) }
  }
  return <article className={`grid gap-5 py-8 sm:gap-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] ${presentation.kind === 'opportunity' ? 'bg-gradient-to-r from-transparent to-[#b77949]/[0.035]' : ''}`}>
    <div>
      <div className="flex items-center gap-3"><PerformanceProviderIcon provider={copy.icon} /><h3 className="text-xl font-bold text-report-text sm:text-2xl">{copy.name}</h3></div>
      <p className={`mt-3 text-xs font-semibold tracking-wide ${presentation.kind === 'connected' ? 'text-report-accent' : 'text-report-muted'}`}>{presentation.label}</p>
    </div>
    <div className="min-w-0">
      <p className="max-w-2xl text-base leading-7 text-report-muted">{presentation.kind === 'opportunity' ? copy.benefit : presentation.kind === 'connected' ? `${copy.value} Your source is connected; published reporting remains the authority for results.` : presentation.kind === 'connection' ? 'This service is already part of your package. CG will help complete the connection; there is no need to add it again.' : item.state === 'included' ? 'This service is included. Connection information is not currently verified here; no results or activity are assumed.' : item.state === 'not_applicable' ? 'CG has verified that this service is not applicable to your current package.' : 'CG is verifying the service scope for your package. An unverified service is not an upgrade opportunity.'}</p>
      {receipt ? <p role="status" className="mt-5 text-sm font-medium text-report-accent">Request received. CG will discuss the scope and quote with you before anything changes.</p> : presentation.canRequest && <>
        {!open && <button type="button" onClick={() => setOpen(true)} className="mt-5 min-h-11 rounded-full border border-report-accent/40 px-5 py-2 text-sm font-semibold text-report-accent transition hover:bg-report-accent/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-report-accent">{item.service_key === 'website_digital_experience' ? 'Explore a premium CG-built website' : 'Ask CG about this'}</button>}
        {open && <form onSubmit={event => { event.preventDefault(); void submit() }} className="mt-5 max-w-xl">
          <label htmlFor={`request-${item.service_key}`} className="text-sm text-report-text">What would you like to explore? <span className="text-report-muted">(optional)</span></label>
          <textarea id={`request-${item.service_key}`} maxLength={2000} rows={3} value={message} disabled={pending || error} onChange={event => setMessage(event.target.value)} className="mt-2 block w-full rounded-xl border border-report-line bg-report-surface p-3 text-report-text focus:outline-report-accent" />
          <p className="mt-2 text-xs leading-5 text-report-muted">A conversation request only. No purchase, price or package change is authorised.</p>
          {error && <p role="alert" className="mt-3 text-sm text-report-sand">We could not confirm receipt. Try again with the same message, or contact CG.</p>}
          <div className="mt-4 flex flex-wrap gap-3"><button disabled={pending} className="min-h-11 rounded-full bg-report-accent px-5 py-2 font-semibold text-report-bg disabled:opacity-50">{pending ? 'Sending…' : 'Send request'}</button><button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-11 px-3 text-report-muted">Cancel</button></div>
        </form>}
      </>}
    </div>
  </article>
}
