import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { extractStrategyDossierEvidence } from '../scripts/lib/strategyDossierEvidence.mjs'

const guide = name => readFileSync(`artifacts/client-strategy-dossiers/issue-513/runtime-guides/${name}.md`, 'utf8')

test('actual We Ar guide supplies business and execution evidence, not influencer rules or contact footer as strategy', () => {
  const evidence = extractStrategyDossierEvidence(guide('we-ar-fuels'), true)
  assert.match(evidence.facts.join(' '), /fuel supply and distribution business/)
  assert.match(evidence.facts.join(' '), /delivery to farms, homes and businesses/)
  assert.match(evidence.recommendations.join(' '), /real delivery\/service moments/)
  assert.doesNotMatch([...evidence.facts, ...evidence.recommendations].join(' '), /No influencer|regional footer|Ryno|Werner|Thianie|governed/)
  assert.match(evidence.internalGuidance.join(' '), /No influencer language/)
  assert.match(evidence.constraints.join(' '), /delivery radius/)
})

test('actual Daisy guide keeps product context and seasonal lessons separate from voice/identity guardrails', () => {
  const evidence = extractStrategyDossierEvidence(guide('daisy-and-co'), true)
  assert.ok(evidence.facts.length > 0)
  assert.doesNotMatch(evidence.facts.join(' '), /Canonical client:|Keep Daisy.*isolated|Captions add|influencer|caption/i)
  assert.ok(evidence.observations.length > 0)
  assert.ok(evidence.internalGuidance.length > 0)
})

test('paragraphs, unknown sections and guardrails do not leak into later business facts; extraction is deterministic and non-mutating', () => {
  const text = '## Working identity\nA local supplier sells verified products to project buyers.\n\n## Voice\n- No influencer language, forced humour, slang or hype.\n\n## Task retrieval\nUse the private source at generation time.\n\n## Unrecognised technical section\nThis should not inherit the previous business fact section.\n\n## Product scope\nThe supplied service is equipment inspection for local buyers.'
  const first = extractStrategyDossierEvidence(text, true)
  assert.deepEqual(first, extractStrategyDossierEvidence(text, true))
  assert.equal(first.facts.length, 2)
  assert.doesNotMatch(first.facts.join(' '), /influencer|private|technical/)
  assert.match(first.internalGuidance.join(' '), /influencer/)
})
