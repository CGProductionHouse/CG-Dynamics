import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Marketing/Knowledge workspace (#183/#184). Pure filtering, cited-source
// extraction, registration and AI-grounding helpers load through Vite SSR
// (type-only imports, no Supabase at runtime). Workspace/permission contracts
// are checked by parsing source. No database is touched and nothing is written.

let server, filters, registry, extraction, generated, skilled

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  filters = await server.ssrLoadModule('/src/lib/marketing-library/knowledgeFilters.ts')
  registry = await server.ssrLoadModule('/src/lib/marketing-library/sourceRegistry.ts')
  extraction = await server.ssrLoadModule('/src/lib/marketing-library/citedSourceExtraction.ts')
  generated = await server.ssrLoadModule('/src/lib/marketing-library/citedSources.generated.ts')
  skilled = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/skilledAgents.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const PAGE = read('../src/pages/admin/MarketingWorkspacePage.tsx')
const APP = read('../src/App.tsx')
const NAV = read('../src/pages/admin/adminNavigation.ts')
const SEED = read('../supabase/phase-28a-marketing-library-repo-source-registration.sql')
const WORKFLOW = read('../src/lib/marketingWorkflow.ts')
const STAFF_DATA = read('../src/lib/marketing-library/skillCardsData.ts')
const ASSISTANT = read('../supabase/functions/cg-assistant-chat/index.ts')

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
  assert.equal(filters.skillCardIsStale({ review_expires_at: '2026-08-10' }, '2026-08-10'), false)
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

// ── #184 cited-source extraction: distinct sources, not one row per file ──────

test('the committed cited-source manifest matches a fresh extraction of the packs (drift guard)', () => {
  const files = generated.PACK_FILES.map(path => ({ path, content: readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') }))
  const cited = extraction.extractCitedSources(files)
  const containers = extraction.buildContainerReferences(files, cited)
  assert.deepEqual(cited, generated.CITED_SOURCES, 'run `node scripts/generate-cited-sources.mjs` to refresh')
  assert.deepEqual(containers, generated.CONTAINER_REFERENCES, 'run `node scripts/generate-cited-sources.mjs` to refresh')
})

test('registration is the distinct CITED sources inside the packs, not one flattened row per file', () => {
  const cited = generated.CITED_SOURCES
  // Far more distinct cited sources than there are pack files — this is the fix.
  assert.ok(cited.length > generated.PACK_FILES.length * 3, 'many cited sources per pack')
  // Identifiers are unique and stable (canonical URL or repo: path, never a db id).
  const ids = new Set(cited.map(c => c.sourceIdentifier))
  assert.equal(ids.size, cited.length, 'cited-source identifiers are unique')
  for (const c of cited) {
    assert.ok(/^https?:\/\//.test(c.sourceIdentifier) || /^repo:docs\/ai-workforce\//.test(c.sourceIdentifier))
    assert.equal(c.trustTier, 'needs_review', 'nothing auto-trusted')
    assert.ok(c.title && c.title.trim().length > 0, 'every cited source has a title')
    assert.ok(c.citedIn.length >= 1, 'every cited source records its container pack(s)')
  }
  // The overwhelming majority carry explicit per-source provenance (a canonical
  // URL, an attribution or a rights note); the rest are named internal sources.
  const withProvenance = cited.filter(c => c.canonicalUrl || c.sourceAttribution || c.rightsNote || c.family === 'book')
  assert.ok(withProvenance.length >= cited.length * 0.9, 'per-source provenance is captured broadly')
  assert.ok(cited.filter(c => c.canonicalUrl).length > 100, 'most cited sources carry a canonical URL')
  // Real cited-source families are represented (campaign cases, books, official docs, research).
  const families = new Set(cited.map(c => c.family))
  for (const f of ['campaign_case', 'book', 'official_documentation', 'research_paper']) assert.ok(families.has(f), `has ${f}`)
})

test('classifyRegistrations dedupes by identifier and is idempotent', () => {
  const m = registry.REGISTRATION_MANIFEST
  assert.ok(m.length >= generated.CITED_SOURCES.length + generated.CONTAINER_REFERENCES.length - 0)
  // Against an empty library: everything is eligible.
  const first = registry.classifyRegistrations(m, [])
  assert.equal(first.counts.unregistered, m.length)
  assert.equal(first.counts.registered, 0)
  assert.equal(first.counts.citedSources, generated.CITED_SOURCES.length)
  assert.equal(first.counts.containers, generated.CONTAINER_REFERENCES.length)
  // Simulate having registered them: re-running registers nothing new (idempotent).
  const existing = m.map(c => ({ source_identifier: c.sourceIdentifier }))
  const second = registry.classifyRegistrations(m, existing)
  assert.equal(second.counts.registered, m.length)
  assert.equal(second.counts.unregistered, 0)
  // A duplicated identifier in the manifest is caught, never double-counted.
  const withDup = registry.classifyRegistrations([m[0], m[0]], [])
  assert.equal(withDup.counts.duplicateInManifest, 1)
  assert.equal(withDup.counts.unregistered, 1)
})

test('the phase-28a seed is valid against the schema, idempotent, and mirrors the manifest', () => {
  // Idempotency machinery: partial unique index + an ON CONFLICT arbiter whose
  // predicate matches the index WHERE (so PostgreSQL can infer it).
  assert.match(SEED, /create unique index if not exists uniq_marketing_library_sources_source_identifier/)
  assert.match(SEED, /where source_identifier is not null/)
  assert.match(SEED, /on conflict \(source_identifier\) where source_identifier is not null do nothing/)
  // Rights: the allowed value, never the rejected 'internal_repository'.
  assert.match(SEED, /'bibliographic_only'/)
  assert.ok(!SEED.includes('internal_repository'), "must not use the invalid rights_status 'internal_repository'")
  // Reference-only + nothing auto-trusted.
  assert.match(SEED, /false, 'unknown', 'catalogued'/) // full_text_storage=false
  assert.match(SEED, /'needs_review'/)
  // canonical_url dedupe guard so a live source sharing a URL is not duplicated.
  assert.match(SEED, /or \(v\.canonical_url is not null and s\.canonical_url = v\.canonical_url\)/)
  // Every manifest identifier is present in the seed (kept in sync by the generator).
  for (const c of registry.REGISTRATION_MANIFEST) {
    assert.ok(SEED.includes(`'${c.sourceIdentifier.replace(/'/g, "''")}'`), `seed must register ${c.sourceIdentifier}`)
  }
})

// ── Marketing AI grounding: approved-only AND not stale/expired (Blocker 4) ───

test('production grounding uses the date-only freshness boundary', () => {
  const agent = skilled.AGENT_CONTRACTS.copywriting_agent
  const base = {
    id: 'x', status: 'active', knowledge_layer: 'universal', client_specific: false, active_client_id: null,
    source_type: 'book', source_id: 's1', title: 'Hook', principle: 'Open strong', summary: 's',
    source_reference: null, relevant_agents: ['copywriting_agent'],
  }
  const expired = { ...base, id: 'expired-yesterday', review_expires_at: '2026-08-09' }
  const currentToday = { ...base, id: 'current-today', review_expires_at: '2026-08-10' }
  const currentFuture = { ...base, id: 'current-future', review_expires_at: '2026-08-11' }
  const noExpiry = { ...base, id: 'no-expiry', review_expires_at: null }
  const today = '2026-08-10'

  // Production, with a clock: the expired active card must NOT ground an answer.
  const prod = skilled.buildPlan([expired, currentToday, currentFuture, noExpiry], { agent, activeClientId: null, mode: 'production', today })
  const prodIds = prod.cards.map(c => c.id)
  assert.ok(!prodIds.includes('expired-yesterday'), 'a card expired yesterday is excluded')
  assert.ok(prodIds.includes('current-today'), 'a card expiring today is still current')
  assert.ok(prodIds.includes('current-future'), 'a future expiry is still current')
  assert.ok(prodIds.includes('no-expiry'), 'an active card with no expiry still grounds')

  // The gate itself is explicit about the expired card.
  assert.equal(skilled.isCardRetrievable(expired, { agent, activeClientId: null, mode: 'production', today }), false)
  assert.equal(skilled.isCardRetrievable(currentToday, { agent, activeClientId: null, mode: 'production', today }), true)

  // Admin research mode is a preview surface — expiry does not exclude there.
  assert.equal(skilled.isCardRetrievable(expired, { agent, activeClientId: null, mode: 'admin_research', today }), true)

  // Honest refusal is preserved when everything is stale.
  const allStale = skilled.buildPlan([expired], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(allStale.insufficient, true)
})

test('production consumers select and pass the date-only freshness boundary', () => {
  const wf = read('../supabase/functions/marketing-workflow/index.ts')
  assert.match(wf, /review_expires_at/) // selected from skill_cards
  assert.match(wf, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/)
  assert.match(wf, /mode: 'production', today/)
  assert.match(ASSISTANT, /review_expires_at/)
  assert.match(ASSISTANT, /mode, today/)
})

test('staff Library and Marketing AI capability counts exclude expired cards', () => {
  assert.match(STAFF_DATA, /review_expires_at\.is\.null,review_expires_at\.gte\.\$\{today\}/)
  const stateReader = ASSISTANT.slice(ASSISTANT.indexOf('async function getMarketingAiState'), ASSISTANT.indexOf('function formatMarketingAiState'))
  assert.match(stateReader, /relevant_agents, source_type, review_expires_at/)
  assert.match(stateReader, /review_expires_at\.is\.null,review_expires_at\.gte\.\$\{today\}/)
})

// ── Workspace consolidation + permissions ────────────────────────────────────

test('the workspace consumes the canonical data layer, not a parallel one', () => {
  assert.match(PAGE, /from '\.\.\/\.\.\/lib\/marketing-library\/skillCardsData'/)
  assert.match(PAGE, /listActiveSharedSkillCards/) // staff-safe read
  assert.match(PAGE, /listMarketingLibrarySources/)
})

test('staff can enter Marketing; source/review/registration are admin-scoped; AI is manager-scoped', () => {
  assert.match(PAGE, /section === 'sources' && isAdmin/)
  assert.match(PAGE, /section === 'review' && isAdmin/)
  assert.match(PAGE, /section === 'registration' && isAdmin/)
  assert.match(PAGE, /section === 'ai' && isManager/)
  // Marketing is a staff nav destination (no access gate) — see nav.
  const primary = NAV.slice(NAV.indexOf('export const primaryNavItems'), NAV.indexOf('export const performanceNavItems'))
  assert.match(primary, /to: '\/admin\/marketing', label: 'Marketing'/)
  assert.ok(!/to: '\/admin\/marketing'[^}]*access:/.test(primary), 'Marketing has no access gate in daily nav')
})

test('client users cannot reach Marketing (staff-guarded route)', () => {
  assert.match(APP, /<Route element=\{<RequireStaff \/>\}>/)
  assert.match(APP, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
})

test('Marketing AI route and UI agree on manager access (Blocker 3)', () => {
  // The route sits inside the RequireManager block, not RequireAdmin.
  const managerIdx = APP.indexOf('<Route element={<RequireManager />}>')
  const adminIdx = APP.indexOf('<Route element={<RequireAdmin />}>')
  const aiIdx = APP.indexOf('path="/admin/marketing-ai"')
  assert.ok(aiIdx > managerIdx && aiIdx < adminIdx, 'marketing-ai is in the RequireManager block, before RequireAdmin')
  // The page itself gates manager-only capabilities on the manager role.
  const aiPage = read('../src/pages/admin/MarketingAiDepartmentPage.tsx')
  assert.match(aiPage, /isManagerRole/)
})

// ── Marketing AI approved-only grounding (contract) ──────────────────────────

test('Marketing AI grounding contract is preserved (approved-only, no auto-promote)', () => {
  assert.match(WORKFLOW, /insufficientEvidence\?: boolean/)
  assert.match(WORKFLOW, /evidence_card_ids: string\[\]/)
  assert.match(WORKFLOW, /export async function recordMarketingDecision/)
  assert.match(PAGE, /approved/)
  assert.match(PAGE, /never auto-approved/)
})
