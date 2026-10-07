import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { createServer } from 'vite'

let server, modes, knowledge, edits, engagement, benchmark
const card = patch => ({ id: 'fixture-card', title: 'Verified proof guidance', status: 'active', principle: 'Use verified proof.',
  summary: 'Apply only the supported claim.', knowledge_layer: 'universal_principle', client_specific: false, active_client_id: null,
  relevant_agents: ['creative_director_agent'], source_id: 'fixture-source', source_type: 'book', source_reference: 'Fixture section 2',
  linked_source: { trust_tier: 'tier_1_primary', source_type: 'book', rights_status: 'citation_only' },
  last_reviewed_at: '2026-10-01', review_expires_at: '2026-10-08', updated_at: '2026-10-01T08:00:00Z',
  confidence_level: 'medium', evidence_label: 'source_backed', safe_claim: 'Creative guidance, not a forecast',
  prohibited_overclaim: 'No guaranteed growth', ...patch })
const select = cards => knowledge.selectDirectorKnowledge(cards, 'fixture-client', null, '2026-10-07')
const ideasPrompt = extra => modes.buildIdeasPrompt({ clientName: 'Neutral fixture', guideExcerpt: 'Verified service: repairs. No prices or offers supplied.',
  coverageMonths: ['2026-10'], slots: [], existingTitles: [], historicalTitles: [], marketingKnowledge: [], calendar: [], research: null, ...extra })
const target = { id: 'fixture-video', position: 1, title: 'Chosen concept', objective: 'Explain service', hook: 'Human hook',
  notes: '15 seconds; text-only.', platform: 'Instagram Reels', format: 'text-only', updatedAt: '2026-10-07T08:00:00Z',
  script: 'Human script', shotBreakdown: '1. Door\n2. Product', targetMonth: '2026-10', deliverableLabel: null }
before(async () => {
  server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  modes = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorModes.ts')
  knowledge = await server.ssrLoadModule('/supabase/functions/suggest-content-videos/directorKnowledge.ts')
  edits = await server.ssrLoadModule('/src/lib/contentDirectorEdits.ts')
  engagement = await server.ssrLoadModule('/supabase/functions/_shared/metaPostEngagement.ts')
  benchmark = await server.ssrLoadModule('/src/lib/contentDirectorBenchmark.ts')
})
after(async () => { await server?.close() })

