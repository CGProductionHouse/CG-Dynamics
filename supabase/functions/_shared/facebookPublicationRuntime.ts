import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { facebookPhotoProvider, verifyFacebookPublishingTarget, type FacebookServerConfig } from './facebookPublishingProvider.ts'
import { verifyFacebookPhotoMedia } from './facebookPhotoMedia.ts'
import { publicationCandidateReader, type PrivatePublicationPreparationChecks } from './socialPublicationPreparation.ts'
import { publicationRuntimeSource } from './socialPublicationRuntimeSource.ts'
import type { SocialProviderBindings } from './socialPublishingQueue.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
export interface FacebookPublicationConfiguration {
  server: FacebookServerConfig
  release: PrivatePublicationPreparationChecks['release'] & { route: 'facebook_page' }
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
  if (release.route !== 'facebook_page') throw new Error('Exact Facebook publication release unavailable.')
  const readCandidate = publicationCandidateReader(sb, { release,
    verifyProvider: target => verifyFacebookPublishingTarget(sb, target, server),
    verifyMedia: (snapshot, target) => verifyFacebookPhotoMedia(snapshot, target) })
  const provider = facebookPhotoProvider(sb, server)
  const source = publicationRuntimeSource(sb, release, readCandidate), assertTarget = source.assertTarget
  return {
    readCandidate,
    targetForReview: source.targetForReview,
    workerBindings(jobId: string): SocialProviderBindings {
      return {
        readCurrent: source.workerReadCurrent(jobId),
        async submit(intent) { assertTarget(intent); return await provider.submit(intent) },
        // Status reads use the recorded exact Page receipt. Withdrawal does not
        // turn an already-submitted operation into permission for another POST.
        async reconcile(intent) { assertTarget(intent); return await provider.reconcile(intent) },
      }
    },
  }
}
