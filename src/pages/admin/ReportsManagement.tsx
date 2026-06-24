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
  isFullCalendarMonth,
  isMonthComplete,
  monthDisplayLabel,
  getReportMonthFromPeriod,
  normalizeReportToCalendarMonth,
} from '../../lib/reportPeriod'
import { readStrategyData, strategyRequiredComplete } from '../../lib/strategyEngine'
import { ClientLogo } from '../../components/ClientLogo'
import WorkflowGuide from '../../components/WorkflowGuide'
import { supabase } from '../../lib/supabase'

type StatusFilter = 'all' | 'internal-draft' | 'ready-to-publish' | 'published' | 'incomplete-month' | 'needs-repair'

type ReportSource = 'meta' | 'manual' | 'mixed'
type SourceFilter = 'all' | ReportSource

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'meta', label: 'Meta synced' },
  { value: 'manual', label: 'Manual / CSV' },
  { value: 'mixed', label: 'Mixed' },
]

const SOURCE_BADGE: Record<ReportSource, { label: string; className: string }> = {
  meta: { label: 'Meta synced', className: 'bg-sky-400/15 text-sky-300' },
  manual: { label: 'Manual / CSV', className: 'bg-brand-muted text-brand-primary' },
  mixed: { label: 'Mixed', className: 'bg-amber-400/15 text-amber-300' },
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'internal-draft', label: 'Internal drafts' },
  { value: 'ready-to-publish', label: 'Ready to publish' },
  { value: 'published', label: 'Published' },
  { value: 'incomplete-month', label: 'Incomplete month' },
  { value: 'needs-repair', label: 'Needs repair' },
]

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

function getDerivedStatus(report: Report, monthComplete: boolean, ready: boolean, isPartial: boolean): StatusFilter {
  if (isPartial) return 'needs-repair'
  if (report.status === 'published') return 'published'
  if (!monthComplete) return 'incomplete-month'
  if (ready) return 'ready-to-publish'
  return 'internal-draft'
}

interface BadgeInfo {
  label: string
  className: string
}

function statusBadge(report: Report, monthComplete: boolean, ready: boolean, isPartial: boolean): BadgeInfo {
  if (report.status === 'published' && !isPartial) {
    return { label: 'Published', className: 'bg-brand-accent/20 text-brand-accent' }
  }
  if (isPartial) {
    return { label: 'Needs repair', className: 'bg-amber-400/15 text-amber-300' }
  }
  if (!monthComplete) {
    return { label: 'Internal draft', className: 'bg-brand-muted text-brand-primary' }
  }
  if (ready) {
    return { label: 'Ready to publish', className: 'bg-sky-300/15 text-sky-200' }
  }
  return { label: 'Needs strategy', className: 'bg-amber-400/15 text-amber-300' }
}

