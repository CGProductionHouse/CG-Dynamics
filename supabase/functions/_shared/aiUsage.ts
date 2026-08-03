export type AiCapability = 'text' | 'transcription'
export type AiComplexity = 'simple' | 'complex'

export interface AiProviderRoute {
  id: string
  capability: AiCapability
  provider: string
  model: string
  tier: 'cheap' | 'strong'
  priority: number
  enabled: boolean
  pricing_currency: 'USD' | 'ZAR'
  input_per_million_micros: number | null
  output_per_million_micros: number | null
  audio_per_minute_micros: number | null
  request_cost_micros: number | null
  fx_zar_micros: number
}

export interface AiUsageClient {
  from(table: string): {
    select(columns: string): unknown
    insert(values: Record<string, unknown>): PromiseLike<{ error?: { message?: string } | null }>
  }
  rpc(name: string, parameters: Record<string, unknown>): PromiseLike<{
    data: unknown
    error?: { message?: string } | null
  }>
}

export interface ReserveAiUsageInput {
  idempotencyKey: string
  fingerprint: string
  feature: string
  action: string
  actorId: string
  capability: AiCapability
  complexity: AiComplexity
  maxInputTokens?: number | null
  maxOutputTokens?: number | null
  maxAudioSeconds?: number | null
  routeIds?: string[] | null
}

export interface AiUsageReservation {
  allowed: boolean
  duplicate: boolean
  request_id: string
  status: string
  budget_state: 'ok' | 'warning' | 'soft_exceeded' | 'hard_denied'
  reservation_zar_micros?: number
}

export type AiReplayKind =
  | 'text_response'
  | 'suggestion_response'
  | 'debrief_transcript'
  | 'meeting_debrief_draft'
  | 'content_run_debrief_draft'
  | 'daily_assistant_draft'

export interface AiAttemptInput {
  requestId: string
  attemptNumber: number
  route: AiProviderRoute
  actualModel?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  audioSeconds?: number | null
  estimatedProviderCostMicros?: number | null
  estimatedZarCostMicros?: number | null
  status: 'skipped' | 'succeeded' | 'failed'
  outcome: 'success' | 'missing_secret' | 'degraded' | 'http_error' | 'timeout' | 'invalid_response' | 'network_error' | 'provider_error'
  retryNumber: number
  fallback: boolean
  latencyMs?: number | null
  httpStatus?: number | null
  safeErrorCode?: string | null
}

interface QueryResult<T> {
  data: T | null
  error?: { message?: string } | null
}

function query<T>(value: unknown): PromiseLike<QueryResult<T>> {
  return value as PromiseLike<QueryResult<T>>
}

export async function loadAiProviderRoutes(client: AiUsageClient, capability: AiCapability): Promise<AiProviderRoute[]> {
  const builder = client.from('ai_provider_routes').select(
    'id, capability, provider, model, tier, priority, enabled, pricing_currency, input_per_million_micros, output_per_million_micros, audio_per_minute_micros, request_cost_micros, fx_zar_micros',
  ) as {
    eq(column: string, value: unknown): unknown
  }
  const enabled = builder.eq('capability', capability) as {
    eq(column: string, value: unknown): unknown
  }
  const ordered = enabled.eq('enabled', true) as {
    order(column: string, options: { ascending: boolean }): unknown
  }
  const result = await query<AiProviderRoute[]>(ordered.order('priority', { ascending: true }))
  if (result.error) throw new Error('AI_ROUTE_LOAD_FAILED')
  return result.data ?? []
}

export async function loadAiProviderRouteInventory(client: AiUsageClient, capability: AiCapability): Promise<AiProviderRoute[]> {
  const builder = client.from('ai_provider_routes').select(
    'id, capability, provider, model, tier, priority, enabled, pricing_currency, input_per_million_micros, output_per_million_micros, audio_per_minute_micros, request_cost_micros, fx_zar_micros',
  ) as { eq(column: string, value: unknown): unknown }
  const capabilityRoutes = builder.eq('capability', capability) as {
    order(column: string, options: { ascending: boolean }): unknown
  }
  const result = await query<AiProviderRoute[]>(capabilityRoutes.order('priority', { ascending: true }))
  if (result.error) throw new Error('AI_ROUTE_LOAD_FAILED')
  return result.data ?? []
}

