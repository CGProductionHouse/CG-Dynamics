import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONTENT_REVIEW_BUCKET, REVIEW_LABELS, type ContentReview } from '../../lib/contentReviews'

export function ContentReviewCard({ review, canDecide, onChanged, staffView = false }: { review: ContentReview; canDecide: boolean; onChanged: () => void; staffView?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [events, setEvents] = useState<Array<{ action: string; note: string | null }>>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    void supabase.storage.from(CONTENT_REVIEW_BUCKET).createSignedUrl(review.asset_path, 600).then(result => {
      if (!active) return
      setUrl(result.data?.signedUrl ?? null)
      setError(result.error?.message ?? null)
    })
    if (staffView) void supabase.from('content_review_events').select('action,note').eq('version_id', review.id).order('created_at').then(result => {
      if (active) setEvents(result.data ?? [])
    })
    return () => { active = false }
  }, [review.asset_path, review.id, review.state, staffView])
  async function decide(approve: boolean) {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const result = await supabase.rpc('decide_content_review', { p_version_id: review.id, p_approve: approve, p_note: note || null })
      if (result.error) throw result.error
      onChanged()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not record your decision.') }
    finally { setBusy(false) }
  }
  return <article className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
    <div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-white">{review.title}</h3><span className="text-xs text-brand-teal">{REVIEW_LABELS[review.state]}</span></div>
    {staffView && review.client?.name && <p className="text-xs text-white/60">{review.client.name}</p>}
    {url && (review.media_type === 'video/mp4' ? <video controls preload="metadata" src={url} className="max-h-96 w-full rounded-lg" /> : <img src={url} alt={review.title} className="max-h-96 w-full rounded-lg object-contain" />)}
    <p className="whitespace-pre-wrap break-words text-sm text-white/80">{review.caption}</p>
    <p className="text-xs text-white/60">{review.channels.join(' · ')} · {new Date(review.scheduled_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST</p>
    {review.state === 'approved' && <p className="text-xs text-amber-200">Approved. Publish manually through the connected channel; this item has not been scheduled or posted by Dynamics.</p>}
    {canDecide && <div className="space-y-2">
      <label className="block text-sm text-white/70">Comment<textarea className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-black/30 p-2" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} /></label>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !url} onClick={() => void decide(true)} className="min-h-11 rounded-lg bg-brand-teal px-4 font-bold text-black disabled:opacity-40">Approve</button>
      <button type="button" disabled={busy || !note.trim()} onClick={() => void decide(false)} className="min-h-11 rounded-lg border border-white/20 px-4 text-white disabled:opacity-40">Request changes</button></div>
    </div>}
    {staffView && events.length > 0 && <details><summary className="cursor-pointer text-xs text-white/60">Review history</summary><ul className="mt-2 space-y-1">{events.map((event, index) => <li key={index} className="text-xs text-white/60">{event.action.replaceAll('_', ' ')}{event.note ? `: ${event.note}` : ''}</li>)}</ul></details>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
  </article>
}