function nextActionText(report: Report, monthComplete: boolean, ready: boolean, isPartial: boolean): string {
  if (isPartial) return 'Report period needs fixing. Use repair to match the calendar month.'
  if (report.status === 'published') return 'Published and live for the client. Update any time.'
  if (!monthComplete) return 'Client view unlocks after month-end. Add the CG action plan in the meantime.'
  if (ready) return 'Data synced and strategy complete. Review, then publish for the client.'
  return 'Add the CG action plan using the strategy board, then publish.'
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

  const [clientFilter, setClientFilter] = useState<string>('all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  // report id → data source (derived from meta_content_mappings + posts).
  const [sourceById, setSourceById] = useState<Map<string, ReportSource>>(new Map())

  const clientById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client]))
  }, [clients])

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>()
    for (const report of reports) {
      months.add(getReportMonthFromPeriod(report))
    }
    return [...months].sort((a, b) => b.localeCompare(a))
  }, [reports])

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
      await classifySources(reportsRes.data)
    } catch (error) {
      setError(errorMessage(error, 'Could not load reports.'))
    } finally {
      setLoading(false)
    }
  }

  // Classify each report's data source. A report is "Meta synced" when its posts
  // are linked in meta_content_mappings; "Mixed" when it also has non-Meta
  // (e.g. CSV import) posts; otherwise "Manual / CSV". Lightweight id-only reads.
  async function classifySources(reportRows: Report[]) {
    try {
      const [mapRes, postsRes] = await Promise.all([
        supabase.from('meta_content_mappings').select('report_id, post_id'),
        supabase.from('posts').select('id, report_id'),
      ])

      const metaPostsByReport = new Map<string, Set<string>>()
      for (const m of (mapRes.data ?? []) as { report_id: string | null; post_id: string | null }[]) {
        if (!m.report_id) continue
        const set = metaPostsByReport.get(m.report_id) ?? new Set<string>()
        if (m.post_id) set.add(m.post_id)
        metaPostsByReport.set(m.report_id, set)
      }

      const totalPostsByReport = new Map<string, number>()
      for (const p of (postsRes.data ?? []) as { id: string; report_id: string }[]) {
        totalPostsByReport.set(p.report_id, (totalPostsByReport.get(p.report_id) ?? 0) + 1)
      }

      const next = new Map<string, ReportSource>()
      for (const r of reportRows) {
        const metaCount = metaPostsByReport.get(r.id)?.size ?? 0
        const total = totalPostsByReport.get(r.id) ?? 0
        if (metaCount > 0) {
          next.set(r.id, total > metaCount ? 'mixed' : 'meta')
        } else {
          next.set(r.id, 'manual')
        }
      }
      setSourceById(next)
    } catch {
      // Source classification is best-effort; never block the reports list.
      setSourceById(new Map())
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'internal-draft': 0,
      'ready-to-publish': 0,
      'published': 0,
      'incomplete-month': 0,
      'needs-repair': 0,
    }
    for (const report of reports) {
      const monthComplete = isMonthComplete(getReportMonthFromPeriod(report))
      const ready = monthComplete && report.status !== 'published' && strategyRequiredComplete(readStrategyData(report.strategy_data))
      const isPartial = !isFullCalendarMonth(report.period_start, report.period_end)
      const derived = getDerivedStatus(report, monthComplete, ready, isPartial)
      counts[derived] = (counts[derived] ?? 0) + 1
    }
    return counts
  }, [reports])

  const filteredReports = useMemo(() => {
    let result = [...reports]

    if (clientFilter !== 'all') {
      result = result.filter(r => r.client_id === clientFilter)
    }
    if (monthFilter !== 'all') {
      result = result.filter(r => getReportMonthFromPeriod(r) === monthFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter(r => {
        const monthComplete = isMonthComplete(getReportMonthFromPeriod(r))
        const ready = monthComplete && r.status !== 'published' && strategyRequiredComplete(readStrategyData(r.strategy_data))
        const isPartial = !isFullCalendarMonth(r.period_start, r.period_end)
        return getDerivedStatus(r, monthComplete, ready, isPartial) === statusFilter
      })
    }
    if (sourceFilter !== 'all') {
      result = result.filter(r => (sourceById.get(r.id) ?? 'manual') === sourceFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r => {
        const name = clientNameById.get(r.client_id) ?? ''
        return name.toLowerCase().includes(q) || (r.report_title ?? '').toLowerCase().includes(q)
      })
    }

    result.sort((a, b) => {
      // Prefer Meta synced reports, then mixed, then manual/CSV.
      const aSource = sourceById.get(a.id) ?? 'manual'
      const bSource = sourceById.get(b.id) ?? 'manual'
      const sourceOrder: Record<ReportSource, number> = { meta: 0, mixed: 1, manual: 2 }
      const sourceDiff = sourceOrder[aSource] - sourceOrder[bSource]
      if (sourceDiff !== 0) return sourceDiff
      // Within the same source, newest first.
      const aDate = a.updated_at ?? a.created_at
      const bDate = b.updated_at ?? b.created_at
      return bDate.localeCompare(aDate)
    })

    return result
  }, [reports, clientFilter, monthFilter, statusFilter, sourceFilter, sourceById, searchQuery, clientNameById])

  async function handleStatus(report: Report) {
    const nextStatus = report.status === 'published' ? 'draft' : 'published'
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
      `Delete report for ${clientNameById.get(report.client_id) ?? report.client_id} (${monthLabel(report)})?\n\nThis deletes only the report and its report posts. Imported CSV data will remain available.`
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

  function clearFilters() {
    setClientFilter('all')
    setMonthFilter('all')
    setStatusFilter('all')
    setSourceFilter('all')
    setSearchQuery('')
  }

  const hasActiveFilters = clientFilter !== 'all' || monthFilter !== 'all' || statusFilter !== 'all' || sourceFilter !== 'all' || searchQuery !== ''

  return (
    <div className="w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-brand-primary">Reports</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Report management</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-primary">
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

      {/* ── Filter panel ── */}
      <div className="mb-6 rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1 sm:flex sm:flex-wrap sm:items-end sm:gap-3">
            <FilterGroup label="Client">
              <select
                value={clientFilter}
                onChange={e => setClientFilter(e.target.value)}
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                <option value="all">All clients</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FilterGroup>

            <FilterGroup label="Month">
              <select
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                <option value="all">All months</option>
                {uniqueMonths.map(m => (
                  <option key={m} value={m}>{monthDisplayLabel(m)}</option>
                ))}
              </select>
            </FilterGroup>

            <FilterGroup label="Status">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterGroup>

            <FilterGroup label="Source">
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value as SourceFilter)}
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FilterGroup>

            <div className="min-w-0 sm:w-44">
              <label className="mb-1 block text-xs text-brand-primary">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Client name or title…"
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="shrink-0 rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>

        {!loading && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-primary">
            <span>
              Showing {filteredReports.length} of {reports.length} reports
            </span>
            {statusCounts['internal-draft'] > 0 && (
              <span>Internal drafts: <span className="text-white">{statusCounts['internal-draft']}</span></span>
            )}
            {statusCounts['ready-to-publish'] > 0 && (
              <span>Ready to publish: <span className="text-white">{statusCounts['ready-to-publish']}</span></span>
            )}
            {statusCounts['published'] > 0 && (
              <span>Published: <span className="text-white">{statusCounts['published']}</span></span>
            )}
            {statusCounts['needs-repair'] > 0 && (
              <span>Needs repair: <span className="text-white">{statusCounts['needs-repair']}</span></span>
            )}
          </div>
        )}
      </div>

      {/* ── Report cards ── */}
      {loading ? (
        <p className="text-sm text-brand-primary">Loading reports...</p>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-xl border border-brand-muted bg-brand-surface p-8 text-center text-sm text-brand-primary">
          {hasActiveFilters ? 'No reports match the current filters.' : 'No reports found.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => {
            const client = clientById.get(report.client_id)
            const clientName = clientNameById.get(report.client_id) ?? report.client_id
            const isPartial = !isFullCalendarMonth(report.period_start, report.period_end)
            const monthComplete = isMonthComplete(getReportMonthFromPeriod(report))
            const ready = monthComplete && report.status !== 'published' && strategyRequiredComplete(readStrategyData(report.strategy_data))
            const badge = statusBadge(report, monthComplete, ready, isPartial)
            const nextAction = nextActionText(report, monthComplete, ready, isPartial)
            return (
              <article key={report.id} className="rounded-xl border border-brand-muted bg-brand-surface">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    {client && (
                      <div className="hidden shrink-0 sm:block">
                        <ClientLogo
                          client={client}
                          boxClassName="h-10 w-10 rounded-lg"
                          padding="p-1"
                          textClassName="text-xs font-semibold text-brand-primary"
                        />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-base font-semibold text-white">{clientName}</h2>
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                        {(() => {
                          const src = SOURCE_BADGE[sourceById.get(report.id) ?? 'manual']
                          return (
                            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${src.className}`}>
                              {src.label}
                            </span>
                          )
                        })()}
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-white/80">{monthLabel(report)}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-brand-primary">{nextAction}</p>
                      <p className="mt-0.5 text-xs text-brand-primary/60">
                        Last updated: {formatDateTime(report.updated_at ?? report.created_at)}
                      </p>
                      {isPartial && isAdmin && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[11px] text-amber-300/60 hover:text-amber-300">
                            Admin detail
                          </summary>
                          <p className="mt-1 text-[11px] text-amber-300/50">
                            Stored period is not a full calendar month. Use "Repair to calendar month" to fix.
                          </p>
                        </details>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
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
                        <button
                          type="button"
                          onClick={() => void handleStatus(report)}
                          disabled={busyReportId === report.id || (report.status !== 'published' && !monthComplete)}
                          title={report.status !== 'published' && !monthComplete ? 'Client view is only available for completed months.' : undefined}
                          className="rounded-lg border border-brand-muted px-3 py-2 text-sm text-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 sm:w-44">
      <label className="mb-1 block text-xs text-brand-primary">{label}</label>
      {children}
    </div>
  )
}

function Message({ tone, text }: { tone: 'success' | 'error'; text: string }) {
  const styles = tone === 'success'
    ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/20'
    : 'text-red-400 bg-red-400/10 border-red-400/20'
  return <p className={`mb-4 rounded-lg border px-3 py-2 text-sm ${styles}`}>{text}</p>
}
