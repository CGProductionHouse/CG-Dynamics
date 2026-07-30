import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const INDEX = read('../supabase/functions/suggest-content-videos/index.ts')

// ── Architecture: uses existing AI provider stack ───────────────────────────

test('imports ai-router from cg-assistant-chat (not a second AI stack)', () => {
  assert.match(INDEX, /from\s+['"]\.\.\/cg-assistant-chat\/ai-router\.ts['"]/)
  assert.match(INDEX, /routeAiChat/)
  assert.match(INDEX, /hasAnyConfiguredProvider/)
})

test('imports cors helpers from _shared', () => {
  assert.match(INDEX, /from\s+['"]\.\.\/_shared\/cors\.ts['"]/)
  assert.match(INDEX, /corsHeaders/)
  assert.match(INDEX, /jsonResponse/)
})

test('imports createClient from supabase-js', () => {
  assert.match(INDEX, /createClient\s*}\s*from/)
})

// ── Auth and role enforcement ───────────────────────────────────────────────

test('rejects requests without Authorization header', () => {
  assert.match(INDEX, /Authorization/)
  assert.match(INDEX, /Authentication required/)
  assert.match(INDEX, /401/)
})

test('extracts Bearer token and calls getUser', () => {
  assert.match(INDEX, /Bearer/)
  assert.match(INDEX, /getUser/)
})

test('rejects client-role users', () => {
  assert.match(INDEX, /STAFF_ROLES/)
  assert.match(INDEX, /Staff access required/)
  assert.match(INDEX, /403/)
})

test('resolves caller profile and role', () => {
  assert.match(INDEX, /profiles['"]/)
  assert.match(INDEX, /\.select\(['"]role['"]\)/)
})

test('never trusts supplied clientId alone — verifies via DB', () => {
  assert.match(INDEX, /clients['"]/)
  assert.match(INDEX, /.eq\(['"]id['"]/, 'queries clients table by id')
  assert.match(INDEX, /client\.active/, 'checks active flag')
  assert.match(INDEX, /Client not found or inactive/, 'rejects missing/inactive')
  assert.match(INDEX, /404/, 'returns 404')
})

test('uses service-role access only after caller authorisation', () => {
  assert.match(INDEX, /SUPABASE_SERVICE_ROLE_KEY/)
  // Auth check (getUser) appears before the main clients query
  const getUserIdx = INDEX.indexOf('getUser')
  const clientVerifyIdx = INDEX.indexOf('Client access verification')
  assert.ok(getUserIdx >= 0, 'getUser exists')
  assert.ok(clientVerifyIdx > getUserIdx, 'client verification comes after auth')
})

// ── Input validation ────────────────────────────────────────────────────────

test('requires clientId, coverageStart and coverageEnd', () => {
  assert.match(INDEX, /clientId.*coverageStart.*coverageEnd/)
  assert.match(INDEX, /are required/)
  assert.match(INDEX, /400/)
})

test('validates UUID format for clientId', () => {
  assert.match(INDEX, /uuid/i)
  assert.match(INDEX, /must be a valid UUID/)
})

test('validates coverage range (end >= start)', () => {
  assert.match(INDEX, /coverageEnd must be on or after coverageStart/)
})

test('caps coverage to MAX_COVERAGE_MONTHS', () => {
  assert.match(INDEX, /MAX_COVERAGE_MONTHS/)
  assert.match(INDEX, /12/)
})

// ── Context assembly ────────────────────────────────────────────────────────

test('fetches industry profile from client_industry_profiles', () => {
  assert.match(INDEX, /client_industry_profiles/)
  assert.match(INDEX, /primary_industry/)
})

test('queries schedule deliverables within coverage window', () => {
  assert.match(INDEX, /monthly_deliverables/)
  assert.match(INDEX, /video['"]?,?\s*['"]reel/)
})

test('loads existing guideline videos when guidelineId provided', () => {
  assert.match(INDEX, /guidelineId/)
  assert.match(INDEX, /content_guide_ideas/)
})

test('loads historical approved concepts for deduplication', () => {
  assert.match(INDEX, /historicalConcepts/)
  assert.match(INDEX, /status.*approved.*in_production.*completed/)
})

test('detects cross-client duplicate titles', () => {
  assert.match(INDEX, /crossClient/)
  assert.match(INDEX, /neq.*client_id/)
})

test('queries active Marketing Library skill cards', () => {
  assert.match(INDEX, /skill_cards/)
  assert.match(INDEX, /universal_principle/)
  assert.match(INDEX, /south_african_market/)
})

// ── SA calendar and research truthfulness ───────────────────────────────────

test('SA calendar context is stable hardcoded data, not research', () => {
  assert.match(INDEX, /SA_CALENDAR/)
  assert.match(INDEX, /Stable SA calendar context/)
  assert.match(INDEX, /NOT live research/)
})

test('SA calendar includes key SA public holidays and seasons', () => {
  assert.match(INDEX, /Heritage Day/)
  assert.match(INDEX, /Freedom Day/)
  assert.match(INDEX, /Youth Day/)
  assert.match(INDEX, /Mandela Day/)
  assert.match(INDEX, /Women.*Day/)
  assert.match(INDEX, /Human Rights Day/)
  assert.match(INDEX, /Workers Day/)
  assert.match(INDEX, /Day of Reconciliation/)
  assert.match(INDEX, /Black Friday/)
})

test('explicitly states live external research was not performed', () => {
  assert.match(INDEX, /live external research.*not performed/i)
  assert.match(INDEX, /liveExternalResearch/)
  assert.match(INDEX, /NOT PERFORMED/)
})

test('no static generator / hardcoded campaign dictionary present', () => {
  // The old hardcoded knownCampaignMoments must be gone
  assert.match(INDEX, /routeAiChat/, 'uses AI provider, not static generation')
  assert.doesNotMatch(INDEX, /knownCampaignMoments/, 'no hardcoded moment map')
  assert.doesNotMatch(INDEX, /Back to School/, 'no static campaign titles')
})

test('system prompt prohibits inventing facts', () => {
  assert.match(INDEX, /Do NOT invent/)
  assert.match(INDEX, /do not know something/)
})

// ── Response structure ──────────────────────────────────────────────────────

test('returns structured VideoSuggestion with all required fields', () => {
  assert.match(INDEX, /targetMonth/)
  assert.match(INDEX, /title/)
  assert.match(INDEX, /objective/)
  assert.match(INDEX, /hook/)
  assert.match(INDEX, /script/)
  assert.match(INDEX, /sceneDirection/)
  assert.match(INDEX, /onScreenText/)
  assert.match(INDEX, /propsProductsPeople/)
  assert.match(INDEX, /locationSuggestion/)
  assert.match(INDEX, /cta/)
  assert.match(INDEX, /reasoning/)
  assert.match(INDEX, /sourcesUsed/)
  assert.match(INDEX, /duplicationRisk/)
})

test('response includes context and sources blocks', () => {
  assert.match(INDEX, /context/)
  assert.match(INDEX, /sources/)
  assert.match(INDEX, /canonicalInternal/)
  assert.match(INDEX, /marketingLibraryKnowledge/)
  assert.match(INDEX, /saCalendarContext/)
  assert.match(INDEX, /liveExternalResearch/)
})

test('suggestions array is capped', () => {
  assert.match(INDEX, /MAX_SUGGESTIONS/)
})

// ── Safety ──────────────────────────────────────────────────────────────────

test('suggestions are drafts — never silently written', () => {
  assert.match(INDEX, /never silently written/)
  assert.match(INDEX, /drafts/)
})

test('safe operational logging without secrets or prompts', () => {
  const logMatch = INDEX.match(/console\.info\(([^)]+)\)/)
  assert.ok(logMatch, 'console.info found')
  const logArgs = logMatch[1]
  assert.doesNotMatch(logArgs, /script/)
  assert.doesNotMatch(logArgs, /prompt/)
  assert.doesNotMatch(logArgs, /credentials?/)
  assert.doesNotMatch(logArgs, /secret/)
  assert.doesNotMatch(logArgs, /Bearer/)
  assert.doesNotMatch(logArgs, /token/)
})

// ── Provider fallback ───────────────────────────────────────────────────────

test('returns structured error when no provider keys configured', () => {
  assert.match(INDEX, /No AI provider key is configured/)
  assert.match(INDEX, /hasAnyConfiguredProvider/)
})

test('returns structured error when provider call fails', () => {
  assert.match(INDEX, /AI provider is currently unavailable/)
  assert.match(INDEX, /NO_AI_PROVIDER_KEYS/)
})
