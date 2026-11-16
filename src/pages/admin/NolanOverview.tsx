import { retainNolanRows, nolanReadScope, type RetainedRows } from '../../lib/nolanReadContinuity'
import { NolanVideoHandoffEvidence } from './NolanVideoHandoffEvidence'
import { NolanTaskOwnership } from './NolanTaskOwnership'
import { nolanTaskOwnerLabel } from '../../lib/nolanOwnership'
import { nolanScheduleRecordHref } from '../../lib/nolanRecordLinks'
import { NolanRecordIdentity } from './NolanRecordIdentity'
import { captureNolanSource } from '../../lib/nolanSourceRead'
import { NolanScheduleEvidence } from './NolanScheduleEvidence'
import { NolanWebsiteConnections } from './NolanWebsiteConnections'
import { NolanPackageEvidence } from './NolanPackageEvidence'
import { MasterScope } from './NolanMasterScope'
import { useEffect, useState } from 'react'
import './nolanOverview.css'
import { taskInNolanLane, type NolanTaskLane } from '../../lib/nolanSourceLanes'
import { useAuth } from '../../contexts/AuthContext'
import { Link, useSearchParams } from 'react-router-dom'
import { readNolanViewState, updateNolanViewState, type NolanViewState, type NolanLane } from '../../lib/nolanViewState'
import { listTasks, listActiveClients, taskStatusDisplayLabel, type CommandCentreTask } from '../../lib/commandCentre'
import { listPipelineVideos, listStaffProfiles, type ContentGuideIdea } from '../../lib/contentWorkflow'
import { listMonthlyDeliverablesByMonth, PRODUCTION_STATUS_LABELS, type MonthlyDeliverable } from '../../lib/planner'
import { businessMonthKey } from '../../lib/businessTime'
import { VIDEO_STATUS_LABELS } from '../../lib/videoPipelineRules'

type Lane = NolanLane
type SourceReceipt = { source: string; checkedAt: string; unavailable: boolean }
type Snapshot = { scope: string; retained: { tasks: RetainedRows<CommandCentreTask>; videos: RetainedRows<ContentGuideIdea>; deliverables: RetainedRows<MonthlyDeliverable> }; staff: Map<string, string> | null; receipts: SourceReceipt[]; tasks: CommandCentreTask[]; videos: ContentGuideIdea[]; deliverables: MonthlyDeliverable[]; clients: Record<string, string>; errors: string[]; checked: string; month: string }

