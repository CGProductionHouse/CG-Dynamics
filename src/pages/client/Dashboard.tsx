import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getLatestPublishedReportForClient, type ReportWithPosts } from '../../lib/db/reports'
import { calculateReportStats, reportPostToStatsPost } from '../../lib/reportStats'
import { ClientDashboardShell, ClientReportView, EmptyReportState } from './ClientReportView'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [report, setReport] = useState<ReportWithPosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadReport() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const { data, error } = await getLatestPublishedReportForClient(profile.client_id)
        if (error) {
          setError(error.message)
        } else {
          setReport(data)
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load your latest report.'))
      } finally {
        setLoading(false)
      }
    }

    void loadReport()
  }, [profile?.client_id])

  const statsPosts = useMemo(() => report?.posts.map(reportPostToStatsPost) ?? [], [report])
  const stats = useMemo(() => calculateReportStats(statsPosts), [statsPosts])
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
      <ClientDashboardShell action={action}>
        <EmptyReportState
          title="Your account is pending setup"
          message="Your client access has not been linked yet. Contact your account manager to get access."
        />
      </ClientDashboardShell>
    )
  }

  if (loading) {
    return (
      <ClientDashboardShell action={action}>
        <p className="text-brand-primary text-sm">Loading your report...</p>
      </ClientDashboardShell>
    )
  }

  if (error) {
    return (
      <ClientDashboardShell action={action}>
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
          {error}
        </p>
      </ClientDashboardShell>
    )
  }

  if (!report) {
    return (
      <ClientDashboardShell action={action}>
        <EmptyReportState
          title="No published report yet"
          message="Your latest report will appear here as soon as it is published by CG Production House."
        />
      </ClientDashboardShell>
    )
  }

  return (
    <ClientDashboardShell action={action}>
      <ClientReportView report={report} stats={stats} />
    </ClientDashboardShell>
  )
}
