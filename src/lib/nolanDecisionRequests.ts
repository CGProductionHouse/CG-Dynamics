/**
 * Pure proposal preparation, NOT permission enforcement or a persistence adapter.
 * The server must derive actor/source access, check current revision and authorize
 * the explicit recipient atomically. Never accept this result as authorization.
 */
export type DecisionSource = 'work_task' | 'video' | 'monthly_deliverable'
export type DecisionRequestProposal = {
  sourceType: DecisionSource
  sourceId: string
  expectedRevision: string
  recipientProfileId: string
  question: string
  idempotencyKey: string
}
export type DecisionRequestReceipt = DecisionRequestProposal & {
  requestId: string
  requestedByProfileId: string
  requestedAt: string
  state: 'pending' | 'resolved' | 'withdrawn' | 'superseded'
}
/** No actor, status, grant or approval fields are taken from a UI draft. */
export function prepareDecisionRequest(draft: DecisionRequestProposal): DecisionRequestProposal {
  if (!['work_task', 'video', 'monthly_deliverable'].includes(draft.sourceType)) throw new Error('Unsupported decision source')
  for (const key of ['sourceId', 'expectedRevision', 'recipientProfileId', 'idempotencyKey'] as const) {
    if (typeof draft[key] !== 'string' || !draft[key].trim() || draft[key] !== draft[key].trim() || draft[key].length > 200) throw new Error('Missing or invalid ' + key)
  }
  if (typeof draft.question !== 'string' || !draft.question.trim() || draft.question.trim().length > 4000) throw new Error('A decision question is required (maximum 4000 characters)')
  return { sourceType: draft.sourceType, sourceId: draft.sourceId, expectedRevision: draft.expectedRevision,
    recipientProfileId: draft.recipientProfileId, question: draft.question.trim(), idempotencyKey: draft.idempotencyKey }
}
export type DecisionQueueResult =
  | { state: 'unavailable'; rows: []; reason: string }
  | { state: 'complete'; rows: DecisionRequestReceipt[] }
/**
 * Presentation selector for a COMPLETE server-authorized response only.
 * currentRevisions must come from the same authorized snapshot, not caller notes.
 * No endpoint exists yet: keep this out of the live workbook until its RLS/RPC
 * and same-origin acceptance pass. Missing/partial reads must not appear empty.
 */
export function selectPendingDecisions(
  viewerProfileId: string | null,
  receipts: readonly DecisionRequestReceipt[],
  currentRevisions: ReadonlyMap<string, string> | null,
  complete: boolean,
): DecisionQueueResult {
  const unavailable = (reason: string): DecisionQueueResult => ({ state: 'unavailable', rows: [], reason })
  if (!viewerProfileId?.trim() || !complete || !currentRevisions) return unavailable('Decision source or account verification incomplete')
  const seen = new Set<string>()
  const rows: DecisionRequestReceipt[] = []
  for (const receipt of receipts) {
    try { prepareDecisionRequest(receipt) } catch { return unavailable('Invalid decision source receipt') }
    if (!receipt.requestId?.trim() || !receipt.requestedByProfileId?.trim() || !Number.isFinite(Date.parse(receipt.requestedAt))
      || !['pending', 'resolved', 'withdrawn', 'superseded'].includes(receipt.state)) return unavailable('Invalid decision lifecycle receipt')
    if (seen.has(receipt.requestId)) return unavailable('Duplicate decision request receipt')
    seen.add(receipt.requestId)
    if (receipt.recipientProfileId !== viewerProfileId || receipt.state !== 'pending') continue
    const key = decisionSourceKey(receipt.sourceType, receipt.sourceId)
    const revision = currentRevisions.get(key)
    if (!revision) return unavailable('Current decision source revision unavailable')
    if (revision === receipt.expectedRevision) rows.push({ ...receipt })
  }
  return { state: 'complete', rows }
}
export function decisionSourceKey(sourceType: DecisionSource, sourceId: string): string {
  return JSON.stringify([sourceType, sourceId])
}
