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
  isMonthComplete,
  monthDisplayLabel,
  getReportMonthFromPeriod,
  normalizeReportToCalendarMonth,
} from '../../lib/reportPeriod'
import { readStrategyData, strategyRequiredComplete } from '../../lib/strategyEngine'
import WorkflowGuide from '../../components/WorkflowGuide'

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

interface WorkflowStatus {
  label: string
  className: string
  next: string
}

// Friendly, single-glance status + next action for the workflow board.
function workflowStatus(report: Report, monthComplete: boolean, ready: boolean): WorkflowStatus {
  if (report.status === 'published') {
    return {
      label: 'Published',
      className: 'bg-brand-accent/20 text-brand-accent',
      next: 'Live for the client. Update any time the data changes.',
    }
  }
  if (!monthComplete) {
    return {
      label: 'Internal draft',
      className: 'bg-brand-muted text-brand-primary',
      next: 'Saved as internal draft. Client view unlocks after month-end — you can edit strategy now.',
    }
  }
  if (ready) {
    return {
      label: 'Ready to publish',
      className: 'bg-sky-300/15 text-sky-200',
      next: 'Looks complete. Review, then publish for the client.',
    }
  }
  return {
    label: 'Needs strategy',
    className: 'bg-amber-400/15 text-amber-300',
    next: 'Add the strategy and action plan, then publish.',
  }
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
    // Client-facing reports are only valid for completed calendar months.
    if (nextStatus === 'published' && !isMonthComplete(getReportMonthFromPeriod(report))) {
      setSuccess(null)
      setError('Client view is only available for completed months. This month is still in progress, so it stays an internal draft until the calendar month is complete.')
      return
    }
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

      <WorkflowGuide />

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
            const monthComplete = isMonthComplete(getReportMonthFromPeriod(report))
            const ready = monthComplete && report.status !== 'published' && strategyRequiredComplete(readStrategyData(report.strategy_data))
            const workflow = workflowStatus(report, monthComplete, ready)
            return (
              <article key={report.id} className="rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr_auto] xl:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-white">{clientName}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${workflow.className}`}>
                        {workflow.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">{monthLabel(report)}</p>
                    <p className="mt-1.5 text-xs text-brand-primary">
                      <span className="font-medium text-brand-accent">Next:</span> {workflow.next}
                    </p>
                    {isPartial && isAdmin && (
                      <p className="mt-2 text-[11px] text-amber-300/70">
                        Admin note: stored period is not a full calendar month. Use “Repair to calendar month” to tidy it.
                      </p>
                    )}
                  </div>

                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Detail label="Last updated" value={formatDateTime(report.updated_at ?? report.created_at)} />
                    <Detail label="Month" value={periodLabel(report)} />
                  </dl>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
                    {monthComplete ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/published?reportId=${report.id}`)}
                        className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                      >
                        View as client
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                        className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                      >
                        View internal draft
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                          className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
                        >
                          Edit strategy
                        </button>
                        {/* Publish is only valid for completed months. For an in-progress
                            month the button is disabled and the badge/explanation above
                            tells staff why. Unpublish stays available either way. */}
                        <button
                          type="button"
                          onClick={() => void handleStatus(report)}
                          disabled={busyReportId === report.id || (report.status !== 'published' && !monthComplete)}
                          title={report.status !== 'published' && !monthComplete ? 'Client view is only available for completed months.' : undefined}
                          className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
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
