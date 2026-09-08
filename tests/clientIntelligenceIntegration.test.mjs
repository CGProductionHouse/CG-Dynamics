import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

// Client intelligence integration (#241). Proves exact-client isolation,
// stale/excluded knowledge grounding, Client Guide derivation correctness,
// Project Instructions boundedness, and client-role access denial.

let server, skilled, guideGenerator, agent

const today = '2026-09-08'

before(async () => {
  server = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    server: { middlewareMode: true },
    appType: 'custom',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://example.supabase.co'),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify('test-key'),
    },
  })
  skilled = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/skilledAgents.ts')
  guideGenerator = await server.ssrLoadModule('/src/lib/clientGuideGenerator.ts')
  agent = skilled.AGENT_CONTRACTS.copywriting_agent
})
after(async () => { await server?.close() })

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

const MARKETING_PAGE = read('../src/pages/admin/MarketingWorkspacePage.tsx')
const APP = read('../src/App.tsx')
const MIGRATION_REGISTRATION = read('../supabase/migrations/20260908110000_client_intelligence_registration.sql')
const MIGRATION_GUIDES = read('../supabase/migrations/20260908100000_client_guides.sql')
const MIGRATION_PROJECT_MAPPINGS = read('../supabase/migrations/20260908120000_client_project_mappings.sql')
const CLIENT_GUIDES_TS = read('../src/lib/clientGuides.ts')
const CLIENT_PROJECT_MAPPING_TS = read('../src/lib/clientProjectMapping.ts')
const CLIENT_CONTEXT_TS = read('../src/lib/clientContext.ts')
const GET_CLIENT_CONTEXT_FN = read('../supabase/functions/get-client-context/index.ts')

const capeCard = {
  id: 'cape-1', slug: 'cape-lumber-positioning', title: 'Cape Lumber: supplier, not contractor',
  status: 'active', knowledge_layer: 'active_client_specific', source_type: 'staff_observation',
  source_id: 's1', principle: 'Cape Lumber is a supplier', summary: 'Supply-led positioning',
  client_specific: true, active_client_id: 'cape-uuid-001',
  relevant_agents: ['copywriting_agent'], review_expires_at: null,
}
const bloemCard = {
  id: 'bloem-1', slug: 'action-sport-voice', title: 'Bloem Action Sports: voice rules',
  status: 'active', knowledge_layer: 'active_client_specific', source_type: 'staff_observation',
  source_id: 's2', principle: 'Voice rules', summary: 'Local energetic tone',
  client_specific: true, active_client_id: 'bloem-uuid-002',
  relevant_agents: ['copywriting_agent'], review_expires_at: null,
}
const duluxCard = {
  id: 'dulux-1', slug: 'dulux-bfn-colour-copy', title: 'Dulux BFN: colour by room effect',
  status: 'active', knowledge_layer: 'active_client_specific', source_type: 'staff_observation',
  source_id: 's3', principle: 'Room-effect language', summary: 'Describe what colour does',
  client_specific: true, active_client_id: 'dulux-uuid-003',
  relevant_agents: ['copywriting_agent'], review_expires_at: null,
}

test('Cape Lumber context retrieves only Cape cards, not Bloem or Dulux', () => {
  const result = skilled.buildPlan([capeCard, bloemCard, duluxCard], {
    agent, activeClientId: 'cape-uuid-001', mode: 'production', today,
  })
  const ids = result.cards.map(c => c.id)
  assert.ok(ids.includes('cape-1'), 'Cape card is retrievable for Cape client')
  assert.ok(!ids.includes('bloem-1'), 'Bloem card is NOT retrievable for Cape client')
  assert.ok(!ids.includes('dulux-1'), 'Dulux card is NOT retrievable for Cape client')
})

test('Bloem Action Sports context retrieves only Bloem cards, not Cape or Dulux', () => {
  const result = skilled.buildPlan([capeCard, bloemCard, duluxCard], {
    agent, activeClientId: 'bloem-uuid-002', mode: 'production', today,
  })
  const ids = result.cards.map(c => c.id)
  assert.ok(!ids.includes('cape-1'), 'Cape card is NOT retrievable for Bloem client')
  assert.ok(ids.includes('bloem-1'), 'Bloem card is retrievable for Bloem client')
  assert.ok(!ids.includes('dulux-1'), 'Dulux card is NOT retrievable for Bloem client')
})

