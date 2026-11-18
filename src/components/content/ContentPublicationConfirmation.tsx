import { useEffect, useRef, useState } from 'react'
import { prepareStaffPublication, confirmStaffPublication, reconcileStaffPublicationConfirmation, canPrepareFacebookPhotoReview, inspectStaffPublication, publicationNextAction, FACEBOOK_INSPECTION_LABELS, type StaffFacebookInspection, type PublicationReview, type StaffPublicationPreview } from '../../lib/socialPublishing'

/** Staff-only parent, approved review, and source-only UI release flag. Backend
 * independently enforces its own default-off dispatch/exact-account packet.
 */
export function ContentPublicationConfirmation({ review, onConfirmed }: { review: PublicationReview; onConfirmed: () => void }) {
  const reviewId = review.id
  const [preview, setPreview] = useState<StaffPublicationPreview | null>(null)
  const [inspection, setInspection] = useState<StaffFacebookInspection | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState<StaffPublicationPreview | null>(null)
  const [recorded, setRecorded] = useState(false)
  // Latch for this mounted review, including after a verified receipt. Stale
  // event handlers must not create another confirmation after reconciliation.
  const confirmationAttempt = useRef<StaffPublicationPreview | null>(null)
  const epoch = useRef(0)
  useEffect(() => () => { epoch.current++ }, [])
  const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-white/15 px-3 text-sm text-white disabled:opacity-40'
  async function inspect() {
    if (busy || confirmationAttempt.current || recorded || !canPrepareFacebookPhotoReview(review)) return
    const request = ++epoch.current
    setBusy(true); setPreview(null); setInspection(null); setMessage(null)
    const result = await inspectStaffPublication(reviewId)
    if (request !== epoch.current) return
    setBusy(false); setInspection(result.inspection); setMessage(result.message)
  }
  async function prepare() {
    if (busy || confirmationAttempt.current || recorded || !canPrepareFacebookPhotoReview(review)) return
    const request = ++epoch.current
    setBusy(true); setPreview(null); setInspection(null); setMessage(null)
    const result = await prepareStaffPublication(reviewId)
    if (request !== epoch.current) return
    setBusy(false); setPreview(result)
    if (!result) setMessage('Scheduling could not be prepared. Publishing may be disabled or its account, image or schedule checks need review. Continue using Teams and the native platform.')
  }
  async function confirm() {
    if (!preview || busy || confirmationAttempt.current || recorded || !canPrepareFacebookPhotoReview(review)) return
    const selected = Object.freeze({ ...preview }), request = ++epoch.current
    confirmationAttempt.current = selected
    setPending(selected)
    // Discard before sending. A lost response must be reconciled in status;
    // never offer a blind retry of an authority-creating request.
    setBusy(true); setPreview(null); setMessage(null)
    const result = await confirmStaffPublication(selected)
    if (request !== epoch.current) return
    setBusy(false)
    if (result) { setPending(null); setRecorded(true) }
    setMessage(result ? 'Confirmation recorded. Refresh publishing status to follow this job; it is not a verified live post yet.'
      : 'Confirmation could not be verified; the job may already exist. Check this confirmation before preparing anything else.')
    onConfirmed()
  }
  async function reconcile() {
    const selected = confirmationAttempt.current
    if (!selected || busy) return
    const request = ++epoch.current
    setBusy(true); setMessage(null)
    const result = await reconcileStaffPublicationConfirmation(selected)
    if (request !== epoch.current) return
    setBusy(false)
    if (result) {
      setPending(null); setRecorded(true)
      setMessage('Matching confirmation found. Refresh publishing status to follow this job; it is not a verified live post yet.')
      onConfirmed()
    } else setMessage('Confirmation is still unverified. No new confirmation was sent. Check publishing status and ask a publishing manager to review the attempt.')
  }
  if (!canPrepareFacebookPhotoReview(review)) return null
  return <div className="space-y-3 rounded-lg border border-white/10 p-3" aria-label="Confirm Facebook publishing">
    <div className="flex flex-wrap gap-2">
      <button className={button} type="button" disabled={busy || !!pending || recorded} onClick={() => void inspect()}>Check Facebook readiness</button>
      <button className={button} type="button" disabled={busy || !!pending || recorded || !!inspection?.checks.some(check => check.status !== 'pass')} onClick={() => void prepare()}>Prepare Facebook schedule</button>
      {pending && <button className={button} type="button" disabled={busy} onClick={() => void reconcile()}>Check confirmation</button>}
    </div>
    {busy && <p role="status" className="text-sm text-white/70">Checking the exact publication…</p>}
    {message && <p role="status" className="text-sm leading-relaxed text-amber-100">{message}</p>}
    {inspection && <div className="space-y-3" aria-label="Facebook readiness results">
      <p className="break-words text-sm font-semibold text-white">{inspection.accountName ?? 'Facebook Page'} · {inspection.accountId}</p>
      <p className="text-xs text-white/60">Read-only check · {new Date(inspection.checkedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST. No publishing job created.</p>
      <ul className="space-y-2">{inspection.checks.map(check => <li key={check.key} className="space-y-1 rounded-lg border border-white/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-white">{FACEBOOK_INSPECTION_LABELS[check.key]}</span><span className={`text-xs ${check.status === 'pass' ? 'text-brand-teal' : 'text-amber-100'}`}>{check.status === 'pass' ? 'Verified' : check.status === 'blocked' ? 'Needs review' : 'Unavailable'}</span></div>
        {check.status !== 'pass' && <p className="text-xs leading-relaxed text-white/70">{publicationNextAction({ state: 'blocked', errorCode: check.code, providerMayHaveStarted: false })}</p>}
      </li>)}</ul>
    </div>}
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
