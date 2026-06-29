import { useState, useEffect, type ReactNode } from 'react'
import { EmptyState } from '../../components/ui/States'
import {
  listPlannerBoards,
  listPlannerBuckets,
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

export default function PlannerPage() {
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

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-4 h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-60 w-64 shrink-0 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
      </div>
    )
  }

  if (tableMissing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">CG Planner</h1>
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
        <h1 className="mb-6 text-xl font-black tracking-tight text-white">CG Planner</h1>
        <EmptyState
          title="No boards found"
          message="Run the phase-6b seed migration to create boards."
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-black tracking-tight text-white">CG Planner</h1>
      </div>

      {/* Board tabs — Teams Planner style */}
      <div className="mb-4 flex flex-wrap gap-1">
        {boards.map(board => {
          const isActive = activeBoard === board.slug
          const isAdminOnly = board.visibility === 'admin_only'
          return (
            <button
              key={board.slug}
              type="button"
              onClick={() => setActiveBoard(board.slug)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                isActive
                  ? 'bg-brand-accent/15 text-brand-accent shadow-sm'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="shrink-0">{BOARD_ICONS[board.slug]}</span>
              <span>{BOARD_LABELS[board.slug] ?? board.name}</span>
              {isAdminOnly && (
                <svg className="h-2.5 w-2.5 text-amber-400/60" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
            </button>
          )
        })}
      </div>

      {/* Bucket columns */}
      {buckets.length === 0 ? (
        <EmptyState
          title="No buckets configured"
          message="This board has no columns yet."
          centered={false}
        />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
          {buckets.map(bucket => (
            <div key={bucket.id} className="w-60 shrink-0 sm:w-64">
              <div className="mb-2 flex items-center gap-2 px-2">
                <h3 className="text-[11px] font-semibold text-white/50 uppercase tracking-wider truncate">
                  {bucket.name}
                </h3>
                <span className="text-[11px] text-white/25">0</span>
              </div>
              <div className="min-h-[15rem] rounded-lg bg-white/[0.025] p-2.5">
                <p className="pt-5 text-center text-xs text-white/25">
                  Empty
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
