import jpeg from 'npm:jpeg-js@0.4.4'
import type { StrictJpegDecoder } from './publicationJpeg.ts'

/** Existing CA-approved pinned decoder, shared by the private photo adapters.
 * Preserve the packaged BSD license and decoder's Apache-2.0 notice. Decode
 * options are fixed by qualification; no conversion, encoding or request port.
 */
export const decodePublicationJpeg: StrictJpegDecoder = (bytes, options) => jpeg.decode(bytes, { ...options })
