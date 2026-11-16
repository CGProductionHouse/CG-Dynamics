import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { InstagramPublishingCredentialConfig } from './instagramPublishingCredential.ts'
import { instagramPhotoProvider } from './instagramPublishingProvider.ts'
import { publicationCandidateReader, type PhotoPublicationRelease } from './socialPublicationPreparation.ts'
import { publicationRuntimeSource } from './socialPublicationRuntimeSource.ts'
import type { StrictJpegDecoder } from './publicationJpeg.ts'
import type { SocialProviderBindings } from './socialPublishingQueue.ts'

export interface InstagramPublicationConfiguration {
  server: InstagramPublishingCredentialConfig & { projectUrl: string }
  release: PhotoPublicationRelease & { route: 'instagram_login' | 'instagram_facebook_login' }
}

/** PRIVATE SOURCE COMPOSITION ONLY. No environment activation parser, deployed
 * entry, worker registration, default decoder or scope/mapping write. A future
 * exact release must supply the approved imported codec and account policy.
 */
export function instagramPublicationRuntime(sb: SupabaseClient, configuration: InstagramPublicationConfiguration, decoder: StrictJpegDecoder) {
  const release = Object.freeze({ ...configuration.release })
  if (!['instagram_login', 'instagram_facebook_login'].includes(release.route)) throw new Error('Exact Instagram publication release unavailable.')
  const provider = instagramPhotoProvider(sb, configuration.server, decoder)
  const readCandidate = publicationCandidateReader(sb, { release, verifyProvider: provider.verifyProvider, verifyMedia: provider.verifyMedia })
  const source = publicationRuntimeSource(sb, release, readCandidate), assertTarget = source.assertTarget
  return {
    readCandidate,
    targetForReview: source.targetForReview,
    workerBindings(jobId: string): SocialProviderBindings {
      return {
        readCurrent: source.workerReadCurrent(jobId),
        async submit(intent) { assertTarget(intent); return await provider.submit(intent) },
        async publishReadyContainer(intent) { assertTarget(intent); return await provider.publishReadyContainer(intent) },
        async reconcile(intent, protocol) { assertTarget(intent); return await provider.reconcile(intent, protocol) },
      }
    },
  }
}
