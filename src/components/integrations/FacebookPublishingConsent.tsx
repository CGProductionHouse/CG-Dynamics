import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { startFacebookPublishingConsent, type MetaConsentInvoke } from '../../lib/metaPublishingConsent'
import { ActionButton } from '../ui/Buttons'

const invokeConsent: MetaConsentInvoke = (name, options) => supabase.functions.invoke(name, options)
const navigateToConsent = (url: string) => { window.location.assign(url) }

export function FacebookPublishingConsent({ disabled, checking, grantedScopes, invoke = invokeConsent, navigate = navigateToConsent }: {
  disabled: boolean
  checking: boolean
  grantedScopes: readonly string[] | null
  invoke?: MetaConsentInvoke
  navigate?: (url: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef(false), mounted = useRef(false), currentDisabled = useRef(disabled)
  const id = useId()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useLayoutEffect(() => { currentDisabled.current = disabled }, [disabled])

  async function requestPermission() {
    if (!confirmed || disabled || pending.current) return
    pending.current = true; setBusy(true); setMessage(null)
    try {
      const result = await startFacebookPublishingConsent(true, invoke)
      if (!mounted.current || currentDisabled.current) return
      if (result.state === 'redirect') navigate(result.url)
      else setMessage(result.message)
    } catch {
      if (mounted.current) setMessage('Could not open Facebook permission setup. No post was scheduled.')
    } finally {
      pending.current = false
      if (mounted.current) { setBusy(false); setConfirmed(false) }
    }
  }

  return <section className="mt-5 border-t border-white/10 pt-5" aria-labelledby={`${id}-title`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id={`${id}-title`} className="text-sm font-bold text-white">Facebook publishing permission</h3>
        <p className="mt-1 text-xs text-brand-primary" role="status">{checking ? 'Checking recorded permission…'
          : grantedScopes?.includes('pages_manage_posts') ? 'Permission recorded · Page checks still required'
            : grantedScopes ? 'Publishing permission not recorded' : 'Recorded permission unavailable'}</p>
      </div>
      {!open && <ActionButton type="button" variant="secondary" size="sm" disabled={disabled}
        aria-expanded={false} aria-controls={`${id}-setup`} onClick={() => { setOpen(true); setConfirmed(false); setMessage(null) }}>Review publishing setup</ActionButton>}
    </div>
    <p className="mt-3 text-sm leading-6 text-brand-primary">Allow Dynamics to request Page-posting access separately from reporting. Permission alone does not enable scheduling.</p>
    {open && <div id={`${id}-setup`} className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-sm leading-6 text-brand-primary">Facebook will ask for Page-posting permission. Keep your existing client and asset selections unchanged. This step does not schedule or publish content.</p>
      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm leading-6 text-white">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-brand-accent" checked={confirmed} disabled={disabled || busy}
          onChange={event => setConfirmed(event.target.checked)} />
        <span>I want to request Facebook Page-posting permission.</span>
      </label>
      {message && <p role="alert" className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm leading-6 text-brand-primary">{message}</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <ActionButton type="button" disabled={!confirmed || disabled || busy} loading={busy} onClick={() => void requestPermission()}>Continue to Facebook</ActionButton>
        <ActionButton type="button" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setConfirmed(false); setMessage(null) }}>Cancel</ActionButton>
      </div>
    </div>}
  </section>
}
