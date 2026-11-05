#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

function usage() {
  console.error('Usage: node poster-studio.mjs render <scene.json> [--out <directory>] [--no-preview]')
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
    return `<image ${attrs({ ...common, href: pathToFileURL(assetPath).href, x: layer.x, y: layer.y, width: layer.width, height: layer.height, preserveAspectRatio: layer.preserveAspectRatio ?? 'xMidYMid slice', clipPath: layer.clipPath ? `url(#${layer.clipPath})` : undefined })}/>`
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

function makeManifest(scene, scenePath, svgPath, pngPath) {
  const flat = flattenLayers(scene.layers)
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    document: scene.document,
    canvas: scene.canvas,
    colourSpace: scene.colourSpace ?? 'sRGB',
    sourceScene: { path: resolve(scenePath), sha256: sha256File(scenePath) },
    assets: collectAssets(scene, scenePath),
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

function renderPreview(svgPath, pngPath, width, height) {
  const chrome = findChrome()
  if (!chrome) throw new Error('Chrome was not found; set CHROME_PATH or use --no-preview')
  const profile = mkdtempSync(resolve(tmpdir(), 'cg-poster-studio-'))
  try {
    const result = spawnSync(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
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
  const requestedOut = option(args, '--out')
  const outDir = resolve(requestedOut ?? dirname(scenePath), scene.document.id)
  await mkdir(outDir, { recursive: true })
  const defs = (scene.definitions ?? []).map(renderDefinition).join('')
  const body = scene.layers.map((layer) => renderLayer(layer, scenePath)).join('')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="${SVG_NS}" xmlns:xlink="${XLINK_NS}" width="${scene.canvas.width}" height="${scene.canvas.height}" viewBox="0 0 ${scene.canvas.width} ${scene.canvas.height}" role="img" aria-labelledby="title description"><title id="title">${escapeXml(scene.document.title ?? scene.document.id)}</title><desc id="description">${escapeXml(scene.document.description ?? '')}</desc><defs>${defs}</defs>${body}</svg>\n`
  const svgPath = resolve(outDir, `${scene.document.id}.svg`)
  const pngPath = resolve(outDir, `${scene.document.id}.png`)
  writeFileSync(svgPath, svg, 'utf8')
  if (!args.includes('--no-preview')) renderPreview(svgPath, pngPath, scene.canvas.width, scene.canvas.height)
  const manifest = makeManifest(scene, scenePath, svgPath, args.includes('--no-preview') ? null : pngPath)
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
