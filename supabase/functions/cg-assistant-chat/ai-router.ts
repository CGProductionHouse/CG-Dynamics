import {
  estimateRouteCost,
  finalizeAiUsage,
  finalizeAiUsageWithReplay,
  loadAiProviderRoutes,
  loadRecentlyDegradedRouteIds,
  recordAiAttempt,
  recordProviderHealth,
  reserveAiUsage,
  type AiComplexity,
  type AiProviderRoute,
  type AiReplayKind,
  type AiUsageClient,
} from '../_shared/aiUsage.ts'
import {
  isAiProviderName,
  providerIsOptional,
  resolveProviderSecret,
  type AiProviderName,
} from '../_shared/providerSecrets.ts'

export type { AiProviderName } from '../_shared/providerSecrets.ts'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiRouterResult {
  content: string
  provider: AiProviderName
  model: string
  usageRequestId?: string
}

export interface AiRouterOptions {
  feature: string
  action: string
  actorId: string
  idempotencyKey: string
  fingerprint: string
  complexity: AiComplexity
  maxOutputTokens: number
  usageClient: AiUsageClient
  provider?: AiProviderName
  routeId?: string
  forceProbe?: boolean
  validateContent?: (content: string) => boolean | Promise<boolean>
  replayKind?: AiReplayKind
  buildReplayPayload?: (result: { content: string; provider: AiProviderName; model: string }) => Record<string, unknown>
}

interface LegacyAiRouterOptions {
  maxOutputTokens?: number
}

export interface AiProviderDiagnostic {
  routeId: string
  capability: 'text' | 'transcription'
  provider: AiProviderName
  model: string
  configured: boolean
  keyStatus: 'configured' | 'legacy' | 'missing'
  optional: boolean
  enabled: boolean
}

interface ProviderConfig {
  name: AiProviderName
  apiKey: string | null
  model: string
}

interface ProviderCallResult {
  content: string
  actualModel: string | null
  inputTokens: number | null
  outputTokens: number | null
  httpStatus: number
}

class ProviderError extends Error {
  constructor(
    readonly safeCode: string,
    readonly outcome: 'http_error' | 'timeout' | 'invalid_response' | 'network_error' | 'provider_error',
    readonly httpStatus: number | null = null,
  ) {
    super(safeCode)
  }
}

export class AiDuplicateRequestError extends Error {
  constructor(readonly requestId: string) {
    super('AI_DUPLICATE_REQUEST')
  }
}

const DEFAULT_PROVIDER_ORDER: AiProviderName[] = ['openrouter', 'gemini', 'groq', 'openai']
const PROVIDER_TIMEOUT_MS = 12000
const MAX_AI_PROVIDER_ATTEMPTS = 4

function envValue(name: string, fallback = ''): string {
  return (Deno.env.get(name) ?? fallback).trim()
}

function secretForProvider(name: AiProviderName): string | null {
  return resolveProviderSecret(name).value
}

function providerConfig(route: AiProviderRoute): ProviderConfig | null {
  if (!isAiProviderName(route.provider)) return null
  return { name: route.provider, apiKey: secretForProvider(route.provider), model: route.model }
}

function legacyProviderConfig(name: AiProviderName): ProviderConfig {
  const defaults: Record<AiProviderName, { env: string; model: string }> = {
    openrouter: { env: 'OPENROUTER_MODEL', model: 'openrouter/free' },
    gemini: { env: 'GEMINI_MODEL', model: 'gemini-2.5-flash-lite' },
    groq: { env: 'GROQ_MODEL', model: 'llama-3.1-8b-instant' },
    openai: { env: 'OPENAI_MODEL', model: 'gpt-4o-mini' },
  }
  return { name, apiKey: secretForProvider(name), model: envValue(defaults[name].env, defaults[name].model) }
}

function providerOrder(): AiProviderName[] {
  const requested = envValue('AI_PROVIDER_ORDER', DEFAULT_PROVIDER_ORDER.join(','))
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(isAiProviderName)
  return requested.length > 0 ? requested : DEFAULT_PROVIDER_ORDER
}

export function getProviderOrder(): AiProviderName[] {
  return providerOrder()
}

export function getProviderDiagnostics(routes?: AiProviderRoute[]): AiProviderDiagnostic[] {
  const configuredRoutes = routes ?? DEFAULT_PROVIDER_ORDER.map((provider, priority) => ({
    id: provider,
    capability: 'text' as const,
    provider,
    model: legacyProviderConfig(provider).model,
    tier: 'cheap' as const,
    priority,
    enabled: true,
    pricing_currency: 'ZAR' as const,
    input_per_million_micros: 0,
    output_per_million_micros: 0,
    audio_per_minute_micros: null,
    request_cost_micros: 0,
    fx_zar_micros: 1_000_000,
  }))
  return configuredRoutes.filter(route => isAiProviderName(route.provider)).map(route => {
    const secret = resolveProviderSecret(route.provider as AiProviderName)
    return {
      routeId: route.id,
      capability: route.capability,
      provider: route.provider as AiProviderName,
      model: route.model,
      configured: Boolean(secret.value),
      keyStatus: secret.source,
      optional: providerIsOptional(route.provider as AiProviderName, route.capability),
      enabled: route.enabled,
    }
  })
}

