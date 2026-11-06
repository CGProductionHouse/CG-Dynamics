#!/usr/bin/env node

// Local packaging only. No network, credentials, publishing or desktop control.
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const LIMIT = 9_500_000 // Leave headroom below the observed Canva 10 MiB limit.
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value.trim()
}
function number(value, name, min = -Infinity, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} is outside its supported range`)
  return value
}
function id(value, name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(required(value, name))) throw new Error(`${name} must be a stable safe identifier`)
  return value
}
function colour(value, scope) {
  if (!/^#[a-f0-9]{6}$/i.test(value ?? '')) throw new Error('An explicit six-digit colour is required')
  if (!scope.colours.map((entry) => entry.toUpperCase()).includes(value.toUpperCase())) throw new Error(`Unverified colour ${value} for ${scope.key}`)
  return value.toUpperCase()
}
function geometry(layer) {
  return `position:absolute;left:${number(layer.x, 'x')}px;top:${number(layer.y, 'y')}px;width:${number(layer.width, 'width', 0.01)}px;height:${number(layer.height, 'height', 0.01)}px;opacity:${number(layer.opacity ?? 1, 'opacity', 0, 1)};transform:rotate(${number(layer.rotation ?? 0, 'rotation', -360, 360)}deg);`
}
function assertReviewMetadata(bytes, mime) {
  const deny = () => { throw new Error('Private EXIF/XMP/IPTC/text metadata found; prepare a clean review derivative first') }
  if (mime === 'image/png') {
    for (let at = 8; at + 12 <= bytes.length;) {
      const length = bytes.readUInt32BE(at)
      if (at + length + 12 > bytes.length) throw new Error('Malformed PNG chunk')
      const kind = bytes.toString('ascii', at + 4, at + 8)
      if (['eXIf', 'tEXt', 'iTXt', 'zTXt'].includes(kind)) deny()
      at += length + 12
    }
  } else if (mime === 'image/jpeg') {
    for (let at = 2; at + 1 < bytes.length;) {
      if (bytes[at++] !== 255) throw new Error('Malformed JPEG marker')
      while (bytes[at] === 255) at++
      const marker = bytes[at++]
      if (marker === 218 || marker === 217) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (at + 2 > bytes.length) throw new Error('Malformed JPEG segment')
      const length = bytes.readUInt16BE(at)
      if (length < 2 || at + length > bytes.length) throw new Error('Malformed JPEG segment')
      if ([225, 237, 254].includes(marker)) deny()
      at += length
    }
  } else {
    for (let at = 12; at + 8 <= bytes.length;) {
      const kind = bytes.toString('ascii', at, at + 4)
      const length = bytes.readUInt32LE(at + 4)
      if (at + length + 8 > bytes.length) throw new Error('Malformed WebP chunk')
      if (['EXIF', 'XMP '].includes(kind)) deny()
      at += 8 + length + (length % 2)
    }
  }
}
function imageBytes(root, asset) {
  const name = required(asset, 'image.asset')
  if (/^[a-z]+:/i.test(name) || isAbsolute(name)) throw new Error('Use a private job-relative asset, never a remote URL or absolute path')
  const candidate = resolve(root, name)
  const contained = (path) => {
    const rel = relative(root, path)
    if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) throw new Error('Asset escapes the private job directory')
    return rel
  }
  contained(candidate) // Check before touching another directory or network share.
  const path = realpathSync(candidate)
  const rel = contained(path) // Also reject symlink escapes.
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(path).toLowerCase()]
  if (!mime) throw new Error('Use a PNG/JPEG/WebP image; active or externally linked SVG is not accepted here')
  if (statSync(path).size > LIMIT) throw new Error('Prepare an intentional poster-size derivative before packaging this image')
  const bytes = readFileSync(path)
  const signatures = { 'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/jpeg': bytes[0] === 255 && bytes[1] === 216, 'image/webp': bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' }
  if (!signatures[mime]) throw new Error('Image bytes do not match the declared extension')
  assertReviewMetadata(bytes, mime) // ICC colour profiles are retained.
  return { uri: `data:${mime};base64,${bytes.toString('base64')}`, sha256: hash(bytes), bytes: bytes.length, relativePath: rel }
}

export function buildNativeCanvaPackage(document, jobDirectory, { maxBytes = LIMIT } = {}) {
  if (document.schemaVersion !== 1 || document.status !== 'internal-draft') throw new Error('Only schemaVersion 1 internal drafts may be packaged')
  const root = realpathSync(jobDirectory)
  const title = required(document.title, 'title')
  const scopes = new Map((document.brandScopes ?? []).map((scope) => [scope.key, scope]))
  const width = number(document.canvas?.width, 'canvas.width', 1, 10000)
  const height = number(document.canvas?.height, 'canvas.height', 1, 10000)
  if (!document.pages?.length) throw new Error('At least one individually composed page is required')
  if (document.pages.length > 30) throw new Error('Package at most 30 poster pages at a time')
  number(maxBytes, 'maxBytes', 1, LIMIT)
  let imagePayloadBytes = 0
  const pageIds = new Set()
  const manifest = { schemaVersion: 1, title, canvas: { width, height }, status: 'internal-draft', pages: [], qualityApproval: false, integration: 'local-package-only', publicHosting: false }
  const pages = document.pages.map((page, index) => {
    const pageId = id(page.id, 'page.id')
    if (pageIds.has(pageId)) throw new Error('Duplicate page ID')
    pageIds.add(pageId)
    const scope = scopes.get(page.brandScope)
    if (!scope || scope.authority !== 'verified-canva-kit' || !scope.fonts?.length || !scope.colours?.length) throw new Error('An exact verified Canva brand scope is required')
    const notes = required(page.notes, 'accurate internal page notes')
    const ids = new Set()
    const records = []
    const layers = page.layers.map((layer) => {
      const layerId = id(layer.id, 'layer.id')
      if (ids.has(layerId)) throw new Error('Duplicate layer ID')
      ids.add(layerId)
      const box = geometry(layer)
      const label = `layer:${layerId}`
      const record = { id: layerId, type: layer.type, x: layer.x, y: layer.y, width: layer.width, height: layer.height }
      records.push(record)
      if (layer.type === 'text') {
        if (!scope.fonts.includes(layer.fontFamily) || !/^[a-zA-Z0-9 _-]+$/.test(layer.fontFamily)) throw new Error(`Unverified font ${layer.fontFamily}`)
        const lines = layer.lines ?? [required(layer.text, 'text')]
        if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== 'string')) throw new Error('Text lines must be strings')
        const fontSize = number(layer.fontSize, 'fontSize', 1, 1000)
        const lineHeight = number(layer.lineHeight ?? 1.1, 'lineHeight', 0.5, 3)
        const align = layer.align ?? 'left'
        if (!['left', 'center', 'right'].includes(align)) throw new Error('Unsupported text alignment')
        record.text = lines.join('\n')
        record.fontFamily = layer.fontFamily
        record.fontSize = fontSize
        record.lineHeight = lineHeight
        const weight = layer.fontWeight ?? 400
        if (![400, 500, 600, 700, 800, 900].includes(weight)) throw new Error('Unsupported font weight')
        const fontStyle = layer.fontStyle ?? 'normal'
        if (!['normal', 'italic'].includes(fontStyle)) throw new Error('Unsupported font style')
        Object.assign(record, { fontWeight: weight, fontStyle })
        return `<div data-layer-id="${label}" style="${box}font-family:'${escape(layer.fontFamily)}';font-size:${fontSize}px;line-height:${lineHeight};font-weight:${weight};font-style:${fontStyle};letter-spacing:${number(layer.letterSpacing ?? 0, 'letterSpacing', -10, 50)}px;color:${colour(layer.colour, scope)};text-align:${align};white-space:nowrap;">${lines.map(escape).join('<br>')}</div>`
      }
      if (layer.type === 'rect') {
        const radius = number(layer.radius ?? 0, 'radius', 0, 10000)
        return `<div data-layer-id="${label}" style="${box}background:${colour(layer.colour, scope)};border-radius:${radius}px;"></div>`
      }
      if (layer.type === 'image') {
        const image = imageBytes(root, layer.asset)
        imagePayloadBytes += image.uri.length
        if (imagePayloadBytes > maxBytes) throw new Error('Image payload exceeds the private package budget; split pages or prepare deliberate derivatives')
        if (layer.expectedSha256 && layer.expectedSha256 !== image.sha256) throw new Error(`Asset hash changed for ${layerId}`)
        const fit = layer.fit ?? 'cover'
        if (!['cover', 'contain'].includes(fit)) throw new Error('Unsupported image fit')
        Object.assign(record, { source: { relativePath: image.relativePath, sha256: image.sha256, bytes: image.bytes }, role: layer.role ?? 'photo' })
        return `<img data-layer-id="${label}" alt="${label} | ${escape(required(layer.description, 'image description'))}" src="${image.uri}" style="${box}object-fit:${fit};border-radius:${number(layer.radius ?? 0, 'radius', 0, 10000)}px;">`
      }
      if (layer.type === 'nativeAsset') {
        const assetId = required(layer.assetId, 'native assetId')
        if (!/^MA[a-zA-Z0-9_-]+$/.test(assetId)) throw new Error('Expected a verified native Canva asset ID')
        if (!['replace-frame', 'delete-and-insert'].includes(layer.bindingMode)) throw new Error('Declare raster replacement or vector insertion explicitly')
        Object.assign(record, { nativeAssetId: assetId, bindingMode: layer.bindingMode, bindingRequired: true })
        return `<img data-layer-id="${label}" alt="UNBOUND NATIVE ASSET ${assetId} | ${label}" src="${TRANSPARENT_PIXEL}" style="${box}">`
      }
      throw new Error(`Unsupported layer type ${layer.type}; do not flatten silently`)
    }).join('')
    manifest.pages.push({ id: pageId, index: index + 1, brandScope: page.brandScope, label: required(page.label, 'page.label'), notes, layers: records })
    return `<section data-document-role="page" data-label="${escape(page.label)}" data-speaker-notes="${escape(notes)}" style="position:relative;width:${width}px;height:${height}px;background:${colour(page.background, scope)};overflow:hidden;">${layers}</section>`
  }).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>*{box-sizing:border-box}body{margin:0}img{display:block}</style></head><body>${pages}</body></html>`
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > maxBytes) throw new Error(`Package ${bytes} bytes exceeds ${maxBytes}; split at page boundaries or prepare a deliberate image derivative. Never flatten the poster or upload it publicly.`)
  return { html, manifest: { ...manifest, bytes, htmlSha256: hash(html) } }
}

