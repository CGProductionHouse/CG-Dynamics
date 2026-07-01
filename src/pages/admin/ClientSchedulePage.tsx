import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { ClientPicker } from '../../components/ClientPicker'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import {
  PACKAGE_DELIVERABLE_TYPES,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  listMonthlyDeliverablesByMonth,
  listMonthlyDeliverablesByYear,
  monthKey,
  simplifyProductionStatus,
  updateMonthlyDeliverableCore,
  updateMonthlyDeliverableSchedule,
  updateMonthlyDeliverableStatus,
  type DeliverableType,
  type MonthlyDeliverable,
  type SimplifiedProductionStatus,
} from '../../lib/planner'

type ScheduleView = 'grid' | 'board' | 'calendar' | 'charts' | 'year'
type ScheduleMode = 'needs-action' | 'all' | 'posted-history' | 'unscheduled'

const VIEW_LABELS: Record<ScheduleView, string> = {
  grid: 'Grid',
  board: 'Board',
  calendar: 'Calendar',
  charts: 'Charts',
  year: 'Year / Master',
}

const TYPE_LABELS: Record<DeliverableType, string> = {
  dp: 'DP',
  photo: 'F',
  video: 'Video',
  reel: 'Reel',
  content_run: 'Content',
  website_update: 'Website',
  monthly_report: 'Report',
  strategy: 'Strategy',
  admin: 'Admin',
  other: 'Other',
}

function toMonthStart(key: string) {
  return `${key}-01`
}

function shiftMonth(key: string, amount: number) {
  const [year, month] = key.split('-').map(Number)
  return monthKey(new Date(year, month - 1 + amount, 1))
}

