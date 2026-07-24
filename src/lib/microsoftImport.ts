export type MicrosoftImportSourceType = 'outlook_event' | 'planner_task' | 'planner_client_social'
export type MicrosoftImportDestination = 'cg_calendar' | 'planner' | 'client_schedule' | 'review'
export type MicrosoftPreviewStatus = 'new' | 'existing' | 'changed' | 'conflict' | 'skipped'
export type MicrosoftSkipCode = 'historical_completed' | 'completed_operational_not_imported' | 'private_event'
export type MicrosoftReconciliationAction =
  | 'create' | 'link_existing' | 'update' | 'unchanged' | 'complete' | 'reopen' | 'move'
  | 'cancel' | 'archive' | 'package_template_create' | 'conflict' | 'skipped' | 'failed'

export type MicrosoftConflictCode =
  | 'unresolved_client'
  | 'duplicate_source_key'
  | 'invalid_date'
  | 'missing_title'
  | 'unsupported_plan'
  | 'unsupported_bucket'
  | 'wrong_destination'
  | 'existing_row_changed'
  | 'ambiguous_client_match'
  | 'missing_source_id'
  | 'unsupported_deliverable'
  | 'missing_package'
  | 'ambiguous_package'
  | 'missing_template'
  | 'ambiguous_unnumbered_deliverable'
  | 'existing_deliverable_slot'
  | 'restricted_content'
  | 'stale_snapshot'
  | 'unresolved_assignee'

export interface MicrosoftOutlookEventSource {
  sourceType: 'outlook_event'
  sourceCalendarId: string
  sourceEventId: string
  title: string
  safeSummary: string | null
  startDate: string
  endDate: string | null
  allDay: boolean
  location: string | null
  cancelled: boolean
  assigneeMicrosoftIds: string[]
  sourceModifiedAt?: string | null
  private?: boolean
}

export interface MicrosoftPlannerTaskSource {
  sourceType: 'planner_task'
  sourcePlanId: string
  sourcePlanName: string
  sourceBucketId: string
  sourceBucketName: string
  sourceTaskId: string
  title: string
  description: string | null
  startDate: string | null
  dueDate: string | null
  assigneeMicrosoftIds: string[]
  percentComplete: number | null
  completedDate?: string | null
  sourceModifiedAt?: string | null
}

export type MicrosoftImportSourceRecord = MicrosoftOutlookEventSource | MicrosoftPlannerTaskSource

export interface MicrosoftPlannerPayload {
  destination: 'planner'
  board_id: string | null
  bucket_id: string | null
  title: string
  client_id: string | null
  client_name: string | null
  status: 'to_do' | 'in_progress' | 'blocked' | 'waiting_client' | 'ready_internal_review' | 'approved' | 'scheduled' | 'done'
  priority: 'normal'
  start_date: string | null
  due_date: string | null
  notes: string | null
  /** The value apply writes — must match so reruns classify as existing. */
  source: 'microsoft_import'
  original_plan_name: string
  original_bucket_name: string
  microsoft_source_type: 'planner_task'
  microsoft_plan_id: string
  microsoft_bucket_id: string
  microsoft_task_id: string
  microsoft_source_description: string | null
  assigned_to_name: string | null
  helper_names: string[] | null
}

export interface MicrosoftClientSchedulePayload {
  destination: 'client_schedule'
  client_id: string | null
  package_id: string | null
  template_id: string | null
  board_id: string | null
  bucket_id: string | null
  month: string | null
  code: string | null
  instance_number: number | null
  title: string
  deliverable_type: 'dp' | 'photo' | 'video' | 'reel' | null
  production_status: 'to_do' | 'in_progress' | 'ready_internal_review' | 'internal_changes' | 'ready_client_approval' | 'waiting_client' | 'client_changes' | 'approved' | 'scheduled' | 'posted' | 'blocked' | 'moved'
  priority: 'normal'
  scheduled_date: string | null
  notes: string | null
  microsoft_source_type: 'planner_client_social'
  microsoft_plan_id: string
  microsoft_bucket_id: string
  microsoft_task_id: string
  microsoft_source_description: string | null
  assigned_to_user_id: string | null
  assigned_to_name: string | null
  helper_names: string[] | null
}

export interface MicrosoftCalendarPayload {
  destination: 'cg_calendar'
  title: string
  event_type: 'meeting' | 'shoot' | 'content_run' | 'client_event' | 'internal' | 'deadline'
  client_id: string | null
  client_name: string | null
  start_at: string
  end_at: string | null
  all_day: boolean
  location: string | null
  notes: string | null
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled'
  microsoft_source_type: 'outlook_event'
  microsoft_calendar_id: string
  microsoft_event_id: string
  microsoft_source_description: string | null
}

export type MicrosoftProposedPayload =
  | MicrosoftPlannerPayload
  | MicrosoftClientSchedulePayload
  | MicrosoftCalendarPayload
  | null

