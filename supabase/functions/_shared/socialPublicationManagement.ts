import { readBoundedPublicationBody, socialPublicationAuthorizationHandler, socialPublicationFingerprint, type PublicationAuthorizationPorts } from './socialPublicationAuthorization.ts'
import { PUBLISHING_PATHS, johannesburgPublishingDate, type PublishingState, type PublishingPlatform } from './socialPublishing.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const states = new Set(['queued', 'submitting', 'provider_scheduled', 'processing', 'posted', 'retry_wait', 'blocked', 'failed', 'unknown_outcome', 'cancelled'])
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 256 && !/[\r\n]/.test(v)
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k))
export interface PublicationStatusItem {
  jobId: string; platform: PublishingPlatform; accountId: string; accountLabel: string; scheduledAt: string; state: PublishingState
  authorizationState: 'recorded' | 'revoked' | 'unconfirmed'; providerMayHaveStarted: boolean; postUrl: string | null; errorCode: string | null
  confirmationFingerprint: string | null
}
export interface PublicationManagementStatus {
  reviewId: string; clientId: string; items: PublicationStatusItem[]
  // Status/withdrawal are available independently of the submission kill switch.
  canAuthorize: false
}

/** A sanitized staff projection over existing jobs, never a provider-health
 * assertion. A failed/missing/partial query is unavailable, NOT an empty queue.
 */
export async function readPublicationManagementStatus(sb: SupabaseClient, actorId: string, reviewId: string): Promise<PublicationManagementStatus | null> {
  if (!UUID.test(actorId) || !UUID.test(reviewId)) throw new Error('Publication scope unavailable.')
  const actor = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
  if (actor.error || actor.data?.is_active !== true || !['admin', 'manager'].includes(actor.data.role)) throw new Error('Active publication manager required.')
  const review = await sb.from('content_review_versions').select('id,client_id,deliverable_id').eq('id', reviewId).maybeSingle()
  if (review.error) throw new Error('Publication review unavailable.')
  if (!review.data) return null
  const r = review.data
  if (r.id !== reviewId || !UUID.test(r.client_id) || !UUID.test(r.deliverable_id)) throw new Error('Publication review unavailable.')
  const source = await sb.from('monthly_deliverables').select('id').eq('id', r.deliverable_id).eq('client_id', r.client_id).maybeSingle()
  if (source.error || !source.data) throw new Error('Publication source unavailable.')
  const items: PublicationStatusItem[] = [], seen = new Set<string>()
  for (let offset = 0; offset < 1000; offset += 100) {
    const result = await sb.from('background_jobs').select('id,status,payload,publication').eq('job_type', 'social_publish')
      .eq('payload->intent->>clientId', r.client_id).eq('payload->intent->>deliverableId', r.deliverable_id)
      .eq('payload->intent->>reviewVersionId', reviewId).order('id').range(offset, offset + 99)
    if (result.error || !Array.isArray(result.data) || result.data.length > 100) throw new Error('Publication jobs unavailable.')
    for (const row of result.data) {
      const i = row.payload?.intent, p = row.publication
      if (!UUID.test(row.id) || seen.has(row.id) || !object(i) || !object(p) || i.clientId !== r.client_id || i.deliverableId !== r.deliverable_id
        || i.reviewVersionId !== reviewId || typeof i.route !== 'string' || !Object.hasOwn(PUBLISHING_PATHS, i.route)
        || PUBLISHING_PATHS[i.route as keyof typeof PUBLISHING_PATHS].platform !== i.platform || !text(i.accountId)
        || !text(i.scheduledAt) || !johannesburgPublishingDate(i.scheduledAt) || !states.has(String(p.state))
        || !['queued', 'running', 'succeeded', 'failed', 'cancelled'].includes(row.status)) throw new Error('Publication evidence unavailable.')
      const observation = object(p.observation) ? p.observation : null
      if ((p.state === 'posted' && (row.status !== 'succeeded' || !text(observation?.postId)))
        || (row.status === 'succeeded' && p.state !== 'posted')
        || (['processing', 'provider_scheduled'].includes(String(p.state)) && !text(observation?.operationId) && !text(observation?.postId))) throw new Error('Publication receipt unavailable.')
      const a = object(p.authorization) ? p.authorization : null
      if (a && (!UUID.test(String(a.id)) || a.id !== i.authorizationId || !UUID.test(String(a.actorId)) || a.actorId !== row.payload.authorized_by
        || typeof a.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(a.fingerprint)
        || typeof a.confirmedAt !== 'string' || !Number.isFinite(Date.parse(a.confirmedAt))
        || (a.revokedAt !== null && (typeof a.revokedAt !== 'string' || !Number.isFinite(Date.parse(a.revokedAt)))))) throw new Error('Publication authorization unavailable.')
      if (a && a.fingerprint !== await socialPublicationFingerprint(i as unknown as Parameters<typeof socialPublicationFingerprint>[0])) throw new Error('Publication confirmation mismatch.')
      const started = p.started_at !== undefined && p.started_at !== null
      if (started && (typeof p.started_at !== 'string' || !Number.isFinite(Date.parse(p.started_at)))) throw new Error('Publication attempt unavailable.')
      if (['posted', 'submitting', 'processing', 'provider_scheduled'].includes(String(p.state)) && !started) throw new Error('Publication attempt unavailable.')
      let postUrl: string | null = null
      if (p.state === 'posted' && i.platform === 'facebook') {
        if (!/^\d+$/.test(i.accountId) || !new RegExp(`^${i.accountId}_\\d+$`).test(String(observation?.postId))) throw new Error('Publication Page receipt unavailable.')
        postUrl = `https://www.facebook.com/${observation?.postId}`
      }
      seen.add(row.id)
      const labels: Record<PublishingPlatform, string> = { facebook: 'Facebook Page', instagram: 'Instagram account', tiktok: 'TikTok account', linkedin: 'LinkedIn organization', youtube: 'YouTube channel' }
      items.push({ jobId: row.id, platform: i.platform as PublishingPlatform, accountId: i.accountId,
        accountLabel: `${labels[i.platform as PublishingPlatform]} · ${i.accountId}`, scheduledAt: i.scheduledAt,
        state: row.status === 'cancelled' && !started ? 'cancelled' : p.state as PublishingState,
        authorizationState: !a ? 'unconfirmed' : a.revokedAt === null ? 'recorded' : 'revoked',
        confirmationFingerprint: a ? a.fingerprint as string : null,
        providerMayHaveStarted: started,
        postUrl, errorCode: typeof observation?.errorCode === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(observation.errorCode) ? observation.errorCode : null })
    }
    if (result.data.length < 100) {
      const currentReview = await sb.from('content_review_versions').select('id,client_id,deliverable_id').eq('id', reviewId).maybeSingle()
      const currentSource = await sb.from('monthly_deliverables').select('id').eq('id', r.deliverable_id).eq('client_id', r.client_id).maybeSingle()
      const currentActor = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
      if (currentActor.error || currentActor.data?.is_active !== true || !['admin', 'manager'].includes(currentActor.data.role)) throw new Error('Active publication manager required.')
      if (currentReview.error || currentReview.data?.id !== reviewId || currentReview.data.client_id !== r.client_id
        || currentReview.data.deliverable_id !== r.deliverable_id || currentSource.error || currentSource.data?.id !== r.deliverable_id) throw new Error('Publication source unavailable.')
      return { reviewId, clientId: r.client_id, items, canAuthorize: false }
    }
  }
  throw new Error('Complete publication coverage unavailable.')
}

