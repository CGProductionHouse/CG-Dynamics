import { useEffect, useEffectEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import MyDayPage from './MyDayPage'
import CommandCentrePage from './CommandCentrePage'
import PlannerPage from './PlannerPage'
import { listPipelineVideos, listRuns, type ContentGuideIdea, type ContentRun } from '../../lib/contentWorkflow'
import { runInvolvesUser } from '../../lib/contentWorkflowRules'
import { editorQueueMatch, internalReviewMatch, VIDEO_STATUS_LABELS } from '../../lib/videoPipelineRules'
import { isManagerRole } from '../../lib/roles'
import { listPlannerWorkloadSummary, listPlannerWorkloadTasks, type PlannerWorkloadSummary, type PlannerWorkloadTask } from '../../lib/planner'
import { EmptyState } from '../../components/ui/States'

type WorkTab = 'my-day' | 'board' | 'daily-tasks' | 'workload'

// Videos the signed-in editor is actively working, plus internal reviews the
// signed-in manager/admin owns. Compact; silent before phase-19e.
function MyVideoQueue() {
  const { profile } = useAuth()
  const [videos, setVideos] = useState<ContentGuideIdea[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useEffectEvent(async () => {
    setLoadError(null)
    const result = await listPipelineVideos()
    if (result.error) { setLoadError(result.error); setVideos([]); return }
    if (result.migrationNeeded) { setVideos([]); return }
    const isManager = isManagerRole(profile?.role)
    const mine = result.data.filter(video => editorQueueMatch(video, profile?.id) || internalReviewMatch(video, isManager))
    setVideos(mine.slice(0, 8))
  })
  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [profile?.id])

  if (videos.length === 0 && !loadError) return null
  return (
    <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">My Video Queue</h2>
          <Link to="/admin/content?tab=pipeline" className="text-xs font-bold text-brand-teal hover:text-white">Open</Link>
        </div>
        {loadError ? (
          <p className="text-xs text-red-300">Could not load your video queue: {loadError}</p>
        ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {videos.map(video => (
            <li key={video.id}>
              <Link to="/admin/content?tab=pipeline" className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 transition-colors hover:border-brand-teal/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{video.title}</p>
                  <p className="truncate font-mono text-[11px] text-white/45">{video.canonical_name ?? '—'}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary/70">{VIDEO_STATUS_LABELS[video.production_status]}</span>
              </Link>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  )
}

// Compact band: content runs the signed-in person leads or helps on, so staff
// see their shoot responsibilities without being told. Best-effort — silent if
// phase-19d is not applied.
function MyContentRuns() {
  const { profile } = useAuth()
  const [runs, setRuns] = useState<ContentRun[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useEffectEvent(async () => {
    setLoadError(null)
    const result = await listRuns()
    if (result.error) { setLoadError(result.error); setRuns([]); return }
    if (result.migrationNeeded) { setRuns([]); return }
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

  if (runs.length === 0 && !loadError) return null
  return (
    <div className="mx-auto mt-3 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-white/45">My Content Runs</h2>
          <Link to="/admin/content?tab=runs" className="text-xs font-bold text-brand-teal hover:text-white">Open</Link>
        </div>
        {loadError ? (
          <p className="text-xs text-red-300">Could not load your content runs: {loadError}</p>
        ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {runs.map(run => (
            <li key={run.id}>
              <Link to={`/admin/content?tab=runs&run=${run.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 transition-colors hover:border-brand-teal/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{run.name}</p>
                  <p className="truncate text-xs text-white/45">{run.run_date ?? 'No date'}{run.client_name ? ` · ${run.client_name}` : ''}{run.lead_name ? ` · lead ${run.lead_name}` : ''}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-brand-primary/70">{run.status.replace(/_/g, ' ')}</span>
              </Link>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  )
}

const workloadMetrics: Array<[keyof PlannerWorkloadSummary, string]> = [
  ['active_task_count', 'Active'],
  ['overdue_count', 'Overdue'],
  ['blocked_count', 'Blocked'],
  ['due_today_count', 'Due today'],
  ['due_next_7_days_count', 'Next 7 days'],
]

function WorkloadView({ selectedPerson }: { selectedPerson: string | null }) {
  const [people, setPeople] = useState<PlannerWorkloadSummary[]>([])
  const [tasks, setTasks] = useState<PlannerWorkloadTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void Promise.all([listPlannerWorkloadSummary(), listPlannerWorkloadTasks()]).then(([summaryResult, tasksResult]) => {
      if (!active) return
      setLoading(false)
      if (summaryResult.error || tasksResult.error) {
        setError(summaryResult.error && tasksResult.error
          ? 'Could not load the workload summary or task details. Try again shortly.'
          : summaryResult.error
            ? 'Could not load the workload summary. Try again shortly.'
            : 'Could not load workload task details. Try again shortly.')
        return
      }
      setPeople((summaryResult.data ?? []).sort((left, right) => left.full_name.localeCompare(right.full_name)))
      setTasks(tasksResult.data ?? [])
    })
    return () => { active = false }
  }, [])

  if (loading) return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" /></div>
  if (error) return <div role="alert" className="mx-auto mt-5 max-w-7xl rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">{error}</div>
  if (people.length === 0 && tasks.length === 0) return <div className="mx-auto mt-5 max-w-7xl px-4 sm:px-6 lg:px-8"><EmptyState title="No active work" message="No team workload is available." compact centered={false} /></div>

  const canonicalUnassignedTasks = tasks.filter(task => task.assignee_profile_ids.length === 0)
  const unassignedTotal = people[0]?.unassigned_total ?? canonicalUnassignedTasks.length
  const selectedSummary = people.find(person => person.profile_id === selectedPerson)
  const selectedTasks = selectedPerson === 'unassigned'
    ? canonicalUnassignedTasks
    : selectedPerson
      ? tasks.filter(task => task.assignee_profile_ids.includes(selectedPerson))
      : null
  const selectedLabel = selectedPerson === 'unassigned' ? 'Unassigned' : selectedSummary?.full_name ?? 'Selected team member'
  const boardLink = selectedPerson === 'unassigned'
    ? '?tab=board&scope=unassigned'
    : `?tab=board&assignee=${encodeURIComponent(selectedPerson ?? '')}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      {selectedTasks && (
        <section className="mb-4 rounded-2xl border border-brand-teal/25 bg-brand-teal/[0.04] p-4" aria-labelledby="selected-workload-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-teal">Active work</p>
              <h2 id="selected-workload-heading" className="mt-1 text-xl font-black text-white">{selectedLabel}</h2>
            </div>
            <Link to={boardLink} className="rounded-lg border border-brand-teal/30 px-3 py-2 text-xs font-black text-brand-teal hover:bg-brand-teal/10 hover:text-white">Open filtered Team Board</Link>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="rounded-lg bg-black/20 px-3 py-2 text-xs text-white/50">No matching tasks.</p>
          ) : (
            <ul className="grid gap-2">
              {selectedTasks.map(task => (
                <li key={task.task_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white">{task.title}</h3>
                      <p className="mt-1 text-xs text-white/45">{task.client_name ?? 'No client'} · {task.board_name} · {task.bucket_name ?? 'No bucket'}</p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brand-primary">{task.status.replace(/_/g, ' ')}</span>
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                    <div><dt className="text-white/35">Due</dt><dd className="font-bold text-white/75">{task.due_date || 'No due date'}</dd></div>
                    <div><dt className="text-white/35">Priority</dt><dd className="font-bold capitalize text-white/75">{task.priority.replace(/_/g, ' ')}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-teal">Unassigned</p>
            <p className="mt-1 text-2xl font-black text-white">{unassignedTotal} active tasks</p>
          </div>
          <Link to="?tab=workload&person=unassigned" className="rounded-lg border border-brand-teal/30 px-3 py-2 text-xs font-black text-brand-teal hover:bg-brand-teal/10 hover:text-white">View unassigned work</Link>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {people.map(person => (
          <Link key={person.profile_id} to={`?tab=workload&person=${encodeURIComponent(person.profile_id)}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 transition-colors hover:border-brand-teal/35 hover:bg-white/[0.04]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-white">{person.full_name}</h2>
                <p className="text-xs capitalize text-white/40">{person.role}</p>
              </div>
              <span className="text-xs font-bold text-brand-teal">View tasks</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {workloadMetrics.map(([key, label]) => (
                <div key={key} className="rounded-lg bg-black/20 px-2 py-2 text-center">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">{label}</dt>
                  <dd className="mt-1 text-lg font-black text-white">{person[key]}</dd>
                </div>
              ))}
            </dl>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function MyWorkPage() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const canViewWorkload = isManagerRole(profile?.role)
  const requestedTab = searchParams.get('tab')
  const tab: WorkTab = requestedTab === 'board' || requestedTab === 'daily-tasks' || (requestedTab === 'workload' && canViewWorkload)
    ? requestedTab
    : 'my-day'

  function switchTab(nextTab: WorkTab) {
    const next = new URLSearchParams({ tab: nextTab })
    if (nextTab === 'board') {
      const scope = searchParams.get('scope')
      const assignee = searchParams.get('assignee')
      if (scope === 'overdue' || scope === 'blocked' || (scope === 'unassigned' && canViewWorkload)) next.set('scope', scope)
      if (assignee) next.set('assignee', assignee)
      const taskId = searchParams.get('id')
      const taskName = searchParams.get('task')
      if (taskId) next.set('id', taskId)
      if (taskName) next.set('task', taskName)
    }
    if (nextTab === 'workload' && searchParams.get('person')) next.set('person', searchParams.get('person') ?? '')
    setSearchParams(next)
  }


  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-white/10 bg-brand-surface/60 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="mt-1 text-2xl font-black text-white">Work</h1>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className={`grid gap-1 rounded-xl border border-white/10 bg-black/20 p-1 ${canViewWorkload ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-3'}`}>
              {([
                ['my-day', 'My Day'],
                ['board', 'Team Board'],
                ['daily-tasks', 'Daily Tasks'],
                ...(canViewWorkload ? [['workload', 'Workload'] as const] : []),
              ] as Array<[WorkTab, string]>).map(([value, label]) => (
                <button key={value} type="button" onClick={() => switchTab(value)} className={`rounded-lg px-3 py-3 text-sm font-black transition-colors ${tab === value ? 'bg-brand-teal text-black' : 'text-brand-primary hover:bg-white/[0.05] hover:text-white'}`}>
                  {label}
                </button>
              ))}
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <Link to="?tab=board&scope=overdue" className="text-amber-300 hover:text-white">Overdue work</Link>
                <Link to="?tab=board&scope=blocked" className="text-red-300 hover:text-white">Blocked work</Link>
                {canViewWorkload && <Link to="?tab=board&scope=unassigned" className="text-brand-teal hover:text-white">Unassigned work</Link>}
              </div>
              {canViewWorkload && (
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <Link to="/admin/command-centre" className="text-brand-teal hover:text-white">Team Work / Command Centre</Link>
                  <Link to="/admin/command-centre#morning-import" className="text-brand-teal hover:text-white">Morning List Import</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {tab === 'my-day' && <><MyVideoQueue /><MyContentRuns /><MyDayPage embedded /></>}
      {tab === 'board' && <PlannerPage embedded />}
      {tab === 'daily-tasks' && (
        <>
          <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <Link to="/admin/ops-hub?tab=client-work" className="inline-flex rounded-lg border border-brand-teal/25 bg-brand-teal/[0.06] px-3 py-2 text-xs font-black text-brand-teal hover:text-white">Capture client request</Link>
          </div>
          <CommandCentrePage embedded />
        </>
      )}
      {tab === 'workload' && canViewWorkload && <WorkloadView selectedPerson={searchParams.get('person')} />}
    </div>
  )
}
