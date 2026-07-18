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
  MicrosoftExistingTarget,
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

export interface MicrosoftPreviewClientPackage {
  id: string
  clientId: string
  status: 'active' | 'paused' | 'archived'
}

export interface MicrosoftPreviewDeliverableTemplate {
  id: string
  packageId: string
  code: string
  deliverableType: 'dp' | 'photo' | 'video' | 'reel' | 'content_run' | 'website_update' | 'monthly_report' | 'strategy' | 'admin' | 'other'
  active: boolean
}

export interface MicrosoftPreviewMappingContext {
  clients: MicrosoftPreviewClient[]
  boards: MicrosoftPreviewBoard[]
  buckets: MicrosoftPreviewBucket[]
  packages: MicrosoftPreviewClientPackage[]
  templates: MicrosoftPreviewDeliverableTemplate[]
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
  return /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && !Number.isNaN(Date.parse(value))
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

function plannerProgress(percentComplete: number | null): 'to_do' | 'in_progress' | 'approved' {
  if (percentComplete === 100) return 'approved'
  if (percentComplete !== null && percentComplete > 0) return 'in_progress'
  return 'to_do'
}

const RESTRICTED_PLANNER_CONTENT = [
  /\bsalar(?:y|ies)\b/i,
  /\bpayroll\b/i,
  /\bpayslips?\b/i,
  /\bbonuses?\b/i,
  /\bbank(?:ing)? details?\b/i,
  /\bprofit(?: and | & )loss\b/i,
  /\brevenue\b/i,
  /\binvoice totals?\b/i,
  /\btax(?:ation)?\b/i,
  /\b(?:id|identity) numbers?\b/i,
  /\bdisciplinary\b/i,
  /\bprivate hr\b/i,
]

function containsRestrictedPlannerContent(source: MicrosoftPlannerTaskSource): boolean {
  const searchable = `${source.title}\n${source.description ?? ''}`
  return RESTRICTED_PLANNER_CONTENT.some(pattern => pattern.test(searchable))
}

function planMonth(planName: string): string | null {
  const match = /^client socials\s*-\s*([a-z]+)\s+(\d{4})$/i.exec(planName.trim())
  if (!match) return null
  const month = MONTH_NAMES[match[1].toLowerCase()]
  return month ? `${match[2]}-${month}` : null
}

function deliverableIdentity(title: string): Pick<MicrosoftClientSchedulePayload, 'code' | 'deliverable_type' | 'instance_number'> {
  const match = /^\s*(DP|F|PHOTO|VIDEO|REEL)\s*[-#]?\s*(\d+)\b/i.exec(title)
  if (!match) return { code: null, deliverable_type: null, instance_number: null }
  const code = match[1].toUpperCase()
  const instance_number = Number(match[2])
  if (code === 'DP') return { code: `DP${instance_number}`, deliverable_type: 'dp', instance_number }
  if (code === 'F' || code === 'PHOTO') return { code: `F${instance_number}`, deliverable_type: 'photo', instance_number }
  if (code === 'VIDEO') return { code: `Video ${instance_number}`, deliverable_type: 'video', instance_number }
  return { code: `Reel ${instance_number}`, deliverable_type: 'reel', instance_number }
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
    warnings: source.assigneeMicrosoftIds.length > 0
      ? ['Microsoft assignee IDs are unresolved and will remain unassigned.']
      : [],
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
  if (containsRestrictedPlannerContent(source)) {
    return conflict(base, 'restricted_content', 'This task may contain confidential finance, payroll, or HR information and requires private admin review.')
  }
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
    const monthKey = planMonth(source.sourcePlanName)
      ?? (normalizeMicrosoftMatchName(source.sourcePlanName) === '2025 clients schedule' ? (source.dueDate ?? source.startDate)?.slice(0, 7) ?? null : null)
    const month = monthKey ? `${monthKey}-01` : null
    const client = resolveMicrosoftClient(source.sourceBucketName, context.clients)
    const identity = deliverableIdentity(source.title)
    const clientId = client.client?.id ?? null
    const packages = clientId
      ? context.packages.filter(item => item.clientId === clientId && item.status === 'active')
      : []
    const clientPackage = packages.length === 1 ? packages[0] : null
    const identityCode = identity.code
    const template = clientPackage && identityCode && identity.deliverable_type
      ? context.templates.find(item => item.packageId === clientPackage.id
          && item.active
          && normalizeMicrosoftMatchName(item.code) === normalizeMicrosoftMatchName(identityCode)
          && item.deliverableType === identity.deliverable_type) ?? null
      : null
    const progress = plannerProgress(source.percentComplete)
    const payload: MicrosoftClientSchedulePayload = {
      destination: 'client_schedule',
      client_id: client.client?.id ?? null,
      package_id: clientPackage?.id ?? null,
      template_id: template?.id ?? null,
      board_id: null,
      bucket_id: null,
      month,
      code: identity.code,
      instance_number: identity.instance_number,
      title: source.title.trim(),
      deliverable_type: identity.deliverable_type,
      production_status: progress === 'approved' ? 'scheduled' : progress,
      priority: 'normal',
      scheduled_date: source.dueDate,
      notes: source.description,
      microsoft_source_type: 'planner_client_social',
      microsoft_plan_id: source.sourcePlanId,
      microsoft_bucket_id: source.sourceBucketId,
      microsoft_task_id: source.sourceTaskId,
      microsoft_source_description: source.description,
    }
    const mapped = { ...base, sourceType: 'planner_client_social' as const, destination: 'client_schedule' as const, mappedClientId: client.client?.id ?? null, mappedClientName: client.client?.name ?? null, proposedPayload: payload }
    if (!month) return conflict(mapped, 'invalid_date', 'The monthly plan name must include a valid month and year.')
    if (client.status === 'ambiguous') return conflict(mapped, 'ambiguous_client_match', `More than one active client exactly matches "${source.sourceBucketName}".`)
    if (client.status === 'unresolved') return conflict(mapped, 'unresolved_client', `No active client exactly matches "${source.sourceBucketName}".`)
    if (!identity.deliverable_type || !identity.instance_number) return conflict(mapped, 'unsupported_deliverable', 'The card title must include a numbered DP, F, Photo, Video, or Reel code.')
    if (packages.length === 0) return conflict(mapped, 'missing_package', `Client "${client.client?.name ?? source.sourceBucketName}" has no active package.`)
    if (packages.length > 1) return conflict(mapped, 'ambiguous_package', `Client "${client.client?.name ?? source.sourceBucketName}" has more than one active package.`)
    if (!template) return conflict(mapped, 'missing_template', `No active package template exactly matches "${identity.code}".`)
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
    source: 'microsoft_import',
    original_plan_name: source.sourcePlanName,
    original_bucket_name: source.sourceBucketName,
    microsoft_source_type: 'planner_task',
    microsoft_plan_id: source.sourcePlanId,
    microsoft_bucket_id: source.sourceBucketId,
    microsoft_task_id: source.sourceTaskId,
    microsoft_source_description: source.description,
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
    warnings: source.assigneeMicrosoftIds.length > 0
      ? ['Outlook attendee or assignee IDs are not imported.']
      : [],
    proposedPayload: null,
  }
  if (!microsoftOutlookSourceKey(source.sourceCalendarId, source.sourceEventId)) {
    return conflict(base, 'missing_source_id', 'Immutable Outlook event and calendar IDs are required for exact deduplication.')
  }
  if (source.private) return { ...base, previewStatus: 'skipped', conflictCode: null, conflictReason: null, warnings: ['Private Outlook event retained by identity but excluded from reconciliation.'] }
  if (!source.title.trim()) return conflict(base, 'missing_title', 'The Outlook event has no title.')
  if (!validIsoDate(source.startDate) || (source.endDate !== null && !validIsoDate(source.endDate))) {
    return conflict(base, 'invalid_date', 'Outlook event dates must be timezone-preserving ISO values.')
  }
  if (source.endDate !== null && Date.parse(source.endDate) <= Date.parse(source.startDate)) {
    return conflict(base, 'invalid_date', 'The Outlook event end must be after its start.')
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
    microsoft_source_description: source.safeSummary,
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
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return items.map(item => {
    const key = item.sourceType === 'outlook_event'
      ? microsoftOutlookSourceKey(item.sourceCalendarId ?? '', item.sourceEventId ?? '')
      : microsoftPlannerSourceKey(item.sourcePlanId ?? '', item.sourceTaskId ?? '')
    if (!key || counts.get(key) === 1) return item
    return { ...item, previewStatus: 'conflict', conflictCode: 'duplicate_source_key', conflictReason: 'This exact Microsoft source key appears more than once in the preview.' }
  })
}

function itemSourceKey(item: MicrosoftImportPreviewItem): string | null {
  if (item.sourceType === 'outlook_event') {
    const key = microsoftOutlookSourceKey(item.sourceCalendarId ?? '', item.sourceEventId ?? '')
    return key ? `outlook:${key}` : null
  }
  const key = microsoftPlannerSourceKey(item.sourcePlanId ?? '', item.sourceTaskId ?? '')
  return key ? `planner:${key}` : null
}

function targetSourceKey(target: MicrosoftExistingTarget): string | null {
  if (target.destination === 'cg_calendar') {
    const key = microsoftOutlookSourceKey(target.microsoftCalendarId, target.microsoftEventId)
    return key ? `outlook:${key}` : null
  }
  const key = microsoftPlannerSourceKey(target.microsoftPlanId, target.microsoftTaskId)
  return key ? `planner:${key}` : null
}

function normalizedIso(value: string | null): string | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time).toISOString()
}

