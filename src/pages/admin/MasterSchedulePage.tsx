import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { EmptyState } from '../../components/ui/States'
import {
  PACKAGE_DELIVERABLE_TYPES,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  listMonthlyDeliverablesByYear,
  simplifyProductionStatus,
  updateMonthlyDeliverableStatus,
  updateMonthlyDeliverableSchedule,
  type DeliverableType,
  type MonthlyDeliverable,
  type SimplifiedProductionStatus,
} from '../../lib/planner'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'

// ── Local types ────────────────────────────────────────────────

type DeliverableSource = 'package' | 'client_request' | 'moved' | 'replaced' | 'unlinked'
type SourceFilterValue = 'all' | 'package' | 'client_request' | 'moved' | 'unlinked'

// ── Local helpers (mirrors MonthlyPlannerPage patterns) ────────

function deliverableSource(d: MonthlyDeliverable): DeliverableSource {
  if (d.moved_from_deliverable_id) return 'moved'
  if (d.replaced_by_request_id) return 'replaced'
  if (d.priority === 'client_request') return 'client_request'
  if (d.package_id || d.template_id) return 'package'
  return 'unlinked'
}

const SOURCE_LABEL: Record<DeliverableSource, string> = {
  package: 'Pkg',
  client_request: 'Client req',
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

const TYPE_LABELS: Record<DeliverableType, string> = {
  dp: 'DP',
  photo: 'F',
  video: 'Video',
  reel: 'Reel',
  content_run: 'Content',
  website_update: 'Web',
  monthly_report: 'Report',
  strategy: 'Strategy',
  admin: 'Admin',
  other: 'Other',
}

const STATUS_TONE: Record<SimplifiedProductionStatus, string> = {
  not_started: 'text-white/50 border-white/10 bg-white/[0.03]',
  in_progress: 'text-brand-accent border-brand-accent/25 bg-brand-accent/[0.07]',
  ready_review: 'text-amber-300 border-amber-400/25 bg-amber-400/[0.07]',
  awaiting_client: 'text-sky-200 border-sky-300/25 bg-sky-300/[0.07]',
  meta_drafts: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
  scheduled_posted: 'text-[#2dd4bf] border-[#2dd4bf]/25 bg-[#2dd4bf]/[0.07]',
}

const STAFF_STATUSES: SimplifiedProductionStatus[] = [
  'not_started', 'in_progress', 'ready_review', 'awaiting_client',
]
const FINAL_STATUSES: SimplifiedProductionStatus[] = ['meta_drafts', 'scheduled_posted']

const SOURCE_FILTER_OPTIONS: Array<{ value: SourceFilterValue; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'package', label: 'Package' },
  { value: 'client_request', label: 'Client request' },
  { value: 'moved', label: 'Moved / Replaced' },
  { value: 'unlinked', label: 'Unlinked' },
]

function displayDeliverableCode(d: MonthlyDeliverable) {
  const instance = String(d.instance_number)
  if (d.code.trim().endsWith(instance)) return d.code
  if (d.deliverable_type === 'video' || d.deliverable_type === 'reel') return `${d.code} ${instance}`
  return `${d.code}${instance}`
}

function formatScheduledDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  const day = String(date.getDate()).padStart(2, '0')
  const weekday = date.toLocaleDateString('en-ZA', { weekday: 'short' })
  return `${day} ${weekday}`
}

function formatMonthLabel(mk: string): string {
  const [year, month] = mk.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function formatMonthShort(mk: string): string {
  const [year, month] = mk.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'short' })
}

// ── Page ───────────────────────────────────────────────────────

