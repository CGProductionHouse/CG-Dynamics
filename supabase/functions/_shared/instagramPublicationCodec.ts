import jpeg from 'npm:jpeg-js@0.4.4'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { instagramPublicationRuntime, type InstagramPublicationConfiguration } from './instagramPublicationRuntime.ts'
import type { StrictJpegDecoder } from './publicationJpeg.ts'

/** CA-approved pinned codec adapter. Keep jpeg-js's packaged BSD license and
 * decoder's Apache-2.0 notice intact; no vendoring, conversion or re-encoding.
 * Options come from the bounded original-byte qualification, never a request.
 */
export const decodeInstagramPublicationJpeg: StrictJpegDecoder = (bytes, options) => jpeg.decode(bytes, { ...options })

/** PRIVATE source composition only. Does not register a worker/entrypoint,
 * parse activation flags, resolve an account or grant publication authority.
 * Existing immutable-source, exact-account and two-phase barriers still apply.
 */
export function instagramPublicationCodecRuntime(sb: SupabaseClient, configuration: InstagramPublicationConfiguration) {
  return instagramPublicationRuntime(sb, configuration, decodeInstagramPublicationJpeg)
}
