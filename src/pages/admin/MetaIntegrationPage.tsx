import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STEP_LABELS = ['Connect Meta', 'Link assets', 'Sync data', 'Review draft']

type ConnectState = 'idle' | 'loading' | 'connected' | 'error'

export default function MetaIntegrationPage() {
  const [searchParams] = useSearchParams()
  const [connectState, setConnectState] = useState<ConnectState>('idle')
  const [connectMsg, setConnectMsg] = useState<string | null>(null)
  const [testState, setTestState] = useState<{
    action: string | null
    loading: boolean
    msg: string | null
    isError: boolean
    detail: string | null
  }>({ action: null, loading: false, msg: null, isError: false, detail: null })

  // Read OAuth result from URL query params after callback redirect.
  useEffect(() => {
    const meta = searchParams.get('meta')
    if (meta === 'connected') {
      setConnectState('connected')
      setConnectMsg('Meta connected. Next step: link assets to clients.')
      // Clean the URL without a full page reload.
      window.history.replaceState(null, '', window.location.pathname)
    } else if (meta === 'error') {
      setConnectState('error')
      setConnectMsg('Meta connection failed. Please try again.')
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [searchParams])

  async function handleConnect() {
    setConnectState('idle')
    setConnectMsg(null)
    setTestState({ action: null, loading: false, msg: null, isError: false, detail: null })
    try {
      const { data, error } = await supabase.functions.invoke('meta-oauth-start', {
        method: 'POST',
      })
      if (error) {
        setConnectState('error')
        setConnectMsg('Could not reach the connection service. Check Supabase Edge Function deployment.')
        return
      }
      if (!data?.ok || !data?.url) {
        setConnectState('error')
        setConnectMsg(data?.error || 'Failed to start Meta connection.')
        return
      }
      // Redirect browser to Meta OAuth dialog.
      window.location.href = data.url
    } catch {
      setConnectState('error')
      setConnectMsg('Could not reach the connection service.')
    }
  }

  async function testService(endpoint: string, body?: Record<string, unknown>) {
    setTestState({ action: endpoint, loading: true, msg: null, isError: false, detail: null })
    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        method: 'POST',
        body: body ?? {},
      })
      if (error) {
        setTestState({
          action: endpoint,
          loading: false,
          msg: 'Could not reach the Meta service. Check Supabase Edge Function deployment.',
          isError: true,
          detail: error.message,
        })
        return
      }
      const ok = data?.ok !== false
      setTestState({
        action: endpoint,
        loading: false,
        msg: ok
          ? 'Service is reachable and responding correctly.'
          : `Unexpected response from ${endpoint}.`,
        isError: !ok,
        detail: JSON.stringify(data, null, 2),
      })
    } catch (err) {
      setTestState({
        action: endpoint,
        loading: false,
        msg: 'Could not reach the Meta service. Check Supabase Edge Function deployment.',
        isError: true,
        detail: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary">
          Integrations
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Meta Business Sync
        </h1>
        <p className="mt-1 text-sm text-brand-primary">
          Connect Facebook and Instagram assets so reports can be built without
          CSV exports.
        </p>
      </div>

      {/* Connection status banner */}
      {connectMsg && (
        <div
          className={`mt-6 max-w-2xl rounded-xl border p-5 ${
            connectState === 'connected'
              ? 'border-brand-accent/20 bg-brand-accent/10'
              : 'border-red-400/20 bg-red-400/10'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              connectState === 'connected' ? 'text-brand-accent' : 'text-red-400'
            }`}
          >
            {connectMsg}
          </p>
        </div>
      )}

      {/* Horizontal step indicator */}
      <div className="mt-6 inline-flex items-center overflow-hidden rounded-xl border border-brand-muted bg-brand-surface">
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-2 px-4 py-3 ${
              i < STEP_LABELS.length - 1 ? 'border-r border-brand-muted' : ''
            }`}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
              {i + 1}
            </span>
            <span className="whitespace-nowrap text-sm text-white">{label}</span>
          </div>
        ))}
      </div>

      {/* Step detail cards */}
      <div className="mt-6 space-y-4 max-w-2xl">
        {/* Step 1 — Connect Meta */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                  1
                </span>
                <h2 className="text-sm font-semibold text-white">Connect Meta</h2>
              </div>
              <span
                className={`shrink-0 text-xs font-medium ${
                  connectState === 'connected'
                    ? 'text-brand-accent'
                    : 'text-amber-400'
                }`}
              >
                {connectState === 'connected' ? 'Connected' : 'Not connected'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Authorise CG Dynamics to access your Facebook Business assets.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connectState === 'connected' || testState.loading}
                className={`rounded-lg border px-5 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                  connectState === 'connected'
                    ? 'border-brand-accent/50 bg-brand-accent/10 text-brand-accent'
                    : 'border-brand-accent bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20'
                }`}
              >
                {connectState === 'connected'
                  ? 'Reconnect Meta'
                  : 'Connect Meta'}
              </button>
              {connectState !== 'connected' && (
                <button
                  type="button"
                  onClick={() => testService('meta-oauth-start')}
                  disabled={testState.loading}
                  className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-medium text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testState.action === 'meta-oauth-start' && testState.loading
                    ? 'Testing…'
                    : 'Test service'}
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-brand-primary/50">
              OAuth connection redirects to Meta for authorisation.
            </p>
          </div>
        </div>

        {/* Step 2 — Link assets */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                  2
                </span>
                <h2 className="text-sm font-semibold text-white">
                  Link assets to clients
                </h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-brand-primary">
                {connectState === 'connected'
                  ? 'Coming next'
                  : 'Waiting for Meta connection'}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Choose which Facebook Page, Instagram account and ad account belong
              to each CG client.
            </p>
            <div className="mt-4 space-y-3">
              {['CG Client', 'Facebook Page', 'Instagram Account', 'Ad Account'].map(
                field => (
                  <div
                    key={field}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="w-32 text-sm text-brand-primary">{field}</span>
                    <input
                      type="text"
                      disabled
                      className="flex-1 rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-2 text-sm text-brand-primary placeholder-brand-primary/30"
                      placeholder="Waiting for connection…"
                    />
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        {/* Step 3 — Sync report data */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                  3
                </span>
                <h2 className="text-sm font-semibold text-white">
                  Sync report data
                </h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-brand-primary">
                Waiting for linked assets
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Pull monthly performance data and create or update a report draft.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Sync previous completed month
              </button>
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Sync current month as internal draft
              </button>
              <button
                type="button"
                onClick={() =>
                  testService('meta-sync', {
                    clientId: null,
                    syncType: 'previous_completed_month',
                    periodStart: null,
                    periodEnd: null,
                  })
                }
                disabled={testState.loading}
                className="rounded-lg border border-brand-muted px-3 py-2 text-xs font-medium text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testState.action === 'meta-sync' && testState.loading
                  ? 'Testing…'
                  : 'Test service'}
              </button>
            </div>
          </div>
        </div>

        {/* Step 4 — Review draft */}
        <div className="rounded-xl border border-brand-muted bg-brand-surface">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-semibold text-brand-accent">
                4
              </span>
              <h2 className="text-sm font-semibold text-white">
                Review monthly draft
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              After sync, CG Dynamics will create or update a monthly report
              draft. Staff can add strategy, preview as client, and publish.
            </p>
          </div>
        </div>
      </div>

      {/* Test result display */}
      {testState.msg && (
        <div
          className={`mt-6 max-w-2xl rounded-xl border p-5 ${
            testState.isError
              ? 'border-red-400/20 bg-red-400/10'
              : 'border-brand-accent/20 bg-brand-accent/10'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              testState.isError ? 'text-red-400' : 'text-brand-accent'
            }`}
          >
            {testState.msg}
          </p>
          {testState.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-brand-primary/60 hover:text-brand-primary">
                Response detail
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-bg/50 p-3 text-xs text-brand-primary">
                {testState.detail}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Architecture note */}
      <div className="mt-10 max-w-2xl rounded-xl border border-brand-muted bg-brand-surface/30 p-5">
        <h3 className="text-xs uppercase tracking-[0.15em] text-brand-primary/60">
          Planned safe setup
        </h3>
        <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-brand-primary/70">
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Meta tokens will never be stored in the frontend.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            OAuth and API calls will run through Supabase Edge Functions.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Synced data will create or update draft reports only.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Reports will never auto-publish.
          </li>
          <li className="flex items-start gap-2 before:mt-[5px] before:block before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-brand-primary/50">
            Current month data stays as internal draft until month-end.
          </li>
        </ul>
      </div>
    </div>
  )
}