export function publicationManagementHandler(ports: {
  authenticate: PublicationAuthorizationPorts['authenticate']
  readStatus(reviewId: string, actorId: string): Promise<PublicationManagementStatus | null>
  revoke: PublicationAuthorizationPorts['revoke']
}) {
  return async (request: Request): Promise<Response> => {
    const response = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
    if (request.method !== 'POST') return response(405, { ok: false, error: 'POST_REQUIRED' })
    try {
      const actor = await ports.authenticate(request)
      if (!actor || !UUID.test(actor.id) || actor.active !== true || !['admin', 'manager'].includes(actor.role)) return response(403, { ok: false, error: 'ACTIVE_MANAGER_REQUIRED' })
      const raw = await readBoundedPublicationBody(request)
      let body: unknown
      try { body = raw === null ? null : JSON.parse(raw) } catch { body = null }
      if (!object(body) || !['status', 'revoke'].includes(String(body.action)) || typeof body.reviewId !== 'string' || !UUID.test(body.reviewId)
        || !exact(body, body.action === 'status' ? ['action', 'reviewId'] : ['action', 'reviewId', 'jobId'])
        || (body.action === 'revoke' && (typeof body.jobId !== 'string' || !UUID.test(body.jobId)))) return response(400, { ok: false, error: 'PUBLICATION_REQUEST_INVALID' })
      const status = await ports.readStatus(body.reviewId, actor.id)
      if (!status) return response(404, { ok: false, error: 'PUBLICATION_NOT_FOUND' })
      if (body.action === 'status') return response(200, { ok: true, status })
      const item = status.items.find(i => i.jobId === body.jobId)
      if (!item) return response(404, { ok: false, error: 'PUBLICATION_NOT_FOUND' })
      if (item.authorizationState === 'unconfirmed') return response(409, { ok: false, error: 'NO_RECORDED_PUBLICATION_AUTHORITY' })
      const withdrawal = socialPublicationAuthorizationHandler({ authenticate: async () => actor, revoke: ports.revoke,
        readCandidate: async () => { throw new Error('Authorization preparation is not configured.') },
        authorize: async () => { throw new Error('New authorization is not available.') } }, false)
      // Client scope comes only from the verified review, never request input.
      return await withdrawal(new Request(request.url, { method: 'POST', body: JSON.stringify({ action: 'revoke', clientId: status.clientId, jobId: item.jobId }) }))
    } catch { return response(503, { ok: false, error: 'PUBLICATION_STATUS_UNAVAILABLE' }) }
  }
}
