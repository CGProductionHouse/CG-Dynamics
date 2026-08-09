import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchClientMonthAhead,
  type ClientCalendarEvent,
  type ClientCalendarPost,
  type ClientMonthAhead,
} from '../../lib/clientPortalCalendar'
import { EVENT_TYPE_LABELS } from '../../lib/companyCalendar'
import { getClient, type Client } from '../../lib/db/clients'
import { CLIENT_SAFE_STATUS_LABELS, PACKAGE_DELIVERABLE_LABELS } from '../../lib/planner'
import { monthDisplayLabel } from '../../lib/reportPeriod'
import { CALENDAR_HEADERS, monthGridCells, todayIso } from '../../lib/scheduleCalendar'

const MONTH_PATTERN = /^\d{4}-\d{2}$/

function currentMonth(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, amount: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + amount, 1))
  return shifted.toISOString().slice(0, 7)
}

function localDateKey(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function ClientContentCalendarPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedMonth = searchParams.get('month')
  const month = requestedMonth && MONTH_PATTERN.test(requestedMonth) ? requestedMonth : currentMonth()
  const [client, setClient] = useState<Client | null>(null)
  const [calendar, setCalendar] = useState<ClientMonthAhead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      if (!profile?.client_id) {
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const [clientResult, calendarResult] = await Promise.all([
          getClient(profile.client_id),
          fetchClientMonthAhead(profile.client_id, month),
        ])
        if (!active) return
        setClient(clientResult.data)
        setCalendar(calendarResult)
      } catch {
        if (!active) return
        setCalendar({ month, posts: [], events: [], loadFailed: true })
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [month, profile?.client_id])

  function changeMonth(next: string) {
    setSearchParams({ month: next })
  }

  const scheduledPosts = calendar?.posts.filter(post => post.date) ?? []
  const unscheduledPosts = calendar?.posts.filter(post => !post.date) ?? []

  return (
    <ClientPortalShell client={client}>
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-report-accent">Content planning</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-5xl">Content Calendar</h1>
          <p className="mt-4 text-base leading-7 text-report-muted">
            Upcoming deliverables and client-facing schedule details for {monthDisplayLabel(month)}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => changeMonth(shiftMonth(month, -1))}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-report-muted transition hover:border-report-accent/35 hover:text-white"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => changeMonth(shiftMonth(month, 1))}
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-report-muted transition hover:border-report-accent/35 hover:text-white"
          >
            Next
          </button>
        </div>
      </section>

      {loading ? (
        <CalendarMessage message="Loading your content calendar..." />
      ) : calendar?.loadFailed ? (
        <CalendarMessage
          tone="error"
          message="Content calendar could not be loaded right now."
        />
      ) : calendar && (calendar.posts.length > 0 || calendar.events.length > 0) ? (
        <>
          <CalendarSummary calendar={calendar} scheduledCount={scheduledPosts.length} />
          <div className="mt-6 hidden lg:block">
            <MonthGrid month={month} posts={scheduledPosts} events={calendar.events} />
          </div>
          <div className="mt-6 lg:hidden">
            <Agenda month={month} posts={scheduledPosts} events={calendar.events} />
          </div>
          {unscheduledPosts.length > 0 && <Unscheduled posts={unscheduledPosts} />}
        </>
      ) : (
        <CalendarMessage message={`No client-facing schedule items are available for ${monthDisplayLabel(month)} yet.`} />
      )}

      <p className="mt-8 max-w-3xl text-xs leading-5 text-report-faint">
        Schedule details reflect the client-visible plan currently available in CG Dynamics and may be refined as production progresses.
      </p>
    </ClientPortalShell>
  )
}

