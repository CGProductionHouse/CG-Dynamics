import { useEffect, useState } from 'react'
import {
  fetchClientMonthAhead,
  type ClientCalendarEvent,
  type ClientCalendarPost,
  type ClientMonthAhead,
} from '../../lib/clientPortalCalendar'
import { CLIENT_SAFE_STATUS_LABELS, monthKey, type ClientSafeStatus, type DeliverableType } from '../../lib/planner'
import { EVENT_TYPE_LABELS } from '../../lib/companyCalendar'

// Client-safe "month ahead" module for the client portal and Client Preview.
// Renders nothing at all when there is no content to show, so client logins
// never see an empty promise before the phase-11a read-access migration runs.

const TYPE_BADGES: Partial<Record<DeliverableType, { label: string; cls: string }>> = {
  dp: { label: 'DP', cls: 'border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fbbf24]' },
  photo: { label: 'Photo', cls: 'border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf]' },
  video: { label: 'Video', cls: 'border-[#a78bfa]/25 bg-[#a78bfa]/10 text-[#c4b5fd]' },
  reel: { label: 'Reel', cls: 'border-[#fb7185]/25 bg-[#fb7185]/10 text-[#fda4af]' },
}

const STATUS_TONES: Record<ClientSafeStatus, string> = {
  planned: 'border-white/10 bg-white/[0.05] text-slate-400',
  in_production: 'border-[#f59e0b]/25 bg-[#f59e0b]/10 text-[#fbbf24]',
  for_review: 'border-[#fde68a]/25 bg-[#fde68a]/10 text-[#fde68a]',
  awaiting_approval: 'border-[#7dd3fc]/25 bg-[#7dd3fc]/10 text-[#7dd3fc]',
  scheduled_posted: 'border-[#2dd4bf]/25 bg-[#2dd4bf]/10 text-[#2dd4bf]',
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatEventWhen(event: ClientCalendarEvent) {
  const start = new Date(event.startAt)
  const day = start.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' })
  if (event.allDay) return day
  const time = start.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
  return `${day} · ${time}`
}

function monthHeading(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

export function ClientMonthAhead({ clientId }: { clientId: string }) {
  const [data, setData] = useState<ClientMonthAhead | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchClientMonthAhead(clientId, monthKey(new Date())).then(result => {
      if (!cancelled) setData(result)
    })
    return () => { cancelled = true }
  }, [clientId])

  // Nothing loaded (yet), nothing to promise: render nothing.
  if (!data || data.loadFailed) return null
  if (data.posts.length === 0 && data.events.length === 0) return null

  const dated = data.posts.filter(post => post.date)
  const undated = data.posts.filter(post => !post.date)

  return (
    <section className="mt-14">
      <div className="mb-5">
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">The month ahead</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-4xl">
          Your {monthHeading(data.month)} plan with CG
        </h2>
      </div>

      <div className={`grid gap-4 ${data.events.length > 0 && data.posts.length > 0 ? 'lg:grid-cols-[1.25fr_0.75fr]' : ''}`}>
        {data.posts.length > 0 && (
          <article className="rounded-[2rem] border border-white/[0.08] bg-[#071311] p-6 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Content going live</p>
            <ul className="mt-4 divide-y divide-white/[0.06]">
              {dated.map(post => <PostRow key={post.id} post={post} />)}
            </ul>
            {undated.length > 0 && (
              <p className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-slate-400">
                {undated.length} more post{undated.length === 1 ? ' is' : 's are'} in production and will be placed on
                the calendar as dates are confirmed.
              </p>
            )}
          </article>
        )}

        {data.events.length > 0 && (
          <article className="rounded-[2rem] border border-white/[0.08] bg-[linear-gradient(160deg,rgba(249,115,22,0.08),rgba(255,255,255,0.03))] p-6 shadow-[0_35px_90px_-48px_rgba(0,0,0,0.95)] sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#f59e0b]">Shoots & events</p>
            <ul className="mt-4 space-y-3">
              {data.events.map(event => <EventRow key={event.id} event={event} />)}
            </ul>
          </article>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Live view of the CG production schedule — dates update automatically as the plan is refined.
      </p>
    </section>
  )
}

function PostRow({ post }: { post: ClientCalendarPost }) {
  const badge = TYPE_BADGES[post.type]
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
      <span className="w-24 shrink-0 text-sm font-bold text-slate-300">{post.date ? formatDay(post.date) : '—'}</span>
      {badge && (
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-black uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{post.title}</span>
      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-bold ${STATUS_TONES[post.status]}`}>
        {CLIENT_SAFE_STATUS_LABELS[post.status]}
      </span>
    </li>
  )
}

function EventRow({ event }: { event: ClientCalendarEvent }) {
  return (
    <li className="rounded-2xl border border-white/[0.08] bg-[#071311]/80 p-4">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#f59e0b]">
        {EVENT_TYPE_LABELS[event.type]}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-snug text-white">{event.title}</p>
      <p className="mt-1 text-xs text-slate-400">
        {formatEventWhen(event)}
        {event.location ? ` · ${event.location}` : ''}
      </p>
    </li>
  )
}
