import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { StatusBadge, Pill } from '../../components/ui/Badges'
import { LoadingState } from '../../components/ui/States'
import { listClients, type Client } from '../../lib/db/clients'
import {
  startTiktokOAuth,
  getTiktokConnectionStatus,
  syncTiktokAnalytics,
  TIKTOK_METRICS,
  type TiktokConnectionStatus,
  type TiktokSyncResult,
} from '../../lib/tiktok'

const INPUT_CLASS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()
}

export default function TikTokIntegrationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const oauthResult = searchParams.get('tiktok')
  const [clients, setClients] = useState<Client[]>([])
  const [status, setStatus] = useState<TiktokConnectionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(() => {
    if (oauthResult === 'permissions_missing') return 'Some TikTok permissions were not granted. Reconnect to grant all required scopes.'
    if (oauthResult === 'error') return 'TikTok connection failed. Please try again.'
    if (oauthResult === 'config_error') return 'TikTok is not configured. Ask an admin to set Edge Function secrets.'
    return null
  })
  const [notice, setNotice] = useState<string | null>(() => oauthResult === 'connected' ? 'TikTok connected successfully.' : null)
  const [syncMonth, setSyncMonth] = useState(currentMonth())
  const [syncClientId, setSyncClientId] = useState('')
  const [syncResult, setSyncResult] = useState<TiktokSyncResult | null>(null)

  // Handle OAuth callback params — reload status for the selected client
  useEffect(() => {
    const tiktokParam = searchParams.get('tiktok')
    if (tiktokParam) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('tiktok')
      setSearchParams(nextParams, { replace: true })
      // Reload connection status after OAuth completes
      if (syncClientId) {
        getTiktokConnectionStatus(syncClientId).then(setStatus)
      }
    }
  }, [searchParams, setSearchParams, syncClientId])

  async function load(silent = false) {
    try {
      const [clientResult, connectionStatus] = await Promise.all([
        listClients('all'),
        getTiktokConnectionStatus(syncClientId || undefined),
      ])
      if (clientResult.error) throw new Error(clientResult.error.message)
      setClients(clientResult.data.filter(c => c.active))
      setStatus(connectionStatus)
    } catch (loadError) {
      setError(messageFrom(loadError, 'Could not load TikTok integration.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  // Load clients on mount; connection status loads per-client below
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const clientResult = await listClients('all')
        if (clientResult.error) throw new Error(clientResult.error.message)
        if (active) setClients(clientResult.data.filter(c => c.active))
      } catch (loadError) {
        if (active) setError(messageFrom(loadError, 'Could not load TikTok integration.'))
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  // Load connection status whenever the selected client changes
  useEffect(() => {
    if (!syncClientId) return
    let active = true
    getTiktokConnectionStatus(syncClientId).then(s => { if (active) setStatus(s) })
    return () => { active = false }
  }, [syncClientId])

  async function runAction(key: string, task: () => Promise<string | void>) {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      const message = await task()
      if (message) setNotice(message)
    } catch (actionError) {
      setError(messageFrom(actionError, 'TikTok request failed.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleConnect() {
    if (!syncClientId) {
      setError('Select a client first — TikTok connections are bound to a specific client.')
      return
    }
    await runAction('connect', async () => {
      const result = await startTiktokOAuth(syncClientId)
      if (!result.ok) throw new Error(result.error ?? 'Could not start TikTok OAuth.')
      if (result.url) window.location.href = result.url
      return undefined
    })
  }

  function runSync() {
    if (!syncClientId) {
      setError('Select a client before syncing.')
      return
    }
    void runAction('sync', async () => {
      const result = await syncTiktokAnalytics(syncClientId, syncMonth)
      setSyncResult(result)
      await load(true)
      if (!result.ok) {
        return `Sync failed. ${(result.errors ?? []).join('; ') || result.error || ''}`
      }
      const healthNote = result.health === 'partial' ? ' (partial — see notes)' : ''
      return `TikTok sync completed${healthNote}. ${result.videosSynced} video${result.videosSynced === 1 ? '' : 's'} synced for ${result.periodMonth}.`
    })
  }

  if (loading) return <LoadingState message="Loading TikTok integration..." className="min-h-[55vh]" />

  const connected = status?.connected ?? false
  const statusLabel = !status ? 'Checking...' : connected ? 'Connected' : 'Not connected'
  const statusVariant = connected ? 'published' : 'internal-draft'

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-accent">Integrations</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">TikTok connection</h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-primary">
            Connect an exact TikTok account for read-only organic analytics through TikTok&apos;s official Login Kit and Display API.
          </p>
        </div>
        <ActionButton variant="ghost" onClick={() => navigate('/admin/integrations')}>Back to integrations</ActionButton>
      </div>

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}

      <div className="mt-6 space-y-6">
        {/* Connection card */}
        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Connection"
            title="TikTok account"
            subtitle={connected && status?.connection
              ? `Connected as ${status.connection.displayName ?? 'TikTok user'}. Token ${status.connection.tokenExpired ? 'needs refresh' : 'valid'}.`
              : 'Connect a TikTok account to enable read-only analytics sync.'}
            action={
              <div className="flex items-center gap-3">
                <StatusBadge label={statusLabel} variant={statusVariant} size="sm" />
                {connected
                  ? <ActionButton variant="outline" loading={busy === 'refresh'} onClick={() => void runAction('refresh', async () => { await load(true); return 'Refreshed.' })}>Refresh</ActionButton>
                  : <ActionButton loading={busy === 'connect'} onClick={handleConnect}>Connect TikTok</ActionButton>
                }
              </div>
            }
          />

          {connected && status?.connection && (
            <div className="mt-4 rounded-lg border border-white/8 bg-black/20 p-4">
              <div className="flex items-center gap-4">
                {status.connection.avatarUrl && (
                  <img src={status.connection.avatarUrl} alt="" className="h-12 w-12 rounded-full" />
                )}
                <div>
                  <p className="font-semibold text-white">{status.connection.displayName ?? 'TikTok user'}</p>
                  <p className="text-xs text-brand-primary">
                    Last connected: {formatDateTime(status.connection.lastConnectedAt)}
                    {status.connection.tokenExpiresAt && <> · Token expires: {formatDateTime(status.connection.tokenExpiresAt)}</>}
                  </p>
                </div>
              </div>
              {status.connection.grantedScopes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {status.connection.grantedScopes.map(scope => (
                    <Pill key={scope} tone="neutral">{scope}</Pill>
                  ))}
                </div>
              )}
            </div>
          )}

          {!connected && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-white/8 bg-black/20 p-4">
                <h3 className="text-sm font-semibold text-white">Prerequisites</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-brand-primary">
                  <li>Register an app on TikTok for Developers and authorize the exact account as a sandbox target user.</li>
                  <li>Enable Login Kit and configure a redirect URI for your Supabase Edge Function callback.</li>
                  <li>Read-only rollout requests user.info.basic, user.info.profile, user.info.stats, and video.list.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
                Publishing is unavailable in this rollout. CG Dynamics does not request video.publish or send content to TikTok.
              </div>
            </div>
          )}
        </PremiumCard>

        {/* Analytics sync */}
        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Analytics"
            title="Sync TikTok metrics"
            subtitle="Fetch cumulative video metrics and profile snapshots from TikTok's Display API. Video metrics are snapshots at sync time — not period totals."
          />
          <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
            <Field label="Month">
              <input
                className={INPUT_CLASS}
                type="month"
                max={currentMonth()}
                value={syncMonth}
                onChange={event => setSyncMonth(event.target.value)}
              />
            </Field>
            <Field label="Client">
              <select
                className={INPUT_CLASS}
                value={syncClientId}
                onChange={event => {
                  setStatus(null)
                  setSyncClientId(event.target.value)
                }}
              >
                <option value="">Select a client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </Field>
            <ActionButton
              loading={busy === 'sync'}
              disabled={!connected || !syncClientId}
              onClick={runSync}
            >
              Run sync
            </ActionButton>
          </div>

          {syncResult && syncResult.ok && (
            <div className="mt-5 rounded-lg border border-white/8 bg-black/20 p-4" aria-live="polite">
              <h4 className="text-sm font-semibold text-white">Sync results — {syncResult.periodMonth}</h4>
              {syncResult.health === 'partial' && (
                <p className="mt-1 text-xs text-amber-300">
                  Partial sync — some data may be incomplete. {syncResult.paginationComplete ? '' : 'Video list was truncated.'}
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <MetricCard label="Videos" value={syncResult.videosSynced} />
                <MetricCard label="Views (cumulative)" value={syncResult.metrics.views} />
                <MetricCard label="Likes (cumulative)" value={syncResult.metrics.likes} />
                <MetricCard label="Comments (cumulative)" value={syncResult.metrics.comments} />
                <MetricCard label="Shares (cumulative)" value={syncResult.metrics.shares} />
              </div>
              {syncResult.metrics.followers !== null && (
                <p className="mt-3 text-xs text-brand-primary">
                  Followers at sync time: {syncResult.metrics.followers.toLocaleString()} (current snapshot, not period-specific)
                </p>
              )}
              <p className="mt-2 text-xs text-brand-primary">
                Note: Video metrics are cumulative snapshots at sync time, not period totals. Re-syncing later will produce different numbers as videos accumulate engagement.
              </p>
            </div>
          )}
        </PremiumCard>

        {/* Metric reference */}
        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Reference"
            title="TikTok-native metrics"
            subtitle="All metrics use TikTok's exact metric definitions and naming. No invented or relabeled metrics."
          />
          <div className="overflow-x-auto rounded-lg border border-white/8">
            <table className="min-w-[700px] w-full divide-y divide-white/8 text-left text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-wide text-brand-primary">
                <tr>
                  <th className="px-4 py-3">Metric</th>
                  <th className="px-4 py-3">Source field</th>
                  <th className="px-4 py-3">Aggregation</th>
                  <th className="px-4 py-3">Cross-platform</th>
                  <th className="px-4 py-3">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {TIKTOK_METRICS.map(metric => (
                  <tr key={metric.key}>
                    <td className="px-4 py-3 font-medium text-white">{metric.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-brand-primary">{metric.sourceMetric}</td>
                    <td className="px-4 py-3"><Pill tone="neutral">{metric.aggregation}</Pill></td>
                    <td className="px-4 py-3">{metric.crossPlatformAdditive ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-3 text-xs text-brand-primary">{metric.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>

        {/* Publishing rollout boundary */}
        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Publishing"
            title="Not enabled"
            subtitle="This connection is limited to read-only account and video analytics."
          />
          <div className="space-y-3 text-sm text-brand-primary">
            <p>
              The current TikTok for Developers sandbox does not include Content Posting API and CG Dynamics does not request video.publish or video.upload.
            </p>
            <div className="rounded-lg border border-white/8 bg-black/20 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white">Future publishing gate</h4>
              <ul className="mt-2 space-y-1 text-xs text-brand-primary">
                <li>Agency publishing requires a separately approved provider route that fits CG&apos;s managed-client use case.</li>
                <li>Media delivery must use a CG-controlled hostname or URL prefix accepted by that provider.</li>
                <li>Provider writes remain disabled until provider review and CA approval are complete.</li>
              </ul>
            </div>
          </div>
        </PremiumCard>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5">
      <p className="text-xs text-brand-primary">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-primary">{label}</span>
      {children}
    </label>
  )
}

function Message({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) {
  const styles = tone === 'error'
    ? 'border-red-400/25 bg-red-400/10 text-red-300'
    : tone === 'success'
    ? 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal'
    : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  )
}