test('Dulux context retrieves only Dulux cards, not Cape or Bloem', () => {
  const result = skilled.buildPlan([capeCard, bloemCard, duluxCard], {
    agent, activeClientId: 'dulux-uuid-003', mode: 'production', today,
  })
  const ids = result.cards.map(c => c.id)
  assert.ok(!ids.includes('cape-1'), 'Cape card is NOT retrievable for Dulux client')
  assert.ok(!ids.includes('bloem-1'), 'Bloem card is NOT retrievable for Dulux client')
  assert.ok(ids.includes('dulux-1'), 'Dulux card is retrievable for Dulux client')
})

test('client_specific cards are excluded when no activeClientId is set', () => {
  const result = skilled.buildPlan([capeCard, bloemCard, duluxCard], {
    agent, activeClientId: null, mode: 'production', today,
  })
  assert.equal(result.cards.length, 0, 'no client-specific cards ground without an active client')
  assert.equal(result.insufficient, true)
})

// ── Stale / rejected / superseded knowledge is excluded from grounding ──────

const baseCard = {
  id: 'active-1', slug: 'test', title: 'Test card', status: 'active',
  knowledge_layer: 'universal', source_type: 'book', source_id: 's1',
  principle: 'Test', summary: 'Test', client_specific: false, active_client_id: null,
  relevant_agents: ['copywriting_agent'], review_expires_at: null,
}

test('needs_review cards do not ground production', () => {
  const card = { ...baseCard, id: 'nr-1', status: 'needs_review' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 0, 'needs_review card excluded from production')
})

test('deprecated cards never ground production', () => {
  const card = { ...baseCard, id: 'dep-1', status: 'deprecated' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 0, 'deprecated card excluded')
})

test('expired review cards do not ground production', () => {
  const card = { ...baseCard, id: 'exp-1', review_expires_at: '2026-09-07' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 0, 'expired card excluded from production')
})

test('cards expiring today still ground production', () => {
  const card = { ...baseCard, id: 'today-1', review_expires_at: '2026-09-08' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 1, 'card expiring today is still current')
})

test('AI-generated source type is never authoritative', () => {
  const card = { ...baseCard, id: 'ai-1', source_type: 'ai_generated' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 0, 'ai_generated card excluded')
})

test('unsourced_blog source type is never authoritative', () => {
  const card = { ...baseCard, id: 'blog-1', source_type: 'unsourced_blog' }
  const result = skilled.buildPlan([card], { agent, activeClientId: null, mode: 'production', today })
  assert.equal(result.cards.length, 0, 'unsourced_blog card excluded')
})

// ── Client Guide is derived from canonical intelligence, not manually maintained ──

test('Client Guide generation produces a guide with the client name and working rule', () => {
  const pack = `# Cape Lumber

## Voice and tone
Cape Lumber sounds professional and trade-focused.

## Content idea
Showcase new timber stock arrivals.

## Guardrail
Never present as a contractor.
`
  const { guideMarkdown, projectInstructions } = guideGenerator.generateClientGuide(pack, 'Cape Lumber')

  assert.ok(guideMarkdown.includes('# Cape Lumber — CG Dynamics Client Guide'), 'title includes client name')
  assert.ok(guideMarkdown.includes('CG Dynamics is the permanent client source of truth'), 'states CG Dynamics is source of truth')
  assert.ok(guideMarkdown.includes('## Working rule'), 'includes working rule section')
  assert.ok(guideMarkdown.includes('Update CG Dynamics as the single source of truth'), 'working rule says update Dynamics first')
  assert.ok(guideMarkdown.includes('Cape Lumber sounds professional'), 'extracts voice section')
  assert.ok(guideMarkdown.includes('Never present as a contractor'), 'extracts guardrail section')
})

