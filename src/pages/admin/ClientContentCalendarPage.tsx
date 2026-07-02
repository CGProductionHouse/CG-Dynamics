import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClientPicker } from '../../components/ClientPicker'
import { ClientLogo } from '../../components/ClientLogo'
import { EmptyState } from '../../components/ui/States'
import { listActiveClients, type ClientOption } from '../../lib/commandCentre'
import {
  CLIENT_SAFE_STATUS_LABELS,
  PACKAGE_DELIVERABLE_TYPES,
  getEffectiveScheduleDate,
  listMonthlyDeliverablesByMonth,
  monthKey,
  toClientSafeStatus,
  type ClientSafeStatus,
  type DeliverableType,
  type MonthlyDeliverable,
} from '../../lib/planner'

// Client-ready monthly content calendar.
//
// PRESENTATION LAYER ONLY over monthly_deliverables — the Client Schedule
// remains the operational source of truth and the only place edits happen.
// Everything rendered inside the presentation surface below must stay
// client-safe: no assignees, helpers, internal notes, priorities, codes or
// production noise. Staff controls live in the clearly-marked internal bar,
// which "Preview as client" hides for screen-shares.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Client-facing post type badges. Only package post types (dp/photo/video/
// reel) are shown on this calendar; anything else is filtered out upstream.
const TYPE_BADGES: Partial<Record<DeliverableType, { short: string; label: string; cls: string }>> = {
  dp: { short: 'DP', label: 'Designed poster', cls: 'border-report-sand/35 bg-report-sand/10 text-report-sand' },
  photo: { short: 'PH', label: 'Photo', cls: 'border-report-accent/35 bg-report-accent/10 text-report-accent' },
  video: { short: 'VID', label: 'Video', cls: 'border-[#b3a1d8]/35 bg-[#b3a1d8]/10 text-[#b3a1d8]' },
  reel: { short: 'RL', label: 'Reel', cls: 'border-[#d89a8f]/35 bg-[#d89a8f]/10 text-[#d89a8f]' },
}

const STATUS_DOT: Record<ClientSafeStatus, string> = {
  planned: 'bg-report-faint',
  in_production: 'bg-report-sand',
  for_review: 'bg-[#e9dcc3]',
  awaiting_approval: 'bg-[#9ec3d8]',
  scheduled_posted: 'bg-report-accent',
}

const STATUS_PILL: Record<ClientSafeStatus, string> = {
  planned: 'border-report-line bg-white/[0.03] text-report-muted',
  in_production: 'border-report-sand/30 bg-report-sand/[0.08] text-report-sand',
  for_review: 'border-[#e9dcc3]/30 bg-[#e9dcc3]/[0.08] text-[#e9dcc3]',
  awaiting_approval: 'border-[#9ec3d8]/30 bg-[#9ec3d8]/[0.08] text-[#9ec3d8]',
  scheduled_posted: 'border-report-accent/30 bg-report-accent/[0.08] text-report-accent',
}

const STATUS_ORDER: ClientSafeStatus[] = [
  'planned', 'in_production', 'for_review', 'awaiting_approval', 'scheduled_posted',
]

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

