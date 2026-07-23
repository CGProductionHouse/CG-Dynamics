import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill, StatusBadge } from '../../components/ui/Badges'
import { EmptyState, LoadingState } from '../../components/ui/States'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { listClients, type Client } from '../../lib/db/clients'
import {
  calculateGoogleAdsReport,
  deactivateGoogleAdsLink,
  formatGoogleAdsCurrencyValue,
  formatGoogleAdsMoney,
  getGoogleAdsWorkspace,
  linkGoogleAdsAccount,
  monthDateRange,
  queryGoogleAdsReport,
  refreshGoogleAdsAccounts,
  syncGoogleAds,
  testGoogleAdsConnection,
  type GoogleAdsConnectionStatus,
  type GoogleAdsSyncResult,
  type GoogleAdsWorkspace,
} from '../../lib/googleAds'

const INPUT_CLASS = 'w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-accent/60 disabled:cursor-not-allowed disabled:opacity-60'

type BusyAction = 'test' | 'refresh' | 'link' | 'sync' | string | null
type ReportState = 'idle' | 'loading' | 'not-connected' | 'no-data' | 'data' | 'error'

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

function decimal(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

export default function GoogleAdsIntegrationPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [workspace, setWorkspace] = useState<GoogleAdsWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [mappingClientId, setMappingClientId] = useState('')
  const [mappingCustomerId, setMappingCustomerId] = useState('')

  const [syncRange, setSyncRange] = useState<'month' | 'custom'>('month')
  const [syncMonth, setSyncMonth] = useState(currentMonth())
  const initialRange = monthDateRange(currentMonth())
  const [syncStartDate, setSyncStartDate] = useState(initialRange.startDate)
  const [syncEndDate, setSyncEndDate] = useState(initialRange.endDate)
  const [syncClientId, setSyncClientId] = useState('all')
  const [syncResult, setSyncResult] = useState<GoogleAdsSyncResult | null>(null)

  const [reportClientId, setReportClientId] = useState('')
  const [reportMonth, setReportMonth] = useState(currentMonth())
  const [reportState, setReportState] = useState<ReportState>('idle')
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportRows, setReportRows] = useState<Awaited<ReturnType<typeof queryGoogleAdsReport>>>([])
  const reportRequestRef = useRef(0)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [clientResult, googleWorkspace] = await Promise.all([
        listClients('active'),
        getGoogleAdsWorkspace(),
      ])
      if (clientResult.error) throw new Error(clientResult.error.message)
      setClients(clientResult.data)
      setWorkspace(googleWorkspace)
      setMappingClientId(value => value || clientResult.data[0]?.id || '')
      setReportClientId(value => value || clientResult.data[0]?.id || '')
    } catch (loadError) {
      setError(messageFrom(loadError, 'Could not load Google Ads setup.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listClients('active'), getGoogleAdsWorkspace()])
      .then(([clientResult, googleWorkspace]) => {
        if (!active) return
        if (clientResult.error) throw new Error(clientResult.error.message)
        setClients(clientResult.data)
        setWorkspace(googleWorkspace)
        setMappingClientId(clientResult.data[0]?.id || '')
        setReportClientId(clientResult.data[0]?.id || '')
      })
      .catch(loadError => {
        if (active) setError(messageFrom(loadError, 'Could not load Google Ads setup.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const status: GoogleAdsConnectionStatus = workspace?.status ?? {
    configured: false,
    connected: false,
    message: null,
    lastCheckedAt: null,
  }
  const activeLinks = workspace?.links.filter(link => link.active) ?? []
  const linkedCustomerIds = new Set(activeLinks.map(link => link.customerId))
  const availableAccounts = workspace?.accounts.filter(account => !linkedCustomerIds.has(account.customerId)) ?? []
  const linkedClientIds = new Set(activeLinks.map(link => link.clientId))
  const clientName = new Map(clients.map(client => [client.id, client.name]))
  const report = calculateGoogleAdsReport(reportRows)
  const today = new Date().toISOString().slice(0, 10)

  async function runAction(action: Exclude<BusyAction, string> | string, task: () => Promise<void>) {
    setBusy(action)
    setError(null)
    setNotice(null)
    try {
      await task()
    } catch (actionError) {
      setError(messageFrom(actionError, 'Google Ads request failed.'))
    } finally {
      setBusy(null)
    }
  }

  function handleTest() {
    void runAction('test', async () => {
      const nextStatus = await testGoogleAdsConnection()
      setWorkspace(current => current ? { ...current, status: nextStatus } : { status: nextStatus, accounts: [], links: [] })
      setNotice(nextStatus.connected ? 'Google Ads connection test passed.' : nextStatus.message || 'Google Ads is not connected.')
    })
  }

  function handleRefresh() {
    void runAction('refresh', async () => {
      const nextWorkspace = await refreshGoogleAdsAccounts()
      setWorkspace(nextWorkspace)
      setMappingCustomerId('')
      setNotice(`Account discovery refreshed. ${nextWorkspace.accounts.length} non-manager account${nextWorkspace.accounts.length === 1 ? '' : 's'} available.`)
    })
  }

  function handleLink() {
    void runAction('link', async () => {
      await linkGoogleAdsAccount({ clientId: mappingClientId, customerId: mappingCustomerId })
      await load(true)
      setMappingCustomerId('')
      setNotice('Google Ads account linked to the selected client.')
    })
  }

  function handleDeactivate(linkId: string, label: string) {
    if (!window.confirm(`Deactivate the Google Ads link for ${label}? Existing synced reporting data will not be deleted.`)) return
    void runAction(`deactivate:${linkId}`, async () => {
      await deactivateGoogleAdsLink(linkId)
      await load(true)
      setNotice('Google Ads client link deactivated.')
      if (reportState !== 'idle') {
        reportRequestRef.current += 1
        setReportState('idle')
      }
    })
  }

  function handleSync() {
    void runAction('sync', async () => {
      const selectedRange = syncRange === 'month'
        ? monthDateRange(syncMonth)
        : { startDate: syncStartDate, endDate: syncEndDate }
      const range = syncRange === 'month' && selectedRange.endDate > today
        ? { ...selectedRange, endDate: today }
        : selectedRange
      const batches = syncClientId === 'all'
        ? Array.from({ length: Math.ceil(activeLinks.length / 10) }, (_, index) => activeLinks.slice(index * 10, index * 10 + 10).map(link => link.id))
        : []
      const batchResults = syncClientId === 'all'
        ? await Promise.all(batches.map(mappingIds => syncGoogleAds({ ...range, mappingIds })))
        : [await syncGoogleAds({ ...range, clientId: syncClientId })]
      const result: GoogleAdsSyncResult = {
        ok: batchResults.every(item => item.ok),
        results: batchResults.flatMap(item => item.results),
      }
      setSyncResult(result)
      setNotice(result.ok ? 'Google Ads sync completed.' : 'Google Ads sync completed with errors. Review the results below.')
      await load(true)
    })
  }

  async function handleReport() {
    const requestId = ++reportRequestRef.current
    const requestedClientId = reportClientId
    const requestedMonth = reportMonth
    setReportError(null)
    setReportRows([])
    if (!linkedClientIds.has(requestedClientId)) {
      setReportState('not-connected')
      return
    }
    setReportState('loading')
    try {
      const rows = await queryGoogleAdsReport(requestedClientId, requestedMonth)
      if (requestId !== reportRequestRef.current) return
      setReportRows(rows)
      setReportState(rows.length > 0 ? 'data' : 'no-data')
    } catch (queryError) {
      if (requestId !== reportRequestRef.current) return
      setReportError(messageFrom(queryError, 'Could not load Google Ads reporting.'))
      setReportState('error')
    }
  }

  if (loading) {
    return <LoadingState message="Loading Google Ads integration..." className="min-h-[55vh]" />
  }

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-accent">Integrations</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Google Ads reporting</h1>
          <p className="mt-1 max-w-3xl text-sm text-brand-primary">
            Link Google Ads accounts explicitly, sync campaign metrics, and review internal monthly performance. Credentials remain server-side.
          </p>
        </div>
        <ActionButton variant="ghost" onClick={() => navigate('/admin/integrations')}>Back to integrations</ActionButton>
      </div>

      {error && <Message tone="error">{error}</Message>}
      {notice && <Message tone="success">{notice}</Message>}

      <div className="mt-6 space-y-6">
        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Connection"
            title="Safe connection status"
            subtitle="Connection checks return status only. No developer token, OAuth credential, or refresh token is sent to this page."
            action={<StatusBadge label={status.connected ? 'Connected' : status.configured ? 'Check failed' : 'Not configured'} variant={status.connected ? 'published' : 'needs-repair'} size="md" />}
          />
          <div className="grid gap-4 rounded-lg border border-white/8 bg-black/20 p-4 sm:grid-cols-3">
            <Detail label="Server configuration" value={status.configured ? 'Available' : 'Missing'} />
            <Detail label="API connection" value={status.connected ? 'Responding' : 'Unavailable'} />
            <Detail label="Last checked" value={formatDateTime(status.lastCheckedAt)} />
          </div>
          {status.message && <p className="mt-3 text-sm text-brand-primary">{status.message}</p>}
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton variant="secondary" loading={busy === 'test'} onClick={handleTest}>Test connection</ActionButton>
            <ActionButton variant="outline" loading={busy === 'refresh'} disabled={!status.connected} onClick={handleRefresh}>Refresh accounts</ActionButton>
          </div>
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader
            eyebrow="Client mapping"
            title="Link a non-manager account"
            subtitle="A link is only saved after you select both an active CG Dynamics client and a discovered Google Ads account."
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <Field label="Active client">
              <select className={INPUT_CLASS} value={mappingClientId} onChange={event => setMappingClientId(event.target.value)}>
                <option value="">Select a client</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </Field>
            <Field label="Discovered Google Ads account">
              <select className={INPUT_CLASS} value={mappingCustomerId} onChange={event => setMappingCustomerId(event.target.value)}>
                <option value="">Select a non-manager account</option>
                {availableAccounts.map(account => (
                  <option key={account.customerId} value={account.customerId}>{account.name} · {account.customerId} · {account.currencyCode}</option>
                ))}
              </select>
            </Field>
            <ActionButton loading={busy === 'link'} disabled={!mappingClientId || !mappingCustomerId || !status.connected} onClick={handleLink}>Save link</ActionButton>
          </div>
          {availableAccounts.length === 0 && (
            <p className="mt-4 rounded-lg border border-white/8 bg-black/20 px-4 py-3 text-sm text-brand-primary">
              No unlinked non-manager accounts are available. Refresh discovery after the server connection is configured, or deactivate an existing link.
            </p>
          )}

          <h3 className="mt-7 text-sm font-semibold text-white">Existing active links</h3>
          {activeLinks.length === 0 ? (
            <EmptyState className="mt-3" title="No clients linked" message="Choose an active client and discovered account above. Google Ads account IDs are never matched to clients automatically." />
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-white/8">
              <table className="min-w-full divide-y divide-white/8 text-left text-sm">
                <thead className="bg-black/20 text-xs uppercase tracking-wide text-brand-primary">
                  <tr><th className="px-4 py-3">Client</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Currency</th><th className="px-4 py-3">Last sync</th><th className="px-4 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {activeLinks.map(link => (
                    <tr key={link.id}>
                      <td className="px-4 py-3 font-medium text-white">{clientName.get(link.clientId) ?? 'Unknown client'}</td>
                      <td className="px-4 py-3 text-brand-primary"><span className="text-white">{link.accountName}</span><br /><span className="text-xs">{link.customerId}</span></td>
                      <td className="px-4 py-3"><Pill tone="neutral">{link.currencyCode}</Pill></td>
                      <td className="px-4 py-3 text-brand-primary">{formatDateTime(link.lastSyncedAt)}</td>
                      <td className="px-4 py-3 text-right"><ActionButton size="sm" variant="danger" loading={busy === `deactivate:${link.id}`} onClick={() => handleDeactivate(link.id, clientName.get(link.clientId) ?? link.accountName)}>Deactivate</ActionButton></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader eyebrow="Sync" title="Import campaign metrics" subtitle="Sync every linked client or one selected client for a calendar month or explicit custom date range." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Date range">
              <select className={INPUT_CLASS} value={syncRange} onChange={event => setSyncRange(event.target.value as 'month' | 'custom')}>
                <option value="month">Calendar month</option><option value="custom">Custom dates</option>
              </select>
            </Field>
            {syncRange === 'month' ? (
              <Field label="Month"><input type="month" max={currentMonth()} className={INPUT_CLASS} value={syncMonth} onChange={event => setSyncMonth(event.target.value)} /></Field>
            ) : (
              <><Field label="Start date"><input type="date" max={today} className={INPUT_CLASS} value={syncStartDate} onChange={event => setSyncStartDate(event.target.value)} /></Field><Field label="End date"><input type="date" max={today} className={INPUT_CLASS} value={syncEndDate} onChange={event => setSyncEndDate(event.target.value)} /></Field></>
            )}
            <Field label="Clients">
              <select className={INPUT_CLASS} value={syncClientId} onChange={event => setSyncClientId(event.target.value)}>
                <option value="all">All linked clients</option>
                {clients.filter(client => linkedClientIds.has(client.id)).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-4"><ActionButton loading={busy === 'sync'} disabled={activeLinks.length === 0 || !status.connected} onClick={handleSync}>Run sync</ActionButton></div>
          {syncResult && (
            <div className="mt-5 space-y-2" aria-live="polite">
              <h3 className="text-sm font-semibold text-white">Sync results</h3>
              {syncResult.results.length === 0 ? (
                <p className="rounded-lg border border-white/8 bg-black/20 px-4 py-3 text-sm text-brand-primary">The sync finished without item-level results.</p>
              ) : syncResult.results.map((item, index) => (
                <div key={`${item.mappingId ?? item.clientId ?? item.customerId ?? 'result'}-${index}`} className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${item.ok ? 'border-brand-teal/20 bg-brand-teal/5' : 'border-red-400/20 bg-red-400/5'}`}>
                  <span className="text-white">{item.clientId ? clientName.get(item.clientId) ?? 'Linked client' : clientName.get(activeLinks.find(link => link.id === item.mappingId)?.clientId ?? '') ?? 'Google Ads account'}</span>
                  <span className={item.ok ? 'text-brand-primary' : 'text-red-300'}>{item.message} {item.ok ? `(${item.rowsWritten} rows)` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </PremiumCard>

        <PremiumCard>
          <PremiumCardHeader eyebrow="Internal reporting" title="Monthly Google Ads performance" subtitle="This operational view reports provider metrics as supplied. It does not calculate or imply ROAS." />
          <div className="grid gap-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <Field label="Client">
              <select className={INPUT_CLASS} value={reportClientId} onChange={event => { reportRequestRef.current += 1; setReportClientId(event.target.value); setReportState('idle') }}>
                <option value="">Select a client</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </Field>
            <Field label="Month"><input type="month" max={currentMonth()} className={INPUT_CLASS} value={reportMonth} onChange={event => { reportRequestRef.current += 1; setReportMonth(event.target.value); setReportState('idle') }} /></Field>
            <ActionButton loading={reportState === 'loading'} disabled={!reportClientId || !reportMonth} onClick={() => void handleReport()}>Load report</ActionButton>
          </div>

          <div className="mt-6">
            {reportState === 'idle' && <EmptyState title="Select a client and month" message="Load an internal Google Ads report from synced campaign metrics." />}
            {reportState === 'loading' && <LoadingState message="Loading synced Google Ads metrics..." />}
            {reportState === 'not-connected' && <EmptyState title="Client not connected" message="This active client has no Google Ads account link. Create an explicit client mapping above before syncing or reporting." />}
            {reportState === 'no-data' && <EmptyState title="No data for this month" message="The client is connected, but no synced Google Ads campaign metrics were found for the selected month. Run a sync for this date range." />}
            {reportState === 'error' && <EmptyState title="Reporting could not load" message={reportError ?? 'The report request failed. Try again.'} action={<ActionButton variant="secondary" onClick={() => void handleReport()}>Try again</ActionButton>} />}
            {reportState === 'data' && (
              <>
                {report.hasMixedCurrencies && <Message tone="warning">This client has data in multiple currencies. Monetary totals are intentionally not combined; campaign rows retain their account currency.</Message>}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Spend" value={formatGoogleAdsMoney(report.spendMicros, report.currencyCode)} />
                  <Metric label="Impressions" value={report.impressions.toLocaleString()} />
                  <Metric label="Clicks" value={report.clicks.toLocaleString()} />
                  <Metric label="CTR" value={report.ctr === null ? '—' : `${report.ctr.toFixed(2)}%`} />
                  <Metric label="Avg CPC" value={formatGoogleAdsMoney(report.averageCpcMicros, report.currencyCode)} />
                  <Metric label="Conversions" value={decimal(report.conversions)} />
                  <Metric label="Conversion value" value={formatGoogleAdsCurrencyValue(report.conversionValue, report.currencyCode)} />
                  <Metric label="Campaign count" value={report.campaignCount.toLocaleString()} />
                </div>
                <div className="mt-5 overflow-x-auto rounded-lg border border-white/8">
                  <table className="min-w-full divide-y divide-white/8 text-left text-sm">
                    <thead className="bg-black/20 text-xs uppercase tracking-wide text-brand-primary"><tr><th className="px-4 py-3">Campaign</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Spend</th><th className="px-4 py-3 text-right">Impressions</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">Avg CPC</th><th className="px-4 py-3 text-right">Conversions</th><th className="px-4 py-3 text-right">Conv. value</th></tr></thead>
                    <tbody className="divide-y divide-white/8">
                      {report.campaigns.map(campaign => (
                        <tr key={`${campaign.customerId}:${campaign.campaignId}:${campaign.currencyCode}`}>
                          <td className="px-4 py-3 font-medium text-white">{campaign.campaignName}</td>
                          <td className="px-4 py-3 text-brand-primary">{campaign.campaignStatus ?? 'Unknown'}</td>
                          <td className="px-4 py-3 text-right text-white">{formatGoogleAdsMoney(campaign.spendMicros, campaign.currencyCode)}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{campaign.impressions.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{campaign.clicks.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{campaign.ctr === null ? '—' : `${campaign.ctr.toFixed(2)}%`}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{formatGoogleAdsMoney(campaign.averageCpcMicros, campaign.currencyCode)}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{decimal(campaign.conversions)}</td>
                          <td className="px-4 py-3 text-right text-brand-primary">{formatGoogleAdsCurrencyValue(campaign.conversionValue, campaign.currencyCode)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brand-primary">{label}</span>{children}</label>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs uppercase tracking-wide text-brand-primary">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-white/8 bg-black/20 p-4"><p className="text-xs uppercase tracking-wide text-brand-primary">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>
}

function Message({ tone, children }: { tone: 'error' | 'success' | 'warning'; children: React.ReactNode }) {
  const styles = tone === 'error'
    ? 'border-red-400/25 bg-red-400/10 text-red-300'
    : tone === 'success'
      ? 'border-brand-teal/25 bg-brand-teal/10 text-[#66d0c3]'
      : 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>
}
