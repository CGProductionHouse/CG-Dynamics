import { supabase } from './supabase'

// Client Schedule change requests. Staff PROPOSE (RLS: insert own, pending).
// Managers and admins apply/reject through SECURITY DEFINER RPCs. Every step
// is audited server-side into planner_activity_log. See migration
// client_schedule_change_approval.

export type ScheduleChangeStatus = 'pending' | 'applied' | 'rejected' | 'cancelled'

export interface ScheduleChangeRequest {
  id: string
  deliverable_id: string
  requested_by: string | null
  requested_by_name: string | null
  change: Record<string, unknown>
  baseline: Record<string, unknown>
  target_updated_at: string | null
  reason: string | null
  status: ScheduleChangeStatus
  reviewed_by: string | null
  reviewed_by_name: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  applied_at: string | null
  deliverable?: ScheduleChangeTarget | null
}

export interface ScheduleChangeTarget {
  id: string
  title: string
  code: string
  instance_number: number
  scheduled_date: string | null
  due_date: string | null
  production_status: string
  assigned_to_name: string | null
  notes: string | null
  updated_at: string
}

// A strict, client-safe whitelist mirroring the server-side apply whitelist.
export interface ScheduleChangePatch {
  scheduled_date?: string | null
  due_date?: string | null
  production_status?: string
  assigned_to_name?: string | null
  notes?: string
}

export interface ProposeInput {
  deliverableId: string
  change: ScheduleChangePatch
  reason?: string | null
  requestedBy: string | null
  requestedByName: string | null
}

export async function proposeScheduleChange(input: ProposeInput) {
  return supabase
    .from('client_schedule_change_requests')
    .insert({
      deliverable_id: input.deliverableId,
      requested_by: input.requestedBy,
      requested_by_name: input.requestedByName,
      change: input.change,
      reason: input.reason ?? null,
      status: 'pending',
    })
    .select()
    .single()
}

const REQUEST_SELECT = '*, deliverable:monthly_deliverables(id,title,code,instance_number,scheduled_date,due_date,production_status,assigned_to_name,notes,updated_at)'

export async function listPendingScheduleChanges() {
  return supabase
    .from('client_schedule_change_requests')
    .select(REQUEST_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
}

export async function listMyScheduleChangeRequests() {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) return { data: null, error: authError ?? new Error('Not signed in.') }
  return supabase
    .from('client_schedule_change_requests')
    .select(REQUEST_SELECT)
    .eq('requested_by', authData.user.id)
    .order('created_at', { ascending: false })
}

// Manager/admin only, enforced server-side.
export async function approveScheduleChange(requestId: string, notes?: string) {
  return supabase.rpc('apply_client_schedule_change_request', { p_request_id: requestId, p_notes: notes ?? null })
}

export async function rejectScheduleChange(requestId: string, notes?: string) {
  return supabase.rpc('reject_client_schedule_change_request', { p_request_id: requestId, p_notes: notes ?? null })
}

export async function saveScheduleDeliverable(input: {
  deliverableId: string
  expectedUpdatedAt: string
  productionStatus: string
  scheduledDate: string | null
  clientId: string | null
  assignedToName: string | null
}) {
  return supabase.rpc('save_client_schedule_deliverable', {
    p_deliverable_id: input.deliverableId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_production_status: input.productionStatus,
    p_scheduled_date: input.scheduledDate,
    p_client_id: input.clientId,
    p_assigned_to_name: input.assignedToName,
  })
}

export async function updateAssignedScheduleStatus(input: {
  deliverableId: string
  expectedUpdatedAt: string
  productionStatus: string
}) {
  return supabase.rpc('update_assigned_client_schedule_status', {
    p_deliverable_id: input.deliverableId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_production_status: input.productionStatus,
  })
}
