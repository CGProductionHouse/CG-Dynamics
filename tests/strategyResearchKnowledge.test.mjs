import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const MIGRATION = readFileSync('supabase/migrations/20260803160000_strategy_research_historical_knowledge.sql', 'utf8')
const PACK = readFileSync('docs/ai-workforce/STRATEGY-RESEARCH-HISTORICAL-SOURCE-PACK.md', 'utf8')
const REGISTRY = readFileSync('src/features/ai-workforce/agents/agentRegistry.ts', 'utf8')
const EDGE_AGENTS = readFileSync('supabase/functions/cg-assistant-chat/skilledAgents.ts', 'utf8')
const EDGE = readFileSync('supabase/functions/cg-assistant-chat/index.ts', 'utf8')
const CLIENT = readFileSync('src/lib/assistant.ts', 'utf8')
const PAGE = readFileSync('src/pages/admin/AssistantPage.tsx', 'utf8')

const STRATEGY_SLUGS = [
  'strategy-audience-segments-evidence-not-stereotypes',
  'strategy-positioning-target-value-difference-proof',
  'strategy-offer-message-value-action',
  'strategy-objective-before-tactics',
  'strategy-channel-role-by-audience-objective',
  'strategy-measure-learn-adapt-loop',
]
const LIBRARIAN_SLUGS = [
  'librarian-evidence-brief-classification',
  'librarian-refuse-insufficient-approved-evidence',
]
const HISTORICAL_SLUGS = [
  'historical-original-claim-modern-interpretation-boundary',
  'historical-hopkins-test-campaigns-context',
]

test('strategy pack uses inspected sources with explicit rights limits', () => {
  for (const source of ['GCS OASIS Campaign Planning', 'GCS Evaluation Cycle', 'OpenStax Principles of Marketing', 'CG Research and Source Quality Standard']) {
    assert.match(MIGRATION, new RegExp(source))
  }
  for (const field of ['rights_status', 'rights_basis', 'commercial_use', 'full_text_storage', 'access_mode', 'rights_checked_at']) {
    assert.match(MIGRATION, new RegExp(field))
  }
  assert.match(MIGRATION, /metadata_and_link_only/)
  assert.match(MIGRATION, /CC BY-NC-SA 4\.0/)
  assert.match(PACK, /machine-readable HTML/)
})

test('all ten cards are candidates and none is activated', () => {
  const all = [...STRATEGY_SLUGS, ...LIBRARIAN_SLUGS, ...HISTORICAL_SLUGS]
  assert.equal(all.length, 10)
  for (const slug of all) assert.match(MIGRATION, new RegExp(slug))
  assert.match(MIGRATION, /'needs_review'/)
  assert.doesNotMatch(MIGRATION, /set\s+status\s*=\s*'active'/i)
  assert.doesNotMatch(MIGRATION, /update\s+public\.skill_cards/i)
  assert.match(MIGRATION, /on conflict \(slug\) do nothing/)
})

test('governance fields and exact source locations are present', () => {
  for (const field of ['safe_claim', 'prohibited_overclaim', 'jurisdiction', 'review_expires_at', 'source_reference', 'reference_state']) {
    assert.match(MIGRATION, new RegExp(field))
  }
  assert.match(MIGRATION, /section 5\.1, Market Segmentation Defined/)
  assert.match(MIGRATION, /section 5\.6, Product Positioning Defined/)
  assert.match(MIGRATION, /section 13\.4, Design the Message/)
  assert.match(MIGRATION, /GCS OASIS live HTML, Objectives/)
  assert.match(MIGRATION, /Chapter 15: Test Campaigns; Library of Congress item 23009362\. No page asserted/)
})

test('candidate routing is narrow and excludes client-specific or agriculture data', () => {
  for (const slug of STRATEGY_SLUGS) {
    const block = MIGRATION.slice(MIGRATION.indexOf(slug), MIGRATION.indexOf(slug) + 2400)
    assert.match(block, /marketing_strategist/)
    assert.match(block, /research_librarian/)
  }
  for (const slug of HISTORICAL_SLUGS) {
    const block = MIGRATION.slice(MIGRATION.indexOf(slug), MIGRATION.indexOf(slug) + 2200)
    assert.match(block, /historical_advertising_analyst/)
    assert.match(block, /research_librarian/)
    assert.doesNotMatch(block, /marketing_strategist/)
  }
  assert.doesNotMatch(MIGRATION, /Agriculture|RC Polypipe|CASE Bloemfontein/i)
})

test('Research Librarian contract returns evidence briefs and refuses thin evidence', () => {
  for (const source of [REGISTRY, EDGE_AGENTS]) {
    assert.match(source, /source_facts/)
    assert.match(source, /interpretations/)
    assert.match(source, /internal_observations/)
    assert.match(source, /uncertainties/)
    assert.match(source, /evidence_gaps/)
    assert.match(source, /Refuse.*approved sources are insufficient/i)
    assert.match(source, /Never creates? (?:campaign )?strategy/i)
    assert.match(source, /final (?:client )?copy/i)
  }
})

test('Historical Analyst contract keeps original claims separate from modern use', () => {
  for (const source of [REGISTRY, EDGE_AGENTS]) {
    assert.match(source, /original_source_claim/)
    assert.match(source, /source_location/)
    assert.match(source, /modern_interpretation/)
    assert.match(source, /outdated_assumption/)
    assert.match(source, /applicability_limit/)
    assert.match(source, /Never present.*historic.*current platform rule/i)
  }
  assert.match(MIGRATION, /scientific-advertising-salesmanship row is intentionally not updated/)
})

test('specialist readiness comes from live active routing and is staff-safe', () => {
  assert.match(EDGE, /\.eq\('status', 'active'\)/)
  assert.match(EDGE, /specialistCounts: Object\.fromEntries\(perSpecialist\)/)
  const statusIndex = EDGE.indexOf("action === 'specialist_status'")
  const adminGuardIndex = EDGE.indexOf("if (action !== 'chat')", statusIndex)
  assert.ok(statusIndex > 0 && adminGuardIndex > statusIndex)
  assert.match(EDGE.slice(statusIndex, adminGuardIndex), /approvedCards/)
  assert.match(EDGE.slice(statusIndex, adminGuardIndex), /available:/)
  assert.match(CLIENT, /fetchSpecialistReadiness/)
  assert.match(PAGE, /not ready/)
  assert.match(PAGE, /approved knowledge card/)
})
