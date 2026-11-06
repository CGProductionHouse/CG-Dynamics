#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const PUBLICATION_STATES = new Set([
  'approved', 'scheduled', 'posted', 'draft', 'discarded', 'internal-pilot-only', 'unresolved',
])

const FORBIDDEN_BIOMETRIC_KEYS = new Set([
  'biometric', 'biometricId', 'faceEmbedding', 'faceVector', 'facialEmbedding', 'recognitionId',
])

function usage() {
  console.error('Usage: node creative-ledger.mjs fingerprint <image> [--out <receipt.json>]')
  console.error('       node creative-ledger.mjs check <ledger.json> <candidate.json> [--brand-pack <trusted-brand-pack.json>] [--out <receipt.json>]')
  console.error('       node creative-ledger.mjs record <ledger.json> <entry.json> --out <updated-ledger.json>')
  process.exitCode = 2
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function sha256File(path) {
  return sha256(readFileSync(path))
}

function assertNoBiometrics(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoBiometrics(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_BIOMETRIC_KEYS.has(key)) throw new Error(`Biometric identity field is forbidden: ${path}.${key}`)
    assertNoBiometrics(child, `${path}.${key}`)
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

function uniqueStrings(value = []) {
  if (!Array.isArray(value)) throw new Error('Expected an array of strings')
  return [...new Set(value.map((item) => requireString(item, 'tag')).map((item) => item.toLowerCase()))].sort()
}

function normalizeEntry(entry) {
  assertNoBiometrics(entry)
  const normalized = structuredClone(entry)
  normalized.id = requireString(entry.id, 'entry.id')
  normalized.clientId = requireString(entry.clientId, 'entry.clientId')
  normalized.brandScope = requireString(entry.brandScope, 'entry.brandScope').toUpperCase()
  normalized.publicationState = requireString(entry.publicationState, 'entry.publicationState')
  if (!PUBLICATION_STATES.has(normalized.publicationState)) {
    throw new Error(`Unsupported publication state: ${normalized.publicationState}`)
  }
  for (const field of ['visiblePersonTags', 'subjectTags', 'productTags', 'serviceTags', 'conceptTags', 'mechanismTags']) {
    normalized[field] = uniqueStrings(entry[field] ?? [])
  }
  normalized.branch = entry.branch ? String(entry.branch).trim() : null
  normalized.headline = entry.headline ? String(entry.headline).trim() : null
  normalized.createdAt = entry.createdAt ? new Date(entry.createdAt).toISOString() : null
  normalized.source = entry.source ? structuredClone(entry.source) : null
  if (normalized.source?.sha256 && !/^[a-f0-9]{64}$/i.test(normalized.source.sha256)) {
    throw new Error('source.sha256 must be a SHA-256 hex digest')
  }
  if (normalized.source?.perceptualHash && !/^[a-f0-9]{16}$/i.test(normalized.source.perceptualHash)) {
    throw new Error('source.perceptualHash must be a 64-bit hex digest')
  }
  return normalized
}

function normalizedWords(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
}

function jaccard(left, right) {
  const a = new Set(left)
  const b = new Set(right)
  if (!a.size || !b.size) return 0
  let intersection = 0
  for (const value of a) if (b.has(value)) intersection += 1
  return intersection / (a.size + b.size - intersection)
}

function overlaps(left = [], right = []) {
  const b = new Set(right)
  return left.filter((value) => b.has(value))
}

export function hammingDistance(left, right) {
  if (!/^[a-f0-9]{16}$/i.test(left) || !/^[a-f0-9]{16}$/i.test(right)) throw new Error('pHash values must be 16 hex characters')
  let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`)
  let count = 0
  while (bits) {
    count += Number(bits & 1n)
    bits >>= 1n
  }
  return count
}

export function perceptualHashFromGray(gray, size = 32) {
  if (!(gray instanceof Uint8Array) || gray.length !== size * size) throw new Error(`Expected ${size * size} grayscale pixels`)
  const sampleSize = 8
  const coefficients = []
  for (let u = 0; u < sampleSize; u += 1) {
    for (let v = 0; v < sampleSize; v += 1) {
      let sum = 0
      for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
          sum += gray[(y * size) + x]
            * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * size))
            * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * size))
        }
      }
      coefficients.push(sum)
    }
  }
  const comparison = coefficients.slice(1).sort((a, b) => a - b)
  const median = comparison[Math.floor(comparison.length / 2)]
  let hash = 0n
  coefficients.forEach((value, index) => {
    if (value > median) hash |= 1n << BigInt(63 - index)
  })
  return hash.toString(16).padStart(16, '0')
}

export function fingerprintImage(imagePath, ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg') {
  const absolutePath = resolve(imagePath)
  if (!existsSync(absolutePath)) throw new Error(`Image not found: ${absolutePath}`)
  const decoded = spawnSync(ffmpegPath, [
    '-v', 'error', '-i', absolutePath, '-vf', 'scale=32:32:flags=lanczos,format=gray',
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1',
  ], { encoding: null, maxBuffer: 4 * 1024 * 1024 })
  if (decoded.status !== 0 || decoded.stdout.length !== 1024) {
    throw new Error(`Unable to decode image with FFmpeg: ${decoded.stderr?.toString().trim() || 'unexpected output'}`)
  }
  return {
    path: absolutePath,
    filename: basename(absolutePath),
    bytes: readFileSync(absolutePath).length,
    sha256: sha256File(absolutePath),
    perceptualHash: perceptualHashFromGray(new Uint8Array(decoded.stdout)),
  }
}

function filenameSequence(value) {
  if (!value) return null
  const match = String(value).match(/(\d{3,})(?!.*\d)/)
  return match ? Number(match[1]) : null
}

function sameShoot(candidate, history) {
  if (candidate.source?.shootId && candidate.source.shootId === history.source?.shootId) return 'same-shoot-id'
  const leftTime = candidate.source?.captureTime ? Date.parse(candidate.source.captureTime) : NaN
  const rightTime = history.source?.captureTime ? Date.parse(history.source.captureTime) : NaN
  const sameCamera = candidate.source?.cameraId && candidate.source.cameraId === history.source?.cameraId
  const leftSequence = filenameSequence(candidate.source?.filename)
  const rightSequence = filenameSequence(history.source?.filename)
  if (sameCamera && Number.isFinite(leftTime) && Number.isFinite(rightTime)
    && Math.abs(leftTime - rightTime) <= 10 * 60 * 1000
    && leftSequence !== null && rightSequence !== null && Math.abs(leftSequence - rightSequence) <= 50) {
    return 'capture-window-and-sequence'
  }
  return null
}

export function checkCandidate(ledger, rawCandidate, options = {}) {
  if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.entries)) throw new Error('Ledger schemaVersion 1 with entries[] is required')
  assertNoBiometrics(ledger)
  const candidate = normalizeEntry(rawCandidate)
  const thresholds = { perceptualDistance: options.perceptualDistance ?? 8, headlineSimilarity: options.headlineSimilarity ?? 0.66 }
  const findings = []
  const add = (severity, code, prior, evidence) => findings.push({ severity, code, priorEntryId: prior?.id ?? null, evidence })

  for (const rawPrior of ledger.entries) {
    const prior = normalizeEntry(rawPrior)
    if (prior.clientId !== candidate.clientId) continue
    if (candidate.source?.sha256 && prior.source?.sha256 && candidate.source.sha256.toLowerCase() === prior.source.sha256.toLowerCase()) {
      add('blocker', 'exact-source-repeat', prior, { sha256: candidate.source.sha256 })
    } else if (candidate.source?.perceptualHash && prior.source?.perceptualHash) {
      const distance = hammingDistance(candidate.source.perceptualHash, prior.source.perceptualHash)
      if (distance <= thresholds.perceptualDistance) add('blocker', 'perceptual-source-repeat', prior, { distance, threshold: thresholds.perceptualDistance })
    }

    const shootEvidence = sameShoot(candidate, prior)
    if (shootEvidence) add('warning', 'same-shoot-review', prior, { match: shootEvidence })

    for (const [field, code] of [
      ['visiblePersonTags', 'visible-person-repeat'],
      ['productTags', 'product-repeat'],
      ['serviceTags', 'service-repeat'],
      ['subjectTags', 'subject-repeat'],
      ['conceptTags', 'concept-repeat'],
      ['mechanismTags', 'layout-mechanism-repeat'],
    ]) {
      const shared = overlaps(candidate[field], prior[field])
      if (shared.length) add(field === 'visiblePersonTags' ? 'blocker' : 'warning', code, prior, { shared })
    }

    if (candidate.branch && prior.branch && candidate.branch.toLowerCase() === prior.branch.toLowerCase()) {
      add('notice', 'branch-repeat', prior, { branch: candidate.branch })
    }
    if (candidate.headline && prior.headline) {
      const similarity = jaccard(normalizedWords(candidate.headline), normalizedWords(prior.headline))
      if (similarity >= thresholds.headlineSimilarity) add('blocker', 'headline-repeat', prior, { similarity })
    }
  }

  // An exact-client reviewed umbrella rule may permit a real subsidiary photo.
  // The caller must load these rules from the trusted Brand Pack, never from
  // a candidate's self-declared permission. Sibling-brand mixing stays blocked.
  const sourceScope = candidate.source?.brandScope?.toUpperCase()
  const umbrellaRule = (options.brandPackSourceRules ?? []).find((rule) => rule.clientId === candidate.clientId
    && rule.parentScope === candidate.brandScope && rule.allowedSourceScopes?.includes(sourceScope)
    && typeof rule.evidenceUrl === 'string' && rule.evidenceUrl.trim())
  if (sourceScope && sourceScope !== candidate.brandScope && !umbrellaRule) {
    add('blocker', 'source-brand-scope-mismatch', null, {
      candidateBrandScope: candidate.brandScope,
      sourceBrandScope: candidate.source.brandScope.toUpperCase(),
    })
  }

  const deduplicated = [...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values()]
  return {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    candidateId: candidate.id,
    publicationState: candidate.publicationState,
    verdict: deduplicated.some((finding) => finding.severity === 'blocker') ? 'blocked' : deduplicated.length ? 'review' : 'clear',
    thresholds,
    findings: deduplicated,
    biometricIdentityDataUsed: false,
    verifiedUmbrellaSourceRule: umbrellaRule ? { parentScope: umbrellaRule.parentScope, sourceScope, evidenceUrl: umbrellaRule.evidenceUrl } : null,
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function parseOut(args) {
  const index = args.indexOf('--out')
  return index >= 0 ? args[index + 1] : null
}

function writeResult(result, outPath) {
  const output = `${JSON.stringify(result, null, 2)}\n`
  if (outPath) writeFileSync(resolve(outPath), output)
  process.stdout.write(output)
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  const outPath = parseOut(args)
  if (command === 'fingerprint' && args[0]) {
    writeResult(fingerprintImage(args[0]), outPath)
    return
  }
  if (command === 'check' && args[0] && args[1]) {
    const brandPackIndex = args.indexOf('--brand-pack')
    if (brandPackIndex >= 0 && (!args[brandPackIndex + 1] || args[brandPackIndex + 1].startsWith('--'))) throw new Error('--brand-pack requires a trusted Brand Pack path')
    const pack = brandPackIndex >= 0 ? readJson(args[brandPackIndex + 1]) : null
    if (pack && !Array.isArray(pack.sourceScopeRules)) throw new Error('Trusted Brand Pack must declare sourceScopeRules[]')
    writeResult(checkCandidate(readJson(args[0]), readJson(args[1]), { brandPackSourceRules: pack?.sourceScopeRules }), outPath)
    return
  }
  if (command === 'record' && args[0] && args[1] && outPath) {
    const ledger = readJson(args[0])
    const entry = normalizeEntry(readJson(args[1]))
    if (ledger.schemaVersion !== 1 || !Array.isArray(ledger.entries)) throw new Error('Ledger schemaVersion 1 with entries[] is required')
    if (ledger.entries.some((existing) => existing.id === entry.id)) throw new Error(`Entry already exists: ${entry.id}`)
    assertNoBiometrics(ledger)
    writeResult({ ...ledger, updatedAt: new Date().toISOString(), entries: [...ledger.entries, entry] }, outPath)
    return
  }
  usage()
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
