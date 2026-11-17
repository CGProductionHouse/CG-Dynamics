import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { CONTENT_CHANNELS, listContentReviews, submitContentReview, reconcileContentReviewSubmission, UnverifiedContentReviewSubmission, type ContentReview, type ContentReviewSubmissionAttempt } from '../../lib/contentReviews'
import type { MonthlyDeliverable } from '../../lib/planner'
import { ContentReviewCard } from './ContentReviewCard'

export function ContentProductionPanel({ deliverable, canManage }: { deliverable: MonthlyDeliverable; canManage: boolean }) {
  const [design, setDesign] = useState('')
  const [page, setPage] = useState('')
  const [setWorkspace, setSetWorkspace] = useState(false)
  const [caption, setCaption] = useState('')
  const [channels, setChannels] = useState<string[]>([])
  const [time, setTime] = useState('09:00')
  const [clientRequired, setClientRequired] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [reviews, setReviews] = useState<ContentReview[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [unverified, setUnverified] = useState<ContentReviewSubmissionAttempt | null>(null)
  const inFlight = useRef(false), active = useRef(true), fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const isVideo = ['video', 'reel'].includes(deliverable.deliverable_type)
  useEffect(() => {
    let active = true
    void Promise.all([
      supabase.from('deliverable_creative_sources').select('canva_design_id,canva_page_id').eq('deliverable_id', deliverable.id).maybeSingle(),
      listContentReviews(deliverable.id),
    ]).then(([source, versions]) => {
      if (!active) return
      setDesign(source.data?.canva_design_id ?? '')
      setPage(source.data?.canva_page_id ?? '')
      setReviews((versions.data ?? []) as ContentReview[])
      setError(source.error?.message ?? versions.error?.message ?? null)
    })
    return () => { active = false }
  }, [deliverable.id, revision])
  async function saveSource() {
    if (inFlight.current || unverified) return
    inFlight.current = true
    setBusy(true); setError(null); setMessage(null)
    try {
      const result = await supabase.rpc('save_content_creative_source', { p_deliverable_id: deliverable.id, p_design_id: design, p_page_id: page, p_set_client_workspace: canManage && setWorkspace })
      if (!active.current) return
      if (result.error) throw result.error
      setMessage('Canva page linked. Submit a new review when the final export is ready.')
      setRevision(value => value + 1)
    } catch (reason) { if (active.current) setError(reason instanceof Error ? reason.message : 'Could not link this Canva page.') }
    finally { inFlight.current = false; if (active.current) setBusy(false) }
  }
  function submissionConfirmed() {
    setUnverified(null); setFile(null)
    if (fileInput.current) fileInput.current.value = ''
    setError(null); setMessage('Review saved. Its current approval status appears below. Scheduling and publishing are separate steps.')
    setRevision(value => value + 1)
  }
  async function submit() {
    if (!file || !deliverable.scheduled_date || busy || inFlight.current || unverified) return
    inFlight.current = true
    setBusy(true); setError(null); setMessage(null)
    try {
      await submitContentReview({ deliverableId: deliverable.id, file, caption, channels,
        scheduledAt: `${deliverable.scheduled_date}T${time}:00+02:00`, clientRequired })
      if (active.current) submissionConfirmed()
    } catch (reason) {
      if (!active.current) return
      if (reason instanceof UnverifiedContentReviewSubmission) setUnverified(reason.attempt)
      setError(reason instanceof Error ? reason.message : 'Could not submit this review.')
    }
    finally { inFlight.current = false; if (active.current) setBusy(false) }
  }
  async function checkSubmission() {
    if (!unverified || inFlight.current) return
    inFlight.current = true; setBusy(true); setError(null); setMessage(null)
    try {
      const receipt = await reconcileContentReviewSubmission(unverified)
      if (!active.current) return
      if (receipt) submissionConfirmed()
      else setError('The submission is still unverified. Check again when your connection returns, or ask a manager to inspect this schedule item. No second review has been sent.')
    } finally { inFlight.current = false; if (active.current) setBusy(false) }
  }
  const input = 'mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-black/30 p-2 text-sm text-white'
  return <section className="space-y-4 border-t border-white/10 pt-4">
    <h3 className="font-bold text-white">Creative & approval</h3>
    {!isVideo && <div className="space-y-2">
      <label className="block text-xs text-white/60">Canva design ID<input disabled={busy || !!unverified} className={input} value={design} onChange={event => setDesign(event.target.value)} /></label>
      <label className="block text-xs text-white/60">Exact Canva page ID<input disabled={busy || !!unverified} className={input} value={page} onChange={event => setPage(event.target.value)} /></label>
      {canManage && <label className="flex min-h-11 items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={setWorkspace} onChange={event => setSetWorkspace(event.target.checked)} />Use as the client's primary Canva design</label>}
      <button type="button" disabled={busy || !!unverified || !design.trim() || !page.trim()} onClick={() => void saveSource()} className="min-h-11 rounded-lg border border-white/20 px-3 text-sm text-white disabled:opacity-40">Save Canva page link</button>
      {/^[A-Za-z0-9_-]{6,100}$/.test(design) && <a href={`https://www.canva.com/design/${design}/edit`} target="_blank" rel="noreferrer" className="ml-3 text-sm text-brand-teal">Open Canva design</a>}
    </div>}
    <details><summary className="cursor-pointer py-2 text-sm font-bold text-brand-teal">Send final creative for review</summary><div className="space-y-3 pt-2">
      <p className="text-xs text-white/60">Upload the final export. Canva or the linked guideline remains the production source. Each submission creates a new review version.</p>
      <label className="block text-xs text-white/60">Final JPG, PNG, WebP or MP4 · up to 50 MB<input ref={fileInput} disabled={busy || !!unverified} className={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>
      <label className="block text-xs text-white/60">Caption<textarea disabled={busy || !!unverified} className={`${input} min-h-24`} value={caption} maxLength={10000} onChange={event => setCaption(event.target.value)} /></label>
      <fieldset disabled={busy || !!unverified}><legend className="text-xs text-white/60">Channels</legend><div className="flex flex-wrap gap-3">{CONTENT_CHANNELS.map(channel => <label key={channel} className="flex min-h-11 items-center gap-2 text-sm text-white"><input type="checkbox" checked={channels.includes(channel)} onChange={event => setChannels(current => event.target.checked ? [...current, channel] : current.filter(value => value !== channel))} />{channel}</label>)}</div></fieldset>
      <p className="text-xs text-white/60">Client Schedule date: {deliverable.scheduled_date ?? 'Set and save a schedule date first'}</p>
      <label className="block text-xs text-white/60">Publication time (SAST)<input disabled={busy || !!unverified} className={input} type="time" value={time} onChange={event => setTime(event.target.value)} /></label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-white"><input type="checkbox" checked={clientRequired} disabled={!canManage || busy || !!unverified} onChange={event => setClientRequired(event.target.checked)} />Client approval required</label>
      <button type="button" disabled={busy || !!unverified || !file || !caption.trim() || !channels.length || !deliverable.scheduled_date || !time} onClick={() => void submit()} className="min-h-11 rounded-lg bg-brand-teal px-4 font-bold text-black disabled:opacity-40">{busy ? 'Saving…' : 'Send for review'}</button>
      {unverified && <div className="space-y-2 rounded-lg border border-amber-300/25 p-3" aria-label="Unverified review submission">
        <p className="text-sm text-amber-100">This submission may already be saved. Check the same attempt before sending another version.</p>
        <button type="button" disabled={busy} onClick={() => void checkSubmission()} className="min-h-11 rounded-lg border border-white/20 px-3 text-sm text-white disabled:opacity-40">Check submission</button>
      </div>}
    </div></details>
    {message && <p role="status" className="text-sm text-brand-teal">{message}</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {reviews.map(review => <ContentReviewCard staffView canManagePublishing={canManage} key={review.id} review={review} canDecide={canManage && review.state === 'internal_review'} onChanged={() => setRevision(value => value + 1)} />)}
  </section>
}
