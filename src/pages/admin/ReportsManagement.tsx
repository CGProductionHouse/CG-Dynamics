import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { listClients, type Client } from '../../lib/db/clients'
import {
  deleteReport,
  listReports,
  updateReportPeriod,
  updateReportStatus,
  type Report,
} from '../../lib/db/reports'
import {
  formatReportPeriod,
  isFullCalendarMonth,
  monthDisplayLabel,
  getReportMonthFromPeriod,
  normalizeReportToCalendarMonth,
} from '../../lib/reportPeriod'

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return fallback
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function monthLabel(report: Report) {
  return monthDisplayLabel(getReportMonthFromPeriod(report))
}

function periodLabel(report: Report) {
  return formatReportPeriod({ start: report.period_start, end: report.period_end })
}

export default function ReportsManagement() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [busyReportId, setBusyReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  async function load() {
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
    } catch (error) {
      setError(errorMessage(error, 'Could not load reports.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function handleStatus(report: Report) {
    const nextStatus = report.status === 'published' ? 'draft' : 'published'
    const confirmed = window.confirm(
      `${nextStatus === 'published' ? 'Publish' : 'Unpublish'} ${clientNameById.get(report.client_id) ?? 'this client'} ${monthLabel(report)}?`
    )
    if (!confirmed) return

    setBusyReportId(report.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await updateReportStatus(report.id, nextStatus)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(`Report ${nextStatus === 'published' ? 'published' : 'unpublished'}.`)
      await load()
    } catch (error) {
      setError(errorMessage(error, 'Could not update report status.'))
    } finally {
      setBusyReportId(null)
    }
  }

  async function handleDelete(report: Report) {
    const confirmed = window.confirm(
      `Delete report for ${clientNameById.get(report.client_id) ?? report.client_id} (${periodLabel(report)})?\n\nThis deletes only the report and its report posts. Imported CSV data will remain available.`
    )
    if (!confirmed) return

    setBusyReportId(report.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await deleteReport(report.id)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess('Report deleted.')
      await load()
    } catch (error) {
      setError(errorMessage(error, 'Could not delete report.'))
    } finally {
      setBusyReportId(null)
    }
  }

  async function handleRepair(report: Report) {
    const { month, start, end } = normalizeReportToCalendarMonth(report)
    const confirmed = window.confirm(
      `Repair ${clientNameById.get(report.client_id) ?? report.client_id} to ${monthDisplayLabel(month)}?\n\n` +
      `Period will be set to ${start} → ${end} (full calendar month).\n` +
      `This does not publish, delete or change any report content.`
    )
    if (!confirmed) return

    setBusyReportId(report.id)
    setError(null)
    setSuccess(null)
    try {
      const { error } = await updateReportPeriod(report.id, start, end)
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(`Report repaired to ${monthDisplayLabel(month)}.`)
      await load()
    } catch (error) {
      setError(errorMessage(error, 'Could not repair report.'))
    } finally {
      setBusyReportId(null)
    }
  }

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-brand-primary mb-2">Reports</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Report management</h1>
          <p className="text-sm text-brand-primary mt-2 max-w-2xl">
            {isAdmin
              ? 'View, edit, publish, unpublish, and delete monthly client reports.'
              : 'View monthly client reports (read-only).'}
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate('/admin/reports/new')}
            className="rounded-lg bg-brand-accent px-4 py-2.5 text-sm font-semibold text-brand-bg hover:brightness-110"
          >
            New report
          </button>
        )}
      </div>

      {error && <Message tone="error" text={error} />}
      {success && <Message tone="success" text={success} />}

      {loading ? (
        <p className="text-sm text-brand-primary">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          No reports found.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => {
            const clientName = clientNameById.get(report.client_id) ?? report.client_id
            const isPartial = !isFullCalendarMonth(report.period_start, report.period_end)
            return (
              <article key={report.id} className="rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-white">{clientName}</h2>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        report.status === 'published'
                          ? 'bg-brand-accent/20 text-brand-accent'
                          : 'bg-brand-muted text-brand-primary'
                      }`}>
                        {report.status}
                      </span>
                      {isPartial && (
                        <span className="rounded-full bg-amber-400/15 px-2 py-1 text-xs font-medium text-amber-300">
                          Invalid partial period
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-brand-primary">{monthLabel(report)} | {periodLabel(report)}</p>
                    <p className="mt-1 text-xs text-brand-primary">Monthly master report</p>
                    {isPartial && (
                      <p className="mt-1 text-xs text-amber-300/90">
                        Client-facing reports use completed calendar months only. Repair to {monthLabel(report)} to fix the period.
                      </p>
                    )}
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Created" value={formatDateTime(report.created_at)} />
                    <Detail label="Last updated" value={formatDateTime(report.updated_at ?? report.created_at)} />
                  </dl>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/published?reportId=${report.id}`)}
                      className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                    >
                      View
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                          className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleStatus(report)}
                          disabled={busyReportId === report.id}
                          className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white disabled:opacity-60"
                        >
                          {report.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        {isPartial && (
                          <button
                            type="button"
                            onClick={() => void handleRepair(report)}
                            disabled={busyReportId === report.id}
                            className="rounded-lg border border-amber-400/40 px-3 py-2 text-sm text-amber-300 hover:bg-amber-400/10 disabled:opacity-60"
                          >
                            Repair to calendar month
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDelete(report)}
                          disabled={busyReportId === report.id}
                          className="rounded-lg border border-red-400/30 px-3 py-2 text-sm text-red-300 hover:bg-red-400/10 disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-brand-muted bg-brand-bg/60 p-3">
      <dt className="text-xs text-brand-primary">{label}</dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