// A view, not another task store. All edits stay in the existing authoritative
// screens. Reads use the signed-in Supabase client and existing RLS unchanged.
export default function NolanOverview() {
  const { profile, user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const fallbackMonth = businessMonthKey()
  const { lane, query, status: statusFilter, month } = readNolanViewState(searchParams, fallbackMonth)
  const changeView = (patch: Partial<NolanViewState>, replace = false) => setSearchParams(current => updateNolanViewState(current, patch, fallbackMonth), { replace })
  const scope = nolanReadScope(user?.id, profile?.is_active === false ? undefined : profile?.id, profile?.role, month)
  const [rawSnapshot, setSnapshot] = useState<Snapshot | null>(null)
  const snapshot = scope && rawSnapshot?.scope === scope ? rawSnapshot : null
  const [loading, setLoading] = useState(false)
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    let cancelled = false
    if (!scope) { setSnapshot(null); setLoading(false); return }
    const readScope = scope
    async function load() {
      setLoading(true)
      setSnapshot(previous => previous?.scope === readScope ? previous : null)
      try {
        const [taskRead, videoRead, scheduleRead, clientRead, staffRead] = await Promise.all([
          captureNolanSource(() => listTasks()), captureNolanSource(() => listPipelineVideos()),
          captureNolanSource(() => listMonthlyDeliverablesByMonth(month)), captureNolanSource(() => listActiveClients()), captureNolanSource(() => listStaffProfiles()),
        ])
        const tasks = taskRead.result ?? { data: [], error: { message: taskRead.error } }
        const videos = videoRead.result ?? { data: [], error: videoRead.error, migrationNeeded: false }
        const deliverables = scheduleRead.result ?? { data: [], error: { message: scheduleRead.error } }
        const clients = clientRead.result ?? { data: [], error: { message: clientRead.error } }
        const staff = staffRead.result && !staffRead.result.error && !staffRead.result.migrationNeeded ? new Map(staffRead.result.data.filter(p => p.full_name).map(p => [p.id, p.full_name!])) : null
        const receipts = [
          { source: 'Owner profile directory', checkedAt: staffRead.checkedAt, unavailable: !staff },
          { source: 'Work records', checkedAt: taskRead.checkedAt, unavailable: !!tasks.error },
          { source: 'Video pipeline', checkedAt: videoRead.checkedAt, unavailable: !!videos.error || !!videos.migrationNeeded },
          { source: 'Monthly schedule', checkedAt: scheduleRead.checkedAt, unavailable: !!deliverables.error },
          { source: 'Client labels', checkedAt: clientRead.checkedAt, unavailable: !!clients.error },
        ]
        if (cancelled) return
        setSnapshot(previous => {
          if (cancelled) return previous
          const prior = previous?.scope === readScope ? previous.retained : undefined
          const retained = {
            tasks: retainNolanRows((tasks.data ?? []) as CommandCentreTask[], !!tasks.error, taskRead.checkedAt, prior?.tasks),
            videos: retainNolanRows(videos.data, !!videos.error || !!videos.migrationNeeded, videoRead.checkedAt, prior?.videos),
            deliverables: retainNolanRows((deliverables.data ?? []) as MonthlyDeliverable[], !!deliverables.error, scheduleRead.checkedAt, prior?.deliverables),
          }
        const next = { scope: readScope, staff, receipts, clients: Object.fromEntries((clients.data ?? []).map(c => [c.id, c.name])), tasks: tasks.error ? [] : (tasks.data ?? []) as CommandCentreTask[], videos: videos.error || videos.migrationNeeded ? [] : videos.data, deliverables: deliverables.error ? [] : (deliverables.data ?? []) as MonthlyDeliverable[], errors: [!staff && 'Owner profile directory unavailable; assignment verification incomplete.', clients.error && `Client labels unavailable: ${clients.error.message}`, tasks.error && `Work unavailable: ${tasks.error.message}`, videos.error && `Videos unavailable: ${videos.error}`, videos.migrationNeeded && 'Video source unavailable: required schema is missing.', deliverables.error && `Package schedule unavailable: ${deliverables.error.message}`].filter(Boolean) as string[], month, checked: new Date().toISOString() }
          return { ...next, retained, tasks: retained.tasks.data, videos: retained.videos.data, deliverables: retained.deliverables.data }
        })
      } catch (error) {
        if (!cancelled) setSnapshot({ scope: readScope, retained: { tasks: retainNolanRows<CommandCentreTask>([], true, '', undefined), videos: retainNolanRows<ContentGuideIdea>([], true, '', undefined), deliverables: retainNolanRows<MonthlyDeliverable>([], true, '', undefined) }, staff: null, receipts: [], clients: {}, tasks: [], videos: [], deliverables: [], errors: [error instanceof Error ? error.message : 'Source reads failed.'], month, checked: new Date().toISOString() })
      } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [month, generation, scope])
  useEffect(() => {
    const refresh = () => setGeneration(n => n + 1)
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  const match = (...values: (string | null | undefined)[]) => values.join(' ').toLowerCase().includes(query.trim().toLowerCase())
  const rows = ['work', 'ownership', 'needs', 'special', 'done', 'apps', 'editor'].includes(lane) ? (snapshot?.tasks ?? []).filter(t => taskInNolanLane(t, lane as NolanTaskLane, profile?.id, snapshot?.staff ?? null)).filter(t => match(t.title, t.client_name, t.assigned_to_name, t.bucket, t.id, t.native_id, nolanTaskOwnerLabel(t, snapshot?.staff ?? null))).map(t => ({ id: `task:${t.id}`, source: t.data_origin === 'planner_tasks' ? 'Dynamics Planner task' : 'Command Centre task', recordId: t.native_id ?? t.id, dueDate: t.due_date || null, dateLabel: t.data_origin === 'planner_tasks' ? 'Task date (due/start fallback)' : 'Recorded due date', title: t.title, owner: nolanTaskOwnerLabel(t, snapshot?.staff ?? null), taskEvidence: t, videoEvidence: null, client: t.client_name ?? t.bucket, status: taskStatusDisplayLabel(t), href: t.data_origin === 'planner_tasks' ? `/admin/work?tab=board&id=${encodeURIComponent(t.native_id ?? t.id)}` : '/admin/work?tab=daily-tasks', detail: t.notes, updated: t.updated_at, scheduleEvidence: null }))
    : lane === 'videos' ? (snapshot?.videos ?? []).filter(v => match(v.title, v.canonical_name, v.client_name, v.editor_name, v.owner_name, v.id)).map(v => ({ id: `video:${v.id}`, source: 'Content video pipeline', recordId: v.id, dueDate: null, dateLabel: 'Recorded due date', title: v.canonical_name ?? v.title, owner: v.editor_name ?? v.owner_name, taskEvidence: null, videoEvidence: v, client: v.client_name, status: VIDEO_STATUS_LABELS[v.production_status] ?? v.production_status, href: '/admin/content?tab=pipeline', detail: v.production_note, updated: v.updated_at, scheduleEvidence: null }))
    : lane === 'packages' ? (snapshot?.deliverables ?? []).filter(d => match(d.title, snapshot?.clients[d.client_id], d.assigned_to_name, d.code, d.id)).map(d => ({ id: `deliverable:${d.id}`, source: 'Monthly deliverable', recordId: d.id, dueDate: d.due_date, dateLabel: 'Recorded due date', title: d.title, owner: d.assigned_to_name, taskEvidence: null, videoEvidence: null, client: `${snapshot?.clients[d.client_id] ?? 'Client label unavailable'} · ${d.code} · ${d.month}`, status: PRODUCTION_STATUS_LABELS[d.production_status] ?? d.production_status, href: nolanScheduleRecordHref(d), detail: d.notes, updated: d.updated_at, scheduleEvidence: d })) : []
  const visibleRows = statusFilter === 'All statuses' ? rows : rows.filter(row => row.status === statusFilter)
  const laneContinuity = lane === 'videos' ? snapshot?.retained.videos : lane === 'packages' ? snapshot?.retained.deliverables : snapshot?.retained.tasks
  const sections: [Lane, string][] = [['master', 'Master schedule'], ['work', 'Active work'], ['needs', 'Assigned to you'], ['ownership', 'Ownership review'], ['special', 'Special tasks & campaigns'], ['done', 'Completed'], ['videos', 'Video & amendments'], ['packages', 'Client packages & schedule'], ['systems', 'Websites & reach'], ['editor', 'CG Web Editor'], ['apps', 'Apps & milestones']]
  if (!scope) return <div className="nolan-board" role="alert">Account verification unavailable. No workbook records are displayed.</div>
  return <div className="nolan-board" aria-label="Nolan overview">
    <aside><div className="brand"><span className="brandmark">n.</span><span>NOLAN<span className="brand-sub">YOUR WORKBOARD</span></span></div><div className="navlabel">WORKSPACE</div><nav aria-label="Work views">{sections.map(([id, label]) => <button key={id} className={lane === id ? 'selected' : ''} aria-pressed={lane === id} onClick={() => { changeView({ lane: id, status: 'All statuses' }) }}>{label}</button>)}</nav><div className="side-bottom"><div className="avatar">CA</div><div><strong>CA + Nolan</strong><small>Dynamics workspace</small></div></div></aside>
    <main><header><div className="breadcrumb">WORK / NOLAN</div><Link className="source-link" to="/admin/work?tab=board&id=7f413d31-17cd-4761-b2e9-a031c1343444">Master record ↗</Link></header>
      <section className="intro"><div><h1>Here’s the situation.</h1><p>What needs attention, who owns it, and what happens next.</p></div><div className="fresh"><strong>{!scope ? 'Account verification unavailable' : loading ? 'Reading Dynamics…' : snapshot?.errors.length ? 'Source checks incomplete' : 'Direct Dynamics records'}</strong><small>{snapshot ? 'Last attempt: ' + new Date(snapshot.checked).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' }) + ' SAST' : 'Waiting for source reads'}</small><button className="refresh-data" disabled={loading} onClick={() => setGeneration(n => n + 1)}>Refresh status</button></div></section>
      {!!snapshot?.errors.length && <div role="alert" className="native-error">{snapshot.errors.map(e => <p key={e}>{e}</p>)}</div>}
      <section className="work"><div className="work-heading"><div><h2>{sections.find(([id]) => id === lane)?.[1]}</h2><p>{lane === 'master' ? '12 responsibility areas · source navigation, not task statuses' : lane === 'systems' ? 'Reviewed connections and on-demand reporting · partial coverage' : `${visibleRows.length} matching display records${laneContinuity?.stale || loading ? ' · includes last-known records, not current verification' : ''} · open a row for details`}</p></div></div>
      {lane !== 'master' && lane !== 'systems' && <div className="toolbar"><label className="search"><span>⌕</span><input aria-label="Search this lane" value={query} onChange={e => changeView({ query: e.target.value }, true)} placeholder="Find a client, task or owner…" /></label><select aria-label="Filter status" value={statusFilter} onChange={e => changeView({ status: e.target.value })}><option>All statuses</option>{[...new Set([...rows.map(row => row.status), ...(statusFilter === 'All statuses' ? [] : [statusFilter])])].sort().map(status => <option key={status}>{status}</option>)}</select><button className="refresh-data" onClick={() => changeView({ query: '', status: 'All statuses' })}>Clear filters</button>{lane === 'packages' && <input aria-label="Schedule month" type="month" value={month} onChange={e => { if (e.target.value) changeView({ month: e.target.value }) }} />}</div>}
      <details className="coverage-details"><summary>Coverage & source freshness</summary><div className="coverage">Refreshes on open, return to this window and Refresh. Source status is not independent delivery or approval verification. Retained rows are display-only, scoped to this account, role and month; stale source data never changes a recorded lifecycle status. {lane === 'packages' ? 'Scheduled deliverables, not a complete paid-entitlement audit.' : lane === 'work' ? 'Paged Dynamics task records. External source coverage remains separate.' : 'Records visible to this signed-in account.'}
        {snapshot && <ul aria-label="Individual source read receipts">{snapshot.receipts.map(receipt => <li key={receipt.source}>
          {receipt.source}: {receipt.unavailable ? 'Unavailable; no successful read claimed' : 'Read completed for visible records'} · {new Date(receipt.checkedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST
        </li>)}</ul>}
        <p>These are individual reader completion times, not upstream provider refresh times or complete external-source coverage.</p>
      </div></details>
      {lane === 'packages' && <NolanPackageEvidence key={scope} month={month} refreshGeneration={generation} />}
      {lane === 'ownership' && <div className="coverage">Open tasks with canonical unresolved, conflicting or unassigned ownership. Missing profile evidence is not an unassigned conclusion; check source errors. Existing owners remain unchanged.</div>}
      {lane === 'needs' && <div className="coverage">Open work with recorded canonical assignment to your signed-in profile. Unrecorded personal decisions are not inferred from notes.</div>}
      {lane === 'special' && <div className="coverage">Existing Once-off and CG Socials tasks. Unclassified campaigns remain in Active work.</div>}
      {(lane === 'apps' || lane === 'editor') && <div className="coverage">Recorded Dynamics work linked to exact app repositories. This is not a full GitHub milestone inventory; unlinked or ambiguous records stay in Active work. Repository issue status is not deployed acceptance.</div>}
      {lane === 'master' ? <MasterScope /> : lane === 'systems' ? <NolanWebsiteConnections key={`${scope}:${generation}`} /> : <div className="grid list">{visibleRows.map(row => <article className="card" key={row.id}><h3>{row.title}<small style={{ display: 'block', fontWeight: 400, marginTop: 4 }}>{row.client ?? 'Client not recorded'}</small></h3><span className="badge">{row.status}</span>{(laneContinuity?.stale || loading) && <p role="status">Last-known record · {loading ? 'refresh pending' : 'source unavailable'} · not current verification. Last successful source read: {laneContinuity?.lastSuccessAt ?? 'unknown'}. Open the authoritative record before acting.</p>}<div className="next" aria-label="Source note, not a verified next action">{row.detail ? row.detail.split('\n')[0] : 'No source note recorded'}</div><span className="native-owner">{row.owner ?? 'Owner not recorded'}</span><details className="native-details"><summary>Details & source ↗</summary><p>{row.detail || 'No next-action note recorded.'}</p><p>Source updated: {row.updated}</p>{row.taskEvidence && <NolanTaskOwnership task={row.taskEvidence} directory={snapshot?.staff ?? null} />}<NolanRecordIdentity source={row.source} recordId={row.recordId} dueDate={row.dueDate} dateLabel={row.dateLabel} />{row.videoEvidence && <NolanVideoHandoffEvidence video={row.videoEvidence} />}{row.scheduleEvidence && <NolanScheduleEvidence deliverable={row.scheduleEvidence} />}<Link to={row.href}>Open authoritative record / workspace →</Link></details></article>)}{!loading && visibleRows.length === 0 && <p className="native-empty">No matching records returned. Check source errors and filters before concluding there is no work.</p>}</div>}
      </section><footer><strong>One source of truth.</strong> Existing Dynamics records, not a second task database. Edit once in the source workspace. The existing pinned external workboard has not been redirected or made live by this page.</footer>
    </main>
  </div>
}
