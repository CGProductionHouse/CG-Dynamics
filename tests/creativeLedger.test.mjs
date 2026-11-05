import test from 'node:test'
import assert from 'node:assert/strict'
import { checkCandidate, hammingDistance, perceptualHashFromGray } from '../scripts/poster-studio/creative-ledger.mjs'

function entry(overrides = {}) {
  return {
    id: 'history-1',
    clientId: 'piek',
    brandScope: 'ENGEN',
    publicationState: 'posted',
    visiblePersonTags: ['reviewer-person-a'],
    subjectTags: ['forecourt'],
    productTags: [],
    serviceTags: ['windscreen-clean'],
    conceptTags: ['human-service'],
    mechanismTags: ['portrait-cutout'],
    headline: 'A clear view for the road ahead',
    branch: 'Engen Crossing',
    source: {
      sha256: 'a'.repeat(64),
      perceptualHash: 'f0f0f0f0f0f0f0f0',
      brandScope: 'ENGEN',
      shootId: 'crossing-2026-07',
      filename: '0L8A0389.JPG',
    },
    ...overrides,
  }
}

test('pHash is deterministic and Hamming distance is correct', () => {
  const pixels = new Uint8Array(32 * 32)
  for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) pixels[y * 32 + x] = x < y ? 20 : 230
  const hash = perceptualHashFromGray(pixels)
  assert.match(hash, /^[a-f0-9]{16}$/)
  assert.equal(perceptualHashFromGray(pixels), hash)
  assert.equal(hammingDistance(hash, hash), 0)
  assert.equal(hammingDistance('0000000000000000', '000000000000000f'), 4)
})

test('ledger blocks source, person, headline and brand-scope repetition', () => {
  const candidate = entry({
    id: 'candidate-1',
    brandScope: 'SASOL',
    publicationState: 'draft',
    headline: 'A clear view for the road ahead!',
  })
  const result = checkCandidate({ schemaVersion: 1, entries: [entry()] }, candidate)
  assert.equal(result.verdict, 'blocked')
  const codes = new Set(result.findings.map((finding) => finding.code))
  assert.ok(codes.has('exact-source-repeat'))
  assert.ok(codes.has('visible-person-repeat'))
  assert.ok(codes.has('headline-repeat'))
  assert.ok(codes.has('source-brand-scope-mismatch'))
  assert.equal(result.biometricIdentityDataUsed, false)
})

test('ledger records legitimate novelty as clear', () => {
  const candidate = entry({
    id: 'candidate-2',
    brandScope: 'GET_TOGETHER',
    publicationState: 'draft',
    visiblePersonTags: ['reviewer-person-b'],
    subjectTags: ['table-moment'],
    serviceTags: [],
    conceptTags: ['summer-social'],
    mechanismTags: ['editorial-collage'],
    headline: 'Keep a chair for January',
    branch: 'Get Together Kimberley',
    source: {
      sha256: 'b'.repeat(64),
      perceptualHash: '0f0f0f0f0f0f0f0f',
      brandScope: 'GET_TOGETHER',
      shootId: 'kimberley-2027-01',
      filename: 'GT_1001.JPG',
    },
  })
  const result = checkCandidate({ schemaVersion: 1, entries: [entry()] }, candidate)
  assert.equal(result.verdict, 'clear')
  assert.equal(result.findings.length, 0)
})

test('biometric identity fields are rejected', () => {
  const candidate = entry({ id: 'candidate-3', faceEmbedding: [0.1, 0.2] })
  assert.throws(() => checkCandidate({ schemaVersion: 1, entries: [] }, candidate), /Biometric identity field is forbidden/)
})
