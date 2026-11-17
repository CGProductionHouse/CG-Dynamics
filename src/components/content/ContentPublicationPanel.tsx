import { useEffect, useRef, useState } from 'react'
import clockIcon from '../../assets/lucide/clock.svg'
import externalLinkIcon from '../../assets/lucide/external-link.svg'
import { getStaffPublicationStatus, withdrawStaffPublication, canPrepareFacebookPhotoReview, publicationNextAction, PUBLICATION_STATE_LABELS, PUBLICATION_CONFIRMATION_VISIBLE, type PublicationReview, type StaffPublication, type StaffPublicationStatus } from '../../lib/socialPublishing'
import { ContentPublicationConfirmation } from './ContentPublicationConfirmation'

export function ContentPublicationPanel({ review }: { review: PublicationReview }) {
  return <PublicationPanelBody key={review.id} review={review} />
}

function PublicationPanelBody({ review }: { review: PublicationReview }) {
  const reviewId = review.id
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<StaffPublicationStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selected, setSelected] = useState<StaffPublication | null>(null)
  const epoch = useRef(0)
  useEffect(() => () => { epoch.current++ }, [])
  async function load() {
    const request = ++epoch.current
    setBusy(true); setError(null); setSelected(null)
    const result = await getStaffPublicationStatus(reviewId)
    if (request !== epoch.current) return
    setData(result); setBusy(false)
    if (!result) setError('Publishing status is unavailable. Check Teams and the native platform before scheduling again.')
  }
  async function withdraw() {
    if (!selected || busy) return
    const request = ++epoch.current
    setBusy(true); setError(null); setNotice(null)
    const result = await withdrawStaffPublication(reviewId, selected.jobId)
    if (request !== epoch.current) return
    setBusy(false); setSelected(null)
    if (!result) {
      setData(null)
      setError('Withdrawal could not be verified. Refresh status before trying again.')
      return
    }
    setNotice(result.providerMayHaveStarted
      ? 'Authority withdrawn. The provider may already have processed this post; nothing was deleted. Check the platform.'
      : 'Queued publishing stopped. Creative approval and the Teams schedule are unchanged.')
    void load()
  }
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-3 text-sm text-white disabled:opacity-40'
  return <section aria-label="Dynamics publishing" className="rounded-xl border border-white/10 bg-black/15 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" aria-expanded={open} className={`${button} font-semibold`} onClick={() => { setOpen(!open); if (!open && !data && !busy) void load() }}><img src={clockIcon} alt="" aria-hidden="true" className="h-4 w-4 invert" />Publishing status</button>
      {open && <button type="button" className={button} disabled={busy} onClick={() => void load()}>Refresh status</button>}
    </div>
    {open && <div className="mt-3 space-y-3">
      <p className="text-xs leading-relaxed text-white/60">Dynamics job receipts only. Continue scheduling in Teams and the native platforms during the transition.</p>
      {busy && <p role="status" className="text-sm text-white/70">Checking publication records…</p>}
      {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
      {notice && <p role="status" className="text-sm text-brand-teal">{notice}</p>}
      {PUBLICATION_CONFIRMATION_VISIBLE && canPrepareFacebookPhotoReview(review) && <ContentPublicationConfirmation key={reviewId} review={review} onConfirmed={() => void load()} />}
      {!busy && data?.items.length === 0 && <p className="text-sm text-white/70">No Dynamics publication jobs for this review. This does not check native platform schedules.</p>}
      {data?.items.map(item => {
        const needsReview = ['failed', 'blocked', 'unknown_outcome'].includes(item.state)
        const nextAction = publicationNextAction(item)
        return <div key={item.jobId} className="min-w-0 space-y-2 rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="min-w-0 break-all text-sm font-semibold text-white">{item.accountLabel}</span><span className={`text-xs ${needsReview ? 'text-amber-200' : 'text-brand-teal'}`}>{PUBLICATION_STATE_LABELS[item.state]}</span></div>
          <p className="text-xs text-white/60">{new Date(item.scheduledAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST</p>
          {item.authorizationState === 'revoked' && <p className="text-xs text-white/60">Publishing authority withdrawn.</p>}
          {item.authorizationState === 'unconfirmed' && <p className="text-xs text-amber-200">No staff confirmation is recorded. This job cannot start publishing.</p>}
          {nextAction && <div role="status" className="space-y-1 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3">
            <p className="text-sm font-semibold text-amber-100">Publishing manager action needed</p>
            <p className="text-sm leading-relaxed text-white/80">{nextAction}</p>
          </div>}
          <div className="flex flex-wrap gap-2">
            {item.postUrl && <a className={button} href={item.postUrl} target="_blank" rel="noopener noreferrer"><img src={externalLinkIcon} alt="" aria-hidden="true" className="h-4 w-4 invert" />Open verified post</a>}
            {item.authorizationState === 'recorded' && item.state !== 'cancelled' && <button type="button" className={button} disabled={busy} onClick={() => setSelected(item)}>{item.providerMayHaveStarted ? 'Withdraw publishing authority' : 'Stop queued publishing'}</button>}
          </div>
          {selected?.jobId === item.jobId && <div className="space-y-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3">
            <p className="text-sm text-white">{item.providerMayHaveStarted ? 'Withdraw authority? A provider operation may already exist. This will not cancel or delete it.' : 'Stop this queued publication? Creative approval and Teams will stay unchanged.'}</p>
            <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={() => void withdraw()}>Confirm withdrawal</button><button type="button" className={button} disabled={busy} onClick={() => setSelected(null)}>Keep current authority</button></div>
          </div>}
        </div>
      })}
    </div>}
  </section>
}
