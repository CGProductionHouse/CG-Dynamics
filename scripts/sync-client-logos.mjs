// Reusable client logo maintenance workflow.
//
// Scans logo-dump/ for image files, infers a clean slug filename from each
// name, trims excess empty canvas (transparent or solid-colour borders), adds
// a small safe margin, and writes a web-ready copy into public/client-logos/.
// Originals in logo-dump/ are never modified or deleted.
//
// Image processing is done with Node's built-in zlib only (no native deps).
// It supports 8-bit, non-interlaced PNGs (the common export format). Any other
// format (JPEG, interlaced/palette PNG, etc.) is copied through untouched and
// reported, so trimming is never faked.
//
// Run with:  node scripts/sync-client-logos.mjs
// See CLIENT_LOGO_MAINTENANCE.md for the full workflow.

import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'logo-dump')
const DEST_DIR = join(ROOT, 'public', 'client-logos')

const SUPPORTED = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg'])

const STOP_WORDS = new Set([
  'logo', 'final', 'copy', 'white', 'black', 'transparent',
  'icon', '01', '02', 'new', 'old', 'promotion', 'promotions',
])

// ─── slug aliases ───────────────────────────────────────────────────────────
// Some client names produce a runtime slug (clientSlug()) that differs from
// the sync-script slug because STOP_WORDS strip a word present in the client
// name (e.g. "Promotions", "Attorneys", "Bloemfontein", "White").  After the
// main sync loop, each source file is copied to the alias destination so the
// app can resolve the logo at runtime.
//
// Format: { src: '<canonical output name>', dest: '<alias name>' }
// If the source file does not yet exist in DEST_DIR the alias is skipped with
// a warning (will be applied automatically the next time the source is synced).
const ALIASES = [
  { src: 'bloem-action-sport.png',       dest: 'action-sport.png' },
  { src: 'bohemia-04.png',               dest: 'bohemia.png' },
  { src: 'braize.png',                   dest: 'braize-promotions.png' },
  { src: 'dulux-paint-bloemfontein.png', dest: 'dulux-bloemfontein.png' },
  { src: 'hmh.png',                      dest: 'hmh-attorneys.png' },
  { src: 'local-meat-deli.png',          dest: 'local-deli.png' },
  { src: 'madisons.png',                 dest: 'madison-wear.png' },
  { src: 'psg-wit.png',                  dest: 'psg.png' },
  { src: 'tbs-brokers.png',              dest: 'tbs.png' },
  { src: 'bloem-marble-marketing.png',   dest: 'bloem-marble-granite.png' },
]

// ─── filename slug ──────────────────────────────────────────────────────────

function slugifyBase(base) {
  const spaced = base.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const raw = spaced.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const tokens = raw.split('-').filter(Boolean)
  let removedStop = 0
  const kept = tokens.filter(token => {
    if (STOP_WORDS.has(token)) { removedStop += 1; return false }
    return true
  })
  let removedTrailingSingle = false
  while (kept.length > 1 && kept[kept.length - 1].length === 1) {
    kept.pop()
    removedTrailingSingle = true
  }
  const slug = kept.join('-') || raw
  const needsReview = removedStop >= 2 || removedTrailingSingle || kept.length === 0
  return { slug, needsReview }
}

// ─── minimal PNG codec (8-bit, non-interlaced) ──────────────────────────────

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  if (pa <= pb && pa <= pc) return a
  if (pb <= pc) return b
  return c
}

// Decode an 8-bit, non-interlaced PNG into a flat RGBA buffer. Returns null for
// anything we cannot decode safely.
function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  let offset = 8
  let width = 0
  let height = 0
  let colorType = -1
  let bitDepth = 0
  let interlace = 0
  const idat = []

  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const data = buf.subarray(dataStart, dataStart + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    offset = dataStart + len + 4 // skip data + CRC
  }

  if (bitDepth !== 8 || interlace !== 0 || !(colorType in CHANNELS)) return null

  const channels = CHANNELS[colorType]
  const stride = width * channels
  let filtered
  try {
    filtered = zlib.inflateSync(Buffer.concat(idat))
  } catch {
    return null
  }
  if (filtered.length < (stride + 1) * height) return null

  const out = Buffer.alloc(stride * height)
  let pos = 0
  for (let y = 0; y < height; y += 1) {
    const ft = filtered[pos]
    pos += 1
    for (let x = 0; x < stride; x += 1) {
      const rawByte = filtered[pos]
      pos += 1
      const a = x >= channels ? out[y * stride + x - channels] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0
      let val
      switch (ft) {
        case 0: val = rawByte; break
        case 1: val = rawByte + a; break
        case 2: val = rawByte + b; break
        case 3: val = rawByte + ((a + b) >> 1); break
        case 4: val = rawByte + paeth(a, b, c); break
        default: return null
      }
      out[y * stride + x] = val & 0xff
    }
  }

  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    let r; let g; let b; let a
    if (channels === 4) { r = out[i * 4]; g = out[i * 4 + 1]; b = out[i * 4 + 2]; a = out[i * 4 + 3] }
    else if (channels === 3) { r = out[i * 3]; g = out[i * 3 + 1]; b = out[i * 3 + 2]; a = 255 }
    else if (channels === 2) { r = out[i * 2]; g = r; b = r; a = out[i * 2 + 1] }
    else { r = out[i]; g = r; b = r; a = 255 }
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a
  }
  return { width, height, rgba }
}

