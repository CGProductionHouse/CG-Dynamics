#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

function usage() {
  console.error('Usage: node poster-studio.mjs render <scene.json> [--out <directory>] [--scale 1..4] [--no-preview]')
  console.error('       node poster-studio.mjs compare <before.json> <after.json> [--out <receipt.json>]')
  process.exitCode = 2
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function sha256File(path) {
  return sha256Buffer(readFileSync(path))
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
  }
  return value
}

function canonical(value) {
  return JSON.stringify(stable(value))
}

function hashObject(value) {
  return sha256Buffer(Buffer.from(canonical(value)))
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function kebab(value) {
  if (value === 'preserveAspectRatio') return value
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function attrs(input = {}) {
  return Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${kebab(key)}="${escapeXml(value === true ? key : value)}"`)
    .join(' ')
}

function styleAttrs(layer) {
  return {
    opacity: layer.opacity,
    'mix-blend-mode': layer.blendMode,
    filter: layer.filter ? `url(#${layer.filter})` : undefined,
    transform: layer.transform,
    visibility: layer.visible === false ? 'hidden' : undefined,
  }
}

function normalizeAssetPath(scenePath, assetPath) {
  if (!assetPath || typeof assetPath !== 'string') throw new Error('Image layers require a string asset path')
  return resolve(dirname(scenePath), assetPath)
}

function imageMimeType(assetPath) {
  const extension = extname(assetPath).toLowerCase()
  const types = {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }
  const mimeType = types[extension]
  if (!mimeType) throw new Error(`Unsupported image asset type: ${extension || '<none>'}`)
  return mimeType
}

function embeddedImageHref(assetPath) {
  const bytes = readFileSync(assetPath)
  return `data:${imageMimeType(assetPath)};base64,${bytes.toString('base64')}`
}

function prepareFonts(scene, scenePath) {
  const jobPath = (value) => {
    if (typeof value !== 'string' || !value || /^(?:https?|file|data):/i.test(value)) throw new Error('Fonts and notices require job-local file paths')
    const path = resolve(dirname(scenePath), value)
    const within = relative(dirname(scenePath), path)
    if (within === '..' || within.startsWith('../') || within.startsWith('..\\') || isAbsolute(within)) throw new Error('Font assets and notices must stay inside the scene job directory')
    return path
  }
  const types = {
    '.ttf': ['font/ttf', 'truetype', '00010000'],
    '.otf': ['font/otf', 'opentype', '4f54544f'],
    '.woff': ['font/woff', 'woff', '774f4646'],
    '.woff2': ['font/woff2', 'woff2', '774f4632'],
  }
  if (scene.fonts !== undefined && !Array.isArray(scene.fonts)) throw new Error('scene.fonts must be an array')
  const seen = new Set()
  const fonts = (scene.fonts ?? []).map((font) => {
    if (typeof font.family !== 'string' || !font.family.trim()) throw new Error('Font family is required')
    const weight = font.weight ?? 400
    const style = font.style ?? 'normal'
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) throw new Error('Font weight must be an integer from 1 to 1000')
    if (!['normal', 'italic', 'oblique'].includes(style)) throw new Error('Unsupported font style')
    const key = `${font.family}:${weight}:${style}`
    if (seen.has(key)) throw new Error(`Duplicate font face: ${key}`)
    seen.add(key)
    const path = jobPath(font.asset)
    const type = types[extname(path).toLowerCase()]
    if (!type) throw new Error('Fonts require local TTF, OTF, WOFF or WOFF2 assets')
    const bytes = readFileSync(path)
    if (bytes.length < 12 || bytes.length > 32 * 1024 * 1024 || bytes.subarray(0, 4).toString('hex') !== type[2]) {
      throw new Error(`Invalid font container: ${basename(path)}`)
    }
    const hash = sha256Buffer(bytes)
    if (font.expectedSha256 !== undefined && font.expectedSha256 !== hash) throw new Error(`Font hash mismatch: ${font.family}`)
    if (typeof font.licenceAsset !== 'string' || !font.licenceAsset) throw new Error('A font licenceAsset is required for portable embedding')
    const licencePath = jobPath(font.licenceAsset)
    const licence = readFileSync(licencePath, 'utf8')
    if (!licence.trim() || Buffer.byteLength(licence) > 512 * 1024) throw new Error('Font licence must be nonempty text below 512 KiB')
    return {
      family: font.family, weight, style,
      sourcePath: path, filename: basename(path), bytes: bytes.length, sha256: hash,
      licence: { sourcePath: licencePath, sha256: sha256File(licencePath) },
      css: `@font-face{font-family:${JSON.stringify(font.family)};src:url("data:${type[0]};base64,${bytes.toString('base64')}") format("${type[1]}");font-weight:${weight};font-style:${style};font-display:block;}`,
      licenceText: licence,
    }
  })
  return {
    style: fonts.length ? `<style>${escapeXml(fonts.map((font) => font.css).join('\n'))}</style>` : '',
    metadata: fonts.length ? `<metadata id="embedded-font-licences">${escapeXml(fonts.map((font) => `${font.family}\n${font.licenceText}`).join('\n\n'))}</metadata>` : '',
    manifest: fonts.map(({ css, licenceText, ...font }) => font),
  }
}

function renderLayer(layer, scenePath) {
  const common = { id: layer.id, 'data-layer-name': layer.name ?? layer.id, ...styleAttrs(layer) }
  if (layer.type === 'rect') {
    return `<rect ${attrs({ ...common, x: layer.x, y: layer.y, width: layer.width, height: layer.height, rx: layer.rx, fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth })}/>`
  }
  if (layer.type === 'ellipse') {
    return `<ellipse ${attrs({ ...common, cx: layer.cx, cy: layer.cy, rx: layer.rx, ry: layer.ry, fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth })}/>`
  }
  if (layer.type === 'path') {
    return `<path ${attrs({ ...common, d: layer.d, fill: layer.fill ?? 'none', stroke: layer.stroke, strokeWidth: layer.strokeWidth, strokeLinecap: layer.strokeLinecap, strokeLinejoin: layer.strokeLinejoin, strokeDasharray: layer.strokeDasharray })}/>`
  }
  if (layer.type === 'image') {
    const assetPath = normalizeAssetPath(scenePath, layer.asset)
    if (!existsSync(assetPath)) throw new Error(`Missing image asset for ${layer.id}: ${assetPath}`)
    return `<image ${attrs({ ...common, href: embeddedImageHref(assetPath), 'data-source-sha256': sha256File(assetPath), x: layer.x, y: layer.y, width: layer.width, height: layer.height, preserveAspectRatio: layer.preserveAspectRatio ?? 'xMidYMid slice', clipPath: layer.clipPath ? `url(#${layer.clipPath})` : undefined })}/>`
  }
  if (layer.type === 'text') {
    const lines = Array.isArray(layer.lines) ? layer.lines : [layer.text ?? '']
    const textAttrs = {
      ...common,
      x: layer.x,
      y: layer.y,
      fill: layer.fill,
      stroke: layer.stroke,
      strokeWidth: layer.strokeWidth,
      paintOrder: layer.paintOrder,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      fontStyle: layer.fontStyle,
      letterSpacing: layer.letterSpacing,
      textAnchor: layer.textAnchor,
      dominantBaseline: layer.dominantBaseline,
    }
    const spans = lines.map((line, index) => `<tspan ${attrs({ x: layer.x, dy: index === 0 ? 0 : layer.lineHeight ?? layer.fontSize * 1.05 })}>${escapeXml(line)}</tspan>`).join('')
    return `<text ${attrs(textAttrs)}>${spans}</text>`
  }
  if (layer.type === 'group') {
    return `<g ${attrs(common)}>${(layer.layers ?? []).map((child) => renderLayer(child, scenePath)).join('')}</g>`
  }
  throw new Error(`Unsupported layer type: ${layer.type}`)
}

function renderDefinition(definition) {
  if (definition.type === 'linearGradient') {
    const stops = definition.stops.map((stop) => `<stop ${attrs({ offset: stop.offset, stopColor: stop.color, stopOpacity: stop.opacity })}/>`).join('')
    return `<linearGradient ${attrs({ id: definition.id, x1: definition.x1, y1: definition.y1, x2: definition.x2, y2: definition.y2, gradientUnits: definition.gradientUnits })}>${stops}</linearGradient>`
  }
  if (definition.type === 'radialGradient') {
    const stops = definition.stops.map((stop) => `<stop ${attrs({ offset: stop.offset, stopColor: stop.color, stopOpacity: stop.opacity })}/>`).join('')
    return `<radialGradient ${attrs({ id: definition.id, cx: definition.cx, cy: definition.cy, r: definition.r, gradientUnits: definition.gradientUnits })}>${stops}</radialGradient>`
  }
  if (definition.type === 'clipPath') {
    return `<clipPath id="${escapeXml(definition.id)}">${definition.layers.map((layer) => renderLayer(layer, process.cwd())).join('')}</clipPath>`
  }
  if (definition.type === 'filter') {
    return `<filter ${attrs({ id: definition.id, x: definition.x ?? '-20%', y: definition.y ?? '-20%', width: definition.width ?? '140%', height: definition.height ?? '140%' })}>${definition.content}</filter>`
  }
  throw new Error(`Unsupported definition type: ${definition.type}`)
}

function validateScene(scene) {
  if (scene.schemaVersion !== 1) throw new Error('scene.schemaVersion must be 1')
  if (!scene.document?.id) throw new Error('scene.document.id is required')
  if (!Number.isFinite(scene.canvas?.width) || !Number.isFinite(scene.canvas?.height)) throw new Error('Canvas width and height are required')
  if (!Array.isArray(scene.layers) || scene.layers.length === 0) throw new Error('Scene requires at least one layer')
  const ids = new Set()
  const visit = (layers) => layers.forEach((layer) => {
    if (!layer.id || ids.has(layer.id)) throw new Error(`Layer IDs must be present and unique: ${layer.id ?? '<missing>'}`)
    ids.add(layer.id)
    if (layer.type === 'group') visit(layer.layers ?? [])
  })
  visit(scene.layers)
}

function collectAssets(scene, scenePath) {
  const found = []
  const visit = (layers) => layers.forEach((layer) => {
    if (layer.type === 'image') {
      const path = normalizeAssetPath(scenePath, layer.asset)
      if (!existsSync(path)) throw new Error(`Missing asset: ${path}`)
      const stat = statSync(path)
      found.push({ layerId: layer.id, role: layer.role ?? 'image', sourcePath: path, filename: basename(path), bytes: stat.size, sha256: sha256File(path) })
    }
    if (layer.type === 'group') visit(layer.layers ?? [])
  })
  visit(scene.layers)
  return found
}

function flattenLayers(layers, parent = null, output = []) {
  for (const layer of layers) {
    output.push({ ...layer, parent, layers: undefined })
    if (layer.type === 'group') flattenLayers(layer.layers ?? [], layer.id, output)
  }
  return output
}

function makeManifest(scene, scenePath, svgPath, pngPath, fonts, previewScale) {
  const flat = flattenLayers(scene.layers)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    document: scene.document,
    canvas: scene.canvas,
    colourSpace: scene.colourSpace ?? 'sRGB',
    sourceScene: { path: resolve(scenePath), sha256: sha256File(scenePath) },
    assets: collectAssets(scene, scenePath),
    fonts,
    previewScale,
    layers: flat.map((layer, index) => ({
      id: layer.id,
      name: layer.name ?? layer.id,
      type: layer.type,
      parent: layer.parent,
      index,
      editable: layer.editable !== false,
      role: layer.role ?? null,
      sha256: hashObject(layer),
    })),
    outputs: {
      svg: { path: resolve(svgPath), sha256: sha256File(svgPath) },
      png: pngPath && existsSync(pngPath) ? { path: resolve(pngPath), sha256: sha256File(pngPath) } : null,
    },
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)
  return candidates.find(existsSync)
}

function renderPreview(svgPath, pngPath, width, height, scale) {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome was not found; set CHROME_PATH or use --no-preview')
  const profile = mkdtempSync(resolve(tmpdir(), 'cg-poster-studio-'))
  try {
    const result = spawnSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
      `--force-device-scale-factor=${scale}`,
      `--user-data-dir=${profile}`,
      `--window-size=${width},${height}`,
      `--screenshot=${pngPath}`,
      pathToFileURL(svgPath).href,
    ], { encoding: 'utf8', windowsHide: true })
    if (result.status !== 0 || !existsSync(pngPath)) {
      throw new Error(`Chrome render failed (${result.status}): ${result.stderr || result.stdout}`)
    }
  } finally {
    rmSync(profile, { recursive: true, force: true })
  }
}

