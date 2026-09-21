import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import {
  getClientPublishedReportWithPosts,
  listClientPublishedReports,
  type ClientReport,
  type ClientReportWithPosts,
} from '../../lib/db/reports'
import {
  listClientReportManualMetrics,
  type ReportManualMetric,
} from '../../lib/db/manualMetrics'
import { getReportMonthFromPeriod, monthDisplayLabel, previousReportMonth, selectMonthlyReports } from '../../lib/reportPeriod'
import { ClientReportView, EmptyReportState } from './ClientReportView'
import { ClientMonthAhead } from '../../components/client/ClientMonthAhead'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import {
  loadGoogleAdsDashboard,
  type GoogleAdsDashboardData,
  type GoogleAdsDashboardState,
} from '../../lib/googleAdsDashboard'
import {
  loadReportPlatformFacts,
} from '../../lib/db/reportingTruth'
import type { PlatformFact } from '../../lib/overviewModel'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function monthLabel(report: ClientReport) {
  return monthDisplayLabel(getReportMonthFromPeriod(report))
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<ClientReport[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [report, setReport] = useState<ClientReportWithPosts | null>(null)
  const [manualMetrics, setManualMetrics] = useState<ReportManualMetric[]>([])
  const [googleAds, setGoogleAds] = useState<GoogleAdsDashboardData | null>(null)
  const [previousGoogleAds, setPreviousGoogleAds] = useState<GoogleAdsDashboardData | null>(null)
  const [googleAdsState, setGoogleAdsState] = useState<GoogleAdsDashboardState>('no-activity')
  const [googleAdsError, setGoogleAdsError] = useState<string | null>(null)
  const [facts, setFacts] = useState<PlatformFact[]>([])
  const [previousFacts, setPreviousFacts] = useState<PlatformFact[]>([])
  const [normalizedFactsAttempted, setNormalizedFactsAttempted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reportsRequestRef = useRef(0)
  const reportRequestRef = useRef(0)

  const months = useMemo(() => selectMonthlyReports(reports), [reports])

  useEffect(() => {
    const requestId = ++reportsRequestRef.current
    const requestedProfileId = profile?.id ?? null
    const requestedClientId = profile?.client_id ?? null
    const requestIsCurrent = () => requestId === reportsRequestRef.current
      && profile?.id === requestedProfileId
      && profile?.client_id === requestedClientId

    async function loadReports() {
      setReports([])
      setSelectedReportId(null)
      setClient(null)
      setReport(null)
      setManualMetrics([])
      setFacts([])
      setPreviousFacts([])
      reportRequestRef.current += 1
      if (!requestedClientId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [reportsRes, clientRes] = await Promise.all([
          listClientPublishedReports(),
          getClient(requestedClientId),
        ])
        if (!requestIsCurrent()) return
        const { data, error } = reportsRes
        if (error || clientRes.error || !clientRes.data) {
          setError(error?.message ?? clientRes.error?.message ?? 'Your client profile could not be loaded safely.')
        } else {
          setReports(data)
          setSelectedReportId(selectMonthlyReports(data)[0]?.id ?? null)
          setClient(clientRes.data)
        }
      } catch (error) {
        if (requestIsCurrent()) setError(errorMessage(error, 'Could not load your reports.'))
      } finally {
        if (requestIsCurrent()) setLoading(false)
      }
    }

    void loadReports()
    return () => { reportsRequestRef.current += 1 }
  }, [profile?.client_id, profile?.id])

  useEffect(() => {
    const requestId = ++reportRequestRef.current
    const requestedProfileId = profile?.id ?? null
    const requestedClientId = profile?.client_id ?? null
    const requestedReportId = selectedReportId
    const requestIsCurrent = () => requestId === reportRequestRef.current
      && profile?.id === requestedProfileId
      && profile?.client_id === requestedClientId
      && selectedReportId === requestedReportId

    if (!requestedReportId || !requestedClientId || !requestedProfileId) {
      setReport(null)
      setReportLoading(false)
      return () => { reportRequestRef.current += 1 }
    }
    const reportId = requestedReportId

    async function loadReport() {
      setReport(null)
      setManualMetrics([])
      setGoogleAds(null)
      setPreviousGoogleAds(null)
      setGoogleAdsState('no-activity')
      setGoogleAdsError(null)
      setFacts([])
      setPreviousFacts([])
      setNormalizedFactsAttempted(false)
      setReportLoading(true)
      setError(null)
      try {
        const { data, error } = await getClientPublishedReportWithPosts(reportId)
        if (!requestIsCurrent()) return
        if (error) {
          setError(error.message)
          return
        }
        setReport(data)
        if (data) {
          const currentMonth = getReportMonthFromPeriod(data)
          const previousMonth = previousReportMonth(currentMonth)
          const [metricsResult, googleAdsResult, previousGoogleAdsResult, factsResult] = await Promise.all([
            listClientReportManualMetrics(data.id),
            loadGoogleAdsDashboard(data.id, currentMonth),
            previousMonth
              ? loadGoogleAdsDashboard(data.id, previousMonth)
              : Promise.resolve({ data: null, state: 'no-activity' as const, error: null }),
            loadReportPlatformFacts(data.id, currentMonth, previousMonth),
          ])
          if (!requestIsCurrent()) return
          if (factsResult.error || metricsResult.error) {
            setReport(null)
            setManualMetrics([])
            setFacts([])
            setPreviousFacts([])
            setError('Verified reporting data could not be loaded safely. Please try again later.')
            return
          }
          setManualMetrics(metricsResult.data)
          setGoogleAds(googleAdsResult.data)
          setPreviousGoogleAds(previousGoogleAdsResult.data)
          setGoogleAdsState(googleAdsResult.state)
          setGoogleAdsError(googleAdsResult.error ?? previousGoogleAdsResult.error)
          setFacts(factsResult.facts)
          setPreviousFacts(factsResult.previousFacts)
          setNormalizedFactsAttempted(factsResult.normalizedAttempted)
        }
      } catch (error) {
        if (!requestIsCurrent()) return
        setReport(null)
        setError(errorMessage(error, 'Could not load this report.'))
      } finally {
        if (requestIsCurrent()) setReportLoading(false)
      }
    }

    void loadReport()
    return () => { reportRequestRef.current += 1 }
  }, [profile?.client_id, profile?.id, selectedReportId])

  if (!profile?.client_id) {
    return (
      <ClientPortalShell client={client}>
        <EmptyReportState
          title="Your account is pending setup"
          message="Your client access has not been linked yet. Contact your account manager to get access."
        />
      </ClientPortalShell>
    )
  }

  if (loading) {
    return (
      <ClientPortalShell client={client}>
        <p className="text-sm text-report-muted">Loading your reports…</p>
      </ClientPortalShell>
    )
  }

  if (error) {
    return (
      <ClientPortalShell client={client}>
        <p className="rounded-2xl bg-report-surface px-4 py-3 text-sm text-[#d8a07a]">{error}</p>
      </ClientPortalShell>
    )
  }

  if (months.length === 0) {
    return (
      <ClientPortalShell client={client}>
        <EmptyReportState
          title="No published report yet"
          message="Your monthly reports will appear here as soon as they are published by CG Production House."
        />
      </ClientPortalShell>
    )
  }

  return (
    <ClientPortalShell client={client}>
      {months.length > 1 && (
        <div className="mb-8">
          <p className="mb-3 text-[0.7rem] uppercase tracking-[0.22em] text-report-faint">Choose a month</p>
          <div className="flex flex-wrap gap-1.5">
            {months.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedReportId(item.id)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  selectedReportId === item.id
                    ? 'bg-report-accent/20 font-medium text-report-accent'
                    : 'text-report-faint hover:text-report-muted'
                }`}
              >
                {monthLabel(item)}
              </button>
            ))}
          </div>
        </div>
      )}

      {reportLoading ? (
        <p className="text-sm text-report-muted">Loading report…</p>
      ) : report ? (
        <ClientReportView
          report={report}
          client={client}
          manualMetrics={manualMetrics}
          googleAds={googleAds}
          previousGoogleAds={previousGoogleAds}
          googleAdsState={googleAdsState}
          googleAdsError={googleAdsError}
          facts={facts}
          previousFacts={previousFacts}
          normalizedFactsAttempted={normalizedFactsAttempted}
        />
      ) : (
        <EmptyReportState
          title="Select a month"
          message="Choose a month above to view its master dashboard."
        />
      )}

      {/* Forward-looking: this month's CG plan (client-safe; renders nothing
          until the client has visible schedule data). */}
      {profile.client_id && <ClientMonthAhead clientId={profile.client_id} />}
    </ClientPortalShell>
  )
}
