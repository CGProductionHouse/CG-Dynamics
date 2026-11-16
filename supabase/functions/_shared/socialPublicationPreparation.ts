import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { inspectPublicationSnapshot, type PrivatePublicationSnapshot } from './socialPublishingMedia.ts'
import { preparePublishingIntent, type PublishingBinding, type PublishingContext } from './socialPublishing.ts'
import { socialPublicationFingerprint, type PublicationAuthorizationPorts, type PublicationTarget } from './socialPublicationAuthorization.ts'
import { FACEBOOK_PHOTO_MAX_BYTES } from './facebookPhotoMedia.ts'

export class PublicationPreparationError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'PublicationPreparationError' }
}
function stop(code: string): never { throw new PublicationPreparationError(code) }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const fresh = (value: unknown, now: number) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && Date.parse(value) >= now - 300_000 && Date.parse(value) <= now + 30_000

export interface PrivatePublicationPreparationChecks {
  // SERVER policy for the reviewed exact-account pilot, never request booleans.
  release: { approved: boolean; clientId: string; connectionId: string; accountId: string; route: 'facebook_page' }
  verifyProvider(target: Readonly<PublicationTarget>): Promise<{ binding: PublishingBinding; checkedAt: string }>
  // Signature/hash alone is not full provider media qualification. A reviewed
  // server adapter must verify the actual format/dimensions/size/rights contract.
  verifyMedia(snapshot: Readonly<PrivatePublicationSnapshot>, target: Readonly<PublicationTarget>): Promise<{ verified: boolean; profile: string; checkedAt: string }>
  now?: () => number
}

/** Concrete canonical source + captured Teams + private-byte reader. Read-only:
 * no signing, uploads, provider submission, Microsoft refresh/apply or grant.
 * Private provider/media qualification remains mandatory, with no default pass.
 */