test('Client Guide includes identity section from the pack', () => {
  const pack = `# Cape Lumber

Cape Lumber is a timber and building-material supplier in the Western Cape.

## Voice
Professional, trade-focused.
`
  const { guideMarkdown } = guideGenerator.generateClientGuide(pack, 'Cape Lumber')
  assert.ok(guideMarkdown.includes('timber and building-material supplier'), 'identity section extracted')
})

test('Client Guide .md is marked as export-only artifact', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { guideMarkdown } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(guideMarkdown.includes('**This is an export-only artifact.**'), '.md is explicitly marked export-only')
})

test('Project Instructions are short and bounded', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { projectInstructions } = guideGenerator.generateClientGuide(pack, 'Test Client')

  const lines = projectInstructions.split('\n').filter(l => l.trim().length > 0)
  assert.ok(lines.length <= 20, `Project Instructions are bounded (${lines.length} lines)`)
  assert.ok(projectInstructions.includes('Test Client'), 'includes client name')
  assert.ok(projectInstructions.includes('CG Dynamics'), 'references CG Dynamics as source of truth')
  assert.ok(projectInstructions.includes('retrieve current canonical intelligence'), 'includes live retrieval path')
})

test('Project Instructions include task-specific retrieval rules', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { projectInstructions } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(projectInstructions.includes('Caption/content →'), 'has caption retrieval rule')
  assert.ok(projectInstructions.includes('Image editing →'), 'has image retrieval rule')
  assert.ok(projectInstructions.includes('Factual claims →'), 'has factual lookup retrieval rule')
  assert.ok(projectInstructions.includes('SEO/hashtags →'), 'has SEO/hashtag retrieval rule')
})

test('Project Instructions include max 5 hashtags rule', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { projectInstructions } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(projectInstructions.includes('Max 5 hashtags'), 'includes max 5 hashtags rule')
})

test('Project Instructions do not duplicate the full guide content', () => {
  const pack = `# Client

## Voice
Detailed voice rules here that go on for quite a while to make the guide longer.
More voice details and specifics about the brand tone and style guidelines.
Additional context about how the brand should sound across all channels.

## Caption
Caption rules here with extensive detail about formatting and length requirements.
Specific rules about hashtag usage and call-to-action placement.
Guidelines for different platforms like Instagram, Facebook and TikTok.

## Poster
Poster rules here with design specifications and typography guidelines.
Colour palette requirements and brand consistency rules.
Layout principles and visual hierarchy standards.

## Reel
Reel rules here with pacing and scripting guidelines.
Audio selection criteria and trending sound usage rules.
Duration recommendations and hook strategies for different content types.
`
  const { guideMarkdown, projectInstructions } = guideGenerator.generateClientGuide(pack, 'Client')
  assert.ok(projectInstructions.length < guideMarkdown.length, `instructions (${projectInstructions.length}) should be shorter than guide (${guideMarkdown.length})`)
  assert.ok(!projectInstructions.includes('Caption rules here'), 'instructions do not include full guide sections')
})

// ── Registration SQL is correctly structured ────────────────────────────────

test('registration migration uses proper timestamped location', () => {
  assert.match(MIGRATION_REGISTRATION, /20260908110000_client_intelligence_registration/)
})

test('registration migration resolves clients by exact name only', () => {
  assert.match(MIGRATION_REGISTRATION, /where name = 'Cape Lumber'/)
  assert.match(MIGRATION_REGISTRATION, /where name = 'Action Sport'/)
  assert.match(MIGRATION_REGISTRATION, /where name = 'Dulux Bloemfontein'/)
  assert.doesNotMatch(MIGRATION_REGISTRATION, /like '%Cape%'/, 'no fuzzy matching')
})

test('registration migration inserts sources with needs_review trust tier', () => {
  assert.match(MIGRATION_REGISTRATION, /'needs_review', 'metadata_and_link_only', 'catalogued'/)
})

test('registration migration inserts skill cards as needs_review', () => {
  assert.match(MIGRATION_REGISTRATION, /'needs_review'::text, 'active_client_specific'::text/)
})

test('registration migration uses ON CONFLICT for idempotency', () => {
  assert.match(MIGRATION_REGISTRATION, /on conflict \(source_identifier\) where source_identifier is not null do nothing/)
  assert.match(MIGRATION_REGISTRATION, /on conflict \(slug\) do nothing/)
})