function plannerMaterial(payload: Extract<MicrosoftImportPreviewItem['proposedPayload'], { destination: 'planner' }>) {
  return {
    board_id: payload.board_id,
    bucket_id: payload.bucket_id,
    title: payload.title,
    client_id: payload.client_id,
    client_name: payload.client_name,
    status: payload.status,
    priority: payload.priority,
    start_date: payload.start_date,
    due_date: payload.due_date,
    notes: payload.notes,
    source: payload.source,
    original_plan_name: payload.original_plan_name,
    original_bucket_name: payload.original_bucket_name,
  }
}

function scheduleMaterial(payload: Extract<MicrosoftImportPreviewItem['proposedPayload'], { destination: 'client_schedule' }>) {
  return {
    client_id: payload.client_id,
    package_id: payload.package_id,
    template_id: payload.template_id,
    board_id: payload.board_id,
    bucket_id: payload.bucket_id,
    month: payload.month,
    code: payload.code,
    instance_number: payload.instance_number,
    title: payload.title,
    deliverable_type: payload.deliverable_type,
    production_status: payload.production_status,
    priority: payload.priority,
    scheduled_date: payload.scheduled_date,
    notes: payload.notes,
  }
}

function calendarMaterial(payload: Extract<MicrosoftImportPreviewItem['proposedPayload'], { destination: 'cg_calendar' }>) {
  return {
    title: payload.title,
    event_type: payload.event_type,
    client_id: payload.client_id,
    client_name: payload.client_name,
    start_at: normalizedIso(payload.start_at),
    end_at: normalizedIso(payload.end_at),
    all_day: payload.all_day,
    location: payload.location,
    notes: payload.notes,
    status: payload.status,
  }
}