export function selectRoutes(routes: AiProviderRoute[], complexity: AiComplexity): AiProviderRoute[] {
  const enabled = routes.filter(route => route.enabled && isAiProviderName(route.provider))
  if (complexity === 'simple') return enabled.filter(route => route.tier === 'cheap').sort((a, b) => a.priority - b.priority)
  return enabled.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'strong' ? -1 : 1
    return a.priority - b.priority
  })
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ProviderError('PROVIDER_TIMEOUT', 'timeout')
    throw new ProviderError('PROVIDER_NETWORK_ERROR', 'network_error')
  } finally {
    clearTimeout(timeout)
  }
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function parseOpenAiCompatible(data: unknown): Omit<ProviderCallResult, 'httpStatus'> {
  const body = data as {
    model?: unknown
    choices?: Array<{ message?: { content?: unknown } }>
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; input_tokens?: unknown; output_tokens?: unknown }
  }
  const content = body?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new ProviderError('PROVIDER_INVALID_RESPONSE', 'invalid_response')
  return {
    content: content.trim(),
    actualModel: typeof body.model === 'string' ? body.model.slice(0, 200) : null,
    inputTokens: nonNegativeInteger(body.usage?.prompt_tokens ?? body.usage?.input_tokens),
    outputTokens: nonNegativeInteger(body.usage?.completion_tokens ?? body.usage?.output_tokens),
  }
}

function geminiContents(messages: AiChatMessage[]) {
  return messages.filter(message => message.role !== 'system').map(message => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
}

function systemText(messages: AiChatMessage[]): string {
  return messages.filter(message => message.role === 'system').map(message => message.content).join('\n')
}

function parseGemini(data: unknown, requestedModel: string): Omit<ProviderCallResult, 'httpStatus'> {
  const body = data as {
    modelVersion?: unknown
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>
    usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown }
  }
  const content = body?.candidates?.[0]?.content?.parts?.map(part => typeof part.text === 'string' ? part.text : '').join('').trim()
  if (!content) throw new ProviderError('PROVIDER_INVALID_RESPONSE', 'invalid_response')
  return {
    content,
    actualModel: typeof body.modelVersion === 'string' ? body.modelVersion.slice(0, 200) : requestedModel,
    inputTokens: nonNegativeInteger(body.usageMetadata?.promptTokenCount),
    outputTokens: nonNegativeInteger(body.usageMetadata?.candidatesTokenCount),
  }
}

function safeHttpCode(status: number): string {
  if (status === 401 || status === 403) return 'PROVIDER_AUTH'
  if (status === 429) return 'PROVIDER_RATE_LIMIT'
  if (status >= 500) return 'PROVIDER_UPSTREAM'
  return 'PROVIDER_HTTP_ERROR'
}

async function callOpenAiCompatible(
  config: ProviderConfig,
  messages: AiChatMessage[],
  endpoint: string,
  extraHeaders: Record<string, string>,
  maxOutputTokens: number,
): Promise<ProviderCallResult> {
  if (!config.apiKey) throw new ProviderError('PROVIDER_SECRET_MISSING', 'provider_error')
  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ model: config.model, temperature: 0.2, max_tokens: maxOutputTokens, messages }),
  })
  if (!response.ok) throw new ProviderError(safeHttpCode(response.status), 'http_error', response.status)
  let data: unknown
  try { data = await response.json() } catch { throw new ProviderError('PROVIDER_INVALID_RESPONSE', 'invalid_response', response.status) }
  return { ...parseOpenAiCompatible(data), httpStatus: response.status }
}

async function callGemini(config: ProviderConfig, messages: AiChatMessage[], maxOutputTokens: number): Promise<ProviderCallResult> {
  if (!config.apiKey) throw new ProviderError('PROVIDER_SECRET_MISSING', 'provider_error')
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText(messages) }] },
      contents: geminiContents(messages),
      generationConfig: { temperature: 0.2, maxOutputTokens },
    }),
  })
  if (!response.ok) throw new ProviderError(safeHttpCode(response.status), 'http_error', response.status)
  let data: unknown
  try { data = await response.json() } catch { throw new ProviderError('PROVIDER_INVALID_RESPONSE', 'invalid_response', response.status) }
  return { ...parseGemini(data, config.model), httpStatus: response.status }
}

