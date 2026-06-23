import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STEP_LABELS = ['Connect Meta', 'Link assets', 'Sync data', 'Review draft']

export default function MetaIntegrationPage() {
  const [testState, setTestState] = useState<{
    action: string | null
    loading: boolean
    success: string | null
    error: string | null
    detail: string | null
  }>({ action: null, loading: false, success: null, error: null, detail: null })

  async function testService(endpoint: string, body?: Record<string, unknown>) {
    setTestState({ action: endpoint, loading: true, success: null, error: null, detail: null })
    try {
      const { data, error } = await supabase.functions.invoke(endpoint, {
        method: body ? 'POST' : 'POST',
        body: body ?? {},
      })
      if (error) {
        setTestState(prev => ({
          ...prev,
          loading: false,
          error: 'Could not reach the Meta service. Check Supabase Edge Function deployment.',
          detail: error.message,
        }))
        return
      }
      const ok = data?.ok !== false
      setTestState(prev => ({
        ...prev,
        loading: false,
        success: ok
          ? endpoint === 'meta-oauth-start'
            ? 'Meta connection service is reachable. Real OAuth will be added next.'
            : 'Meta sync service is reachable. Real sync logic will be added next.'
          : `Unexpected response from ${endpoint}.`,
        detail: ok ? JSON.stringify(data, null, 2) : JSON.stringify(data, null, 2),
      }))
    } catch (err) {
      setTestState(prev => ({
        ...prev,
        loading: false,
        error: 'Could not reach the Meta service. Check Supabase Edge Function deployment.',
        detail: err instanceof Error ? err.message : String(err),
      }))
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
              <span className="shrink-0 text-xs font-medium text-amber-400">
                Not connected
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-brand-primary">
              Authorise CG Dynamics to access your Facebook Business assets.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-lg border border-brand-muted bg-brand-muted/20 px-5 py-2.5 text-sm font-semibold text-brand-primary"
              >
                Connect Meta
              </button>
              <button
                type="button"
                onClick={() => testService('meta-oauth-start')}
                disabled={testState.loading}
                className="rounded-lg border border-brand-muted px-5 py-2.5 text-sm font-semibold text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testState.action === 'meta-oauth-start' && testState.loading
                  ? 'Testing…'
                  : 'Test Meta connection service'}
              </button>
            </div>
            <p className="mt-3 text-xs text-brand-primary/50">
              OAuth connection will be added in the next phase.
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
                Waiting for Meta connection
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
                className="rounded-lg border border-brand-muted px-5 py-2.5 text-sm font-semibold text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testState.action === 'meta-sync' && testState.loading
                  ? 'Testing…'
                  : 'Test sync service'}
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
      {testState.success && (
        <div className="mt-6 max-w-2xl rounded-xl border border-brand-accent/20 bg-brand-accent/10 p-5">
          <p className="text-sm font-medium text-brand-accent">{testState.success}</p>
          {testState.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-brand-accent/60 hover:text-brand-accent">
                Response detail
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-bg/50 p-3 text-xs text-brand-primary">
                {testState.detail}
              </pre>
            </details>
          )}
        </div>
      )}

      {testState.error && (
        <div className="mt-6 max-w-2xl rounded-xl border border-red-400/20 bg-red-400/10 p-5">
          <p className="text-sm font-medium text-red-400">{testState.error}</p>
          {testState.detail && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-400/60 hover:text-red-400">
                Error detail
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-brand-bg/50 p-3 text-xs text-red-300/70">
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
