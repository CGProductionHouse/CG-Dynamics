import { useEffect, useEffectEvent, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ActionButton } from '../../components/ui/Buttons'
import { Pill } from '../../components/ui/Badges'
import {
  activateSkillCard,
  evaluateSkillCardActivation,
  listSkillCardReviews,
  submitSkillCardReviewAction,
  type MarketingLibrarySource,
  type SkillCardRecord,
  type SkillCardReviewAction,
  type SkillCardReviewRecord,
} from '../../lib/marketing-library/skillCardsData'

// ── Skill Card review lifecycle (admin) ───────────────────────────────────────
//
// Compact review panel inside the Skill Card detail area. Shows review history,
// activation readiness, missing requirements, source trust tier and last
// reviewed date, and exposes the admin actions. The database gate (phase-18c)
// is authoritative; this UI only offers Activate when readiness passes and
// never tries to bypass the gate.

const REVIEW_STATUS_TONE: Record<string, 'teal' | 'amber' | 'neutral'> = {
  approved: 'teal',
  changes_requested: 'amber',
  rejected: 'amber',
  deprecated: 'neutral',
  needs_review: 'neutral',
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

const REVIEW_ACTIONS: Array<{ action: SkillCardReviewAction; label: string; variant: 'primary' | 'secondary' | 'danger' | 'ghost' }> = [
  { action: 'approve', label: 'Approve', variant: 'primary' },
  { action: 'request_changes', label: 'Request changes', variant: 'secondary' },
  { action: 'reject', label: 'Reject', variant: 'danger' },
  { action: 'deprecate', label: 'Deprecate', variant: 'ghost' },
]

export default function SkillCardReviewSection({
  card, source, onChanged,
}: {
  card: SkillCardRecord
  source: MarketingLibrarySource | null
  onChanged: () => void | Promise<void>
}) {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState<SkillCardReviewRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadReviews() {
    setLoading(true)
    const response = await listSkillCardReviews(card.id)
    if (!response.error) setReviews(response.data)
    setLoading(false)
  }

  const loadReviewsEvent = useEffectEvent(loadReviews)
  useEffect(() => {
    // Deferred so the reset + load don't run synchronously in the effect body.
    const timer = window.setTimeout(() => { setNote(''); setError(null); void loadReviewsEvent() }, 0)
    return () => window.clearTimeout(timer)
  }, [card.id])

  const readiness = evaluateSkillCardActivation(card, source, reviews)
  const reviewedBy = profile?.full_name ?? 'Admin'
  const noteRequired = !note.trim()

  async function runReviewAction(action: SkillCardReviewAction) {
    if (noteRequired || busy) return
    setBusy(true)
    setError(null)
    const response = await submitSkillCardReviewAction({ skillCardId: card.id, action, note, reviewedBy })
    setBusy(false)
    if (response.error) { setError(response.error); return }
    setNote('')
    await loadReviews()
    await onChanged()
  }

  async function runActivate() {
    if (!readiness.ready || busy) return
    setBusy(true)
    setError(null)
    const response = await activateSkillCard(card.id)
    setBusy(false)
    if (response.error) { setError(response.error); return }
    await loadReviews()
    await onChanged()
  }

  return (
    <section className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white/45">Review &amp; activation</h3>
        <Pill tone={card.status === 'active' ? 'teal' : 'neutral'}>{humanize(card.status)}</Pill>
      </div>

      {/* Readiness + key facts */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={`rounded-xl border p-3 ${readiness.ready ? 'border-emerald-300/25 bg-emerald-300/[0.06]' : 'border-amber-300/20 bg-amber-300/[0.05]'}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Activation readiness</p>
          <p className={`mt-1 text-sm font-black ${readiness.ready ? 'text-emerald-200' : 'text-amber-200'}`}>
            {readiness.ready ? 'Ready to activate' : 'Not ready'}
          </p>
          {!readiness.ready && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-white/60">
              {readiness.missing.map(item => <li key={item}>{item}</li>)}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-white/60">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Source &amp; review facts</p>
          <p className="mt-1"><span className="text-white/35">Linked source: </span>{source ? source.source_name : (card.source_id ? 'Unknown (not loaded)' : 'None')}</p>
          <p className="mt-1"><span className="text-white/35">Trust tier: </span>{source ? humanize(source.trust_tier) : '—'}</p>
          <p className="mt-1"><span className="text-white/35">Last reviewed: </span>{card.last_reviewed ?? 'Never'}</p>
          <p className="mt-1"><span className="text-white/35">Approved reviews: </span>{reviews.filter(review => review.review_status === 'approved').length}</p>
        </div>
      </div>

      {/* Review note (required for every review action) */}
      <label className="block space-y-1.5">
        <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-white/40">Review note (required for review actions)</span>
        <textarea
          className="min-h-[56px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-brand-teal/50"
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="Short note explaining this decision"
        />
      </label>

      {error && <p className="rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {REVIEW_ACTIONS.map(({ action, label, variant }) => (
          <ActionButton key={action} size="sm" variant={variant} loading={busy} disabled={busy || noteRequired} onClick={() => void runReviewAction(action)}>
            {label}
          </ActionButton>
        ))}
        <ActionButton
          size="sm"
          variant="outline"
          loading={busy}
          disabled={busy || !readiness.ready || card.status === 'active'}
          onClick={() => void runActivate()}
        >
          {card.status === 'active' ? 'Active' : 'Activate'}
        </ActionButton>
      </div>
      {noteRequired && <p className="text-xs text-white/40">A short note is required before Approve, Request changes, Reject or Deprecate. Activate needs every requirement to pass.</p>}

      {/* Review history */}
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Review history</p>
        {loading ? (
          <p className="text-sm text-white/40">Loading reviews…</p>
        ) : reviews.length === 0 ? (
          <p className="rounded-lg border border-dashed border-white/10 px-3 py-3 text-center text-xs text-white/40">No reviews yet.</p>
        ) : (
          <ul className="space-y-2">
            {reviews.map(review => (
              <li key={review.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone={REVIEW_STATUS_TONE[review.review_status] ?? 'neutral'}>{humanize(review.review_status)}</Pill>
                  <span className="text-[11px] text-white/40">{new Date(review.reviewed_at).toLocaleString('en-ZA')}</span>
                </div>
                {review.review_notes && <p className="mt-2 text-sm text-white/70">{review.review_notes}</p>}
                {review.reviewed_by && <p className="mt-1 text-[11px] text-white/40">by {review.reviewed_by}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
