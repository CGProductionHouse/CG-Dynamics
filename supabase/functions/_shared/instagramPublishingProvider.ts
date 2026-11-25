import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { resolveInstagramPublishingCredential, verifyInstagramPublishingTarget, type InstagramPublishingCredentialConfig } from './instagramPublishingCredential.ts'
import { instagramPhotoTransport } from './instagramPublishingTransport.ts'
import { createInstagramPhotoContainer, publishInstagramPhotoContainer, readInstagramPhotoStatus } from './instagramPublishing.ts'
import { verifyPublicationJpeg, INSTAGRAM_PHOTO_MAX_BYTES, type StrictJpegDecoder } from './publicationJpeg.ts'
import { inspectPublicationSnapshot, approvedSnapshotDelivery, type PrivatePublicationSnapshot } from './socialPublishingMedia.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'
import type { SocialProviderBindings } from './socialPublishingQueue.ts'
import type { PublishingIntent } from './socialPublishing.ts'

/** PRIVATE composition, deliberately NOT registered in any worker/Edge/MCP
 * activation path. Actual imported codec is REQUIRED: no passing media flag,
 * signature-only fallback or implicit dependency install. Exact rollout/staff
 * authority + canonical candidate admission remain separate gates.
 */
export function instagramPhotoProvider(sb: SupabaseClient, input: InstagramPublishingCredentialConfig & { projectUrl: string }, decoder: StrictJpegDecoder) {
  if (typeof decoder !== 'function') throw new Error('Qualified private JPEG decoder required.')
  const config = Object.freeze({ instagram: input.instagram ? Object.freeze({ ...input.instagram }) : undefined,
    facebook: input.facebook ? Object.freeze({ ...input.facebook }) : undefined })
  const delivery = approvedSnapshotDelivery(sb, input.projectUrl)
  const verifyMedia = (snapshot: Readonly<PrivatePublicationSnapshot>, target: Readonly<PublicationTarget>) => verifyPublicationJpeg(snapshot, target, decoder)
  const transport = (intent: Readonly<PublishingIntent>, stage: 'create' | 'publish' | 'status') => {
    const settings = intent.route === 'instagram_login' ? config.instagram : config.facebook
    if (!settings || !['instagram_login', 'instagram_facebook_login'].includes(intent.route)) throw new Error('Exact Instagram route configuration required.')
    return instagramPhotoTransport({ intent, stage, graphVersion: settings.graphVersion, appSecret: config.facebook?.appSecret,
      resolveCredential: i => resolveInstagramPublishingCredential(sb, i, config),
      qualifiedMediaUrl: async i => {
        const snapshot = await inspectPublicationSnapshot(sb, i, INSTAGRAM_PHOTO_MAX_BYTES)
        await verifyMedia(snapshot, i)
        return await delivery(i)
      } })
  }
  const bindings = {
    async submit(intent) { return await createInstagramPhotoContainer(intent, await transport(intent, 'create')) },
    async publishReadyContainer(intent) { return await publishInstagramPhotoContainer(intent, await transport(intent, 'publish')) },
    async reconcile(intent, protocol) {
      if (!protocol) throw new Error('Durable Instagram protocol receipt required.')
      return await readInstagramPhotoStatus(intent, await transport(intent, 'status'), protocol)
    },
  } satisfies Omit<SocialProviderBindings, 'readCurrent'>
  return { ...bindings, verifyMedia, verifyProvider: (target: Readonly<PublicationTarget>) => verifyInstagramPublishingTarget(sb, target, config) }
}
