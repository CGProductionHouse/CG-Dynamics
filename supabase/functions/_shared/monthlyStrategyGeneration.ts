import { readStrategyData } from '../../../src/lib/strategyEngine.ts'
import { prepareDraft, strategyAutopilotMonths, type StrategyAutopilotClient } from './monthlyStrategyAutopilot.ts'
import { generateMonthlyStrategyProposal, monthlyStrategySourceDigest } from './monthlyStrategyModel.ts'
import { mergeMonthlyStrategyProposal } from './monthlyStrategyProposal.ts'
import type { MonthlyStrategyProposal } from './monthlyStrategyProposal.ts'
import type { AiUsageClient } from './aiUsage.ts'

type StrategyRow = {
  id: string
  client_id: string
  strategy_month: string
  workflow_status: string
  published_version: number | null
  version: number
  strategy_data: unknown
  seed_context: Record<string, unknown> | null
  staff_amended_at: string | null
  internal_notes: string | null
}

async function revisionKey(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  const hex = Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export async function runNextMonthStrategyGeneration(
  sb: StrategyAutopilotClient & AiUsageClient,
  input: { clientId: string; strategyMonth: string; today: string; systemProfileId: string },
  dependencies: {
    sourceDigest?: typeof monthlyStrategySourceDigest
    generateProposal?: (input: Parameters<typeof generateMonthlyStrategyProposal>[0]) => Promise<{
      proposal: MonthlyStrategyProposal; sourceDigest: string; provider: string
    }>
  } = {},
): Promise<Record<string, unknown>> {
  if (strategyAutopilotMonths(input.today)[1] !== input.strategyMonth) {
    return { ok: true, state: 'blocked', blocker: 'NOT_NEXT_MONTH' }
  }
  const [clientRead, strategyRead] = await Promise.all([
    sb.from('clients').select('id,name,active,package_settings').eq('id', input.clientId).maybeSingle(),
    sb.from('monthly_client_strategies')
      .select('id,client_id,strategy_month,workflow_status,published_version,version,strategy_data,seed_context,staff_amended_at,internal_notes')
      .eq('client_id', input.clientId).eq('strategy_month', input.strategyMonth).maybeSingle(),
  ])
  if (clientRead.error || strategyRead.error) throw new Error('STRATEGY_SOURCE_READ_UNAVAILABLE')
  const client = clientRead.data as Record<string, unknown> | null
  const target = strategyRead.data as StrategyRow | null
  if (!client || client.id !== input.clientId || client.active !== true || !target ||
      target.client_id !== input.clientId || target.strategy_month !== input.strategyMonth) {
    return { ok: true, state: 'blocked', blocker: 'EXACT_CLIENT_STRATEGY_UNAVAILABLE' }
  }
  if (target.workflow_status !== 'draft' || target.published_version !== null) {
    return { ok: true, state: 'blocked', blocker: 'REVIEWED_OR_PUBLISHED_STRATEGY' }
  }
  const prepared = await prepareDraft(sb, client, input.strategyMonth, input.today)
  if (prepared.blockers.length) return { ok: true, state: 'blocked', blockers: prepared.blockers }
  if (!prepared.evidence.some(row => ['client_guide', 'client_context_update', 'published_report', 'published_report_post', 'published_monthly_strategy'].includes(row.authority))) {
    return { ok: true, state: 'blocked', blocker: 'EXACT_STRATEGY_EVIDENCE_UNAVAILABLE' }
  }
  const current = readStrategyData(target.strategy_data)
  const preparedStrategy = readStrategyData(prepared.draft)
  const preparedFormats = Object.entries(preparedStrategy.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key).sort()
  const currentFormats = Object.entries(current.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key).sort()
  if (JSON.stringify(preparedFormats) !== JSON.stringify(currentFormats)) {
    return { ok: true, state: 'blocked', blocker: 'PACKAGE_STRATEGY_SCOPE_DRIFT' }
  }
  const sourceDigest = await (dependencies.sourceDigest ?? monthlyStrategySourceDigest)({
    clientId: input.clientId, strategyMonth: input.strategyMonth,
    draft: preparedStrategy, evidence: prepared.evidence,
    sourceWindows: prepared.seedContext.source_windows,
  })
  const previousGeneration = target.seed_context?.generation as Record<string, unknown> | undefined
  if (previousGeneration?.sourceDigest === sourceDigest && previousGeneration?.baseVersion === target.version - 1) {
    return { ok: true, state: 'unchanged' }
  }

  // One bounded provider request per exact client/month/source/version. The
  // AI router enforces the existing hard budget and replays a successful retry.
  const generated = await (dependencies.generateProposal ?? generateMonthlyStrategyProposal)({
    sb, actorId: input.systemProfileId,
    clientId: input.clientId, clientName: String(client.name),
    strategyMonth: input.strategyMonth, draft: preparedStrategy,
    evidence: prepared.evidence, sourceWindows: prepared.seedContext.source_windows, targetVersion: target.version,
  })
  if (generated.sourceDigest !== sourceDigest) throw new Error('STRATEGY_SOURCE_CHANGED_DURING_GENERATION')
  // A model response can arrive after a meeting decision, guide revision or
  // package correction. The row-version RPC fences staff edits, but those
  // independent sources need their own pre-write freshness check.
  const freshClientRead = await sb.from('clients').select('id,name,active,package_settings').eq('id', input.clientId).maybeSingle()
  if (freshClientRead.error) throw new Error('STRATEGY_SOURCE_READ_UNAVAILABLE')
  const freshClient = freshClientRead.data as Record<string, unknown> | null
  if (!freshClient || freshClient.id !== input.clientId || freshClient.active !== true) {
    return { ok: true, state: 'conflict', blocker: 'SOURCE_CHANGED_DURING_GENERATION' }
  }
  const freshPrepared = await prepareDraft(sb, freshClient, input.strategyMonth, input.today)
  if (freshPrepared.blockers.length) {
    return { ok: true, state: 'conflict', blocker: 'SOURCE_CHANGED_DURING_GENERATION' }
  }
  const freshStrategy = readStrategyData(freshPrepared.draft)
  const freshFormats = Object.entries(freshStrategy.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key).sort()
  if (JSON.stringify(freshFormats) !== JSON.stringify(preparedFormats)) {
    return { ok: true, state: 'conflict', blocker: 'SOURCE_CHANGED_DURING_GENERATION' }
  }
  const freshDigest = await (dependencies.sourceDigest ?? monthlyStrategySourceDigest)({
    clientId: input.clientId, strategyMonth: input.strategyMonth,
    draft: freshStrategy, evidence: freshPrepared.evidence,
    sourceWindows: freshPrepared.seedContext.source_windows,
  })
  if (freshDigest !== sourceDigest || freshClient.name !== client.name) {
    return { ok: true, state: 'conflict', blocker: 'SOURCE_CHANGED_DURING_GENERATION' }
  }
  const merged = mergeMonthlyStrategyProposal(target, generated.proposal, previousGeneration as {
    proposedGoldStandard?: MonthlyStrategyProposal['goldStandard']
    proposedActionPlan?: MonthlyStrategyProposal['actionPlan']
  } | undefined)
  if (merged.state === 'blocked' || !merged.strategyData) {
    return { ok: true, state: 'blocked', blocker: merged.reason ?? 'PROPOSAL_REJECTED' }
  }
  const nextContext = {
    ...(target.seed_context ?? {}),
    client_id: input.clientId,
    strategy_month: input.strategyMonth,
    sources: prepared.seedContext.sources,
    intelligence_evidence: prepared.seedContext.intelligence_evidence,
    source_coverage: prepared.seedContext.source_coverage,
    source_windows: prepared.seedContext.source_windows,
    generation: {
      sourceDigest,
      baseVersion: target.version,
      proposedSourceIds: generated.proposal.sourceIds,
      proposedGoldStandard: generated.proposal.goldStandard,
      proposedActionPlan: generated.proposal.actionPlan,
      filledFields: merged.filledFields,
      conflicts: merged.conflicts,
      provider: generated.provider,
      status: merged.conflicts.length ? 'review_conflicts' : 'draft_filled',
    },
  }
  const idempotencyKey = await revisionKey(`strategy-generation:${input.clientId}:${input.strategyMonth}:${sourceDigest}:${target.version}`)
  const amended = await sb.rpc('propose_monthly_client_strategy_generation', {
    p_client_id: input.clientId,
    p_strategy_month: input.strategyMonth,
    p_expected_version: target.version,
    p_strategy_data: merged.strategyData,
    p_seed_context: nextContext,
    p_internal_notes: target.internal_notes,
    p_actor_profile_id: input.systemProfileId,
    p_idempotency_key: idempotencyKey,
  })
  if (amended.error) {
    if (/version conflict/i.test(amended.error.message)) return { ok: true, state: 'conflict', blocker: 'MID_GENERATION_STAFF_EDIT' }
    throw new Error('STRATEGY_AMEND_FAILED')
  }
  return {
    ok: true, state: merged.conflicts.length ? 'review_conflicts' : 'draft_filled',
    filledFields: merged.filledFields.length, conflicts: merged.conflicts,
    strategyId: target.id, version: (amended.data as Record<string, unknown> | null)?.version ?? null,
  }
}