export async function loadRecentlyDegradedRouteIds(client: AiUsageClient): Promise<Set<string>> {
  const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const builder = client.from('ai_provider_health_observations').select('route_id, observation, observed_at') as {
    neq(column: string, value: unknown): unknown
  }
  const runtime = builder.neq('observation', 'configured') as {
    gte(column: string, value: string): unknown
  }
  const recent = runtime.gte('observed_at', since) as {
    order(column: string, options: { ascending: boolean }): unknown
  }
  const result = await query<Array<{ route_id: string | null; observation: string }>>(
    recent.order('observed_at', { ascending: false }),
  )
  if (result.error) return new Set()
  const latest = new Map<string, string>()
  for (const row of result.data ?? []) {
    if (row.route_id && !latest.has(row.route_id)) latest.set(row.route_id, row.observation)
  }
  return new Set([...latest].filter(([, observation]) => observation === 'failure' || observation === 'missing_secret').map(([id]) => id))
}

export async function reserveAiUsage(client: AiUsageClient, input: ReserveAiUsageInput): Promise<AiUsageReservation> {
  const { data, error } = await client.rpc('ai_reserve_usage', {
    p_idempotency_key: input.idempotencyKey,
    p_fingerprint: input.fingerprint,
    p_feature: input.feature,
    p_action: input.action,
    p_actor_id: input.actorId,
    p_capability: input.capability,
    p_complexity: input.complexity,
    p_max_input_tokens: input.maxInputTokens ?? null,
    p_max_output_tokens: input.maxOutputTokens ?? null,
    p_max_audio_seconds: input.maxAudioSeconds ?? null,
    p_route_ids: input.routeIds ?? null,
  })
  if (error || !data || typeof data !== 'object') throw new Error('AI_USAGE_RESERVATION_FAILED')
  return data as AiUsageReservation
}

export function estimateRouteCost(
  route: AiProviderRoute,
  inputTokens: number | null,
  outputTokens: number | null,
  audioSeconds: number | null,
): { providerMicros: number | null; zarMicros: number | null } {
  if (route.request_cost_micros === null) return { providerMicros: null, zarMicros: null }
  if (inputTokens === null && (route.input_per_million_micros ?? 0) > 0) return { providerMicros: null, zarMicros: null }
  if (outputTokens === null && (route.output_per_million_micros ?? 0) > 0) return { providerMicros: null, zarMicros: null }
  if (audioSeconds === null && (route.audio_per_minute_micros ?? 0) > 0 && route.capability === 'transcription') return { providerMicros: null, zarMicros: null }
  if (inputTokens !== null && route.input_per_million_micros === null) return { providerMicros: null, zarMicros: null }
  if (outputTokens !== null && route.output_per_million_micros === null) return { providerMicros: null, zarMicros: null }
  if (audioSeconds !== null && route.audio_per_minute_micros === null) return { providerMicros: null, zarMicros: null }

  const providerMicros = route.request_cost_micros
    + (inputTokens === null ? 0 : Math.ceil(inputTokens * (route.input_per_million_micros ?? 0) / 1_000_000))
    + (outputTokens === null ? 0 : Math.ceil(outputTokens * (route.output_per_million_micros ?? 0) / 1_000_000))
    + (audioSeconds === null ? 0 : Math.ceil(audioSeconds * (route.audio_per_minute_micros ?? 0) / 60))
  return {
    providerMicros,
    zarMicros: Math.ceil(providerMicros * route.fx_zar_micros / 1_000_000),
  }
}

export async function recordAiAttempt(client: AiUsageClient, input: AiAttemptInput): Promise<void> {
  const { error } = await client.from('ai_usage_attempts').insert({
    request_id: input.requestId,
    attempt_number: input.attemptNumber,
    provider: input.route.provider,
    requested_model: input.route.model,
    actual_model: input.actualModel ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    audio_seconds: input.audioSeconds ?? null,
    estimated_provider_cost_micros: input.estimatedProviderCostMicros ?? null,
    estimated_zar_cost_micros: input.estimatedZarCostMicros ?? null,
    cost_currency: input.route.pricing_currency,
    cost_source: 'estimated',
    status: input.status,
    outcome: input.outcome,
    retry_number: input.retryNumber,
    fallback: input.fallback,
    latency_ms: input.latencyMs ?? null,
    http_status: input.httpStatus ?? null,
    safe_error_code: input.safeErrorCode ?? null,
  })
  if (error) throw new Error('AI_ATTEMPT_RECORD_FAILED')
}

