import { supabase } from './supabase'

// Post-meeting voice debrief client. Mirrors contentRunDebrief.ts: analyse
// (audio or typed text) → one editable confirmation → apply. Applying appends
// the reviewed notes/decisions/unresolved to the matched meeting and creates
// canonical tasks (audited, assignee notified). Missing due dates stay null.

export interface MeetingDebriefTask {
  title: string
  assignee_name: string | null
  client_id: string | null
  client_name: string | null
  due_date: string | null
  resolved_assignee: boolean
}

export interface MeetingCandidate {
  id: string
  title: string
  startAt: string
  clientName: string | null
}

export interface MeetingDebriefAnalysis {
  debriefId: string
  transcript: string
  detectedLanguage: 'en' | 'af' | 'mixed' | 'unknown'
  summary: string
  decisions: string[]
  unresolved: string[]
  tasks: MeetingDebriefTask[]
  meeting: MeetingCandidate | null
  candidates: MeetingCandidate[]
}

function functionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function analyseMeetingAudio(
  audio: Blob,
  opts: { eventId?: string; clientId?: string } = {},
): Promise<{ data: MeetingDebriefAnalysis | null; error: string | null }> {
  const body = new FormData()
  body.append('action', 'analyse_audio')
  if (opts.eventId) body.append('eventId', opts.eventId)
  if (opts.clientId) body.append('clientId', opts.clientId)
  body.append('audio', audio, `meeting-debrief.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
  try {
    const { data, error } = await supabase.functions.invoke('meeting-debrief', { body })
    if (error) return { data: null, error: error.message }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The voice debrief could not be analysed.' }
    return { data: data.analysis as MeetingDebriefAnalysis, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The voice debrief could not be analysed.') }
  }
}

export async function analyseMeetingText(
  transcript: string,
  opts: { eventId?: string; clientId?: string } = {},
): Promise<{ data: MeetingDebriefAnalysis | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('meeting-debrief', {
      body: { action: 'analyse_text', transcript, eventId: opts.eventId, clientId: opts.clientId },
    })
    if (error) return { data: null, error: error.message }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The debrief could not be analysed.' }
    return { data: data.analysis as MeetingDebriefAnalysis, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The debrief could not be analysed.') }
  }
}

export async function applyMeetingDebrief(input: {
  debriefId: string
  summary: string
  decisions: string[]
  unresolved: string[]
  tasks: Array<Pick<MeetingDebriefTask, 'title' | 'assignee_name' | 'client_id' | 'client_name' | 'due_date'>>
}): Promise<{ data: { tasks_created: number; notes_saved: boolean } | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('meeting-debrief', {
      body: {
        action: 'apply',
        debriefId: input.debriefId,
        summary: input.summary,
        decisions: input.decisions,
        unresolved: input.unresolved,
        tasks: input.tasks,
      },
    })
    if (error) return { data: null, error: error.message }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The debrief could not be applied.' }
    return { data: data.result as { tasks_created: number; notes_saved: boolean }, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The debrief could not be applied.') }
  }
}
