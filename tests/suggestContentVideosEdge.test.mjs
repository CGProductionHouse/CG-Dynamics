import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const INDEX = read('../supabase/functions/suggest-content-videos/index.ts')
const ROUTER = read('../supabase/functions/cg-assistant-chat/ai-router.ts')
const WORKFLOW = read('../src/lib/contentWorkflow.ts')

// ── Architecture: uses existing AI provider stack ───────────────────────────

test('imports ai-router from cg-assistant-chat (not a second AI stack)', () => {
  assert.match(INDEX, /from\s+['"]\.\.\/cg-assistant-chat\/ai-router\.ts['"]/)
  assert.match(INDEX, /routeAiChat/)
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
  assert.match(INDEX, /\.select\(['"]role, is_active['"]\)/)
  assert.match(INDEX, /profile\.is_active !== true/)
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

test('requires a client request ID plus clientId, coverageStart and coverageEnd', () => {
  assert.match(INDEX, /requestId.*clientId.*coverageStart.*coverageEnd/)
  assert.match(INDEX, /are required/)
  assert.match(INDEX, /400/)
})

test('validates the client-generated request ID', () => {
  assert.match(INDEX, /\^\[a-zA-Z0-9:_-\]\{8,200\}\$/)
  assert.match(INDEX, /valid client-generated identifier/)
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

test('frontend generates one stable request ID and reuses its request body for a network retry', () => {
  assert.match(WORKFLOW, /options\?\.requestId\s*\?\?\s*crypto\.randomUUID\(\)/)
  assert.match(WORKFLOW, /const requestBody = JSON\.stringify\(\{\s*requestId,/s)
  assert.match(WORKFLOW, /const sendRequest = \(\) => fetch[\s\S]*body: requestBody/)
  assert.match(WORKFLOW, /response = await sendRequest\(\)[\s\S]*catch[\s\S]*response = await sendRequest\(\)/)
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

test('returns structured error when no provider keys configured through canonical routing', () => {
  assert.match(INDEX, /No AI provider key is configured/)
  assert.doesNotMatch(INDEX, /hasAnyConfiguredProvider/)
})

test('returns structured error when provider call fails', () => {
  assert.match(INDEX, /AI provider is currently unavailable/)
  assert.match(INDEX, /NO_AI_PROVIDER_KEYS/)
})

test('canonical routing context classifies and meters content video generation', () => {
  assert.match(INDEX, /usageClient:\s*sb as unknown as AiUsageClient/)
  assert.match(INDEX, /feature:\s*['"]content_video_suggestions['"]/)
  assert.match(INDEX, /action:\s*['"]generate['"]/)
  assert.match(INDEX, /actorId:\s*user\.id/)
  assert.match(INDEX, /idempotencyKey:\s*requestId/)
  assert.match(INDEX, /complexity:\s*['"]complex['"]/)
  assert.match(INDEX, /maxOutputTokens:\s*SUGGESTION_MAX_OUTPUT_TOKENS/)
  assert.match(INDEX, /validateContent:\s*content => extractSuggestions\(content\)\.length > 0/)
})

test('fingerprint is SHA-256 of canonical non-secret semantic inputs, not prompt contents', () => {
  assert.match(INDEX, /crypto\.subtle\.digest\(['"]SHA-256['"]/)
  const fingerprintSection = INDEX.slice(INDEX.indexOf('const fingerprint ='), INDEX.indexOf('aiResult = await routeAiChat'))
  for (const input of ['actorId: user.id', 'clientId', 'coverageStart', 'coverageEnd', 'guidelineId']) {
    assert.match(fingerprintSection, new RegExp(input.replace('.', '\\.')))
  }
  assert.doesNotMatch(fingerprintSection, /messages|systemPrompt|userMessage|rawContent|script/)
})

test('duplicate reservation replays a completed response or fails safely without another paid provider call', () => {
  assert.match(INDEX, /errorMessage === ['"]AI_DUPLICATE_REQUEST['"]/)
  assert.match(INDEX, /No duplicate provider request was sent/)
  assert.match(INDEX, /deduplicated: true/)
  assert.match(INDEX, /duplicate \? 425/)
  assert.match(ROUTER, /if \(reservation\.duplicate\) throw new AiDuplicateRequestError\(reservation\.request_id\)/)
  assert.match(INDEX, /fetchAiUsageReplay<SuggestResponse>/)
  assert.match(INDEX, /replayKind: 'suggestion_response'/)
  assert.match(INDEX, /buildReplayPayload:/)
})

// ── guidelineId binding ──────────────────────────────────────────────────────

test('verifies guidelineId belongs to the requested client', () => {
  assert.match(INDEX, /content_guidelines/)
  assert.match(INDEX, /guideline\.client_id\s*!==\s*clientId/)
})

test('rejects guidelineId mismatch with 403', () => {
  assert.match(INDEX, /Guideline does not belong to this client/)
})

test('rejects unknown guidelineId with 404', () => {
  assert.match(INDEX, /Guideline not found/)
})

// ── Industry-specific Marketing Library cards ────────────────────────────────

test('loads industry_specific knowledge-layer cards matching client industry', () => {
  assert.match(INDEX, /industry_specific/)
  assert.match(INDEX, /kbLayers/)
})

test('skill card query includes all relevant knowledge layers', () => {
  assert.match(INDEX, /universal_principle/)
  assert.match(INDEX, /south_african_market/)
  assert.match(INDEX, /knowledge_layer/)
})

// ── Schema validation ────────────────────────────────────────────────────────

test('isValidSuggestion validates all required fields with correct types', () => {
  assert.match(INDEX, /isValidSuggestion/)
  assert.match(INDEX, /typeof\s+\w+\.(title|script|objective)\s*!==\s*['"]string['"]/)
})

test('rejects malformed provider JSON gracefully', () => {
  assert.match(INDEX, /extractSuggestions/)
  assert.match(INDEX, /JSON\.parse/)
})

test('extracts JSON from code-fenced provider output', () => {
  assert.match(INDEX, /```(?:json)?/)
  assert.match(INDEX, /jsonMatch/)
})

test('caps suggestions at MAX_SUGGESTIONS after parsing', () => {
  assert.match(INDEX, /\.slice\(0,\s*MAX_SUGGESTIONS\)/)
})

test('requests enough output tokens for complete structured video scripts', () => {
  assert.match(INDEX, /SUGGESTION_MAX_OUTPUT_TOKENS\s*=\s*4000/)
  assert.match(INDEX, /routeAiChat\(messages,\s*\{[\s\S]*maxOutputTokens:\s*SUGGESTION_MAX_OUTPUT_TOKENS/)
  assert.match(ROUTER, /Math\.floor\(options\.maxOutputTokens\)/)
  assert.match(ROUTER, /max_tokens:\s*maxOutputTokens/)
  assert.match(ROUTER, /maxOutputTokens:\s*number/)
})

test('does not silently report success for incomplete provider JSON', () => {
  assert.match(INDEX, /suggestions\.length\s*===\s*0/)
  assert.match(INDEX, /AI provider returned an incomplete response/)
  const invalidResponseSection = INDEX.slice(INDEX.indexOf('if (suggestions.length === 0)'), INDEX.indexOf('// ── Return'))
  assert.match(invalidResponseSection, /}, 502\)/)
  assert.match(ROUTER, /status: 'failed', outcome: 'invalid_response'/)
  assert.match(ROUTER, /continue\n\s*}/)
})

// ── Cross-client prompt safety ──────────────────────────────────────────────

test('never includes other client titles or scripts in prompt', () => {
  assert.doesNotMatch(INDEX, /crossClientTitles/, 'no crossClientTitles variable')
  assert.doesNotMatch(INDEX, /otherClient/, 'no otherClient reference in prompt')
  const promptStart = INDEX.indexOf('RULES:')
  const promptEnd = INDEX.indexOf('CONTEXT SOURCES')
  const promptSection = promptStart >= 0 && promptEnd > promptStart
    ? INDEX.slice(promptStart, promptEnd)
    : ''
  assert.doesNotMatch(promptSection, /cross.?client/i, 'prompt section does not discuss other clients')
})

test('cross-client duplicate signal is count-only, no titles', () => {
  assert.match(INDEX, /crossClientDuplicateCount/)
  // crossClientTitles variable must NOT exist (was removed as part of CLC-3)
  assert.doesNotMatch(INDEX, /crossClientTitles/, 'no title-carrying variable')
  // The cross-client data embedded in the prompt uses only count + category,
  // not raw titles/scripts from other clients
  const userMsgSection = INDEX.slice(
    INDEX.indexOf('const userMessage = ['),
    INDEX.indexOf('Generate structured video suggestions'),
  )
  assert.ok(userMsgSection.length > 0, 'userMessage section found')
  assert.match(userMsgSection, /crossClientContext/, 'dedup signal referenced in prompt')
  assert.doesNotMatch(userMsgSection, /\.select\(/, 'no DB queries in user message')
  assert.doesNotMatch(userMsgSection, /from\s+['"]\w+['"]/, 'no raw data queries in prompt')
})

// ── No fallback fake suggestions ─────────────────────────────────────────────

test('no static/fallback suggestion generation when provider unavailable', () => {
  // The function returns an empty suggestions array + error info rather than
  // generating fake suggestions
  assert.match(INDEX, /suggestions:\s*\[\]\s*,/)
  assert.doesNotMatch(INDEX, /fakeSuggestion|generateSuggestion|mockSuggestion|hardcodedSuggestion/)
})
