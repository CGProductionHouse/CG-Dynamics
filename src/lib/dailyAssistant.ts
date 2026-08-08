import { supabase } from './supabase'
import { invokeVoiceDebriefRequest } from './voiceDebriefRequest'
import { isActiveAssistantDayItem } from './taskLifecycle'

export { isActiveAssistantDayItem } from './taskLifecycle'

export type DailyResolutionStatus = 'resolved' | 'ambiguous' | 'unresolved'
export type DailySuggestionKind = 'create_task' | 'update_task' | 'follow_up' | 'note'

export interface DailyEntityCandidate {
  id: string
  name: string
  confidence: number
}

export interface DailySuggestion {
  id: string
  selected: boolean
  kind: DailySuggestionKind
  title: string
  detail: string
  client_id: string | null
  client_name: string | null
  client_status: DailyResolutionStatus
  client_candidates: DailyEntityCandidate[]
  assignee_profile_id: string | null
  assignee_name: string | null
  assignee_status: DailyResolutionStatus
  assignee_candidates: DailyEntityCandidate[]
  due_date: string | null
  reminder_at: string | null
  existing_task_id: string | null
  existing_task_title: string | null
  duplicate_confidence: number | null
}

export interface DailyCaptureAnalysis {
  captureId: string
  transcript: string
  detectedLanguage: 'en' | 'af' | 'mixed' | 'unknown'
  summary: string
  calls: string[]
  decisions: string[]
  promises: string[]
  unresolved: string[]
  notes: string[]
  mentions: Array<{
    type: string
    raw: string
    resolved_id: string | null
    resolved_name: string | null
    status: DailyResolutionStatus
  }>
  suggestions: DailySuggestion[]
}

export interface AssistantDayCapture {
  id: string
  user_id: string
  capture_date: string
  transcript: string
  detected_language: string
  summary: string
  status: 'draft' | 'applied' | 'discarded'
  applied_actions: Record<string, number> | null
  created_at: string
}

export interface AssistantDayItem {
  id: string
  capture_id: string
  user_id: string
  kind: 'call' | 'decision' | 'promise' | 'task' | 'follow_up' | 'note' | 'question'
  content: string
  client_id: string | null
  assignee_profile_id: string | null
  due_date: string | null
  reminder_at: string | null
  planner_task_id: string | null
  state: 'open' | 'completed' | 'dismissed'
  metadata: Record<string, unknown>
  completed_at: string | null
  created_at: string
  /** #176: the linked Planner task's operational status, resolved in the
   *  bounded enrichment inside listMyAssistantDayItems. Only present when the
   *  item carries planner_task_id and the task was resolvable. */
  linked_planner_status?: string | null
}

type DailyCaptureResponse = {
  ok: boolean
  error?: string
  analysis?: DailyCaptureAnalysis
  result?: { tasks_created: number; tasks_updated: number; existing_tasks_linked: number; timeline_notes_saved: number }
}

function errorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message
  return fallback
}

