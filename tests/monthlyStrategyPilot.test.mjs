import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, test } from 'node:test'
import { createServer } from 'vite'
import { authorizesMonthlyStrategyPilot, monthlyStrategyInvocationAuth, readMonthlyStrategyPilotGrant } from '../supabase/functions/_shared/monthlyStrategyPilot.ts'

const server = await createServer({
  configFile: false, server: { middlewareMode: true, hmr: false },
  optimizeDeps: { noDiscovery: true },
})
const { monthlyStrategyPilotPromptBytes, selectMonthlyStrategyPilotRoute } = await server.ssrLoadModule('/supabase/functions/_shared/monthlyStrategyModel.ts')
const { routeAiChat, estimatedRouteWithinCap } = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/ai-router.ts')
after(() => server.close())

const clientId = '11111111-1111-4111-8111-111111111111'
const otherClientId = '22222222-2222-4222-8222-222222222222'
const now = new Date('2026-10-11T10:00:00Z')
const route = (id, tier, pricing = {}) => ({
  id, capability: 'text', provider: 'openai', model: 'pilot-model',
  tier, priority: 1, enabled: true, pricing_currency: 'USD',
  input_per_million_micros: 100_000, output_per_million_micros: 400_000,
  audio_per_minute_micros: null, request_cost_micros: 0, fx_zar_micros: 18_000_000,
  ...pricing,
})

test('short-lived pilot grant is exact-client, positive-cap and fleet-off only', () => {
  const grant = readMonthlyStrategyPilotGrant(clientId, '20.00', '2026-10-11T11:00:00Z', now)
  assert.equal(grant?.maxZarMicros, 20_000_000)
  assert.equal(authorizesMonthlyStrategyPilot(grant, clientId, false), true)
  assert.equal(authorizesMonthlyStrategyPilot(grant, otherClientId, false), false)
  assert.equal(authorizesMonthlyStrategyPilot(grant, clientId, true), false)
  for (const [id, cap, expiry] of [
    ['', '20', '2026-10-11T11:00:00Z'],
    [clientId, '0', '2026-10-11T11:00:00Z'],
    [clientId, '101', '2026-10-11T11:00:00Z'],
    [clientId, 'not-money', '2026-10-11T11:00:00Z'],
    [clientId, '20', '2026-10-11T10:00:00Z'],
    [clientId, '20', '2026-10-11T12:00:01Z'],
    [clientId, '20', '2026-10-11 11:00'],
  ]) assert.equal(readMonthlyStrategyPilotGrant(id, cap, expiry, now), null)
})

test('one-use pilot credential needs service role and cannot become a worker credential', () => {
  const base = {
    serviceKey: 'service-role-secret', suppliedBearer: 'Bearer service-role-secret',
    workerToken: 'w'.repeat(32), suppliedWorkerToken: '',
    pilotToken: 'p'.repeat(32), suppliedPilotToken: 'p'.repeat(32),
  }
  assert.equal(monthlyStrategyInvocationAuth(base), 'pilot')
  assert.equal(monthlyStrategyInvocationAuth({ ...base, suppliedWorkerToken: base.workerToken, suppliedPilotToken: '' }), 'worker')
  assert.equal(monthlyStrategyInvocationAuth({ ...base, suppliedBearer: 'Bearer wrong' }), null)
  assert.equal(monthlyStrategyInvocationAuth({ ...base, suppliedPilotToken: 'wrong' }), null)
  assert.equal(monthlyStrategyInvocationAuth({ ...base, pilotToken: 'short', suppliedPilotToken: 'short' }), null)
  assert.equal(monthlyStrategyInvocationAuth({ ...base, pilotToken: '', suppliedPilotToken: '' }), null)
  assert.equal(monthlyStrategyInvocationAuth({ ...base, workerToken: '', suppliedPilotToken: '' }), null)
})

