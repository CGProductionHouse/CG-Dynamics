import { Link } from 'react-router-dom'
import { useState } from 'react'
import { taskStatusDisplayLabel, type CommandCentreTask } from '../../lib/commandCentre'
import { nolanTaskOwnerLabel } from '../../lib/nolanOwnership'
import { nolanEvidenceAge } from '../../lib/nolanTaskEvidence'
import { nolanMasterPage, nolanMasterSummary, nolanNotePreview, type NolanMasterLifecycle } from '../../lib/nolanMasterPresentation'
import { NolanTaskOwnership } from './NolanTaskOwnership'
import { NolanTaskActivity } from './NolanTaskActivity'


// Existing task records are primary; responsibility links remain coverage navigation.
export function MasterScope({ tasks = [], directory = null, role = '', sourceUnavailable = true, loading = false, checkedAt = null, refreshGeneration = 0 }: {
  tasks?: CommandCentreTask[]; directory?: Map<string, string> | null; role?: string;
  sourceUnavailable?: boolean; loading?: boolean; checkedAt?: string | null; refreshGeneration?: number
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [ownership, setOwnership] = useState('')
  const [page, setPage] = useState(0)
  const [lifecycle, setLifecycle] = useState<NolanMasterLifecycle>('active')
  if (!['admin', 'manager'].includes(role)) return <p role="alert">Manager access required. No task evidence displayed.</p>
  const result = nolanMasterPage(tasks, directory, { query, status, ownership, lifecycle }, page)
  const counts = nolanMasterSummary(tasks, directory)
  const uncertain = sourceUnavailable || loading
  const countLabel = (value: number | null) => value === null || (uncertain && !tasks.length) ? 'Unknown' : `${value}${uncertain ? ' last-known' : ''}`
  const inspect = (nextLifecycle: NolanMasterLifecycle, nextStatus = '', nextOwnership = '') => {
    setLifecycle(nextLifecycle); setQuery(''); setStatus(nextStatus); setOwnership(nextOwnership); setPage(0)
  }
  const sections = [
    ['Websites & discovery', '/admin/work?tab=board&id=7f413d31-17cd-4761-b2e9-a031c1343444', 'Four reviewed reporting mappings; full Builder registry pending.'],
    ['Apps: CG Hours, CG Pay, Dynamics, Web Editor', '/admin/work?tab=board', 'Exact linked Dynamics work; full external milestone inventory pending.'],
    ['Client packages, posters and posting', '/admin/client-schedule', 'Canonical schedule; paid entitlements and posted proof require reconciliation.'],
    ['Videos, amendments and approvals', '/admin/content?tab=pipeline', 'Canonical pipeline; delivery and approval remain separate.'],
    ['Operational email and WhatsApp follow-through', '/admin/work?tab=board', 'Accepted requests must be recorded as existing tasks; no inbox monitoring claimed by this page.'],
    ['Microsoft / Teams transition', '/admin/microsoft-import', 'Existing hold and retry budgets remain authoritative.'],
    ['GitHub, Vercel and Supabase', '/admin/work?tab=board', 'Existing linked work, not a new system-health certification.'],
    ['Canva, OneDrive and approved-final portals', '/admin/work?tab=board', 'Source handoffs and approval evidence remain required.'],
    ['Staff automation, greetings and morning checks', '/admin/work?tab=board', 'Daily receipts remain in the existing coordination record.'],
    ['Storage, drives and migration', '/admin/work?tab=board', 'Measured device evidence required; no automatic deletion.'],
    ['Special requests and CG campaigns', '/admin/work?tab=board', 'Existing tasks; public posting and paid advertising retain approval gates.'],
    ['Research and all-platform performance', '/admin/work?tab=board', 'Actual source evidence required; unsupported reach is not inferred.'],
  ]
  return <section className="nolan-master" aria-label="Master task evidence">
    <p>Existing work records visible to this account. Task ownership is not an agent execution assignment. Status is recorded workflow state, not a live worker heartbeat.</p>
    <p role="status">{loading ? 'Refreshing — last-known records only.' : sourceUnavailable ? 'Task source unavailable — retained records are stale.' : 'Task source read completed.'} Last successful read: {checkedAt ?? 'Unknown'}.</p>
    <section aria-label="Visible task snapshot summary">
      <h3>Visible task snapshot</h3>
      <p>Counts before search and filters, for records this account can read — not company or fleet totals. Blocked, waiting and unassigned overlap active work.</p>
      {uncertain && <p role="status">{tasks.length ? 'Counts are last-known, not current verification.' : 'Counts unavailable — no current zero-work conclusion.'}</p>}
      <div className="nolan-master-summary">
        <button onClick={() => inspect('active')}>Active work: {countLabel(counts.active)}</button>
        <button onClick={() => inspect('active', 'Blocked')}>Blocked: {countLabel(counts.blocked)}</button>
        <button onClick={() => inspect('active', 'Waiting client')}>Waiting client: {countLabel(counts.waiting)}</button>
        <button disabled={!directory} onClick={() => inspect('active', '', 'unassigned')}>Unassigned active: {countLabel(counts.unassigned)}</button>
        <button onClick={() => inspect('history')}>Completed history: {countLabel(counts.completed)}</button>
      </div>
      {counts.ownershipUnknown > 0 && <p>Owner evidence unavailable for {counts.ownershipUnknown} active records in this snapshot; these are not counted as unassigned.</p>}
    </section>
    <div className="toolbar">
      <select aria-label="Master work view" value={lifecycle} onChange={e => { setLifecycle(e.target.value as NolanMasterLifecycle); setStatus(''); setPage(0) }}>
        <option value="active">Active work</option><option value="history">Completed history</option><option value="all">All records</option>
      </select>
      <input aria-label="Search master tasks" placeholder="Find task, owner, client or ID…" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} />
      <select aria-label="Master task status" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}><option value="">All statuses</option>{[...new Set(tasks.map(taskStatusDisplayLabel))].sort().map(value => <option key={value}>{value}</option>)}</select>
      <select aria-label="Master ownership state" value={ownership} onChange={e => { setOwnership(e.target.value); setPage(0) }}><option value="">All ownership states</option>{['verified', 'unassigned', 'unresolved', 'conflict', 'unknown'].map(value => <option key={value}>{value}</option>)}</select>
      <button className="refresh-data" onClick={() => { setQuery(''); setStatus(''); setOwnership(''); setPage(0) }}>Clear master filters</button>
    </div>
    <p>{result.total} matching task records · {lifecycle === 'active' ? 'active work' : lifecycle === 'history' ? 'completed history' : 'all records'}; not company-wide or agent-fleet coverage.</p>
    <nav className="toolbar" aria-label="Master task pages">
      <button className="refresh-data" disabled={result.page === 0} onClick={() => setPage(result.page - 1)}>Previous tasks</button>
      <span role="status">Showing {result.from}–{result.to} of {result.total} · Page {result.page + 1} of {result.pages}</span>
      <button className="refresh-data" disabled={result.page + 1 >= result.pages} onClick={() => setPage(result.page + 1)}>Next tasks</button>
    </nav>
    <div className="grid list">{result.rows.map(task => {
      const notes = nolanNotePreview(task.notes)
      const sourceHref = task.data_origin === 'planner_tasks' ? `/admin/work?tab=board&id=${encodeURIComponent(task.native_id ?? task.id)}` : '/admin/work?tab=daily-tasks'
      return <article className="card nolan-master-task" key={task.id}>
      <h3>{task.title}</h3><span className="badge">{taskStatusDisplayLabel(task)}</span>
      <p className="native-owner">Canonical owner: {nolanTaskOwnerLabel(task, directory)}</p>
      <p>{task.client_name ?? 'Client not recorded'} · {task.bucket}</p>
      {(sourceUnavailable || loading) && <p role="status">Stale or refreshing source — this status is last-known, not current verification.</p>}
      <p>Source updated: {task.updated_at || 'Unknown'} · {nolanEvidenceAge(task.updated_at)}</p>
      <dl><dt>Execution agent</dt><dd>Unknown — no canonical task-level agent evidence available.</dd>
        <dt>Execution device</dt><dd>Unknown — no canonical task-level device evidence available.</dd>
        <dt>Verified next action</dt><dd>Unknown — source notes are not a verified action plan.</dd></dl>
      <Link to={sourceHref}>Open authoritative task workspace →</Link>
      <details className="native-details"><summary>Task ownership, notes &amp; source</summary>
        <NolanTaskOwnership task={task} directory={directory} />
        <p>Source: {task.data_origin ?? 'command_centre'} · record {task.native_id ?? task.id}</p>
        <h4>Recorded source notes — unverified instructions</h4><p className="nolan-note-preview">{notes.text || 'No source notes recorded.'}</p>
        {notes.truncated && <p>Truncated source excerpt (up to 600 characters), not a current-state summary. Full notes remain in the authoritative task workspace.</p>}
        <Link to={sourceHref}>Read full notes at source →</Link>
      </details>
      <NolanTaskActivity key={`${task.id}:${refreshGeneration}`} taskId={task.data_origin === 'planner_tasks' ? task.native_id ?? task.id : null} directory={directory} role={role} sourceUnavailable={sourceUnavailable || loading} />
    </article>})}</div>
    {!result.total && <p>No matching task evidence in this view. Select All records to search active work and completed history together. Check source availability and filters before concluding there is no work.</p>}
    <details className="coverage-details"><summary>Responsibility coverage &amp; source navigation</summary>
    <p>These twelve links describe coverage only. No task-to-responsibility assignment is inferred from titles or notes.</p>
    <div className="grid list">{sections.map(([title, href, note]) => <article className="card" key={title}><h3>{title}</h3><span className="badge">Open source</span><p className="next">{note}</p><Link className="native-owner" to={href}>View ↗</Link></article>)}</div></details></section>
}
