import { supabase } from './supabase'

export type RuntimeHealth = 'healthy' | 'degraded' | 'unavailable' | 'unknown'
export type ProviderDisplayStatus = RuntimeHealth | 'disabled' | 'missing' | 'stale' | 'configured' | 'authentication_failed' | 'temporary_outage'

export type DashboardRequestSnapshot = {
  month: string
  loadSequence: number
}

export function isCurrentDashboardRequest(
  snapshot: DashboardRequestSnapshot,
  currentMonth: string,
  currentLoadSequence: number,
): boolean {
  return snapshot.month === currentMonth && snapshot.loadSequence === currentLoadSequence
}

export type UsageSummary = {
  requests: number
  attempts: number
  succeeded: number
  failed: number
  skipped: number
  denied: number
  retries: number
  fallbacks: number
  avg_latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  audio_seconds: number | null
  token_eligible_attempts: number
  unknown_input_attempts: number
  unknown_output_attempts: number
  audio_eligible_attempts: number
  unknown_audio_attempts: number
  estimated_zar_cost_micros: number | null
  known_cost_attempts: number
  unknown_cost_attempts: number
}

export type AiBudget = {
  month: string
  soft_limit_zar_micros: number
  hard_limit_zar_micros: number
  committed_zar_micros: number
  reserved_zar_micros: number
  warning_threshold_percent: number
  version: number
  created_at: string
  updated_at: string
}

export type UsageSeriesRow = {
  day?: string
  month?: string
  requests: number
  attempts: number
  succeeded: number
  failed: number
  skipped: number
  denied: number
  retries: number
  fallbacks: number
  input_tokens: number | null
  output_tokens: number | null
  audio_seconds: number | null
  token_eligible_attempts: number
  unknown_input_attempts: number
  unknown_output_attempts: number
  audio_eligible_attempts: number
  unknown_audio_attempts: number
  estimated_zar_cost_micros: number | null
  known_cost_attempts: number
  unknown_cost_attempts: number
  avg_latency_ms: number | null
}

export type UsageDimensionRow = UsageSeriesRow & {
  actor_id?: string
  full_name?: string | null
  feature?: string
  action?: string
}

export type ProviderUsageRow = {
  provider: string
  model: string
  attempts: number
  succeeded: number
  failed: number
  skipped: number
  denied: number
  retries: number
  fallbacks: number
  input_tokens: number | null
  output_tokens: number | null
  audio_seconds: number | null
  token_eligible_attempts: number
  unknown_input_attempts: number
  unknown_output_attempts: number
  audio_eligible_attempts: number
  unknown_audio_attempts: number
  estimated_zar_cost_micros: number | null
  known_cost_attempts: number
  unknown_cost_attempts: number
  avg_latency_ms: number | null
}

export type CurrencyCost = {
  currency: 'USD' | 'ZAR'
  provider_cost_micros: number | null
  zar_cost_micros: number | null
  priced_attempts: number
  attempts: number
  succeeded: number
  failed: number
  denied: number
  skipped: number
  retries: number
  fallbacks: number
  input_tokens: number | null
  output_tokens: number | null
  audio_seconds: number | null
  token_eligible_attempts: number
  unknown_input_attempts: number
  unknown_output_attempts: number
  audio_eligible_attempts: number
  unknown_audio_attempts: number
  known_cost_attempts: number
  unknown_cost_attempts: number
  avg_latency_ms: number | null
}

export type ProviderRoute = {
  id: string
  capability: 'text' | 'transcription'
  provider: string
  model: string
  tier: 'cheap' | 'strong'
  priority: number
  enabled: boolean
  pricing_currency: 'USD' | 'ZAR'
  pricing_as_of: string
  input_per_million_micros: number | null
  output_per_million_micros: number | null
  audio_per_minute_micros: number | null
  request_cost_micros: number | null
  runtime_status: RuntimeHealth
  last_observed_at: string | null
  last_latency_ms: number | null
  safe_error_code: string | null
}

