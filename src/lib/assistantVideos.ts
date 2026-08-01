import { supabase } from './supabase'

// Direct Content Run video actions for CG Assistant. Wraps the audited
// SECURITY DEFINER RPC assistant_update_video, which reuses the proven post-run
// debrief transition rules (shot/changed/not_approved/move) and writes a
// canonical planner_activity_log row. No page routing for supported actions.

export type AssistantVideoAction = 'shot' | 'changed' | 'not_approved' | 'move_next_month' | 'move_to_month'

export async function assistantUpdateVideo(input: {
  runId: string
  videoNumber: number
  action: AssistantVideoAction
  note?: string | null
  scheduledMonth?: string | null // YYYY-MM-DD (first of month) for move_to_month
}) {
  return supabase.rpc('assistant_update_video', {
    p_run_id: input.runId,
    p_video_number: input.videoNumber,
    p_action: input.action,
    p_note: input.note ?? null,
    p_scheduled_month: input.scheduledMonth ?? null,
  })
}

export interface RecentContentRun {
  id: string
  name: string
  client_id: string | null
  run_date: string | null
}

// Resolve which Content Run "video five" refers to when the user is not on a
// run record: the current client's most recent run, else the single most recent
// run overall. Ambiguity (no runs) returns null so the caller asks instead of
// guessing.
export async function resolveContentRun(clientId: string | null): Promise<RecentContentRun | null> {
  let query = supabase
    .from('content_runs')
    .select('id, name, client_id, run_date')
    .order('run_date', { ascending: false, nullsFirst: false })
    .limit(1)
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query
  if (error || !data || data.length === 0) return null
  return data[0] as RecentContentRun
}