function materialPayload(item: MicrosoftImportPreviewItem): object | null {
  const payload = item.proposedPayload
  if (!payload) return null
  if (payload.destination === 'planner') return plannerMaterial(payload)
  if (payload.destination === 'client_schedule') return scheduleMaterial(payload)
  return calendarMaterial(payload)
}

function materialTarget(target: MicrosoftExistingTarget): object {
  if (target.destination === 'planner') {
    return {
      board_id: target.payload.board_id,
      bucket_id: target.payload.bucket_id,
      title: target.payload.title,
      client_id: target.payload.client_id,
      client_name: target.payload.client_name,
      status: target.payload.status,
      priority: target.payload.priority,
      start_date: target.payload.start_date,
      due_date: target.payload.due_date,
      notes: target.payload.notes,
      source: target.payload.source,
      original_plan_name: target.payload.original_plan_name,
      original_bucket_name: target.payload.original_bucket_name,
    }
  }
  if (target.destination === 'client_schedule') {
    return {
      client_id: target.payload.client_id,
      package_id: target.payload.package_id,
      template_id: target.payload.template_id,
      board_id: target.payload.board_id,
      bucket_id: target.payload.bucket_id,
      month: target.payload.month,
      code: target.payload.code,
      instance_number: target.payload.instance_number,
      title: target.payload.title,
      deliverable_type: target.payload.deliverable_type,
      production_status: target.payload.production_status,
      priority: target.payload.priority,
      scheduled_date: target.payload.scheduled_date,
      notes: target.payload.notes,
    }
  }
  return {
    title: target.payload.title,
    event_type: target.payload.event_type,
    client_id: target.payload.client_id,
    client_name: target.payload.client_name,
    start_at: normalizedIso(target.payload.start_at),
    end_at: normalizedIso(target.payload.end_at),
    all_day: target.payload.all_day,
    location: target.payload.location,
    notes: target.payload.notes,
    status: target.payload.status,
  }
}