export function getProviderDisplayStatus(
  route: ProviderRoute,
  configured: boolean | undefined,
  now: number,
): ProviderDisplayStatus {
  if (!route.enabled) return 'disabled'
  if (configured === false) return 'missing'
  if (!route.last_observed_at) return configured ? 'configured' : 'unknown'
  const observedAt = Date.parse(route.last_observed_at)
  if (!Number.isFinite(observedAt) || now - observedAt > 15 * 60 * 1000) return 'stale'
  if (route.safe_error_code === 'PROVIDER_AUTH') return 'authentication_failed'
  if (['PROVIDER_RATE_LIMIT', 'PROVIDER_UPSTREAM', 'PROVIDER_TIMEOUT', 'PROVIDER_NETWORK_ERROR'].includes(route.safe_error_code ?? '')) return 'temporary_outage'
  return route.runtime_status
}

export type AiUsageAggregates = {
  month: string
  summary: UsageSummary
  budget: AiBudget | null
  daily: UsageSeriesRow[]
  monthly: UsageSeriesRow[]
  users: UsageDimensionRow[]
  features: UsageDimensionRow[]
  providers: ProviderUsageRow[]
  currency_costs: CurrencyCost[]
  routes: ProviderRoute[]
}

export type MaskedProviderDiagnostic = {
  routeId: string
  capability: 'text' | 'transcription'
  provider: string
  model: string
  configured: boolean
  keyStatus: 'configured (masked)' | 'configured (legacy alias)' | 'missing'
  optional: boolean
  enabled: boolean
}

type DiagnosticsResponse = {
  ok: boolean
  diagnostics?: { providers?: MaskedProviderDiagnostic[] }
  error?: string
}

type HealthCheckResponse = {
  ok: boolean
  result?: { success: boolean; provider?: string; model?: string; message?: string; error?: string }
  error?: string
}

export function monthStart(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`
}

export async function getAiUsageAggregates(month: string): Promise<AiUsageAggregates> {
  const { data, error } = await supabase.rpc('ai_admin_usage_aggregates', { p_month: month })
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('AI usage aggregates did not return data.')
  return data as unknown as AiUsageAggregates
}

export async function setAiBudget(input: {
  month: string
  softLimitZar: number
  hardLimitZar: number
  warningThresholdPercent: number
  expectedVersion: number
}): Promise<AiBudget> {
  const { data, error } = await supabase.rpc('ai_admin_set_budget', {
    p_month: input.month,
    p_soft_limit_zar_micros: Math.round(input.softLimitZar * 1_000_000),
    p_hard_limit_zar_micros: Math.round(input.hardLimitZar * 1_000_000),
    p_warning_threshold_percent: input.warningThresholdPercent,
    p_expected_version: input.expectedVersion,
  })
  if (error) throw error
  if (!data) throw new Error('AI budget update did not return data.')
  return data as unknown as AiBudget
}

export async function getMaskedProviderDiagnostics(): Promise<MaskedProviderDiagnostic[]> {
  const { data, error } = await supabase.functions.invoke<DiagnosticsResponse>('cg-assistant-chat', {
    body: { action: 'diagnostics' },
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error ?? 'Masked provider diagnostics failed.')
  return data.diagnostics?.providers ?? []
}

export async function runMaskedProviderHealthCheck(provider: string, routeId: string): Promise<HealthCheckResponse['result']> {
  const { data, error } = await supabase.functions.invoke<HealthCheckResponse>('cg-assistant-chat', {
    body: { action: 'test_provider', provider, routeId, requestId: crypto.randomUUID() },
  })
  if (error) throw error
  if (!data?.ok || !data.result) throw new Error(data?.error ?? 'Provider health check failed.')
  return data.result
}

export async function runTranscriptionProviderHealthCheck(
  provider: string,
  routeId: string,
  audio: File,
): Promise<HealthCheckResponse['result'] & { audioSeconds?: number }> {
  const body = new FormData()
  body.set('action', 'transcription_health')
  body.set('provider', provider)
  body.set('routeId', routeId)
  body.set('requestId', crypto.randomUUID())
  body.set('durationSeconds', '0')
  body.set('audio', audio, audio.name || 'provider-health.webm')
  const { data, error } = await supabase.functions.invoke<HealthCheckResponse>('meeting-debrief', { body })
  if (error) throw error
  if (!data?.ok || !data.result) throw new Error(data?.error ?? 'Transcription provider health check failed.')
  return data.result
}