async function callProvider(config: ProviderConfig, messages: AiChatMessage[], maxOutputTokens: number): Promise<ProviderCallResult> {
  if (config.name === 'openrouter') return callOpenAiCompatible(config, messages, 'https://openrouter.ai/api/v1/chat/completions', {
    'HTTP-Referer': 'https://cg-dynamics.vercel.app', 'X-Title': 'CG Dynamics',
  }, maxOutputTokens)
  if (config.name === 'groq') return callOpenAiCompatible(config, messages, 'https://api.groq.com/openai/v1/chat/completions', {}, maxOutputTokens)
  if (config.name === 'openai') return callOpenAiCompatible(config, messages, 'https://api.openai.com/v1/chat/completions', {}, maxOutputTokens)
  return callGemini(config, messages, maxOutputTokens)
}

async function observeProviderHealth(
  client: AiUsageClient,
  route: AiProviderRoute,
  requestId: string,
  observation: 'configured' | 'missing_secret' | 'success' | 'failure' | 'degraded_skip',
  safeErrorCode?: string | null,
  httpStatus?: number | null,
  latencyMs?: number | null,
): Promise<void> {
  try {
    await recordProviderHealth(client, route, requestId, observation, safeErrorCode, httpStatus, latencyMs)
  } catch {
    // Health telemetry must not suppress a recorded attempt or provider fallback.
  }
}

export function hasAnyConfiguredProvider(): boolean {
  return DEFAULT_PROVIDER_ORDER.some(name => Boolean(secretForProvider(name)))
}

async function routeLegacy(messages: AiChatMessage[], options: LegacyAiRouterOptions): Promise<AiRouterResult> {
  const maxOutputTokens = Math.min(Math.max(Math.floor(options.maxOutputTokens ?? 500), 128), 4000)
  let attempted = 0
  for (const name of providerOrder()) {
    const config = legacyProviderConfig(name)
    if (!config.apiKey || attempted >= MAX_AI_PROVIDER_ATTEMPTS) continue
    attempted += 1
    try {
      const result = await callProvider(config, messages, maxOutputTokens)
      return { content: result.content, provider: config.name, model: result.actualModel ?? config.model }
    } catch {
      // Compatibility only for callers not yet migrated to canonical accounting.
    }
  }
  if (!hasAnyConfiguredProvider()) throw new Error('NO_AI_PROVIDER_KEYS')
  throw new Error('NO_AI_PROVIDER_AVAILABLE')
}