async function render(sceneArg, args) {
  const scenePath = resolve(sceneArg)
  const scene = JSON.parse(readFileSync(scenePath, 'utf8'))
  validateScene(scene)
  const fonts = prepareFonts(scene, scenePath)
  const previewScale = Number(option(args, '--scale') ?? 1)
  if (!Number.isInteger(previewScale) || previewScale < 1 || previewScale > 4) throw new Error('--scale must be an integer from 1 to 4')
  const requestedOut = option(args, '--out')
  const outDir = resolve(requestedOut ?? dirname(scenePath), scene.document.id)
  await mkdir(outDir, { recursive: true })
  const defs = (scene.definitions ?? []).map(renderDefinition).join('')
  const body = scene.layers.map((layer) => renderLayer(layer, scenePath)).join('')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" width="${scene.canvas.width}" height="${scene.canvas.height}" viewBox="0 0 ${scene.canvas.width} ${scene.canvas.height}" role="img" aria-labelledby="title description"><title id="title">${escapeXml(scene.document.title ?? scene.document.id)}</title><desc id="description">${escapeXml(scene.document.description ?? '')}</desc>${fonts.metadata}<defs>${fonts.style}${defs}</defs>${body}</svg>\n`
  const svgPath = resolve(outDir, `${scene.document.id}.svg`)
  const pngPath = resolve(outDir, `${scene.document.id}.png`)
  writeFileSync(svgPath, svg, 'utf8')
  if (!args.includes('--no-preview')) renderPreview(svgPath, pngPath, scene.canvas.width, scene.canvas.height, previewScale)
  const manifest = makeManifest(scene, scenePath, svgPath, args.includes('--no-preview') ? null : pngPath, fonts.manifest, previewScale)
  const manifestPath = resolve(outDir, `${scene.document.id}.manifest.json`)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ status: 'ok', svgPath, pngPath: manifest.outputs.png?.path ?? null, manifestPath, layerCount: manifest.layers.length, assetCount: manifest.assets.length }, null, 2))
}

