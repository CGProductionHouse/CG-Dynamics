import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import {
  PACKAGE_DELIVERABLE_LABELS,
  PACKAGE_DELIVERABLE_TYPES,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  generateMonthFromPackages,
  getMonthlyPackageTotals,
  listClientPackages,
  listMonthlyDeliverablesByMonth,
  monthKey,
  simplifyProductionStatus,
  updateMonthlyDeliverableStatus,
  updateMonthlyDeliverableSchedule,
  type DeliverableType,
  type MonthlyDeliverable,
  type SimplifiedProductionStatus,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

const TYPE_LABELS: Record<DeliverableType, string> = {
  ...PACKAGE_DELIVERABLE_LABELS,
  dp: 'DP',
  photo: 'F',
  video: 'Video',
  reel: 'Reel',
}

const DISPLAY_TYPES: DeliverableType[] = ['dp', 'photo', 'video', 'reel']

const STATUS_TONE: Record<SimplifiedProductionStatus, string> = {
  not_started: 'text-white/50 border-white/10 bg-white/[0.03]',
  in_progress: 'text-brand-accent border-brand-accent/25 bg-brand-accent/[0.07]',
  ready_review: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.07]',
  awaiting_client: 'text-sky-200 border-sky-300/25 bg-sky-300/[0.07]',
  meta_drafts: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
  scheduled_posted: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
}

const STATUS_STAT_TONE: Record<SimplifiedProductionStatus, string> = {
  not_started: 'text-white',
  in_progress: 'text-brand-accent',
  ready_review: 'text-amber-300',
  awaiting_client: 'text-sky-300',
  meta_drafts: 'text-[#2dd4bf]',
  scheduled_posted: 'text-[#2dd4bf]',
}

type DeliverableSource = 'package' | 'client_request' | 'moved' | 'replaced' | 'unlinked'
type SourceFilterValue = 'all' | DeliverableSource | 'unscheduled'
type MonthlyWorkMode = 'all' | 'needs_action' | 'unscheduled' | 'posted_history'

function deliverableSource(d: MonthlyDeliverable): DeliverableSource {
  if (d.moved_from_deliverable_id) return 'moved'
  if (d.replaced_by_request_id) return 'replaced'
  if (d.priority === 'client_request') return 'client_request'
  if (d.package_id || d.template_id) return 'package'
  return 'unlinked'
}

const SOURCE_LABEL: Record<DeliverableSource, string> = {
  package: 'Package',
  client_request: 'Client request',
  moved: 'Moved',
  replaced: 'Replaced',
  unlinked: 'Unlinked',
}

const SOURCE_CHIP_STYLE: Record<DeliverableSource, string> = {
  package: 'border-brand-teal/25 bg-brand-teal/[0.07] text-[#2dd4bf]',
  client_request: 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300',
  moved: 'border-white/10 bg-white/[0.03] text-white/40',
  replaced: 'border-white/10 bg-white/[0.03] text-white/40',
  unlinked: 'border-white/[0.06] bg-white/[0.015] text-white/25',
}

function toMonthStart(key: string) {
  return `${key}-01`
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + amount, 1)
  return monthKey(date)
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
  })
}

