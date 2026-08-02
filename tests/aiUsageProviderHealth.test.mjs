import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('../supabase/migrations/20260801200000_ai_usage_provider_health.sql')
const router = read('../supabase/functions/cg-assistant-chat/ai-router.ts')
const usage = read('../supabase/functions/_shared/aiUsage.ts')
const assistant = read('../supabase/functions/cg-assistant-chat/index.ts')
const app = read('../src/App.tsx')
const navigation = read('../src/pages/admin/adminNavigation.ts')
const importHealth = read('../src/pages/admin/ImportHealthPage.tsx')
const dashboard = read('../src/pages/admin/AiUsageHealthPage.tsx')
const dashboardData = read('../src/lib/aiUsageHealth.ts')
const providerSecrets = read('../supabase/functions/_shared/providerSecrets.ts')
const voiceTranscribe = read('../supabase/functions/_shared/voiceTranscribe.ts')
const meetingDebrief = read('../supabase/functions/meeting-debrief/index.ts')
const contentRunDebrief = read('../supabase/functions/content-run-voice-debrief/index.ts')
const voiceDebriefDocs = read('../docs/content-run-voice-debrief.md')
const routeScopedReservation = read('../supabase/migrations/20260802120000_ai_health_route_scoped_reservations.sql')
const assistantClient = read('../src/lib/assistant.ts')

let server
let selectRoutes
let estimateRouteCost
let routeAiChat
let loadRecentlyDegradedRouteIds
let finalizeAiUsageWithReplay
let getProviderDisplayStatus
let isCurrentDashboardRequest
let getProviderDiagnostics
let resolveProviderSecret
let configuredProviderNames

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  ;({ selectRoutes, routeAiChat, getProviderDiagnostics } = await server.ssrLoadModule('/supabase/functions/cg-assistant-chat/ai-router.ts'))
  ;({ estimateRouteCost, loadRecentlyDegradedRouteIds, finalizeAiUsageWithReplay } = await server.ssrLoadModule('/supabase/functions/_shared/aiUsage.ts'))
  ;({ getProviderDisplayStatus, isCurrentDashboardRequest } = await server.ssrLoadModule('/src/lib/aiUsageHealth.ts'))
  ;({ resolveProviderSecret, configuredProviderNames } = await server.ssrLoadModule('/supabase/functions/_shared/providerSecrets.ts'))
})

after(async () => { await server.close() })

const route = (provider, tier, priority, enabled = true, pricing = {}) => ({
  id: `${provider}-${tier}`,
  capability: 'text',
  provider,
  model: `${provider}-model`,
  tier,
  priority,
  enabled,
  pricing_currency: 'USD',
  input_per_million_micros: 100_000,
  output_per_million_micros: 400_000,
  audio_per_minute_micros: null,
  request_cost_micros: 0,
  fx_zar_micros: 18_000_000,
  ...pricing,
})

test('canonical AI tables force RLS and expose active-admin reads only', () => {
  for (const table of ['ai_provider_routes', 'ai_monthly_budgets', 'ai_usage_requests', 'ai_usage_attempts', 'ai_provider_health_observations']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`))
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`))
    assert.match(sql, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
  }
  assert.match(sql, /p\.id = auth\.uid\(\) and p\.is_active and p\.role = 'admin'/)
  assert.doesNotMatch(sql, /for (insert|update|delete|all) to authenticated/i)
})

test('usage schema contains no prompt, transcript, provider key, or raw response payload', () => {
  const tables = sql.slice(sql.indexOf('create table if not exists public.ai_provider_routes'), sql.indexOf('-- Short-lived idempotency payloads'))
  assert.doesNotMatch(tables, /\b(prompt|transcript|api_key|secret|raw_response|response_body|request_body)\b/i)
  assert.match(tables, /fingerprint text not null/)
  assert.match(tables, /cost_source text not null default 'estimated'/)
})

test('admin RPCs explicitly verify an active profiles.role admin', () => {
  for (const name of ['ai_admin_dashboard_summary', 'ai_admin_usage_detail', 'ai_admin_usage_aggregates', 'ai_admin_set_budget', 'ai_admin_update_provider_routes']) {
    const start = sql.indexOf(`function public.${name}`)
    const body = sql.slice(start, sql.indexOf('\n$$;', start) + 4)
    assert.match(body, /p\.id = auth\.uid\(\) and p\.is_active and p\.role = 'admin'/, name)
    assert.match(body, /Active admin access required/, name)
  }
  assert.match(sql, /grant execute on function public\.ai_admin_dashboard_summary\(date\) to authenticated/)
  assert.match(sql, /grant execute on function public\.ai_admin_usage_aggregates\(date\) to authenticated/)
  assert.match(sql, /grant execute on function public\.ai_admin_update_provider_routes\(jsonb\) to authenticated/)
  assert.match(sql, /'provider_health'/)
})

