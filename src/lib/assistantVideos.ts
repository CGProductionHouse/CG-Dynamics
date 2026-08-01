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

// Validate an explicitly selected Content Run before a write preview. The
// assistant never substitutes a newer run when the selected target is absent.
export async function resolveContentRun(runId: string): Promise<RecentContentRun | null> {
  const { data, error } = await supabase
    .from('content_runs')
    .select('id, name, client_id, run_date')
    .eq('id', runId)
    .maybeSingle()
  if (error || !data) return null
  return data as RecentContentRun
}
