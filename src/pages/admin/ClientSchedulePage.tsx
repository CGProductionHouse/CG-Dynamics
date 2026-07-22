import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listGuideIdeasForDeliverables, type ContentGuideIdea } from '../../lib/contentWorkflow'
import { VIDEO_STATUS_LABELS } from '../../lib/videoPipelineRules'
import { ActionButton } from '../../components/ui/Buttons'
import { EmptyState } from '../../components/ui/States'
import { ClientPicker } from '../../components/ClientPicker'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import {
  PACKAGE_DELIVERABLE_TYPES,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  SIMPLIFIED_TO_BACKEND_STATUS,
  isNeedsActionStatus,
  isPostedOrHistoryStatus,
  listMonthlyDeliverablesByMonth,
  listMonthlyDeliverablesByYear,
  matchesScheduleStatusFilter,
  monthKey,
  normalizeScheduleStatus,
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

// Effective display schedule date. During the July 2026 Teams shadow-run the
// real schedule dates for imported package items may still live in due_date, so
// we prefer scheduled_date and fall back to due_date as the legacy Teams import
// date. This is DISPLAY/READ logic only — no data is mutated. The fallback is
// still labelled "Schedule date" in the UI, never "Due date".
function getEffectiveScheduleDate(deliverable: MonthlyDeliverable) {
  return deliverable.scheduled_date ?? deliverable.due_date ?? null
}

// True when a deliverable's date came from the legacy due_date fallback rather
// than a real scheduled_date (used only for an optional shadow-run note).
function usesLegacyScheduleDate(deliverable: MonthlyDeliverable) {
  return !deliverable.scheduled_date && !!deliverable.due_date
}

function scheduleStatusOf(deliverable: MonthlyDeliverable): SimplifiedProductionStatus {
  return normalizeScheduleStatus(deliverable.production_status)
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
  const status = scheduleStatusOf(deliverable)
  if (mode === 'all') return true
  // Unscheduled is defined purely by a MISSING schedule date, never by status.
  if (mode === 'unscheduled') return !getEffectiveScheduleDate(deliverable)
  if (mode === 'posted-history') return isPostedOrHistoryStatus(status)
  return isNeedsActionStatus(status)
}

// ── Display-only client resolution (Priority 4) ───────────────────────────────
// Never mutates data. When client_id has no match we try to infer the client
// from the title/code so obvious cases (e.g. "F1 - BRAIZE") are flagged for
// review instead of silently reading "Unknown".
type ClientState = 'known' | 'inferred' | 'unknown'
interface ClientDisplay {
  label: string
  state: ClientState
}

function resolveClientDisplay(
  deliverable: MonthlyDeliverable,
  clientNameById: Map<string, string>,
  clients: ClientOption[],
): ClientDisplay {
  const known = deliverable.client_id ? clientNameById.get(deliverable.client_id) : undefined
  if (known) return { label: known, state: 'known' }

  const haystack = ` ${`${deliverable.title ?? ''} ${deliverable.code ?? ''}`.toLowerCase()} `
  const wordBoundary = (token: string) => new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(haystack)
  for (const client of clients) {
    const name = client.name.trim()
    if (!name) continue
    const nameLower = name.toLowerCase()
    if (haystack.includes(nameLower)) return { label: `Client match needed: ${name}`, state: 'inferred' }
    // Fall back to whole-word token matches (>= 4 chars) so partial substrings
    // like "cape" inside "landscape" never trigger a false client hint.
    const tokens = nameLower.split(/[^a-z0-9]+/).filter(token => token.length >= 4)
    if (tokens.some(wordBoundary)) {
      return { label: `Client match needed: ${name}`, state: 'inferred' }
    }
  }
  return { label: 'Unknown client', state: 'unknown' }
}

// Board/card display ordering (Priority 6): schedule date, then post category
// order (DP, F, Video, Reel, Other), then item number, then title. Display only
// — it never renames or resequences the underlying data.
const CATEGORY_ORDER: Record<DeliverableType, number> = {
  dp: 0, photo: 1, video: 2, reel: 3,
  content_run: 4, website_update: 5, monthly_report: 6, strategy: 7, admin: 8, other: 9,
}

function compareForBoard(a: MonthlyDeliverable, b: MonthlyDeliverable) {
  const aDate = getEffectiveScheduleDate(a) ?? '9999-12-31'
  const bDate = getEffectiveScheduleDate(b) ?? '9999-12-31'
  if (aDate !== bDate) return aDate.localeCompare(bDate)
  const aCat = CATEGORY_ORDER[a.deliverable_type] ?? 99
  const bCat = CATEGORY_ORDER[b.deliverable_type] ?? 99
  if (aCat !== bCat) return aCat - bCat
  if (a.instance_number !== b.instance_number) return a.instance_number - b.instance_number
  return (a.title ?? '').localeCompare(b.title ?? '')
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
  const clientDisplay = useMemo(
    () => (item: MonthlyDeliverable) => resolveClientDisplay(item, clientNameById, clients),
    [clientNameById, clients],
  )

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
      const status = scheduleStatusOf(deliverable)
      if (!matchesScheduleStatusFilter(status, statusFilter)) return false
      if (q) {
        const clientName = clientDisplay(deliverable).label
        const haystack = `${clientName} ${deliverable.title} ${deliverable.code}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const aDate = getEffectiveScheduleDate(a) ?? '9999-12-31'
      const bDate = getEffectiveScheduleDate(b) ?? '9999-12-31'
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (clientNameById.get(a.client_id) ?? '').localeCompare(clientNameById.get(b.client_id) ?? '') ||
        a.code.localeCompare(b.code) ||
        a.instance_number - b.instance_number
    })
  }, [clientDisplay, clientNameById, deliverables, mode, search, statusFilter])

  const calendarItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return deliverables.filter(deliverable => {
      if (!PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)) return false
      if (!getEffectiveScheduleDate(deliverable)) return false
      const status = scheduleStatusOf(deliverable)
      if (!matchesScheduleStatusFilter(status, statusFilter)) return false
      if (q) {
        const clientName = clientDisplay(deliverable).label
        const haystack = `${clientName} ${deliverable.title} ${deliverable.code}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const aDate = getEffectiveScheduleDate(a) ?? '9999-12-31'
      const bDate = getEffectiveScheduleDate(b) ?? '9999-12-31'
      if (aDate !== bDate) return aDate.localeCompare(bDate)
      return (clientNameById.get(a.client_id) ?? '').localeCompare(clientNameById.get(b.client_id) ?? '') ||
        a.code.localeCompare(b.code) ||
        a.instance_number - b.instance_number
    })
  }, [clientDisplay, clientNameById, deliverables, search, statusFilter])

  const counts = useMemo(() => ({
    all: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type)).length,
    needsAction: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && matchesMode(deliverable, 'needs-action')).length,
    unscheduled: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && !getEffectiveScheduleDate(deliverable)).length,
    history: deliverables.filter(deliverable => PACKAGE_DELIVERABLE_TYPES.includes(deliverable.deliverable_type) && matchesMode(deliverable, 'posted-history')).length,
  }), [deliverables])

  // Shadow-run: some dates are shown from the legacy Teams due_date fallback.
  const hasLegacyDates = useMemo(() => deliverables.some(usesLegacyScheduleDate), [deliverables])

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
        <Link
          to={`/admin/client-calendar?month=${selectedMonth}${clientId ? `&client=${clientId}` : ''}`}
          className="ml-auto rounded-lg border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-black text-[#2dd4bf] transition-colors hover:text-white"
        >
          Client-ready calendar
        </Link>
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

      <p className="mb-1 text-xs text-brand-primary/55">
        {mode === 'unscheduled'
          ? 'Unscheduled means package items with no schedule date and no legacy date. Status (work progress) is separate.'
          : 'Schedule date is when a post is planned. Status is the work progress. A dated post can still be Not started.'}
      </p>
      {hasLegacyDates && (
        <p className="mb-4 text-[11px] text-amber-300/70">
          Some dates are shown from legacy Teams import data during the July shadow-run. They stay labelled as Schedule date until reconciled.
        </p>
      )}
      {!hasLegacyDates && <div className="mb-4" />}

      {error && <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-3">{[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No package posts match" message="Adjust the filters or change the month." centered={false} />
      ) : view === 'grid' ? (
        <StickyHScroll><GridView items={filtered} clientDisplay={clientDisplay} onOpen={setDrawerDeliverable} /></StickyHScroll>
      ) : view === 'board' ? (
        <StickyHScroll><BoardView items={filtered} clientDisplay={clientDisplay} selectedClientId={clientId} onOpen={setDrawerDeliverable} /></StickyHScroll>
      ) : view === 'charts' ? (
        <ChartsView items={filtered} clientDisplay={clientDisplay} />
      ) : view === 'year' ? (
        <YearView items={filtered} clientDisplay={clientDisplay} onOpen={setDrawerDeliverable} />
      ) : (
        <CalendarView month={selectedMonth} items={calendarItems} clientDisplay={clientDisplay} onOpen={setDrawerDeliverable} onMore={setDayDrawer} />
      )}

      {drawerDeliverable && (
        <DeliverableDrawer
          // Key by id so the drawer remounts per deliverable — otherwise the
          // useState initializers keep the previous card's values and a save
          // could write the wrong client_id.
          key={drawerDeliverable.id}
          deliverable={drawerDeliverable}
          clientDisplay={clientDisplay(drawerDeliverable)}
          onClose={() => setDrawerDeliverable(null)}
          onSaved={saveUpdated}
        />
      )}
      {dayDrawer && (
        <DayDrawer
          date={dayDrawer.date}
          items={dayDrawer.items}
          clientDisplay={clientDisplay}
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

// Fixed synthetic horizontal scrollbar (Priority 5). It stays pinned to the
// bottom of the viewport so wide schedule views can be scrolled sideways from
// any vertical scroll position — no need to reach the bottom of the page. It
// only appears when the content actually overflows, and is hidden on small
// screens where native touch-scroll is already usable.
function StickyHScroll({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [scrollWidth, setScrollWidth] = useState(0)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const update = () => {
      setScrollWidth(content.scrollWidth)
      setOverflow(content.scrollWidth - content.clientWidth > 2)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(content)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [children])

  useEffect(() => {
    const content = contentRef.current
    const bar = barRef.current
    if (!content || !bar || !overflow) return
    let syncing = false
    const fromContent = () => {
      if (syncing) return
      syncing = true
      const maxContent = content.scrollWidth - content.clientWidth
      const maxBar = bar.scrollWidth - bar.clientWidth
      if (maxContent > 0) bar.scrollLeft = (content.scrollLeft / maxContent) * maxBar
      syncing = false
    }
    const fromBar = () => {
      if (syncing) return
      syncing = true
      const maxBar = bar.scrollWidth - bar.clientWidth
      const maxContent = content.scrollWidth - content.clientWidth
      if (maxBar > 0) content.scrollLeft = (bar.scrollLeft / maxBar) * maxContent
      syncing = false
    }
    content.addEventListener('scroll', fromContent, { passive: true })
    bar.addEventListener('scroll', fromBar, { passive: true })
    return () => {
      content.removeEventListener('scroll', fromContent)
      bar.removeEventListener('scroll', fromBar)
    }
  }, [overflow])

  return (
    <>
      <div ref={contentRef} className="overflow-x-auto">
        {children}
      </div>
      {overflow && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 hidden px-4 sm:px-6 md:block lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div
              ref={barRef}
              className="scrollbar-always pointer-events-auto h-3.5 overflow-x-auto rounded-full border border-white/15 bg-black/80 shadow-[0_6px_24px_rgba(0,0,0,0.6)] backdrop-blur"
            >
              <div style={{ width: scrollWidth }} className="h-px" />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function ClientLine({ display }: { display: ClientDisplay }) {
  if (display.state === 'known') return <p className="mt-1 text-xs text-brand-primary/60">{display.label}</p>
  return <p className="mt-1 text-xs font-semibold text-amber-300">{display.label}</p>
}

function ScheduleCard({ item, display, onOpen }: { item: MonthlyDeliverable; display: ClientDisplay; onOpen: () => void }) {
  const status = scheduleStatusOf(item)
  const date = getEffectiveScheduleDate(item)
  return (
    <button type="button" onClick={onOpen} className={`w-full rounded-lg border p-3 text-left transition-colors hover:border-brand-accent/30 ${status === 'scheduled_posted' ? 'border-white/[0.05] bg-white/[0.018] opacity-75' : 'border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.018]'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[11px] font-bold text-white">{displayCode(item)}</span>
          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{item.title}</p>
          <ClientLine display={display} />
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(status)}`}>{SIMPLIFIED_STATUS_LABELS[status]}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${date ? 'border-white/10 bg-white/[0.03] text-white/55' : 'border-amber-400/25 bg-amber-400/[0.07] text-amber-300'}`}>
          {date ? `Schedule date: ${formatScheduleDate(date)}` : 'Unscheduled'}
        </span>
        {item.assigned_to_name && <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-semibold text-white/55">{item.assigned_to_name}</span>}
        {(item.helper_names ?? []).map(name => <span key={name} className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2 py-0.5 text-[10px] font-semibold text-[#2dd4bf]">{name}</span>)}
      </div>
    </button>
  )
}

function GridView({ items, clientDisplay, onOpen }: { items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay; onOpen: (item: MonthlyDeliverable) => void }) {
  return (
    <div className="min-w-[860px] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025] md:min-w-0">
      <div className="hidden grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1.2fr_1fr] gap-3 border-b border-white/[0.08] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-brand-primary/55 md:grid">
        <span></span><span>Code / Title</span><span>Client</span><span>Post type</span><span>Schedule date</span><span>Assignee / helpers</span><span>Status</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {items.map(item => {
          const status = scheduleStatusOf(item)
          const display = clientDisplay(item)
          const date = getEffectiveScheduleDate(item)
          return (
            <button key={item.id} type="button" onClick={() => onOpen(item)} className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] md:grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1.2fr_1fr] md:items-center md:gap-3">
              <span className={`h-2.5 w-2.5 rounded-full ${status === 'scheduled_posted' ? 'bg-white/25' : 'bg-brand-accent'}`} />
              <span><span className="font-bold text-white">{displayCode(item)}</span><span className="ml-2 text-sm text-white/70">{item.title}</span></span>
              <span className={`text-sm ${display.state === 'known' ? 'text-white/70' : 'font-semibold text-amber-300'}`}>{display.label}</span>
              <span className="text-sm text-white/55">{TYPE_LABELS[item.deliverable_type]}</span>
              <span className={`text-sm ${date ? 'text-white/70' : 'text-amber-300'}`}>{formatScheduleDate(date)}</span>
              <span className="text-sm text-white/55">{[item.assigned_to_name, ...(item.helper_names ?? [])].filter(Boolean).join(', ') || 'Unassigned'}</span>
              <span className={`w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusTone(status)}`}>{SIMPLIFIED_STATUS_LABELS[status]}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BoardView({ items, clientDisplay, selectedClientId, onOpen }: { items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay; selectedClientId: string; onOpen: (item: MonthlyDeliverable) => void }) {
  if (selectedClientId) {
    const ordered = [...items].sort(compareForBoard)
    return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{ordered.map(item => <ScheduleCard key={item.id} item={item} display={clientDisplay(item)} onOpen={() => onOpen(item)} />)}</div>
  }
  const groups = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    if (!groups.has(item.client_id)) groups.set(item.client_id, [])
    groups.get(item.client_id)!.push(item)
  }
  return (
    <div className="flex min-w-max gap-3 pb-4">
      {[...groups.entries()].map(([clientId, groupItems]) => {
        const ordered = [...groupItems].sort(compareForBoard)
        const header = clientDisplay(ordered[0])
        return (
          <section key={clientId} className="w-72 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className={`truncate text-sm font-black ${header.state === 'known' ? 'text-white' : 'text-amber-300'}`}>{header.label}</h2>
              <span className="rounded-full bg-brand-teal/[0.08] px-2 py-0.5 text-xs font-bold text-[#2dd4bf]">{groupItems.length}</span>
            </div>
            <div className="space-y-2">{ordered.map(item => <ScheduleCard key={item.id} item={item} display={clientDisplay(item)} onOpen={() => onOpen(item)} />)}</div>
          </section>
        )
      })}
    </div>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function CalendarView({ month, items, clientDisplay, onOpen, onMore }: { month: string; items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay; onOpen: (item: MonthlyDeliverable) => void; onMore: (day: { date: string; items: MonthlyDeliverable[] }) => void }) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1).getDay()
  const daysInMonth = new Date(year, m, 0).getDate()
  const cells: Array<number | null> = [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)]
  const byDate = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    const date = getEffectiveScheduleDate(item)
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
                    <button key={item.id} type="button" onClick={() => onOpen(item)} className={`flex w-full items-center gap-1 rounded border px-1 py-0.5 text-left text-[10px] ${scheduleStatusOf(item) === 'scheduled_posted' ? 'border-white/[0.06] bg-white/[0.02] text-white/35' : 'border-brand-teal/20 bg-brand-teal/[0.06] text-[#2dd4bf]'}`}>
                      <span className="font-bold">{displayCode(item)}</span><span className="min-w-0 truncate opacity-70">{clientDisplay(item).label}</span>
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
        {items.map(item => <ScheduleCard key={item.id} item={item} display={clientDisplay(item)} onOpen={() => onOpen(item)} />)}
      </div>
    </div>
  )
}

function YearView({ items, clientDisplay, onOpen }: { items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay; onOpen: (item: MonthlyDeliverable) => void }) {
  const currentMonth = monthKey(new Date())
  const groups = new Map<string, MonthlyDeliverable[]>()
  for (const item of items) {
    const mk = item.month.slice(0, 7)
    if (!groups.has(mk)) groups.set(mk, [])
    groups.get(mk)!.push(item)
  }
  // Current month first (Priority 7 — never dump January as the main context).
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
            <h2 className="text-base font-black text-white">
              {formatMonthHeading(mk)}
              {mk === currentMonth && <span className="ml-2 rounded-full bg-brand-teal/[0.12] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2dd4bf]">This month</span>}
            </h2>
            <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs font-bold text-white/45">{groupItems.length}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{[...groupItems].sort(compareForBoard).map(item => <ScheduleCard key={item.id} item={item} display={clientDisplay(item)} onOpen={() => onOpen(item)} />)}</div>
        </section>
      ))}
    </div>
  )
}

function ChartsView({ items, clientDisplay }: { items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay }) {
  const rows = [
    ['By client', countItems(items, item => clientDisplay(item).label)],
    ['By post type', countItems(items, item => TYPE_LABELS[item.deliverable_type])],
    ['By status', countItems(items, item => SIMPLIFIED_STATUS_LABELS[scheduleStatusOf(item)])],
  ] as const
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {rows.map(([title, data]) => <BarPanel key={title} title={title} rows={data} />)}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
        <h2 className="mb-3 text-sm font-bold text-white">Attention counts</h2>
        <p className="text-3xl font-black text-brand-accent">{items.filter(item => matchesMode(item, 'needs-action')).length}</p>
        <p className="mt-1 text-xs text-brand-primary/60">Needs action</p>
        <p className="mt-4 text-3xl font-black text-amber-300">{items.filter(item => !getEffectiveScheduleDate(item)).length}</p>
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

function DeliverableDrawer({ deliverable, clientDisplay, onClose, onSaved }: { deliverable: MonthlyDeliverable; clientDisplay: ClientDisplay; onClose: () => void; onSaved: (updated: MonthlyDeliverable) => void }) {
  const [status, setStatus] = useState<SimplifiedProductionStatus>(normalizeScheduleStatus(deliverable.production_status))
  const [date, setDate] = useState(getEffectiveScheduleDate(deliverable) ?? '')
  const [assigned, setAssigned] = useState(deliverable.assigned_to_name ?? '')
  // Only a real, currently-linked client_id seeds the picker — an inferred
  // "Client match needed" hint is display-only and never pre-fills the field.
  const [clientId, setClientId] = useState<string | null>(
    clientDisplay.state === 'known' ? deliverable.client_id : null,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Best-effort read-only link to the Content Workflow video for this
  // deliverable. Never mutates the schedule; silent if phase-19d/19e is absent.
  const [linkedVideo, setLinkedVideo] = useState<ContentGuideIdea | null>(null)
  const loadLinkedVideo = useEffectEvent(async () => {
    const result = await listGuideIdeasForDeliverables([deliverable.id])
    if (result.error || result.migrationNeeded) { setLinkedVideo(null); return }
    setLinkedVideo(result.data.find(video => video.status !== 'archived') ?? null)
  })
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadLinkedVideo() }, 0)
    return () => window.clearTimeout(timer)
  }, [deliverable.id])

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
    // Explicit client link/unlink — '' is coerced to null so we never send an
    // invalid UUID. This is the only place client_id is written, and only on an
    // explicit user save.
    const coreResult = await updateMonthlyDeliverableCore(deliverable.id, {
      assigned_to_name: assigned.trim() || null,
      client_id: clientId || null,
    })
    if (coreResult.error) { setError(coreResult.error.message); setSaving(false); return }
    if (coreResult.data) next = coreResult.data
    onSaved(next)
    setSaving(false)
    onClose()
  }

  const inputCls = 'w-full rounded-lg border border-white/10 bg-[#111111] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-accent'
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[460px]">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">Package post</p><h2 className="mt-1 text-base font-bold leading-snug text-white">{displayCode(deliverable)} · {deliverable.title}</h2><p className={`mt-0.5 text-xs ${clientDisplay.state === 'known' ? 'text-brand-primary/60' : 'text-amber-300'}`}>{clientDisplay.label}</p></div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-brand-primary hover:text-white">X</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {linkedVideo && (
            <div className="rounded-lg border border-brand-teal/20 bg-brand-teal/[0.05] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-teal/80">Linked video</p>
                <Link to="/admin/content-workflow" className="text-[11px] font-bold text-brand-teal hover:text-white">Open in Content Workflow</Link>
              </div>
              {linkedVideo.canonical_name && <p className="mt-1.5 break-all font-mono text-[11px] text-white/60">{linkedVideo.canonical_name}</p>}
              <p className="mt-1 text-sm font-bold text-white">{linkedVideo.title}</p>
              <p className="mt-1 text-[11px] text-white/50">Production: {VIDEO_STATUS_LABELS[linkedVideo.production_status]}</p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-brand-primary">Client</label>
            <ClientPicker value={clientId} label={clientDisplay.state === 'known' ? clientDisplay.label : ''} onChange={client => setClientId(client?.id ?? null)} />
            {clientDisplay.state !== 'known' && (
              <p className="mt-1.5 text-[11px] text-amber-300/80">
                Not linked to a client yet{clientDisplay.state === 'inferred' ? ` — ${clientDisplay.label}` : ''}. Select the real client and Save to link it.
              </p>
            )}
          </div>
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

function DayDrawer({ date, items, clientDisplay, onClose, onOpen }: { date: string; items: MonthlyDeliverable[]; clientDisplay: (item: MonthlyDeliverable) => ClientDisplay; onClose: () => void; onOpen: (item: MonthlyDeliverable) => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-white/[0.08] bg-[#111111] sm:w-[430px]">
        <div className="border-b border-white/[0.08] px-5 py-4"><h2 className="text-base font-bold text-white">{new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })}</h2><p className="text-xs text-brand-primary/60">{items.length} package posts</p></div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">{[...items].sort(compareForBoard).map(item => <ScheduleCard key={item.id} item={item} display={clientDisplay(item)} onOpen={() => onOpen(item)} />)}</div>
      </div>
    </>
  )
}
