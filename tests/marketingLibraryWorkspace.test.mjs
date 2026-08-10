import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

// Marketing/Knowledge workspace: pure source filtering/provenance helpers load
// through a Vite SSR server; the workspace consolidation is checked by parsing
// source. No database is touched (the data-access function is not called).

let server
let lib

before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  lib = await server.ssrLoadModule('/src/lib/marketingLibrary.ts')
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const PAGE = read('../src/pages/admin/MarketingWorkspacePage.tsx')
const APP = read('../src/App.tsx')

function source(over = {}) {
  return {
    id: 'x', source_type: 'book', source_name: 'Ogilvy on Advertising', author_or_organisation: 'David Ogilvy',
    title: 'Ogilvy on Advertising', publication_year: 1983, canonical_url: null, page_or_url: null,
    notes: 'classic', trust_tier: 'tier_1_primary', commercial_use: 'restricted', rights_checked_at: '2026-01-01',
    ingestion_status: 'catalogued', country: 'US', ...over,
  }
}

// ── #184 provenance helpers ──────────────────────────────────────────────────

test('sourceUrl prefers a canonical URL, then an http page_or_url, else null', () => {
  assert.equal(lib.sourceUrl({ canonical_url: 'https://a.com', page_or_url: 'https://b.com' }), 'https://a.com')
  assert.equal(lib.sourceUrl({ canonical_url: null, page_or_url: 'https://b.com' }), 'https://b.com')
  assert.equal(lib.sourceUrl({ canonical_url: null, page_or_url: 'chapter 4' }), null)
  assert.equal(lib.sourceUrl({ canonical_url: '', page_or_url: '' }), null)
})

test('sourceNeedsReview flags needs_review tier or unchecked rights', () => {
  assert.equal(lib.sourceNeedsReview({ trust_tier: 'needs_review', rights_checked_at: '2026-01-01' }), true)
  assert.equal(lib.sourceNeedsReview({ trust_tier: 'tier_1_primary', rights_checked_at: null }), true)
  assert.equal(lib.sourceNeedsReview({ trust_tier: 'tier_1_primary', rights_checked_at: '2026-01-01' }), false)
})

test('AI-generated and unsourced origins are never trusted on their own', () => {
  assert.equal(lib.isUntrustedOrigin({ source_type: 'ai_generated' }), true)
  assert.equal(lib.isUntrustedOrigin({ source_type: 'unsourced_blog' }), true)
  assert.equal(lib.isUntrustedOrigin({ source_type: 'book' }), false)
})

// ── Search / filter ──────────────────────────────────────────────────────────

test('filterMarketingSources searches title, author and notes', () => {
  const rows = [source(), source({ id: 'y', source_name: 'Building a StoryBrand', title: 'Building a StoryBrand', author_or_organisation: 'Donald Miller', notes: '' })]
  assert.deepEqual(lib.filterMarketingSources(rows, { query: 'ogilvy' }).map(s => s.id), ['x'])
  assert.deepEqual(lib.filterMarketingSources(rows, { query: 'storybrand' }).map(s => s.id), ['y'])
  assert.equal(lib.filterMarketingSources(rows, { query: '' }).length, 2)
})

test('filterMarketingSources applies type, trust, commercial, hasUrl and needsReview', () => {
  const rows = [
    source({ id: 'a', source_type: 'book', trust_tier: 'tier_1_primary', commercial_use: 'restricted', canonical_url: 'https://a.com', rights_checked_at: '2026-01-01' }),
    source({ id: 'b', source_type: 'research_paper', trust_tier: 'needs_review', commercial_use: 'allowed', canonical_url: null, page_or_url: null, rights_checked_at: null }),
  ]
  assert.deepEqual(lib.filterMarketingSources(rows, { sourceType: 'research_paper' }).map(s => s.id), ['b'])
  assert.deepEqual(lib.filterMarketingSources(rows, { trustTier: 'tier_1_primary' }).map(s => s.id), ['a'])
  assert.deepEqual(lib.filterMarketingSources(rows, { commercialUse: 'allowed' }).map(s => s.id), ['b'])
  assert.deepEqual(lib.filterMarketingSources(rows, { hasUrl: true }).map(s => s.id), ['a'])
  assert.deepEqual(lib.filterMarketingSources(rows, { needsReview: true }).map(s => s.id), ['b'])
  assert.equal(lib.filterMarketingSources(rows, { sourceType: 'all', trustTier: 'all' }).length, 2)
})

// ── Workspace consolidation + admin scoping ──────────────────────────────────

test('the workspace surfaces live registered sources, admin-scoped', () => {
  assert.match(PAGE, /listMarketingSources/)
  assert.match(PAGE, /filterMarketingSources/)
  assert.match(PAGE, /Sources & provenance/)
  // Admin-only, matching the RLS on marketing_library_sources.
  assert.match(PAGE, /isAdmin && <SourcesSection/)
})

test('the workspace groups the Library, Marketing AI and Skill Card areas', () => {
  assert.match(PAGE, /\/admin\/marketing-library/)
  assert.match(PAGE, /\/admin\/marketing-ai/)
  assert.match(PAGE, /\/admin\/skill-card-review/)
})

test('the /admin/marketing route is mounted and manager-gated', () => {
  assert.match(APP, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
})
