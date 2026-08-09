import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import {
  getReportWithPosts,
  listReports,
  updateReportStatus,
  type Report,
  type ReportWithPosts,
} from '../../lib/db/reports'
import {
  listManualMetricsForClientMonth,
  type ManualPlatformMetric,
} from '../../lib/db/manualMetrics'
import { getReportMonthFromPeriod, monthDisplayLabel, previousReportMonth, selectMonthlyReports } from '../../lib/reportPeriod'
import { ClientDashboardShell, ClientReportView } from '../client/ClientReportView'
import { ClientMonthAhead } from '../../components/client/ClientMonthAhead'
import { EmptyState } from '../../components/ui/States'
import {
  loadGoogleAdsDashboard,
  type GoogleAdsDashboardData,
  type GoogleAdsDashboardState,
} from '../../lib/googleAdsDashboard'
import {
  loadReportContentExclusions,
  loadReportFactHealth,
  loadReportPlatformFacts,
  setReportContentExclusion,
  type ReportContentExclusion,
  type ReportFactHealth,
} from '../../lib/db/reportingTruth'
import type { PlatformFact } from '../../lib/overviewModel'
import type { ReportStatsPost } from '../../lib/reportStats'
import { isStaffRole } from '../../lib/roles'

function errorMessage(_error: unknown, fallback: string) {
  return fallback
}

function reportLabel(report: Report) {
  return monthDisplayLabel(getReportMonthFromPeriod(report))
}

type DashboardMode = 'client' | 'editor'

function statusLabel(status: Report['status']) {
  return status === 'published' ? 'Published' : 'Draft'
}

