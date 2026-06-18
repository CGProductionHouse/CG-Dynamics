import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getClient, type Client } from '../../lib/db/clients'
import {
  getReportWithPosts,
  listPublishedReportsForClient,
  type Report,
  type ReportWithPosts,
} from '../../lib/db/reports'
import {
  listManualMetricsForClientMonth,
  type ManualPlatformMetric,
} from '../../lib/db/manualMetrics'
import { getReportMonthFromPeriod, monthDisplayLabel, previousReportMonth, selectMonthlyReports } from '../../lib/reportPeriod'
import { ClientDashboardShell, ClientReportView, EmptyReportState } from './ClientReportView'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function monthLabel(report: Report) {
  return monthDisplayLabel(getReportMonthFromPeriod(report))
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [reports, setReports] = useState<Report[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [report, setReport] = useState<ReportWithPosts | null>(null)
  const [manualMetrics, setManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [previousReport, setPreviousReport] = useState<ReportWithPosts | null>(null)
  const [previousManualMetrics, setPreviousManualMetrics] = useState<ManualPlatformMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const months = useMemo(() => selectMonthlyReports(reports), [reports])

  useEffect(() => {
    async function loadReports() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const [reportsRes, clientRes] = await Promise.all([
          listPublishedReportsForClient(profile.client_id),
          getClient(profile.client_id),
        ])
        const { data, error } = reportsRes
        if (error) {
          setError(error.message)
        } else {
          setReports(data)
          setSelectedReportId(selectMonthlyReports(data)[0]?.id ?? null)
          setClient(clientRes.data)
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load your reports.'))
      } finally {
        setLoading(false)
      }
    }

    void loadReports()
  }, [profile?.client_id])

  useEffect(() => {
    if (!selectedReportId) {
      setReport(null)
      setPreviousReport(null)
      setPreviousManualMetrics([])
      return
    }

    async function loadReport() {
      setReportLoading(true)
      setError(null)
      try {
        const { data, error } = await getReportWithPosts(selectedReportId!)
        if (error) {
          setError(error.message)
          return
        }
        setReport(data)
        if (data) {
          const currentMonth = getReportMonthFromPeriod(data)
          const previousMonth = previousReportMonth(currentMonth)
          const { data: metrics } = await listManualMetricsForClientMonth(data.client_id, currentMonth)
          setManualMetrics(metrics)
          if (previousMonth) {
            const previous = reports.find(item => getReportMonthFromPeriod(item) === previousMonth)
            const [previousReportResult, previousMetricsResult] = await Promise.all([
              previous ? getReportWithPosts(previous.id) : Promise.resolve({ data: null, error: null }),
              listManualMetricsForClientMonth(data.client_id, previousMonth),
            ])
            setPreviousReport(previousReportResult.data)
            setPreviousManualMetrics(previousMetricsResult.data)
          } else {
            setPreviousReport(null)
            setPreviousManualMetrics([])
          }
        } else {
          setManualMetrics([])
          setPreviousReport(null)
          setPreviousManualMetrics([])
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load this report.'))
      } finally {
        setReportLoading(false)
      }
    }

    void loadReport()
  }, [reports, selectedReportId])

  const action = (
    <button
      onClick={signOut}
      className="text-sm text-brand-primary hover:text-brand-accent transition-colors"
    >
      Sign out
    </button>
  )

  if (!profile?.client_id) {
    return (
      <ClientDashboardShell action={action} client={client}>
        <EmptyReportState
          title="Your account is pending setup"
          message="Your client access has not been linked yet. Contact your account manager to get access."
        />
      </ClientDashboardShell>
    )
  }

  if (loading) {
    return (
      <ClientDashboardShell action={action} client={client}>
        <p className="text-brand-primary text-sm">Loading your reports...</p>
      </ClientDashboardShell>
    )
  }

  if (error) {
    return (
      <ClientDashboardShell action={action} client={client}>
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </p>
      </ClientDashboardShell>
    )
  }

  if (months.length === 0) {
    return (
      <ClientDashboardShell action={action} client={client}>
        <EmptyReportState
          title="No published report yet"
          message="Your monthly reports will appear here as soon as they are published by CG Production House."
        />
      </ClientDashboardShell>
    )
  }

  return (
    <ClientDashboardShell action={action} client={client}>
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-3">Your reports</p>
        <div className="flex flex-wrap gap-2">
          {months.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedReportId(item.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedReportId === item.id
                  ? 'bg-brand-accent text-brand-bg'
                  : 'border border-brand-muted text-brand-primary hover:text-white hover:border-white/30'
              }`}
            >
              {monthLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {reportLoading ? (
        <p className="text-brand-primary text-sm">Loading report...</p>
      ) : report ? (
        <ClientReportView
          report={report}
          client={client}
          manualMetrics={manualMetrics}
          previousReport={previousReport}
          previousManualMetrics={previousManualMetrics}
        />
      ) : (
        <EmptyReportState
          title="Select a month"
          message="Choose a month above to view its master dashboard."
        />
      )}
    </ClientDashboardShell>
  )
}
