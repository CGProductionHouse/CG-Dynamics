import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  analyseContentRunAudio,
  analyseContentRunText,
  applyContentRunDebrief,
  type ApprovedDebriefAction,
  type ContentRunDebriefAnalysis,
  type ContentRunDebriefAction,
} from '../../lib/contentRunDebrief'
import type { ContentGuideline, ContentGuidelineVideo, ContentRun } from '../../lib/contentWorkflow'
import { MAX_VOICE_SECONDS } from '../../lib/voiceDebriefRequest'
import { ActionButton } from '../ui/Buttons'

const ACTION_LABELS: Record<ContentRunDebriefAction, string> = {
  shot: 'Shot successfully',
  changed: 'Changed on site',
  not_approved: 'Not approved on site',
  move_next_month: 'Move to next month',
  no_change: 'No workflow change',
  uncertain: 'Needs clarification',
}

function recorderMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
  ].find(type => MediaRecorder.isTypeSupported(type))
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function approvedProposals(analysis: ContentRunDebriefAnalysis): ApprovedDebriefAction[] {
  return analysis.proposals.map(proposal => ({
    ...proposal,
    approved: proposal.action !== 'uncertain' && proposal.action !== 'no_change',
  }))
}

export function ContentRunVoiceDebrief({
  run,
  guideline,
  videos,
  onApplied,
}: {
  run: ContentRun
  guideline: ContentGuideline
  videos: ContentGuidelineVideo[]
  onApplied: () => void | Promise<void>
}) {
  const { user } = useAuth()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartedAtRef = useRef(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [audio, setAudio] = useState<Blob | null>(null)
  const [audioDurationSeconds, setAudioDurationSeconds] = useState(0)
  const [typedDebrief, setTypedDebrief] = useState('')
  const [analysis, setAnalysis] = useState<ContentRunDebriefAnalysis | null>(null)
  const [actions, setActions] = useState<ApprovedDebriefAction[]>([])
  const [busy, setBusy] = useState<'analyse' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => {
      setSeconds(Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - recordingStartedAtRef.current) / 1000)))
    }, 250)
    const autoStop = window.setTimeout(() => {
      stopRecording()
      setError('Recording stopped automatically at the 5-minute limit.')
    }, Math.max(0, MAX_VOICE_SECONDS * 1000 - (Date.now() - recordingStartedAtRef.current)))
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(autoStop)
    }
  }, [recording])

  useEffect(() => () => {
    recorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(track => track.stop())
  }, [])

  const audioUrl = useMemo(() => audio ? URL.createObjectURL(audio) : null, [audio])
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function startRecording() {
    setError(null)
    setSuccess(null)
    setAnalysis(null)
    setActions([])
    setAudio(null)
    setAudioDurationSeconds(0)
    setSeconds(0)

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser. Type the debrief below instead.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = recorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      chunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const measuredSeconds = Math.min(MAX_VOICE_SECONDS, (Date.now() - recordingStartedAtRef.current) / 1000)
        setAudio(blob.size > 0 ? blob : null)
        setAudioDurationSeconds(measuredSeconds)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      recorder.start(500)
      recordingStartedAtRef.current = Date.now()
      setRecording(true)
    } catch {
      setError('Microphone access was not available. Allow microphone access or type the debrief below.')
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setRecording(false)
  }

  async function analyse() {
    if (!audio && !typedDebrief.trim()) {
      setError('Record a voice note or type a debrief first.')
      return
    }
    setBusy('analyse')
    setError(null)
    setSuccess(null)
    if (!user) {
      setBusy(null)
      setError('Sign in again before submitting this debrief.')
      return
    }
    const result = audio
      ? await analyseContentRunAudio(user.id, run.id, audio, audioDurationSeconds)
      : await analyseContentRunText(user.id, run.id, typedDebrief.trim())
    setBusy(null)
    if (result.error || !result.data) {
      setError(result.error ?? 'The debrief could not be analysed.')
      return
    }
    setAnalysis(result.data)
    setActions(approvedProposals(result.data))
  }

  async function apply() {
    if (!analysis) return
    const approvedCount = actions.filter(item => item.approved && !['uncertain', 'no_change'].includes(item.action)).length
    if (approvedCount === 0) {
      setError('Select at least one clear workflow update to apply.')
      return
    }
    setBusy('apply')
    setError(null)
    const result = await applyContentRunDebrief(analysis.debriefId, actions)
    setBusy(null)
    if (result.error || !result.data) {
      setError(result.error ?? 'The approved changes could not be applied.')
      return
    }
    setSuccess(`${result.data.applied} video update${result.data.applied === 1 ? '' : 's'} applied. The original transcript remains in the audit record.`)
    setAnalysis(null)
    setActions([])
    setAudio(null)
    setTypedDebrief('')
    await onApplied()
  }

  function updateAction(index: number, patch: Partial<ApprovedDebriefAction>) {
    setActions(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  const canDebrief = guideline.content_run_id === run.id && videos.length > 0

  return (
    <section className="rounded-xl border border-brand-teal/20 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.08),transparent_50%)] p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-teal">Post-run debrief</p>
          <h3 className="mt-1 text-base font-black text-white">Record what happened on the shoot</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">
            Speak naturally in English, Afrikaans, or both. CG Dynamics will organise the note by video and show every proposed change before saving.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!recording ? (
            <button
              type="button"
              aria-label="Record post-run voice debrief"
              disabled={!canDebrief || busy !== null}
              onClick={() => void startRecording()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-4 text-sm font-bold text-brand-teal transition hover:bg-brand-teal/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span aria-hidden="true" className="text-base">🎙</span>
              Record debrief
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              aria-live="polite"
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-300/30 bg-red-300/10 px-4 text-sm font-bold text-red-100"
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-300" />
              Stop · {formatDuration(MAX_VOICE_SECONDS - seconds)} remaining
            </button>
          )}
        </div>
      </div>

      {!canDebrief && (
        <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100">
          Add videos to this run's Content Guideline before recording a debrief.
        </p>
      )}

      {audio && !analysis && (
        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
          <p className="text-xs font-bold text-white">Voice note ready</p>
          <p className="mt-1 text-[11px] text-white/45">{formatDuration(Math.ceil(audioDurationSeconds))} recorded · 5:00 maximum</p>
          <audio className="mt-2 w-full" controls src={audioUrl ?? undefined} />
        </div>
      )}

      {!recording && !analysis && (
        <label className="mt-4 block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Typed fallback or extra context</span>
          <textarea
            value={typedDebrief}
            onChange={event => setTypedDebrief(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-sm leading-6 text-white outline-none focus:border-brand-teal/40"
            placeholder="Example: We shot videos 1 and 2. Video 3 changed on site. Video 4 was not approved. Move video 5 to next month."
          />
        </label>
      )}

      {!recording && !analysis && (audio || typedDebrief.trim()) && (
        <div className="mt-3 flex justify-end">
          <ActionButton loading={busy === 'analyse'} disabled={!canDebrief || busy !== null} onClick={() => void analyse()}>
            Analyse debrief
          </ActionButton>
        </div>
      )}

      {analysis && (
        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/40">
              Transcript · {analysis.detectedLanguage === 'af' ? 'Afrikaans' : analysis.detectedLanguage === 'en' ? 'English' : analysis.detectedLanguage === 'mixed' ? 'English + Afrikaans' : 'Language auto-detected'}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{analysis.transcript}</p>
            <p className="mt-3 text-xs font-bold text-brand-teal">{analysis.summary}</p>
          </div>

          <div className="space-y-2">
            {actions.map((item, index) => (
              <article key={`${item.videoId}-${index}`} className={`rounded-lg border p-3 ${item.approved ? 'border-brand-teal/25 bg-brand-teal/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    disabled={item.action === 'uncertain' || item.action === 'no_change'}
                    onChange={event => updateAction(index, { approved: event.target.checked })}
                    className="mt-1 h-4 w-4 shrink-0 accent-teal-400"
                    aria-label={`Apply update for Video ${item.videoNumber}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black text-white">Video {item.videoNumber}: {item.title}</p>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/55">{ACTION_LABELS[item.action]}</span>
                      <span className="text-[10px] uppercase text-white/30">{item.confidence} confidence</span>
                    </div>
                    <textarea
                      value={item.note}
                      onChange={event => updateAction(index, { note: event.target.value })}
                      className="mt-2 min-h-16 w-full rounded-md border border-white/10 bg-black/20 px-2.5 py-2 text-xs leading-5 text-white/70 outline-none focus:border-brand-teal/35"
                      aria-label={`Debrief note for Video ${item.videoNumber}`}
                    />
                    {item.action === 'move_next_month' && (
                      <p className="mt-2 text-[11px] leading-4 text-amber-100/70">
                        This moves the video to next month and removes its old schedule link. Link it to a confirmed next-month Client Schedule slot afterward; no slot is guessed.
                      </p>
                    )}
                    {item.action === 'shot' && (
                      <p className="mt-2 text-[11px] leading-4 text-white/40">
                        Marked Shot now. It becomes Ready to edit automatically when a verified footage link already exists.
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ActionButton variant="ghost" disabled={busy !== null} onClick={() => { setAnalysis(null); setActions([]) }}>Discard proposal</ActionButton>
            <ActionButton loading={busy === 'apply'} disabled={busy !== null} onClick={() => void apply()}>Apply selected updates</ActionButton>
          </div>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-sm text-red-200" role="alert">{error}</p>}
      {success && <p className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.07] px-3 py-2 text-sm text-emerald-100" role="status" aria-live="polite">{success}</p>}
    </section>
  )
}