export async function analyseDailyAssistantAudio(
  userId: string,
  audio: Blob,
  durationSeconds: number,
  context: { clientId?: string; page?: string } = {},
): Promise<{ data: DailyCaptureAnalysis | null; error: string | null }> {
  try {
    const { data, error } = await invokeVoiceDebriefRequest<DailyCaptureResponse>(userId, requestId => {
      const body = new FormData()
      body.append('action', 'analyse_audio')
      body.append('requestId', requestId)
      body.append('durationSeconds', String(durationSeconds))
      body.append('clientId', context.clientId ?? '')
      body.append('page', context.page ?? '')
      body.append('audio', audio, `daily-capture.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
      return supabase.functions.invoke('daily-assistant-capture', { body })
    })
    if (error) return { data: null, error: errorMessage(error, 'The voice note could not be analysed.') }
    if (!data?.ok || !data.analysis) return { data: null, error: data?.error ?? 'The voice note could not be analysed.' }
    return { data: data.analysis, error: null }
  } catch (error) {
    return { data: null, error: errorMessage(error, 'The voice note could not be analysed.') }
  }
}

export async function analyseDailyAssistantText(
  userId: string,
  transcript: string,
  context: { clientId?: string; page?: string } = {},
): Promise<{ data: DailyCaptureAnalysis | null; error: string | null }> {
  try {
    const { data, error } = await invokeVoiceDebriefRequest<DailyCaptureResponse>(userId, requestId => supabase.functions.invoke('daily-assistant-capture', {
      body: { action: 'analyse_text', requestId, transcript, clientId: context.clientId ?? '', page: context.page ?? '' },
    }))
    if (error) return { data: null, error: errorMessage(error, 'The note could not be analysed.') }
    if (!data?.ok || !data.analysis) return { data: null, error: data?.error ?? 'The note could not be analysed.' }
    return { data: data.analysis, error: null }
  } catch (error) {
    return { data: null, error: errorMessage(error, 'The note could not be analysed.') }
  }
}

export async function applyDailyAssistantCapture(analysis: DailyCaptureAnalysis) {
  const { data, error } = await supabase.functions.invoke<DailyCaptureResponse>('daily-assistant-capture', {
    body: {
      action: 'apply', captureId: analysis.captureId, summary: analysis.summary,
      calls: analysis.calls, decisions: analysis.decisions, promises: analysis.promises,
      unresolved: analysis.unresolved, notes: analysis.notes, suggestions: analysis.suggestions,
    },
  })
  if (error) return { data: null, error: error.message }
  if (!data?.ok || !data.result) return { data: null, error: data?.error ?? 'The daily capture could not be saved.' }
  return { data: data.result, error: null }
}

export async function listMyAssistantDayCaptures(limit = 20) {
  return supabase.from('assistant_day_captures')
    .select('id,user_id,capture_date,transcript,detected_language,summary,status,applied_actions,created_at')
    .order('created_at', { ascending: false }).limit(Math.max(1, Math.min(50, limit)))
}

export async function listMyAssistantDayItems(limit = 80) {
  const result = await supabase.from('assistant_day_items')
    .select('id,capture_id,user_id,kind,content,client_id,assignee_profile_id,due_date,reminder_at,planner_task_id,state,metadata,completed_at,created_at')
    .order('created_at', { ascending: false }).limit(Math.max(1, Math.min(150, limit)))
  if (result.error || !result.data) return result
  const enriched = await enrichLinkedPlannerStatuses(result.data as AssistantDayItem[])
  if (enriched.error) return { ...result, data: null, error: enriched.error }
  return { ...result, data: enriched.data }
}

// #176: the assistant day item model has no Planner status of its own. When an
// item links to a Planner task, resolve that task's operational status in ONE
// bounded query (id,status only) so the #176 completion authority from
// taskLifecycle can be applied where the item is surfaced. Unlinked items keep
// their own state authoritative. Query errors propagate instead of failing open.
async function enrichLinkedPlannerStatuses(items: AssistantDayItem[]) {
  const linkedIds = Array.from(new Set(items.flatMap(item => item.planner_task_id ? [item.planner_task_id] : [])))
  if (linkedIds.length === 0) return { data: items, error: null }
  const result = await supabase
    .from('planner_tasks')
    .select('id,status')
    .in('id', linkedIds)
  if (result.error) return { data: null, error: result.error }
  const statusById = new Map<string, string>()
  for (const row of (result.data ?? []) as Array<{ id: string; status: string }>) {
    statusById.set(row.id, row.status)
  }
  return {
    data: items.map(item => item.planner_task_id
      ? { ...item, linked_planner_status: statusById.get(item.planner_task_id) ?? null }
      : item),
    error: null,
  }
}

export async function refreshMyAssistantDayNotifications() {
  return supabase.rpc('refresh_my_assistant_day_notifications')
}

export async function completeMyAssistantDayItem(itemId: string) {
  return supabase.rpc('complete_my_assistant_day_item', { p_item_id: itemId })
}

export function dailyAssistantContextLine(captures: AssistantDayCapture[], items: AssistantDayItem[]) {
  const today = new Date().toLocaleDateString('en-CA')
  const todayCaptures = captures.filter(capture => capture.capture_date === today && capture.status === 'applied')
  const open = items.filter(isActiveAssistantDayItem)
  if (todayCaptures.length === 0 && open.length === 0) return null
  const summaries = todayCaptures.map(capture => capture.summary).filter(Boolean).slice(0, 5)
  const loops = open.map(item => `${item.kind}: ${item.content}${item.due_date ? ` (due ${item.due_date})` : ''}`).slice(0, 12)
  return `personal daily timeline (private to signed-in user): ${summaries.join(' | ') || 'no summaries yet'}; open loops: ${loops.join(' | ') || 'none'}`
}
