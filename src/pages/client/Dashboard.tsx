import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClientPortal } from '../../components/client/ClientPortalContext'
import { ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { useAuth } from '../../contexts/AuthContext'
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
import {
  ClientReportView,
  EmptyReportState,
  type GoogleSurface,
  type ReportTabKey,
} from './ClientReportView'
import { ClientMonthAhead } from '../../components/client/ClientMonthAhead'
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
  const { client } = useClientPortal()
  const [searchParams, setSearchParams] = useSearchParams()
  const [reports, setReports] = useState<ClientReport[]>([])
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [report, setReport] = useState<ClientReportWithPosts | null>(null)
  const [manualMetrics, setManualMetrics] = useState<ReportManualMetric[]>([])
  const [googleAds, setGoogleAds] = useState<GoogleAdsDashboardData | null>(null)
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
  const requestedTab = parseReportTab(searchParams.get('tab'))
  const requestedGoogleSurface = parseGoogleSurface(searchParams.get('surface'))

  const handleTabChange = (tab: ReportTabKey) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'overview') next.delete('tab')
    else next.set('tab', tab)
    if (tab !== 'google') next.delete('surface')
    setSearchParams(next, { replace: true })
  }

  const handleGoogleSurfaceChange = (surface: GoogleSurface) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', 'google')
    if (surface === 'ads') next.delete('surface')
    else next.set('surface', surface)
    setSearchParams(next, { replace: true })
  }

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
        const reportsRes = await listClientPublishedReports()
        if (!requestIsCurrent()) return
        const { data, error } = reportsRes
        if (error) {
          setError(error.message)
        } else {
          setReports(data)
          setSelectedReportId(selectMonthlyReports(data)[0]?.id ?? null)
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
      return () => { reportRequestRef.current += 1 }
    }
    const reportId = requestedReportId

    async function loadReport() {
      setReport(null)
      setManualMetrics([])
      setGoogleAds(null)
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
          const [metricsResult, googleAdsResult, factsResult] = await Promise.all([
            listClientReportManualMetrics(data.id),
            loadGoogleAdsDashboard(data.id, currentMonth),
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
          setGoogleAdsState(googleAdsResult.state)
          setGoogleAdsError(googleAdsResult.error)
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
      <EmptyReportState
        title="Your account is pending setup"
        message="Your client access has not been linked yet. Contact your account manager to get access."
      />
    )
  }

  if (loading) {
    return <ClientPortalLoadingState variant="report" />
  }

  if (error) {
    return <ClientPortalErrorState title="Performance is temporarily unavailable" message="Your published reporting could not be loaded safely. Please try again shortly." />
  }

  if (months.length === 0) {
    return (
      <EmptyReportState
        title="No published report yet"
        message="Your monthly reports will appear here as soon as they are published by CG Production House."
      />
    )
  }

  return (
    <>
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
        <ClientPortalLoadingState variant="report" />
      ) : report ? (
        <ClientReportView
          report={report}
          client={client}
          manualMetrics={manualMetrics}
          googleAds={googleAds}
          googleAdsState={googleAdsState}
          googleAdsError={googleAdsError}
          facts={facts}
          previousFacts={previousFacts}
          normalizedFactsAttempted={normalizedFactsAttempted}
          initialTab={requestedTab}
          onTabChange={handleTabChange}
          initialGoogleSurface={requestedGoogleSurface}
          onGoogleSurfaceChange={handleGoogleSurfaceChange}
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
    </>
  )
}

function parseReportTab(value: string | null): ReportTabKey {
  if (value === 'campaigns' || value === 'google_ads') return 'google'
  if (value === 'facebook' || value === 'instagram' || value === 'google' || value === 'tiktok' || value === 'linkedin' || value === 'web' || value === 'email') return value
  return 'overview'
}

function parseGoogleSurface(value: string | null): GoogleSurface {
  return value === 'business' ? 'business' : 'ads'
}