export function verifyNativeBindings(manifest, state) {
  const failures = []
  for (const page of manifest.pages) {
    for (const layer of page.layers.filter((entry) => entry.bindingRequired)) {
      const matches = (state.fills ?? []).filter((fill) => fill.page_index === page.index && fill.asset_id === layer.nativeAssetId
        // The actual native import rounds fractional frames by up to half a
        // design pixel. Asset identity and page scope remain exact.
        && Math.abs((fill.containerElement?.position.left ?? Infinity) - layer.x) <= 0.51
        && Math.abs((fill.containerElement?.position.top ?? Infinity) - layer.y) <= 0.51
        && Math.abs((fill.containerElement?.dimension.width ?? Infinity) - layer.width) <= 0.51
        && Math.abs((fill.containerElement?.dimension.height ?? Infinity) - layer.height) <= 0.51)
      if (matches.length !== 1) failures.push({ page: page.id, layer: layer.id, reason: 'exact native asset/position not resolved uniquely' })
    }
  }
  if ((state.fills ?? []).some((fill) => fill.alt_text?.text?.startsWith('UNBOUND NATIVE ASSET'))) failures.push({ reason: 'unbound placeholder remains' })
  return { passed: failures.length === 0, failures, meaning: 'native asset binding only; not font fidelity, export or human creative approval' }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error('Usage: node canva-native-package.mjs <private-scene.json> <private-output.html>')
  const scene = resolve(input)
  const result = buildNativeCanvaPackage(JSON.parse(readFileSync(scene, 'utf8')), dirname(scene))
  writeFileSync(resolve(output), result.html)
  writeFileSync(`${resolve(output)}.manifest.json`, `${JSON.stringify(result.manifest, null, 2)}\n`)
  console.log(JSON.stringify({ pages: result.manifest.pages.length, bytes: result.manifest.bytes, htmlSha256: result.manifest.htmlSha256, uploadPerformed: false }))
}
