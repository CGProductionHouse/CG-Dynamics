import { useState } from 'react'
import { buildMicrosoftRunReview, type ReviewRun, type ReviewItem } from '../../lib/microsoftRunReview'

export default function MicrosoftRunConflictReview({ run, items, state }: { run: ReviewRun; items: ReviewItem[]; state: 'loading' | 'ready' | 'error' }) {
  const [source, setSource] = useState('all'), [code, setCode] = useState('all'), [page, setPage] = useState(0)
  if (state !== 'ready') return <section aria-label="Conflict review" className="mt-5 rounded-xl border border-amber-300/20 p-4"><p role="status">{state === 'loading' ? 'Reading the exact run journal…' : 'Run journal unavailable. No zero-conflict or resolution claim can be made.'}</p></section>
  const review = buildMicrosoftRunReview(run, items)
  const sources = [...new Set(review.rows.map(row => row.source_name))].sort(), codes = [...new Set(review.rows.map(row => row.conflict_code))].sort()
  const filtered = review.rows.filter(row => (source === 'all' || row.source_name === source) && (code === 'all' || row.conflict_code === code))
  const pages = Math.max(1, Math.ceil(filtered.length / 50)), current = Math.min(page, pages - 1)
  function exportReview() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(review, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `microsoft-conflict-review-${run.id}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section aria-label="Conflict review" className="mt-5 rounded-2xl border border-amber-300/20 bg-black/20 p-4 sm:p-5">
    <h3 className="text-lg font-black text-white">Conflict review — no changes applied</h3>
    <p className="mt-2 text-sm text-white/70">{review.observed_conflicts} journal conflicts · {review.expected_conflicts ?? 'Unknown'} reported by the run · {review.uncoded} uncoded</p>
    {review.coverage !== 'journal_count_matches_only' && <p role="alert" className="mt-3 rounded-lg border border-amber-300/30 p-3 text-sm text-amber-100">Conflict coverage held: {review.count_gap === null ? 'the reported count is unavailable or contradictory.' : `run summary and journal differ by ${review.count_gap}.`} Do not treat this as a complete resolution list.</p>}
    <p className="mt-3 text-xs text-white/50">Uncoded is unknown, not safe to apply. This journal has no current source/target revision proof. Prepare a fresh canonical preview; never force an old conflict or infer dates.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <label className="text-xs text-white/65">Conflict source<select aria-label="Conflict source" className="ml-2 max-w-full rounded bg-black p-2" value={source} onChange={e => { setSource(e.target.value); setPage(0) }}><option value="all">All sources</option>{sources.map(value => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs text-white/65">Conflict reason<select aria-label="Conflict reason" className="ml-2 rounded bg-black p-2" value={code} onChange={e => { setCode(e.target.value); setPage(0) }}><option value="all">All reasons</option>{codes.map(value => <option key={value}>{value}</option>)}</select></label>
      <button type="button" onClick={exportReview} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white">Download private review packet</button>
    </div>
    <p className="mt-2 text-xs text-white/40">The download contains internal opaque references, not task descriptions, contacts or financial copy. Keep it private. It cannot apply changes.</p>
    <div className="mt-4 space-y-2">{filtered.slice(current * 50, (current + 1) * 50).map(row => <div key={row.journal_id} className="break-words rounded-lg border border-white/10 p-3 text-sm text-white/70"><p>{row.source_name} · {row.destination} · {row.conflict_code}</p><p className="mt-1 text-xs text-white/45">Journal reference {row.journal_id} · Fresh canonical preview required</p></div>)}</div>
    {!filtered.length && <p className="mt-3 text-sm text-white/60">No journal conflicts match this filter. This does not clear any summary coverage hold.</p>}
    <div className="mt-4 flex items-center gap-3 text-xs text-white/60"><button type="button" aria-label="Previous conflict page" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button><span>Page {current + 1} of {pages} · {filtered.length} references</span><button type="button" aria-label="Next conflict page" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</button></div>
  </section>
}