function sameMaterialFields(item: MicrosoftImportPreviewItem, target: MicrosoftExistingTarget): boolean {
  const proposed = materialPayload(item)
  return proposed !== null && JSON.stringify(proposed) === JSON.stringify(materialTarget(target))
}

function editedAfterLastSync(target: MicrosoftExistingTarget): boolean {
  if (!target.microsoftLastSyncedAt) return true
  const updatedAt = Date.parse(target.updatedAt)
  const syncedAt = Date.parse(target.microsoftLastSyncedAt)
  if (Number.isNaN(updatedAt) || Number.isNaN(syncedAt)) return true
  return updatedAt > syncedAt
}

export function deliverableSlotKey(
  packageId: string | null,
  templateId: string | null,
  instanceNumber: number | null,
  month: string | null,
): string | null {
  if (!packageId || !templateId || !instanceNumber || !month) return null
  return `${packageId}|${templateId}|${instanceNumber}|${month}`
}

// monthly_deliverables has a natural key the Microsoft source keys don't see:
// unique (package_id, template_id, instance_number, month). A snapshot card
// that lands on a slot already occupied in CG Dynamics (e.g. a deliverable
// generated from the package template) must surface as a conflict, never as an
// insert that would violate the constraint or duplicate work.
export function flagDeliverableSlotConflicts(
  items: MicrosoftImportPreviewItem[],
  existingSlotKeys: Set<string>,
): MicrosoftImportPreviewItem[] {
  const seenInPreview = new Set<string>()
  return items.map(item => {
    const payload = item.proposedPayload
    if (item.previewStatus !== 'new' || payload?.destination !== 'client_schedule') return item
    const key = deliverableSlotKey(payload.package_id, payload.template_id, payload.instance_number, payload.month)
    if (!key) return item
    if (existingSlotKeys.has(key)) {
      return { ...item, previewStatus: 'conflict', conflictCode: 'existing_deliverable_slot', conflictReason: 'A CG Dynamics deliverable already occupies this package/template/instance/month slot. Link or resolve it manually instead of importing a duplicate.' }
    }
    if (seenInPreview.has(key)) {
      return { ...item, previewStatus: 'conflict', conflictCode: 'existing_deliverable_slot', conflictReason: 'Another card in this snapshot already fills this package/template/instance/month slot.' }
    }
    seenInPreview.add(key)
    return item
  })
}

export function classifyMicrosoftPreviewAgainstExisting(
  items: MicrosoftImportPreviewItem[],
  existingTargets: MicrosoftExistingTarget[],
): MicrosoftImportPreviewItem[] {
  const targetsBySource = new Map<string, MicrosoftExistingTarget[]>()
  for (const target of existingTargets) {
    const key = targetSourceKey(target)
    if (!key) continue
    const matches = targetsBySource.get(key) ?? []
    matches.push(target)
    targetsBySource.set(key, matches)
  }

  return items.map(item => {
    if (item.previewStatus === 'conflict' || item.previewStatus === 'skipped') return item
    const key = itemSourceKey(item)
    if (!key) return { ...item, previewStatus: 'conflict', conflictCode: 'missing_source_id', conflictReason: 'An exact Microsoft source key is required for comparison.' }

    const sourceMatches = targetsBySource.get(key) ?? []
    if (sourceMatches.length === 0) return item
    if (sourceMatches.length > 1) {
      return { ...item, previewStatus: 'conflict', conflictCode: 'duplicate_source_key', conflictReason: 'More than one CG Dynamics row uses this exact Microsoft source key.' }
    }

    const target = sourceMatches[0]
    if (target.destination !== item.destination) {
      return { ...item, existingTargetId: target.id, previewStatus: 'conflict', conflictCode: 'wrong_destination', conflictReason: `This Microsoft source already belongs to ${target.destination}, not ${item.destination}.` }
    }
    if (sameMaterialFields(item, target)) {
      return { ...item, existingTargetId: target.id, previewStatus: 'existing', conflictCode: null, conflictReason: null }
    }
    if (editedAfterLastSync(target)) {
      return { ...item, existingTargetId: target.id, previewStatus: 'conflict', conflictCode: 'existing_row_changed', conflictReason: 'This CG Dynamics row was edited after its last Microsoft sync.' }
    }
    return { ...item, existingTargetId: target.id, previewStatus: 'changed', conflictCode: null, conflictReason: null }
  })
}
