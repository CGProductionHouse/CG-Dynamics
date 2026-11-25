import { createHash } from 'node:crypto'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')

// Only bundled, exact-source, opaque preview assets may become social thumbnails.
// Missing/stale previews omit the image instead of exposing a raw transparent logo.
export async function verifiedClientPreview(source, manifest, readPublicAsset) {
  if (typeof source !== 'string' || !/^\/client-logos\/[a-z0-9-]+\.png$/.test(source) || manifest?.version !== 3) return null
  const preview = manifest.assets?.[source]
  if (!preview || preview.width !== 1200 || preview.height !== 630
    || !/^[a-f0-9]{64}$/.test(preview.sourceSha256 ?? '') || !/^[a-f0-9]{64}$/.test(preview.outputSha256 ?? '')) return null
  const expected = source.replace('/client-logos/', '/client-preview-logos/').replace(/\.png$/, `-${preview.outputSha256.slice(0, 16)}.png`)
  if (preview.path !== expected) return null
  try {
    const original = await readPublicAsset(source)
    if (hash(original) !== preview.sourceSha256) return null
    const output = await readPublicAsset(expected)
    return hash(output) === preview.outputSha256 ? expected : null
  } catch { return null }
}
