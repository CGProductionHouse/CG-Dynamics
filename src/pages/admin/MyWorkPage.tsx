import { useEffect, useEffectEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import MyDayPage from './MyDayPage'
import CommandCentrePage from './CommandCentrePage'
import { listRuns, type ContentRun } from '../../lib/contentWorkflow'
import { runInvolvesUser } from '../../lib/contentWorkflowRules'

type MyWorkTab = 'my-day' | 'daily-tasks'

// Compact band: content runs the signed-in person leads or helps on, so staff
// see their shoot responsibilities without being told. Best-effort — silent if
// phase-19d is not applied.
function MyContentRuns() {
  const { profile } = useAuth()
  const [runs, setRuns] = useState<ContentRun[]>([])

  const load = useEffectEvent(async () => {
    const result = await listRuns()
    if (result.error || result.migrationNeeded) { setRuns([]); return }
    const mine = result.data
      .filter(run => run.status !== 'completed' && run.status !== 'cancelled')
      .filter(run => runInvolvesUser(run, { id: profile?.id, full_name: profile?.full_name }))
      .sort((a, b) => (a.run_date ?? '').localeCompare(b.run_date ?? ''))
    setRuns(mine.slice(0, 6))
  })
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [profile?.id])

  if (runs.length === 0) return null
  return (
    <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-10">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">My Content Runs</h2>
          <Link to="/admin/content-workflow" className="text-xs font-bold text-brand-teal hover:text-white">Open</Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {runs.map(run => (
            <li key={run.id}>
              <Link to="/admin/content-workflow" className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 transition-colors hover:border-brand-teal/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{run.name}</p>
                  <p className="truncate text-xs text-white/45">{run.run_date ?? 'No date'}{run.client_name ? ` · ${run.client_name}` : ''}{run.lead_name ? ` · lead ${run.lead_name}` : ''}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary/70">{run.status.replace(/_/g, ' ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function MyWorkPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: MyWorkTab = searchParams.get('tab') === 'daily-tasks' ? 'daily-tasks' : 'my-day'

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-10">
        <div className="rounded-2xl border border-white/10 bg-brand-surface/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-teal">Daily workflow</p>
              <h1 className="mt-1 text-2xl font-black text-white">My Work</h1>
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-black/20 p-1 sm:min-w-80">
              {([
                ['my-day', 'My Day'],
                ['daily-tasks', 'Daily Tasks'],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setSearchParams({ tab: value })} className={`rounded-lg px-4 py-3 text-sm font-black transition-colors ${tab === value ? 'bg-brand-teal text-black' : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <MyContentRuns />
      {tab === 'my-day' ? <MyDayPage embedded /> : <CommandCentrePage embedded />}
    </div>
  )
}
