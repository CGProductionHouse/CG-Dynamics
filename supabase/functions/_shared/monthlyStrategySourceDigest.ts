import type { StrategyData } from '../../../src/lib/strategyEngine.ts'
import type { ProposalEvidence } from './monthlyStrategyProposal.ts'

/** One exact-client source fence shared by provider generation and ChatGPT draft intake. */
export async function monthlyStrategySourceDigest(input: {
  clientId: string
  strategyMonth: string
  draft: StrategyData
  evidence: ProposalEvidence[]
  sourceWindows?: Record<string, unknown>
}): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({
    clientId: input.clientId,
    strategyMonth: input.strategyMonth,
    enabledFormats: Object.entries(input.draft.actionPlan).filter(([, section]) => section.enabled).map(([key]) => key),
    evidence: input.evidence,
    sourceWindows: input.sourceWindows ?? {},
  })))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}