test('duration: actual prompt carries saved brief, no imposed spoken duration', () => {
  const prompt = modes.buildDevelopPrompt({ clientName: 'Neutral fixture', guideExcerpt: 'Repairs', targets: [target], marketingKnowledge: [] })
  assert.match(prompt.user, /15 seconds; text-only/); assert.doesNotMatch(prompt.system, /30-75/)
})
test('additive_caption: actual human creative contract requires a layer, not artwork repetition', () => {
  assert.match(ideasPrompt().system, /Do not restate the artwork/)
  assert.match(ideasPrompt().system, /Add a layer/)
})
test('claim_preserving_language: actual prompt retains exact factual limit and language-fit rule', () => {
  const prompt = ideasPrompt({ guideExcerpt: 'Repairs only. English/Afrikaans adaptation; no discount supplied.' })
  assert.match(prompt.user, /Repairs only/); assert.match(prompt.system, /Never invent client facts/)
  assert.match(prompt.system, /Afrikaans\/English/)
})
test('distinct_ideas: real parser removes repeated title, without claiming semantic concept diversity', () => {
  const parsed = modes.parseIdeas(JSON.stringify({ ideas: [
    { title: 'Inspect the repair', objective: 'Show repair', hook: 'Inspect' },
    { title: 'inspect the repair', objective: 'Repeated', hook: 'Again' },
    { title: 'Customer decision', objective: 'Choose service', hook: 'Ask' },
  ] }), { deliverableIds: new Set(), months: new Set(['2026-10']), researchUris: new Set() })
  assert.equal(parsed.length, 2)
})
test('targeted_edit: accepted patch contains CTA only and stale proposal fails closed', () => {
  const [proposal] = modes.parseDevelopments(JSON.stringify({ developments: [{ videoId: target.id, cta: 'Ask about repairs', script: 'Unrequested' }] }), [target], ['cta'])
  const video = { id: target.id, updated_at: target.updatedAt, script: target.script, hook: target.hook, shot_breakdown: target.shotBreakdown }
  assert.deepEqual(edits.developmentPatch(video, proposal, 'replace').patch, { cta: 'Ask about repairs' })
  assert.ok(edits.developmentPatch({ ...video, updated_at: '2026-10-07T09:00:00Z' }, proposal, 'replace').error)
})
test('eligibility: actual selector excludes expired/unreviewed/wrong-client/unrelated guidance', () => {
  assert.equal(select([card({})]).references.length, 1)
  for (const patch of [{ review_expires_at: '2026-10-06' }, { status: 'needs_review' },
    { client_specific: true, active_client_id: 'another-client' }, { relevant_agents: ['paid_ads_agent'] }]) {
    assert.equal(select([card(patch)]).references.length, 0)
  }
})
test('reference_integrity: actual parser resolves only server-selected provenance', () => {
  const references = select([card({})]).references
  const parsed = modes.parseIdeas(JSON.stringify({ ideas: [{ title: 'Proof', objective: 'Explain repairs', hook: 'Look', evidence: [
    { kind: 'cg_knowledge', cardId: 'fixture-card', note: 'Supported guidance' },
    { kind: 'cg_knowledge', cardId: 'forged', note: 'Forged claim', sourceUri: 'https://invalid.example', approved: true },
  ] }] }), { deliverableIds: new Set(), months: new Set(), researchUris: new Set(), knowledgeReferences: references })
  assert.equal(parsed[0].evidence[0].knowledgeReference.source_id, 'fixture-source')
  assert.equal(parsed[0].evidence[1].kind, 'inference'); assert.equal(parsed[0].evidence[1].knowledgeReference, undefined)
})
test('review_revision: characterize unresolved historical-review gap, never certify it repaired', () => {
  const edited = card({ principle: 'Materially changed after old approval', updated_at: '2026-10-07T08:00:00Z' })
  assert.equal(select([edited]).references.length, 1, 'Known gap remains observable')
  const receipt = benchmark.creativeBenchmarkReceipt({ codeSha: 'fixture', promptHashes: {}, fixtureVersion: 'v1', model: null, selectedCardRevisions: [] }, true)
  assert.equal(receipt.scenarios.find(row => row.id === 'review_revision').contractCheck, 'characterized_gap')
})
test('uncertain_platform: actual prompt cannot label stored guidance fresh platform evidence', () => {
  assert.match(ideasPrompt().system, /not.*current platform rule/)
  assert.match(ideasPrompt().user, /NOT PERFORMED/)
})
test('unsupported_uplift: selected warning survives actual projection, not a measured forecast', () => {
  const projected = select([card({})])
  assert.match(projected.lines[0], /No guaranteed growth/)
  assert.match(ideasPrompt({ marketingKnowledge: projected.lines }).system, /not.*forecast/)
})
test('partial_statistics: actual evidence preserves observed zero, missing component and age', () => {
  const at = '2026-10-01T08:00:00Z'
  const partial = engagement.buildMetaPostEngagementEvidence('facebook', { reactions: 4, comments: 0 }, at)
  assert.equal(partial.complete_total, null); assert.equal(partial.known_subtotal, 4)
  assert.deepEqual(partial.coverage, { observed: 2, required: 3 })
  assert.equal(partial.observed_at, at)
})
test('scoped_learning: model observations never become activated knowledge in the receipt', () => {
  const receipt = benchmark.creativeBenchmarkReceipt({ codeSha: 'fixture', promptHashes: {}, fixtureVersion: 'v1', model: null, selectedCardRevisions: [] }, true)
  assert.equal(receipt.productionApprovalOrPublication, false)
  assert.equal(receipt.releaseDecision, 'blocked_pending_human_semantic_and_runtime_acceptance')
  for (const scenario of receipt.scenarios) {
    assert.equal(scenario.modelExecution, 'not_run'); assert.equal(scenario.humanAssessment, 'not_run')
    assert.equal(scenario.semanticAcceptance, 'not_established')
  }
})
test('complete twelve-task receipt never substitutes zero cost/time or one quality score for missing observations', () => {
  const receipt = benchmark.creativeBenchmarkReceipt({ codeSha: 'fixture', promptHashes: {}, fixtureVersion: 'v1', model: null, selectedCardRevisions: [] }, false)
  assert.equal(receipt.scenarios.length, 12)
  assert.equal(new Set(receipt.scenarios.map(row => row.id)).size, 12)
  assert.equal(receipt.totalMeteredCost, null); assert.equal(receipt.costPerAcceptedOutput, null)
  assert.ok(receipt.scenarios.every(row => row.contractCheck === 'failed' && row.handsOnCorrectionSeconds === null))
  assert.equal(Object.hasOwn(receipt, 'qualityScore'), false)
})