test('client_guides migration creates the derived guide table', () => {
  assert.match(MIGRATION_GUIDES, /create table if not exists public\.client_guides/)
  assert.match(MIGRATION_GUIDES, /guide_markdown text not null/)
  assert.match(MIGRATION_GUIDES, /project_instructions text not null/)
  assert.match(MIGRATION_GUIDES, /version\s+integer not null default 1/)
})

test('client_guides migration enforces RLS', () => {
  assert.match(MIGRATION_GUIDES, /alter table public\.client_guides enable row level security/)
  assert.match(MIGRATION_GUIDES, /client_guides_admin_manager_all/)
  assert.match(MIGRATION_GUIDES, /client_guides_staff_read/)
})

// ── Client-role access cannot read internal Marketing/Knowledge intelligence ──

test('Marketing page is behind RequireStaff route (client users cannot reach it)', () => {
  assert.match(APP, /<Route element=\{<RequireStaff \/>\}>/)
  assert.match(APP, /path="\/admin\/marketing" element=\{<MarketingWorkspacePage \/>\}/)
})

test('client-guides section is admin/manager scoped in the workspace', () => {
  assert.match(MARKETING_PAGE, /section === 'client-guides'/)
  assert.match(MARKETING_PAGE, /isAdminRole|isManagerRole/)
})

test('client_guides table has no client-role read policy', () => {
  assert.doesNotMatch(MIGRATION_GUIDES, /role = 'client'/, 'no client-role access to client_guides')
  assert.match(MIGRATION_GUIDES, /is_admin_or_manager\(\)/, 'admin/manager write access')
})

test('clientGuides.ts uses the canonical data layer', () => {
  assert.match(CLIENT_GUIDES_TS, /from '\.\/supabase'/, 'imports from supabase')
  assert.match(CLIENT_GUIDES_TS, /client_guides/, 'queries client_guides table')
  assert.match(CLIENT_GUIDES_TS, /export async function listClientGuides/)
  assert.match(CLIENT_GUIDES_TS, /export async function getClientGuide/)
  assert.match(CLIENT_GUIDES_TS, /export async function upsertClientGuide/)
})

// ── No legacy phase-30a file ────────────────────────────────────────────────

test('no root phase-30a SQL file exists (data registration moved to timestamped migration)', () => {
  let exists = false
  try {
    readFileSync(new URL('../supabase/phase-30a-client-intelligence-integration.sql', import.meta.url), 'utf8')
    exists = true
  } catch { /* expected: file should not exist */ }
  assert.equal(exists, false, 'phase-30a legacy file should be deleted')
})

// ── Direct CG Dynamics ↔ ChatGPT bridge ─────────────────────────────────────

test('client_project_mappings migration creates the mapping table', () => {
  assert.match(MIGRATION_PROJECT_MAPPINGS, /create table if not exists public\.client_project_mappings/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /client_id\s+uuid\s+not null references public\.clients\(id\) on delete cascade/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /chatgpt_project_url\s+text/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /project_name\s+text/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /sync_state\s+text not null default 'needs_setup'/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /last_context_retrieved_at\s+timestamptz/)
})

test('client_project_mappings migration enforces RLS', () => {
  assert.match(MIGRATION_PROJECT_MAPPINGS, /alter table public\.client_project_mappings enable row level security/)
  assert.match(MIGRATION_PROJECT_MAPPINGS, /client_project_mappings_admin_manager/)
})

test('client_project_mappings migration creates one-to-one unique constraint', () => {
  assert.match(MIGRATION_PROJECT_MAPPINGS, /client_id\s+uuid.*on delete cascade\s+unique/)
})

test('clientProjectMapping.ts exports required functions', () => {
  assert.match(CLIENT_PROJECT_MAPPING_TS, /export async function listClientProjectMappings/)
  assert.match(CLIENT_PROJECT_MAPPING_TS, /export async function getClientProjectMapping/)
  assert.match(CLIENT_PROJECT_MAPPING_TS, /export async function upsertClientProjectMapping/)
  assert.match(CLIENT_PROJECT_MAPPING_TS, /export function openChatgptProject/)
})

