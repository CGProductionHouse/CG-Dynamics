import {
  inferMicrosoftEventType,
  microsoftOutlookSourceKey,
  microsoftPlannerSourceKey,
  resolveMicrosoftBucketMapping,
  resolveMicrosoftPlanMapping,
} from './microsoftImportMap'
import type {
  MicrosoftClientSchedulePayload,
  MicrosoftConflictCode,
  MicrosoftImportPreviewItem,
  MicrosoftImportSourceRecord,
  MicrosoftOutlookEventSource,
  MicrosoftPlannerPayload,
  MicrosoftPlannerTaskSource,
} from './microsoftImport'

export interface MicrosoftPreviewClient {
  id: string
  name: string
}

export interface MicrosoftPreviewBoard {
  id: string
  slug: string
}

export interface MicrosoftPreviewBucket {
  id: string
  boardId: string
  name: string
}

export interface MicrosoftPreviewMappingContext {
  clients: MicrosoftPreviewClient[]
  boards: MicrosoftPreviewBoard[]
  buckets: MicrosoftPreviewBucket[]
}

type ClientResolution =
  | { status: 'matched'; client: MicrosoftPreviewClient }
  | { status: 'unresolved' | 'ambiguous'; client: null }

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
}

export function normalizeMicrosoftMatchName(value: string): string {
  return value.trim().toLocaleLowerCase('en-ZA').replace(/\s+/g, ' ')
}

export function resolveMicrosoftClient(name: string, clients: MicrosoftPreviewClient[]): ClientResolution {
  const key = normalizeMicrosoftMatchName(name)
  if (!key) return { status: 'unresolved', client: null }
  const matches = clients.filter(client => normalizeMicrosoftMatchName(client.name) === key)
  if (matches.length === 1) return { status: 'matched', client: matches[0] }
  if (matches.length > 1) return { status: 'ambiguous', client: null }
  return { status: 'unresolved', client: null }
}

function validDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))
}

function plannerDateIsValid(value: string | null): boolean {
  return value === null || validDateOnly(value)
}

function conflict(
  item: Omit<MicrosoftImportPreviewItem, 'previewStatus' | 'conflictCode' | 'conflictReason'>,
  code: MicrosoftConflictCode,
  reason: string,
): MicrosoftImportPreviewItem {
  return { ...item, previewStatus: 'conflict', conflictCode: code, conflictReason: reason }
}

function plannerProgress(percentComplete: number | null): MicrosoftPlannerPayload['status'] {
  if (percentComplete === 100) return 'approved'
  if (percentComplete !== null && percentComplete > 0) return 'in_progress'
  return 'to_do'
}

function planMonth(planName: string): string | null {
  const match = /^client socials\s*-\s*([a-z]+)\s+(\d{4})$/i.exec(planName.trim())
  if (!match) return null
  const month = MONTH_NAMES[match[1].toLowerCase()]
  return month ? `${match[2]}-${month}` : null
}

