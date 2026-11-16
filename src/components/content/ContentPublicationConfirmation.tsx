import { useEffect, useRef, useState } from 'react'
import { prepareStaffPublication, confirmStaffPublication, canPrepareFacebookPhotoReview, type PublicationReview, type StaffPublicationPreview } from '../../lib/socialPublishing'

/** Staff-only parent, approved review, and source-only UI release flag. Backend
 * independently enforces its own default-off dispatch/exact-account packet.
 */
export function ContentPublicationConfirmation({ review, onConfirmed }: { review: PublicationReview; onConfirmed: () => void }) {
  const reviewId = review.id
  const [preview, setPreview] = useState<StaffPublicationPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const epoch = useRef(0)
  useEffect(() => () => { epoch.current++ }, [])
  const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 text-sm text-white disabled:opacity-40'
  async function prepare() {
    if (busy || !canPrepareFacebookPhotoReview(review)) return
    const request = ++epoch.current
    setBusy(true); setPreview(null); setMessage(null)
    const result = await prepareStaffPublication(reviewId)
    if (request !== epoch.current) return
    setBusy(false); setPreview(result)
    if (!result) setMessage('Scheduling could not be prepared. Publishing may be disabled or its account, image or schedule checks need review. Continue using Teams and the native platform.')
  }
  async function confirm() {
    if (!preview || busy || !canPrepareFacebookPhotoReview(review)) return
    const selected = preview, request = ++epoch.current
    // Discard before sending. A lost response must be reconciled in status;
    // never offer a blind retry of an authority-creating request.
    setBusy(true); setPreview(null); setMessage(null)
    const result = await confirmStaffPublication(selected)
    if (request !== epoch.current) return
    setBusy(false)
    setMessage(result ? 'Confirmation recorded. Refresh publishing status to follow this job; it is not a verified live post yet.'
      : 'Confirmation could not be verified. Refresh publishing status before trying again; the job may already exist.')
    onConfirmed()
  }
  if (!canPrepareFacebookPhotoReview(review)) return null
  return <div className="space-y-3 rounded-lg border border-white/10 p-3" aria-label="Confirm Facebook publishing">
    <button className={button} type="button" disabled={busy} onClick={() => void prepare()}>Prepare Facebook schedule</button>
    {busy && <p role="status" className="text-sm text-white/70">Checking the exact publication…</p>}
    {message && <p role="status" className="text-sm leading-relaxed text-amber-100">{message}</p>}
    {preview && <div className="min-w-0 space-y-3">
      <p className="break-words text-sm font-semibold text-white">Facebook Page · {preview.accountId}</p>
      <p className="text-sm text-brand-teal">{new Date(preview.scheduledAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST</p>
      <p className="whitespace-pre-wrap break-words text-sm text-white/80">{preview.caption}</p>
      <p className="text-xs leading-relaxed text-white/60">Uses this review’s approved image. Confirm only if this exact post is cleared for publication and is not already scheduled on the native platform. Teams stays unchanged.</p>
      <div className="flex flex-wrap gap-2"><button className={button} type="button" disabled={busy} onClick={() => void confirm()}>Confirm this Facebook schedule</button>
        <button className={button} type="button" disabled={busy} onClick={() => setPreview(null)}>Cancel</button></div>
    </div>}
  </div>
}