function formatMonthHeading(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function displayCode(deliverable: MonthlyDeliverable) {
  const instance = String(deliverable.instance_number)
  if (deliverable.code.trim().endsWith(instance)) return deliverable.code
  if (deliverable.deliverable_type === 'video' || deliverable.deliverable_type === 'reel') return `${deliverable.code} ${instance}`
  return `${deliverable.code}${instance}`
}

function scheduleDate(deliverable: MonthlyDeliverable) {
  return deliverable.scheduled_date ?? deliverable.due_date ?? null
}

function formatScheduleDate(value: string | null) {
  if (!value) return 'Unscheduled'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
}

function statusTone(status: SimplifiedProductionStatus) {
  if (status === 'scheduled_posted') return 'border-white/10 bg-white/[0.025] text-white/35'
  if (status === 'meta_drafts') return 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#2dd4bf]'
  if (status === 'ready_review') return 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300'
  if (status === 'awaiting_client') return 'border-sky-300/25 bg-sky-300/[0.08] text-sky-200'
  if (status === 'in_progress') return 'border-brand-accent/25 bg-brand-accent/[0.08] text-brand-accent'
  return 'border-white/10 bg-white/[0.035] text-white/65'
}

function matchesMode(deliverable: MonthlyDeliverable, mode: ScheduleMode) {
  const simplified = simplifyProductionStatus(deliverable.production_status)
  if (mode === 'all') return true
  if (mode === 'unscheduled') return !scheduleDate(deliverable)
  if (mode === 'posted-history') return simplified === 'scheduled_posted'
  return simplified !== 'scheduled_posted' && simplified !== 'meta_drafts'
}

export default function ClientSchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as ScheduleView) || 'calendar'
  const mode = (searchParams.get('mode') as ScheduleMode) || 'needs-action'
  const initialMonth = searchParams.get('month')?.slice(0, 7) || monthKey(new Date())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [clientId, setClientId] = useState(searchParams.get('client') ?? '')
  const [typeFilter, setTypeFilter] = useState<'all' | DeliverableType>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | SimplifiedProductionStatus>('all')
  const [search, setSearch] = useState('')
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drawerDeliverable, setDrawerDeliverable] = useState<MonthlyDeliverable | null>(null)
  const [dayDrawer, setDayDrawer] = useState<{ date: string; items: MonthlyDeliverable[] } | null>(null)

  const clientNameById = useMemo(() => new Map(clients.map(client => [client.id, client.name])), [clients])

  function setView(next: ScheduleView) {
    const params = new URLSearchParams(searchParams)
    params.set('view', next)
    setSearchParams(params)
  }

  function setMode(next: ScheduleMode) {
    const params = new URLSearchParams(searchParams)
    params.set('mode', next)
    setSearchParams(params)
  }

  async function load() {
    setLoading(true)
    setError(null)
    const [clientResult, scheduleResult] = await Promise.all([
      listActiveClients(),
      view === 'year'
        ? listMonthlyDeliverablesByYear(selectedYear, {
            clientId: clientId || undefined,
            deliverableType: typeFilter === 'all' ? undefined : typeFilter,
          })
        : listMonthlyDeliverablesByMonth(toMonthStart(selectedMonth), {
            clientId: clientId || undefined,
            deliverableType: typeFilter === 'all' ? undefined : typeFilter,
          }),
    ])
    setLoading(false)
    if (clientResult.error || scheduleResult.error) {
      setError(clientResult.error?.message ?? scheduleResult.error?.message ?? 'Could not load Client Schedule.')
      setDeliverables([])
      return
    }
    setClients(clientResult.data ?? [])
    setDeliverables(scheduleResult.data ?? [])
  }

  useEffect(() => { void load() }, [clientId, selectedMonth, selectedYear, typeFilter, view])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deliverables.filter(deliverable => {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)) return false
      if (!matchesMode(deliverable, mode)) return false
      const simplified = simplifyProductionStatus(deliverable.production_status)
      if (statusFilter !== 'all' && simplified !== statusFilter) return false
      if (q) {
        const clientName = clientNameById.get(deliverable.client_id) ?? ''
        const haystack = `${clientName} ${deliverable.title} ${deliverable.code}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const aDate = scheduleDate(a) ?? '9999-12-31'
      const bDate = scheduleDate(b) ?? '9999-12-31'
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (clientNameById.get(a.client_id) ?? '').localeCompare(clientNameById.get(b.client_id) ?? '') ||
        a.code.localeCompare(b.code) ||
        a.instance_number - b.instance_number
    })
  }, [clientNameById, deliverables, mode, search, statusFilter])

  const counts = useMemo(() => ({
    all: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)).length,
    needsAction: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && matchesMode(deliverable, 'needs-action')).length,
    unscheduled: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && !scheduleDate(deliverable)).length,
    history: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && matchesMode(deliverable, 'posted-history')).length,
  }), [deliverables])

  function saveUpdated(updated: MonthlyDeliverable) {
    setDeliverables(current => current.map(item => item.id === updated.id ? updated : item))
    setDrawerDeliverable(updated)
  }

  const selectedClient = clients.find(client => client.id === clientId) ?? null

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">CG Hub</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Client Schedule</h1>
          <p className="mt-1 text-sm text-brand-primary/65">
            {view === 'year' ? selectedYear : formatMonthHeading(selectedMonth)} · monthly_deliverables
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view === 'year' ? (
            <>
              <button type="button" onClick={() => setSelectedYear(year => year - 1)} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Prev</button>
              <button type="button" onClick={() => setSelectedYear(new Date().getFullYear())} className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">This year</button>
              <button type="button" onClick={() => setSelectedYear(year => year + 1)} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Next</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Prev</button>
              <button type="button" onClick={() => setSelectedMonth(monthKey(new Date()))} className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">Today</button>
              <input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50" />
              <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Next</button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as ScheduleView[]).map(option => (
          <button key={option} type="button" onClick={() => setView(option)} className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${view === option ? 'bg-brand-accent text-black' : 'border border-white/10 text-brand-primary/70 hover:text-white'}`}>
            {VIEW_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <ClientPicker value={clientId} label={selectedClient?.name ?? ''} onChange={client => setClientId(client?.id ?? '')} />
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value as 'all' | DeliverableType)} className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50">
          <option value="all">All post types</option>
          {PACKAGE_DELIVERABLE_TYPES.map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'all' | SimplifiedProductionStatus)} className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-accent/50">
          <option value="all">All statuses</option>
          {SIMPLIFIED_STATUS_OPTIONS.map(status => <option key={status} value={status}>{SIMPLIFIED_STATUS_LABELS[status]}</option>)}
        </select>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search schedule" className="rounded-lg border border-white/10 bg-brand-bg px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-brand-accent/50" />
      </div>

      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-1">
        {([
          ['needs-action', `Needs Action ${counts.needsAction}`],
          ['all', `All Schedule ${counts.all}`],
          ['unscheduled', `Unscheduled ${counts.unscheduled}`],
          ['posted-history', `Posted / History ${counts.history}`],
        ] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${mode === value ? 'bg-brand-accent text-black' : 'text-brand-primary/60 hover:text-brand-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No package posts match" message="Adjust the filters or change the month." centered={false} />
      ) : view === 'grid' ? (
        <GridView items={filtered} clientNameById={clientNameById} onOpen={setDrawerDeliverable} />
      ) : view === 'board' ? (
        <BoardView items={filtered} clientNameById={clientNameById} selectedClientId={clientId} onOpen={setDrawerDeliverable} />
      ) : view === 'charts' ? (
        <ChartsView items={filtered} clientNameById={clientNameById} />
      ) : view === 'year' ? (
        <YearView items={filtered} clientNameById={clientNameById} onOpen={setDrawerDeliverable} />
      ) : (
        <CalendarView month={selectedMonth} items={filtered} clientNameById={clientNameById} onOpen={setDrawerDeliverable} onMore={setDayDrawer} />
      )}

      {drawerDeliverable && (
        <DeliverableDrawer
          deliverable={drawerDeliverable}
          clientName={clientNameById.get(drawerDeliverable.client_id) ?? 'Unknown client'}
          onClose={() => setDrawerDeliverable(null)}
          onSaved={saveUpdated}
        />
      )}
      {dayDrawer && (
        <DayDrawer
          date={dayDrawer.date}
          items={dayDrawer.items}
          clientNameById={clientNameById}
          onClose={() => setDayDrawer(null)}
          onOpen={item => {
            setDayDrawer(null)
            setDrawerDeliverable(item)
          }}
        />
      )}
    </div>
  )
}

