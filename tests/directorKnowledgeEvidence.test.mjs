import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

let server, knowledge, modes, workflow, retrieval, registry
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  knowledge = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorKnowledge.ts')
  modes = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
  workflow = await server.ssrLoadModule('/src/lib/contentWorkflow.ts')
  retrieval = await server.ssrLoadModule('/src/features/ai-workforce/retrieval/retrievalV1.ts')
  registry = await server.ssrLoadModule('/src/features/ai-workforce/agents/agentRegistry.ts')
})
after(async () => { await server?.close() })
const card = patch => ({ content_hash: 'a'.repeat(64), reviewed_content_hash: 'a'.repeat(64), id: 'card-a', status: 'active', title: 'Useful creative principle', principle: 'Use verified proof before an offer.', summary: 'A source-backed example', knowledge_layer: 'universal_principle', client_specific: false, active_client_id: null, source_id: 'source-a', source_type: 'book', source_reference: 'Reviewed source, section 2', relevant_agents: ['creative_director_agent'], relevant_industries: ['automotive'], review_expires_at: '2026-10-03', evidence_label: 'source_backed', confidence_level: 'medium', safe_claim: 'Guidance, not an uplift promise', prohibited_overclaim: 'No guaranteed outcome', updated_at: '2026-10-01T10:00:00Z', ...patch })
const select = cards => knowledge.selectDirectorKnowledge(cards.map(value => ({ linked_source: { trust_tier: 'tier_1_primary', source_type: 'book', rights_status: 'citation_only' }, ...value })), 'client-a', 'automotive', '2026-10-03')

test('actual specialist gate admits relevant legacy alias, exact client and known industry deterministically', () => {
  const candidates = [card({ id: 'z' }), card({ id: 'a' }), card({ id: 'own', client_specific: true, active_client_id: 'client-a', knowledge_layer: 'active_client_specific' }), card({ id: 'industry', knowledge_layer: 'industry_specific' })]
  assert.deepEqual(select(candidates), select([...candidates].reverse()))
  assert.equal(select(candidates).references.length, 4)
  assert.match(select(candidates).lines.join('\n'), /confidence_level|safe_claim|prohibited_overclaim|card_id/)
})

test('wrong client/agent/layer/industry, unreviewed, expired and malformed records cannot enter the prompt', () => {
  const denied = [
    { status: 'needs_review' }, { status: 'draft' }, { status: 'deprecated' }, { status: 'rejected' },
    { review_expires_at: '2026-10-02' }, { review_expires_at: 'garbage' }, { review_expires_at: '2026-02-30' }, { review_expires_at: '' }, { review_expires_at: 42 },
    { relevant_agents: ['paid_ads_agent'] }, { relevant_agents: 'creative_director' }, { relevant_agents: [42] },
    { client_specific: true, active_client_id: 'client-b' }, { client_specific: false, active_client_id: 'client-b' }, { client_specific: null },
    { source_type: 'ai_generated' }, { source_id: null }, { source_reference: null },
    { knowledge_layer: 'unknown' }, { knowledge_layer: 'industry_specific', relevant_industries: ['legal'] },
  ]
  for (const patch of denied) assert.equal(select([card(patch)]).references.length, 0, JSON.stringify(patch))
  assert.equal(knowledge.selectDirectorKnowledge([card({ knowledge_layer: 'industry_specific' })], 'client-a', null, '2026-10-03').references.length, 0)
  assert.equal(select([card({ review_expires_at: null })]).references.length, 1, 'canonical null expiry policy retained')
})

test('local operating-day expiry and frontend/server gate parity fail closed', () => {
  assert.equal(knowledge.directorOperatingDate(new Date('2026-10-02T22:30:00Z')), '2026-10-03')
  const ctx = { agent: registry.getAgentProfile('creative_director'), activeClientId: 'client-a', mode: 'production', today: '2026-10-03' }
  for (const expiry of [null, '2026-10-03', '2026-10-02', '2026-02-30', 'garbage', 42]) {
    const eligible = retrieval.isCardRetrievable({ id: 'a', status: 'active', title: 'T', knowledgeLayer: 'universal', clientSpecific: false, activeClientId: null, sourceType: 'book', sourceId: 's', relevantAgents: ['creative_director_agent'], reviewExpiresAt: expiry, contentHash: 'a'.repeat(64), reviewedContentHash: 'a'.repeat(64) }, ctx)
    assert.equal(eligible, select([card({ review_expires_at: expiry })]).references.length === 1)
  }
})

