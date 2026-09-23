import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchContentReadiness, type ContentReadinessSummary } from '../../lib/contentReadinessData'
import type { RunReadiness } from '../../lib/contentAutopilot'

// #450 — Upcoming content readiness. Staff should REVIEW a prepared plan here, not
// discover missing work. Read-only: it creates nothing, calls no provider and never
// reports unknown evidence as "nothing uploaded".

const BLOCKER_LABELS: Record<string, string> = {
  NO_GUIDELINE: 'No canonical guideline yet',
  NO_FUTURE_CONTENT_RUN: 'No upcoming content run',
  BLOCKED_MISSING_SHORT_CODE: 'Client short code not set',
  BLOCKED_MISSING_ONEDRIVE_MAPPING: 'Production folder not mapped',
  CLIENT_CONTEXT_NOT_READY: 'Client knowledge not ready',
  NO_AI_PROVIDER: 'No AI provider configured',
  NO_COVERAGE_WINDOW: 'No run date',
  RAW_UNVERIFIED: 'Raw footage unverified',
  RAW_MISSING: 'Raw footage missing',
}

function Stat({ label, value, tone = 'text-white' }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white/40">{label}</p>
      <p className={`text-lg font-black ${tone}`}>{value}</p>
    </div>
  )
}

function RunCard({ run }: { run: RunReadiness }) {
  const counts = run.readinessCounts
  const guidelineTone = run.guidelineStatus ? 'text-white/70' : 'text-amber-300'
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">{run.clientName ?? 'Unassigned client'}</p>
          <p className="text-xs text-white/50">
            {run.runDate ?? 'No date'}
            {run.coverageMonths.length > 1 ? ` · covers ${run.coverageMonths.length} months` : ''}
          </p>
        </div>
        <Link to={`/admin/content-workflow?run=${run.runId}`} className="shrink-0 text-[11px] font-bold text-brand-teal hover:text-white">Open run →</Link>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Guideline" value={run.guidelineStatus ?? 'missing'} tone={guidelineTone} />
        <Stat label="Planned videos" value={run.plannedVideos} />
        <Stat label="Unallocated" value={run.unallocatedVideos} tone={run.unallocatedVideos ? 'text-white/70' : 'text-white/30'} />
        <Stat label="Folder ready" value={`${run.folderReadyVideos}/${run.plannedVideos}`} tone={run.folderReadyVideos === run.plannedVideos && run.plannedVideos > 0 ? 'text-emerald-300' : 'text-amber-300'} />
        <Stat label="Ready to edit" value={counts.READY_TO_EDIT} tone={counts.READY_TO_EDIT ? 'text-emerald-300' : 'text-white/30'} />
        <Stat label="In edit" value={counts.IN_EDIT} />
        <Stat label="In review" value={counts.IN_REVIEW} />
        <Stat label="Final" value={counts.FINAL_READY} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/50">
          Raw verified {run.rawCounts.VERIFIED} · partial {run.rawCounts.PARTIAL} · unverified {run.rawCounts.UNVERIFIED}
        </span>
        {run.blockers.map(blocker => (
          <span key={blocker} className="rounded-full bg-amber-300/15 px-2 py-0.5 font-bold text-amber-200">
            {BLOCKER_LABELS[blocker] ?? blocker}
          </span>
        ))}
      </div>

      {run.videos.some(video => video.readiness.readiness.startsWith('BLOCKED')) && (
        <ul className="mt-2 space-y-1 text-[11px] text-white/55">
          {run.videos.filter(video => video.readiness.readiness.startsWith('BLOCKED')).slice(0, 3).map(video => (
            <li key={video.videoId} className="break-words">
              <span className="font-bold text-white/70">{video.name}</span> — {video.readiness.reason} <span className="text-brand-teal">{video.readiness.nextAction}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function ContentRunReadinessPanel({ today }: { today: string }) {
  const [summary, setSummary] = useState<ContentReadinessSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void fetchContentReadiness(today).then(result => {
      if (!active) return
      setSummary(result.data)
      setError(result.error)
      setLoading(false)
    })
    return () => { active = false }
  }, [today])

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.015] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-[0.12em] text-white/50">Upcoming content readiness</h2>
        {summary?.lastPass && (
          <p className="text-[11px] text-white/40">
            Last prepared {summary.lastPass.finished_at?.slice(0, 16).replace('T', ' ') ?? 'unknown'} · {summary.lastPass.status}
          </p>
        )}
      </div>

      {loading ? <p className="mt-2 text-xs text-white/40">Loading…</p>
        : error ? <p role="alert" className="mt-2 text-xs text-amber-300">Readiness is unavailable right now: {error}</p>
        : !summary || !summary.runs.length
          ? <p className="mt-2 text-xs text-white/40">No upcoming content run in the next 90 days. Nothing is scheduled — no run is created automatically.</p>
          : <ul className="mt-3 space-y-3">{summary.runs.map(run => <RunCard key={run.runId} run={run} />)}</ul>}
    </section>
  )
}
