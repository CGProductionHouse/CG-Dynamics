import type { PrivatePublicationSnapshot } from './socialPublishingMedia.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'

export interface StrictJpegDecodeOptions {
  useTArray: true; formatAsRGBA: true; tolerantDecoding: false; maxResolutionInMP: 4; maxMemoryUsageInMB: 64
}
// PRIVATE imported-codec port, never a request/AI-supplied qualification flag.
// No default decoder. Production dependency adoption/registration is separate.
export type StrictJpegDecoder = (bytes: Uint8Array<ArrayBuffer>, options: Readonly<StrictJpegDecodeOptions>) => { width: number; height: number; data: Uint8Array }
export const PUBLICATION_JPEG_DECODE_OPTIONS: Readonly<StrictJpegDecodeOptions> = Object.freeze({ useTArray: true, formatAsRGBA: true,
  tolerantDecoding: false, maxResolutionInMP: 4, maxMemoryUsageInMB: 64 })
function fail(): never { throw new Error('Original publication JPEG qualification unavailable.') }

/** Bounded conservative JPEG profile: baseline 8-bit JFIF, one scan, ordinary
 * greyscale/YCbCr, no EXIF/ICC/Adobe/MPO/extensions or trailing second file. Header
 * parsing only constrains the profile; ACTUAL strict pixel decode is mandatory.
 * No recompression, colour/profile/orientation edits or metadata stripping.
 */
export async function verifyPublicationJpeg(snapshot: Readonly<PrivatePublicationSnapshot>, target: Readonly<PublicationTarget>, decode: StrictJpegDecoder,
  now: () => number = Date.now) {
  const instagram = ['instagram_login', 'instagram_facebook_login'].includes(target.route)
  if ((!instagram && target.route !== 'facebook_page') || !/^\d+$/.test(target.accountId) || typeof decode !== 'function'
    || snapshot.mediaType !== 'image/jpeg' || snapshot.byteLength !== snapshot.bytes.length || snapshot.byteLength < 32
    || snapshot.byteLength > (instagram ? 8_000_000 : 9_999_999)) fail()
  const b = snapshot.bytes.slice(), view = new DataView(b.buffer)
  if (b[0] !== 255 || b[1] !== 216) fail()
  let p = 2, segments = 0, width = 0, height = 0, jfif = false, scan = false
  while (p < b.length) {
    if (++segments > 128 || b[p++] !== 255) fail()
    while (b[p] === 255) p++
    const marker = b[p++]
    if (p + 2 > b.length) fail()
    const size = view.getUint16(p), end = p + size
    if (size < 2 || end > b.length) fail()
    if (marker === 224) {
      if (jfif || size < 16 || ![74, 70, 73, 70, 0].every((v, k) => b[p + 2 + k] === v) || b[p + 7] !== 1) fail()
      jfif = true
    } else if (marker === 192) {
      if (width || size < 11 || b[p + 2] !== 8) fail()
      height = view.getUint16(p + 3); width = view.getUint16(p + 5)
      const components = b[p + 7]
      if (![1, 3].includes(components) || size !== 8 + 3 * components) fail()
      for (let k = 0; k < components; k++) if (b[p + 8 + 3 * k] !== k + 1) fail()
      if (!width || !height || width > 4096 || height > 4096 || width * height > 4_000_000
        || (instagram && (width < 320 || width > 1440 || width * 5 < height * 4 || width * 100 > height * 191))) fail()
    } else if (marker === 218) {
      if (!width || !jfif || size < 6) fail()
      scan = true; p = end; break
    } else if (![196, 219, 221].includes(marker)) fail()
    p = end
  }
  if (!scan) fail()
  let ended = false
  while (p < b.length) {
    if (b[p++] !== 255) continue
    while (b[p] === 255) p++
    const marker = b[p++]
    if (marker === 0 || (marker >= 208 && marker <= 215)) continue
    if (marker !== 217 || p !== b.length) fail()
    ended = true; break
  }
  if (!ended) fail()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), n => n.toString(16).padStart(2, '0')).join('')
  if (hash !== snapshot.assetSha256) fail()
  try {
    const pixels = decode(b, PUBLICATION_JPEG_DECODE_OPTIONS)
    if (pixels.width !== width || pixels.height !== height || !(pixels.data instanceof Uint8Array) || pixels.data.byteLength !== width * height * 4) fail()
  } catch { fail() }
  const checked = now()
  if (!Number.isFinite(checked)) fail()
  return { verified: true, profile: instagram ? 'instagram_baseline_jpeg_v1' : 'facebook_baseline_jpeg_v1', checkedAt: new Date(checked).toISOString(), width, height }
}
