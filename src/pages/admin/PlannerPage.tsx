import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui/States'
import { useAuth } from '../../contexts/AuthContext'
import {
  listPlannerBoards,
  listPlannerBuckets,
  SIMPLIFIED_STATUS_LABELS,
  SIMPLIFIED_STATUS_OPTIONS,
  type PlannerBoard,
  type PlannerBucket,
} from '../../lib/planner'

const BOARD_LABELS: Record<string, string> = {
  'operations-todo': 'Operations',
  'client-websites': 'Websites',
  'admin-check-list': 'Admin',
  'client-schedule': 'Client Schedule Board',
  'cg-socials': 'CG Socials',
}

const BOARD_ICONS: Record<string, ReactNode> = {
  'operations-todo': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192" />
    </svg>
  ),
  'client-websites': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  ),
  'admin-check-list': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  'client-schedule': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  'cg-socials': (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const STATUS_TONES: Record<string, string> = {
  not_started: 'text-white/50 border-white/10',
  in_progress: 'text-brand-accent border-brand-accent/25',
  ready_review: 'text-amber-300 border-amber-400/25',
  awaiting_client: 'text-sky-300 border-sky-300/25',
  meta_drafts: 'text-[#2dd4bf] border-[#2dd4bf]/25',
  scheduled_posted: 'text-[#2dd4bf] border-[#2dd4bf]/25',
}

export default function PlannerPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [boards, setBoards] = useState<PlannerBoard[]>([])
  const [buckets, setBuckets] = useState<PlannerBucket[]>([])
  const [activeBoard, setActiveBoard] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setTableMissing(false)

    listPlannerBoards().then(({ data, error }) => {
      if (!active) return
      setLoading(false)
      if (error) {
        if (error.message?.includes('does not exist') || error.code === '42P01') {
          setTableMissing(true)
          return
        }
        return
      }
      const result = data ?? []
      setBoards(result)
      if (result.length > 0 && !activeBoard) {
        setActiveBoard(result[0].slug)
      }
    })

    return () => { active = false }
  }, [activeBoard])

  useEffect(() => {
    if (!activeBoard) return
    const board = boards.find(b => b.slug === activeBoard)
    if (!board) return

    let active = true
    listPlannerBuckets(board.id).then(({ data }) => {
      if (!active) return
      setBuckets(data ?? [])
    })

    return () => { active = false }
  }, [activeBoard, boards])

  // Admin boards always appear last
  const sortedBoards = useMemo(() => {
    return [...boards].sort((a, b) => {
      const aLast = a.board_type === 'admin' || a.slug === 'admin-check-list'
      const bLast = b.board_type === 'admin' || b.slug === 'admin-check-list'
      if (aLast && !bLast) return 1
      if (!aLast && bLast) return -1
      return a.sort_order - b.sort_order
    })
  }, [boards])

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="mb-4 h-24 w-full animate-pulse rounded-xl bg-white/[0.04]" />
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 w-64 shrink-0 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Planner</h1>
        <EmptyState
          title="Planner tables not set up yet"
          message="Run phase-6 and phase-6b migrations."
        />
      </div>
    )
  }

  if (boards.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">Planner</h1>
        <EmptyState
          title="No boards found"
          message="Run the phase-6b seed migration to create boards."
        />
      </div>
    )
  }

  const activeIsScheduleBoard = activeBoard === 'client-schedule'

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Schedule</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">Planner</h1>
        </div>
        {isAdmin && (
          <Link
            to="/admin/planner-import"
            className="text-xs font-semibold text-brand-primary/60 hover:text-brand-primary transition-colors"
          >
            Import
          </Link>
        )}
      </div>

      {/* Monthly Work — primary entry point */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal/70">Monthly work</p>
            <h2 className="mt-1 text-lg font-black text-white">Monthly Planner</h2>
            <p className="mt-0.5 text-xs text-brand-primary/60">Current month deliverables, statuses and client work.</p>
          </div>
          <Link
            to="/admin/monthly-planner"
            className="group inline-flex shrink-0 items-center gap-2 rounded-lg border border-brand-teal/30 bg-brand-teal/[0.08] px-4 py-2.5 text-sm font-black uppercase tracking-[0.08em] text-[#2dd4bf] transition-all hover:border-brand-teal/60 hover:bg-brand-teal/[0.14] hover:text-white"
          >
            Open Monthly Work
            <svg className="h-4 w-4 opacity-70 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        {/* Status chips — structural preview */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {SIMPLIFIED_STATUS_OPTIONS.map(s => (
            <span
              key={s}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_TONES[s] ?? 'text-white/40 border-white/10'}`}
            >
              {SIMPLIFIED_STATUS_LABELS[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Board tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {sortedBoards.map(board => {
          const isActive = activeBoard === board.slug
          const isScheduleBoard = board.slug === 'client-schedule'
          const isAdminOnly = board.visibility === 'admin_only'
          return (
            <button
              key={board.slug}
              type="button"
              onClick={() => setActiveBoard(board.slug)}
              className={`flex flex-col items-start rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_-2px_0_rgba(45,212,191,0.6)]'
                  : 'text-white/45 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="shrink-0">{BOARD_ICONS[board.slug]}</span>
                <span>{BOARD_LABELS[board.slug] ?? board.name}</span>
                {isAdminOnly && (
                  <svg className="h-2.5 w-2.5 text-amber-400/60" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                )}
              </span>
              {isScheduleBoard && (
                <span className="mt-0.5 pl-[1.375rem] text-[9px] font-bold uppercase tracking-[0.12em] text-brand-primary/35">
                  Master schedule
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Schedule board callout */}
      {activeIsScheduleBoard && (
        <div className="mb-3 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-brand-primary/55">
          Master schedule — full client content plan across all months.
        </div>
      )}

      {/* Bucket columns */}
      {buckets.length === 0 ? (
        <EmptyState
          title="No columns configured"
          message="This board has no columns yet."
          centered={false}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {buckets.map(bucket => (
            <BucketColumn key={bucket.id} bucket={bucket} />
          ))}
        </div>
      )}
    </div>
  )
}

function BucketColumn({ bucket }: { bucket: PlannerBucket }) {
  return (
    <div className="w-56 shrink-0 sm:w-60">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white/45 truncate">
          {bucket.name}
        </h3>
        <span className="text-[11px] text-white/20">0</span>
      </div>
      <div className="min-h-[8rem] rounded-lg border border-white/[0.06] bg-white/[0.018] p-2">
        <div className="flex h-[5rem] items-center justify-center">
          <p className="text-[11px] text-white/20">—</p>
        </div>
      </div>
    </div>
  )
}
