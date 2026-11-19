import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildMonthlyBaseline, extractReadyGuideSignals } from '../src/lib/monthlyStrategySeed.ts'

const guidePath = new URL('../artifacts/client-strategy-dossiers/issue-513/runtime-guides/', import.meta.url)
const readGuide = slug => readFileSync(new URL(`${slug}.md`, guidePath), 'utf8')

test('six reviewed guide heading variants yield bounded opportunities from their actual source', () => {
  const cases = [
    ['hino-trucks', /dealership reels|Sales-department|cross-department/],
    ['jenkor', /yard movement|paving patterns|cement bricks|bulk-order/],
    ['peyper-bonds', /first-time buyer|pre-approval education|document preparation/],
    ['supa-quick-bfn', /workshop|tyre|in-store/],
    ['toyota-bloemfontein', /sales-team|staff experience|service-team|workshop/],
    ['wiseride', /product\/service|car-protection|staff moments|installation highlights/],
  ]
  for (const [slug, expected] of cases) {
    const markdown = readGuide(slug)
    const signals = extractReadyGuideSignals(markdown)
    assert.equal(signals.length, 4, slug)
    assert.match(signals.join('\n'), expected, slug)
    for (const text of signals) {
      assert.ok(text.length >= 12 && text.length <= 180, slug)
      assert.doesNotMatch(text, /@|https?:\/\/|source_revision|canonical client|\b\d{2,4}[ -]\d{3}[ -]\d{3,4}\b/i, slug)
    }
    const baseline = buildMonthlyBaseline({ clientName: slug, guideId: `exact-${slug}`, readyGuideMarkdown: markdown,
      contextUpdates: [], previousDirection: [], previousDrivers: [], deliverables: [] })
    assert.equal(baseline.evidence.length, 4, slug)
    assert.ok(baseline.evidence.every(row => row.authority === 'client_guide' && row.source_id === `exact-${slug}`))
    assert.deepEqual(baseline.evidence.map(row => row.excerpt), signals)
    assert.deepEqual(baseline.clientDirection, [], 'Source topics are not staff strategy decisions')
  }
})

test('aliases are used only when the established strategy extraction is empty', () => {
  const old = '## Content directions\n- Explain real timber choices to project buyers.'
  const extra = '\n## Video / Reels\n- Another approved source topic for a future review.'
  assert.deepEqual(extractReadyGuideSignals(old + extra), extractReadyGuideSignals(old))
})

test('legacy theme sections do not promote nested caption lessons into business strategy evidence', () => {
  const signals = extractReadyGuideSignals(`## Content and video guidance
- A real installation process demonstration.
### Recent CG content lessons — 2026
- Captions should use the approved contact footer.
#### Suggested wording
- An internal wording instruction to avoid.
### Customer questions
- Explain the actual vehicle and service need.`)
  assert.deepEqual(signals, ['A real installation process demonstration', 'Explain the actual vehicle and service need'])
})

test('new headings never admit contacts, unresolved claims, instructions or nested unsafe content', () => {
  for (const heading of ['Content directions', 'Best-fit content pillars', 'Strong recurring content themes', 'Content and video guidance', 'Poster and video', 'Video / Reels']) {
    const markdown = `## ${heading}
- A real product demonstration for a buyer question.
- Never invent the current stock.
- Contact sales@example.com for the private offer.
- Client record 11111111-1111-4111-8111-111111111111 is private.
### Unresolved facts
- An unapproved future promotion.
#### Product examples
- A nested unapproved stock claim.
### Approved customer questions
- Explain the actual task to the relevant team.
## ${heading} and guardrails
- A hidden operational rule must not be admitted.
## Audit evidence
- Another arbitrary administrative source line.`
    assert.deepEqual(extractReadyGuideSignals(markdown), [
      'A real product demonstration for a buyer question',
      'Explain the actual task to the relevant team',
    ], heading)
  }
  assert.deepEqual(extractReadyGuideSignals('## Captions\n- Use the correct footer every time.'), [])
  assert.deepEqual(extractReadyGuideSignals('## Current verified facts\n- An old price must not become current truth.'), [])
})

test('seven audit or insufficiently structured containers remain held without a generic fallback', () => {
  for (const slug of ['econofoods', 'germoparts', 'human-auto', 'psg-bloemfontein', 'rc-polypipe', 'red-oak', 'tbs-brokers']) {
    assert.deepEqual(extractReadyGuideSignals(readGuide(slug)), [], slug)
  }
})

test('all fifty-two frozen guide sources retain their bytes and every prior evidence selection', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/ops/client-readiness/2026-11-19-strategy-guide-heading-baseline.json', import.meta.url)))
  assert.equal(receipt.guides.length, 52)
  let previous = 0, recovered = 0, held = 0
  for (const row of receipt.guides) {
    const markdown = readFileSync(new URL(row.file, guidePath), 'utf8').replace(/\r\n/g, '\n')
    assert.equal(createHash('sha256').update(markdown).digest('hex'), row.content_sha256, row.client_name)
    const signals = extractReadyGuideSignals(markdown)
    assert.deepEqual(signals, row.after_signals, row.client_name)
    if (row.before_signals.length) {
      previous++
      assert.deepEqual(signals, row.before_signals, row.client_name)
    } else if (signals.length) recovered++
    else held++
  }
  assert.equal(previous, 25)
  assert.equal(recovered, 6)
  assert.equal(held, 21)
})

test('fresh readback distinguishes Markdown formatting from live evidence and preserves all production hashes', () => {
  const receipt = JSON.parse(readFileSync(new URL('../docs/ops/client-readiness/2026-11-19-strategy-guide-heading-readback.json', import.meta.url)))
  assert.equal(receipt.live_guides.length, 13)
  assert.equal(receipt.canonical_writes, 0)
  assert.equal(receipt.source_review_writes, 0)
  assert.deepEqual(receipt.production_hashes.drift, [])
  assert.equal(receipt.production_hashes.client_rows, 63)
  assert.equal(receipt.production_hashes.guide_rows, 52)
  assert.equal(receipt.production_hashes.strategy_rows, 141)
  assert.equal(receipt.live_held_clients, 32)
  assert.equal(receipt.still_evidence_held.length, 7)
  assert.equal(receipt.missing_ready_guides.length, 4)
  assert.ok(receipt.missing_ready_guides.every(row => row.guides === null))
  for (const guide of receipt.live_guides) {
    assert.equal(guide.runtime_readiness, 'ready')
    assert.equal(guide.source_text_matches_ignoring_line_ending_and_trailing_space, true)
    assert.match(guide.live_content_sha256, /^[a-f0-9]{64}$/)
    assert.match(guide.frozen_content_sha256, /^[a-f0-9]{64}$/)
    assert.match(guide.row_hash, /^[a-f0-9]{32}$/)
  }
})
