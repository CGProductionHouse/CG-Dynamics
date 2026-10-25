// Local/read-only review of an exact Graph task-details capture. This deliberately
// returns NO write payload, admission decision, URLs, text or credentials. It is
// not connected to the sync/apply path. Missing capture != an empty checklist.
export interface MetadataIdentity {
  planId: string
  taskId: string
  clientId: string | null
}

export interface PlannerMetadataReviewInput {
  source: MetadataIdentity & {
    complete: boolean
    capturedAt: string
    details: Record<string, unknown> | null
  }
  target: MetadataIdentity & { id: string; updatedAt: string; checklist: unknown }
  // A baseline is optional reviewed evidence, NOT manufactured from the current
  // target. No baseline means no proof of source ownership of local checklist.
  baseline?: MetadataIdentity & {
    targetId: string
    capturedAt: string
    details: Record<string, unknown>
    localChecklist: unknown
  }
}

type Observation = 'missing' | 'invalid' | 'observed_empty' | 'observed'
type Decision = 'hold' | 'unchanged' | 'review_required' | 'preserve_staff' | 'source_and_staff_changed'

function plainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null))
}

function exactIdentity(left: MetadataIdentity, right: MetadataIdentity): boolean {
  const valid = (value: MetadataIdentity) => typeof value.planId === 'string' && Boolean(value.planId.trim())
    && typeof value.taskId === 'string' && Boolean(value.taskId.trim())
    && Object.hasOwn(value, 'clientId') && (value.clientId === null || (typeof value.clientId === 'string' && Boolean(value.clientId.trim())))
  return Boolean(valid(left) && valid(right)
    && left.planId === right.planId && left.taskId === right.taskId && left.clientId === right.clientId)
}

// Keys are unordered JSON properties; array order and every metadata value remain
// significant. Do not equate source deletion/missing fields with explicit empties.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (plainObject(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}

function collection(details: Record<string, unknown>, field: 'checklist' | 'references'): Observation {
  if (!Object.hasOwn(details, field)) return 'missing'
  const value = details[field]
  if (!plainObject(value)) return 'invalid'
  const entries = Object.entries(value).filter(([key]) => !key.startsWith('@odata.'))
  if (entries.some(([key, item]) => !key.trim() || !plainObject(item)
    || (field === 'checklist' && (typeof item.title !== 'string' || typeof item.isChecked !== 'boolean')))) return 'invalid'
  return entries.length ? 'observed' : 'observed_empty'
}

export function reviewPlannerMetadata(input: PlannerMetadataReviewInput) {
  const { source, target, baseline } = input
  const result: {
    decision: Decision; reason: string; checklist: Observation; references: Observation;
    previewType: Observation; localChecklistPreserved: true; automaticApply: false;
  } = {
    decision: 'hold', reason: 'SOURCE_NOT_VERIFIED', checklist: 'missing', references: 'missing',
    previewType: 'missing', localChecklistPreserved: true, automaticApply: false,
  }
  const validTime = (value: string) => typeof value === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value))
  if (!source || !target || !exactIdentity(source, target) || typeof target.id !== 'string' || !target.id.trim()) return { ...result, reason: 'IDENTITY_MISMATCH' }
  if (source.complete !== true || !validTime(source.capturedAt) || !validTime(target.updatedAt)
    || !plainObject(source.details)) return result
  if (source.details.id !== source.taskId) return { ...result, reason: 'DETAIL_ID_MISMATCH' }
  if (typeof source.details['@odata.etag'] !== 'string' || !source.details['@odata.etag'].trim()) return { ...result, reason: 'SOURCE_REVISION_MISSING' }
  result.checklist = collection(source.details, 'checklist')
  result.references = collection(source.details, 'references')
  if (Object.hasOwn(source.details, 'previewType')) {
    result.previewType = ['automatic', 'noPreview', 'checklist', 'description', 'reference'].includes(String(source.details.previewType)) ? 'observed' : 'invalid'
  }
  if ([result.checklist, result.references, result.previewType].some(status => status === 'invalid' || status === 'missing')) {
    return { ...result, reason: 'METADATA_INCOMPLETE_OR_INVALID' }
  }
  if (!Array.isArray(target.checklist)) return { ...result, reason: 'LOCAL_CHECKLIST_UNVERIFIED' }
  if (!baseline) return { ...result, decision: 'review_required' as const, reason: 'NO_REVIEWED_BASELINE' }
  if (!exactIdentity(source, baseline) || baseline.targetId !== target.id
    || baseline.details.id !== source.taskId || !validTime(baseline.capturedAt)
    || typeof baseline.details['@odata.etag'] !== 'string' || !baseline.details['@odata.etag'].trim()
    || Date.parse(source.capturedAt) < Date.parse(baseline.capturedAt)
    || !Array.isArray(baseline.localChecklist)
    || collection(baseline.details, 'checklist') === 'missing'
    || collection(baseline.details, 'checklist') === 'invalid') return { ...result, reason: 'BASELINE_IDENTITY_OR_CAPTURE_DRIFT' }
  const staffChanged = canonical(target.checklist) !== canonical(baseline.localChecklist)
  const sourceChanged = canonical(source.details) !== canonical(baseline.details)
  return {
    ...result,
    decision: staffChanged ? sourceChanged ? 'source_and_staff_changed' as const : 'preserve_staff' as const
      : sourceChanged ? 'review_required' as const : 'unchanged' as const,
    reason: staffChanged ? 'STAFF_CHECKLIST_MUST_NOT_BE_OVERWRITTEN' : sourceChanged ? 'SOURCE_CHANGE_REQUIRES_EXPLICIT_REVIEW' : 'EXACT_BASELINE_UNCHANGED',
  }
}