test('dashboard route is strictly admin nested and has no separate navigation item', () => {
  const adminGuard = app.indexOf('<Route element={<RequireAdmin />}>')
  const route = app.indexOf('path="/admin/ai-health"')
  const adminGuardEnd = app.indexOf('</Route>', app.indexOf('path="/admin/marketing-library"'))
  assert.ok(route > adminGuard && route < adminGuardEnd, 'AI health route is inside RequireAdmin')
  assert.doesNotMatch(navigation, /to: '\/admin\/ai-health'/)
  assert.match(navigation, /label: 'System Health'[\s\S]*activePaths: \['\/admin\/import-health', '\/admin\/ai-health'\]/)
  assert.match(importHealth, /to="\/admin\/ai-health"/)
})

test('aggregate RPC computes complete live totals server-side without the detail cap', () => {
  const start = sql.indexOf('function public.ai_admin_usage_aggregates')
  const end = sql.indexOf('\n$$;', start)
  const body = sql.slice(start, end)
  assert.match(body, /from public\.ai_usage_requests/)
  assert.match(body, /join public\.profiles p on p\.id = r\.actor_id/)
  assert.match(body, /p\.full_name/)
  assert.match(body, /'daily'/)
  assert.match(body, /'monthly'/)
  assert.match(body, /'users'/)
  assert.match(body, /'features'/)
  assert.match(body, /'providers'/)
  assert.doesNotMatch(body, /limit\s+(500|least)/i)
  assert.match(dashboardData, /supabase\.rpc\('ai_admin_usage_aggregates'/)
  assert.doesNotMatch(dashboardData, /ai_admin_usage_detail/)
})

test('aggregate preserves original currency, separate ZAR, and null unknown telemetry', () => {
  const start = sql.indexOf('function public.ai_admin_usage_aggregates')
  const body = sql.slice(start, sql.indexOf('\n$$;', start))
  assert.match(body, /a\.cost_currency as currency/)
  assert.match(body, /sum\(a\.estimated_provider_cost_micros\)/)
  assert.match(body, /sum\(a\.estimated_zar_cost_micros\)/)
  assert.match(body, /unknown_input_attempts/)
  assert.match(body, /unknown_audio_attempts/)
  assert.match(body, /unknown_cost_attempts/)
  assert.doesNotMatch(body, /coalesce\(sum\(a\.(input_tokens|output_tokens|audio_seconds|estimated_zar_cost_micros)\),\s*0\)/)
  assert.match(dashboard, /Original estimated currency is preserved/)
  assert.match(dashboard, /Unknown/)
})

test('dashboard exposes ordered route health and only masked configuration diagnostics', () => {
  assert.match(sql, /'runtime_status', case[\s\S]*'healthy'[\s\S]*'degraded'[\s\S]*'unavailable'[\s\S]*'unknown'/)
  assert.match(sql, /order by route\.capability, route\.tier, route\.priority/)
  assert.match(dashboard, /Configured \(masked\)/)
  assert.match(dashboard, /Test configured text routes/)
  assert.match(dashboard, /Test configured transcription routes/)
  assert.match(dashboard, /diagnosticsByRoute/)
  assert.match(dashboard, /Missing \(optional\)/)
  assert.match(dashboard, /Authentication failed/)
  assert.match(dashboard, /Temporary outage/)
  assert.match(assistant, /message: 'Health check completed\.'/)
  assert.match(assistant, /diagnosticsVersion: 2/)
  assert.doesNotMatch(assistant.slice(assistant.indexOf('async function handleProviderTest'), assistant.indexOf('// ── Skilled-agent mode')), /message: result\.content/)
  assert.doesNotMatch(dashboard, /prompt|api[_ ]?key|authorization|raw response/i)
})

test('budget editor uses optimistic versioning and renders hard protection states', () => {
  assert.match(dashboardData, /p_expected_version: input\.expectedVersion/)
  assert.match(dashboard, /expectedVersion: data\.budget\?\.version \?\? 0/)
  assert.doesNotMatch(dashboardData, /expectedVersion: number \| null/)
  assert.match(dashboard, /changed in another session/)
  assert.match(dashboard, /Warning threshold reached/)
  assert.match(dashboard, /Soft limit exceeded/)
  assert.match(dashboard, /Hard limit reached/)
  assert.match(dashboard, /New metered requests are denied before a provider call/)
  assert.match(sql, /AI budget version conflict/)
})

test('dashboard has responsive loading, error, empty, refresh, touch and semantic data states', () => {
  assert.match(dashboard, /LoadingState/)
  assert.match(dashboard, /AI health could not be loaded/)
  assert.match(dashboard, /No metered usage this month/)
  assert.match(dashboard, />Refresh</)
  assert.match(dashboard, /min-h-11/)
  assert.match(dashboard, /overflow-x-auto/)
  assert.match(dashboard, /<table/)
  assert.match(dashboard, /<caption/)
  assert.match(dashboard, /scope="col"/)
  assert.match(dashboard, /scope="row"/)
  assert.match(dashboard, /role="img"/)
})

test('dashboard invalidates stale loads and reports complete or partial telemetry without zeroing unknowns', () => {
  assert.match(dashboard, /loadSequenceRef/)
  assert.match(dashboard, /sequence !== loadSequenceRef\.current/)
  assert.match(dashboard, /setData\(null\)/)
  assert.match(dashboard, /Complete coverage/)
  assert.match(dashboard, /Partial coverage/)
  assert.match(dashboard, /At least/)
  assert.match(dashboard, /N\/A: no eligible/)
  assert.match(dashboard, /Unknown .* telemetry for all/)
  assert.doesNotMatch(dashboard, /NaN/)
  assert.match(dashboard, /Skipped/)
  assert.match(dashboard, /Retries/)
  assert.match(dashboard, /Denied/)
})

test('budget saves and health checks cannot reload an obsolete month or invalidate a newer load', () => {
  assert.equal(isCurrentDashboardRequest({ month: '2026-08', loadSequence: 4 }, '2026-08', 4), true)
  assert.equal(isCurrentDashboardRequest({ month: '2026-07', loadSequence: 4 }, '2026-08', 4), false)
  assert.equal(isCurrentDashboardRequest({ month: '2026-08', loadSequence: 4 }, '2026-08', 5), false)
  assert.match(dashboard, /if \(selectedMonth !== monthRef\.current\) return\s+const sequence = \+\+loadSequenceRef\.current/)
  assert.equal((dashboard.match(/isCurrentDashboardRequest\(request, monthRef\.current, loadSequenceRef\.current\)/g) ?? []).length, 6)
  assert.match(dashboard, /operationSequence === budgetSequenceRef\.current\) setSavingBudget\(false\)/)
  assert.match(dashboard, /operationSequence === healthSequenceRef\.current\) setChecking\(false\)/)
  assert.match(dashboard, /finally \{\s+if \(sequence === loadSequenceRef\.current && selectedMonth === monthRef\.current\) setLoading\(false\)/)
})

