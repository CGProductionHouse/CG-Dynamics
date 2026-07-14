import { supabase } from './supabase'

export type MicrosoftImportSourceType = 'outlook_event' | 'planner_task' | 'planner_client_social'
export type MicrosoftImportDestination = 'cg_calendar' | 'planner' | 'client_schedule' | 'review'
export type MicrosoftPreviewStatus = 'new' | 'existing' | 'changed' | 'conflict' | 'skipped'

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
}

export type MicrosoftImportSourceRecord = MicrosoftOutlookEventSource | MicrosoftPlannerTaskSource

export interface MicrosoftPlannerPayload {
  destination: 'planner'
  board_id: string | null
  bucket_id: string | null
  title: string
  client_id: string | null
  client_name: string | null
  status: 'to_do' | 'in_progress' | 'approved'
  priority: 'normal'
  start_date: string | null
  due_date: string | null
  notes: string | null
  source: 'microsoft_preview'
  original_plan_name: string
  original_bucket_name: string
  microsoft_source_type: 'planner_task'
  microsoft_plan_id: string
  microsoft_bucket_id: string
  microsoft_task_id: string
}

export interface MicrosoftClientSchedulePayload {
  destination: 'client_schedule'
  client_id: string | null
  month: string | null
  code: string | null
  title: string
  deliverable_type: 'dp' | 'photo' | 'video' | 'reel' | null
  production_status: 'not_started' | 'in_production' | 'internal_review' | 'scheduled_posted'
  priority: 'normal'
  scheduled_date: string | null
  notes: string | null
  microsoft_source_type: 'planner_client_social'
  microsoft_plan_id: string
  microsoft_bucket_id: string
  microsoft_task_id: string
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
  status: 'planned' | 'cancelled'
  microsoft_source_type: 'outlook_event'
  microsoft_calendar_id: string
  microsoft_event_id: string
}

export type MicrosoftProposedPayload =
  | MicrosoftPlannerPayload
  | MicrosoftClientSchedulePayload
  | MicrosoftCalendarPayload
  | null

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
  proposedPayload: MicrosoftProposedPayload
}

export type MicrosoftPreviewSource =
  | 'outlook-calendar'
  | 'planner-to-do'
  | 'planner-master-client-to-do'
  | 'planner-cg-socials'
  | 'planner-monthly-client-socials'

export interface MicrosoftPreviewRequest {
  source: MicrosoftPreviewSource
  rangeStart: string
  rangeEnd: string
}

export interface MicrosoftPreviewSummary {
  total: number
  new: number
  existing: number
  changed: number
  conflict: number
  skipped: number
}

export interface MicrosoftPreviewReadyResponse {
  ok: true
  status: 'ready'
  items: MicrosoftImportPreviewItem[]
  summary: MicrosoftPreviewSummary
}

export interface MicrosoftPreviewSetupRequiredResponse {
  ok: true
  status: 'setup_required'
  message: string
  missingConfiguration: string[]
  requiredPermissions: string[]
}

export type MicrosoftPreviewResponse = MicrosoftPreviewReadyResponse | MicrosoftPreviewSetupRequiredResponse

export function summarizeMicrosoftPreview(items: MicrosoftImportPreviewItem[]): MicrosoftPreviewSummary {
  return items.reduce<MicrosoftPreviewSummary>((summary, item) => {
    summary.total += 1
    summary[item.previewStatus] += 1
    return summary
  }, { total: 0, new: 0, existing: 0, changed: 0, conflict: 0, skipped: 0 })
}

export async function requestMicrosoftImportPreview(request: MicrosoftPreviewRequest): Promise<MicrosoftPreviewResponse> {
  const { data, error } = await supabase.functions.invoke<MicrosoftPreviewResponse>('microsoft-import-preview', {
    method: 'POST',
    body: request,
  })

  if (error) throw new Error(error.message || 'Microsoft preview request failed.')
  if (!data) throw new Error('Microsoft preview returned no response.')
  return data
}
