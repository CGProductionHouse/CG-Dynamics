import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
import { ActionButton } from '../../components/ui/Buttons'
import { StatusBadge, SourceBadge, type SourceVariant } from '../../components/ui/Badges'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { EmptyState } from '../../components/ui/States'
import WorkflowGuide from '../../components/WorkflowGuide'
import { supabase } from '../../lib/supabase'

type StatusFilter = 'all' | 'internal-draft' | 'ready-to-publish' | 'published' | 'incomplete-month' | 'needs-repair'
type ReportSource = 'meta' | 'manual' | 'mixed'
type SourceFilter = 'all' | ReportSource

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'All sources' },
  { value: 'meta', label: 'Meta synced' },
  { value: 'manual', label: 'Manual fallback' },
  { value: 'mixed', label: 'Mixed source' },
]

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

function getStatusVariant(report: Report, monthComplete: boolean, ready: boolean, isPartial: boolean): 'published' | 'ready-to-publish' | 'needs-strategy' | 'internal-draft' | 'incomplete-month' | 'needs-repair' {
  if (report.status === 'published' && !isPartial) return 'published'
  if (isPartial) return 'needs-repair'
  if (!monthComplete) return 'incomplete-month'
  if (ready) return 'ready-to-publish'
  return 'needs-strategy'
}

function getStatusLabel(report: Report, monthComplete: boolean, ready: boolean, isPartial: boolean): string {
  if (report.status === 'published' && !isPartial) return 'Published'
  if (isPartial) return 'Needs repair'
  if (!monthComplete) return 'Internal draft'
  if (ready) return 'Ready to publish'
  return 'Needs strategy'
}

function getSourceVariant(report: Report, sourceById: Map<string, ReportSource>): SourceVariant {
  const src = sourceById.get(report.id) ?? 'manual'
  return src as SourceVariant
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
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [clients, setClients] = useState<Client[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [busyReportId, setBusyReportId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Deep link from the Clients page: ?client=<id> pre-filters to that client.
  const [clientFilter, setClientFilter] = useState<string>(() => searchParams.get('client') ?? 'all')
  const [monthFilter, setMonthFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
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
      const aSource = sourceById.get(a.id) ?? 'manual'
      const bSource = sourceById.get(b.id) ?? 'manual'
      const sourceOrder: Record<ReportSource, number> = { meta: 0, mixed: 1, manual: 2 }
      const sourceDiff = sourceOrder[aSource] - sourceOrder[bSource]
      if (sourceDiff !== 0) return sourceDiff
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
      `Period will be set to ${start} to ${end} (full calendar month).\n` +
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
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-brand-primary">Reports</p>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">Report management</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-primary">
            Sync data, review performance, add CG strategy, then publish.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <ActionButton
              variant="outline"
              onClick={() => navigate('/admin/integrations/meta')}
            >
              Sync Meta data
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={() => navigate('/admin/reports/new')}
            >
              New report
            </ActionButton>
          </div>
        )}
      </div>

      <WorkflowGuide />

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-brand-accent/20 bg-brand-accent/10 px-3 py-2 text-sm text-brand-accent">
          {success}
        </div>
      )}

      {/* Filter panel */}
      <PremiumCard padding="md" className="mb-6">
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
                placeholder="Client name or title..."
                className="w-full rounded-lg border border-brand-muted bg-brand-bg px-3 py-2 text-sm text-white placeholder-brand-primary/50 focus:outline-none focus:ring-1 focus:ring-brand-accent"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <ActionButton variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </ActionButton>
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
      </PremiumCard>

      {/* Report cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-muted border-t-brand-accent" />
          <p className="text-sm text-brand-primary">Loading reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <EmptyState
          title={hasActiveFilters ? 'No matching reports' : 'No reports found'}
          message={hasActiveFilters ? 'No reports match the current filters.' : 'Sync Meta data to create your first monthly report.'}
          action={
            isAdmin ? (
              <ActionButton variant="outline" onClick={() => navigate('/admin/integrations/meta')}>
                Sync Meta data
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => {
            const client = clientById.get(report.client_id)
            const clientName = clientNameById.get(report.client_id) ?? report.client_id
            const isPartial = !isFullCalendarMonth(report.period_start, report.period_end)
            const monthComplete = isMonthComplete(getReportMonthFromPeriod(report))
            const ready = monthComplete && report.status !== 'published' && strategyRequiredComplete(readStrategyData(report.strategy_data))
            const actionText = nextActionText(report, monthComplete, ready, isPartial)
            const statusVariant = getStatusVariant(report, monthComplete, ready, isPartial)
            const statusLabel = getStatusLabel(report, monthComplete, ready, isPartial)
            const sourceVariant = getSourceVariant(report, sourceById)

            return (
              <PremiumCard key={report.id} hover>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: client info + badges + action text */}
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
                        <StatusBadge label={statusLabel} variant={statusVariant} />
                        <SourceBadge source={sourceVariant} />
                      </div>
                      <p className="mt-0.5 text-sm font-medium text-white/80">{monthLabel(report)}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-brand-primary">{actionText}</p>
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

                  {/* Right: action buttons */}
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                    >
                      {ready || report.status === 'published' ? 'Review report' : 'Edit strategy'}
                    </ActionButton>
                    {!ready && report.status !== 'published' && (
                      <ActionButton
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/reports/${report.id}/edit`)}
                      >
                        Add CG action plan
                      </ActionButton>
                    )}
                    {monthComplete && (
                      <ActionButton
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/admin/published?reportId=${report.id}`)}
                      >
                        Preview
                      </ActionButton>
                    )}
                    {isAdmin && (
                      <>
                        {ready && (
                          <ActionButton
                            variant="primary"
                            size="sm"
                            onClick={() => void handleStatus(report)}
                            disabled={busyReportId === report.id}
                          >
                            Publish
                          </ActionButton>
                        )}
                        {report.status === 'published' && (
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleStatus(report)}
                            disabled={busyReportId === report.id}
                          >
                            Unpublish
                          </ActionButton>
                        )}
                        {isPartial && (
                          <ActionButton
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRepair(report)}
                            disabled={busyReportId === report.id}
                          >
                            Repair to calendar month
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="danger"
                          size="sm"
                          onClick={() => void handleDelete(report)}
                          disabled={busyReportId === report.id}
                        >
                          Delete
                        </ActionButton>
                      </>
                    )}
                  </div>
                </div>
              </PremiumCard>
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
