import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { StatusBadge, Pill } from '../../components/ui/Badges'
import { LoadingState } from '../../components/ui/States'
import {
  getTiktokConnectionQueue,
  getTiktokConnectionStatus,
  startTiktokOAuth,
  syncTiktokAnalytics,
  TIKTOK_METRICS,
  type TiktokConnectionQueue,
  type TiktokConnectionQueueItem,
  type TiktokConnectionStatus,
  type TiktokSyncResult,
} from '../../lib/tiktok'

const INPUT_CLASS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()
}

function messageFrom(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

const emptyQueue: TiktokConnectionQueue = {
  ok: true,
  items: [],
  summary: { activeClients: 0, eligible: 0, excluded: 0, unresolved: 0, connected: 0, reconnectRequired: 0, notConnected: 0 },
}

const callbackMessages: Record<string, { tone: 'error' | 'success' | 'warning'; message: string }> = {
  connected: { tone: 'success', message: 'TikTok connected and verified for the selected client.' },
  permissions_missing: { tone: 'warning', message: 'TikTok connected, but required read permissions were not granted. Reconnect and grant every requested permission.' },
  account_conflict: { tone: 'error', message: 'That TikTok account is already mapped to another CG client. The mapping was not changed.' },
  identity_error: { tone: 'error', message: 'TikTok returned an identity that could not be verified. The mapping was not changed.' },
  ineligible: { tone: 'error', message: 'The client or staff account is no longer eligible for this connection.' },
  config_error: { tone: 'error', message: 'TikTok is not configured. Ask an admin to check the approved provider configuration.' },
  error: { tone: 'error', message: 'TikTok connection failed without changing the selected client mapping. Please try again.' },
}

export default function TikTokIntegrationPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const callbackResult = searchParams.get('tiktok')
  const callbackClientId = searchParams.get('client') ?? ''
  const [queue, setQueue] = useState<TiktokConnectionQueue>(emptyQueue)
  const [selectedClientId, setSelectedClientId] = useState(callbackClientId)
  const [statusState, setStatusState] = useState<{ clientId: string; value: TiktokConnectionStatus } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState(callbackResult ? callbackMessages[callbackResult] ?? callbackMessages.error : null)
  const [syncMonth, setSyncMonth] = useState(currentMonth())
  const [syncResult, setSyncResult] = useState<TiktokSyncResult | null>(null)
  const [search, setSearch] = useState('')

  async function loadQueue(silent = false) {
    try {
      const result = await getTiktokConnectionQueue()
      if (!result.ok) throw new Error(result.error ?? 'Could not load the TikTok connection queue.')
      setQueue(result)
      setSelectedClientId(current => {
        if (current && result.items.some(item => item.clientId === current)) return current
        return result.items.find(item => item.state === 'reconnect_required')?.clientId
          ?? result.items.find(item => item.state === 'not_connected')?.clientId
          ?? result.items[0]?.clientId
          ?? ''
      })
    } catch (error) {
      setMessage({ tone: 'error', message: messageFrom(error, 'Could not load the TikTok connection queue.') })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let current = true
    getTiktokConnectionQueue().then(result => {
      if (!current) return
      if (!result.ok) {
        setMessage({ tone: 'error', message: result.error ?? 'Could not load the TikTok connection queue.' })
        setLoading(false)
        return
      }
      setQueue(result)
      setSelectedClientId(selected => selected && result.items.some(item => item.clientId === selected)
        ? selected
        : result.items.find(item => item.state === 'reconnect_required')?.clientId
          ?? result.items.find(item => item.state === 'not_connected')?.clientId
          ?? result.items[0]?.clientId
          ?? '')
      setLoading(false)
    })
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!callbackResult) return
    const next = new URLSearchParams(searchParams)
    next.delete('tiktok')
    next.delete('client')
    setSearchParams(next, { replace: true })
  }, [callbackResult, searchParams, setSearchParams])

  useEffect(() => {
    if (!selectedClientId) return
    let current = true
    getTiktokConnectionStatus(selectedClientId).then(result => {
      if (current) setStatusState({ clientId: selectedClientId, value: result })
    })
    return () => { current = false }
  }, [selectedClientId, queue])

  const selected = queue.items.find(item => item.clientId === selectedClientId) ?? null
  const status = statusState?.clientId === selectedClientId ? statusState.value : null
  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    return term ? queue.items.filter(item => item.clientName.toLocaleLowerCase().includes(term) || item.account?.displayName?.toLocaleLowerCase().includes(term)) : queue.items
  }, [queue.items, search])

  async function runAction(key: string, task: () => Promise<string | void>) {
    setBusy(key)
    setMessage(null)
    try {
      const result = await task()
      if (result) setMessage({ tone: 'success', message: result })
    } catch (error) {
      setMessage({ tone: 'error', message: messageFrom(error, 'TikTok request failed.') })
    } finally {
      setBusy(null)
    }
  }

  async function connect(item: TiktokConnectionQueueItem) {
    setSelectedClientId(item.clientId)
    await runAction(`connect:${item.clientId}`, async () => {
      const result = await startTiktokOAuth(item.clientId)
      if (!result.ok || !result.url) throw new Error(result.error ?? 'Could not start TikTok OAuth.')
      window.location.assign(result.url)
    })
  }

  function nextClient() {
    const unresolved = queue.items.filter(item => item.state === 'reconnect_required' || item.state === 'not_connected')
    const currentIndex = unresolved.findIndex(item => item.clientId === selectedClientId)
    const next = unresolved[currentIndex >= 0 ? (currentIndex + 1) % unresolved.length : 0]
    if (next) setSelectedClientId(next.clientId)
  }

  function runSync() {
    if (!selectedClientId) return
    void runAction('sync', async () => {
      const result = await syncTiktokAnalytics(selectedClientId, syncMonth)
      setSyncResult(result)
      await loadQueue(true)
      if (!result.ok) throw new Error((result.errors ?? []).join('; ') || result.error || 'TikTok sync failed.')
      const count = result.videosSynced === null ? 'an unavailable number of' : result.videosSynced
      return `TikTok sync completed${result.health === 'partial' ? ' with partial data' : ''}: ${count} video${result.videosSynced === 1 ? '' : 's'} for ${result.periodMonth}.`
    })
  }

  if (loading) return <LoadingState message="Loading active-client TikTok queue..." className="min-h-[55vh]" />

  const reconnect = selected?.state === 'reconnect_required'
  const connectable = selected?.state === 'not_connected' || reconnect
  const connected = selected?.state === 'connected' || selected?.state === 'refresh_pending'

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-accent">TikTok fleet</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Connection queue</h1>
          <p className="mt-2 max-w-3xl text-sm text-brand-primary">Connect each client with confirmed recurring social scope to its exact TikTok account through TikTok&apos;s provider-owned OAuth screen. One consent keeps daily read-only analytics fresh automatically.</p>
        </div>
        <div className="flex gap-2"><ActionButton variant="outline" onClick={nextClient} disabled={queue.summary.reconnectRequired + queue.summary.notConnected === 0}>Next client</ActionButton><ActionButton variant="ghost" onClick={() => navigate('/admin/integrations')}>Back</ActionButton></div>
      </div>

      {message && <Message tone={message.tone}>{message.message}</Message>}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Summary label="Eligible" value={queue.summary.eligible} />
        <Summary label="Excluded" value={queue.summary.excluded} />
        <Summary label="Held" value={queue.summary.unresolved} tone="amber" />
        <Summary label="Connected" value={queue.summary.connected} tone="teal" />
        <Summary label="Reconnect" value={queue.summary.reconnectRequired} tone="amber" />
        <Summary label="Not connected" value={queue.summary.notConnected} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
        <PremiumCard className="lg:sticky lg:top-6 lg:self-start">
          <PremiumCardHeader eyebrow="Confirmed social scope only" title="Work the queue" subtitle={`${queue.summary.activeClients} active clients assessed. Existing mappings are unchanged; unresolved package scope is held.`} />
          <input className={INPUT_CLASS} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search client or verified account" aria-label="Search TikTok connection queue" />
          <div className="mt-4 max-h-[660px] space-y-2 overflow-y-auto pr-1">
            {filteredItems.map(item => (
              <button key={item.clientId} type="button" onClick={() => setSelectedClientId(item.clientId)} className={`w-full rounded-xl border p-3 text-left transition ${item.clientId === selectedClientId ? 'border-brand-accent/50 bg-brand-accent/10' : 'border-white/8 bg-black/20 hover:border-white/20'}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{item.clientName}</p><p className="mt-1 truncate text-xs text-white/45">{item.account?.displayName ?? 'No provider account verified'}</p></div><QueueState state={item.state} /></div>
              </button>
            ))}
          </div>
        </PremiumCard>

        <div className="space-y-6">
          <PremiumCard>
            <PremiumCardHeader eyebrow="Exact client + exact account" title={selected?.clientName ?? 'Select an active client'} subtitle={selected?.diagnostic ?? 'Choose a client from the connection queue.'} action={selected && connectable ? <ActionButton loading={busy === `connect:${selected.clientId}`} onClick={() => void connect(selected)}>{reconnect ? 'Reconnect with TikTok' : 'Connect with TikTok'}</ActionButton> : undefined} />
            {selected && (
              <div className="mt-4 rounded-xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center gap-4">{selected.account?.avatarUrl ? <img src={selected.account.avatarUrl} alt="" className="h-12 w-12 rounded-full" /> : <div className="grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/5 text-sm font-bold text-white/50">TT</div>}<div className="min-w-0"><p className="truncate font-semibold text-white">{selected.account?.displayName ?? 'Account awaiting provider verification'}</p><p className="mt-1 text-xs text-brand-primary">Last connected: {formatDateTime(selected.account?.lastConnectedAt)}</p></div></div>
                <div className="mt-4 border-t border-white/8 pt-4 text-xs text-brand-primary">CG Dynamics never asks for or stores a TikTok password. Authentication and consent happen on TikTok; Dynamics stores the resulting server-side OAuth token for automatic read-only freshness.</div>
              </div>
            )}
            {status?.health && <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><HealthDimension label="Access" value={status.health.access} /><HealthDimension label="Coverage" value={status.health.coverage} /><HealthDimension label="Completeness" value={status.health.completeness} /><HealthDimension label="Freshness" value={status.health.freshness} /></div>}
            {selected?.state === 'refresh_pending' && <Message tone="warning">The access token is expired, but a refresh token is present. The existing daily worker will attempt recovery; reconnect only if that recovery fails.</Message>}
          </PremiumCard>

          <PremiumCard>
            <PremiumCardHeader eyebrow="Automatic freshness" title="Read-only analytics" subtitle="Daily refresh is the normal path. Manual sync is available for a deliberate staff retry and preserves TikTok-native metric semantics." />
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"><Field label="Month"><input className={INPUT_CLASS} type="month" max={currentMonth()} value={syncMonth} onChange={event => setSyncMonth(event.target.value)} /></Field><ActionButton loading={busy === 'sync'} disabled={!connected || !selectedClientId} onClick={runSync}>Run manual sync</ActionButton></div>
            {syncResult?.ok && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"><Metric label="Videos" value={syncResult.videosSynced} /><Metric label="Views" value={syncResult.metrics.views} /><Metric label="Likes" value={syncResult.metrics.likes} /><Metric label="Comments" value={syncResult.metrics.comments} /><Metric label="Shares" value={syncResult.metrics.shares} /></div>}
          </PremiumCard>

          <PremiumCard>
            <PremiumCardHeader eyebrow="Reporting contract" title="TikTok-native metrics" subtitle="Missing provider data stays unavailable and is never converted to a false zero." />
            <div className="overflow-x-auto rounded-lg border border-white/8"><table className="min-w-[680px] w-full divide-y divide-white/8 text-left text-sm"><thead className="bg-black/30 text-xs uppercase tracking-wide text-brand-primary"><tr><th className="px-4 py-3">Metric</th><th className="px-4 py-3">Provider field</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Meaning</th></tr></thead><tbody className="divide-y divide-white/8">{TIKTOK_METRICS.map(metric => <tr key={metric.key}><td className="px-4 py-3 font-medium text-white">{metric.label}</td><td className="px-4 py-3 font-mono text-xs text-brand-primary">{metric.sourceMetric}</td><td className="px-4 py-3"><Pill tone="neutral">{metric.aggregation}</Pill></td><td className="px-4 py-3 text-xs text-brand-primary">{metric.meaning}</td></tr>)}</tbody></table></div>
            <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">Publishing is unavailable in this rollout. CG Dynamics does not request video.publish or video.upload.</div>
          </PremiumCard>
        </div>
      </div>
    </div>
  )
}

function Summary({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'teal' | 'amber' }) { const color = tone === 'teal' ? 'text-brand-teal' : tone === 'amber' ? 'text-amber-300' : 'text-white'; return <div className="rounded-xl border border-white/8 bg-black/20 p-4"><p className="text-xs uppercase tracking-wide text-white/45">{label}</p><p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p></div> }
function QueueState({ state }: { state: TiktokConnectionQueueItem['state'] }) { const map = { connected: ['Connected', 'published'], refresh_pending: ['Refresh pending', 'internal-draft'], reconnect_required: ['Reconnect', 'internal-draft'], not_connected: ['Not connected', 'internal-draft'] } as const; return <StatusBadge label={map[state][0]} variant={map[state][1]} size="sm" /> }
function HealthDimension({ label, value }: { label: string; value: string }) { const healthy = value === 'connected' || value === 'complete' || value === 'fresh'; return <div className="rounded-lg border border-white/8 bg-black/20 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">{label}</p><p className={healthy ? 'mt-1 text-sm font-semibold text-brand-teal' : 'mt-1 text-sm font-semibold text-amber-300'}>{value.replaceAll('_', ' ')}</p></div> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-primary">{label}</span>{children}</label> }
function Metric({ label, value }: { label: string; value: number | null }) { return <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2.5"><p className="text-xs text-brand-primary">{label}</p><p className="mt-0.5 text-lg font-semibold text-white">{value === null ? 'Unavailable' : value.toLocaleString()}</p></div> }
function Message({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: ReactNode }) { const styles = tone === 'error' ? 'border-red-400/25 bg-red-400/10 text-red-300' : tone === 'success' ? 'border-brand-teal/25 bg-brand-teal/10 text-brand-teal' : 'border-amber-400/25 bg-amber-400/10 text-amber-300'; return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div> }