test('aggregate frontend contract and grouped UI expose partial-truth fields', () => {
  for (const field of ['attempts', 'succeeded', 'failed', 'denied', 'skipped', 'retries', 'fallbacks', 'input_tokens', 'output_tokens', 'audio_seconds', 'token_eligible_attempts', 'unknown_input_attempts', 'unknown_output_attempts', 'audio_eligible_attempts', 'known_cost_attempts', 'unknown_cost_attempts', 'unknown_audio_attempts', 'avg_latency_ms']) {
    assert.match(dashboardData, new RegExp(`${field}: number(?: \\| null)?`), field)
  }
  assert.match(dashboard, /function aggregateTelemetry\(row: Partial<AggregateTelemetry>\)/)
  assert.match(dashboard, /safeCount\(row\.token_eligible_attempts\)/)
  assert.match(dashboard, /safeCount\(row\.audio_eligible_attempts\)/)
  assert.match(dashboard, /Attempt activity/)
  assert.match(dashboard, /Partial pricing coverage/)
  assert.match(dashboard, /Complete pricing coverage/)
  assert.doesNotMatch(dashboard, /Coverage unavailable/)
})

test('provider status gives disabled and missing config precedence and expires observations', () => {
  assert.match(dashboardData, /if \(!route\.enabled\) return 'disabled'/)
  assert.match(dashboardData, /if \(configured === false\) return 'missing'/)
  assert.match(dashboardData, /15 \* 60 \* 1000/)
  assert.match(dashboard, /Stale \/ unknown/)
  assert.match(dashboard, /Checked /)
  assert.match(dashboard, /setInterval\(\(\) => setNow\(Date\.now\(\)\), 60_000\)/)
})

