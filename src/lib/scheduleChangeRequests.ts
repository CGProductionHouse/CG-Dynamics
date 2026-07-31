import { supabase } from './supabase'

// Client Schedule change requests. Staff PROPOSE (RLS: insert own, pending).
// Only an Admin can apply/reject, through the SECURITY DEFINER RPCs. Every step
// is audited server-side into planner_activity_log. See migration
// client_schedule_change_approval.

export type ScheduleChangeStatus = 'pending' | 'applied' | 'rejected' | 'cancelled'

export interface ScheduleChangeRequest {
  id: string
  deliverable_id: string
  requested_by: string | null
  requested_by_name: string | null
  change: Record<string, unknown>
  reason: string | null
  status: ScheduleChangeStatus
  reviewed_by: string | null
  reviewed_by_name: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
  applied_at: string | null
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

export async function listPendingScheduleChanges() {
  return supabase
    .from('client_schedule_change_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
}

export async function listMyScheduleChangeRequests() {
  return supabase
    .from('client_schedule_change_requests')
    .select('*')
    .order('created_at', { ascending: false })
}

// Admin-only (enforced server-side by the RPC's is_admin() gate).
export async function approveScheduleChange(requestId: string, notes?: string) {
  return supabase.rpc('apply_client_schedule_change_request', { p_request_id: requestId, p_notes: notes ?? null })
}

export async function rejectScheduleChange(requestId: string, notes?: string) {
  return supabase.rpc('reject_client_schedule_change_request', { p_request_id: requestId, p_notes: notes ?? null })
}