function ScheduleCard({ item, clientName, onOpen }: { item: MonthlyDeliverable; clientName: string; onOpen: () => void }) {
  const simplified = simplifyProductionStatus(item.production_status)
  return (
    <button type="button" onClick={onOpen} className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-brand-accent/30 ${simplified === 'scheduled_posted' ? 'border-white/[0.05] bg-white/[0.018] opacity-75' : 'border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.018]'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white">{displayCode(item)}</span>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{item.title}</p>
          <p className="mt-1 text-xs text-brand-primary/60">{clientName}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(simplified)}`}>{SIMPLIFIED_STATUS_LABELS[simplified]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/55">Schedule date: {formatScheduleDate(scheduleDate(item))}</span>
        {item.assigned_to_name && <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/55">{item.assigned_to_name}</span>}
        {(item.helper_names ?? []).map(name => <span key={name} className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[#2dd4bf]">{name}</span>)}
      </div>
    </button>
  )
}

function GridView({ items, clientNameById, onOpen }: { items: MonthlyDeliverable[]; clientNameById: Map<string, string>; onOpen: (item: MonthlyDeliverable) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
      <div className="hidden grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1.2fr_1fr] gap-3 border-b border-white/[0.08] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-primary/55 md:grid">
        <span></span><span>Code / Title</span><span>Client</span><span>Post type</span><span>Schedule date</span><span>Assignee / helpers</span><span>Status</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {items.map(item => {
          const simplified = simplifyProductionStatus(item.production_status)
          return (
            <button key={item.id} type="button" onClick={() => onOpen(item)} className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1.2fr_1fr] md:items-center md:gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${simplified === 'scheduled_posted' ? 'bg-white/25' : 'bg-brand-accent'}`} />
              <span><span className="font-bold text-white">{displayCode(item)}</span><span className="ml-2 text-sm text-white/70">{item.title}</span></span>
              <span className="text-sm text-white/70">{clientNameById.get(item.client_id) ?? 'Unknown'}</span>
              <span className="text-sm text-white/55">{TYPE_LABELS[item.deliverable_type]}</span>
              <span className="text-sm text-white/70">{formatScheduleDate(scheduleDate(item))}</span>
              <span className="text-sm text-white/55">{[item.assigned_to_name, ...(item.helper_names ?? [])].filter(Boolean).join(', ') || 'Unassigned'}</span>
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(simplified)}`}>{SIMPLIFIED_STATUS_LABELS[simplified]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BoardView({ items, clientNameById, selectedClientId, onOpen }: { items: MonthlyDeliverable[]; clientNameById: Map<string, string>; selectedClientId: string; onOpen: (item: MonthlyDeliverable) => void }) {
  if (selectedClientId) {
    return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(item => <ScheduleCard key={item.id} item={item} clientName={clientNameById.get(item.client_id) ?? 'Unknown client'} onOpen={() => onOpen(item)} />)}</div>
  }
  const groups = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    if (!groups.has(item.client_id)) groups.set(item.client_id, [])
    groups.get(item.client_id)!.push(item)
  }
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-3">
        {[...groups.entries()].map(([clientId, groupItems]) => (
          <section key={clientId} className="w-72 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="truncate text-sm font-black text-white">{clientNameById.get(clientId) ?? 'Unknown client'}</h2>
              <span className="rounded-full bg-brand-teal/[0.08] px-2 py-0.5 text-xs font-bold text-[#2dd4bf]">{groupItems.length}</span>
            </div>
            <div className="space-y-2">{groupItems.map(item => <ScheduleCard key={item.id} item={item} clientName={clientNameById.get(item.client_id) ?? 'Unknown'} onOpen={() => onOpen(item)} />)}</div>
          </section>
        ))}
      </div>
    </div>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarView({ month, items, clientNameById, onOpen, onMore }: { month: string; items: MonthlyDeliverable[]; clientNameById: Map<string, string>; onOpen: (item: MonthlyDeliverable) => void; onMore: (day: { date: string; items: MonthlyDeliverable[] }) => void }) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1).getDay()
  const daysInMonth = new Date(year, m, 0).getDate()
  const cells: Array<number | null> = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const byDate = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    const date = scheduleDate(item)
    if (!date) continue
    if (!byDate.has(date)) byDate.set(date, [])
    byDate.get(date)!.push(item)
  }
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div>
      <div className="hidden sm:block">
        <div className="mb-1 grid grid-cols-7 gap-px">{DAY_NAMES.map(day => <div key={day} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white/30">{day}</div>)}</div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.04]">
          {cells.map((day, index) => {
            if (day === null) return <div key={`empty-${index}`} className="min-h-[104px] bg-[#0c0c0c]" />
            const date = `${month}-${String(day).padStart(2, '0')}`
            const dayItems = byDate.get(date) ?? []
            return (
              <div key={date} className={`min-h-[104px] p-1.5 ${date === today ? 'bg-brand-teal/[0.055]' : 'bg-[#0c0c0c]'}`}>
                <span className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${date === today ? 'bg-brand-teal text-black' : 'text-white/35'}`}>{day}</span>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 4).map(item => (
                    <button key={item.id} type="button" onClick={() => onOpen(item)} className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] ${simplifyProductionStatus(item.production_status) === 'scheduled_posted' ? 'border-white/[0.06] bg-white/[0.02] text-white/35' : 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#2dd4bf]'}`}>
                      <span className="font-bold">{displayCode(item)}</span><span className="min-w-0 truncate opacity-70">{clientNameById.get(item.client_id) ?? ''}</span>
                    </button>
                  ))}
                  {dayItems.length > 4 && <button type="button" onClick={() => onMore({ date, items: dayItems })} className="w-full rounded border border-white/[0.06] bg-white/[0.025] px-1 py-0.5 text-left text-[10px] font-semibold text-white/40">+{dayItems.length - 4} more</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="space-y-2 sm:hidden">
        {items.map(item => <ScheduleCard key={item.id} item={item} clientName={clientNameById.get(item.client_id) ?? 'Unknown client'} onOpen={() => onOpen(item)} />)}
      </div>
    </div>
  )
}