function CalendarSummary({ calendar, scheduledCount }: { calendar: ClientMonthAhead; scheduledCount: number }) {
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    calendar.posts.forEach(post => {
      const label = PACKAGE_DELIVERABLE_LABELS[post.type] ?? post.type
      counts.set(label, (counts.get(label) ?? 0) + 1)
    })
    return [...counts.entries()]
  }, [calendar.posts])

  return (
    <section className="mt-8 grid gap-3 sm:grid-cols-3">
      <SummaryCard label="Visible items" value={String(calendar.posts.length)} />
      <SummaryCard label="Scheduled" value={String(scheduledCount)} />
      <SummaryCard label="Client events" value={String(calendar.events.length)} />
      {typeCounts.length > 0 && (
        <div className="sm:col-span-3 flex flex-wrap gap-2 pt-1">
          {typeCounts.map(([label, count]) => (
            <span key={label} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-report-muted">
              {label}: {count}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

function MonthGrid({
  month,
  posts,
  events,
}: {
  month: string
  posts: ClientCalendarPost[]
  events: ClientCalendarEvent[]
}) {
  const cells = monthGridCells(month)
  const today = todayIso()

  return (
    <section className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/20">
      <div className="grid grid-cols-7 border-b border-white/[0.08] bg-white/[0.025]">
        {CALENDAR_HEADERS.map(day => (
          <div key={day} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-report-faint">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map(cell => {
          const dayPosts = posts.filter(post => post.date === cell.iso)
          const dayEvents = events.filter(event => localDateKey(event.startAt) === cell.iso)
          const isToday = cell.iso === today
          return (
            <div
              key={cell.iso}
              className={`min-h-36 border-b border-r border-white/[0.06] p-2 ${
                cell.outside ? 'bg-black/20 opacity-45' : isToday ? 'bg-white/[0.04]' : 'bg-white/[0.012]'
              }`}
            >
              <p className={`px-1 text-xs font-medium ${isToday ? 'text-report-accent' : 'text-report-faint'}`}>{cell.day}</p>
              <div className="mt-2 space-y-1.5">
                {dayPosts.map(post => <PostChip key={post.id} post={post} />)}
                {dayEvents.map(event => <EventChip key={event.id} event={event} />)}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Agenda({
  month,
  posts,
  events,
}: {
  month: string
  posts: ClientCalendarPost[]
  events: ClientCalendarEvent[]
}) {
const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const cells = monthGridCells(month)
  const today = todayIso()

  // Default to today when it is in the visible month, otherwise the first cell.
  const day = selectedDay ?? (cells.some(cell => cell.iso === today) ? today : (cells[0]?.iso ?? null))
  const dayPosts = posts.filter(post => post.date === day)
  const dayEvents = events.filter(event => localDateKey(event.startAt) === day)

  return (
    <section className="lg:hidden">
      <div className="grid grid-cols-7 gap-1">
        {CALENDAR_HEADERS.map(dayName => (
          <div key={dayName} className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-report-faint">{dayName}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map(cell => {
          const count = posts.filter(post => post.date === cell.iso).length + events.filter(event => localDateKey(event.startAt) === cell.iso).length
          const isToday = cell.iso === today
          const isSelected = cell.iso === day
          return (
            <button
              key={cell.iso}
              type="button"
              aria-label={`${cell.iso}${count > 0 ? `, ${count} item(s)` : ''}`}
              onClick={() => setSelectedDay(cell.iso)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
                isSelected
                  ? 'border-report-accent bg-report-accent/20 text-white'
                  : isToday
                    ? 'border-report-accent/50 bg-report-accent/[0.06] text-white'
                    : cell.outside
                      ? 'border-transparent text-report-faint/60'
                      : 'border-white/10 bg-white/[0.03] text-report-muted'
              }`}
            >
              <span>{cell.day}</span>
              {count > 0 && <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-report-accent' : 'bg-report-accent/70'}`} />}
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-white/[0.08] pt-3">
        <p className="text-sm font-semibold text-white">
          {new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`))}
        </p>
        <div className="mt-3 space-y-2">
          {dayPosts.map(post => <PostChip key={post.id} post={post} />)}
          {dayEvents.map(event => <EventChip key={event.id} event={event} />)}
          {dayPosts.length === 0 && dayEvents.length === 0 && (
            <p className="py-2 text-sm text-report-faint">Nothing scheduled on this day.</p>
          )}
        </div>
      </div>
    </section>
  )
}

function Unscheduled({ posts }: { posts: ClientCalendarPost[] }) {
  return (
    <section className="mt-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-report-faint">Date being finalised</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => <PostChip key={post.id} post={post} />)}
      </div>
    </section>
  )
}

function PostChip({ post }: { post: ClientCalendarPost }) {
  return (
    <div className="rounded-md border border-report-accent/15 bg-report-accent/[0.07] px-2.5 py-2">
      <p className="line-clamp-2 text-xs font-medium leading-4 text-white">{post.title}</p>
      <p className="mt-1 text-[0.68rem] leading-4 text-report-muted">
        {PACKAGE_DELIVERABLE_LABELS[post.type] ?? post.type} / {CLIENT_SAFE_STATUS_LABELS[post.status] ?? post.status}
      </p>
    </div>
  )
}

function EventChip({ event }: { event: ClientCalendarEvent }) {
  const content = (
    <>
      <p className="line-clamp-2 text-xs font-medium leading-4 text-white">{event.title}</p>
      <p className="mt-1 text-[0.68rem] leading-4 text-report-muted">
        {EVENT_TYPE_LABELS[event.type] ?? event.type}{event.location ? ` / ${event.location}` : ''}
      </p>
      {event.guidelineKey && (
        <p className="mt-1.5 text-[0.68rem] font-semibold text-report-accent">Open filming guideline</p>
      )}
    </>
  )
  const className = "block rounded-md border border-[#c17a49]/20 bg-[#c17a49]/[0.07] px-2.5 py-2 text-left transition hover:border-report-accent/35"
  return event.guidelineKey ? (
    <Link
      className={className}
      to={`/client/content-guides?month=${localDateKey(event.startAt).slice(0, 7)}&guide=${encodeURIComponent(event.guidelineKey)}`}
      aria-label={`Open Content Guideline for ${event.title}`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-4">
      <p className="text-xs text-report-faint">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function CalendarMessage({ message, tone = 'normal' }: { message: string; tone?: 'normal' | 'error' }) {
  return (
    <div className={`mt-8 rounded-lg border px-5 py-6 text-sm ${
      tone === 'error'
        ? 'border-[#d8a07a]/20 bg-[#d8a07a]/[0.06] text-[#d8a07a]'
        : 'border-white/[0.08] bg-white/[0.03] text-report-muted'
    }`}>
      {message}
    </div>
  )
}