export async function routeAiChat(messages: AiChatMessage[], options: AiRouterOptions): Promise<AiRouterResult>
export async function routeAiChat(messages: AiChatMessage[], options?: LegacyAiRouterOptions): Promise<AiRouterResult>
export async function routeAiChat(
  messages: AiChatMessage[],
  options: AiRouterOptions | LegacyAiRouterOptions = {},
): Promise<AiRouterResult> {
  if (!('usageClient' in options)) return routeLegacy(messages, options)

  const startedAt = Date.now()
  const maxOutputTokens = Math.min(Math.max(Math.floor(options.maxOutputTokens), 128), 4000)
  const maxInputTokens = Math.min(128000, Math.max(512, Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 2)))
  const routes = selectRoutes(await loadAiProviderRoutes(options.usageClient, 'text'), options.complexity)
    .filter(route => !options.provider || route.provider === options.provider)
    .filter(route => !options.routeId || route.id === options.routeId)
  const reservation = await reserveAiUsage(options.usageClient, {
    idempotencyKey: options.idempotencyKey,
    fingerprint: options.fingerprint,
    feature: options.feature,
    action: options.action,
    actorId: options.actorId,
    capability: 'text',
    complexity: options.complexity,
    maxInputTokens,
    maxOutputTokens,
    routeIds: routes.map(route => route.id),
  })
  if (!reservation.allowed) {
    if (reservation.duplicate) throw new AiDuplicateRequestError(reservation.request_id)
    throw new Error('AI_HARD_BUDGET')
  }

  let finalStatus: 'succeeded' | 'failed' = 'failed'
  let finalErrorCode: string | null = 'NO_AI_PROVIDER_AVAILABLE'
  let attemptNumber = 0
  let providerAttempts = 0
  let unrecordedProviderAttempts = 0

  try {
    const degraded = options.forceProbe ? new Set<string>() : await loadRecentlyDegradedRouteIds(options.usageClient)
    for (const route of routes) {
      attemptNumber += 1
      const config = providerConfig(route)
      if (!config?.apiKey) {
        await recordAiAttempt(options.usageClient, {
          requestId: reservation.request_id, attemptNumber, route, status: 'skipped', outcome: 'missing_secret',
          retryNumber: 0, fallback: false, safeErrorCode: 'PROVIDER_SECRET_MISSING',
        })
        await observeProviderHealth(options.usageClient, route, reservation.request_id, 'missing_secret', 'PROVIDER_SECRET_MISSING')
        continue
      }
      if (degraded.has(route.id)) {
        await recordAiAttempt(options.usageClient, {
          requestId: reservation.request_id, attemptNumber, route, status: 'skipped', outcome: 'degraded',
          retryNumber: 0, fallback: false, safeErrorCode: 'PROVIDER_RECENTLY_DEGRADED',
        })
        await observeProviderHealth(options.usageClient, route, reservation.request_id, 'degraded_skip', 'PROVIDER_RECENTLY_DEGRADED')
        continue
      }
      if (providerAttempts >= MAX_AI_PROVIDER_ATTEMPTS) break
      const callStarted = Date.now()
      providerAttempts += 1
      unrecordedProviderAttempts += 1
      let result: ProviderCallResult
      try {
        result = await callProvider(config, messages, maxOutputTokens)
      } catch (error) {
        const providerError = error instanceof ProviderError ? error : new ProviderError('PROVIDER_ERROR', 'provider_error')
        const latencyMs = Date.now() - callStarted
        finalErrorCode = providerError.safeCode
        await recordAiAttempt(options.usageClient, {
          requestId: reservation.request_id, attemptNumber, route, status: 'failed', outcome: providerError.outcome,
          retryNumber: providerAttempts - 1, fallback: providerAttempts > 1, latencyMs,
          httpStatus: providerError.httpStatus, safeErrorCode: providerError.safeCode,
        })
        unrecordedProviderAttempts -= 1
        await observeProviderHealth(options.usageClient, route, reservation.request_id, 'failure', providerError.safeCode, providerError.httpStatus, latencyMs)
        continue
      }

      const latencyMs = Date.now() - callStarted
      const cost = estimateRouteCost(route, result.inputTokens, result.outputTokens, null)
      let validContent = true
      if (options.validateContent) {
        try {
          validContent = await options.validateContent(result.content)
        } catch {
          validContent = false
        }
      }
      if (!validContent) {
        finalErrorCode = 'PROVIDER_INVALID_RESPONSE'
        await recordAiAttempt(options.usageClient, {
          requestId: reservation.request_id, attemptNumber, route, actualModel: result.actualModel,
          inputTokens: result.inputTokens, outputTokens: result.outputTokens,
          estimatedProviderCostMicros: cost.providerMicros, estimatedZarCostMicros: cost.zarMicros,
          status: 'failed', outcome: 'invalid_response', retryNumber: providerAttempts - 1,
          fallback: providerAttempts > 1, latencyMs, httpStatus: result.httpStatus,
          safeErrorCode: 'PROVIDER_INVALID_RESPONSE',
        })
        unrecordedProviderAttempts -= 1
        await observeProviderHealth(options.usageClient, route, reservation.request_id, 'failure', 'PROVIDER_INVALID_RESPONSE', result.httpStatus, latencyMs)
        continue
      }
      await recordAiAttempt(options.usageClient, {
        requestId: reservation.request_id, attemptNumber, route, actualModel: result.actualModel,
        inputTokens: result.inputTokens, outputTokens: result.outputTokens,
        estimatedProviderCostMicros: cost.providerMicros, estimatedZarCostMicros: cost.zarMicros,
        status: 'succeeded', outcome: 'success', retryNumber: providerAttempts - 1,
        fallback: providerAttempts > 1, latencyMs, httpStatus: result.httpStatus,
      })
      unrecordedProviderAttempts -= 1
      await observeProviderHealth(options.usageClient, route, reservation.request_id, 'success', null, result.httpStatus, latencyMs)
      const routed = { content: result.content, provider: config.name, model: result.actualModel ?? config.model }
      const replayPayload = options.buildReplayPayload?.(routed) ?? routed
      await finalizeAiUsageWithReplay(options.usageClient, {
        requestId: reservation.request_id,
        status: 'succeeded',
        latencyMs: Date.now() - startedAt,
        safeErrorCode: null,
        replay: {
          fingerprint: options.fingerprint,
          kind: options.replayKind ?? 'text_response',
          actorId: options.actorId,
          payload: replayPayload,
        },
      })
      finalStatus = 'succeeded'
      finalErrorCode = null
      return { ...routed, usageRequestId: reservation.request_id }
    }
    if (!hasAnyConfiguredProvider()) throw new Error('NO_AI_PROVIDER_KEYS')
    throw new Error('NO_AI_PROVIDER_AVAILABLE')
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_USAGE_FINALIZATION_FAILED') throw error
    if (finalStatus !== 'succeeded') {
      await finalizeAiUsage(
        options.usageClient, reservation.request_id, 'failed', Date.now() - startedAt, finalErrorCode,
        unrecordedProviderAttempts > 0,
      )
    }
    throw error
  }
}