export function publicationCandidateReader(sb: SupabaseClient, checks: PrivatePublicationPreparationChecks): PublicationAuthorizationPorts['readCandidate'] {
  const release = Object.freeze({ ...checks.release })
  return async (input, actorId) => {
    const target = Object.freeze({ ...input })
    const now = (checks.now ?? Date.now)()
    if (!Number.isFinite(now) || !UUID.test(actorId) || ![target.clientId, target.deliverableId, target.reviewVersionId, target.connectionId].every(id => UUID.test(id))) stop('PREPARATION_SCOPE_INVALID')
    const actor = await sb.from('profiles').select('role,is_active').eq('id', actorId).maybeSingle()
    if (actor.error || actor.data?.is_active !== true || !['admin', 'manager'].includes(actor.data.role)) stop('ACTIVE_MANAGER_REQUIRED')
    if (release.approved !== true || target.route !== 'facebook_page' || release.clientId !== target.clientId || release.connectionId !== target.connectionId
      || release.accountId !== target.accountId || release.route !== target.route || !/^\d+$/.test(target.accountId)) stop('EXACT_ACCOUNT_RELEASE_REQUIRED')
    const [review, deliverable, client] = await Promise.all([
      sb.from('content_review_versions').select('id,deliverable_id,client_id,state,asset_path,media_type,caption,channels,scheduled_at')
        .eq('id', target.reviewVersionId).eq('client_id', target.clientId).eq('deliverable_id', target.deliverableId).maybeSingle(),
      sb.from('monthly_deliverables').select('id,client_id,scheduled_date,archived_at,posted_at,production_status,microsoft_task_id')
        .eq('id', target.deliverableId).eq('client_id', target.clientId).maybeSingle(),
      sb.from('clients').select('id').eq('id', target.clientId).eq('active', true).maybeSingle(),
    ])
    if (review.error || deliverable.error || client.error || !review.data || !deliverable.data || !client.data) stop('CANONICAL_PUBLICATION_SOURCE_UNAVAILABLE')
    const r = review.data, d = deliverable.data
    if (r.id !== target.reviewVersionId || r.client_id !== target.clientId || r.deliverable_id !== target.deliverableId
      || d.id !== target.deliverableId || d.client_id !== target.clientId || r.state !== 'approved' || d.archived_at !== null || d.posted_at !== null
      || !Array.isArray(r.channels) || ['scheduled', 'posted'].includes(d.production_status)) stop('CURRENT_UNSCHEDULED_REVIEW_REQUIRED')
    const { data: schedule, error } = await sb.rpc('read_social_publication_schedule_evidence', { p_actor: actorId, p_deliverable: d.id, p_review: r.id })
    if (error || !schedule || schedule.contract !== 'social_publication_schedule_evidence_v1' || schedule.clientId !== target.clientId
      || schedule.deliverableId !== d.id || schedule.reviewVersionId !== r.id || schedule.recordId !== d.microsoft_task_id
      || typeof schedule.recordId !== 'string' || !schedule.recordId.trim() || schedule.recordId.length > 512
      || typeof schedule.revision !== 'string' || !/^[a-f0-9]{64}$/.test(schedule.revision) || schedule.scheduledDate !== d.scheduled_date
      || !fresh(schedule.capturedAt, now) || !fresh(schedule.checkedAt, now)) stop('FRESH_TEAMS_EVIDENCE_REQUIRED')
    const snapshot = await inspectPublicationSnapshot(sb, { clientId: target.clientId, deliverableId: d.id, reviewVersionId: r.id,
      platform: 'facebook', assetPath: r.asset_path, mediaType: r.media_type, caption: r.caption, scheduledAt: r.scheduled_at }, FACEBOOK_PHOTO_MAX_BYTES)
    let provider: Awaited<ReturnType<PrivatePublicationPreparationChecks['verifyProvider']>>
    let media: Awaited<ReturnType<PrivatePublicationPreparationChecks['verifyMedia']>>
    try {
      ;[provider, media] = await Promise.all([checks.verifyProvider(target), checks.verifyMedia(Object.freeze({ ...snapshot, bytes: snapshot.bytes.slice() }), target)])
    } catch { stop('PRIVATE_PREFLIGHT_UNAVAILABLE') }
    const b = provider.binding
    if (!fresh(provider.checkedAt, now) || b.clientId !== target.clientId || b.connectionId !== target.connectionId || b.accountId !== target.accountId || b.route !== target.route
      || b.active !== true || b.appAccessVerified !== true || b.accountPublishingVerified !== true || !(Date.parse(b.tokenValidUntil ?? '') > now + 120_000)
      || !Array.isArray(b.grantedScopes) || !['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].every(scope => b.grantedScopes.includes(scope))) stop('CURRENT_PROVIDER_PROOF_REQUIRED')
    if (media.verified !== true || !fresh(media.checkedAt, now) || typeof media.profile !== 'string' || !/^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(media.profile)) stop('REVIEWED_PROVIDER_MEDIA_PROOF_REQUIRED')
    // Copy selected evidence only; private adapter extras/credentials never flow
    // into context, preview, queue, receipts or diagnostics.
    const context: PublishingContext = { review: { id: r.id, deliverable_id: r.deliverable_id, client_id: r.client_id, state: r.state,
      asset_path: r.asset_path, media_type: r.media_type, caption: r.caption, channels: r.channels, scheduled_at: r.scheduled_at },
      deliverable: { id: d.id, client_id: d.client_id, scheduled_date: d.scheduled_date, archived_at: d.archived_at, posted_at: d.posted_at, production_status: d.production_status },
      binding: { clientId: b.clientId, connectionId: b.connectionId, accountId: b.accountId, route: b.route, active: true,
        grantedScopes: [...b.grantedScopes], tokenValidUntil: b.tokenValidUntil, appAccessVerified: true, accountPublishingVerified: true, mediaContractVerified: true },
      authorization: null, assetSha256: snapshot.assetSha256, teamsScheduleVerified: true, rolloutApproved: true }
    const prepared = preparePublishingIntent({ ...context, authorization: { id: crypto.randomUUID(), reviewVersionId: r.id, clientId: r.client_id,
      connectionId: b.connectionId, accountId: b.accountId, route: b.route, scheduledAt: r.scheduled_at, assetSha256: snapshot.assetSha256 } })
    if (!prepared.intent) stop('PREPARATION_SOURCE_CHANGED')
    const fingerprint = await socialPublicationFingerprint(prepared.intent)
    return { context, evidence: { intentFingerprint: fingerprint, checkedAt: new Date(now).toISOString(), teamsRecordId: schedule.recordId,
      teamsRevision: schedule.revision, mediaProfile: media.profile } }
  }
}