function formatDayHeading(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function ClientContentCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const clientId = searchParams.get('client') ?? ''
  const month = searchParams.get('month')?.slice(0, 7) || monthKey(new Date())
  const [clients, setClients] = useState<ClientOption[]>([])
  const [deliverables, setDeliverables] = useState<MonthlyDeliverable[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const [dayPanel, setDayPanel] = useState<{ date: string; items: MonthlyDeliverable[] } | null>(null)

  function setParam(key: 'client' | 'month', value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set(key, value)
    else params.delete(key)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [clientResult, scheduleResult] = await Promise.all([
        listActiveClients(),
        clientId
          ? listMonthlyDeliverablesByMonth(toMonthStart(month), { clientId })
          : Promise.resolve({ data: [] as MonthlyDeliverable[], error: null }),
      ])
      if (cancelled) return
      setLoading(false)
      if (clientResult.error || scheduleResult.error) {
        setError(clientResult.error?.message ?? scheduleResult.error?.message ?? 'Could not load the content calendar.')
        setDeliverables([])
        return
      }
      setClients(clientResult.data ?? [])
      setDeliverables(scheduleResult.data ?? [])
    }
    void load()
    return () => { cancelled = true }
  }, [clientId, month])

  const client = clients.find(item => item.id === clientId) ?? null

  const items = useMemo(
    () => deliverables.filter(item => PACKAGE_DELIVERABLE_TYPES.includes(item.deliverable_type)),
    [deliverables],
  )

  const byDate = useMemo(() => {
    const map = new Map<string, MonthlyDeliverable[]>()
    for (const item of items) {
      const date = getEffectiveScheduleDate(item)
      if (!date) continue
      if (!map.has(date)) map.set(date, [])
      map.get(date)!.push(item)
    }
    return map
  }, [items])

  const undated = useMemo(() => items.filter(item => !getEffectiveScheduleDate(item)), [items])

  const typeTotals = useMemo(() => {
    const totals = new Map<DeliverableType, number>()
    for (const item of items) totals.set(item.deliverable_type, (totals.get(item.deliverable_type) ?? 0) + 1)
    return PACKAGE_DELIVERABLE_TYPES
      .map(type => ({ type, badge: TYPE_BADGES[type], count: totals.get(type) ?? 0 }))
      .filter(entry => entry.count > 0 && entry.badge)
  }, [items])

  const editLink = `/admin/client-schedule?view=calendar&mode=all${clientId ? `&client=${clientId}` : ''}&month=${month}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
      {presenting ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => setPresenting(false)}
            className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-brand-primary hover:text-white"
          >
            Exit client preview
          </button>
        </div>
      ) : (
        <div className="mb-5">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">Client Intelligence</p>
              <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Content Calendar</h1>
              <p className="mt-1 text-sm text-brand-primary/65">Client-ready view of the month's planned posts · reads the Client Schedule (monthly_deliverables)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setParam('month', shiftMonth(month, -1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Prev</button>
              <button type="button" onClick={() => setParam('month', monthKey(new Date()))} className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">Today</button>
              <input type="month" value={month} onChange={event => setParam('month', event.target.value)} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white outline-none focus:border-brand-accent/50" />
              <button type="button" onClick={() => setParam('month', shiftMonth(month, 1))} className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white">Next</button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-amber-400/25 bg-amber-400/[0.03] p-3">
            <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300/70">Internal controls</span>
            <div className="min-w-[220px] flex-1">
              <ClientPicker value={clientId} label={client?.name ?? ''} onChange={next => setParam('client', next?.id ?? '')} />
            </div>
            <button
              type="button"
              onClick={() => setPresenting(true)}
              disabled={!clientId}
              className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-brand-primary hover:text-white disabled:opacity-40"
            >
              Preview as client
            </button>
            <Link to={editLink} className="rounded-md border border-brand-teal/25 bg-brand-teal/[0.07] px-3 py-2 text-xs font-bold text-[#2dd4bf] hover:text-white">
              Edit in Client Schedule
            </Link>
          </div>
        </div>
      )}

      {error && <div className="mb-3 rounded-lg bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</div>}

      {!clientId ? (
        <EmptyState
          title="Choose a client"
          message="Pick a client in the internal controls above to build their client-ready content calendar for the month."
        />
      ) : loading ? (
        <div className="h-[480px] animate-pulse rounded-2xl border border-report-line bg-report-bg" />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-report-line bg-report-bg shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <div className="border-b border-report-line px-5 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {client && (
                  <ClientLogo
                    client={{ name: client.name }}
                    boxClassName="h-14 w-14 rounded-xl"
                    frameClassName="border border-report-line bg-report-surface"
                    textClassName="text-sm font-semibold text-report-muted"
                  />
                )}
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.26em] text-report-faint">Content calendar</p>
                  <h2 className="mt-1 text-2xl font-semibold text-report-text sm:text-3xl">{client?.name ?? 'Client'}</h2>
                  <p className="mt-0.5 text-sm text-report-muted">{formatMonthHeading(month)}</p>
                </div>
              </div>
              {typeTotals.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {typeTotals.map(entry => (
                    <span key={entry.type} className={`rounded-full border px-3 py-1 text-xs font-semibold ${entry.badge!.cls}`}>
                      {entry.count} {entry.badge!.label}{entry.count === 1 ? '' : 's'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-5 sm:px-8 sm:py-7">
            {items.length === 0 ? (
              <div className="py-14 text-center">
                <h3 className="text-lg font-semibold text-report-text">No posts planned yet</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-report-muted">
                  The {formatMonthHeading(month)} content plan for {client?.name ?? 'this client'} is still being prepared.
                </p>
                {!presenting && (
                  <Link to={editLink} className="mt-5 inline-block rounded-md border border-report-line px-4 py-2 text-xs font-bold text-report-muted hover:text-report-text">
                    Plan this month in Client Schedule
                  </Link>
                )}
              </div>
            ) : (
              <>
                <MonthGrid month={month} byDate={byDate} onOpenDay={setDayPanel} />
                <MobileAgenda byDate={byDate} />

                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-report-line pt-4">
                  {STATUS_ORDER.map(status => (
                    <span key={status} className="flex items-center gap-1.5 text-[11px] text-report-muted">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
                      {CLIENT_SAFE_STATUS_LABELS[status]}
                    </span>
                  ))}
                </div>

                {undated.length > 0 && (
                  <div className="mt-6 rounded-xl border border-report-line bg-report-surface p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-report-text">Being scheduled</h3>
                    <p className="mt-1 text-xs text-report-muted">
                      These posts are part of this month's plan and will be placed on the calendar soon.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {undated.map(item => <PostCard key={item.id} item={item} />)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-report-line px-5 py-4 text-center text-[11px] tracking-wide text-report-faint sm:px-8">
            Prepared by CG Production House · {formatMonthHeading(month)}
          </div>
        </section>
      )}

      {dayPanel && (
        <DayPanel date={dayPanel.date} items={dayPanel.items} onClose={() => setDayPanel(null)} />
      )}
    </div>
  )
}

function TypeBadge({ type }: { type: DeliverableType }) {
  const badge = TYPE_BADGES[type]
  if (!badge) return null
  return (
    <span className={`shrink-0 rounded border px-1 py-0.5 text-[9px] font-black leading-none tracking-wide ${badge.cls}`}>
      {badge.short}
    </span>
  )
}

// Full client-safe card: type, title, status. Never assignees/notes/codes.
function PostCard({ item }: { item: MonthlyDeliverable }) {
  const status = toClientSafeStatus(item.production_status)
  return (
    <div className="rounded-lg border border-report-line bg-report-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <TypeBadge type={item.deliverable_type} />
          <p className="min-w-0 text-sm font-medium leading-snug text-report-text">{item.title}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_PILL[status]}`}>
          {CLIENT_SAFE_STATUS_LABELS[status]}
        </span>
      </div>
    </div>
  )
}

