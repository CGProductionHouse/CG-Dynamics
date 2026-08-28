import { useEffect, useState } from 'react'
import { disableWebPush, enableWebPush, getWebPushState, sendWebPushTest, type WebPushState } from '../../lib/webPush'
import { Pill } from '../ui/Badges'

const EMPTY_STATE: WebPushState = {
  supported: false,
  standalone: false,
  permission: 'unsupported',
  browserSubscription: false,
  serverSubscription: false,
  configured: false,
}

export function WebPushSetupCard() {
  const [state, setState] = useState<WebPushState>(EMPTY_STATE)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const enabled = state.permission === 'granted' && state.browserSubscription && state.serverSubscription

  async function refresh() {
    try {
      setState(await getWebPushState())
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check notification status.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initialCheck = window.setTimeout(() => { void refresh() }, 0)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(initialCheck)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  async function enable() {
    setBusy(true)
    setError(null)
    setTestMessage(null)
    try {
      setState(await enableWebPush('Home Screen web app'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    setError(null)
    setTestMessage(null)
    try {
      await disableWebPush()
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not disable notifications.')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    setError(null)
    setTestMessage(null)
    try {
      await sendWebPushTest()
      setTestMessage('Test queued. Close CG Dynamics and watch for the notification.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send a test notification.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(26,183,173,0.12),transparent_45%),rgba(8,15,13,0.92)] p-3 sm:mb-5 sm:p-5" aria-labelledby="push-setup-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">iPhone reminders</p>
          <h2 id="push-setup-heading" className="mt-1 text-base font-black text-white sm:text-lg">Lock Screen notifications</h2>
          <p className="mt-1 hidden max-w-2xl text-sm leading-relaxed text-brand-primary/70 sm:block">
            Receive your own plans, reminders and task assignments when CG Dynamics is closed.
          </p>
        </div>
        <Pill tone={enabled ? 'accent' : 'neutral'}>{loading ? 'Checking' : enabled ? 'Active on this device' : 'Not active'}</Pill>
      </div>

      <details className="group mt-3 border-t border-white/10 pt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-sm font-black text-brand-teal hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-teal/60">
          {enabled ? 'Manage notifications' : 'Set up notifications'}
          <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-180">v</span>
        </summary>

        <ol className="mt-3 grid gap-2 text-sm text-brand-primary/80 sm:grid-cols-2 xl:grid-cols-4">
          <li className="rounded-lg border border-white/8 bg-black/20 p-3"><strong className="text-white">1.</strong> Add CG Dynamics to your Home Screen.</li>
          <li className="rounded-lg border border-white/8 bg-black/20 p-3"><strong className="text-white">2.</strong> Open it from the Home Screen icon.</li>
          <li className="rounded-lg border border-white/8 bg-black/20 p-3"><strong className="text-white">3.</strong> Tap Enable notifications below.</li>
          <li className="rounded-lg border border-white/8 bg-black/20 p-3"><strong className="text-white">4.</strong> Send a test, close the app and lock the phone.</li>
        </ol>

        {!loading && !state.supported && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
            Web Push is not available here. On iPhone, use iOS 16.4 or later and open CG Dynamics from its Home Screen icon.
          </p>
        )}
        {!loading && state.supported && !state.standalone && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
            On iPhone, first use Safari Share &gt; Add to Home Screen, then open CG Dynamics from that icon.
          </p>
        )}
        {!loading && state.permission === 'denied' && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
            Notifications are blocked. Open iPhone Settings &gt; Notifications &gt; CG Dynamics to allow them.
          </p>
        )}
        {!loading && state.permission === 'granted' && !state.serverSubscription && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
            Browser permission exists, but this device is not registered with CG Dynamics. Tap Enable notifications to repair it.
          </p>
        )}
        {!loading && !state.configured && state.supported && (
          <p className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-sm text-amber-100">
            Server push keys are not configured yet. In-app notifications remain available.
          </p>
        )}

        {error && <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        {testMessage && <p role="status" className="mt-3 rounded-lg border border-brand-teal/20 bg-brand-teal/10 p-3 text-sm text-brand-teal">{testMessage}</p>}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {!enabled ? (
            <button type="button" onClick={() => void enable()} disabled={busy || loading || !state.supported || !state.configured}
              className="min-h-12 rounded-lg bg-brand-teal px-5 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? 'Enabling...' : 'Enable notifications'}
            </button>
          ) : (
            <>
              <button type="button" onClick={() => void test()} disabled={busy}
                className="min-h-12 rounded-lg bg-brand-teal px-5 text-sm font-black text-black disabled:opacity-50">
                {busy ? 'Sending...' : 'Send test notification'}
              </button>
              <button type="button" onClick={() => void disable()} disabled={busy}
                className="min-h-12 rounded-lg border border-white/15 px-5 text-sm font-bold text-white hover:bg-white/5 disabled:opacity-50">
                Disable on this device
              </button>
            </>
          )}
          <button type="button" onClick={() => void refresh()} disabled={busy || loading}
            className="min-h-12 rounded-lg border border-white/10 px-5 text-sm font-bold text-brand-primary hover:text-white disabled:opacity-50">
            Refresh status
          </button>
        </div>
        <p className="mt-3 text-xs text-brand-primary/50">Permission alone is not enough. “Active” means this browser subscription is also stored securely for your signed-in account.</p>
      </details>
    </section>
  )
}
