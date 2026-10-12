import { AiDuplicateRequestError, estimatedRouteWithinCap, routeAiChat, selectRoutes } from '../cg-assistant-chat/ai-router.ts'
import { fetchAiUsageReplay, loadAiProviderRoutes, type AiProviderRoute, type AiUsageClient } from './aiUsage.ts'
import { configuredProviderNames } from './providerSecrets.ts'
import {
  buildMonthlyStrategyPrompt,
  parseMonthlyStrategyProposal,
  selectMonthlyStrategyEvidence,
  type MonthlyStrategyProposal,
  type ProposalEvidence,
} from './monthlyStrategyProposal.ts'
import type { ActionPlanKey, StrategyData } from '../../../src/lib/strategyEngine.ts'
import { monthlyStrategySourceDigest } from './monthlyStrategySourceDigest.ts'
export { monthlyStrategySourceDigest } from './monthlyStrategySourceDigest.ts'

const MAX_STRATEGY_OUTPUT_TOKENS = 2_400

export function monthlyStrategyPilotPromptBytes(system: string, user: string): number {
  return new TextEncoder().encode(system + user).length
}

export function selectMonthlyStrategyPilotRoute(
  routes: AiProviderRoute[],
  promptBytes: number,
  maxZarMicros: number,
  configuredProviders: ReadonlySet<string>,
  requestedRouteId?: string,
): { routeId: string; estimatedMaxZarMicros: number; costQuoteInputTokens: number } {
  // A UTF-8 byte ceiling plus request framing is conservative even for
  // non-ASCII client text. Unknown pricing fails closed.
  const maxInputTokens = promptBytes + 1_024
  if (!Number.isSafeInteger(maxZarMicros) || maxZarMicros <= 0 ||
      !Number.isSafeInteger(promptBytes) || promptBytes < 0 ||
      !Number.isSafeInteger(maxInputTokens) || maxInputTokens > 128_000) {
    throw new Error('STRATEGY_PILOT_COST_CAP_UNAVAILABLE')
  }
  for (const route of selectRoutes(routes, 'complex').filter(route =>
    configuredProviders.has(route.provider) && (!requestedRouteId || route.id === requestedRouteId))) {
    const quote = estimatedRouteWithinCap(route, maxInputTokens, MAX_STRATEGY_OUTPUT_TOKENS, maxZarMicros)
    if (quote !== null) {
      return { routeId: route.id, estimatedMaxZarMicros: quote, costQuoteInputTokens: maxInputTokens }
    }
  }
  throw new Error('STRATEGY_PILOT_COST_CAP_UNAVAILABLE')
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function generateMonthlyStrategyProposal(input: {
  sb: AiUsageClient
  actorId: string
  clientId: string
  clientName: string
  strategyMonth: string
  draft: StrategyData
  evidence: ProposalEvidence[]
  sourceWindows?: Record<string, unknown>
  targetVersion: number
  generationPurpose?: 'next_month' | 'current_context'
  pilot?: { maxZarMicros: number; grantId: string; routeId?: string }
}): Promise<{ proposal: MonthlyStrategyProposal; sourceDigest: string; provider: string }> {
  // The provider may cite only evidence actually included in its bounded prompt.
  const sourceIds = new Set(selectMonthlyStrategyEvidence(input.evidence).map(row => row.source_id).filter(Boolean))
  if (sourceIds.size === 0) throw new Error('STRATEGY_EVIDENCE_UNAVAILABLE')
  const enabledFormats = new Set((Object.keys(input.draft.actionPlan) as ActionPlanKey[])
    .filter(key => input.draft.actionPlan[key].enabled))
  const sourceDigest = await monthlyStrategySourceDigest(input)
  const fingerprint = await sha256(`${sourceDigest}:${input.targetVersion}`)
  const prompt = buildMonthlyStrategyPrompt(input)
  const pilotRoute = input.pilot
    ? selectMonthlyStrategyPilotRoute(
      await loadAiProviderRoutes(input.sb, 'text'),
      monthlyStrategyPilotPromptBytes(prompt.system, prompt.user),
      input.pilot.maxZarMicros,
      new Set(configuredProviderNames('text')),
      input.pilot.routeId,
    ) : null
  const allowed = { clientId: input.clientId, strategyMonth: input.strategyMonth, sourceIds, enabledFormats }
  let content: string
  let provider: string
  try {
    const routed = await routeAiChat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      {
        usageClient: input.sb,
        feature: 'monthly_strategy',
        action: input.pilot ? 'pilot_generate_next_month_draft'
          : input.generationPurpose === 'current_context' ? 'revise_current_month_context' : 'generate_next_month_draft',
        actorId: input.actorId,
        idempotencyKey: input.pilot
          ? `monthly-strategy-pilot:${input.clientId}:${input.strategyMonth}:${input.pilot.grantId}`
          : `monthly-strategy:${input.clientId}:${input.strategyMonth}:${fingerprint}`,
        fingerprint,
        complexity: 'complex',
        maxOutputTokens: MAX_STRATEGY_OUTPUT_TOKENS,
        ...(pilotRoute ? {
          routeId: pilotRoute.routeId,
          maxEstimatedZarMicros: input.pilot?.maxZarMicros ?? 0,
          costQuoteInputTokens: pilotRoute.costQuoteInputTokens,
        } : {}),
        validateContent: value => parseMonthlyStrategyProposal(value, allowed) !== null,
      },
    )
    content = routed.content
    provider = routed.provider
  } catch (error) {
    if (!(error instanceof AiDuplicateRequestError)) throw error
    const replay = await fetchAiUsageReplay<{ content?: unknown; provider?: unknown }>(
      input.sb, error.requestId, fingerprint, 'text_response', input.actorId,
    )
    if (typeof replay?.content !== 'string') throw new Error('STRATEGY_REPLAY_UNAVAILABLE', { cause: error })
    content = replay.content
    provider = typeof replay.provider === 'string' ? replay.provider : 'replayed'
  }
  const proposal = parseMonthlyStrategyProposal(content, allowed)
  if (!proposal) throw new Error('STRATEGY_PROVIDER_RESPONSE_INVALID')
  return { proposal, sourceDigest, provider }
}
