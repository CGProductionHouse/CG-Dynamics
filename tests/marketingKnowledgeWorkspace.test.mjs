import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Marketing/Knowledge workspace (#183/#184). Pure filtering + registration
// helpers load through Vite SSR (type-only imports, no Supabase at runtime).
// Workspace/permission/AI contracts are checked by parsing source. No database
// is touched and nothing is written.

let server, filters, registry

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  filters = await server.ssrLoadModule('/src/lib/marketing-library/knowledgeFilters.ts')
  registry = await server.ssrLoadModule('/src/lib/marketing-library/sourceRegistry.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const PAGE = read('../src/pages/admin/MarketingWorkspacePage.tsx')
const APP = read('../src/App.tsx')
const NAV = read('../src/pages/admin/adminNavigation.ts')
const SEED = read('../supabase/phase-28a-marketing-library-repo-source-registration.sql')
const WORKFLOW = read('../src/lib/marketingWorkflow.ts')

const card = (over = {}) => ({
  id: 'c', title: 'Hook first 3 seconds', summary: 'Open with tension', principle: 'p', category: 'Creative',
  subcategory: null, status: 'active', knowledge_layer: 'universal_principle', source_id: 's1',
  relevant_industries: ['general'], client_specific: false, review_expires_at: null, ...over,
})
const src = (over = {}) => ({
  id: 's', source_type: 'book', source_name: 'Ogilvy', title: 'Ogilvy', author_or_organisation: 'D Ogilvy',
  notes: '', trust_tier: 'tier_1_primary', canonical_url: null, page_or_url: null, rights_checked_at: '2026-01-01',
  commercial_use: 'restricted', ...over,
})

// ── Skill-card filtering + review state ──────────────────────────────────────

test('skill-card review-state helpers', () => {
  assert.equal(filters.skillCardNeedsReview({ status: 'draft' }), true)
  assert.equal(filters.skillCardNeedsReview({ status: 'active' }), false)
  assert.equal(filters.skillCardIsStale({ review_expires_at: '2020-01-01' }, '2026-08-10'), true)
  assert.equal(filters.skillCardIsStale({ review_expires_at: '2099-01-01' }, '2026-08-10'), false)
  assert.equal(filters.skillCardIsStale({ review_expires_at: null }, '2026-08-10'), false)
  assert.equal(filters.skillCardMissingSource({ source_id: null }), true)
  assert.equal(filters.skillCardMissingSource({ source_id: 's1' }), false)
})

test('filterSkillCards searches and filters by layer, industry, status, queues', () => {
  const rows = [
    card({ id: 'a', title: 'Hook', category: 'Creative', knowledge_layer: 'universal_principle', relevant_industries: ['general'], status: 'active', source_id: 's1', review_expires_at: null }),
    card({ id: 'b', title: 'Legal claims', category: 'Compliance', knowledge_layer: 'industry_specific', relevant_industries: ['legal'], status: 'draft', source_id: null, review_expires_at: '2020-01-01' }),
  ]
  const today = '2026-08-10'
  assert.deepEqual(filters.filterSkillCards(rows, { query: 'legal' }, today).map(c => c.id), ['b'])
  assert.deepEqual(filters.filterSkillCards(rows, { industry: 'legal' }, today).map(c => c.id), ['b'])
  assert.deepEqual(filters.filterSkillCards(rows, { knowledgeLayer: 'universal_principle' }, today).map(c => c.id), ['a'])
  assert.deepEqual(filters.filterSkillCards(rows, { status: 'draft' }, today).map(c => c.id), ['b'])
  assert.deepEqual(filters.filterSkillCards(rows, { needsReview: true }, today).map(c => c.id), ['b'])
  assert.deepEqual(filters.filterSkillCards(rows, { stale: true }, today).map(c => c.id), ['b'])
  assert.deepEqual(filters.filterSkillCards(rows, { missingSource: true }, today).map(c => c.id), ['b'])
  assert.equal(filters.filterSkillCards(rows, {}, today).length, 2)
})

test('source provenance filters', () => {
  assert.equal(filters.sourceUrl({ canonical_url: 'https://a.com', page_or_url: null }), 'https://a.com')
  assert.equal(filters.sourceUrl({ canonical_url: null, page_or_url: 'chapter 3' }), null)
  assert.equal(filters.sourceNeedsReview({ trust_tier: 'needs_review', rights_checked_at: '2026-01-01' }), true)
  assert.equal(filters.sourceNeedsReview({ trust_tier: 'tier_1_primary', rights_checked_at: null }), true)
  assert.equal(filters.isUntrustedOrigin({ source_type: 'ai_generated' }), true)
  const rows = [src({ id: 'a' }), src({ id: 'b', source_type: 'research_paper', title: 'Meta study', source_name: 'Meta study', trust_tier: 'needs_review', rights_checked_at: null })]
  assert.deepEqual(filters.filterMarketingSources(rows, { needsReview: true }).map(s => s.id), ['b'])
  assert.deepEqual(filters.filterMarketingSources(rows, { sourceType: 'research_paper' }).map(s => s.id), ['b'])
})

// ── #184 registration manifest + dedupe/idempotency ──────────────────────────

test('manifest is 29 unique repo-identified reference-only candidates', () => {
  const m = registry.REPO_SOURCE_MANIFEST
  assert.equal(m.length, 29)
  const ids = new Set(m.map(c => c.sourceIdentifier))
  assert.equal(ids.size, 29, 'identifiers are unique')
  for (const c of m) {
    assert.match(c.sourceIdentifier, /^repo:docs\/ai-workforce\//)
    assert.equal(c.trustTier, 'needs_review', 'nothing auto-trusted')
    assert.equal(c.ingestionEligibility, 'metadata_reference', 'reference only, no full text')
  }
})

test('classifyRegistrations dedupes by identifier and is idempotent', () => {
  const m = registry.REPO_SOURCE_MANIFEST
  // Against an empty library: everything is eligible.
  const first = registry.classifyRegistrations(m, [])
  assert.equal(first.counts.unregistered, 29)
  assert.equal(first.counts.registered, 0)
  // Simulate having registered them: re-running registers nothing new (idempotent).
  const existing = m.map(c => ({ source_identifier: c.sourceIdentifier }))
  const second = registry.classifyRegistrations(m, existing)
  assert.equal(second.counts.registered, 29)
  assert.equal(second.counts.unregistered, 0)
  // A duplicated identifier in the manifest is caught, never double-counted.
  const withDup = registry.classifyRegistrations([m[0], m[0]], [])
  assert.equal(withDup.counts.duplicateInManifest, 1)
  assert.equal(withDup.counts.unregistered, 1)
})

test('the phase-28a seed migration is idempotent and mirrors the manifest', () => {
  // Idempotency machinery.
  assert.match(SEED, /create unique index if not exists uniq_marketing_library_sources_source_identifier/)
  assert.match(SEED, /on conflict \(source_identifier\) do nothing/)
  // Nothing auto-trusted; reference-only.
  assert.match(SEED, /'needs_review'/)
  assert.match(SEED, /false/) // full_text_storage
  // Every manifest identifier is present in the seed (kept in sync).
  for (const c of registry.REPO_SOURCE_MANIFEST) {
    assert.ok(SEED.includes(`'${c.sourceIdentifier}'`), `seed must register ${c.sourceIdentifier}`)
  }
})

// ── Workspace consolidation + permissions ────────────────────────────────────

test('the workspace consumes the canonical data layer, not a parallel one', () => {
  assert.match(PAGE, /from '\.\.\/\.\.\/lib\/marketing-library\/skillCardsData'/)
  assert.match(PAGE, /listActiveSharedSkillCards/) // staff-safe read
  assert.match(PAGE, /listMarketingLibrarySources/)
})

test('staff can enter Marketing; source/review/registration are admin-scoped', () => {
  // Library section is available to all; admin-only sections gate on isAdmin.
  assert.match(PAGE, /section === 'sources' && isAdmin/)
  assert.match(PAGE, /section === 'review' && isAdmin/)
  assert.match(PAGE, /section === 'registration' && isAdmin/)
  // Marketing is a staff nav destination (no access gate) — see nav.
  const primary = NAV.slice(NAV.indexOf('export const primaryNavItems'), NAV.indexOf('export const performanceNavItems'))
  assert.match(primary, /to: '\/admin\/marketing', label: 'Marketing'/)
  assert.ok(!/to: '\/admin\/marketing'[^}]*access:/.test(primary), 'Marketing has no access gate in daily nav')
})

test('client users cannot reach Marketing (staff-guarded route)', () => {
  // The route lives inside the RequireStaff + AdminLayout block; clients are denied.
  assert.match(APP, /<Route element=\{<RequireStaff \/>\}>/)
  assert.match(APP, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
})

// ── Marketing AI approved-only grounding (contract) ──────────────────────────

test('Marketing AI grounding contract is preserved (approved-only, no auto-promote)', () => {
  // The data layer still carries evidence + insufficient-evidence signals.
  assert.match(WORKFLOW, /insufficientEvidence\?: boolean/)
  assert.match(WORKFLOW, /evidence_card_ids: string\[\]/)
  // Human decisions gate approval; AI output is a draft/version, never auto-approved.
  assert.match(WORKFLOW, /export async function recordMarketingDecision/)
  // The workspace states the approved-only, review-first behaviour.
  assert.match(PAGE, /approved/)
  assert.match(PAGE, /never auto-approved/)
})