interface MicrosoftExistingTargetBase {
  id: string
  updatedAt: string
  microsoftLastSyncedAt: string | null
  microsoftSourceHash: string | null
  microsoftSourceRemovedAt: string | null
}

export interface MicrosoftExistingPlannerTarget extends MicrosoftExistingTargetBase {
  destination: 'planner'
  microsoftPlanId: string
  microsoftTaskId: string
  payload: Omit<MicrosoftPlannerPayload, 'destination' | 'microsoft_source_type' | 'microsoft_plan_id' | 'microsoft_bucket_id' | 'microsoft_task_id'>
}

export interface MicrosoftExistingClientScheduleTarget extends MicrosoftExistingTargetBase {
  destination: 'client_schedule'
  microsoftPlanId: string
  microsoftTaskId: string
  payload: Omit<MicrosoftClientSchedulePayload, 'destination' | 'microsoft_source_type' | 'microsoft_plan_id' | 'microsoft_bucket_id' | 'microsoft_task_id'>
}

export interface MicrosoftExistingCalendarTarget extends MicrosoftExistingTargetBase {
  destination: 'cg_calendar'
  microsoftCalendarId: string
  microsoftEventId: string
  payload: Omit<MicrosoftCalendarPayload, 'destination' | 'microsoft_source_type' | 'microsoft_calendar_id' | 'microsoft_event_id'>
}

export type MicrosoftExistingTarget =
  | MicrosoftExistingPlannerTarget
  | MicrosoftExistingClientScheduleTarget
  | MicrosoftExistingCalendarTarget

export interface MicrosoftAssigneeMapEntry {
  displayName: string
  mail: string | null
  userPrincipalName: string | null
}

export interface MicrosoftAssigneeResolution {
  microsoftUserId: string
  displayName: string
  mail: string | null
  cgProfileId: string | null
  cgProfileName: string | null
  resolved: boolean
  method: 'stored' | 'email_match' | 'unresolved'
}

export type MicrosoftAssigneeResolutions = MicrosoftAssigneeResolution[]

export interface MicrosoftImportPreviewItem {
  sourceType: MicrosoftImportSourceType
  sourcePlanId: string | null
  sourceCalendarId: string | null
  sourceBucketId: string | null
  sourceTaskId: string | null
  sourceEventId: string | null
  sourceName: string
  title: string
  description: string | null
  startDate: string | null
  endDate: string | null
  dueDate: string | null
  assigneeMicrosoftIds: string[]
  destination: MicrosoftImportDestination
  mappedClientId: string | null
  mappedClientName: string | null
  existingTargetId: string | null
  previewStatus: MicrosoftPreviewStatus
  conflictCode: MicrosoftConflictCode | null
  conflictReason: string | null
  skipCode?: MicrosoftSkipCode | null
  warnings: string[]
  proposedPayload: MicrosoftProposedPayload
  reconciliationAction?: MicrosoftReconciliationAction
  expectedTargetUpdatedAt?: string | null
  sourceHash?: string | null
  sourceComplete?: boolean
  requiresRemovalApproval?: boolean
  resolvedAssignees?: MicrosoftAssigneeResolution[]
  /** For package_template_create: the deterministic template a supported source
   *  task proves the active package is missing. Applied before its deliverable. */
  proposedTemplate?: { code: string; deliverable_type: 'dp' | 'photo' | 'video' | 'reel'; instance_number: number } | null
}

export interface MicrosoftReconciliationSummary {
  total: number
  create: number
  link_existing: number
  update: number
  unchanged: number
  complete: number
  reopen: number
  move: number
  cancel: number
  archive: number
  package_template_create: number
  conflict: number
  skipped: number
  failed: number
}

export function summarizeMicrosoftReconciliation(items: MicrosoftImportPreviewItem[]): MicrosoftReconciliationSummary {
  return items.reduce<MicrosoftReconciliationSummary>((summary, item) => {
    const action = item.reconciliationAction ?? 'skipped'
    summary.total += 1
    summary[action] += 1
    return summary
  }, { total: 0, create: 0, link_existing: 0, update: 0, unchanged: 0, complete: 0, reopen: 0, move: 0, cancel: 0, archive: 0, package_template_create: 0, conflict: 0, skipped: 0, failed: 0 })
}

export interface MicrosoftPreviewSummary {
  total: number
  new: number
  existing: number
  changed: number
  conflict: number
  skipped: number
}

export function summarizeMicrosoftPreview(items: MicrosoftImportPreviewItem[]): MicrosoftPreviewSummary {
  return items.reduce<MicrosoftPreviewSummary>((summary, item) => {
    summary.total += 1
    summary[item.previewStatus] += 1
    return summary
  }, { total: 0, new: 0, existing: 0, changed: 0, conflict: 0, skipped: 0 })
}
