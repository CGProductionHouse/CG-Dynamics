import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import {
  getReportWithPosts,
  listReports,
  updateReportStatus,
  type Report,
  type ReportWithPosts,
} from '../../lib/db/reports'
import { formatReportPeriod } from '../../lib/reportPeriod'
import { ClientDashboardShell, ClientReportView, EmptyReportState } from '../client/ClientReportView'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function reportLabel(report: Report) {
  const month = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${report.period_start}T00:00:00`))
  return `${month} (${formatReportPeriod({ start: report.period_start, end: report.period_end })})`
}

export default function PublishedPreview() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialReportId] = useState(searchParams.get('reportId') ?? '')
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedReportId, setSelectedReportId] = useState(initialReportId)
  const [report, setReport] = useState<ReportWithPosts | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clientReports = useMemo(() => {
    return reports.filter(report => report.client_id === selectedClientId)
  }, [reports, selectedClientId])
  useEffect(() => {
    async function loadOptions() {
      setLoading(true)
      setError(null)
      try {
        const [clientsRes, reportsRes] = await Promise.all([listClients(), listReports()])
        const loadError = clientsRes.error ?? reportsRes.error
        if (loadError) {
          setError(loadError.message)
          return
        }
        setClients(clientsRes.data)
        setReports(reportsRes.data)

        const selectedReport = initialReportId
          ? reportsRes.data.find(report => report.id === initialReportId)
          : reportsRes.data.find(report => report.status === 'published') ?? reportsRes.data[0]
        const nextClientId = selectedReport?.client_id ?? clientsRes.data[0]?.id ?? ''
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
  }, [initialReportId])

  useEffect(() => {
    if (!selectedReportId) {
      setReport(null)
      return
    }

    async function loadReport() {
      setReportLoading(true)
      setError(null)
      try {
        const { data, error } = await getReportWithPosts(selectedReportId)
        if (error) {
          setError(error.message)
        } else {
          setReport(data)
          setSearchParams({ reportId: selectedReportId }, { replace: true })
        }
      } catch (error) {
        setError(errorMessage(error, 'Could not load this report preview.'))
      } finally {
        setReportLoading(false)
      }
    }

    void loadReport()
  }, [selectedReportId, setSearchParams])

  function handleClientChange(clientId: string) {
    setSelectedClientId(clientId)
    const nextReport = reports.find(report => report.client_id === clientId && report.status === 'published')
      ?? reports.find(report => report.client_id === clientId)
    setSelectedReportId(nextReport?.id ?? '')
  }

  async function handleUnpublish() {
    if (!report) return
    const confirmed = window.confirm('Unpublish this report? The client will no longer see it on their dashboard.')
    if (!confirmed) return

    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await updateReportStatus(report.id, 'draft')
      if (error) {
        setError(error.message)
        return
      }
      setSuccess('Report unpublished.')
      const { data } = await getReportWithPosts(report.id)
      setReport(data)
    } catch (error) {
      setError(errorMessage(error, 'Could not unpublish this report.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Published</p>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">Published / Client preview</h1>
        <p className="text-sm text-brand-primary mt-2 max-w-2xl">
          Preview the read-only client report without logging into a client account.
        </p>
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
              disabled={loading || clientReports.length === 0}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              {clientReports.map(report => (
                <option key={report.id} value={report.id}>
                  {reportLabel(report)} - {report.status}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="rounded-lg border border-brand-muted px-3 py-2.5 text-sm text-brand-primary hover:text-white"
          >
            Back to reports
          </button>
        </div>
      </section>

      {report && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110"
              >
                Edit report
              </button>
              <button
                type="button"
                onClick={() => void handleUnpublish()}
                disabled={busy || report.status !== 'published'}
                className="rounded-lg border border-brand-muted px-4 py-2.5 text-sm text-brand-primary hover:text-white disabled:opacity-60"
              >
                Unpublish
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="rounded-lg border border-brand-muted px-4 py-2.5 text-sm text-brand-primary hover:text-white"
          >
            Back to reports
          </button>
        </div>
      )}

      {reportLoading ? (
        <p className="text-sm text-brand-primary">Loading preview...</p>
      ) : report ? (
        <div className="overflow-hidden rounded-xl border border-brand-muted">
          <ClientDashboardShell action={<span className="text-xs font-semibold text-brand-accent">Preview mode</span>}>
            <ClientReportView report={report} />
          </ClientDashboardShell>
        </div>
      ) : (
        <EmptyReportState
          title="No report selected"
          message="Select a client and report period to preview what the client will see."
        />
      )}
    </div>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