function encodePng(rgba, width, height) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = zlib.deflateSync(raw, { level: 9 })

  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length, 0)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
    return Buffer.concat([len, typeBuf, data, crc])
  }

  return Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── trimming ───────────────────────────────────────────────────────────────

// Find the tight bounding box of the actual artwork, trimming transparent
// padding and, when the image is fully opaque, a uniform solid border.
function contentBox({ width, height, rgba }) {
  const alphaThreshold = 24
  let minX = width; let minY = height; let maxX = -1; let maxY = -1
  let transparentPixels = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = rgba[(y * width + x) * 4 + 3]
      if (a < 250) transparentPixels += 1
      if (a > alphaThreshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  const hasTransparency = transparentPixels > width * height * 0.001
  if (maxX < minX || maxY < minY) return null // fully transparent — leave alone

  const alphaTrims = minX > 0 || minY > 0 || maxX < width - 1 || maxY < height - 1
  if (hasTransparency && alphaTrims) {
    return { minX, minY, maxX, maxY, transparent: true, bg: null }
  }

  // No transparency to trim: look for a uniform solid border instead.
  const corner = i => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]
  const corners = [
    corner(0),
    corner(width - 1),
    corner((height - 1) * width),
    corner((height - 1) * width + width - 1),
  ]
  const close = (p, q, tol) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol && Math.abs(p[2] - q[2]) <= tol
  const cornersAgree = corners.every(c => close(c, corners[0], 8))
  if (!cornersAgree) return null

  const bg = corners[0]
  const tol = 14
  let sMinX = width; let sMinY = height; let sMaxX = -1; let sMaxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const isBg = Math.abs(rgba[i] - bg[0]) <= tol && Math.abs(rgba[i + 1] - bg[1]) <= tol && Math.abs(rgba[i + 2] - bg[2]) <= tol
      if (!isBg) {
        if (x < sMinX) sMinX = x
        if (x > sMaxX) sMaxX = x
        if (y < sMinY) sMinY = y
        if (y > sMaxY) sMaxY = y
      }
    }
  }
  if (sMaxX < sMinX || sMaxY < sMinY) return null
  const solidTrims = sMinX > 0 || sMinY > 0 || sMaxX < width - 1 || sMaxY < height - 1
  if (!solidTrims) return null
  return { minX: sMinX, minY: sMinY, maxX: sMaxX, maxY: sMaxY, transparent: false, bg }
}

function trimImage(image) {
  const box = contentBox(image)
  if (!box) return null

  const trimW = box.maxX - box.minX + 1
  const trimH = box.maxY - box.minY + 1

  // Already tight in both dimensions — trimming + padding would only bloat the
  // canvas and make the logo appear smaller, so leave it alone.
  if (trimW >= image.width * 0.9 && trimH >= image.height * 0.9) return null

  // Guard against pathological over-trim (e.g. a stray dot in a huge canvas).
  if (trimW < image.width * 0.02 && trimH < image.height * 0.02) return null

  // Small, uniform safe margin, capped so the short side is never over-padded.
  const pad = Math.max(8, Math.min(Math.round(Math.max(trimW, trimH) * 0.03), Math.round(Math.min(trimW, trimH) * 0.1)))
  const outW = trimW + pad * 2
  const outH = trimH + pad * 2
  const out = Buffer.alloc(outW * outH * 4)

  // Fill with the padding colour: transparent, or the detected solid bg.
  if (!box.transparent && box.bg) {
    for (let i = 0; i < outW * outH; i += 1) {
      out[i * 4] = box.bg[0]; out[i * 4 + 1] = box.bg[1]; out[i * 4 + 2] = box.bg[2]; out[i * 4 + 3] = 255
    }
  }

  for (let y = 0; y < trimH; y += 1) {
    const srcStart = ((box.minY + y) * image.width + box.minX) * 4
    const dstStart = ((y + pad) * outW + pad) * 4
    image.rgba.copy(out, dstStart, srcStart, srcStart + trimW * 4)
  }

  return { width: outW, height: outH, rgba: out }
}

// ─── reporting helpers ──────────────────────────────────────────────────────

function pngSize(buf) {
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  }
  return null
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null
  let o = 2
  while (o + 9 < buf.length) {
    if (buf[o] !== 0xff) { o += 1; continue }
    const marker = buf[o + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(o + 7), height: buf.readUInt16BE(o + 5) }
    }
    o += 2 + buf.readUInt16BE(o + 2)
  }
  return null
}

const dim = size => (size ? `${size.width}x${size.height}` : 'unknown')

// ─── main ───────────────────────────────────────────────────────────────────