function formatMonthHeading(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function displayDateForDeliverable(deliverable: MonthlyDeliverable) {
  return deliverable.scheduled_date ?? deliverable.due_date ?? null
}

const STAFF_STATUSES: SimplifiedProductionStatus[] = ['not_started', 'in_progress', 'ready_review', 'awaiting_client']
const FINAL_STATUSES: SimplifiedProductionStatus[] = ['meta_drafts', 'scheduled_posted']

function isPostedHistory(deliverable: MonthlyDeliverable) {
  return simplifyProductionStatus(deliverable.production_status) === 'scheduled_posted'
}

function needsAction(deliverable: MonthlyDeliverable) {
  return !FINAL_STATUSES.includes(simplifyProductionStatus(deliverable.production_status))
}

export default function MonthlyPlannerPage() {
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isScheduleController = isAdmin
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()))
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [activePackageCount, setActivePackageCount] = useState(0)
  const [clientFilter, setClientFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SimplifiedProductionStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | DeliverableType>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [drawerDeliverable, setDrawerDeliverable] = useState<MonthlyDeliverable | null>(null)
  const [drawerClientName, setDrawerClientName] = useState('')
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'list' : 'calendar'
  ))
  const [workMode, setWorkMode] = useState<MonthlyWorkMode>('all')

  const monthStart = toMonthStart(selectedMonth)

  const clientNameById = useMemo(() => {
    return new Map(clients.map(client => [client.id, client.name]))
  }, [clients])

  // Status counts from all package deliverables this month (unfiltered)
  const statusCounts = useMemo(() => {
    const counts: Record<SimplifiedProductionStatus, number> = {
      not_started: 0, in_progress: 0, ready_review: 0,
      awaiting_client: 0, meta_drafts: 0, scheduled_posted: 0,
    }
    for (const d of deliverables) {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(d.deliverable_type)) continue
      counts[simplifyProductionStatus(d.production_status)]++
    }
    return counts
  }, [deliverables])

  const filteredDeliverables = useMemo(() => {
    const search = clientSearch.trim().toLowerCase()
    return deliverables.filter(deliverable => {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)) return false
      if (workMode === 'needs_action' && !needsAction(deliverable)) return false
      if (workMode === 'unscheduled' && (deliverable.scheduled_date || deliverable.due_date)) return false
      if (workMode === 'posted_history' && !isPostedHistory(deliverable)) return false
      if (statusFilter !== 'all' && simplifyProductionStatus(deliverable.production_status) !== statusFilter) return false
      if (sourceFilter === 'unscheduled' && (deliverable.scheduled_date || deliverable.due_date)) return false
      if (sourceFilter !== 'all' && sourceFilter !== 'unscheduled' && deliverableSource(deliverable) !== sourceFilter) return false
      if (!search) return true
      const clientName = clientNameById.get(deliverable.client_id) ?? 'Unknown client'
      return clientName.toLowerCase().includes(search)
    })
  }, [clientNameById, clientSearch, deliverables, sourceFilter, statusFilter, workMode])

  const plannedDeliverableCount = useMemo(
    () => deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)).length,
    [deliverables],
  )

  const needsActionCount = useMemo(
    () => deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && needsAction(deliverable)).length,
    [deliverables],
  )

  const unscheduledCount = useMemo(
    () => deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && !deliverable.scheduled_date && !deliverable.due_date).length,
    [deliverables],
  )

  const postedHistoryCount = useMemo(
    () => deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && isPostedHistory(deliverable)).length,
    [deliverables],
  )

  const agendaGroups = useMemo(() => {
    const groups = new Map<string, MonthlyDeliverable[]>()
    for (const deliverable of filteredDeliverables) {
      const date = displayDateForDeliverable(deliverable) ?? 'unscheduled'
      const current = groups.get(date) ?? []
      current.push(deliverable)
      groups.set(date, current)
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => {
        if (a === 'unscheduled') return 1
        if (b === 'unscheduled') return -1
        return a.localeCompare(b)
      })
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => {
          const clientCompare = (clientNameById.get(a.client_id) ?? '').localeCompare(clientNameById.get(b.client_id) ?? '')
          if (clientCompare !== 0) return clientCompare
          return a.deliverable_type.localeCompare(b.deliverable_type) || a.code.localeCompare(b.code) || a.instance_number - b.instance_number
        }),
      }))
  }, [clientNameById, filteredDeliverables])

  const overallTotals = useMemo(() => getMonthlyPackageTotals(filteredDeliverables), [filteredDeliverables])

  const sourceCounts = useMemo(() => {
    let pkg = 0, clientReq = 0, movedOrReplaced = 0, unlinked = 0
    for (const d of filteredDeliverables) {
      const src = deliverableSource(d)
      if (src === 'package') pkg++
      else if (src === 'client_request') clientReq++
      else if (src === 'moved' || src === 'replaced') movedOrReplaced++
      else unlinked++
    }
    return { pkg, clientReq, movedOrReplaced, unlinked }
  }, [filteredDeliverables])

  // Group by scheduled_date for calendar view
  const byDate = useMemo(() => {
    const map = new Map<string, MonthlyDeliverable[]>()
    for (const d of filteredDeliverables) {
      const date = displayDateForDeliverable(d)
      if (!date) continue
      const list = map.get(date) ?? []
      list.push(d)
      map.set(date, list)
    }
    return map
  }, [filteredDeliverables])

  const unscheduled = useMemo(
    () => filteredDeliverables.filter(d => !d.scheduled_date && !d.due_date),
    [filteredDeliverables]
  )

  const calendarStats = useMemo(() => ({
    total: filteredDeliverables.length,
    scheduled: filteredDeliverables.filter(d => displayDateForDeliverable(d)).length,
    unscheduled: filteredDeliverables.filter(d => !d.scheduled_date && !d.due_date).length,
    clientRequests: filteredDeliverables.filter(d => deliverableSource(d) === 'client_request').length,
    packageItems: filteredDeliverables.filter(d => deliverableSource(d) === 'package').length,
  }), [filteredDeliverables])

  async function loadData() {
    setLoading(true)
    setTableMissing(false)
    setErrorMessage(null)

    const [clientResult, packageResult, deliverableResult] = await Promise.all([
      listActiveClients(),
      listClientPackages({ status: 'active' }),
      listMonthlyDeliverablesByMonth(monthStart, {
        clientId: clientFilter || undefined,
        deliverableType: typeFilter === 'all' ? undefined : typeFilter,
      }),
    ])

    setLoading(false)

    if (clientResult.error || packageResult.error || deliverableResult.error) {
      const error = clientResult.error ?? packageResult.error ?? deliverableResult.error
      if (error?.message?.includes('does not exist') || error?.code === '42P01') {
        setTableMissing(true)
        return
      }
      setErrorMessage(error?.message ?? 'Could not load monthly planner data.')
      return
    }

    setClients(clientResult.data ?? [])
    const clientId = searchParams.get('client')
    if (clientId && !clientFilter && clientResult.data?.some(client => client.id === clientId)) {
      setClientFilter(clientId)
    }
    setActivePackageCount(packageResult.data?.length ?? 0)
    setDeliverables(deliverableResult.data ?? [])
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, clientFilter, typeFilter])

  useEffect(() => {
    if (!drawerDeliverable) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerDeliverable(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerDeliverable])

  function openDrawer(deliverable: MonthlyDeliverable, clientName: string) {
    setDrawerDeliverable(deliverable)
    setDrawerClientName(clientName)
  }

  async function handleGenerate() {
    if (!isAdmin) return
    setGenerating(true)
    setMessage(null)
    setErrorMessage(null)

    const result = await generateMonthFromPackages(monthStart)
    setGenerating(false)

    if (result.error) {
      setErrorMessage(result.error.message ?? 'Could not generate monthly deliverables.')
      return
    }

    setMessage(`Generated ${result.inserted} deliverables. Skipped ${result.skipped} existing items.`)
    await loadData()
  }

  async function handleStatusChange(id: string, status: SimplifiedProductionStatus) {
    if (!profile) return
    setStatusError(null)
    // TODO: confirm RLS allows staff production-status updates.
    if (FINAL_STATUSES.includes(status) && !isScheduleController) {
      setStatusError('Only admin can set final scheduling statuses.')
      return
    }
    setErrorMessage(null)
    const backendStatus = SIMPLIFIED_TO_BACKEND_STATUS[status]
    const { error } = await updateMonthlyDeliverableStatus(id, backendStatus)
    if (error) {
      setErrorMessage(error.message ?? 'Could not update status.')
      return
    }
    setDeliverables(current => current.map(item => item.id === id ? { ...item, production_status: backendStatus } : item))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, production_status: backendStatus } : prev)
  }

  async function handleScheduleChange(id: string, scheduledDate: string | null) {
    const { error } = await updateMonthlyDeliverableSchedule(id, scheduledDate)
    if (error) {
      setErrorMessage(error.message ?? 'Could not update schedule.')
      return
    }
    setDeliverables(current => current.map(item => item.id === id ? { ...item, scheduled_date: scheduledDate } : item))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, scheduled_date: scheduledDate } : prev)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-white/10" />
        <div className="mb-4 h-10 w-full animate-pulse rounded-lg bg-white/[0.04]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />)}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Monthly Planner</h1>
        <EmptyState title="Planner tables not set up" message="Run the planner migrations." />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Planner</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">
            {formatMonthHeading(selectedMonth)}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            ← Prev
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={event => setSelectedMonth(event.target.value)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50"
          />
          <button
            type="button"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            Next →
          </button>
          {isAdmin && (
            <ActionButton size="sm" variant="outline" onClick={handleGenerate} loading={generating}>
              Generate month
            </ActionButton>
          )}
          <Link
            to="/admin/master-schedule"
            className="rounded-md border border-white/[0.07] px-3 py-2 text-xs font-bold text-brand-primary/50 hover:text-brand-primary"
          >
            Year view
          </Link>
        </div>
      </div>

      {(message || errorMessage) && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${errorMessage ? 'bg-red-400/10 text-red-200' : 'bg-brand-accent/10 text-brand-accent'}`}>
          {errorMessage ?? message}
        </div>
      )}

      {statusError && (
        <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {statusError}
        </div>
      )}

      {/* View mode toggle */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex w-fit items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'calendar'
                ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                : 'text-brand-primary/60 hover:text-brand-primary'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
              viewMode === 'list'
                ? 'bg-white/[0.09] text-white shadow-[0_0_0_1px_rgba(45,212,191,0.35)]'
                : 'text-brand-primary/60 hover:text-brand-primary'
            }`}
          >
            Agenda
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
          {([
            ['all', `All schedule ${plannedDeliverableCount}`],
            ['needs_action', `Needs action ${needsActionCount}`],
            ['unscheduled', `Unscheduled ${unscheduledCount}`],
            ['posted_history', `Posted/history ${postedHistoryCount}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setWorkMode(value)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                workMode === value
                  ? 'bg-brand-accent text-black'
                  : 'text-brand-primary/60 hover:text-brand-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <details className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.14em] text-brand-primary/60 hover:text-brand-primary">
          Filters and totals
        </summary>
        <div className="mt-3 space-y-4">
      {/* Status summary */}
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {SIMPLIFIED_STATUS_OPTIONS.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
              statusFilter === s
                ? `${STATUS_TONE[s]} ring-1 ring-inset ring-white/20`
                : 'border-white/8 bg-white/[0.025] hover:bg-white/[0.04]'
            }`}
          >
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
              {SIMPLIFIED_STATUS_LABELS[s]}
            </p>
            <p className={`mt-1 text-xl font-black ${statusFilter === s ? STATUS_STAT_TONE[s] : 'text-white'}`}>
              {statusCounts[s]}
            </p>
          </button>
        ))}
      </div>

      {/* Stats row — calendar mode shows schedule stats, list mode shows type totals */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Total</p>
            <p className="mt-1 text-lg font-black text-white">{overallTotals.total}</p>
          </div>
          {DISPLAY_TYPES.map(type => (
            <div key={type} className="rounded-lg bg-white/[0.02] px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">{TYPE_LABELS[type]}</p>
              <p className="mt-1 text-lg font-black text-white">
                {overallTotals.byType[type].complete}
                <span className="text-sm font-medium text-white/30">/{overallTotals.byType[type].total}</span>
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Total</p>
            <p className="mt-1 text-lg font-black text-white">{calendarStats.total}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Scheduled</p>
            <p className="mt-1 text-lg font-black text-[#2dd4bf]">{calendarStats.scheduled}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Unscheduled</p>
            <p className="mt-1 text-lg font-black text-amber-400">{calendarStats.unscheduled}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Client req</p>
            <p className="mt-1 text-lg font-black text-brand-accent">{calendarStats.clientRequests}</p>
          </div>
          <div className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">Package</p>
            <p className="mt-1 text-lg font-black text-white">{calendarStats.packageItems}</p>
          </div>
        </div>
      )}

      {/* Package usage summary */}
      {filteredDeliverables.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/30">Package usage</span>
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.package}`}>
              Package {sourceCounts.pkg}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.client_request}`}>
              Client request {sourceCounts.clientReq}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.moved}`}>
              Moved/Replaced {sourceCounts.movedOrReplaced}
            </span>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SOURCE_CHIP_STYLE.unlinked}`}>
              Unlinked {sourceCounts.unlinked}
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 md:grid-cols-5">
        <select
          value={clientFilter}
          onChange={event => setClientFilter(event.target.value)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="">All clients</option>
          {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        <input
          type="search"
          value={clientSearch}
          onChange={event => setClientSearch(event.target.value)}
          placeholder="Search client"
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-accent/50"
        />
        <select
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value as 'all' | SimplifiedProductionStatus)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All statuses</option>
          {SIMPLIFIED_STATUS_OPTIONS.map(status => <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={event => setTypeFilter(event.target.value as 'all' | DeliverableType)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All types</option>
          {PACKAGE_DELIVERABLE_TYPES.map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={event => setSourceFilter(event.target.value as SourceFilterValue)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All sources</option>
          <option value="package">Package</option>
          <option value="client_request">Client request</option>
          <option value="moved">Moved</option>
          <option value="replaced">Replaced</option>
          <option value="unlinked">Unlinked</option>
          <option value="unscheduled">Needs scheduling</option>
        </select>
      </div>
        </div>
      </details>

      {/* Main content: calendar or list */}
      {viewMode === 'calendar' ? (
        filteredDeliverables.length === 0 ? (
          <EmptyState
            title="No deliverables this month."
            message={activePackageCount === 0 ? 'Set up packages in Package Master first.' : isAdmin ? 'Use Generate month to create deliverables.' : ''}
            action={isAdmin ? (
              <ActionButton variant="outline" onClick={handleGenerate} loading={generating}>
                Generate month
              </ActionButton>
            ) : undefined}
            centered={false}
          />
        ) : (
          <CalendarGrid
            monthKey={selectedMonth}
            byDate={byDate}
            unscheduled={unscheduled}
            onOpen={openDrawer}
            clientNameById={clientNameById}
          />
        )
      ) : (
        agendaGroups.length === 0 ? (
          <EmptyState
            title="No deliverables this month."
            message={activePackageCount === 0 ? 'Set up packages in Package Master first.' : isAdmin ? 'Use Generate month to create deliverables.' : ''}
            action={isAdmin ? (
              <ActionButton variant="outline" onClick={handleGenerate} loading={generating}>
                Generate month
              </ActionButton>
            ) : undefined}
            centered={false}
          />
        ) : (
          <div className="space-y-3">
            {agendaGroups.map(group => (
              <section key={group.date} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-white">
                    {group.date === 'unscheduled'
                      ? 'Unscheduled'
                      : new Date(`${group.date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'short' })}
                  </h2>
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-semibold text-white/35">
                    {group.items.length}
                  </span>
                </div>

                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map(deliverable => {
                    const simplified = simplifyProductionStatus(deliverable.production_status)
                    const clientName = clientNameById.get(deliverable.client_id) ?? 'Unknown client'
                    return (
                      <article key={deliverable.id} className="rounded-lg border border-white/8 bg-black/30 p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold text-white">
                                {displayDeliverableCode(deliverable)}
                              </span>
                              <span className="text-[11px] text-white/35">{TYPE_LABELS[deliverable.deliverable_type]}</span>
                              <SourceChip source={deliverableSource(deliverable)} />
                              {deliverable.priority === 'urgent' && (
                                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                                  Urgent
                                </span>
                              )}
                            </div>
                            <button type="button" onClick={() => openDrawer(deliverable, clientName)} className="mt-1 text-left">
                              <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white hover:text-brand-accent transition-colors">
                                {deliverable.title}
                              </h3>
                            </button>
                            <p className="mt-1 text-xs font-semibold text-brand-primary/55">{clientName}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                              {SIMPLIFIED_STATUS_LABELS[simplified]}
                            </span>
                            <button
                              type="button"
                              onClick={() => openDrawer(deliverable, clientName)}
                              className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white/30 hover:text-white hover:border-white/20 transition-colors"
                              title="Open details"
                            >
                              ···
                            </button>
                          </div>
                        </div>

                        <div className="space-y-0.5 text-xs text-white/40">
                          {deliverable.assigned_to_name && (
                            <p>Staff: <span className="text-white/65">{deliverable.assigned_to_name}</span></p>
                          )}
                          {deliverable.due_date && (
                            <p>Due: <span className="text-white/65">{formatDate(deliverable.due_date)}</span></p>
                          )}
                          {deliverable.scheduled_date && (
                            <p>Scheduled: <span className="text-white/65">{formatDate(deliverable.scheduled_date)}</span></p>
                          )}
                        </div>

                        {profile && (
                          FINAL_STATUSES.includes(simplified) && !isScheduleController ? (
                            <div className="mt-3 flex items-center gap-2">
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                                {SIMPLIFIED_STATUS_LABELS[simplified]}
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Final</span>
                            </div>
                          ) : (
                            <select
                              value={simplified}
                              onChange={event => handleStatusChange(deliverable.id, event.target.value as SimplifiedProductionStatus)}
                              className="mt-3 w-full rounded-md border border-white/10 bg-brand-bg px-2 py-1.5 text-xs text-white outline-none focus:border-brand-accent/50"
                            >
                              {(isScheduleController ? SIMPLIFIED_STATUS_OPTIONS : STAFF_STATUSES).map(status => (
                                <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>
                              ))}
                            </select>
                          )
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )
      )}

      {drawerDeliverable && (
        <DeliverableDetailDrawer
          deliverable={drawerDeliverable}
          clientName={drawerClientName}
          isAdmin={isAdmin}
          isScheduleController={isScheduleController}
          onClose={() => setDrawerDeliverable(null)}
          onStatusChange={handleStatusChange}
          onScheduleChange={handleScheduleChange}
        />
      )}
    </div>
  )
}

function displayDeliverableCode(deliverable: MonthlyDeliverable) {
  const instance = String(deliverable.instance_number)
  if (deliverable.code.trim().endsWith(instance)) return deliverable.code
  if (deliverable.deliverable_type === 'video' || deliverable.deliverable_type === 'reel') {
    return `${deliverable.code} ${instance}`
  }
  return `${deliverable.code}${instance}`
}

function SourceChip({ source }: { source: DeliverableSource }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_CHIP_STYLE[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarChip({
  deliverable,
  clientName,
  onOpen,
}: {
  deliverable: MonthlyDeliverable
  clientName: string
  onOpen: (d: MonthlyDeliverable, name: string) => void
}) {
  const source = deliverableSource(deliverable)
  const chipColor =
    source === 'client_request'
      ? 'border-amber-400/25 bg-amber-400/[0.08] text-amber-200 hover:bg-amber-400/[0.14]'
      : source === 'package'
      ? 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#2dd4bf] hover:bg-brand-teal/[0.12]'
      : 'border-white/[0.08] bg-white/[0.03] text-white/50 hover:bg-white/[0.07]'
  return (
    <button
      type="button"
      onClick={() => onOpen(deliverable, clientName)}
      title={`${displayDeliverableCode(deliverable)} — ${clientName}`}
      className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left transition-colors ${chipColor}`}
    >
      <span className="shrink-0 text-[10px] font-bold leading-none">{displayDeliverableCode(deliverable)}</span>
      {clientName && (
        <span className="min-w-0 flex-1 truncate text-[9px] leading-none opacity-60">{clientName}</span>
      )}
    </button>
  )
}

function CalendarGrid({
  monthKey: month,
  byDate,
  unscheduled,
  onOpen,
  clientNameById,
}: {
  monthKey: string
  byDate: Map<string, MonthlyDeliverable[]>
  unscheduled: MonthlyDeliverable[]
  onOpen: (d: MonthlyDeliverable, name: string) => void
  clientNameById: Map<string, string>
}) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, m, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)
  const isCurrentMonth = todayStr.slice(0, 7) === month
  const todayDay = isCurrentMonth ? parseInt(todayStr.slice(8, 10)) : -1

  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, (): null => null),
    ...Array.from({ length: daysInMonth }, (_, i): number => i + 1),
  ]

  // Mobile: only days that have deliverables
  const mobileDays = Array.from({ length: daysInMonth }, (_, i) => i + 1).filter(day => {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`
    return (byDate.get(dateStr) ?? []).length > 0
  })

  return (
    <>
      {/* Desktop: 7-column calendar grid */}
      <div className="hidden sm:block">
        <div className="mb-1 grid grid-cols-7 gap-px">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/25">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[90px] bg-[#0c0c0c]" />
            }
            const dateStr = `${month}-${String(day).padStart(2, '0')}`
            const items = byDate.get(dateStr) ?? []
            const isToday = day === todayDay
            return (
              <div
                key={dateStr}
                className={`min-h-[90px] p-1.5 ${isToday ? 'bg-brand-teal/[0.055]' : 'bg-[#0c0c0c]'}`}
              >
                <span className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold leading-none ${
                  isToday ? 'bg-brand-teal text-black' : 'text-white/30'
                }`}>
                  {day}
                </span>
                <div className="space-y-0.5">
                  {items.slice(0, 4).map(d => (
                    <CalendarChip
                      key={d.id}
                      deliverable={d}
                      clientName={clientNameById.get(d.client_id) ?? ''}
                      onOpen={onOpen}
                    />
                  ))}
                  {items.length > 4 && (
                    <div className="rounded border border-white/[0.06] bg-white/[0.025] px-1 py-0.5 text-[10px] font-semibold text-white/35">
                      +{items.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Mobile: vertical list of days with deliverables */}
      <div className="block sm:hidden space-y-2">
        {mobileDays.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No scheduled deliverables this month.</p>
        ) : (
          mobileDays.map(day => {
            const dateStr = `${month}-${String(day).padStart(2, '0')}`
            const items = byDate.get(dateStr) ?? []
            const isToday = day === todayDay
            const dayLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-ZA', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })
            return (
              <div
                key={dateStr}
                className={`rounded-xl border p-3 ${
                  isToday
                    ? 'border-brand-teal/30 bg-brand-teal/[0.04]'
                    : 'border-white/[0.07] bg-white/[0.02]'
                }`}
              >
                <p className={`mb-2 text-xs font-bold ${isToday ? 'text-brand-teal' : 'text-white/40'}`}>
                  {dayLabel}{isToday ? ' · Today' : ''}
                </p>
                <div className="space-y-1">
                  {items.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => onOpen(d, clientNameById.get(d.client_id) ?? '')}
                      className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
                    >
                      <span className="shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white">
                        {displayDeliverableCode(d)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-white/60">
                        {clientNameById.get(d.client_id) ?? ''}
                      </span>
                      <SourceChip source={deliverableSource(d)} />
                    </button>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Unscheduled section */}
      {unscheduled.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
          <p className="mb-2.5 text-xs font-bold uppercase tracking-[0.12em] text-amber-400/60">
            Unscheduled this month ({unscheduled.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => onOpen(d, clientNameById.get(d.client_id) ?? '')}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <span className="text-[11px] font-bold text-white/70">{displayDeliverableCode(d)}</span>
                <span className="text-[11px] text-white/40">{clientNameById.get(d.client_id) ?? ''}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

const PACKAGE_ACTIONS = [
  { value: 'use_slot', label: 'Use package slot' },
  { value: 'addon', label: 'Mark as add-on' },
  { value: 'move_work', label: 'Move to another month' },
] as const

function DeliverableDetailDrawer({
  deliverable,
  clientName,
  isAdmin,
  isScheduleController,
  onClose,
  onStatusChange,
  onScheduleChange,
}: {
  deliverable: MonthlyDeliverable
  clientName: string
  isAdmin: boolean
  isScheduleController: boolean
  onClose: () => void
  onStatusChange: (id: string, status: SimplifiedProductionStatus) => void
  onScheduleChange: (id: string, date: string | null) => Promise<void>
}) {
  const simplified = simplifyProductionStatus(deliverable.production_status)
  const source = deliverableSource(deliverable)
  const [schedDate, setSchedDate] = useState(deliverable.scheduled_date ?? '')
  const [schedSaving, setSchedSaving] = useState(false)
  const [schedMsg, setSchedMsg] = useState<string | null>(null)

  async function handleScheduleSave() {
    if (schedSaving) return
    setSchedSaving(true)
    setSchedMsg(null)
    await onScheduleChange(deliverable.id, schedDate || null)
    setSchedSaving(false)
    setSchedMsg('Saved')
    setTimeout(() => setSchedMsg(null), 2000)
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {displayDeliverableCode(deliverable)}
              </span>
              <span className="text-[11px] text-white/40">{TYPE_LABELS[deliverable.deliverable_type]}</span>
              <SourceChip source={source} />
              {deliverable.priority === 'urgent' && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">Urgent</span>
              )}
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{deliverable.title}</h2>
            <p className="mt-0.5 text-xs text-white/40">{clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-white/40 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {deliverable.moved_from_deliverable_id && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              Moved from another month
            </div>
          )}
          {deliverable.replaced_by_request_id && (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white/50">
              Replaced by client request
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Status</p>
            {FINAL_STATUSES.includes(simplified) && !isScheduleController ? (
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                  {SIMPLIFIED_STATUS_LABELS[simplified]}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Final</span>
              </div>
            ) : (
              <select
                value={simplified}
                onChange={event => onStatusChange(deliverable.id, event.target.value as SimplifiedProductionStatus)}
                className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                {(isScheduleController ? SIMPLIFIED_STATUS_OPTIONS : STAFF_STATUSES).map(status => (
                  <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-3">
            {deliverable.assigned_to_name && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Staff</p>
                <p className="text-sm text-white/70">{deliverable.assigned_to_name}</p>
              </div>
            )}
            {deliverable.due_date && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Due date</p>
                <p className="text-sm text-white/70">{formatDate(deliverable.due_date)}</p>
              </div>
            )}
            {!isAdmin && deliverable.scheduled_date && (
              <div>
                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled</p>
                <p className="text-sm text-white/70">{formatDate(deliverable.scheduled_date)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p>
            {deliverable.helper_names !== undefined ? (
              deliverable.helper_names.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {deliverable.helper_names.map(name => (
                    <span key={name} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-white/70">
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/40">No helpers yet</p>
              )
            ) : (
              <p className="text-[11px] text-white/30">After migration phase-7b</p>
            )}
          </div>

          {isAdmin && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled date</p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={handleScheduleSave}
                  disabled={schedSaving}
                  className="shrink-0 rounded-lg border border-brand-accent/30 bg-brand-accent/10 px-3 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-accent/20 disabled:opacity-50 transition-colors"
                >
                  {schedSaving ? '…' : 'Save'}
                </button>
              </div>
              {schedMsg && <p className="mt-1 text-[11px] text-brand-accent">{schedMsg}</p>}
            </div>
          )}

          {deliverable.notes && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-white/60">{deliverable.notes}</p>
            </div>
          )}

          {isAdmin && (
            <div className="border-t border-white/[0.06] pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">Package action</p>
              <div className="space-y-0.5">
                {PACKAGE_ACTIONS.map(action => (
                  <button
                    key={action.value}
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white/25"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/15" />
                    {action.label}
                  </button>
                ))}
                <p className="pt-0.5 text-[10px] text-white/20">After migration phase-7a</p>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-4">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Timer</p>
            <div className="flex items-center gap-2">
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Start</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Pause</button>
              <button type="button" disabled className="cursor-not-allowed rounded-md border border-white/[0.08] px-3 py-1.5 text-xs text-white/25">Stop</button>
            </div>
            <p className="mt-1.5 text-[10px] text-white/20">After migration</p>
          </div>
        </div>

        <div className="border-t border-white/[0.08] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
