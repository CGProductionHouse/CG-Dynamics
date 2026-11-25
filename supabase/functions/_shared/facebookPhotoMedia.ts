import type { PrivatePublicationSnapshot } from './socialPublishingMedia.ts'
import type { PublicationTarget } from './socialPublicationAuthorization.ts'

// Conservative FIRST pilot profile, not a claim that Facebook only accepts PNG
// or imposes these dimensions. Meta Photo reference (16 Nov 2026) says static
// photos <10MB. PNG integrity follows W3C PNG Third Edition. No conversion,
// metadata stripping or dependency install; the original approved hash is kept.
// Rights/content suitability come from staff's exact publication confirmation,
// never from an image decoder. JPEG/video require their own qualified decoder.
export const FACEBOOK_PHOTO_PROFILE = 'facebook_static_png_8bit_v1'
export const FACEBOOK_PHOTO_MAX_BYTES = 9_999_999
const MAX_DIMENSION = 4096, MAX_PIXELS = 16_777_216
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function fail(): never { throw new Error('Facebook static PNG qualification unavailable.') }
function crc(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Bounded structural + real zlib/scanline validation for a deliberately narrow
 * static PNG profile. Signature/dimensions alone are insufficient. This does
 * not render/display the image or upload it to any external verifier.
 */
export async function verifyFacebookPhotoMedia(snapshot: Readonly<PrivatePublicationSnapshot>, target: Readonly<PublicationTarget>, now: () => number = Date.now) {
  if (target.route !== 'facebook_page' || !/^\d+$/.test(target.accountId) || snapshot.mediaType !== 'image/png'
    || snapshot.byteLength !== snapshot.bytes.length || snapshot.bytes.length < 57 || snapshot.bytes.length > FACEBOOK_PHOTO_MAX_BYTES) fail()
  const bytes = snapshot.bytes.slice(), view = new DataView(bytes.buffer)
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) fail()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('')
  if (hash !== snapshot.assetSha256) fail()
  let offset = 8, chunks = 0, width = 0, height = 0, channels = 0, dataEnded = false, ended = false
  const compressed: Uint8Array<ArrayBuffer>[] = [], seen = new Set<string>()
  while (offset < bytes.length) {
    if (++chunks > 2048 || offset + 12 > bytes.length) fail()
    const size = view.getUint32(offset), end = offset + 12 + size
    if (end > bytes.length) fail()
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8)), data = bytes.subarray(offset + 8, offset + 8 + size)
    if (!/^[A-Za-z]{4}$/.test(type) || crc(bytes.subarray(offset + 4, offset + 8 + size)) !== view.getUint32(offset + 8 + size)) fail()
    if (chunks === 1 && type !== 'IHDR') fail()
    if (type !== 'IDAT' && seen.has('IDAT')) dataEnded = true
    if (type === 'IHDR') {
      if (seen.has(type) || size !== 13) fail()
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12)
      channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[data[9]] ?? 0
      if (!width || !height || width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS
        || data[8] !== 8 || !channels || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) fail()
    } else if (type === 'IDAT') {
      if (dataEnded) fail()
      compressed.push(data)
    } else if (type === 'IEND') {
      if (size !== 0 || !seen.has('IDAT') || end !== bytes.length) fail()
      ended = true
    } else {
      // No APNG, palette, EXIF, compressed metadata or unreviewed extensions.
      if (seen.has('IDAT') || seen.has(type)) fail()
      if (type === 'sRGB') { if (size !== 1 || data[0] > 3) fail() }
      else if (type === 'gAMA') { if (size !== 4 || view.getUint32(offset + 8) === 0) fail() }
      else if (type === 'cHRM') { if (size !== 32) fail() }
      else if (type === 'pHYs') { if (size !== 9 || data[8] > 1) fail() }
      else fail()
    }
    seen.add(type); offset = end
  }
  if (!ended) fail()
  // Scanline filters are always 0..4. For this 8-bit, non-interlaced, non-indexed
  // profile, a valid bounded zlib stream of exact scanline size is decodable;
  // pixel reconstruction cannot introduce another file-format failure.
  const stride = width * channels + 1, expected = stride * height
  const reader = new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate')).getReader()
  let count = 0, complete = false
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) { complete = true; break }
      if (count + value.length > expected) fail()
      for (let i = (stride - count % stride) % stride; i < value.length; i += stride) if (value[i] > 4) fail()
      count += value.length
    }
    if (count !== expected) fail()
  } catch { fail() }
  finally { if (!complete) await reader.cancel().catch(() => {}); reader.releaseLock() }
  const checked = now()
  if (!Number.isFinite(checked)) fail()
  return { verified: true, profile: FACEBOOK_PHOTO_PROFILE, checkedAt: new Date(checked).toISOString() }
}
