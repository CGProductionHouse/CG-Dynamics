import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Content batch #200 (CA reel behavioural-economics concepts). The concepts load
// through Vite SSR (type-only imports, no Supabase at runtime); the seed is
// checked by parsing SQL. No database is touched and nothing is written.

let server, batch
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  batch = await server.ssrLoadModule('/src/lib/marketing-library/contentBatch200.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SEED = read('../supabase/phase-29a-content-batch-200-behavioural-economics.sql')

const REEL_CONCEPTS = [
  'Zeigarnik effect', 'Charm pricing', 'Marginal ROAS', 'Post-purchase dissonance',
  'Contribution margin', 'Peak-end rule', 'Mere exposure effect', 'Choice overload / paralysis', 'Loss aversion',
]

test('the batch covers every concept from the reel and is discovery-only', () => {
  assert.equal(batch.BATCH_ID, 200)
  assert.equal(batch.TREAT_AS, 'discovery_evidence_only')
  assert.match(batch.DISCOVERY_SOURCE, /reel/i)
  const concepts = batch.CONTENT_BATCH_200.map(c => c.concept)
  for (const c of REEL_CONCEPTS) assert.ok(concepts.includes(c), `covers ${c}`)
})

test('the mere exposure effect is deduped against existing library knowledge, not re-registered', () => {
  const mere = batch.CONTENT_BATCH_200.find(c => c.concept === 'Mere exposure effect')
  assert.equal(mere.dedupStatus, 'already_in_library')
  assert.match(mere.dedupNote, /ADVERTISING-EVIDENCE-LIBRARY/)
  // It is excluded from the registration set and from the seed.
  assert.ok(!batch.batchCandidatesForRegistration().some(c => c.concept === 'Mere exposure effect'))
  assert.ok(!SEED.includes('be-mere-exposure-effect'), 'mere exposure card must not be seeded')
  assert.ok(!SEED.includes('concept:mere-exposure-effect'), 'mere exposure source must not be seeded')
})

test('every registrable candidate is review-gated, verified-pending, sourced and non-client', () => {
  const candidates = batch.batchCandidatesForRegistration()
  assert.equal(candidates.length, 8)
  const slugs = new Set(candidates.map(c => c.slug))
  const ids = new Set(candidates.map(c => c.source.sourceIdentifier))
  assert.equal(slugs.size, 8, 'slugs unique')
  assert.equal(ids.size, 8, 'source identifiers unique')
  for (const c of candidates) {
    assert.equal(c.dedupStatus, 'new')
    assert.equal(c.verificationStatus, 'needs_independent_verification')
    assert.ok(c.principle && c.summary, 'has principle + summary')
    assert.ok(c.source && c.source.sourceName, 'has a source pointer')
    assert.match(c.source.sourceIdentifier, /^concept:/, 'stable non-guessed identifier')
  }
})

test('the phase-29a seed is review-gated, idempotent, client-safe and not applied', () => {
  // Nothing active or auto-approved; everything needs_review.
  assert.match(SEED, /'needs_review'/)
  assert.ok(!/'active'/.test(SEED), 'no card is seeded active')
  // No client is guessed: active_client_id is never set in executable SQL
  // (a mention in the header comment is fine).
  assert.match(SEED, /client_specific[\s\S]*?false/)
  const executable = SEED.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  assert.ok(!executable.includes('active_client_id'), 'no active_client_id is set in executable SQL')
  // Sources are bibliographic pointers, no full text.
  assert.match(SEED, /'bibliographic_only'/)
  assert.match(SEED, /'internal_notes_only'/)
  assert.match(SEED, /false, 'unknown', 'catalogued'/)
  // Idempotency machinery.
  assert.match(SEED, /on conflict \(slug\) do nothing/)
  assert.match(SEED, /where not exists/)
  // Not applied to production.
  assert.match(SEED, /NOT APPLIED to production/)
  // Every registrable candidate (slug + source) is present.
  for (const c of batch.batchCandidatesForRegistration()) {
    assert.ok(SEED.includes(`'${c.slug}'`), `seed registers card ${c.slug}`)
    assert.ok(SEED.includes(`'${c.source.sourceIdentifier}'`), `seed registers source ${c.source.sourceIdentifier}`)
  }
})
