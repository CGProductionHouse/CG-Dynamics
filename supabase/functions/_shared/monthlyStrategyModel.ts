import { AiDuplicateRequestError, routeAiChat } from '../cg-assistant-chat/ai-router.ts'
import { fetchAiUsageReplay, type AiUsageClient } from './aiUsage.ts'
import {
  buildMonthlyStrategyPrompt,
  parseMonthlyStrategyProposal,
  type MonthlyStrategyProposal,
  type ProposalEvidence,
} from './monthlyStrategyProposal.ts'
import type { ActionPlanKey, StrategyData } from '../../../src/lib/strategyEngine.ts'

const MAX_STRATEGY_OUTPUT_TOKENS = 2_400

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function monthlyStrategySourceDigest(input: {
  clientId: string
  strategyMonth: string
  draft: StrategyData
  evidence: ProposalEvidence[]
  sourceWindows?: Record<string, unknown>
}): Promise<string> {
  return sha256(JSON.stringify({
    clientId: input.clientId,
    strategyMonth: input.strategyMonth,
    enabledFormats: Object.entries(input.draft.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key),
    evidence: input.evidence,
    sourceWindows: input.sourceWindows ?? {},
  }))
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
}): Promise<{ proposal: MonthlyStrategyProposal; sourceDigest: string; provider: string }> {
  const sourceIds = new Set(input.evidence.map(row => row.source_id).filter(Boolean))
  if (sourceIds.size === 0) throw new Error('STRATEGY_EVIDENCE_UNAVAILABLE')
  const enabledFormats = new Set((Object.keys(input.draft.actionPlan) as ActionPlanKey[])
    .filter(key => input.draft.actionPlan[key].enabled))
  const sourceDigest = await monthlyStrategySourceDigest(input)
  const fingerprint = await sha256(`${sourceDigest}:${input.targetVersion}`)
  const prompt = buildMonthlyStrategyPrompt(input)
  const allowed = { clientId: input.clientId, strategyMonth: input.strategyMonth, sourceIds, enabledFormats }
  let content: string
  let provider: string
  try {
    const routed = await routeAiChat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      {
        usageClient: input.sb,
        feature: 'monthly_strategy',
        action: 'generate_next_month_draft',
        actorId: input.actorId,
        idempotencyKey: `monthly-strategy:${input.clientId}:${input.strategyMonth}:${fingerprint}`,
        fingerprint,
        complexity: 'complex',
        maxOutputTokens: MAX_STRATEGY_OUTPUT_TOKENS,
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
