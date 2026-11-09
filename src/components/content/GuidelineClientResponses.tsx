import { useEffect, useState } from 'react'
import { readStaffGuidelineReviews } from '../../lib/publicContentGuidelines'
import { REVIEW_LABELS, type StaffGuidelineResponse } from '../../lib/guidelineReviews'

export function GuidelineClientResponses({ runId }: { runId: string }) {
  const [result, setResult] = useState<{ runId: string; data: StaffGuidelineResponse[] | null; error: string | null }>({ runId: '', data: null, error: null })
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    let active = true
    if (runId) void readStaffGuidelineReviews(runId).then(value => { if (active) setResult({ runId, ...value }) })
    return () => { active = false }
  }, [runId, refresh])
  if (!runId) return null
  const current = result.runId === runId ? result : null
  return <section aria-label="Client idea responses" className="rounded-xl border border-brand-teal/20 bg-brand-teal/[0.035] p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-white">Client idea responses</h3><p className="mt-1 text-xs leading-6 text-white/50">Shared-link responses. Names are self-reported; finished-video approval and posting stay separate.</p></div>
      <button type="button" onClick={() => setRefresh(v => v + 1)} className="min-h-11 rounded-full border border-white/15 px-4 text-xs font-semibold text-white">Refresh responses</button></div>
    {!current ? <p role="status" className="mt-3 text-sm text-white/60">Loading responses…</p>
      : current.error ? <p role="alert" className="mt-3 text-sm text-orange-200">{current.error}</p>
      : !current.data?.length ? <p className="mt-3 text-sm text-white/60">No client responses recorded yet.</p>
      : <details className="mt-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-brand-teal">View responses ({current.data.length}{current.data.length === 100 ? ' most recent' : ''})</summary><ol className="space-y-3">{current.data.map(row => <li key={row.id} className="rounded-xl border border-white/10 bg-black/10 p-4">
        <p className="text-sm font-semibold text-white">Video {String(row.position).padStart(2, '0')} · {row.title}</p>
        <p className="mt-2 text-xs text-brand-teal">{REVIEW_LABELS[row.action]} · {row.reviewer_name} · {new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(new Date(row.created_at))}</p>
        {(!row.current_publication || !row.matches_current_video) && <p className="mt-2 text-xs text-orange-200">{!row.current_publication ? 'Earlier published version — review again after republishing.' : 'Saved video has changed — this response applies to the published wording.'}</p>}
        {row.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-white/70">{row.message}</p>}
      </li>)}</ol></details>}
  </section>
}