function YearView({ items, clientNameById, onOpen }: { items: MonthlyDeliverable[]; clientNameById: Map<string, string>; onOpen: (item: MonthlyDeliverable) => void }) {
  const currentMonth = monthKey(new Date())
  const groups = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    const mk = item.month.slice(0, 7)
    if (!groups.has(mk)) groups.set(mk, [])
    groups.get(mk)!.push(item)
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === currentMonth) return -1
    if (b === currentMonth) return 1
    return a.localeCompare(b)
  })
  return (
    <div className="space-y-3">
      {sorted.map(([mk, groupItems]) => (
        <section key={mk} className={`rounded-xl border p-3 ${mk === currentMonth ? 'border-brand-teal/25 bg-brand-teal/[0.035]' : 'border-white/[0.08] bg-white/[0.025]'}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-white">{formatMonthHeading(mk)}</h2>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-white/45">{groupItems.length}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{groupItems.map(item => <ScheduleCard key={item.id} item={item} clientName={clientNameById.get(item.client_id) ?? 'Unknown client'} onOpen={() => onOpen(item)} />)}</div>
        </section>
      ))}
    </div>
  )
}

function ChartsView({ items, clientNameById }: { items: MonthlyDeliverable[]; clientNameById: Map<string, string> }) {
  const rows = [
    ['By client', countItems(items, item => clientNameById.get(item.client_id) ?? 'Unknown client')],
    ['By post type', countItems(items, item => TYPE_LABELS[item.deliverable_type])],
    ['By status', countItems(items, item => SIMPLIFIED_STATUS_LABELS[simplifyProductionStatus(item.production_status)])],
  ] as const
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {rows.map(([title, data]) => <BarPanel key={title} title={title} rows={data} />)}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
        <h2 className="mb-3 text-sm font-bold text-white">Attention counts</h2>
        <p className="text-3xl font-black text-brand-accent">{items.filter(item => matchesMode(item, 'needs-action')).length}</p>
        <p className="mt-1 text-xs text-brand-primary/60">Needs action</p>
        <p className="mt-4 text-3xl font-black text-amber-300">{items.filter(item => !scheduleDate(item)).length}</p>
        <p className="mt-1 text-xs text-brand-primary/60">Unscheduled</p>
      </div>
    </div>
  )
}

function countItems(items: MonthlyDeliverable[], getLabel: (item: MonthlyDeliverable) => string) {
  const map = new Map<string, number>()
  for (const item of items) map.set(getLabel(item), (map.get(getLabel(item)) ?? 0) + 1)
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count)
}

function BarPanel({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...rows.map(row => row.count))
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
      <h2 className="mb-3 text-sm font-bold text-white">{title}</h2>
      <div className="space-y-2">{rows.map(row => <div key={row.label}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-white/70">{row.label}</span><span className="font-bold text-brand-accent">{row.count}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full bg-brand-teal" style={{ width: `${(row.count / max) * 100}%` }} /></div></div>)}</div>
    </section>
  )
}

function DeliverableDrawer({ deliverable, clientName, onClose, onSaved }: { deliverable: MonthlyDeliverable; clientName: string; onClose: () => void; onSaved: (updated: MonthlyDeliverable) => void }) {
  const [status, setStatus] = useState<SimplifiedProductionStatus>(simplifyProductionStatus(deliverable.production_status))
  const [date, setDate] = useState(scheduleDate(deliverable) ?? '')
  const [assigned, setAssigned] = useState(deliverable.assigned_to_name ?? '')
  const [clientId, setClientId] = useState(deliverable.client_id)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (saving) return
    setSaving(true)
    setError(null)
    let next = deliverable
    const statusResult = await updateMonthlyDeliverableStatus(deliverable.id, SIMPLIFIED_TO_BACKEND_STATUS[status])
    if (statusResult.error) { setError(statusResult.error.message); setSaving(false); return }
    if (statusResult.data) next = statusResult.data
    const scheduleResult = await updateMonthlyDeliverableSchedule(deliverable.id, date || null)
    if (scheduleResult.error) { setError(scheduleResult.error.message); setSaving(false); return }
    if (scheduleResult.data) next = scheduleResult.data
    const coreResult = await updateMonthlyDeliverableCore(deliverable.id, { assigned_to_name: assigned.trim() || null, client_id: clientId })
    if (coreResult.error) { setError(coreResult.error.message); setSaving(false); return }
    if (coreResult.data) next = coreResult.data
    onSaved(next)
    setSaving(false)
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">Package post</p><h2 className="mt-1 text-base font-bold leading-snug text-white">{displayCode(deliverable)} · {deliverable.title}</h2><p className="mt-0.5 text-xs text-brand-primary/60">{clientName}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-primary hover:text-white">X</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div><label className="mb-1.5 block text-xs font-medium text-brand-primary">Client</label><ClientPicker value={clientId} label={clientName} onChange={client => setClientId(client?.id ?? '')} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-brand-primary">Schedule date</label><input type="date" value={date} onChange={event => setDate(event.target.value)} className={inputCls} /></div>
          <div><label className="mb-1.5 block text-xs font-medium text-brand-primary">Status</label><select value={status} onChange={event => setStatus(event.target.value as SimplifiedProductionStatus)} className={inputCls}>{SIMPLIFIED_STATUS_OPTIONS.map(option => <option key={option} value={option}>{SIMPLIFIED_STATUS_LABELS[option]}</option>)}</select></div>
          <div><label className="mb-1.5 block text-xs font-medium text-brand-primary">Assigned to</label><input value={assigned} onChange={event => setAssigned(event.target.value)} className={inputCls} /></div>
          {(deliverable.helper_names ?? []).length > 0 && <div><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/35">Helpers</p><div className="flex flex-wrap gap-1.5">{(deliverable.helper_names ?? []).map(name => <span key={name} className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2.5 py-0.5 text-[11px] text-[#2dd4bf]">{name}</span>)}</div></div>}
        </div>
        <div className="border-t border-white/[0.08] px-5 py-4">
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <div className="flex gap-3"><ActionButton variant="primary" onClick={save} loading={saving}>Save</ActionButton><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-brand-primary hover:text-white">Close</button></div>
        </div>
      </div>
    </>
  )
}

function DayDrawer({ date, items, clientNameById, onClose, onOpen }: { date: string; items: MonthlyDeliverable[]; clientNameById: Map<string, string>; onClose: () => void; onOpen: (item: MonthlyDeliverable) => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[430px]">
        <div className="border-b border-white/[0.08] px-5 py-4"><h2 className="text-base font-bold text-white">{new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p className="text-xs text-brand-primary/60">{items.length} package posts</p></div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">{items.map(item => <ScheduleCard key={item.id} item={item} clientName={clientNameById.get(item.client_id) ?? 'Unknown client'} onOpen={() => onOpen(item)} />)}</div>
      </div>
    </>
  )
}