test('one configured-price route must fit the cap before any provider reservation', () => {
  assert.equal(monthlyStrategyPilotPromptBytes('é', '😀'), 6)
  const strong = route('strong', 'strong', { request_cost_micros: 2_000_000 })
  const cheap = route('cheap', 'cheap')
  const configured = new Set(['openai'])
  assert.equal(selectMonthlyStrategyPilotRoute([strong, cheap], 4_000, 50_000_000, configured).routeId, 'strong')
  assert.equal(selectMonthlyStrategyPilotRoute([strong, cheap], 4_000, 1_000_000, configured).routeId, 'cheap')
  assert.equal(selectMonthlyStrategyPilotRoute([strong, cheap], 4_000, 50_000_000, configured, 'cheap').routeId, 'cheap')
  assert.throws(() => selectMonthlyStrategyPilotRoute([strong, cheap], 4_000, 50_000_000, configured, 'missing'), /COST_CAP_UNAVAILABLE/)
  assert.equal(selectMonthlyStrategyPilotRoute([
    route('unconfigured-strong', 'strong', { provider: 'gemini' }),
    route('configured-cheap', 'cheap', { provider: 'openrouter' }),
  ], 4_000, 50_000_000, new Set(['openrouter'])).routeId, 'configured-cheap')
  assert.throws(() => selectMonthlyStrategyPilotRoute([strong], 4_000, 1_000_000, configured), /COST_CAP_UNAVAILABLE/)
  assert.throws(() => selectMonthlyStrategyPilotRoute([strong], 4_000, 50_000_000, new Set(['openrouter'])), /COST_CAP_UNAVAILABLE/)
  assert.throws(() => selectMonthlyStrategyPilotRoute([route('unknown', 'strong', { fx_zar_micros: null })], 4_000, 50_000_000, configured), /COST_CAP_UNAVAILABLE/)
  assert.throws(() => selectMonthlyStrategyPilotRoute([route('negative', 'strong', { output_per_million_micros: -1 })], 4_000, 50_000_000, configured), /COST_CAP_UNAVAILABLE/)
  assert.throws(() => selectMonthlyStrategyPilotRoute([cheap], 128_000, 50_000_000, configured), /COST_CAP_UNAVAILABLE/)
  assert.throws(() => selectMonthlyStrategyPilotRoute([cheap], -1, 50_000_000, configured), /COST_CAP_UNAVAILABLE/)
})

test('fixed OpenRouter GPT-4.1 worst-case token quote stays below the authorised R25', () => {
  const paid = route('fixed-paid', 'cheap', {
    provider: 'openrouter', model: 'openai/gpt-4.1',
    input_per_million_micros: 2_000_000, output_per_million_micros: 8_000_000,
  })
  const selected = selectMonthlyStrategyPilotRoute(
    [paid], 126_976, 25_000_000, new Set(['openrouter']), 'fixed-paid',
  )
  assert.equal(selected.routeId, 'fixed-paid')
  assert.equal(selected.costQuoteInputTokens, 128_000)
  assert.ok(selected.estimatedMaxZarMicros > 0 && selected.estimatedMaxZarMicros < 25_000_000)
})

test('a route repriced after the pilot quote is rejected before usage reservation or provider call', async () => {
  const selected = selectMonthlyStrategyPilotRoute([route('one', 'strong')], 4_000, 1_000_000, new Set(['openai']))
  const repriced = route('one', 'strong', { request_cost_micros: 2_000_000 })
  assert.equal(estimatedRouteWithinCap(repriced, selected.costQuoteInputTokens, 2_400, 1_000_000), null)
  const client = {
    from(table) {
      assert.equal(table, 'ai_provider_routes')
      return { select() { return this }, eq() { return this }, order() { return Promise.resolve({ data: [repriced], error: null }) } }
    },
    rpc() { throw new Error('USAGE_RESERVATION_MUST_NOT_RUN') },
  }
  await assert.rejects(
    routeAiChat([{ role: 'user', content: 'Exact-client pilot prompt' }], {
      usageClient: client, feature: 'monthly_strategy', action: 'pilot_generate_next_month_draft',
      actorId: clientId, idempotencyKey: 'one-pilot', fingerprint: 'one-source',
      complexity: 'complex', maxOutputTokens: 2_400, routeId: selected.routeId,
      maxEstimatedZarMicros: 1_000_000, costQuoteInputTokens: selected.costQuoteInputTokens,
    }),
    /AI_REQUEST_COST_CAP_UNAVAILABLE/,
  )
})

test('pilot is not a scheduler action or a global generation-flag bypass', () => {
  const handler = readFileSync(new URL('../supabase/functions/monthly-strategy-autopilot/index.ts', import.meta.url), 'utf8')
  const worker = readFileSync(new URL('../supabase/functions/background-worker/index.ts', import.meta.url), 'utf8')
  const model = readFileSync(new URL('../supabase/functions/_shared/monthlyStrategyModel.ts', import.meta.url), 'utf8')
  assert.match(handler, /pilot_generate_next_month/)
  assert.match(handler, /authorizesMonthlyStrategyPilot\(pilotGrant, clientId, generationEnabled\)/)
  assert.match(handler, /monthlyStrategyInvocationAuth\(/)
  assert.match(handler, /MONTHLY_STRATEGY_PILOT_ROUTE_ID/)
  assert.match(handler, /pilotRouteId && !UUID_RE\.test\(pilotRouteId\)/)
  assert.match(handler, /authMode === 'pilot' && payload\.action !== 'pilot_generate_next_month'/)
  assert.match(handler, /monthly-strategy-pilot-auth-denied/)
  assert.doesNotMatch(worker, /pilot_generate_next_month/)
  assert.match(model, /routeId: pilotRoute\.routeId/)
  assert.match(model, /monthly-strategy-pilot:\$\{input\.clientId\}:\$\{input\.strategyMonth\}:\$\{input\.pilot\.grantId\}/)
})
