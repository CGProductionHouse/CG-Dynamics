import { useEffect, useState } from 'react'
import { loadNolanPackageEvidence } from '../../lib/nolanPackageEvidence'
import type { ActiveClientPackageEvidence } from '../../lib/packageEvidence'

// Lazy, read-only evidence disclosure. Reuse package authority rather than
// declaring template counts, scheduled rows or invoices to be paid entitlement.
export function NolanPackageEvidence({ month, refreshGeneration }: { month: string; refreshGeneration: number }) {
  const [requested, setRequested] = useState(false)
  const [data, setData] = useState<ActiveClientPackageEvidence[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [retry, setRetry] = useState(0)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  useEffect(() => {
    if (!requested) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setData(null)
      setCheckedAt(null)
      try {
        const result = await loadNolanPackageEvidence()
        if (!cancelled) { setData(result.data); setCheckedAt(result.checkedAt) }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Package evidence unavailable.') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [requested, retry, refreshGeneration, month])
  return <details className="coverage-details" onToggle={e => { if (e.currentTarget.open) setRequested(true) }}><summary>Package evidence & reconciliation gaps</summary>
    <div className="coverage"><p>Current recorded package evidence, not proof of payment or historical entitlement for {month}. Scheduled counts, actual published posts and revision/crosspost deduplication remain separate.</p>
      {checkedAt && <p>Package evidence last read: {new Date(checkedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST. This is a source-read time, not independent verification.</p>}
      {error && <p role="alert">{error}</p>}{loading && <p role="status">Reading package authority…</p>}
      {requested && <button className="refresh-data" disabled={loading} onClick={() => setRetry(value => value + 1)}>{error ? 'Retry package evidence' : 'Refresh package evidence'}</button>}
      {data && <ul>{data.map(client => <li key={client.clientId}><strong>{client.clientName}</strong>: {client.confirmed ? 'Recorded package confirmation' : 'Unverified package'} · {client.conflicts.length} conflicts · {client.unknownFields.length} unknown fields<details><summary>View recorded allowance evidence</summary><ul>{Object.entries(client.fields).map(([field, value]) => <li key={field}>{field.replaceAll('_', ' ')}: {value.proposedValue === null ? 'Unknown' : String(value.proposedValue)} ({value.state})</li>)}</ul><p>{client.conflicts.join(' · ')}</p></details></li>)}</ul>}
    </div></details>
}
