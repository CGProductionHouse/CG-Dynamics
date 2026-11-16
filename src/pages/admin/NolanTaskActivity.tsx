import { useEffect, useState } from 'react'
import { type PlannerActivityLog } from '../../lib/planner'
import { loadNolanTaskActivity } from '../../lib/nolanTaskActivity'
import { nolanEvidenceAge } from '../../lib/nolanTaskEvidence'

export function NolanTaskActivity({ taskId, directory, role, sourceUnavailable }: {
  taskId: string | null; directory: Map<string, string> | null; role: string; sourceUnavailable: boolean
}) {
  const [requested, setRequested] = useState(false)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ taskId: string; row: PlannerActivityLog | null; checkedAt: string } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const permitted = role === 'admin' || role === 'manager'
  useEffect(() => {
    let cancelled = false
    if (!requested || !permitted || !taskId || sourceUnavailable) return
    void loadNolanTaskActivity(taskId, role).then(read => {
      if (!cancelled) setResult(read)
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Activity unavailable.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [requested, retry, taskId, permitted, role, sourceUnavailable])
  const requestRead = () => {
    if (!permitted || !taskId || sourceUnavailable) return
    setResult(null); setError(''); setLoading(true); setRequested(true); setRetry(n => n + 1)
  }
  if (!permitted) return null
  const evidence = !sourceUnavailable && result?.taskId === taskId ? result : null
  return <details onToggle={e => { if (e.currentTarget.open) requestRead() }}>
    <summary>Recorded action evidence</summary>
    <p>Last verified execution action: Unknown. An audit entry records a database action, not independent execution, delivery or current agent activity.</p>
    {!taskId ? <p>No supported task activity reader for this source.</p> : sourceUnavailable ? <p>Task source unavailable or refreshing. Refresh the task before reading activity.</p> : <>
      {loading && <p role="status">Reading task activity…</p>}
      {error && <p role="alert">{error} No latest action is claimed.</p>}
      {evidence && <><p>Activity read: {evidence.checkedAt}. Latest returned recorded action, not complete audit-history coverage.</p>
        {evidence.row ? <dl>
          <dt>Recorded action</dt><dd>{evidence.row.action}</dd>
          <dt>Recorded at</dt><dd>{evidence.row.created_at} · {nolanEvidenceAge(evidence.row.created_at)}</dd>
          <dt>Recorded actor</dt><dd>{evidence.row.actor_user_id ? `${directory?.get(evidence.row.actor_user_id) ?? 'Profile name unavailable'} · ${evidence.row.actor_user_id}` : 'Unknown — no actor profile recorded'}</dd>
          <dt>Activity record ID</dt><dd>{evidence.row.id}</dd>
        </dl> : <p>No activity returned for this exact task. No verified action is inferred.</p>}
      </>}
      <button className="refresh-data" disabled={loading} onClick={requestRead}>{requested ? 'Refresh action evidence' : 'Load action evidence'}</button>
    </>}
  </details>
}
