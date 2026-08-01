import { supabase } from './supabase'
import { invokeVoiceDebriefRequest } from './voiceDebriefRequest'

export type ContentRunDebriefAction =
  | 'shot'
  | 'changed'
  | 'not_approved'
  | 'move_next_month'
  | 'no_change'
  | 'uncertain'

export interface ContentRunDebriefProposal {
  videoId: string
  videoNumber: number
  title: string
  action: ContentRunDebriefAction
  note: string
  confidence: 'high' | 'medium' | 'low'
}

export interface ContentRunDebriefAnalysis {
  debriefId: string
  transcript: string
  detectedLanguage: 'en' | 'af' | 'mixed' | 'unknown'
  summary: string
  proposals: ContentRunDebriefProposal[]
}

export interface ApprovedDebriefAction extends ContentRunDebriefProposal {
  approved: boolean
}

export interface ContentRunDebriefDiagnostics {
  transcriptionConfigured: boolean
  interpretationConfigured: boolean
  transcriptionProviders: string[]
  interpretationProviders: string[]
}

type ContentRunDebriefResponse = {
  ok?: boolean
  error?: string
  analysis?: ContentRunDebriefAnalysis
}

function functionError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export async function analyseContentRunAudio(
  userId: string,
  runId: string,
  audio: Blob,
  durationSeconds: number,
): Promise<{ data: ContentRunDebriefAnalysis | null; error: string | null }> {
  try {
    const { data, error } = await invokeVoiceDebriefRequest<ContentRunDebriefResponse>(userId, requestId => {
      const body = new FormData()
      body.append('action', 'analyse_audio')
      body.append('runId', runId)
      body.append('requestId', requestId)
      body.append('durationSeconds', String(durationSeconds))
      body.append('audio', audio, `content-run-debrief.${audio.type.includes('mp4') ? 'm4a' : 'webm'}`)
      return supabase.functions.invoke('content-run-voice-debrief', { body })
    })
    if (error) return { data: null, error: functionError(error, 'The voice debrief could not be analysed.') }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The voice debrief could not be analysed.' }
    return { data: data.analysis as ContentRunDebriefAnalysis, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The voice debrief could not be analysed.') }
  }
}

export async function analyseContentRunText(
  userId: string,
  runId: string,
  transcript: string,
): Promise<{ data: ContentRunDebriefAnalysis | null; error: string | null }> {
  try {
    const { data, error } = await invokeVoiceDebriefRequest<ContentRunDebriefResponse>(userId, requestId => supabase.functions.invoke('content-run-voice-debrief', {
      body: { action: 'analyse_text', runId, transcript, requestId },
    }))
    if (error) return { data: null, error: functionError(error, 'The debrief could not be analysed.') }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The debrief could not be analysed.' }
    return { data: data.analysis as ContentRunDebriefAnalysis, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The debrief could not be analysed.') }
  }
}

export async function applyContentRunDebrief(
  debriefId: string,
  actions: ApprovedDebriefAction[],
): Promise<{ data: { applied: number; skipped: number } | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('content-run-voice-debrief', {
      body: {
        action: 'apply',
        debriefId,
        actions: actions
          .filter(item => item.approved && item.action !== 'no_change' && item.action !== 'uncertain')
.map(item => ({
            videoId: item.videoId,
            videoNumber: item.videoNumber,
            title: item.title,
            action: item.action,
            note: item.note,
            confidence: item.confidence,
          })),
      },
    })
    if (error) return { data: null, error: error.message }
    if (!data?.ok) return { data: null, error: data?.error ?? 'The approved debrief changes could not be applied.' }
    return { data: data.result as { applied: number; skipped: number }, error: null }
  } catch (error) {
    return { data: null, error: functionError(error, 'The approved debrief changes could not be applied.') }
  }
}

export async function getContentRunDebriefDiagnostics(): Promise<ContentRunDebriefDiagnostics> {
  const { data, error } = await supabase.functions.invoke('content-run-voice-debrief', {
    body: { action: 'diagnostics' },
  })
  if (error) throw new Error(error.message || 'Voice debrief diagnostics are unavailable.')
  if (!data?.ok) throw new Error(data?.error || 'Voice debrief diagnostics are unavailable.')
  return {
    transcriptionConfigured: data.transcriptionConfigured === true,
    interpretationConfigured: data.interpretationConfigured === true,
    transcriptionProviders: Array.isArray(data.transcriptionProviders) ? data.transcriptionProviders : [],
    interpretationProviders: Array.isArray(data.interpretationProviders) ? data.interpretationProviders : [],
  }
}
