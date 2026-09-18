import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ContentReviewCard } from '../../components/content/ContentReviewCard'
import { ClientPortalEmptyState, ClientPortalErrorState, ClientPortalLoadingState } from '../../components/client/ClientPortalStates'
import { listContentReviews, type ContentReview } from '../../lib/contentReviews'
import { supabase } from '../../lib/supabase'

export default function ContentReviewsPage({ clientView = false }: { clientView?: boolean }) {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState<ContentReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const load = async () => {
      const result = await (clientView ? supabase.rpc('client_content_review_queue') : listContentReviews())
      if (!active) return
      setReviews((result.data ?? []) as ContentReview[])
      setError(result.error?.message ?? null)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [clientView, profile?.client_id, revision])
  if (clientView) {
    return (
      <ClientApprovalsView
        reviews={reviews}
        loading={loading}
        error={error}
        onChanged={() => setRevision(value => value + 1)}
      />
    )
  }

  return <div className="mx-auto max-w-6xl space-y-5 p-4 pb-32 sm:p-6">
    <h1 className="text-2xl font-bold text-white">Content review</h1>
    <div className="flex flex-wrap gap-4"><Link to="/admin/content-ops" className="inline-flex min-h-11 items-center text-sm text-brand-teal">Content operations</Link><Link to="/admin/client-schedule" className="inline-flex min-h-11 items-center text-sm text-brand-teal">Open Client Schedule</Link></div>
    {loading ? <p className="text-white/60">Loading reviews…</p> : error ? <p role="alert" className="text-red-300">{error}</p> : reviews.length === 0 ? <p className="text-white/60">No content awaiting review.</p> : <div className="grid gap-4 lg:grid-cols-2">{reviews.map(review => <div key={review.id} className="min-w-0 space-y-2">
      {review.deliverable_id && <Link to={`/admin/client-schedule?id=${review.deliverable_id}&client=${review.client_id ?? ''}&month=${(review.deliverable?.month ?? review.scheduled_at).slice(0, 7)}&mode=all`} className="inline-block text-xs text-brand-teal">Open schedule item</Link>}
      <ContentReviewCard staffView review={review} canDecide={['admin', 'manager'].includes(profile?.role ?? '') && review.state === 'internal_review'} onChanged={() => setRevision(value => value + 1)} />
    </div>)}</div>}
  </div>
}

function ClientApprovalsView({
  reviews,
  loading,
  error,
  onChanged,
}: {
  reviews: ContentReview[]
  loading: boolean
  error: string | null
  onChanged: () => void
}) {
  if (loading) return <ClientPortalLoadingState />
  if (error) return <ClientPortalErrorState title="Approvals could not be loaded" message="Your review queue is temporarily unavailable. No approval status has been changed." />

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[radial-gradient(circle_at_12%_5%,rgba(45,212,191,0.18),transparent_34%),radial-gradient(circle_at_92%_18%,rgba(249,115,22,0.12),transparent_28%),linear-gradient(145deg,rgba(10,27,24,0.96),rgba(5,12,11,0.94))] px-6 py-9 shadow-[0_34px_100px_-55px_rgba(0,0,0,0.95)] sm:px-9 sm:py-11">
        <div aria-hidden className="absolute -right-14 top-2 text-[8rem] font-black leading-none tracking-[-0.12em] text-white/[0.035] sm:text-[11rem]">OK</div>
        <div className="relative max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-[#2dd4bf]">Review with confidence</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">Approvals</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Client-ready content that needs your decision appears here—clearly separated from CG's internal production work.
          </p>
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2 text-sm text-slate-300">
            <span className={`h-2 w-2 rounded-full ${reviews.length > 0 ? 'bg-[#f97316]' : 'bg-[#2dd4bf]'}`} />
            {reviews.length > 0 ? `${reviews.length} item${reviews.length === 1 ? '' : 's'} waiting` : 'Nothing waiting'}
          </div>
        </div>
      </section>

      {reviews.length === 0 ? (
        <ClientPortalEmptyState
          eyebrow="All clear"
          title="You’re up to date"
          message="There is nothing waiting for your approval right now. When CG shares client-ready content for review, it will appear here with the exact action required."
          action={<Link to="/client/plan" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-sm font-bold text-white transition hover:border-[#2dd4bf]/40 hover:bg-white/[0.08]">View your plan</Link>}
        />
      ) : (
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#2dd4bf]">Waiting for you</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Ready to review</h2>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {reviews.map(review => (
              <div key={review.id} className="min-w-0 rounded-[1.75rem] border border-white/[0.08] bg-white/[0.025] p-1 shadow-[0_24px_60px_-42px_rgba(0,0,0,0.95)]">
                <ContentReviewCard staffView={false} review={review} canDecide={review.state === 'client_review'} onChanged={onChanged} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
