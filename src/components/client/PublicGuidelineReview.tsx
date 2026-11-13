import { useEffect, useRef, useState } from 'react'
import { ContentGuidelineDocument } from './ContentGuidelineDocument'
import { readGuidelineReviews, respondToGuideline, type SharedContentGuideline, type GuidelineResponseInput } from '../../lib/publicContentGuidelines'
import { REVIEW_LABELS, reviewInputError, type GuidelineReviewAction, type GuidelineReviews, type GuidelineVideoReview } from '../../lib/guidelineReviews'

const actions: { action: GuidelineReviewAction; label: string }[] = [
  { action: 'approved', label: 'Approve idea' }, { action: 'changes_requested', label: 'Request changes' },
  { action: 'declined', label: 'Decline idea' }, { action: 'comment', label: 'Comment' },
]
const field = 'mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white focus-visible:outline-2 focus-visible:outline-[#2dd4bf]'
export function PublicGuidelineReview({ data, slug, token }: { data: SharedContentGuideline; slug: string; token: string }) {
  const [state, setState] = useState<{ data: GuidelineReviews | null; error: string | null }>({ data: null, error: null })
  const [refresh, setRefresh] = useState(0)
  const [name, setName] = useState('')
  useEffect(() => {
    let active = true
    void readGuidelineReviews(slug, token).then(result => { if (active) setState(result) })
    return () => { active = false }
  }, [slug, token, refresh])
  const reviews = state.data?.published_at === data.guide.published_at
    && state.data.videos.length === data.guide.videos.length
    && state.data.videos.every(v => data.guide.videos.some(video => video.position === v.position)) ? state.data : null
  const error = state.error ?? (state.data && !reviews ? 'This guideline has been updated. Refresh this page to review the latest version.' : null)
  const reviewed = reviews?.videos.filter(v => v.decision !== 'pending').length ?? 0
  return <ContentGuidelineDocument guide={data.guide} client={data.client} selected
    clientPath={`/guidelines/${slug}/${token}?v=cg2-${Date.parse(data.guide.published_at)}`} linkAccess="public"
    reviewSummary={<div className="mt-6 border-t border-white/10 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm font-semibold text-[#2dd4bf]">{reviews ? `${reviewed} of ${data.guide.videos.length} ideas reviewed` : error ? 'Reviews unavailable' : 'Loading reviews…'}</p>
        <button type="button" onClick={() => setRefresh(v => v + 1)} className="min-h-11 text-xs font-semibold text-slate-300 underline underline-offset-4">Refresh reviews</button>
      </div>
      <p className="mt-1 text-xs leading-6 text-slate-400">Review each idea below. Your response is saved for the CG team.</p>
      {error && <p role="alert" className="mt-3 text-sm text-orange-200">{error}</p>}
    </div>}
    renderVideoReview={position => <VideoReview key={position} position={position} review={reviews?.videos.find(v => v.position === position) ?? null}
      name={name} setName={setName} unavailable={Boolean(error)} onSave={async input => {
        const result = await respondToGuideline(slug, token, input)
        if (result.data) setState(result)
        return result.error
      }} publishedAt={data.guide.published_at} />}
  />
}

function VideoReview({ position, review, name, setName, onSave, publishedAt, unavailable }: {
  position: number; review: GuidelineVideoReview | null; name: string; setName: (name: string) => void; publishedAt: string; unavailable: boolean
  onSave: (input: GuidelineResponseInput) => Promise<string | null>
}) {
  const [action, setAction] = useState<GuidelineReviewAction | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // A lost response can be retried safely. Changing the payload starts a new action.
  const retry = useRef<{ fingerprint: string; id: string } | null>(null)
  async function save() {
    if (!action || !review || busy) return
    const invalid = reviewInputError(name, message, action)
    if (invalid) { setError(invalid); return }
    const fingerprint = JSON.stringify([publishedAt, position, action, name.trim(), message.trim(), review.revision])
    if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, id: crypto.randomUUID() }
    setBusy(true); setError(null); setSaved(false)
    const failure = await onSave({ publishedAt, position, action, name, message, requestId: retry.current.id, expectedRevision: review.revision })
    setBusy(false)
    if (failure) { setError(failure); return }
    setSaved(true); setAction(null); setMessage(''); retry.current = null
  }
  return <section aria-label={`Review video ${position}`} className="mt-7 rounded-2xl border border-[#2dd4bf]/20 bg-[#2dd4bf]/[0.035] p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="text-sm font-bold text-white">Your review</h4>
      <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${review?.decision === 'approved' ? 'border-[#2dd4bf]/30 text-[#2dd4bf]' : 'border-white/15 text-slate-300'}`}>{review ? REVIEW_LABELS[review.decision] : unavailable ? 'Reviews unavailable' : 'Loading…'}</span>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">{actions.map(item => <button key={item.action} type="button" disabled={!review || busy} aria-pressed={action === item.action}
      onClick={() => { setAction(item.action); setError(null); setSaved(false) }}
      className={`min-h-11 rounded-full border px-4 py-2 text-xs font-bold transition disabled:opacity-40 ${action === item.action ? 'border-white bg-white text-[#06110f]' : 'border-white/15 text-white hover:border-[#2dd4bf]/50'}`}>{item.label}</button>)}</div>
    {action && <form onSubmit={event => { event.preventDefault(); void save() }} className="mt-5 space-y-4 border-t border-white/10 pt-5">
      <label className="block text-xs font-semibold text-slate-300">Your name<input autoComplete="name" required maxLength={80} value={name} disabled={busy} onChange={event => setName(event.target.value)} className={field} /></label>
      <label className="block text-xs font-semibold text-slate-300">{action === 'approved' ? 'Comment (optional)' : 'Your comment'}<textarea required={action !== 'approved'} maxLength={3000} rows={3} value={message} disabled={busy} onChange={event => setMessage(event.target.value)} className={`${field} resize-y leading-6`} /></label>
      <p className="text-xs leading-6 text-slate-400">Your name and response are visible to the CG team and anyone with this guideline link. This reviews the idea, rather than approving a finished video for posting.</p>
      {error && <p role="alert" className="text-sm text-orange-200">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className="min-h-11 rounded-full bg-white px-6 text-sm font-bold text-[#06110f] disabled:opacity-50">{busy ? 'Saving…' : action === 'approved' ? 'Confirm approval' : 'Send response'}</button>
        <button type="button" disabled={busy} onClick={() => { setAction(null); setError(null) }} className="min-h-11 px-4 text-sm text-slate-300">Cancel</button></div>
    </form>}
    {saved && <p role="status" className="mt-4 text-sm font-semibold text-[#2dd4bf]">Response saved. Thank you.</p>}
    {Boolean(review?.responses.length) && <details className="mt-5 border-t border-white/10 pt-4">
      <summary className="min-h-11 cursor-pointer text-xs font-semibold text-slate-300">Responses ({review!.responses.length}{review!.responses.length === 20 ? ' most recent' : ''})</summary>
      <ol className="space-y-4 pt-2">{review!.responses.map(response => <li key={response.id} className="rounded-xl border border-white/10 bg-black/15 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-white">{response.reviewer_name} · {REVIEW_LABELS[response.action]}</span><time dateTime={response.created_at} className="text-slate-400">{new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Johannesburg' }).format(new Date(response.created_at))}</time></div>
        {response.message && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300">{response.message}</p>}
      </li>)}</ol>
    </details>}
  </section>
}