test('current missing/downgraded/prohibited source fails closed; historical approval is not revision binding', () => {
  for (const linked_source of [null, { trust_tier: 'needs_review', source_type: 'book' }, { trust_tier: 'tier_4_low_trust', source_type: 'book' }, { trust_tier: 'unknown', source_type: 'book' }, { trust_tier: 'tier_1_primary', source_type: 'ai_generated' }, { trust_tier: 'tier_1_primary', source_type: 'book', rights_status: 'prohibited' }]) {
    assert.equal(select([card({ linked_source })]).references.length, 0)
  }
  // Characterise the existing approval gap, do not pretend this patch repairs it.
  const approved = card({ principle: 'Original reviewed wording' })
  const edited = { ...approved, principle: 'Materially changed wording', updated_at: '2026-10-03T12:00:00Z' }
  assert.equal(select([approved]).references.length, 1)
  assert.equal(select([edited]).references.length, 1)
  const gate = readFileSync('supabase/migrations/20260803090000_skill_card_review_workflow.sql', 'utf8')
  assert.match(gate, /review_status = 'approved'/)
  assert.doesNotMatch(gate, /reviewed_content_hash|approved_revision_id/)
})

test('real prompt/parser resolves stored references only from server selection, never model approval or URLs', () => {
  const selected = select([card()])
  const prompt = modes.buildIdeasPrompt({ clientName: 'Fixture client', guideExcerpt: 'Exact guide', coverageMonths: ['2026-10'], slots: [], existingTitles: [], historicalTitles: [], marketingKnowledge: selected.lines, calendar: [], research: null })
  assert.match(prompt.user, /card-a|Reviewed source, section 2|No guaranteed outcome/)
  assert.match(prompt.system, /cg_knowledge REQUIRES/)
  const raw = JSON.stringify({ ideas: [{ title: 'A client-specific idea', objective: 'Explain the verified service', hook: 'Here is the service', angle: 'Saved creative angle', evidence: [
    { kind: 'cg_knowledge', note: 'Applies the principle', cardId: 'card-a', approved: true, knowledgeReference: { title: 'FORGED' }, sourceUri: 'https://forged.example' },
    { kind: 'cg_knowledge', note: 'Invented ID', cardId: 'invented' },
    { kind: 'fresh_research', note: 'Current source', sourceUri: 'https://listed.example' },
    { kind: 'fresh_research', note: 'Unlisted', sourceUri: 'https://unlisted.example' },
  ] }] })
  const allowed = { deliverableIds: new Set(), months: new Set(['2026-10']), researchUris: new Set(['https://listed.example']), knowledgeReferences: selected.references }
  const idea = modes.parseIdeas(raw, allowed)[0]
  assert.deepEqual(idea.evidence.map(item => item.kind), ['cg_knowledge', 'inference', 'fresh_research', 'inference'])
  assert.deepEqual(idea.evidence[0].knowledgeReference, selected.references[0])
  assert.equal(idea.evidence[0].sourceUri, null)
  assert.doesNotMatch(JSON.stringify(idea), /FORGED|approved|forged\.example|unlisted\.example/)
  const noLongerSelected = modes.parseIdeas(raw, { ...allowed, knowledgeReferences: [] })[0]
  assert.equal(noLongerSelected.evidence[0].kind, 'inference')
})

test('trusted evidence survives manual save/reload and existing worker notes boundary without editing the creative angle', () => {
  const reference = select([card()]).references[0]
  const idea = { title: 'Staff title', objective: 'Staff objective', hook: 'Staff hook', audience: 'Known audience', angle: 'Human selected angle', targetMonth: '2026-10', deliverableId: null, needsConfirmation: null, evidence: [{ kind: 'cg_knowledge', note: 'Guidance applied', sourceUri: null, knowledgeReference: reference }] }
  const before = JSON.stringify(idea)
  const manual = JSON.parse(JSON.stringify(workflow.ideaToVideoInput(idea, 4, 'actor')))
  assert.equal(manual.position, 4)
  assert.equal(manual.hook, 'Staff hook')
  assert.match(manual.notes, /Human selected angle|card-a|source-a|section 2|No guaranteed outcome/)
  const worker = modes.directorIdeaPersistencePayload(idea)
  assert.match(worker.angle, /Human selected angle|card-a|section 2/)
  assert.equal(JSON.stringify(idea), before)
  const sql = readFileSync('supabase/migrations/20260922120000_system_worker_profile.sql', 'utf8')
  assert.match(sql, /nullif\(v->>'angle',''\)/)
  const editor = readFileSync('src/pages/admin/ContentGuidelineDocumentEditor.tsx', 'utf8')
  assert.match(editor, /directorKnowledgeReceipt\(item.knowledgeReference\)/)
})