export default function MasterSchedulePage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const isScheduleController = isAdmin

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const todayStr = now.toISOString().slice(0, 10)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | SimplifiedProductionStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | DeliverableType>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilterValue>('all')
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [drawerDeliverable, setDrawerDeliverable] = useState<MonthlyDeliverable | null>(null)
  const [drawerClientName, setDrawerClientName] = useState('')
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(
    () => new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  )

  const clientNameById = useMemo(
    () => new Map(clients.map(c => [c.id, c.name])),
    [clients]
  )

  const filteredDeliverables = useMemo(() => {
    const search = clientSearch.trim().toLowerCase()
    return deliverables.filter(d => {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(d.deliverable_type)) return false
      if (clientFilter && d.client_id !== clientFilter) return false
      if (statusFilter !== 'all' && simplifyProductionStatus(d.production_status) !== statusFilter) return false
      if (typeFilter !== 'all' && d.deliverable_type !== typeFilter) return false
      if (sourceFilter !== 'all') {
        const src = deliverableSource(d)
        if (sourceFilter === 'moved') {
          if (src !== 'moved' && src !== 'replaced') return false
        } else if (src !== sourceFilter) {
          return false
        }
      }
      if (search) {
        const name = clientNameById.get(d.client_id) ?? ''
        if (!name.toLowerCase().includes(search)) return false
      }
      return true
    })
  }, [clientFilter, clientNameById, clientSearch, deliverables, sourceFilter, statusFilter, typeFilter])

  // Build 12-month map, sorted within each month (scheduled by date first, then unscheduled)
  const byMonth = useMemo(() => {
    const map = new Map<string, MonthlyDeliverable[]>()
    for (let m = 1; m <= 12; m++) {
      map.set(`${selectedYear}-${String(m).padStart(2, '0')}`, [])
    }
    for (const d of filteredDeliverables) {
      const list = map.get(d.month)
      if (list) list.push(d)
    }
    for (const [, items] of map) {
      items.sort((a, b) => {
        if (a.scheduled_date && b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date)
        if (a.scheduled_date) return -1
        if (b.scheduled_date) return 1
        return a.code.localeCompare(b.code) || a.instance_number - b.instance_number
      })
    }
    return map
  }, [filteredDeliverables, selectedYear])

  const yearStats = useMemo(() => {
    const total = filteredDeliverables.length
    const scheduled = filteredDeliverables.filter(d => d.scheduled_date).length
    const posted = filteredDeliverables.filter(
      d => simplifyProductionStatus(d.production_status) === 'scheduled_posted'
    ).length
    return { total, scheduled, unscheduled: total - scheduled, posted }
  }, [filteredDeliverables])

  async function loadData() {
    setLoading(true)
    setTableMissing(false)
    setErrorMessage(null)

    const [clientResult, deliverableResult] = await Promise.all([
      listActiveClients(),
      listMonthlyDeliverablesByYear(selectedYear, {
        clientId: clientFilter || undefined,
        deliverableType: typeFilter === 'all' ? undefined : typeFilter,
      }),
    ])

    setLoading(false)

    if (clientResult.error || deliverableResult.error) {
      const error = clientResult.error ?? deliverableResult.error
      if (error?.message?.includes('does not exist') || error?.code === '42P01') {
        setTableMissing(true)
        return
      }
      setErrorMessage(error?.message ?? 'Could not load master schedule data.')
      return
    }

    setClients(clientResult.data ?? [])
    setDeliverables(deliverableResult.data ?? [])
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, clientFilter, typeFilter])

  useEffect(() => {
    if (!drawerDeliverable) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setDrawerDeliverable(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerDeliverable])

  function openDrawer(d: MonthlyDeliverable, clientName: string) {
    setDrawerDeliverable(d)
    setDrawerClientName(clientName)
  }

  async function handleStatusChange(id: string, status: SimplifiedProductionStatus) {
    if (FINAL_STATUSES.includes(status) && !isScheduleController) return
    const backendStatus = SIMPLIFIED_TO_BACKEND_STATUS[status]
    const { error } = await updateMonthlyDeliverableStatus(id, backendStatus)
    if (error) { setErrorMessage(error.message ?? 'Could not update status.'); return }
    setDeliverables(curr => curr.map(d => d.id === id ? { ...d, production_status: backendStatus } : d))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, production_status: backendStatus } : prev)
  }

  async function handleScheduleChange(id: string, scheduledDate: string | null): Promise<void> {
    const { error } = await updateMonthlyDeliverableSchedule(id, scheduledDate)
    if (error) { setErrorMessage(error.message ?? 'Could not update schedule.'); return }
    setDeliverables(curr => curr.map(d => d.id === id ? { ...d, scheduled_date: scheduledDate } : d))
    setDrawerDeliverable(prev => prev?.id === id ? { ...prev, scheduled_date: scheduledDate } : prev)
  }

  function toggleMonth(m: number) {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }

  const monthKeys = Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`)

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-8 w-56 animate-pulse rounded bg-white/10" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Master Schedule</h1>
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
            Master Schedule
          </h1>
          <p className="mt-1 text-sm text-brand-primary/55">{selectedYear} · Full year overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedYear(y => y - 1)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            ← {selectedYear - 1}
          </button>
          <span className="min-w-[3.5rem] text-center text-lg font-black text-white">{selectedYear}</span>
          <button
            type="button"
            onClick={() => setSelectedYear(y => y + 1)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white"
          >
            {selectedYear + 1} →
          </button>
          <Link
            to="/admin/monthly-planner"
            className="rounded-md border border-white/[0.07] px-3 py-2 text-xs font-bold text-brand-primary/50 hover:text-brand-primary"
          >
            Monthly view
          </Link>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      {/* Year stats */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Total', value: yearStats.total, color: 'text-white' },
          { label: 'Scheduled', value: yearStats.scheduled, color: 'text-[#2dd4bf]' },
          { label: 'Unscheduled', value: yearStats.unscheduled, color: 'text-amber-400' },
          { label: 'Posted', value: yearStats.posted, color: 'text-[#2dd4bf]' },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg bg-white/[0.02] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-white/30">{stat.label}</p>
            <p className={`mt-1 text-lg font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 grid gap-2 rounded-xl border border-white/8 bg-white/[0.025] p-3 sm:grid-cols-3 lg:grid-cols-5">
        <select
          value={clientFilter}
          onChange={e => setClientFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input
          type="search"
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
          placeholder="Search client"
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-accent/50"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as 'all' | SimplifiedProductionStatus)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All statuses</option>
          {SIMPLIFIED_STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{SIMPLIFIED_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as 'all' | DeliverableType)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          <option value="all">All types</option>
          {PACKAGE_DELIVERABLE_TYPES.map(t => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value as SourceFilterValue)}
          className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50"
        >
          {SOURCE_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Expand / collapse controls */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-white/30">
          {filteredDeliverables.length} deliverable{filteredDeliverables.length !== 1 ? 's' : ''} · {selectedYear}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setExpandedMonths(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))}
            className="text-xs text-white/30 hover:text-white/60"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpandedMonths(new Set())}
            className="text-xs text-white/30 hover:text-white/60"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Year tab strip (desktop quick jump) */}
      <div className="mb-4 hidden gap-1 overflow-x-auto sm:flex">
        {monthKeys.map((mk, idx) => {
          const m = idx + 1
          const count = byMonth.get(mk)?.length ?? 0
          const isCurrent = selectedYear === currentYear && m === currentMonth
          return (
            <button
              key={mk}
              type="button"
              onClick={() => {
                setExpandedMonths(prev => {
                  const next = new Set(prev)
                  next.add(m)
                  return next
                })
                document.getElementById(`month-${mk}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                isCurrent
                  ? 'bg-brand-teal/[0.12] text-brand-teal'
                  : 'text-white/30 hover:bg-white/[0.04] hover:text-white/60'
              }`}
            >
              {formatMonthShort(mk)}
              {count > 0 && (
                <span className="ml-1 text-[9px] opacity-60">{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Month sections */}
      <div className="space-y-2">
        {monthKeys.map((mk, idx) => {
          const m = idx + 1
          const items = byMonth.get(mk) ?? []
          const isCurrentMonth = selectedYear === currentYear && m === currentMonth
          const isExpanded = expandedMonths.has(m)
          return (
            <MonthSection
              key={mk}
              monthKey={mk}
              items={items}
              isExpanded={isExpanded}
              isCurrentMonth={isCurrentMonth}
              todayStr={todayStr}
              clientNameById={clientNameById}
              onToggle={() => toggleMonth(m)}
              onOpen={openDrawer}
            />
          )
        })}
      </div>

      {drawerDeliverable && (
        <MasterScheduleDrawer
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

// ── Sub-components ─────────────────────────────────────────────

function SourceChip({ source }: { source: DeliverableSource }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_CHIP_STYLE[source]}`}>
      {SOURCE_LABEL[source]}
    </span>
  )
}

function MonthSection({
  monthKey,
  items,
  isExpanded,
  isCurrentMonth,
  todayStr,
  clientNameById,
  onToggle,
  onOpen,
}: {
  monthKey: string
  items: MonthlyDeliverable[]
  isExpanded: boolean
  isCurrentMonth: boolean
  todayStr: string
  clientNameById: Map<string, string>
  onToggle: () => void
  onOpen: (d: MonthlyDeliverable, clientName: string) => void
}) {
  const scheduled = items.filter(d => d.scheduled_date).length
  const unscheduled = items.length - scheduled

  return (
    <div
      id={`month-${monthKey}`}
      className={`overflow-hidden rounded-xl border ${
        isCurrentMonth ? 'border-brand-teal/25' : 'border-white/[0.07]'
      } bg-white/[0.025]`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          {isCurrentMonth && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-teal" />
          )}
          <span className="font-bold text-white">{formatMonthLabel(monthKey)}</span>
          {items.length > 0 ? (
            <>
              <span className="text-[11px] text-white/30">{items.length} items</span>
              {scheduled > 0 && (
                <span className="hidden text-[11px] text-[#2dd4bf]/50 sm:inline">
                  {scheduled} scheduled
                </span>
              )}
              {unscheduled > 0 && (
                <span className="hidden text-[11px] text-amber-400/50 sm:inline">
                  {unscheduled} unscheduled
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-white/20">No deliverables</span>
          )}
        </div>
        <span className="text-xs text-white/25">{isExpanded ? '▲' : '▼'}</span>
      </button>

      {isExpanded && (
        <div className="border-t border-white/[0.06]">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-white/20">No deliverables this month.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {items.map(d => (
                <DeliverableRow
                  key={d.id}
                  deliverable={d}
                  clientName={clientNameById.get(d.client_id) ?? ''}
                  todayStr={todayStr}
                  onOpen={onOpen}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeliverableRow({
  deliverable,
  clientName,
  todayStr,
  onOpen,
}: {
  deliverable: MonthlyDeliverable
  clientName: string
  todayStr: string
  onOpen: (d: MonthlyDeliverable, clientName: string) => void
}) {
  const simplified = simplifyProductionStatus(deliverable.production_status)
  const source = deliverableSource(deliverable)
  const isToday = deliverable.scheduled_date === todayStr
  const isUnscheduled = !deliverable.scheduled_date

  return (
    <button
      type="button"
      onClick={() => onOpen(deliverable, clientName)}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.025] sm:gap-3"
    >
      {/* Date */}
      <span
        className={`w-12 shrink-0 text-[11px] font-bold tabular-nums leading-none ${
          isToday ? 'text-brand-teal' : isUnscheduled ? 'text-white/20' : 'text-white/45'
        }`}
      >
        {deliverable.scheduled_date ? formatScheduledDate(deliverable.scheduled_date) : '—'}
      </span>

      {/* Type badge */}
      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-white/60">
        {TYPE_LABELS[deliverable.deliverable_type]}
      </span>

      {/* Code */}
      <span className="shrink-0 text-[11px] font-bold text-white/55">
        {displayDeliverableCode(deliverable)}
      </span>

      {/* Client name */}
      <span className="min-w-0 flex-1 truncate text-sm text-white/65">{clientName}</span>

      {/* Source chip — hidden on small screens */}
      <span className={`hidden shrink-0 sm:inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${SOURCE_CHIP_STYLE[source]}`}>
        {SOURCE_LABEL[source]}
      </span>

      {/* Status chip */}
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
        {SIMPLIFIED_STATUS_LABELS[simplified]}
      </span>
    </button>
  )
}

function MasterScheduleDrawer({
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

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[420px]">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {displayDeliverableCode(deliverable)}
              </span>
              <span className="text-[11px] text-white/40">{TYPE_LABELS[deliverable.deliverable_type]}</span>
              <SourceChip source={source} />
              {deliverable.priority === 'urgent' && (
                <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                  Urgent
                </span>
              )}
            </div>
            <h2 className="text-base font-bold leading-snug text-white">{deliverable.title}</h2>
            <p className="mt-0.5 text-xs text-white/40">{clientName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-white/40 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">

          {/* Status */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Status</p>
            {FINAL_STATUSES.includes(simplified) && !isScheduleController ? (
              <div className="flex items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[simplified]}`}>
                  {SIMPLIFIED_STATUS_LABELS[simplified]}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                  Final — admin only
                </span>
              </div>
            ) : (
              <select
                value={simplified}
                onChange={e => onStatusChange(deliverable.id, e.target.value as SimplifiedProductionStatus)}
                className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
              >
                {(isScheduleController ? SIMPLIFIED_STATUS_OPTIONS : STAFF_STATUSES).map(s => (
                  <option key={s} value={s}>{SIMPLIFIED_STATUS_LABELS[s]}</option>
                ))}
              </select>
            )}
          </div>

          {/* Scheduled date */}
          {isAdmin ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                Scheduled date
              </p>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={schedDate}
                  onChange={e => setSchedDate(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent"
                />
                <button
                  type="button"
                  onClick={handleScheduleSave}
                  disabled={schedSaving}
                  className="shrink-0 rounded-lg border border-brand-accent/30 bg-brand-accent/10 px-3 py-2 text-sm font-semibold text-brand-accent transition-colors hover:bg-brand-accent/20 disabled:opacity-50"
                >
                  {schedSaving ? '…' : 'Save'}
                </button>
              </div>
              {schedMsg && <p className="mt-1 text-[11px] text-brand-accent">{schedMsg}</p>}
            </div>
          ) : deliverable.scheduled_date ? (
            <div>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Scheduled</p>
              <p className="text-sm text-white/70">{deliverable.scheduled_date}</p>
            </div>
          ) : null}

          {/* Staff */}
          {deliverable.assigned_to_name && (
            <div>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Staff</p>
              <p className="text-sm text-white/70">{deliverable.assigned_to_name}</p>
            </div>
          )}

          {/* Due date */}
          {deliverable.due_date && (
            <div>
              <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Due date</p>
              <p className="text-sm text-white/70">{deliverable.due_date}</p>
            </div>
          )}

          {/* Notes */}
          {deliverable.notes && (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-white/60">{deliverable.notes}</p>
            </div>
          )}

          {/* RLS pending notice */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[11px] text-white/25">
            {/* TODO: Final scheduling statuses require RLS migration phase-6f before staff restrictions are enforced at DB level. */}
            Scheduling controls pending DB migration (phase-6f).
          </div>

          {/* Monthly Planner link */}
          <div className="border-t border-white/[0.06] pt-4">
            <Link
              to={`/admin/monthly-planner?client=${deliverable.client_id}`}
              onClick={onClose}
              className="text-sm font-semibold text-[#2dd4bf]/60 transition-colors hover:text-[#2dd4bf]"
            >
              Open in Monthly Planner →
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 transition-colors hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