export default function PublishedPreview() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isStaff = isStaffRole(profile?.role)
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialReportId] = useState(searchParams.get('reportId') ?? '')
  const [initialClientId] = useState(searchParams.get('client') ?? '')
  const [initialMonth] = useState(searchParams.get('month') ?? '')
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedReportId, setSelectedReportId] = useState(initialReportId)
  const [report, setReport] = useState<ReportWithPosts | null>(null)
  const [manualMetrics, setManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [previousReport, setPreviousReport] = useState<ReportWithPosts | null>(null)
  const [previousManualMetrics, setPreviousManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [googleAds, setGoogleAds] = useState<GoogleAdsDashboardData | null>(null)
  const [previousGoogleAds, setPreviousGoogleAds] = useState<GoogleAdsDashboardData | null>(null)
  const [googleAdsState, setGoogleAdsState] = useState<GoogleAdsDashboardState>('no-activity')
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null)
  const [facts, setFacts] = useState<PlatformFact[]>([])
  const [previousFacts, setPreviousFacts] = useState<PlatformFact[]>([])
  const [normalizedFactsAttempted, setNormalizedFactsAttempted] = useState(false)
  const [dataHealth, setDataHealth] = useState<ReportFactHealth[]>([])
  const [contentExclusions, setContentExclusions] = useState<ReportContentExclusion[]>([])
  const [curationBusyId, setCurationBusyId] = useState<string | null>(null)
  const [mode, setMode] = useState<DashboardMode>('client')
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // The "View as client" dropdown mirrors what a client can actually see: one
  // report per completed calendar month, deduped. Partial/current-month and
  // duplicate reports are filtered out here.
  const clientReports = useMemo(() => {
    return selectMonthlyReports(reports.filter(report => report.client_id === selectedClientId))
  }, [reports, selectedClientId])

  const reportOptions = useMemo(() => {
    const selected = reports.find(report => report.id === selectedReportId)
    if (!selected || clientReports.some(report => report.id === selected.id)) return clientReports
    return [selected, ...clientReports]
  }, [clientReports, reports, selectedReportId])

  const selectedClient = useMemo(
    () => clients.find(client => client.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  )
  useEffect(() => {
    async function loadOptions() {
      setLoading(true)
      setError(null)
      try {
        const [clientsRes, reportsRes] = await Promise.all([listClients(), listReports()])
        const loadError = clientsRes.error ?? reportsRes.error
        if (loadError) {
          setError('Could not load dashboard options.')
          return
        }
        setClients(clientsRes.data)
        setReports(reportsRes.data)

        const queryClientId = clientsRes.data.some(client => client.id === initialClientId) ? initialClientId : ''
        const queryClientReports = queryClientId
          ? selectMonthlyReports(reportsRes.data.filter(report => report.client_id === queryClientId))
          : []
        const exactMonthReport = queryClientId && initialMonth
          ? reportsRes.data.find(report => report.client_id === queryClientId && getReportMonthFromPeriod(report) === initialMonth)
          : undefined
        const selectedReport = initialReportId
          ? reportsRes.data.find(report => report.id === initialReportId)
          : queryClientId
            ? initialMonth
              ? exactMonthReport
              : queryClientReports.find(report => report.status === 'published')
                ?? queryClientReports[0]
                ?? reportsRes.data.find(report => report.client_id === queryClientId)
            : reportsRes.data.find(report => report.status === 'published') ?? reportsRes.data[0]
        const nextClientId = ((selectedReport?.client_id ?? queryClientId) || clientsRes.data[0]?.id) ?? ''
        const nextReportId = selectedReport?.id ?? ''
        setSelectedClientId(nextClientId)
        setSelectedReportId(nextReportId)
      } catch (error) {
        setError(errorMessage(error, 'Could not load preview options.'))
      } finally {
        setLoading(false)
      }
    }

    void loadOptions()
  }, [initialClientId, initialMonth, initialReportId])

  useEffect(() => {
    let active = true

    if (!selectedReportId) {
      return () => { active = false }
    }

    async function loadReport() {
      setReport(null)
      setManualMetrics([])
      setPreviousReport(null)
      setPreviousManualMetrics([])
      setGoogleAds(null)
      setPreviousGoogleAds(null)
      setGoogleAdsState('no-activity')
      setGoogleAdsError(null)
      setFacts([])
      setPreviousFacts([])
      setNormalizedFactsAttempted(false)
      setDataHealth([])
      setContentExclusions([])
      setReportLoading(true)
      setError(null)
      try {
        const { data, error } = await getReportWithPosts(selectedReportId)
        if (!active) return
        if (error) {
          setError('Could not load this dashboard.')
          return
        }
        setReport(data)
        setSearchParams({ reportId: selectedReportId }, { replace: true })
        if (data) {
          const currentMonth = getReportMonthFromPeriod(data)
          const previousMonth = previousReportMonth(currentMonth)
          const previous = previousMonth
            ? reports.find(report => report.client_id === data.client_id && getReportMonthFromPeriod(report) === previousMonth)
            : null
          const [metricsResult, previousReportResult, previousMetricsResult, googleAdsResult, previousGoogleAdsResult, factsResult, healthResult, exclusionsResult] = await Promise.all([
            listManualMetricsForClientMonth(data.client_id, currentMonth),
            previous ? getReportWithPosts(previous.id) : Promise.resolve({ data: null, error: null }),
            previousMonth ? listManualMetricsForClientMonth(data.client_id, previousMonth) : Promise.resolve({ data: [], error: null }),
            loadGoogleAdsDashboard(data.id, currentMonth),
            previousMonth
              ? loadGoogleAdsDashboard(data.id, previousMonth)
              : Promise.resolve({ data: null, state: 'no-activity' as const, error: null }),
            loadReportPlatformFacts(data.id, currentMonth, previousMonth),
            loadReportFactHealth(data.id),
            loadReportContentExclusions(data.id),
          ])
          if (!active) return
          if (factsResult.error || healthResult.error || exclusionsResult.error) {
            setError('Verified reporting data could not be loaded safely.')
            return
          }
          setManualMetrics(metricsResult.data)
          setPreviousReport(previousReportResult.data)
          setPreviousManualMetrics(previousMetricsResult.data)
          setGoogleAds(googleAdsResult.data)
          setPreviousGoogleAds(previousGoogleAdsResult.data)
          setGoogleAdsState(googleAdsResult.state)
          setGoogleAdsError(googleAdsResult.error || previousGoogleAdsResult.error ? 'Google Ads data could not be loaded.' : null)
          setFacts(factsResult.facts)
          setPreviousFacts(factsResult.previousFacts)
          setNormalizedFactsAttempted(factsResult.normalizedAttempted)
          setDataHealth(healthResult.data)
          setContentExclusions(exclusionsResult.data)
        }
      } catch (error) {
        if (!active) return
        setError(errorMessage(error, 'Could not load this report preview.'))
      } finally {
        if (active) setReportLoading(false)
      }
    }

    void loadReport()
    return () => { active = false }
  }, [reports, selectedReportId, setSearchParams])

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId)
    const eligible = selectMonthlyReports(reports.filter(report => report.client_id === clientId))
    const nextReport = eligible.find(report => report.status === 'published') ?? eligible[0]
    setSelectedReportId(nextReport?.id ?? '')
    if (!nextReport) {
      setReport(null)
      setManualMetrics([])
      setPreviousReport(null)
      setPreviousManualMetrics([])
      setGoogleAds(null)
      setPreviousGoogleAds(null)
      setGoogleAdsState('no-activity')
      setGoogleAdsError(null)
      setFacts([])
      setPreviousFacts([])
      setNormalizedFactsAttempted(false)
      setDataHealth([])
      setContentExclusions([])
    }
  }

  async function handleContentExcluded(post: ReportStatsPost, excluded: boolean) {
    if (!report || !post.metaObjectId || !post.platform || !isAdmin) return
    setCurationBusyId(post.metaObjectId)
    setError(null)
    setSuccess(null)
    try {
      const result = await setReportContentExclusion({
        reportId: report.id,
        clientId: report.client_id,
        postId: post.id,
        platform: post.platform,
        metaObjectId: post.metaObjectId,
        excluded,
        reason: excluded ? 'Skipped from client-facing report highlights' : null,
      })
      if (result.error || !result.data) {
        setError('Could not update report curation.')
        return
      }
      setContentExclusions(current => [
        ...current.filter(item => !(item.platform === result.data!.platform && item.meta_object_id === result.data!.meta_object_id)),
        result.data!,
      ])
      setSuccess(excluded ? 'Post skipped from report highlights.' : 'Post restored to report highlights.')
    } catch (error) {
      setError(errorMessage(error, 'Could not update report curation.'))
    } finally {
      setCurationBusyId(null)
    }
  }

  async function handleStatusChange(status: Report['status']) {
    if (!report) return
    const confirmed = window.confirm(
      status === 'published'
        ? 'Publish this dashboard for the client?'
        : 'Unpublish this dashboard? The client will no longer see it.'
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await updateReportStatus(report.id, status)
      if (error) {
        setError(status === 'published' ? 'Could not publish this dashboard.' : 'Could not unpublish this dashboard.')
        return
      }
      setSuccess(status === 'published' ? 'Dashboard published.' : 'Dashboard unpublished.')
      const { data } = await getReportWithPosts(report.id)
      setReport(data)
      if (data) {
        setReports(current => current.map(item => item.id === data.id ? data : item))
      }
    } catch (error) {
      setError(errorMessage(error, status === 'published' ? 'Could not publish this dashboard.' : 'Could not unpublish this dashboard.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Client Dashboard Preview</h1>
        <p className="mt-2 text-sm text-brand-primary">Staff preview and publishing controls.</p>
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      <section className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
          <label className="block">
            <span className="block text-sm font-medium text-brand-accent mb-1.5">Client</span>
            <select
              value={selectedClientId}
              onChange={event => handleClientChange(event.target.value)}
              disabled={loading}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-brand-accent mb-1.5">Report period</span>
            <select
              value={selectedReportId}
              onChange={event => setSelectedReportId(event.target.value)}
              disabled={loading || reportOptions.length === 0}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {reportOptions.map(report => (
                <option key={report.id} value={report.id}>
                  {reportLabel(report)} - {report.status}
                </option>
              ))}
            </select>
          </label>

          <div className="flex rounded-lg border border-brand-muted bg-brand-bg p-1">
            <button
              type="button"
              onClick={() => setMode('client')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === 'client' ? 'bg-brand-accent text-black' : 'text-brand-primary hover:text-white'}`}
            >
              Client View
            </button>
            <button
              type="button"
              onClick={() => setMode('editor')}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${mode === 'editor' ? 'bg-brand-accent text-black' : 'text-brand-primary hover:text-white'}`}
            >
              Editor
            </button>
          </div>
        </div>
      </section>

      {reportLoading ? (
        <p className="text-sm text-brand-primary">Loading dashboard...</p>
      ) : report && mode === 'editor' ? (
        <EditorPanel
          report={report}
          isAdmin={isAdmin}
          busy={busy}
          onEdit={() => navigate(`/admin/reports/${report.id}/edit`)}
          onPublish={() => void handleStatusChange('published')}
          onUnpublish={() => void handleStatusChange('draft')}
        />
      ) : report ? (
        <div className="overflow-hidden rounded-xl border border-brand-muted">
          <ClientDashboardShell action={<span className="rounded-full bg-report-elevated px-3 py-1 text-xs font-medium text-report-accent">Client view</span>} client={selectedClient}>
            <ClientReportView
              report={report}
              client={selectedClient}
              manualMetrics={manualMetrics}
              previousReport={previousReport}
              previousManualMetrics={previousManualMetrics}
              googleAds={googleAds}
              previousGoogleAds={previousGoogleAds}
              googleAdsState={googleAdsState}
              googleAdsError={googleAdsError}
              facts={facts}
              previousFacts={previousFacts}
              normalizedFactsAttempted={normalizedFactsAttempted}
              dataHealth={dataHealth}
              contentExclusions={contentExclusions}
              onSetContentExcluded={isAdmin ? handleContentExcluded : undefined}
              curationBusyId={curationBusyId}
              showEmptyStrategy
              showAdminDiagnostics={isStaff}
            />
            {selectedClientId && <ClientMonthAhead clientId={selectedClientId} />}
          </ClientDashboardShell>
        </div>
      ) : (
        <EmptyState
          title={initialMonth ? 'No dashboard for this synced month' : 'No report selected'}
          message={initialMonth ? 'No monthly dashboard exists for this period.' : 'Choose a client and report period above.'}
          compact
        />
      )}
      <div className="mt-5 text-right">
        <Link to="/admin/reports" className="text-xs font-medium text-brand-primary/45 underline-offset-4 hover:text-brand-primary hover:underline">
          All reports
        </Link>
      </div>
    </div>
  )
}

function EditorPanel({
  report,
  isAdmin,
  busy,
  onEdit,
  onPublish,
  onUnpublish,
}: {
  report: ReportWithPosts
  isAdmin: boolean
  busy: boolean
  onEdit: () => void
  onPublish: () => void
  onUnpublish: () => void
}) {
  return (
    <section className="rounded-xl border border-brand-muted bg-brand-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboard controls</h2>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${report.status === 'published' ? 'border-brand-teal/30 bg-brand-teal/10 text-[#66d0c3]' : 'border-white/10 bg-white/[0.04] text-brand-primary'}`}>
          {statusLabel(report.status)}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110"
            >
              Edit strategy/action plan
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={busy || report.status === 'published'}
              className="rounded-lg border border-brand-teal/30 bg-brand-teal/[0.08] px-4 py-2.5 text-sm font-semibold text-[#66d0c3] hover:text-white disabled:opacity-55"
            >
              {busy ? 'Working...' : 'Publish'}
            </button>
            <button
              type="button"
              onClick={onUnpublish}
              disabled={busy || report.status !== 'published'}
              className="rounded-lg border border-brand-muted px-4 py-2.5 text-sm text-brand-primary hover:text-white disabled:opacity-55"
            >
              {busy ? 'Working...' : 'Unpublish'}
            </button>
          </>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-brand-primary/75">
            Admin access is required to edit strategy/action plan content or change publishing status.
          </p>
        )}
      </div>
    </section>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
