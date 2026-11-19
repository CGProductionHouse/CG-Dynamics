import { verifyFacebookPhotoMedia } from './facebookPhotoMedia.ts'
import { verifyPublicationJpeg } from './publicationJpeg.ts'
import { decodePublicationJpeg } from './publicationJpegCodec.ts'
import type { PrivatePublicationSnapshot } from './socialPublishingMedia.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'

/** Qualify the unchanged approved original at inspection, preparation and again
 * before signed delivery. PNG retains its existing strict profile; JPEG uses
 * the already-qualified baseline decoder. No transform or MIME substitution.
 */
export async function verifyFacebookPublicationMedia(snapshot: Readonly<PrivatePublicationSnapshot>, target: Readonly<PublicationTarget>, now: () => number = Date.now) {
  if (target.route !== 'facebook_page') throw new Error('Facebook photo qualification unavailable.')
  return snapshot.mediaType === 'image/jpeg'
    ? await verifyPublicationJpeg(snapshot, target, decodePublicationJpeg, now)
    : await verifyFacebookPhotoMedia(snapshot, target, now)
}
