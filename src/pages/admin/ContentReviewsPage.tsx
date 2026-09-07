import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ClientPortalShell } from '../../components/client/ClientPortalShell'
import { ContentReviewCard } from '../../components/content/ContentReviewCard'
import { listContentReviews, type ContentReview } from '../../lib/contentReviews'
import { supabase } from '../../lib/supabase'
import { getClient, type Client } from '../../lib/db/clients'

export default function ContentReviewsPage({ clientView = false }: { clientView?: boolean }) {
  const { profile } = useAuth()
  const [reviews, setReviews] = useState<ContentReview[]>([])
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const load = async () => {
      const [result, clientResult] = await Promise.all([
        clientView ? supabase.rpc('client_content_review_queue') : listContentReviews(),
        clientView && profile?.client_id ? getClient(profile.client_id) : Promise.resolve(null),
      ])
      if (!active) return
      setReviews((result.data ?? []) as ContentReview[])
      setError(result.error?.message ?? null)
      setClient(clientResult?.data ?? null)
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [clientView, profile?.client_id, revision])
  const body = <div className="mx-auto max-w-6xl space-y-5 p-4 pb-32 sm:p-6">
    <h1 className="text-2xl font-bold text-white">{clientView ? 'Approvals' : 'Content review'}</h1>
    {!clientView && <div className="flex flex-wrap gap-4"><Link to="/admin/content-ops" className="inline-flex min-h-11 items-center text-sm text-brand-teal">Content operations</Link><Link to="/admin/client-schedule" className="inline-flex min-h-11 items-center text-sm text-brand-teal">Open Client Schedule</Link></div>}
    {loading ? <p className="text-white/60">Loading reviews…</p> : error ? <p role="alert" className="text-red-300">{error}</p> : reviews.length === 0 ? <p className="text-white/60">No content awaiting review.</p> : <div className="grid gap-4 lg:grid-cols-2">{reviews.map(review => <div key={review.id} className="min-w-0 space-y-2">
      {!clientView && review.deliverable_id && <Link to={`/admin/client-schedule?id=${review.deliverable_id}&client=${review.client_id ?? ''}&month=${(review.deliverable?.month ?? review.scheduled_at).slice(0, 7)}&mode=all`} className="inline-block text-xs text-brand-teal">Open schedule item</Link>}
      <ContentReviewCard staffView={!clientView} review={review} canDecide={clientView ? review.state === 'client_review' : ['admin', 'manager'].includes(profile?.role ?? '') && review.state === 'internal_review'} onChanged={() => setRevision(value => value + 1)} />
    </div>)}</div>}
  </div>
  return clientView ? <ClientPortalShell client={client}>{body}</ClientPortalShell> : body
}