function MonthGrid({ month, byDate, onOpenDay }: {
  month: string
  byDate: Map<string, MonthlyDeliverable[]>
  onOpenDay: (day: { date: string; items: MonthlyDeliverable[] }) => void
}) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1).getDay()
  const daysInMonth = new Date(year, m, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="hidden sm:block">
      <div className="mb-1 grid grid-cols-7 gap-px">
        {DAY_NAMES.map(day => (
          <div key={day} className="py-1 text-center text-[10px] font-bold uppercase tracking-wider text-report-faint">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-report-line bg-report-line">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} className="min-h-[112px] bg-report-bg" />
          const date = `${month}-${String(day).padStart(2, '0')}`
          const dayItems = byDate.get(date) ?? []
          const isToday = date === today
          return (
            <div key={date} className={`min-h-[112px] p-1.5 ${isToday ? 'bg-report-accent/[0.06]' : 'bg-report-surface'}`}>
              <span className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? 'bg-report-accent text-report-bg' : 'text-report-faint'}`}>{day}</span>
              <div className="space-y-1">
                {dayItems.slice(0, 3).map(item => {
                  const status = toClientSafeStatus(item.production_status)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenDay({ date, items: dayItems })}
                      title={`${item.title} · ${CLIENT_SAFE_STATUS_LABELS[status]}`}
                      className="flex w-full items-center gap-1.5 rounded-md border border-report-line bg-report-elevated px-1.5 py-1 text-left transition-colors hover:border-report-accent/40"
                    >
                      <TypeBadge type={item.deliverable_type} />
                      <span className="min-w-0 truncate text-[10px] text-report-text/85">{item.title}</span>
                      <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status]}`} />
                    </button>
                  )
                })}
                {dayItems.length > 3 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay({ date, items: dayItems })}
                    className="w-full rounded-md border border-report-line bg-report-bg px-1.5 py-1 text-left text-[10px] font-semibold text-report-muted hover:text-report-text"
                  >
                    +{dayItems.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mobile: calm agenda list grouped by day instead of a cramped grid.
function MobileAgenda({ byDate }: { byDate: Map<string, MonthlyDeliverable[]> }) {
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  if (days.length === 0) return null
  return (
    <div className="space-y-4 sm:hidden">
      {days.map(([date, dayItems]) => (
        <div key={date}>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-report-faint">{formatDayHeading(date)}</h3>
          <div className="space-y-2">
            {dayItems.map(item => <PostCard key={item.id} item={item} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function DayPanel({ date, items, onClose }: { date: string; items: MonthlyDeliverable[]; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-report-line bg-report-bg sm:w-[420px]">
        <div className="flex items-start justify-between gap-3 border-b border-report-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-report-text">{formatDayHeading(date)}</h2>
            <p className="mt-0.5 text-xs text-report-muted">{items.length} planned post{items.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-report-muted hover:text-report-text">X</button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {items.map(item => <PostCard key={item.id} item={item} />)}
        </div>
      </div>
    </>
  )
}