function deliverableIdentity(title: string): Pick<MicrosoftClientSchedulePayload, 'code' | 'deliverable_type'> {
  const match = /^\s*(DP|F|PHOTO|VIDEO|REEL)(?:\s*[-#]?\s*\d+)?\b/i.exec(title)
  if (!match) return { code: null, deliverable_type: null }
  const code = match[1].toUpperCase()
  if (code === 'DP') return { code: 'DP', deliverable_type: 'dp' }
  if (code === 'F' || code === 'PHOTO') return { code: 'F', deliverable_type: 'photo' }
  if (code === 'VIDEO') return { code: 'VIDEO', deliverable_type: 'video' }
  return { code: 'REEL', deliverable_type: 'reel' }
}

function plannerBase(source: MicrosoftPlannerTaskSource): Omit<MicrosoftImportPreviewItem, 'previewStatus' | 'conflictCode' | 'conflictReason'> {
  return {
    sourceType: source.sourceType,
    sourcePlanId: source.sourcePlanId || null,
    sourceCalendarId: null,
    sourceBucketId: source.sourceBucketId || null,
    sourceTaskId: source.sourceTaskId || null,
    sourceEventId: null,
    sourceName: source.sourcePlanName,
    title: source.title.trim(),
    description: source.description,
    startDate: source.startDate,
    endDate: null,
    dueDate: source.dueDate,
    assigneeMicrosoftIds: [...source.assigneeMicrosoftIds],
    destination: 'review',
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: null,
    proposedPayload: null,
  }
}

export function previewPlannerTask(
  source: MicrosoftPlannerTaskSource,
  context: MicrosoftPreviewMappingContext,
): MicrosoftImportPreviewItem {
  const base = plannerBase(source)
  const plan = resolveMicrosoftPlanMapping(source.sourcePlanName)

  if (!microsoftPlannerSourceKey(source.sourcePlanId, source.sourceTaskId)) {
    return conflict(base, 'missing_source_id', 'Planner plan and task IDs are required for exact deduplication.')
  }
  if (!source.title.trim()) return conflict(base, 'missing_title', 'The Microsoft task has no title.')
  if (!plannerDateIsValid(source.startDate) || !plannerDateIsValid(source.dueDate)) {
    return conflict(base, 'invalid_date', 'Planner dates must be valid YYYY-MM-DD values.')
  }
  if (plan.target === 'review') {
    return conflict(base, 'unsupported_plan', `Plan "${source.sourcePlanName}" has no approved destination mapping.`)
  }

  const bucketMapping = resolveMicrosoftBucketMapping(source.sourcePlanName, source.sourceBucketName)
  if (!source.sourceBucketId.trim() || !source.sourceBucketName.trim()) {
    return conflict(base, 'unsupported_bucket', 'A readable Planner bucket and source bucket ID are required.')
  }

  if (plan.target === 'client_schedule') {
    const month = planMonth(source.sourcePlanName)
    const client = resolveMicrosoftClient(source.sourceBucketName, context.clients)
    const identity = deliverableIdentity(source.title)
    const payload: MicrosoftClientSchedulePayload = {
      destination: 'client_schedule',
      client_id: client.client?.id ?? null,
      month,
      code: identity.code,
      title: source.title.trim(),
      deliverable_type: identity.deliverable_type,
      production_status: plannerProgress(source.percentComplete) === 'approved' ? 'scheduled_posted' : plannerProgress(source.percentComplete) === 'in_progress' ? 'in_production' : 'not_started',
      priority: 'normal',
      scheduled_date: source.dueDate,
      notes: source.description,
      microsoft_source_type: 'planner_client_social',
      microsoft_plan_id: source.sourcePlanId,
      microsoft_bucket_id: source.sourceBucketId,
      microsoft_task_id: source.sourceTaskId,
    }
    const mapped = { ...base, sourceType: 'planner_client_social' as const, destination: 'client_schedule' as const, mappedClientId: client.client?.id ?? null, mappedClientName: client.client?.name ?? null, proposedPayload: payload }
    if (!month) return conflict(mapped, 'invalid_date', 'The monthly plan name must include a valid month and year.')
    if (client.status === 'ambiguous') return conflict(mapped, 'ambiguous_client_match', `More than one active client exactly matches "${source.sourceBucketName}".`)
    if (client.status === 'unresolved') return conflict(mapped, 'unresolved_client', `No active client exactly matches "${source.sourceBucketName}".`)
    if (!identity.deliverable_type) return conflict(mapped, 'unsupported_bucket', 'The card title must start with DP, F, Photo, Video, or Reel.')
    return { ...mapped, previewStatus: 'new', conflictCode: null, conflictReason: null }
  }

  const board = context.boards.find(item => item.slug === plan.targetBoardSlug) ?? null
  const bucket = board
    ? context.buckets.find(item => item.boardId === board.id && normalizeMicrosoftMatchName(item.name) === normalizeMicrosoftMatchName(bucketMapping.targetBucket)) ?? null
    : null
  const client = bucketMapping.requiresClientReview ? resolveMicrosoftClient(source.sourceBucketName, context.clients) : null
  const payload: MicrosoftPlannerPayload = {
    destination: 'planner',
    board_id: board?.id ?? null,
    bucket_id: bucket?.id ?? null,
    title: source.title.trim(),
    client_id: client?.client?.id ?? null,
    client_name: client?.client?.name ?? null,
    status: plannerProgress(source.percentComplete),
    priority: 'normal',
    start_date: source.startDate,
    due_date: source.dueDate,
    notes: source.description,
    source: 'microsoft_preview',
    original_plan_name: source.sourcePlanName,
    original_bucket_name: source.sourceBucketName,
    microsoft_source_type: 'planner_task',
    microsoft_plan_id: source.sourcePlanId,
    microsoft_bucket_id: source.sourceBucketId,
    microsoft_task_id: source.sourceTaskId,
  }
  const mapped = { ...base, destination: 'planner' as const, mappedClientId: client?.client?.id ?? null, mappedClientName: client?.client?.name ?? null, proposedPayload: payload }
  if (!board) return conflict(mapped, 'wrong_destination', `Planner board "${plan.targetBoardSlug}" is not available.`)
  if (!bucket) return conflict(mapped, 'unsupported_bucket', `No exact Planner bucket matches "${bucketMapping.targetBucket}".`)
  if (client?.status === 'ambiguous') return conflict(mapped, 'ambiguous_client_match', `More than one active client exactly matches "${source.sourceBucketName}".`)
  if (client?.status === 'unresolved') return conflict(mapped, 'unresolved_client', `No active client exactly matches "${source.sourceBucketName}".`)
  return { ...mapped, previewStatus: 'new', conflictCode: null, conflictReason: null }
}

export function previewOutlookEvent(source: MicrosoftOutlookEventSource): MicrosoftImportPreviewItem {
  const base: Omit<MicrosoftImportPreviewItem, 'previewStatus' | 'conflictCode' | 'conflictReason'> = {
    sourceType: 'outlook_event',
    sourcePlanId: null,
    sourceCalendarId: source.sourceCalendarId || null,
    sourceBucketId: null,
    sourceTaskId: null,
    sourceEventId: source.sourceEventId || null,
    sourceName: 'Outlook Calendar',
    title: source.title.trim(),
    description: source.safeSummary,
    startDate: source.startDate,
    endDate: source.endDate,
    dueDate: null,
    assigneeMicrosoftIds: [...source.assigneeMicrosoftIds],
    destination: 'cg_calendar',
    mappedClientId: null,
    mappedClientName: null,
    existingTargetId: null,
    proposedPayload: null,
  }
  if (!microsoftOutlookSourceKey(source.sourceCalendarId, source.sourceEventId)) {
    return conflict(base, 'missing_source_id', 'Immutable Outlook event and calendar IDs are required for exact deduplication.')
  }
  if (!source.title.trim()) return conflict(base, 'missing_title', 'The Outlook event has no title.')
  if (!validIsoDate(source.startDate) || (source.endDate !== null && !validIsoDate(source.endDate))) {
    return conflict(base, 'invalid_date', 'Outlook event dates must be timezone-preserving ISO values.')
  }
  const payload = {
    destination: 'cg_calendar' as const,
    title: source.title.trim(),
    event_type: inferMicrosoftEventType(source.title),
    client_id: null,
    client_name: null,
    start_at: source.startDate,
    end_at: source.endDate,
    all_day: source.allDay,
    location: source.location,
    notes: source.safeSummary,
    status: source.cancelled ? 'cancelled' as const : 'planned' as const,
    microsoft_source_type: 'outlook_event' as const,
    microsoft_calendar_id: source.sourceCalendarId,
    microsoft_event_id: source.sourceEventId,
  }
  return { ...base, proposedPayload: payload, previewStatus: 'new', conflictCode: null, conflictReason: null }
}

export function buildMicrosoftImportPreview(
  sources: MicrosoftImportSourceRecord[],
  context: MicrosoftPreviewMappingContext,
): MicrosoftImportPreviewItem[] {
  const items = sources.map(source => source.sourceType === 'outlook_event'
    ? previewOutlookEvent(source)
    : previewPlannerTask(source, context))
  const counts = new Map<string, number>()

  for (const item of items) {
    const key = item.sourceType === 'outlook_event'
      ? microsoftOutlookSourceKey(item.sourceCalendarId ?? '', item.sourceEventId ?? '')
      : microsoftPlannerSourceKey(item.sourcePlanId ?? '', item.sourceTaskId ?? '')
    if (key) counts.set(`${item.destination}:${key}`, (counts.get(`${item.destination}:${key}`) ?? 0) + 1)
  }

  return items.map(item => {
    const key = item.sourceType === 'outlook_event'
      ? microsoftOutlookSourceKey(item.sourceCalendarId ?? '', item.sourceEventId ?? '')
      : microsoftPlannerSourceKey(item.sourcePlanId ?? '', item.sourceTaskId ?? '')
    if (!key || counts.get(`${item.destination}:${key}`) === 1) return item
    return { ...item, previewStatus: 'conflict', conflictCode: 'duplicate_source_key', conflictReason: 'This exact Microsoft source key appears more than once in the preview.' }
  })
}