test('provider freshness transitions after fifteen minutes while precedence remains stable', () => {
  const observed = Date.parse('2026-08-01T10:00:00Z')
  const base = {
    id: 'route', capability: 'text', provider: 'groq', model: 'model', tier: 'cheap', priority: 1,
    enabled: true, pricing_currency: 'USD', pricing_as_of: '2026-08-01', input_per_million_micros: 0,
    output_per_million_micros: 0, audio_per_minute_micros: null, request_cost_micros: 0,
    runtime_status: 'healthy', last_observed_at: new Date(observed).toISOString(), last_latency_ms: 100, safe_error_code: null,
  }
  assert.equal(getProviderDisplayStatus(base, true, observed + 15 * 60_000), 'healthy')
  assert.equal(getProviderDisplayStatus(base, true, observed + 15 * 60_000 + 1), 'stale')
  assert.equal(getProviderDisplayStatus({ ...base, enabled: false }, false, observed + 60 * 60_000), 'disabled')
  assert.equal(getProviderDisplayStatus(base, false, observed + 60 * 60_000), 'missing')
  assert.equal(getProviderDisplayStatus({ ...base, last_observed_at: null }, true, observed), 'configured')
  assert.equal(getProviderDisplayStatus({ ...base, safe_error_code: 'PROVIDER_AUTH' }, true, observed), 'authentication_failed')
  for (const safe_error_code of ['PROVIDER_RATE_LIMIT', 'PROVIDER_UPSTREAM', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK_ERROR']) {
    assert.equal(getProviderDisplayStatus({ ...base, safe_error_code }, true, observed), 'temporary_outage')
  }
})

test('all AI paths use one canonical provider-secret resolver with a Groq legacy alias', { concurrency: false }, () => {
  assert.match(providerSecrets, /groq: \{ canonical: 'GROQ_API_KEY', legacy: 'Grok' \}/)
  for (const source of [router, voiceTranscribe, meetingDebrief, contentRunDebrief]) {
    assert.doesNotMatch(source, /Deno\.env\.get\(['"](?:GROQ_API_KEY|Grok)['"]\)/)
  }
  assert.match(router, /resolveProviderSecret/)
  assert.match(voiceTranscribe, /resolveProviderSecret/)
  assert.match(meetingDebrief, /configuredProviderNames\('transcription', routes\.map/)
  assert.match(contentRunDebrief, /configuredProviderNames\('transcription', transcriptionRoutes\.map/)

  const originalDeno = globalThis.Deno
  try {
    globalThis.Deno = { env: { get: name => name === 'Grok' ? 'legacy-masked' : '' } }
    assert.deepEqual(resolveProviderSecret('groq'), { value: 'legacy-masked', source: 'legacy' })
    assert.deepEqual(configuredProviderNames('transcription'), ['groq'])
    globalThis.Deno = { env: { get: name => name === 'GROQ_API_KEY' ? 'canonical-masked' : name === 'Grok' ? 'legacy-masked' : '' } }
    assert.deepEqual(resolveProviderSecret('groq'), { value: 'canonical-masked', source: 'canonical' })
  } finally {
    globalThis.Deno = originalDeno
  }
})

test('route diagnostics preserve direct provider identity and optional status', { concurrency: false }, () => {
  const originalDeno = globalThis.Deno
  globalThis.Deno = { env: { get: name => name === 'OPENROUTER_API_KEY' ? 'masked' : '' } }
  try {
    const openRouterRoute = { ...route('openrouter', 'cheap', 10), id: 'openrouter-route', model: 'google/gemini-flash' }
    const groqRoute = { ...route('groq', 'cheap', 20), id: 'groq-route', capability: 'transcription' }
    const diagnostics = getProviderDiagnostics([openRouterRoute, groqRoute])
    assert.deepEqual(diagnostics.map(item => [item.routeId, item.provider, item.configured, item.optional]), [
      ['openrouter-route', 'openrouter', true, false],
      ['groq-route', 'groq', false, false],
    ])
    assert.equal(diagnostics[0].model, 'google/gemini-flash')
  } finally {
    globalThis.Deno = originalDeno
  }
})

test('health checks target exact configured routes and transcription health stores no audio', () => {
  assert.match(dashboard, /runMaskedProviderHealthCheck\(route\.provider, route\.routeId\)/)
  assert.match(dashboard, /runTranscriptionProviderHealthCheck\(route\.provider, route\.routeId, transcriptionAudio\)/)
  assert.match(dashboardData, /body: \{ action: 'test_provider', provider, routeId, requestId: crypto\.randomUUID\(\) \}/)
  assert.match(router, /filter\(route => !options\.routeId \|\| route\.id === options\.routeId\)/)
  assert.match(assistant, /routeId, forceProbe: true/)
  assert.match(meetingDebrief, /action === 'transcription_health'/)
  assert.match(meetingDebrief, /feature: 'provider_health', action: 'transcribe'/)
  assert.match(meetingDebrief, /audio\.size > MAX_AUDIO_BYTES/)
  assert.match(meetingDebrief, /`\$\{provider\}\\n\$\{routeId\}\\n\$\{audioHash\}`/)
  assert.match(meetingDebrief, /deleteAiUsageReplay/)
  assert.doesNotMatch(meetingDebrief, /audio_(?:data|bytes|blob)\s*:/i)
  assert.doesNotMatch(voiceDebriefDocs, /VOICE_TRANSCRIPTION_ORDER|GROQ_TRANSCRIPTION_MODEL|OPENAI_TRANSCRIPTION_MODEL/)
})

test('route-scoped reservations preserve hard-budget safety without charging unrelated routes', () => {
  assert.ok(routeScopedReservation.indexOf('drop function if exists public.ai_reserve_usage') < routeScopedReservation.indexOf('create or replace function public.ai_reserve_usage'))
  assert.match(routeScopedReservation, /p_route_ids uuid\[\] default null/)
  assert.match(routeScopedReservation, /p_route_ids is null or route\.id = any\(p_route_ids\)/)
  assert.match(routeScopedReservation, /cardinality\(p_route_ids\) = 0/)
  assert.match(routeScopedReservation, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(routeScopedReservation, /revoke all on function public\.ai_reserve_usage\([^;]+uuid\[\]\) from public, anon, authenticated/)
  assert.match(usage, /p_route_ids: input\.routeIds \?\? null/)
  assert.match(router, /routeIds: routes\.map\(route => route\.id\)/)
  assert.match(voiceTranscribe, /routeIds: routes\.map\(route => route\.id\)/)
})

test('existing Assistant provider test selects an exact configured text route', () => {
  assert.match(assistantClient, /provider\.capability === 'text' && provider\.enabled && provider\.configured/)
  assert.match(assistantClient, /provider: route\.provider/)
  assert.match(assistantClient, /routeId: route\.routeId/)
  assert.match(assistantClient, /requestId: crypto\.randomUUID\(\)/)
})

test('reserve sums the four worst-case eligible attempts under the monthly row lock', () => {
  const start = sql.indexOf('function public.ai_reserve_usage')
  const body = sql.slice(start, sql.indexOf('\n$$;', start) + 4)
  assert.match(body, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(body, /ai_monthly_budgets where month = v_month for update/)
  assert.match(body, /committed_zar_micros \+ v_budget\.reserved_zar_micros \+ v_reservation/)
  assert.match(body, /v_projected > v_budget\.hard_limit_zar_micros/)
  assert.match(body, /AI_IDEMPOTENCY_FINGERPRINT_CONFLICT/)
  assert.match(body, /pg_advisory_xact_lock/)
  assert.match(body, /created_at >= now\(\) - interval '30 seconds'/)
  assert.match(body, /sum\(candidate\.zar_cost_micros\)/)
  assert.match(body, /order by cost\.zar_cost_micros desc nulls first/)
  assert.match(body, /limit 4/)
  assert.match(body, /v_priced_routes <> v_eligible_routes/)
  assert.doesNotMatch(body, /max\(cost\.zar_cost_micros\)/)
})

test('two concurrent reservations cannot collectively cross the serialized hard-limit contract', async () => {
  const reserveBody = sql.slice(sql.indexOf('function public.ai_reserve_usage'), sql.indexOf('\n$$;', sql.indexOf('function public.ai_reserve_usage')))
  const lockIndex = reserveBody.indexOf('ai_monthly_budgets where month = v_month for update')
  const projectionIndex = reserveBody.indexOf('v_projected := v_budget.committed_zar_micros + v_budget.reserved_zar_micros + v_reservation')
  const updateIndex = reserveBody.indexOf('reserved_zar_micros = reserved_zar_micros + v_reservation')
  assert.ok(lockIndex >= 0 && projectionIndex > lockIndex && updateIndex > projectionIndex)

  let reserved = 0
  let lock = Promise.resolve()
  const reserve = async amount => {
    const previous = lock
    let release
    lock = new Promise(resolve => { release = resolve })
    await previous
    try {
      if (reserved + amount > 100) return false
      await Promise.resolve()
      reserved += amount
      return true
    } finally {
      release()
    }
  }
  const decisions = await Promise.all([reserve(60), reserve(60)])
  assert.deepEqual(decisions.sort(), [false, true])
  assert.equal(reserved, 60)
})

test('finalize atomically releases reservation and commits the upper bound for any unknown attempted cost', () => {
  const start = sql.indexOf('function public.ai_finalize_usage')
  const body = sql.slice(start, sql.indexOf('\n$$;', start) + 4)
  assert.match(body, /ai_monthly_budgets where month = v_request\.month for update/)
  assert.match(body, /reserved_zar_micros = greatest\(0, reserved_zar_micros - v_request\.reservation_zar_micros\)/)
  assert.match(body, /when p_billing_uncertain(?: or v_unknown > 0)? then v_request\.reservation_zar_micros/)
  assert.match(body, /when v_unknown > 0 then v_request\.reservation_zar_micros/)
  assert.match(body, /actual_zar_micros = case when not p_billing_uncertain and v_attempted > 0 and v_unknown = 0 then v_actual else null end/)
  assert.match(body, /cost_source = case when p_billing_uncertain or \(v_attempted > 0 and v_unknown > 0\) then 'reserved_upper_bound'/)
  assert.match(sql, /AI hard budget cannot be below committed plus reserved usage/)
})

test('service-only atomic finalization validates and upserts a short-lived replay in the same transaction', () => {
  const start = sql.indexOf('function public.ai_finalize_usage_with_replay')
  const body = sql.slice(start, sql.indexOf('\n$$;', start) + 4)
  assert.match(body, /auth\.role\(\) is distinct from 'service_role'/)
  assert.match(body, /octet_length\(p_replay_payload::text\) > 262144/)
  assert.match(body, /ai_replay_payload_is_safe\(p_replay_payload\)/)
  assert.match(body, /on conflict \(request_id, kind\) do update/)
  assert.match(body, /public\.ai_finalize_usage\(/)
  assert.match(sql, /grant execute on function public\.ai_finalize_usage_with_replay\([^;]+\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.ai_finalize_usage_with_replay[^;]+to authenticated/)
  assert.match(sql, /ai_usage_replays_payload_safe/)
})

test('atomic finalization retries three times then fails closed without changing the provider ledger', async () => {
  let calls = 0
  const client = {
    rpc: async name => {
      assert.equal(name, 'ai_finalize_usage_with_replay')
      calls += 1
      return { data: null, error: { message: 'temporary' } }
    },
  }
  await assert.rejects(finalizeAiUsageWithReplay(client, {
    requestId: 'request-1', status: 'succeeded', latencyMs: 10, safeErrorCode: null,
    replay: { fingerprint: 'a'.repeat(64), kind: 'text_response', actorId: 'actor', payload: { content: 'safe' } },
  }), /AI_USAGE_FINALIZATION_FAILED/)
  assert.equal(calls, 3)
})

test('budget and pricing seeds document conservative defaults and 13 months', () => {
  assert.match(sql, /ZAR 500 soft and\n-- ZAR 750 hard/)
  assert.match(sql, /500000000, 750000000, 80/)
  assert.match(sql, /generate_series\(0, 12\)/)
  assert.match(sql, /pricing_as_of[\s\S]*'2026-08-01'/)
  assert.match(sql, /'openrouter\/free','cheap',10,true,'ZAR',0,0,null,0,1000000/)
  for (const provider of ['gemini', 'groq', 'openai']) {
    assert.match(sql, new RegExp(`'text','${provider}'[^\n]+,'USD'`))
  }
})

test('transcription seeds are enabled, safely priced in Groq, Gemini, OpenAI order', () => {
  const groq = sql.indexOf("('transcription','groq','whisper-large-v3-turbo','cheap',10,true,'USD',0,0,667")
  const gemini = sql.indexOf("('transcription','gemini','gemini-2.5-flash-lite','cheap',20,true,'USD',0,0,192")
  const openai = sql.indexOf("('transcription','openai','gpt-4o-mini-transcribe','cheap',30,true,'USD',0,0,3000")
  assert.ok(groq >= 0 && gemini > groq && openai > gemini)
  for (const label of ['Groq pricing:', 'Google Gemini pricing:', 'OpenAI pricing:']) assert.match(sql, new RegExp(label))
  assert.doesNotMatch(sql, /'transcription','openai','whisper-1'/)
})

test('simple routing uses cheap only; complex routing prefers strong then cheap fallback', () => {
  const routes = [
    route('openai', 'cheap', 30),
    route('gemini', 'strong', 20),
    route('groq', 'cheap', 10),
    route('openrouter', 'strong', 10),
    route('gemini', 'cheap', 5, false),
  ]
  assert.deepEqual(selectRoutes(routes, 'simple').map(item => item.provider), ['groq', 'openai'])
  assert.deepEqual(selectRoutes(routes, 'complex').map(item => item.provider), ['openrouter', 'gemini', 'groq', 'openai'])
})

test('estimated cost keeps unknown paid usage null and explicit free usage zero', () => {
  assert.deepEqual(estimateRouteCost(route('openai', 'cheap', 1), null, null, null), {
    providerMicros: null,
    zarMicros: null,
  })
  assert.deepEqual(estimateRouteCost(route('openrouter', 'cheap', 1, true, {
    pricing_currency: 'ZAR', input_per_million_micros: 0, output_per_million_micros: 0, fx_zar_micros: 1_000_000,
  }), null, null, null), { providerMicros: 0, zarMicros: 0 })
  assert.deepEqual(estimateRouteCost(route('openai', 'cheap', 1), 1_000, 500, null), {
    providerMicros: 300,
    zarMicros: 5_400,
  })
})

test('router loads DB routes, captures provider metadata, skips unhealthy routes, falls back, and finalizes', () => {
  assert.match(router, /loadAiProviderRoutes\(options\.usageClient, 'text'\)/)
  assert.match(router, /loadRecentlyDegradedRouteIds/)
  assert.match(router, /outcome: 'missing_secret'/)
  assert.match(router, /outcome: 'degraded'/)
  assert.match(router, /fallback: providerAttempts > 1/)
  assert.match(router, /body\.usage\?\.prompt_tokens \?\? body\.usage\?\.input_tokens/)
  assert.match(router, /body\.usageMetadata\?\.promptTokenCount/)
  assert.match(router, /actualModel: typeof body\.model/)
  assert.match(router, /await finalizeAiUsageWithReplay\(options\.usageClient/)
  assert.match(router, /await finalizeAiUsage\(\s*options\.usageClient/)
  assert.doesNotMatch(router, /response\.text\(\)/)
  assert.doesNotMatch(router, /console\.(log|info|warn|error)/)
})

function fakeUsageClient(routes, options = {}) {
  const attempts = []
  const health = []
  const finalizations = []
  const from = table => {
    const builder = {
      select() { return builder },
      eq() { return builder },
      order() { return builder },
      in() { return builder },
      neq() { return builder },
      gte() { return builder },
      insert(value) {
        if (table === 'ai_usage_attempts') {
          attempts.push(value)
          if (options.failAttemptInsert) return Promise.resolve({ error: { message: 'ledger unavailable' } })
        }
        if (table === 'ai_provider_health_observations') health.push(value)
        return Promise.resolve({ error: null })
      },
      then(resolve, reject) {
        const data = table === 'ai_provider_routes' ? routes : []
        return Promise.resolve({ data, error: null }).then(resolve, reject)
      },
    }
    return builder
  }
  const rpc = (name, parameters) => {
    if (name === 'ai_reserve_usage') {
      return Promise.resolve({ data: { allowed: true, duplicate: false, request_id: 'request-1', status: 'reserved', budget_state: 'ok' }, error: null })
    }
    if (name === 'ai_finalize_usage_with_replay') finalizations.push(parameters)
    return Promise.resolve({ data: {}, error: null })
  }
  return { client: { from, rpc }, attempts, health, finalizations }
}

const providerPayload = content => new Response(JSON.stringify({
  model: 'actual-model',
  choices: [{ message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } })

test('canonical validation records invalid output as failure and falls back before success', { concurrency: false }, async () => {
  const routes = [route('groq', 'cheap', 10), route('openai', 'cheap', 20)]
  const usageClient = fakeUsageClient(routes)
  const originalDeno = globalThis.Deno
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.Deno = { env: { get: name => name === 'GROQ_API_KEY' || name === 'OPENAI_API_KEY' ? 'masked-test-key' : '' } }
  globalThis.fetch = async () => providerPayload(++calls === 1 ? 'not json' : '{"ok":true}')
  try {
    const result = await routeAiChat([{ role: 'user', content: 'test' }], {
      feature: 'test', action: 'validate', actorId: 'actor', idempotencyKey: 'request-key', fingerprint: 'a'.repeat(64),
      complexity: 'simple', maxOutputTokens: 128, usageClient: usageClient.client,
      validateContent: content => JSON.parse(content).ok === true,
    })
    assert.equal(result.provider, 'openai')
    assert.equal(calls, 2)
    assert.deepEqual(usageClient.attempts.map(item => [item.status, item.outcome]), [
      ['failed', 'invalid_response'],
      ['succeeded', 'success'],
    ])
    assert.equal(usageClient.attempts[0].safe_error_code, 'PROVIDER_INVALID_RESPONSE')
    assert.equal(usageClient.finalizations[0].p_status, 'succeeded')
  } finally {
    globalThis.Deno = originalDeno
    globalThis.fetch = originalFetch
  }
})

test('a ledger insert failure never retries the provider or inserts the same attempt number again', { concurrency: false }, async () => {
  const usageClient = fakeUsageClient([route('openai', 'cheap', 10)], { failAttemptInsert: true })
  const originalDeno = globalThis.Deno
  const originalFetch = globalThis.fetch
  let providerCalls = 0
  globalThis.Deno = { env: { get: name => name === 'OPENAI_API_KEY' ? 'masked-test-key' : '' } }
  globalThis.fetch = async () => { providerCalls += 1; return providerPayload('{"ok":true}') }
  try {
    await assert.rejects(routeAiChat([{ role: 'user', content: 'test' }], {
      feature: 'test', action: 'ledger_failure', actorId: 'actor', idempotencyKey: 'request-key', fingerprint: 'c'.repeat(64),
      complexity: 'simple', maxOutputTokens: 128, usageClient: usageClient.client,
      validateContent: content => JSON.parse(content).ok === true,
    }), /AI_ATTEMPT_RECORD_FAILED/)
    assert.equal(providerCalls, 1)
    assert.deepEqual(usageClient.attempts.map(item => item.attempt_number), [1])
    assert.equal(usageClient.finalizations.length, 1)
    assert.equal(usageClient.finalizations[0].p_billing_uncertain, true)
  } finally {
    globalThis.Deno = originalDeno
    globalThis.fetch = originalFetch
  }
})

test('recent degradation uses the latest runtime observation for each route', async () => {
  const rows = [
    { route_id: 'route-a', observation: 'success', observed_at: '2026-08-01T10:02:00Z' },
    { route_id: 'route-b', observation: 'failure', observed_at: '2026-08-01T10:01:00Z' },
    { route_id: 'route-a', observation: 'failure', observed_at: '2026-08-01T10:00:00Z' },
  ]
  const builder = {
    select() { return builder }, neq() { return builder }, gte() { return builder }, order() { return builder },
    then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject) },
  }
  const degraded = await loadRecentlyDegradedRouteIds({ from: () => builder })
  assert.deepEqual([...degraded], ['route-b'])
})

test('stale reservations and replay payloads are service-role-only and self-reconciled before reserve', () => {
  assert.match(sql, /reservation_expires_at timestamptz/)
  assert.match(sql, /function public\.ai_reconcile_stale_usage\(\)/)
  assert.match(sql, /perform public\.ai_reconcile_stale_usage\(\)/)
  assert.match(sql, /AI_STALE_RESERVATION_RECONCILED/)
  assert.match(sql, /committed_zar_micros = committed_zar_micros \+ v_request\.reservation_zar_micros/)
  assert.match(sql, /create table if not exists public\.ai_usage_replays/)
  assert.match(sql, /expires_at <= created_at \+ interval '15 minutes'/)
  assert.match(sql, /revoke all on table public\.ai_usage_replays from public, anon, authenticated/)
  assert.doesNotMatch(sql, /create policy[^;]+on public\.ai_usage_replays/is)
  assert.match(sql, /grant execute on function public\.ai_fetch_usage_replay\(uuid, text, text, uuid\) to service_role/)
  assert.doesNotMatch(sql, /grant execute on function public\.ai_fetch_usage_replay[^;]+to authenticated/)
})

test('retry aggregates count actual calls after a prior actual call and exclude skipped unknown telemetry', () => {
  const body = sql.slice(sql.indexOf('function public.ai_admin_usage_aggregates'), sql.indexOf('\n$$;', sql.indexOf('function public.ai_admin_usage_aggregates')))
  assert.doesNotMatch(body, /sum\(a?\.?retry_number\)/)
  assert.match(body, /a\.status <> 'skipped' and exists \(select 1 from public\.ai_usage_attempts prior/)
  assert.match(body, /prior\.status <> 'skipped'/)
  assert.match(body, /unknown_cost_attempts[\s\S]*a\.status <> 'skipped'/)
})

test('every JSON aggregate branch returns the exact common telemetry contract', () => {
  const body = sql.slice(sql.indexOf('function public.ai_admin_usage_aggregates'), sql.indexOf('\n$$;', sql.indexOf('function public.ai_admin_usage_aggregates')))
  const branches = [
    ['summary', 'budget'], ['daily', 'monthly'], ['monthly', 'users'], ['users', 'features'],
    ['features', 'providers'], ['providers', 'currency_costs'], ['currency_costs', 'routes'],
  ]
  const fields = [
    'attempts', 'succeeded', 'failed', 'denied', 'skipped', 'retries', 'fallbacks',
    'input_tokens', 'output_tokens', 'audio_seconds', 'known_cost_attempts', 'unknown_cost_attempts',
    'unknown_input_attempts', 'unknown_output_attempts', 'unknown_audio_attempts', 'avg_latency_ms',
  ]
  for (const [name, nextName] of branches) {
    const start = body.indexOf(`'${name}'`)
    const end = body.indexOf(`'${nextName}'`, start + name.length + 2)
    const branch = body.slice(start, end)
    for (const field of fields) {
      const output = name === 'summary'
        ? new RegExp(`'${field}'\\s*,`)
        : new RegExp(`\\bas ${field}\\b`)
      assert.match(branch, output, `${name} must return ${field}`)
    }
  }
})

test('token and audio coverage use capability-specific actually-attempted denominators', () => {
  const body = sql.slice(sql.indexOf('function public.ai_admin_usage_aggregates'), sql.indexOf('\n$$;', sql.indexOf('function public.ai_admin_usage_aggregates')))
  assert.match(body, /a\.status <> 'skipped' and \(a\.capability = 'text' or a\.input_tokens is not null or a\.output_tokens is not null\)\) as token_eligible_attempts/)
  assert.match(body, /a\.status <> 'skipped' and a\.capability = 'transcription'\) as audio_eligible_attempts/)
  assert.match(body, /a\.status <> 'skipped' and a\.capability = 'transcription' and a\.audio_seconds is null\) as unknown_audio_attempts/)
  assert.doesNotMatch(body, /unknown_(input|output)_attempts[^\n]+a\.status = 'skipped'/)
  assert.match(dashboard, /if \(eligibleAttempts === 0\) return `N\/A:/)
})

test('all malformed provider outputs finalize one failed request with no succeeded ledger attempt', { concurrency: false }, async () => {
  const usageClient = fakeUsageClient([route('groq', 'cheap', 10), route('openai', 'cheap', 20)])
  const originalDeno = globalThis.Deno
  const originalFetch = globalThis.fetch
  globalThis.Deno = { env: { get: name => name === 'GROQ_API_KEY' || name === 'OPENAI_API_KEY' ? 'masked-test-key' : '' } }
  globalThis.fetch = async () => providerPayload('{"wrong":true}')
  try {
    await assert.rejects(routeAiChat([{ role: 'user', content: 'test' }], {
      feature: 'test', action: 'validate', actorId: 'actor', idempotencyKey: 'request-key', fingerprint: 'b'.repeat(64),
      complexity: 'simple', maxOutputTokens: 128, usageClient: usageClient.client,
      validateContent: content => JSON.parse(content).ok === true,
    }), /NO_AI_PROVIDER_AVAILABLE/)
    assert.equal(usageClient.attempts.length, 2)
    assert.ok(usageClient.attempts.every(item => item.status === 'failed' && item.outcome === 'invalid_response'))
    assert.equal(usageClient.finalizations[0].p_status, 'failed')
    assert.equal(usageClient.finalizations[0].p_safe_error_code, 'PROVIDER_INVALID_RESPONSE')
  } finally {
    globalThis.Deno = originalDeno
    globalThis.fetch = originalFetch
  }
})

test('assistant supplies hashed identity/context, keeps local answers unmetered, and masks admin diagnostics', () => {
  assert.match(assistant, /crypto\.subtle\.digest\('SHA-256'/)
  assert.match(assistant, /feature: 'cg_assistant'/)
  assert.match(assistant, /classifyChatComplexity\(message\)/)
  assert.match(assistant, /`skilled_\$\{agentKey\}`[\s\S]*'complex'/)
  assert.match(assistant, /`provider_test_\$\{provider\}`/)
  assert.match(assistant, /`\[masked \$\{provider\}:\$\{routeId\} provider test\]`/)
  assert.match(assistant, /return redactPrompt \? '\[restricted prompt omitted\]' : '\[prompt omitted\]'/)
  assert.match(assistant, /if \(!isAdminRole\(role\)\)/)
  assert.match(assistant, /configured \(masked\)/)

  const localSection = assistant.slice(assistant.indexOf('if (isCapabilitiesQuestion'), assistant.indexOf('// Skilled-agent mode'))
  assert.doesNotMatch(localSection, /routeAiChat/)
  assert.match(usage, /fingerprint: string/)
  assert.doesNotMatch(usage, /(?:prompt|transcript|apiKey|secret|rawResponse)\s*[:=]/i)
})
