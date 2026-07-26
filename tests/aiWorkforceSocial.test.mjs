import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8')
const INDEX = read('../supabase/functions/cg-assistant-chat/index.ts')
const MIG_A = read('../supabase/phase-25a-social-platform-completion.sql')
const MIG_D = read('../supabase/phase-25d-social-knowledge.sql')

let server, reg, sa
before(async () => {
  server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: 'custom' })
  reg = await server.ssrLoadModule('/src/features/ai-workforce/agents/agentRegistry.ts')
  sa = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/skilledAgents.ts')
})
after(async () => { await server?.close() })

const pk = o => ({
  id: 'k1', title: 'T', principle: 'P', application: null, limitations: null,
  knowledge_state: 'verified_current', channel: 'both', evidence_strength: 'strong',
  last_verified_at: '2026-07-25', expires_at: null, platform_slug: 'instagram', surface_key: 'reels', source_url: 'https://x', ...o,
})

// ── Social Media Strategist agent ─────────────────────────────────────────────
test('Social Media Strategist is a distinct 10th agent, active-client isolated', () => {
  assert.equal(reg.AI_WORKFORCE_AGENTS.length, 10)
  const a = reg.getAgentProfile('social_media_strategist')
  assert.ok(a)
  assert.equal(a.clientIsolation, 'active_client_only')
  assert.equal(a.canActivateCards, false)
  assert.equal(a.mustCite, true)
  // distinct output contract covering organic/paid split, testing and measurement
  assert.ok(a.outputContract.includes('organic_paid_split'))
  assert.ok(a.outputContract.includes('testing_plan'))
  assert.ok(a.outputContract.includes('measurement_plan'))
  assert.ok(a.outputContract.includes('platform_native_adaptation'))
})

test('Deno contract mirrors the strategist; social-aware set excludes research/historical', () => {
  assert.ok(sa.AGENT_CONTRACTS.social_media_strategist)
  assert.equal(Object.keys(sa.AGENT_CONTRACTS).length, 10)
  assert.ok(sa.SOCIAL_AWARE_AGENTS.has('social_media_strategist'))
  assert.ok(sa.SOCIAL_AWARE_AGENTS.has('content_planner'))
  assert.ok(!sa.SOCIAL_AWARE_AGENTS.has('research_librarian'))
  assert.ok(!sa.SOCIAL_AWARE_AGENTS.has('historical_advertising_analyst'))
})

// ── Platform knowledge currency gate ──────────────────────────────────────────
const today = '2026-07-25'
test('production sees only current, non-expired platform knowledge', () => {
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'verified_current' }), 'production', today), true)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'observed_current' }), 'production', today), true)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'experimental' }), 'production', today), false)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'disputed' }), 'production', today), false)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'stale' }), 'production', today), false)
})

test('expired knowledge is excluded even if verified', () => {
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'verified_current', expires_at: '2020-01-01' }), 'production', today), false)
})

test('admin research may preview experimental but never retired/stale', () => {
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'experimental' }), 'admin_research', today), true)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'disputed' }), 'admin_research', today), true)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'retired' }), 'admin_research', today), false)
  assert.equal(sa.isPlatformKnowledgeCurrent(pk({ knowledge_state: 'stale' }), 'admin_research', today), false)
})

// ── Assistant wiring (index.ts) ───────────────────────────────────────────────
test('index.ts wires platform retrieval, currency gate and combined insufficiency', () => {
  assert.match(INDEX, /SOCIAL_AWARE_AGENTS\.has\(agentKey\)\s*&&\s*platformSlug/)
  assert.match(INDEX, /isPlatformKnowledgeCurrent\(row, mode, today\)/)
  assert.match(INDEX, /platform_knowledge_items/)
  // insufficient only when BOTH cards and platform knowledge are empty
  assert.match(INDEX, /plan\.insufficient\s*&&\s*platformKnowledge\.length === 0/)
  // organic/paid stays distinct in the agent instruction
  assert.match(INDEX, /Keep organic and paid distinct/)
  assert.match(INDEX, /platform_knowledge id=/)
})

// ── Migration invariants ──────────────────────────────────────────────────────
test('phase-25a adds organic/paid, evidence strength, change log and refresh queue', () => {
  assert.match(MIG_A, /surface_type text not null default 'organic'/)
  assert.match(MIG_A, /channel text not null default 'organic'/)
  assert.match(MIG_A, /evidence_strength text not null/)
  assert.match(MIG_A, /create table if not exists public\.platform_knowledge_change_log/)
  assert.match(MIG_A, /create or replace view public\.platform_knowledge_refresh_queue/)
})

test('phase-25d seeds every knowledge item as experimental (nothing staff-visible on seed)', () => {
  // The seed sets knowledge_state literally to 'experimental' and never to verified/observed.
  assert.match(MIG_D, /'experimental', v\.confidence/)
  assert.doesNotMatch(MIG_D, /'verified_current', v\.confidence/)
  // metric definitions cite an official source (support.google.com)
  assert.match(MIG_D, /support\.google\.com\/youtube\/answer\/9314486/)
})
