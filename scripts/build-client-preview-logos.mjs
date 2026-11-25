// Local asset preparation only. Use an already-installed sharp module; no runtime
// dependency, network access, client data or original-logo mutation is required.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { decodePng } from './sync-client-logos.mjs'

export const PREVIEW_SIZE = { width: 1200, height: 630 }
const DARK = [8, 20, 16], LIGHT = [248, 249, 247]
// Visual review: this original combines dark red lettering with a white animal
// illustration. A neutral matte preserves both; artwork and colours stay intact.
const REVIEWED_MATTES = { 'ehrlich-park-butchery.png': [148, 156, 151] }
const channel = n => n / 255 <= 0.04045 ? n / 255 / 12.92 : ((n / 255 + 0.055) / 1.055) ** 2.4
const luminance = rgb => .2126 * channel(rgb[0]) + .7152 * channel(rgb[1]) + .0722 * channel(rgb[2])
const contrast = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
const hash = value => createHash('sha256').update(value).digest('hex')

export function previewBackground(image) {
  if (!image?.rgba?.length) throw Error('Preview artwork unavailable')
  const scores = [0, 0], backgrounds = [DARK, LIGHT].map(luminance)
  let weight = 0
  for (let p = 0; p < image.rgba.length; p += 4) {
    const alpha = image.rgba[p + 3] / 255
    if (alpha < .1) continue
    const light = luminance(image.rgba.subarray(p, p + 3))
    weight += alpha
    // Penalise disappearing fine lettering rather than allowing a large coloured
    // emblem to outvote it (for example blue artwork with small white wording).
    backgrounds.forEach((background, i) => { scores[i] -= alpha / contrast(light, background) ** 2 })
  }
  if (!weight) throw Error('Preview artwork is empty')
  const corners = [0, image.width - 1, (image.height - 1) * image.width, image.width * image.height - 1]
    .map(p => [...image.rgba.subarray(p * 4, p * 4 + 4)])
  if (image.width > 1 && image.height > 1 && corners.every(c => c[3] === 255 && c.slice(0, 3).every((v, i) => Math.abs(v - corners[0][i]) <= 8))) {
    return corners[0].slice(0, 3)
  }
  return scores[0] >= scores[1] ? DARK : LIGHT
}

export async function buildClientPreviewLogos(root, sharp) {
  const sourceRoot = join(root, 'public/client-logos'), outputRoot = join(root, 'public/client-preview-logos')
  const assets = {}
  mkdirSync(outputRoot, { recursive: true })
  for (const file of readdirSync(sourceRoot).sort()) {
    if (!/^[a-z0-9-]+\.png$/.test(file)) continue
    const original = readFileSync(join(sourceRoot, file)), decoded = decodePng(original)
    if (!decoded) throw Error(`Unsupported preview source: ${file}`)
    const rgb = REVIEWED_MATTES[file] ?? previewBackground(decoded), background = { r: rgb[0], g: rgb[1], b: rgb[2], alpha: 1 }
    // Keep the entire original logo, with generous padding; even a square crop
    // of the wide card retains the mark. Never redraw or recolour the artwork.
    let left = decoded.width, top = decoded.height, right = -1, bottom = -1
    for (let y = 0; y < decoded.height; y++) for (let x = 0; x < decoded.width; x++) {
      if (!decoded.rgba[(y * decoded.width + x) * 4 + 3]) continue
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
    const logo = await sharp(original).extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
      .resize({ width: 520, height: 470, fit: 'inside', withoutEnlargement: true }).toBuffer()
    const { width, height } = await sharp(logo).metadata()
    const png = await sharp({ create: { ...PREVIEW_SIZE, channels: 4, background } })
      .composite([{ input: logo, left: Math.floor((1200 - width) / 2), top: Math.floor((630 - height) / 2) }])
      .flatten({ background }).png({ compressionLevel: 9 }).toBuffer()
    const sourceSha256 = hash(original), outputSha256 = hash(png)
    const name = `${file.slice(0, -4)}-${outputSha256.slice(0, 16)}.png`
    writeFileSync(join(outputRoot, name), png)
    assets[`/client-logos/${file}`] = { path: `/client-preview-logos/${name}`, sourceSha256, outputSha256, ...PREVIEW_SIZE, background: rgb }
  }
  const manifest = { version: 3, assets }
  writeFileSync(join(outputRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.env.CG_SHARP_MODULE) throw Error('CG_SHARP_MODULE must identify an existing local sharp module')
  const { default: sharp } = await import(pathToFileURL(resolve(process.env.CG_SHARP_MODULE)).href)
  const manifest = await buildClientPreviewLogos(process.cwd(), sharp)
  console.log(`Prepared ${Object.keys(manifest.assets).length} opaque client preview images; original logos unchanged.`)
}
