import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { updateTaskStatus } from '../../lib/commandCentre'
import { updatePlannerTask } from '../../lib/planner'
import { updateMonthlyDeliverableStatus } from '../../lib/planner'
import {
  getMyDayContext,
  myDayDateLabel,
  sourceAccent,
  sourceLabel,
  type MyDayContext,
  type MyDayItem,
  type MyDayTimelineBlock,
} from '../../lib/workforceMyDay'

function itemTone(item: MyDayItem, today: string) {
  if (item.date && item.date < today) return 'border-red-400/20 bg-red-400/[0.04]'
  if (item.priority === 'client_request') return 'border-brand-accent/20 bg-brand-accent/[0.04]'
  if (item.priority === 'urgent') return 'border-red-400/20 bg-red-400/[0.04]'
  if (item.source === 'calendar_event') return 'border-sky-300/15 bg-sky-300/[0.035]'
  return 'border-white/10 bg-white/[0.035]'
}

export default function MyDayPage() {
  const { profile } = useAuth()
  const [context, setContext] = useState<MyDayContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setMessage(null)
    try {
      const next = await getMyDayContext(profile)
      setContext(next)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load My Day.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [profile?.id])

  const focusItems = useMemo(() => {
    if (!context) return []
    return [...context.overdue, ...context.dueToday].slice(0, 8)
  }, [context])

  async function startItem(item: MyDayItem) {
    setBusyId(item.id)
    setMessage(null)
    try {
      if (item.source === 'planner_task') {
        await updateTaskStatus(item.id, 'in_progress')
      } else if (item.source === 'client_deliverable' && item.deliverableId) {
        await updateMonthlyDeliverableStatus(item.deliverableId, 'in_progress')
      }
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update this item.')
    } finally {
      setBusyId(null)
    }
  }

  async function sendToReview(item: MyDayItem) {
    setBusyId(item.id)
    setMessage(null)
    try {
      if (item.nativePlannerId) {
        await updatePlannerTask(item.nativePlannerId, { status: 'ready_internal_review' })
      } else if (item.source === 'client_deliverable' && item.deliverableId) {
        await updateMonthlyDeliverableStatus(item.deliverableId, 'ready_internal_review')
      }
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not send this item to review.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-teal">Workforce</p>
            <h1 className="mt-2 font-display text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-6xl">
              My Day
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-brand-primary/72">
              A focused daily view built from assigned Planner tasks, CG Calendar events and Client Schedule work.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary/55">
              {context?.todayLabel ?? 'Today'}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">
              {context?.userName ?? profile?.email ?? 'Staff member'}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
          {message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(item => (
            <div key={item} className="h-36 animate-pulse rounded-2xl border border-white/8 bg-white/[0.035]" />
          ))}
        </div>
      ) : !context ? (
        <EmptyPanel title="My Day could not load" text="Refresh the page or ask admin to check your profile." />
      ) : (
        <>
          <Diagnostics context={context} />

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Focus now" value={focusItems.length} />
            <Metric label="Overdue" value={context.overdue.length} danger={context.overdue.length > 0} />
            <Metric label="Today" value={context.dueToday.length} />
            <Metric label="Planned hours" value={Math.round(context.summary.plannedMinutes / 60)} />
          </div>

          <PlanSummary context={context} />

          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="space-y-5">
              <WorkSection
                title="Focus now"
                subtitle="Overdue and due today, sorted by operational priority."
                items={focusItems}
                context={context}
                busyId={busyId}
                onStart={startItem}
                onReview={sendToReview}
              />
              <WorkSection
                title="Upcoming active work"
                subtitle="Assigned work coming up this week."
                items={context.upcoming.slice(0, 12)}
                context={context}
                busyId={busyId}
                onStart={startItem}
                onReview={sendToReview}
              />
            </section>

            <section className="space-y-5">
              <TimelineSection context={context} />
              <SourceSummary context={context} />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Diagnostics({ context }: { context: MyDayContext }) {
  const notes: string[] = []
  if (context.diagnostics.profileNameMissing) notes.push('Add a full name to your profile so assigned work can match you.')
  if (context.diagnostics.companyEventsMissing) notes.push('CG Calendar events table is not available yet.')
  notes.push(...context.diagnostics.errors)

  if (notes.length === 0) return null

  return (
    <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100">
      <p className="font-semibold">Setup notes</p>
      <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
        {notes.map(note => <li key={note}>{note}</li>)}
      </ul>
    </div>
  )
}

function PlanSummary({ context }: { context: MyDayContext }) {
  const { currentTask, nextTask, suggestedNextAction, workloadWarning, plannedMinutes, availableMinutes } = context.summary
  const plannedLabel = `${Math.round(plannedMinutes / 60)}h planned of ${Math.round(availableMinutes / 60)}h`

  return (
    <section className="mb-6 rounded-2xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_36%),rgba(255,255,255,0.035)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Recommended flow</p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-white">
            {currentTask ? currentTask.title : 'No assigned focus work due now'}
          </h2>
          <p className="mt-2 text-sm text-brand-primary/65">{suggestedNextAction}</p>
          {workloadWarning && (
            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-xs font-semibold text-amber-100">
              {workloadWarning}
            </p>
          )}
        </div>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:w-[26rem]">
          <PlanMiniCard label="Current" item={currentTask} context={context} />
          <PlanMiniCard label="Next" item={nextTask} context={context} />
          <div className="rounded-xl border border-white/10 bg-black/20 p-3 sm:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary/45">Capacity</p>
            <p className="mt-1 text-sm font-semibold text-white">{plannedLabel}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function PlanMiniCard({ label, item, context }: { label: string; item: MyDayItem | null; context: MyDayContext }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary/45">{label}</p>
      {item ? (
        <>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
          <p className="mt-1 text-xs text-brand-primary/50">
            {sourceLabel(item.source)} · {myDayDateLabel(item, context.today)}
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm text-brand-primary/45">Nothing assigned</p>
      )}
    </div>
  )
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-primary/45">{label}</p>
      <p className={`mt-2 text-3xl font-black ${danger ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

function WorkSection({
  title,
  subtitle,
  items,
  context,
  busyId,
  onStart,
  onReview,
}: {
  title: string
  subtitle: string
  items: MyDayItem[]
  context: MyDayContext
  busyId: string | null
  onStart: (item: MyDayItem) => void
  onReview: (item: MyDayItem) => void
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-brand-surface/80 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">{title}</h2>
          <p className="text-sm text-brand-primary/60">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-brand-primary/45">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.length === 0 ? (
        <EmptyPanel title="Clear for now" text="No assigned active work in this section." compact />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <WorkItemCard
              key={item.id}
              item={item}
              context={context}
              busy={busyId === item.id}
              onStart={onStart}
              onReview={onReview}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function WorkItemCard({
  item,
  context,
  busy,
  onStart,
  onReview,
}: {
  item: MyDayItem
  context: MyDayContext
  busy: boolean
  onStart: (item: MyDayItem) => void
  onReview: (item: MyDayItem) => void
}) {
  const canStart = item.source === 'planner_task' || item.source === 'client_deliverable'
  const canReview = Boolean(item.nativePlannerId) || item.source === 'client_deliverable'

  return (
    <article className={`rounded-2xl border p-4 ${itemTone(item, context.today)}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${sourceAccent(item.source)}`}>
              {sourceLabel(item.source)}
            </span>
            <span className="text-xs font-semibold text-brand-primary/55">{myDayDateLabel(item, context.today)}</span>
            {item.timeLabel && <span className="text-xs font-semibold text-brand-primary/55">{item.timeLabel}</span>}
          </div>
          <h3 className="text-base font-semibold text-white">{item.title}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold">
            {item.clientName && <span className="rounded-full border border-brand-teal/20 bg-brand-teal/[0.06] px-2 py-0.5 text-[#2dd4bf]">{item.clientName}</span>}
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-brand-primary/70">{item.statusLabel}</span>
            {item.assignedTo && <span className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-0.5 text-brand-primary/55">{item.assignedTo}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canStart && (
            <button
              type="button"
              onClick={() => onStart(item)}
              disabled={busy}
              className="rounded-lg border border-brand-teal/30 bg-brand-teal/[0.08] px-3 py-2 text-xs font-bold text-[#2dd4bf] transition hover:border-brand-teal/60 hover:text-white disabled:opacity-50"
            >
              Start
            </button>
          )}
          {canReview && (
            <button
              type="button"
              onClick={() => onReview(item)}
              disabled={busy}
              className="rounded-lg border border-amber-300/25 bg-amber-300/[0.08] px-3 py-2 text-xs font-bold text-amber-200 transition hover:border-amber-300/60 hover:text-white disabled:opacity-50"
            >
              Ready for review
            </button>
          )}
          <Link
            to={item.href}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-brand-primary transition hover:text-white"
          >
            Open
          </Link>
        </div>
      </div>
    </article>
  )
}

function TimelineSection({ context }: { context: MyDayContext }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-brand-surface/80 p-4 sm:p-5">
      <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">Workday plan</h2>
      <p className="mt-1 text-sm text-brand-primary/60">08:00 to 17:00, anchored by CG Calendar events.</p>
      {context.timelineBlocks.length === 0 ? (
        <EmptyPanel title="No dated items today" text="Use the open time for upcoming assigned work." compact />
      ) : (
        <div className="mt-4 space-y-3">
          {context.timelineBlocks.map(block => <TimelineBlock key={block.id} block={block} />)}
        </div>
      )}
    </section>
  )
}

function TimelineBlock({ block }: { block: MyDayTimelineBlock }) {
  const tone = block.kind === 'fixed'
    ? 'border-sky-300/20 bg-sky-300/[0.055]'
    : block.kind === 'overload'
      ? 'border-amber-300/25 bg-amber-300/[0.065]'
      : block.kind === 'focus'
        ? 'border-brand-teal/20 bg-brand-teal/[0.05]'
        : 'border-white/8 bg-white/[0.025]'
  const content = (
    <>
      <span className="w-24 shrink-0 text-xs font-black text-brand-teal">
        {block.startLabel}
        <span className="block text-[10px] font-semibold text-brand-primary/35">{block.endLabel}</span>
      </span>
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${block.kind === 'buffer' ? 'text-brand-primary/55' : 'text-white'}`}>
          {block.label}
        </p>
        <p className="text-xs text-brand-primary/55">
          {block.sourceLabel}{block.item?.clientName ? ` · ${block.item.clientName}` : ''}
        </p>
      </div>
    </>
  )

  if (!block.href) {
    return <div className={`flex gap-3 rounded-xl border p-3 ${tone}`}>{content}</div>
  }

  return (
    <Link to={block.href} className={`flex gap-3 rounded-xl border p-3 hover:border-white/20 ${tone}`}>
      {content}
    </Link>
  )
}

function SourceSummary({ context }: { context: MyDayContext }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-brand-surface/80 p-4 sm:p-5">
      <h2 className="font-display text-2xl font-black uppercase tracking-wide text-white">Connected work</h2>
      <div className="mt-4 grid gap-3">
        <SourceRow label="Planner tasks" value={context.tasks.length} to="/admin/planner" />
        <SourceRow label="CG Calendar events" value={context.events.length} to="/admin/cg-calendar" />
        <SourceRow label="Client Schedule work" value={context.deliverables.length} to="/admin/client-schedule?view=calendar" />
      </div>
      <p className="mt-4 text-xs text-brand-primary/45">
        My Day only shows real connected data. If a module has no dated or assigned items, it stays quiet.
      </p>
    </section>
  )
}

function SourceRow({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 hover:border-brand-teal/25">
      <span className="text-sm font-semibold text-white">{label}</span>
      <span className="text-sm font-black text-brand-teal">{value}</span>
    </Link>
  )
}

function EmptyPanel({ title, text, compact }: { title: string; text: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-white/[0.025] text-center ${compact ? 'p-4' : 'p-8'}`}>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-sm text-brand-primary/55">{text}</p>
    </div>
  )
}
