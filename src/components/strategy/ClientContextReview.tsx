import { useEffect, useState } from 'react'
import {
  listPendingClientContextUpdates,
  reviewClientContextUpdate,
  type PendingClientContextUpdate,
} from '../../lib/clientContextReview'

function lines(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

export function ClientContextReview({ clientId }: { clientId: string }) {
  const [updates, setUpdates] = useState<PendingClientContextUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void listPendingClientContextUpdates(clientId)
      .then(rows => { if (active) setUpdates(rows) })
      .catch(() => { if (active) setError('Client updates could not be loaded safely.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [clientId])

  async function decide(update: PendingClientContextUpdate, decision: 'incorporated' | 'rejected') {
    setBusyId(update.id)
    setError(null)
    setNotice(null)
    try {
      await reviewClientContextUpdate(clientId, update.id, decision)
      setRejectId(null)
      setUpdates(current => current.filter(row => row.id !== update.id))
      setNotice(decision === 'incorporated'
        ? 'Source confirmed. The strategy draft is unchanged until the guarded generator runs.'
        : 'Update rejected; it will not ground strategy.')
      try {
        setUpdates(await listPendingClientContextUpdates(clientId))
      } catch {
        setError('Decision saved, but the remaining update queue could not be refreshed.')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not review this exact client update.')
    } finally {
      setBusyId(null)
    }
  }

  if (!loading && updates.length === 0 && !error && !notice) return null
  return (
    <section className="mt-6 rounded-2xl border border-white/[0.08] bg-brand-surface p-4 sm:p-5" aria-label="Client update review">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Client updates</h2>
        {!loading && updates.length > 0 && <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">{updates.length} to review</span>}
      </div>
      {loading && <p className="mt-3 text-sm text-brand-primary">Loading exact-client updates…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm text-brand-teal">{notice}</p>}
      <div className="mt-3 space-y-2">
        {updates.map(update => (
          <details key={update.id} className="rounded-xl border border-white/[0.08] bg-black/10 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-white">
              {update.title} <span className="ml-2 text-xs font-normal text-brand-primary">{update.source_meeting_date ?? update.created_at.slice(0, 10)}</span>
            </summary>
            <div className="mt-3 space-y-3 text-sm leading-6 text-brand-primary">
              <p className="whitespace-pre-wrap">{update.body || 'No note body recorded.'}</p>
              {lines(update.decisions).length > 0 && <div><p className="font-bold text-white">Recorded decisions</p><ul className="mt-1 list-disc pl-5">{lines(update.decisions).map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
              {lines(update.unresolved).length > 0 && <div><p className="font-bold text-white">Open questions</p><ul className="mt-1 list-disc pl-5">{lines(update.unresolved).map((line, index) => <li key={index}>{line}</li>)}</ul></div>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" disabled={busyId !== null} onClick={() => void decide(update, 'incorporated')}
                  className="min-h-11 rounded-lg bg-brand-teal px-4 text-sm font-bold text-brand-bg disabled:opacity-50">Confirm source</button>
                <button type="button" disabled={busyId !== null} onClick={() => setRejectId(update.id)}
                  className="min-h-11 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white disabled:opacity-50">Reject</button>
              </div>
              {rejectId === update.id && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/5 p-3">
                <span className="text-sm text-white">Exclude this source from strategy?</span>
                <button type="button" disabled={busyId !== null} onClick={() => void decide(update, 'rejected')}
                  className="min-h-11 rounded-lg bg-red-700 px-3 text-sm font-semibold text-white disabled:opacity-50">Confirm rejection</button>
                <button type="button" onClick={() => setRejectId(null)} className="min-h-11 px-3 text-sm text-brand-primary">Cancel</button>
              </div>}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