function run() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Source folder not found: ${SRC_DIR}`)
    process.exit(1)
  }
  mkdirSync(DEST_DIR, { recursive: true })

  const rows = []
  const skipped = []
  const needsReview = []
  const skippedTrim = []
  const seenSlugs = new Map()

  const entries = readdirSync(SRC_DIR)
    .filter(name => statSync(join(SRC_DIR, name)).isFile())
    .sort((a, b) => a.localeCompare(b))

  for (const name of entries) {
    const ext = extname(name).toLowerCase()
    if (!SUPPORTED.has(ext)) {
      skipped.push({ name, reason: `unsupported extension (${ext || 'none'})` })
      continue
    }

    const { slug, needsReview: review } = slugifyBase(basename(name, extname(name)))
    if (!slug) {
      skipped.push({ name, reason: 'could not infer a slug' })
      continue
    }
    if (seenSlugs.has(slug) && seenSlugs.get(slug) !== name) {
      needsReview.push({ name, target: `${slug}${ext}`, note: `slug collides with ${seenSlugs.get(slug)}` })
    }
    seenSlugs.set(slug, name)

    const srcBuf = readFileSync(join(SRC_DIR, name))
    const target = `${slug}.png`
    const targetPng = join(DEST_DIR, target)

    let originalDim = ext === '.png' ? pngSize(srcBuf) : ext.startsWith('.jp') ? jpegSize(srcBuf) : null
    let outputDim = null
    let trimmed = false

    if (ext === '.png') {
      const decoded = decodePng(srcBuf)
      if (decoded) {
        originalDim = { width: decoded.width, height: decoded.height }
        const trimmedImage = trimImage(decoded)
        if (trimmedImage) {
          writeFileSync(targetPng, encodePng(trimmedImage.rgba, trimmedImage.width, trimmedImage.height))
          outputDim = { width: trimmedImage.width, height: trimmedImage.height }
          trimmed = true
        } else {
          copyFileSync(join(SRC_DIR, name), targetPng)
          outputDim = originalDim
        }
      } else {
        // Unsupported PNG variant — copy through untouched.
        const out = join(DEST_DIR, `${slug}${ext}`)
        copyFileSync(join(SRC_DIR, name), out)
        outputDim = originalDim
        skippedTrim.push({ name, reason: 'PNG variant not supported for safe trimming (interlaced/palette/bit-depth)' })
      }
    } else {
      // Non-PNG: copy through untouched, keep original extension.
      const out = join(DEST_DIR, `${slug}${ext}`)
      copyFileSync(join(SRC_DIR, name), out)
      outputDim = originalDim
      skippedTrim.push({ name, reason: `${ext} not supported for safe trimming — copied as-is` })
    }

    if (review) {
      needsReview.push({ name, target, note: 'slug inferred from a messy filename — verify the client name' })
    }
    rows.push({ name, target: ext === '.png' ? target : `${slug}${ext}`, originalDim, outputDim, trimmed })
  }

  console.log('\nClient logo sync')
  console.log('================')
  console.log(`Source : ${SRC_DIR}`)
  console.log(`Output : ${DEST_DIR}`)
  console.log(`\nProcessed (${rows.length}):`)
  console.log('  original file -> output file | original -> output | trimmed')
  rows.forEach(r => {
    console.log(`  ${r.name}  ->  ${r.target}  |  ${dim(r.originalDim)} -> ${dim(r.outputDim)}  |  ${r.trimmed ? 'yes' : 'no'}`)
  })

  console.log(`\nSkipped entirely (${skipped.length}):`)
  if (skipped.length === 0) console.log('  (none)')
  skipped.forEach(s => console.log(`  ${s.name}  —  ${s.reason}`))

  console.log(`\nTrimming skipped, copied as-is (${skippedTrim.length}):`)
  if (skippedTrim.length === 0) console.log('  (none)')
  skippedTrim.forEach(s => console.log(`  ${s.name}  —  ${s.reason}`))

  console.log(`\nNeeds review (${needsReview.length}):`)
  if (needsReview.length === 0) console.log('  (none)')
  needsReview.forEach(s => console.log(`  ${s.name}  ->  ${s.target}  —  ${s.note}`))

  // Apply slug aliases so the runtime clientSlug() can always find the file.
  const aliasApplied = []
  const aliasSkipped = []
  for (const { src, dest } of ALIASES) {
    const srcPath = join(DEST_DIR, src)
    const destPath = join(DEST_DIR, dest)
    if (!existsSync(srcPath)) {
      aliasSkipped.push({ src, dest })
      continue
    }
    copyFileSync(srcPath, destPath)
    aliasApplied.push({ src, dest })
  }
  console.log(`\nAlias copies (${aliasApplied.length}):`)
  if (aliasApplied.length === 0) console.log('  (none)')
  aliasApplied.forEach(a => console.log(`  ${a.dest}  <-  ${a.src}`))
  if (aliasSkipped.length > 0) {
    console.log(`\nAlias copies skipped — source not yet synced (${aliasSkipped.length}):`)
    aliasSkipped.forEach(a => console.log(`  ${a.dest}  <-  ${a.src}  (source missing)`))
  }
  console.log('')
}

run()