export async function recordProviderHealth(
  client: AiUsageClient,
  route: AiProviderRoute,
  requestId: string | null,
  observation: 'configured' | 'missing_secret' | 'success' | 'failure' | 'degraded_skip',
  safeErrorCode?: string | null,
  httpStatus?: number | null,
  latencyMs?: number | null,
): Promise<void> {
  const { error } = await client.from('ai_provider_health_observations').insert({
    route_id: route.id,
    request_id: requestId,
    provider: route.provider,
    model: route.model,
    observation,
    safe_error_code: safeErrorCode ?? null,
    http_status: httpStatus ?? null,
    latency_ms: latencyMs ?? null,
  })
  if (error) throw new Error('AI_HEALTH_RECORD_FAILED')
}

export async function finalizeAiUsage(
  client: AiUsageClient,
  requestId: string,
  status: 'succeeded' | 'failed',
  latencyMs: number,
  safeErrorCode: string | null,
  billingUncertain = false,
): Promise<void> {
  await finalizeAiUsageWithReplay(client, {
    requestId,
    status,
    latencyMs,
    safeErrorCode,
    billingUncertain,
  })
}

export interface FinalizeAiUsageInput {
  requestId: string
  status: 'succeeded' | 'failed'
  latencyMs: number
  safeErrorCode: string | null
  billingUncertain?: boolean
  replay?: {
    fingerprint: string
    kind: AiReplayKind
    actorId: string
    payload: Record<string, unknown>
  }
}

export async function finalizeAiUsageWithReplay(client: AiUsageClient, input: FinalizeAiUsageInput): Promise<void> {
  const parameters = {
    p_request_id: input.requestId,
    p_status: input.status,
    p_latency_ms: input.latencyMs,
    p_safe_error_code: input.safeErrorCode,
    p_billing_uncertain: input.billingUncertain ?? false,
    p_replay_fingerprint: input.replay?.fingerprint ?? null,
    p_replay_kind: input.replay?.kind ?? null,
    p_replay_actor_id: input.replay?.actorId ?? null,
    p_replay_payload: input.replay?.payload ?? null,
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await client.rpc('ai_finalize_usage_with_replay', parameters)
    if (!error) return
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 50 * 3 ** attempt))
  }
  // The provider is never called again. A still-reserved request is left for
  // stale-reservation reconciliation rather than reporting untracked success.
  throw new Error('AI_USAGE_FINALIZATION_FAILED')
}

export async function storeAiUsageReplay(
  client: AiUsageClient,
  requestId: string,
  fingerprint: string,
  kind: AiReplayKind,
  actorId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await client.rpc('ai_store_usage_replay', {
    p_request_id: requestId,
    p_fingerprint: fingerprint,
    p_kind: kind,
    p_actor_id: actorId,
    p_payload: payload,
  })
  if (error) throw new Error('AI_REPLAY_STORE_FAILED')
}

export async function fetchAiUsageReplay<T>(
  client: AiUsageClient,
  requestId: string,
  fingerprint: string,
  kind: AiReplayKind,
  actorId: string,
): Promise<T | null> {
  const { data, error } = await client.rpc('ai_fetch_usage_replay', {
    p_request_id: requestId,
    p_fingerprint: fingerprint,
    p_kind: kind,
    p_actor_id: actorId,
  })
  if (error) throw new Error('AI_REPLAY_FETCH_FAILED')
  return data && typeof data === 'object' ? data as T : null
}

export async function deleteAiUsageReplay(
  client: AiUsageClient,
  fingerprint: string,
  kind: AiReplayKind,
  actorId: string,
): Promise<void> {
  const { error } = await client.rpc('ai_delete_usage_replay', {
    p_fingerprint: fingerprint,
    p_kind: kind,
    p_actor_id: actorId,
  })
  if (error) throw new Error('AI_REPLAY_DELETE_FAILED')
}
