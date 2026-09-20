import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server, build
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true }, appType: 'custom' })
  ;({ buildCreativeBriefIntelligence: build } = await server.ssrLoadModule('/src/lib/creativeBriefIntelligence.ts'))
})
after(async () => { await server?.close() })

const base = () => ({
  clientId: 'client-a', month: '2026-09', deliverableId: 'video-a',
  deliverable: { id: 'video-a', client_id: 'client-a', month: '2026-09-01', deliverable_type: 'video', title: 'Video A' },
  strategy: { id: 'strategy-a', version: 4, client_id: 'client-a', strategy_month: '2026-09-01', workflow_status: 'approved', strategy_data: {
    clientDirection: ['Show verified process'], strategyDrivers: ['Answer buyer questions'], clientActionsRequired: [],
    actionPlan: { professional_video: { enabled: true, items: ['Film actual process'], notes: '' } },
  } },
  cards: [], draft: { objective: '', hook: '', cta: '', shot_breakdown: '', requirements: '' }, today: '2026-09-20',
})
const card = (overrides = {}) => ({ id: 'card-a', title: 'Evidence card', status: 'active', client_specific: false, active_client_id: null,
  relevant_agents: ['content_planner'],
  review_expires_at: '2026-09-20', how_to_apply: ['Test a process demonstration'], prohibited_overclaim: 'Do not promise results',
  safe_claim: 'Process can be shown', source_reference: 'Source 1', confidence_level: 'medium', evidence_label: 'practitioner', ...overrides })

test('exact client/month/deliverable and approved shared cards produce deterministic sourced guidance', () => {
  const input = base(); input.cards = [card()]
  const result = build(input)
  assert.deepEqual(result, build(input))
  assert.equal(result.ready, true)
  assert.equal(result.researchAvailable, true)
  assert.match(result.sourceBackedGuidance.join(' '), /Test a process demonstration/)
  assert.match(result.warnings.join(' '), /Do not promise results/)
  assert.equal(result.sources[0].id, 'card-a')
  assert.equal(result.sources[0].source_reference, 'Source 1')
  assert.deepEqual(result.provenance, { deliverableId: 'video-a', strategy: { id: 'strategy-a', version: 4, status: 'approved' } })
  assert.equal(input.draft.hook, '')
})

test('inactive, client-specific and expired cards never influence output', () => {
  const input = base(); input.cards = [card({ status: 'draft' }), card({ client_specific: true }), card({ active_client_id: 'client-b' }), card({ review_expires_at: '2026-09-19' })]
  const result = build(input)
  assert.equal(result.researchAvailable, false)
  assert.equal(result.sources.length, 0)
  assert.match(result.needsConfirmation.join(' '), /Approved research unavailable/)
})

test('mismatched strategy is ignored and mismatched deliverable fails closed', () => {
  const input = base(); input.strategy.client_id = 'client-b'
  assert.doesNotMatch(build(input).strategyAlignment.join(' '), /Show verified process/)
  input.deliverable.month = '2026-08-01'
  assert.equal(build(input).ready, false)
  assert.equal(build(input).sources.length, 0)
})

test('unrelated active shared cards are excluded before deterministic selection', () => {
  const input = base()
  input.cards = [
    card({ id: 'a-seo', relevant_agents: ['research_librarian'], how_to_apply: ['SEO-only advice'] }),
    card({ id: 'b-report', relevant_agents: ['client_report_agent'], how_to_apply: ['Report-only advice'] }),
    card({ id: 'z-creative', relevant_agents: ['creative_director_agent'], how_to_apply: ['Film a contrast'] }),
  ]
  const result = build(input)
  assert.deepEqual(result.sources.map(source => source.id), ['z-creative'])
  assert.match(result.sourceBackedGuidance.join(' '), /Film a contrast/)
  assert.doesNotMatch(result.sourceBackedGuidance.join(' '), /SEO-only|Report-only/)
})

test('creative aliases and canonical specialist cards select in deterministic ID order', () => {
  const input = base()
  input.cards = [card({ id: 'z', relevant_agents: ['creative_director_agent'] }), card({ id: 'b', relevant_agents: ['copywriting_agent'] }),
    card({ id: 'a', relevant_agents: ['social_media_strategist'] })]
  assert.deepEqual(build(input).sources.map(source => source.id), ['a', 'b', 'z'])
  assert.deepEqual(build(input), build({ ...input, cards: [...input.cards].reverse() }))
})

test('draft context is distinct from backed guidance and unknown audience/proof', () => {
  const input = base()
  input.draft = { objective: 'Draft objective', hook: 'Draft hook', cta: 'Draft CTA', shot_breakdown: 'Draft shot', requirements: '' }
  const result = build(input)
  assert.equal(result.currentDraft.hook, 'Draft hook')
  assert.equal(result.currentDraft.cta, 'Draft CTA')
  assert.equal(result.audienceIntent.length, 0)
  assert.equal(result.proofToCapture.length, 0)
  assert.doesNotMatch(JSON.stringify([result.strategyAlignment, result.creativeJob, result.sourceBackedGuidance]), /Draft hook|Draft CTA|Draft shot/)
  assert.match(result.needsConfirmation.join(' '), /Audience, intent/)
  assert.match(result.needsConfirmation.join(' '), /Proof to capture/)
})
