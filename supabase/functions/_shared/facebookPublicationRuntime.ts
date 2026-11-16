import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { facebookPhotoProvider, verifyFacebookPublishingTarget, type FacebookServerConfig } from './facebookPublishingProvider.ts'
import { verifyFacebookPhotoMedia } from './facebookPhotoMedia.ts'
import { publicationCandidateReader, type PrivatePublicationPreparationChecks } from './socialPublicationPreparation.ts'
import { readSocialPublicationAuthorization } from './socialPublicationAuthorizationStore.ts'
import type { SocialProviderBindings } from './socialPublishingQueue.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'
import type { PublishingIntent } from './socialPublishing.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export interface FacebookPublicationConfiguration {
  server: FacebookServerConfig
  release: PrivatePublicationPreparationChecks['release']
}

/** Disabled unless BOTH dispatch gates plus an exact SERVER account packet are
 * installed in a later approved release. No default client, Graph version, app,
 * credential or global permission is inferred from analytics/native UI access.
 */
export function readFacebookPublicationConfiguration(get: (name: string) => string | undefined): FacebookPublicationConfiguration | null {
  if (get('SOCIAL_PUBLISHING_ENABLED') !== 'true' || get('SOCIAL_FACEBOOK_PHOTO_ENABLED') !== 'true') return null
  try {
    const release = JSON.parse(get('SOCIAL_FACEBOOK_PHOTO_RELEASE') ?? '')
    if (!release || Array.isArray(release) || Object.keys(release).sort().join(',') !== 'accountId,clientId,connectionId'
      || ![release.clientId, release.connectionId].every(id => typeof id === 'string' && UUID.test(id))
      || typeof release.accountId !== 'string' || !/^\d+$/.test(release.accountId)) return null
    const server = { graphVersion: get('META_GRAPH_VERSION') ?? '', appId: get('META_APP_ID') ?? '', appSecret: get('META_APP_SECRET') ?? '',
      projectUrl: get('SUPABASE_URL') ?? '', encryptionKey: get('META_TOKEN_ENCRYPTION_KEY_B64') ?? '', keyVersion: get('META_TOKEN_ENCRYPTION_KEY_VERSION') ?? '' }
    const url = new URL(server.projectUrl)
    if (!/^v\d+\.\d+$/.test(server.graphVersion) || !/^\d+$/.test(server.appId) || !server.appSecret || !server.encryptionKey || !server.keyVersion
      || url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return { server, release: { ...release, approved: true, route: 'facebook_page' } }
  } catch { return null }
}

/** One composition shared by staff preparation and worker final revalidation.
 * Production callers cannot inject passing provider/media proofs. Injection in
 * tests happens at fetch/storage, below the actual qualification checks.
 */
export function facebookPublicationRuntime(sb: SupabaseClient, configuration: FacebookPublicationConfiguration) {
  const server = Object.freeze({ ...configuration.server }), release = Object.freeze({ ...configuration.release })
  const readCandidate = publicationCandidateReader(sb, { release,
    verifyProvider: target => verifyFacebookPublishingTarget(sb, target, server),
    verifyMedia: (snapshot, target) => verifyFacebookPhotoMedia(snapshot, target) })
  const provider = facebookPhotoProvider(sb, server)
  const assertTarget = (intent: Readonly<PublishingIntent>) => {
    if (release.approved !== true || intent.platform !== 'facebook' || intent.route !== release.route || intent.clientId !== release.clientId
      || intent.connectionId !== release.connectionId || intent.accountId !== release.accountId) throw new Error('Exact publication release unavailable.')
  }
  return {
    readCandidate,
    async targetForReview(reviewId: string): Promise<PublicationTarget> {
      if (!UUID.test(reviewId)) throw new Error('Publication review unavailable.')
      const { data, error } = await sb.from('content_review_versions').select('id,client_id,deliverable_id')
        .eq('id', reviewId).eq('client_id', release.clientId).maybeSingle()
      if (error || !data || data.id !== reviewId || data.client_id !== release.clientId || !UUID.test(data.deliverable_id)) throw new Error('Publication review unavailable.')
      return { clientId: release.clientId, connectionId: release.connectionId, accountId: release.accountId, route: release.route,
        deliverableId: data.deliverable_id, reviewVersionId: reviewId }
    },
    workerBindings(jobId: string): SocialProviderBindings {
      if (!UUID.test(jobId)) throw new Error('Publication job unavailable.')
      return {
        async readCurrent(intent) {
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
        },
        async submit(intent) { assertTarget(intent); return await provider.submit(intent) },
        // Status reads use the recorded exact Page receipt. Withdrawal does not
        // turn an already-submitted operation into permission for another POST.
        async reconcile(intent) { assertTarget(intent); return await provider.reconcile(intent) },
      }
    },
  }
}