function option(args, name) {
  const index = args.indexOf(name)
  if (index === -1) return null
  if (!args[index + 1]) throw new Error(`${name} requires a value`)
  return args[index + 1]
}

function compare(beforeArg, afterArg, args) {
  const beforePath = resolve(beforeArg)
  const afterPath = resolve(afterArg)
  const before = JSON.parse(readFileSync(beforePath, 'utf8'))
  const after = JSON.parse(readFileSync(afterPath, 'utf8'))
  validateScene(before)
  validateScene(after)
  const index = (scene) => Object.fromEntries(flattenLayers(scene.layers).map((layer) => [layer.id, { hash: hashObject(layer), layer }]))
  const left = index(before)
  const right = index(after)
  const allIds = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()
  const changes = allIds.flatMap((id) => {
    if (!left[id]) return [{ id, change: 'added', afterSha256: right[id].hash }]
    if (!right[id]) return [{ id, change: 'removed', beforeSha256: left[id].hash }]
    if (left[id].hash !== right[id].hash) return [{ id, change: 'modified', beforeSha256: left[id].hash, afterSha256: right[id].hash }]
    return []
  })
  const receipt = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    before: { path: beforePath, document: before.document, sha256: sha256File(beforePath) },
    after: { path: afterPath, document: after.document, sha256: sha256File(afterPath) },
    unchangedLayerCount: allIds.length - changes.length,
    changedLayerCount: changes.length,
    changes,
    changedResourceGroups: ['fonts', 'definitions', 'canvas'].filter((key) => canonical(before[key] ?? null) !== canonical(after[key] ?? null)),
  }
  const out = option(args, '--out')
  if (out) {
    const outPath = resolve(out)
    writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
    receipt.receiptPath = outPath
  }
  console.log(JSON.stringify(receipt, null, 2))
}

const [, , command, ...args] = process.argv
try {
  if (command === 'render' && args[0]) await render(args[0], args.slice(1))
  else if (command === 'compare' && args[0] && args[1]) compare(args[0], args[1], args.slice(2))
  else usage()
} catch (error) {
  console.error(JSON.stringify({ status: 'error', message: error.message }, null, 2))
  process.exitCode = 1
}