test('clientProjectMapping.ts queries the correct table', () => {
  assert.match(CLIENT_PROJECT_MAPPING_TS, /client_project_mappings/, 'queries client_project_mappings table')
})

test('clientContext.ts exports the context retrieval function', () => {
  assert.match(CLIENT_CONTEXT_TS, /export async function getClientContext/)
  assert.match(CLIENT_CONTEXT_TS, /get-client-context/, 'calls the Edge Function')
})

test('get-client-context Edge Function is correctly structured', () => {
  assert.match(GET_CLIENT_CONTEXT_FN, /Deno\.serve/, 'is a Deno serve function')
  assert.match(GET_CLIENT_CONTEXT_FN, /requireAdminOrManager/, 'requires admin/manager auth')
  assert.match(GET_CLIENT_CONTEXT_FN, /client_id/, 'accepts client_id parameter')
  assert.match(GET_CLIENT_CONTEXT_FN, /task_type/, 'accepts task_type parameter')
  assert.match(GET_CLIENT_CONTEXT_FN, /client_specific/, 'filters by client_specific')
})

test('get-client-context Edge Function supports all 7 task types', () => {
  const expectedTasks = ['caption', 'content_idea', 'poster_copy', 'image_edit', 'factual_lookup', 'campaign', 'seo_hashtags']
  for (const task of expectedTasks) {
    assert.ok(GET_CLIENT_CONTEXT_FN.includes(`'${task}'`), `supports task type: ${task}`)
  }
})

test('get-client-context Edge Function returns JSON with client isolation', () => {
  assert.match(GET_CLIENT_CONTEXT_FN, /active_client_id/, 'filters cards by active_client_id')
  assert.match(GET_CLIENT_CONTEXT_FN, /jsonResponse/, 'returns JSON response')
})

test('Marketing page includes Open ChatGPT Project action', () => {
  assert.match(MARKETING_PAGE, /Open ChatGPT Project/, 'has Open ChatGPT Project button')
  assert.match(MARKETING_PAGE, /openChatgptProject/, 'calls openChatgptProject function')
})

test('Marketing page shows sync state for project mappings', () => {
  assert.match(MARKETING_PAGE, /sync_state/, 'reads sync_state from mapping')
  assert.match(MARKETING_PAGE, /syncStateLabel/, 'displays sync state label')
  assert.match(MARKETING_PAGE, /syncStateTone/, 'applies tone to sync state')
})

test('Marketing page loads project mappings alongside guides', () => {
  assert.match(MARKETING_PAGE, /listClientProjectMappings/, 'loads project mappings')
  assert.match(MARKETING_PAGE, /ClientProjectMapping/, 'imports ClientProjectMapping type')
})

test('Bridge contract: static .md is export-only, not a runtime dependency', () => {
  assert.ok(guideGenerator.generateClientGuide, 'generateClientGuide exists')
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { guideMarkdown } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(guideMarkdown.includes('export-only artifact'), '.md is explicitly marked as export-only')
  assert.ok(guideMarkdown.includes('not a runtime dependency'), '.md states it is not a runtime dependency')
})

test('Bridge contract: Project Instructions use live retrieval, not static file', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { projectInstructions } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(projectInstructions.includes('retrieve current canonical intelligence from CG Dynamics at task time'), 'uses live retrieval')
  assert.ok(projectInstructions.includes('Never rely on a previously uploaded .md file'), 'does not rely on static .md')
})

test('Bridge contract: task-specific retrieval rules are present', () => {
  const pack = `# Test Client\n\n## Voice\nTest voice.\n`
  const { projectInstructions } = guideGenerator.generateClientGuide(pack, 'Test Client')
  assert.ok(projectInstructions.includes('Caption/content → fetch voice rules'), 'caption retrieval specified')
  assert.ok(projectInstructions.includes('Image editing → fetch visual/image rules'), 'image retrieval specified')
  assert.ok(projectInstructions.includes('Factual claims → fetch verified facts'), 'factual lookup retrieval specified')
  assert.ok(projectInstructions.includes('SEO/hashtags → choose 3-5 dynamically'), 'SEO/hashtag retrieval specified')
})
