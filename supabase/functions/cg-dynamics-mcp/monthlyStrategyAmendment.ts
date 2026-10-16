// Explicit staff-requested editorial amendments, NOT the automatic gap-filling lane.
// Existing draft, sources, version and exact old field must all agree before a write.
import { GOLD_STANDARD_FIELDS, readStrategyData, type ActionPlanKey } from '../../../src/lib/strategyEngine.ts'
import { selectMonthlyStrategyEvidence, validateMonthlyStrategyProposal } from '../_shared/monthlyStrategyProposal.ts'
import type { StrategyAutopilotClient } from '../_shared/monthlyStrategyAutopilot.ts'
import { loadMonthlyStrategyWorkspace, strategyMcpInputHash, strategyMonthIsCurrentOrNext } from './monthlyStrategyWorkspace.ts'

type FieldChange = { path: string; expected: string | string[]; replacement: string | string[] }
const GOLD_PATHS = new Set(GOLD_STANDARD_FIELDS.map(field => `goldStandard.${field.key}`))
const FORMATS = ['professional_video', 'reels', 'photo_content', 'design_poster', 'animated_poster', 'campaign_recommendation']
const ACTION_PATHS = new Set(FORMATS.map(key => `actionPlan.${key}.items`))

function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b) }
function field(root: Record<string, unknown>, path: string): unknown {
  let current: unknown = root
  for (const key of path.split('.')) {
    if (!current || typeof current !== 'object' || !Object.hasOwn(current, key)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function validChanges(value: unknown): value is FieldChange[] {
  if (!Array.isArray(value) || !value.length || value.length > 20) return false
  const seen = new Set<string>()
  return value.every(change => {
    if (!change || typeof change !== 'object' || Object.keys(change).some(key => !['path', 'expected', 'replacement'].includes(key))) return false
    const { path, expected, replacement } = change
    if (typeof path !== 'string' || seen.has(path)) return false
    seen.add(path)
    if (GOLD_PATHS.has(path)) return typeof expected === 'string' && typeof replacement === 'string' && expected.length <= 12000 && replacement.length <= 12000
    if (!ACTION_PATHS.has(path)) return false
    return [expected, replacement].every(items => Array.isArray(items) && items.length <= 24 && items.every(item => typeof item === 'string' && item.length <= 3000))
  })
}

export async function amendMonthlyStrategyFields(
  sb: StrategyAutopilotClient,
  input: {
    clientId: string; strategyMonth: string; today: string; evidenceFingerprint: string
    expectedVersion: number; sourceIds: unknown; changes: unknown; actorProfileId: string; idempotencyKey: string
  },
  dependencies: NonNullable<Parameters<typeof loadMonthlyStrategyWorkspace>[4]> = {},
) {
  if (!strategyMonthIsCurrentOrNext(input.today, input.strategyMonth)) return { error: 'CURRENT_OR_NEXT_MONTH_REQUIRED' }
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1) return { error: 'INVALID_EXPECTED_VERSION' }
  if (!validChanges(input.changes)) return { error: 'INVALID_STRATEGY_FIELD_CHANGES' }
  if (!Array.isArray(input.sourceIds) || !input.sourceIds.length || input.sourceIds.length > 25 || input.sourceIds.some(id => typeof id !== 'string')) return { error: 'INVALID_STRATEGY_CITATIONS' }
  const changes = input.changes
  const requestFingerprint = await strategyMcpInputHash({
    clientId: input.clientId, strategyMonth: input.strategyMonth,
    evidenceFingerprint: input.evidenceFingerprint, expectedVersion: input.expectedVersion,
    sourceIds: input.sourceIds, changes, actorProfileId: input.actorProfileId,
  })
  // Canonical append-only revision owns timeout/crash replay, even after another edit.
  const replay = await sb.from('monthly_client_strategy_revisions').select('receipt,actor_profile_id')
    .eq('client_id', input.clientId).eq('strategy_month', input.strategyMonth)
    .eq('idempotency_key', input.idempotencyKey).maybeSingle()
  if (replay.error) return { error: 'STRATEGY_REPLAY_READ_UNAVAILABLE' }
  if (replay.data) {
    const row = replay.data as { receipt?: Record<string, unknown>; actor_profile_id?: string }
    const receipt = row.receipt ?? {}
    const context = receipt.after_seed_context as Record<string, unknown> | undefined
    const amendment = context?.editorial_amendment as Record<string, unknown> | undefined
    if (row.actor_profile_id !== input.actorProfileId || amendment?.requestFingerprint !== requestFingerprint) return { error: 'STRATEGY_IDEMPOTENCY_CONFLICT' }
    return { state: 'replayed', strategy_id: receipt.strategy_id, version: receipt.version, changed_fields: changes.map(change => change.path), published: false }
  }

  const workspace = await loadMonthlyStrategyWorkspace(sb, input.clientId, input.strategyMonth, input.today, dependencies)
  if (workspace.blockers.length) return { error: 'STRATEGY_BLOCKED', blockers: workspace.blockers }
  const { target, prepared } = workspace
  if (!target) return { error: 'EXISTING_STRATEGY_DRAFT_REQUIRED' }
  if (target.version !== input.expectedVersion) return { error: 'STRATEGY_VERSION_CONFLICT' }
  if (workspace.evidenceFingerprint !== input.evidenceFingerprint) return { error: 'STRATEGY_SOURCE_CHANGED' }
  if (target.seed_context?.client_id !== input.clientId || target.seed_context?.strategy_month !== input.strategyMonth) return { error: 'STRATEGY_PROVENANCE_MISMATCH' }
  const raw = target.strategy_data
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'INVALID_STRATEGY_DATA' }
  const candidate = structuredClone(raw) as Record<string, unknown>
  for (const change of changes) {
    if (ACTION_PATHS.has(change.path) && !workspace.preparedFormats.includes(change.path.split('.')[1])) return { error: 'FORMAT_NOT_CONFIRMED' }
    if (!same(field(candidate, change.path), change.expected)) return { error: 'STRATEGY_FIELD_CONFLICT', field: change.path, instruction: 'Read the fresh field; never overwrite a newer staff edit.' }
    const keys = change.path.split('.')
    let parent = candidate
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>
    parent[keys[keys.length - 1]] = structuredClone(change.replacement)
  }
  const normalized = readStrategyData(candidate)
  const validation = validateMonthlyStrategyProposal(JSON.stringify({
    clientId: input.clientId, strategyMonth: input.strategyMonth, sourceIds: input.sourceIds,
    goldStandard: normalized.goldStandard,
    actionPlan: Object.fromEntries(workspace.preparedFormats.map(key => [key, normalized.actionPlan[key as ActionPlanKey].items])),
  }), {
    clientId: input.clientId, strategyMonth: input.strategyMonth,
    sourceIds: new Set(selectMonthlyStrategyEvidence(prepared.evidence).map(row => row.source_id)),
    enabledFormats: new Set(workspace.preparedFormats as ActionPlanKey[]),
    confirmedCapacity: prepared.seedContext.source_windows?.confirmed_package_scope as Record<string, unknown> | null | undefined,
  })
  if (!validation.proposal) return { error: 'STRATEGY_PROPOSAL_INVALID', issues: validation.issues }
  if (same(raw, candidate)) return { state: 'unchanged', strategy_id: target.id, version: target.version, published: false }
  const fresh = await loadMonthlyStrategyWorkspace(sb, input.clientId, input.strategyMonth, input.today, dependencies)
  if (fresh.blockers.length || fresh.evidenceFingerprint !== input.evidenceFingerprint || fresh.target?.version !== input.expectedVersion ||
      !same(fresh.target.strategy_data, raw) || !same(fresh.target.seed_context, target.seed_context) || fresh.target.internal_notes !== target.internal_notes) {
    return { error: 'STRATEGY_SOURCE_OR_VERSION_CHANGED' }
  }
  const result = await sb.rpc('amend_monthly_client_strategy_with_context', {
    p_client_id: input.clientId, p_strategy_month: input.strategyMonth,
    p_expected_version: input.expectedVersion, p_strategy_data: candidate,
    p_seed_context: { ...target.seed_context, editorial_amendment: {
      provider: 'chatgpt_company_admin_mcp', requestFingerprint,
      evidenceFingerprint: input.evidenceFingerprint, sourceIds: input.sourceIds,
      changedFields: changes.map(change => change.path), baseVersion: target.version,
    } },
    p_internal_notes: target.internal_notes, p_actor_profile_id: input.actorProfileId,
    p_idempotency_key: input.idempotencyKey,
  })
  if (result.error) return { error: /version conflict|idempotency/i.test(result.error.message) ? 'STRATEGY_CONCURRENT_CHANGE' : 'STRATEGY_AMENDMENT_WRITE_FAILED' }
  const receipt = (result.data ?? {}) as Record<string, unknown>
  if (receipt.strategy_id !== target.id || receipt.client_id !== input.clientId || receipt.strategy_month !== input.strategyMonth ||
      receipt.version !== input.expectedVersion + 1 || receipt.workflow_status !== 'draft') return { error: 'STRATEGY_AMENDMENT_UNCONFIRMED', instruction: 'Read the exact draft and canonical revision before retrying the same key; do not claim this save completed.' }
  return { state: 'draft_amended', client_id: input.clientId, strategy_month: input.strategyMonth,
    strategy_id: receipt.strategy_id, version: receipt.version, workflow_status: receipt.workflow_status,
    changed_fields: changes.map(change => change.path), published: false }
}
