import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PUBLISHING_PATHS, type PublishingIntent } from './socialPublishing.ts'
import type { PhotoPublicationRelease } from './socialPublicationPreparation.ts'
import type { PublicationAuthorizationPorts, PublicationTarget } from './socialPublicationAuthorization.ts'
import { readSocialPublicationAuthorization } from './socialPublicationAuthorizationStore.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Private common source adapter. Reuses the original durable confirmation and
 * canonical reader; never creates authority, media URLs or provider requests.
 * It is not an Edge/MCP entry, rollout parser or a caller-supplied proof surface.
 */
export function publicationRuntimeSource(sb: SupabaseClient, policy: PhotoPublicationRelease, readCandidate: PublicationAuthorizationPorts['readCandidate']) {
  const release = Object.freeze({ ...policy })
  if (release.approved !== true || !['facebook_page', 'instagram_login', 'instagram_facebook_login'].includes(release.route)
    || ![release.clientId, release.connectionId].every(id => UUID.test(id)) || !/^\d+$/.test(release.accountId)) throw new Error('Exact publication release unavailable.')
  function assertTarget(intent: Readonly<PublishingIntent>) {
    if (intent.platform !== PUBLISHING_PATHS[release.route].platform || intent.route !== release.route || intent.clientId !== release.clientId
      || intent.connectionId !== release.connectionId || intent.accountId !== release.accountId) throw new Error('Exact publication release unavailable.')
  }
  return {
    assertTarget,
    async targetForReview(reviewId: string): Promise<PublicationTarget> {
      if (!UUID.test(reviewId)) throw new Error('Publication review unavailable.')
      const { data, error } = await sb.from('content_review_versions').select('id,client_id,deliverable_id')
        .eq('id', reviewId).eq('client_id', release.clientId).maybeSingle()
      if (error || !data || data.id !== reviewId || data.client_id !== release.clientId || !UUID.test(data.deliverable_id)) throw new Error('Publication review unavailable.')
      return { clientId: release.clientId, connectionId: release.connectionId, accountId: release.accountId, route: release.route,
        deliverableId: data.deliverable_id, reviewVersionId: reviewId }
    },
    workerReadCurrent(jobId: string) {
      if (!UUID.test(jobId)) throw new Error('Publication job unavailable.')
      return async (input: Readonly<PublishingIntent>) => {
        const intent = Object.freeze({ ...input })
        assertTarget(intent)
        const authorization = await readSocialPublicationAuthorization(sb, jobId, intent)
        if (!authorization) throw new Error('Current publication authority unavailable.')
        const job = await sb.from('background_jobs').select('payload').eq('id', jobId).eq('job_type', 'social_publish').maybeSingle()
        const actorId = job.data?.payload?.authorized_by
        if (job.error || typeof actorId !== 'string' || !UUID.test(actorId)) throw new Error('Publication actor unavailable.')
        const target = { clientId: intent.clientId, deliverableId: intent.deliverableId, reviewVersionId: intent.reviewVersionId,
          connectionId: intent.connectionId, accountId: intent.accountId, route: intent.route }
        const current = await readCandidate(target, actorId)
        return { ...current.context, authorization }
      }
    },
  }
}
