import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  analyseDailyAssistantAudio,
  analyseDailyAssistantText,
  applyDailyAssistantCapture,
  completeMyAssistantDayItem,
  listMyAssistantDayCaptures,
  listMyAssistantDayItems,
  type AssistantDayCapture,
  type AssistantDayItem,
  type DailyCaptureAnalysis,
  type DailySuggestion,
  type DailySuggestionKind,
} from '../../lib/dailyAssistant'
import { fetchActiveClients, type ActiveClientOption } from '../../lib/assistant'
import { listStaffProfiles, type StaffProfileOption } from '../../lib/contentWorkflow'
import { MAX_VOICE_SECONDS } from '../../lib/voiceDebriefRequest'

interface Props {
  userId: string
  page: string
  clientId?: string
  onClose: () => void
  onSaved: (message: string) => void
}

// Explicit voice-state machine: only one dominant stage at a time, so
// recording → transcribing → reviewing → applying reads as one deliberate
// sequence rather than several overlapping assistant states.
type CaptureStage = 'ready' | 'recording' | 'transcribing' | 'reviewing' | 'applying' | 'complete' | 'failed'
type FailedStep = 'recording' | 'transcription' | 'apply'

interface DailyApplyResult {
  tasks_created: number
  tasks_updated: number
  existing_tasks_linked: number
  timeline_notes_saved: number
}

const KIND_LABELS: Record<DailySuggestionKind, string> = {
  create_task: 'Task to create',
  update_task: 'Existing task update',
  follow_up: 'Follow-up / reminder',
  note: 'Note only',
}

function splitLines(value: string) {
  return value.split('\n').map(line => line.trim()).filter(Boolean)
}

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function localInputValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function localInputIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function DailyAssistantCapture({ userId, page, clientId, onClose, onSaved }: Props) {
  const draftKey = `cg-daily-capture-draft:${userId}`
  const [mode, setMode] = useState<'capture' | 'timeline'>('capture')
  const [stage, setStage] = useState<CaptureStage>('ready')
  const [failedStep, setFailedStep] = useState<FailedStep | null>(null)
  const [completeResult, setCompleteResult] = useState<DailyApplyResult | null>(null)
  const [text, setText] = useState(() => {
    try { return window.localStorage.getItem(draftKey) ?? '' } catch { return '' }
  })
  const [analysis, setAnalysis] = useState<DailyCaptureAnalysis | null>(null)
  const [busy, setBusy] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [clients, setClients] = useState<ActiveClientOption[]>([])
  const [staff, setStaff] = useState<StaffProfileOption[]>([])
  const [captures, setCaptures] = useState<AssistantDayCapture[]>([])
  const [items, setItems] = useState<AssistantDayItem[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef(0)
  const mountedRef = useRef(true)
  // Kept so a failed transcription can be retried without re-requesting the
  // microphone and without re-uploading a different blob.
  const pendingAudioRef = useRef<{ blob: Blob; duration: number } | null>(null)

  useEffect(() => {
    mountedRef.current = true
    void Promise.all([fetchActiveClients(), listStaffProfiles()]).then(([clientRows, staffRows]) => {
      if (!mountedRef.current) return
      setClients(clientRows)
      if (!staffRows.migrationNeeded) setStaff(staffRows.data)
    })
    void loadTimeline()
    return () => {
      mountedRef.current = false
      stopRecorder(false)
    }
    // The mount lifecycle intentionally owns the recorder created during this panel session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      if (text.trim()) window.localStorage.setItem(draftKey, text)
      else window.localStorage.removeItem(draftKey)
    } catch { /* storage can be unavailable in private mode */ }
  }, [draftKey, text])

  useEffect(() => {
    if (stage !== 'recording') return
    const timer = window.setInterval(() => {
      const elapsed = Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - startedAtRef.current) / 1000))
      setSeconds(elapsed)
      if (elapsed >= MAX_VOICE_SECONDS) stopRecorder(true)
    }, 250)
    const stopOnBackground = () => {
      if (document.visibilityState === 'hidden') stopRecorder(true)
    }
    document.addEventListener('visibilitychange', stopOnBackground)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', stopOnBackground)
    }
    // The recording lifecycle intentionally uses the recorder for the active recording only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  async function loadTimeline() {
    const [captureResult, itemResult] = await Promise.all([listMyAssistantDayCaptures(), listMyAssistantDayItems()])
    if (!mountedRef.current) return
    if (!captureResult.error) setCaptures((captureResult.data ?? []) as AssistantDayCapture[])
    if (!itemResult.error) setItems((itemResult.data ?? []) as AssistantDayItem[])
  }

  function stopRecorder(analyse: boolean) {
    const recorder = recorderRef.current
    recorderRef.current = null
    if (!recorder) return
    // Move to Transcribing the instant Stop is pressed so the interface never
    // flashes back to the generic idle state before the result is ready.
    if (analyse && mountedRef.current) setStage('transcribing')
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach(track => track.stop())
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      const duration = Math.min(MAX_VOICE_SECONDS, (Date.now() - startedAtRef.current) / 1000)
      if (!mountedRef.current) return
      if (analyse && blob.size > 0) {
        void analyseAudio(blob, duration)
      } else if (mountedRef.current) {
        setStage('ready')
      }
    }
    if (recorder.state !== 'inactive') recorder.stop()
    else recorder.stream.getTracks().forEach(track => track.stop())
  }

  async function startRecording() {
    // Duplicate-start guard: a rapid second tap must never start a second
    // MediaRecorder underneath the active one.
    if (recorderRef.current) return
    setError(null)
    setStatus(null)
    setFailedStep(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return }
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      setSeconds(0)
      setStage('recording')
      recorder.start(1000)
    } catch {
      console.error('[daily-capture] microphone access failed')
      setFailedStep('recording')
      setStage('failed')
    }
  }

  async function analyseAudio(blob: Blob, duration: number) {
    pendingAudioRef.current = { blob, duration }
    setStage('transcribing')
    setBusy(true)
    setError(null)
    setStatus('Uploading securely...')
    try {
      const result = await analyseDailyAssistantAudio(userId, blob, duration, { clientId, page })
      if (!mountedRef.current) return
      setBusy(false)
      setStatus(null)
      if (result.error || !result.data) {
        console.error('[daily-capture] transcription failed', result.error)
        setFailedStep('transcription')
        setStage('failed')
        return
      }
      setAnalysis(result.data)
      setText(result.data.transcript)
      setStage('reviewing')
    } catch (error) {
      if (!mountedRef.current) return
      console.error('[daily-capture] transcription error', error)
      setBusy(false)
      setStatus(null)
      setFailedStep('transcription')
      setStage('failed')
    }
  }

  async function analyseText() {
    if (!text.trim() || busy) return
    setStage('transcribing')
    setBusy(true)
    setError(null)
    setStatus('Structuring your day note...')
    try {
      const result = await analyseDailyAssistantText(userId, text, { clientId, page })
      if (!mountedRef.current) return
      setBusy(false)
      setStatus(null)
      if (result.error || !result.data) {
        console.error('[daily-capture] analysis failed', result.error)
        setFailedStep('transcription')
        setStage('failed')
        return
      }
      setAnalysis(result.data)
      setStage('reviewing')
    } catch (error) {
      if (!mountedRef.current) return
      console.error('[daily-capture] analysis error', error)
      setBusy(false)
      setStatus(null)
      setFailedStep('transcription')
      setStage('failed')
    }
  }

  function updateSuggestion(index: number, patch: Partial<DailySuggestion>) {
    setAnalysis(current => current ? {
      ...current,
      suggestions: current.suggestions.map((suggestion, itemIndex) => itemIndex === index ? { ...suggestion, ...patch } : suggestion),
    } : current)
  }

  function finishApply(result: DailyApplyResult) {
    try { window.localStorage.removeItem(draftKey) } catch { /* ignore */ }
    setText('')
    setAnalysis(null)
    setCompleteResult(result)
    setStage('complete')
    void loadTimeline()
  }

  // If the apply actually succeeded server-side but the response was lost, the
  // RPC refuses a second apply ("already been finalised"), so a retry can never
  // duplicate writes. Recover the verified counts from the capture record.
  async function settleFromAppliedCapture() {
    const captureId = analysis?.captureId
    if (!captureId) return false
    const captureResult = await listMyAssistantDayCaptures(5)
    const capture = (captureResult.data ?? []).find(item => item.id === captureId)
    const applied = capture?.applied_actions as Record<string, number> | null | undefined
    if (!applied) return false
    finishApply({
      tasks_created: Number(applied.tasks_created ?? 0),
      tasks_updated: Number(applied.tasks_updated ?? 0),
      existing_tasks_linked: Number(applied.existing_tasks_linked ?? 0),
      timeline_notes_saved: Number(applied.timeline_notes_saved ?? 0),
    })
    return true
  }

  async function confirm() {
    if (!analysis || busy) return
    const unresolvedSelected = analysis.suggestions.some(item => item.selected && (
      (item.client_name && item.client_status !== 'resolved')
      || (item.assignee_name && item.assignee_status !== 'resolved')
    ))
    if (unresolvedSelected) { setError('Resolve or deselect every amber item before saving.'); return }
    setStage('applying')
    setBusy(true)
    setError(null)
    setStatus('Saving confirmed actions...')
    try {
      const result = await applyDailyAssistantCapture(analysis)
      if (!mountedRef.current) return
      setBusy(false)
      setStatus(null)
      if (result.error || !result.data) {
        if (result.error && /already been finalised/i.test(result.error)) {
          const settled = await settleFromAppliedCapture()
          if (settled) return
        }
        console.error('[daily-capture] apply failed', result.error)
        setFailedStep('apply')
        setStage('failed')
        return
      }
      finishApply(result.data)
    } catch (error) {
      if (!mountedRef.current) return
      console.error('[daily-capture] apply error', error)
      setBusy(false)
      setStatus(null)
      setFailedStep('apply')
      setStage('failed')
    }
  }

  function retry() {
    if (failedStep === 'recording') { void startRecording(); return }
    if (failedStep === 'transcription' && pendingAudioRef.current) {
      const { blob, duration } = pendingAudioRef.current
      void analyseAudio(blob, duration)
      return
    }
    if (failedStep === 'transcription') { setFailedStep(null); setStage('ready'); return }
    if (failedStep === 'apply') { void confirm(); return }
  }

  function typeInstead() {
    setFailedStep(null)
    setStage('ready')
  }

  function backToReview() {
    setError(null)
    setFailedStep(null)
    setStage('reviewing')
  }

  function startOver() {
    setAnalysis(null)
    setText('')
    setError(null)
    setStatus(null)
    setSeconds(0)
    setFailedStep(null)
    setStage('ready')
  }

  function recordAnother() {
    setCompleteResult(null)
    startOver()
  }

  function done() {
    if (completeResult) {
      const taskNote = completeResult.tasks_created === 1 ? '1 task created' : `${completeResult.tasks_created} tasks created`
      const noteNote = completeResult.timeline_notes_saved === 1 ? '1 note saved' : `${completeResult.timeline_notes_saved} notes saved`
      onSaved(`Day captured: ${taskNote}, ${noteNote}.`)
    } else {
      onClose()
    }
  }

  async function completeItem(id: string) {
    const result = await completeMyAssistantDayItem(id)
    if (result.error) { setError(result.error.message); return }
    await loadTimeline()
  }

  const today = new Date().toLocaleDateString('en-CA')
  const todayCaptures = useMemo(() => captures.filter(capture => capture.capture_date === today), [captures, today])
  const openItems = useMemo(() => items.filter(item => item.state === 'open'), [items])

  const selectedSuggestions = useMemo(() => (analysis?.suggestions ?? []).filter(item => item.selected), [analysis])
  const tasks = useMemo(() => (analysis?.suggestions ?? []).filter(item => item.kind === 'create_task' || item.kind === 'update_task'), [analysis])
  const followUps = useMemo(() => (analysis?.suggestions ?? []).filter(item => item.kind === 'follow_up'), [analysis])
  const noteItems = useMemo(() => (analysis?.suggestions ?? []).filter(item => item.kind === 'note'), [analysis])
  const unresolvedSelectedCount = useMemo(() => (analysis?.suggestions ?? []).filter(item => item.selected && (
    (item.client_name && item.client_status !== 'resolved')
    || (item.assignee_name && item.assignee_status !== 'resolved')
  )).length, [analysis])

  const failureCopy = failedStep === 'recording'
    ? { title: 'Microphone unavailable', message: 'Microphone access is blocked. Allow it in Safari settings, or type the note instead.' }
    : failedStep === 'transcription'
      ? { title: 'Your update could not be processed', message: 'Nothing was applied. Retry the note, or type it instead.' }
      : { title: 'Your update could not be saved', message: 'Nothing was applied. Check your connection and try again.' }

  return (
    <section className="mb-2 max-h-[78dvh] overflow-y-auto rounded-2xl border border-brand-teal/30 bg-[#0c0f0e]/98 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl" aria-label="Personal daily assistant">
      <header className="sticky top-0 z-10 -mx-3 -mt-3 mb-3 border-b border-white/10 bg-[#0c0f0e]/95 px-3 pb-2 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-black text-white">My day capture</p>
            <p className="text-[11px] text-brand-primary/55">English, Afrikaans or mixed. Audio is discarded after transcription.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-md text-lg font-bold text-brand-primary/70 hover:text-white" aria-label="Close daily capture">x</button>
        </div>
        {stage === 'ready' && (
          <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
            <button type="button" onClick={() => setMode('capture')} className={`min-h-11 rounded-md text-xs font-black ${mode === 'capture' ? 'bg-brand-teal text-black' : 'text-brand-primary/65'}`}>Capture</button>
            <button type="button" onClick={() => setMode('timeline')} className={`min-h-11 rounded-md text-xs font-black ${mode === 'timeline' ? 'bg-brand-teal text-black' : 'text-brand-primary/65'}`}>Today / open loops</button>
          </div>
        )}
      </header>

      {mode === 'timeline' ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-black uppercase text-brand-teal">Today</p>
            {todayCaptures.length === 0 ? <p className="mt-2 text-sm text-brand-primary/60">No confirmed voice notes yet today.</p> : (
              <div className="mt-2 space-y-2">
                {todayCaptures.map(capture => (
                  <article key={capture.id} className="rounded-lg border border-white/8 bg-black/20 p-2.5">
                    <p className="text-sm font-bold text-white">{capture.summary || 'Daily note'}</p>
                    <p className="mt-1 text-[11px] text-brand-primary/45">{new Date(capture.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs font-black uppercase text-amber-200">Open loops ({openItems.length})</p>
            {openItems.length === 0 ? <p className="mt-2 text-sm text-brand-primary/60">Nothing captured here is waiting on you.</p> : (
              <div className="mt-2 space-y-2">
                {openItems.map(item => (
                  <article key={item.id} className="rounded-lg border border-white/8 bg-black/20 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-brand-primary/45">{item.kind.replace('_', ' ')}</p>
                        <p className="mt-1 text-sm font-bold text-white">{item.content}</p>
                        {item.due_date && <p className="mt-1 text-xs text-amber-200">Due {item.due_date}</p>}
                      </div>
                      <button type="button" onClick={() => void completeItem(item.id)} className="min-h-11 shrink-0 rounded-full border border-brand-teal/30 px-3 text-xs font-black text-brand-teal">Done</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : stage === 'ready' ? (
        <div className="space-y-3">
          <div>
            <p className="text-lg font-black text-white">Record your update</p>
            <p className="mt-1 text-sm text-brand-primary/70">Nothing writes until you review and confirm.</p>
          </div>
          <button
            type="button"
            onClick={() => void startRecording()}
            disabled={busy}
            className="flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl border border-brand-teal/35 bg-brand-teal/[0.08] text-base font-black text-white transition-colors disabled:opacity-40"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-xl text-black" aria-hidden="true">●</span>
            Record voice note
          </button>
          <div className="flex items-center gap-3 py-1" aria-hidden="true">
            <span className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-brand-primary/45">or type</span>
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <textarea
            value={text}
            onChange={event => setText(event.target.value)}
            rows={5}
            placeholder="Or type what happened..."
            className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-base text-white placeholder:text-brand-primary/35 focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
          <button type="button" onClick={() => void analyseText()} disabled={busy || !text.trim()} className="min-h-12 w-full rounded-full bg-brand-teal px-4 text-sm font-black text-black disabled:opacity-40">
            {busy ? 'Working...' : 'Review this note'}
          </button>
        </div>
      ) : stage === 'recording' ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-400/35 bg-red-400/[0.06] p-4 text-center">
            <p className="text-base font-black uppercase tracking-wide text-red-200" role="status" aria-live="polite">Recording</p>
            <p className="mt-2 font-mono text-4xl font-black tabular-nums text-white" aria-live="polite">{formatDuration(seconds)}</p>
            <button
              type="button"
              onClick={() => stopRecorder(true)}
              aria-label="Stop recording and review"
              className="mt-4 flex min-h-20 w-full animate-pulse items-center justify-center gap-3 rounded-2xl border border-red-400/40 bg-red-400/15 text-base font-black text-red-100"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-400 text-xl text-black" aria-hidden="true">■</span>
              Stop and review
            </button>
          </div>
          <p className="text-center text-xs text-brand-primary/60">Speak naturally. You can mix English and Afrikaans.</p>
        </div>
      ) : stage === 'transcribing' ? (
        <div className="space-y-3 rounded-2xl border border-brand-teal/25 bg-brand-teal/[0.05] p-4 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-teal/30 border-t-brand-teal" aria-hidden="true" />
          <p className="text-base font-black text-white" role="status" aria-live="polite">Transcribing your update</p>
          {status && <p className="text-xs text-brand-teal" role="status" aria-live="polite">{status}</p>}
        </div>
      ) : stage === 'reviewing' && analysis ? (
        <div className="space-y-4">
          <div>
            <p className="text-lg font-black text-white">Review before applying</p>
            <p className="mt-1 text-sm text-brand-primary/70">Nothing writes until you review and confirm.</p>
          </div>
          {unresolvedSelectedCount > 0 && (
            <div className="rounded-lg border border-amber-400/35 bg-amber-400/[0.06] p-3 text-xs text-amber-200" role="alert">
              <p className="font-black">{unresolvedSelectedCount} item{unresolvedSelectedCount === 1 ? '' : 's'} need{unresolvedSelectedCount === 1 ? 's' : ''} a confirmed client or staff name before applying.</p>
            </div>
          )}
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">What happened</span>
            <textarea value={analysis.summary} onChange={event => setAnalysis(current => current ? { ...current, summary: event.target.value } : current)} rows={3} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white" />
          </label>

          {tasks.length > 0 && (
            <ReviewGroup label="Tasks">
              {analysis.suggestions.map((suggestion, index) => (
                (suggestion.kind === 'create_task' || suggestion.kind === 'update_task') && (
                  <SuggestionEditor key={suggestion.id} suggestion={suggestion} clients={clients} staff={staff} onChange={patch => updateSuggestion(index, patch)} />
                )
              ))}
            </ReviewGroup>
          )}
          {followUps.length > 0 && (
            <ReviewGroup label="Reminders & follow-ups">
              {analysis.suggestions.map((suggestion, index) => (
                suggestion.kind === 'follow_up' && (
                  <SuggestionEditor key={suggestion.id} suggestion={suggestion} clients={clients} staff={staff} onChange={patch => updateSuggestion(index, patch)} />
                )
              ))}
            </ReviewGroup>
          )}
          {noteItems.length > 0 && (
            <ReviewGroup label="Notes">
              {analysis.suggestions.map((suggestion, index) => (
                suggestion.kind === 'note' && (
                  <SuggestionEditor key={suggestion.id} suggestion={suggestion} clients={clients} staff={staff} onChange={patch => updateSuggestion(index, patch)} />
                )
              ))}
            </ReviewGroup>
          )}

          <EditableLines label="Calls / discussions" values={analysis.calls} onChange={calls => setAnalysis(current => current ? { ...current, calls } : current)} />
          <EditableLines label="Promises / commitments" values={analysis.promises} onChange={promises => setAnalysis(current => current ? { ...current, promises } : current)} />
          <EditableLines label="Decisions" values={analysis.decisions} onChange={decisions => setAnalysis(current => current ? { ...current, decisions } : current)} />
          <EditableLines label="Questions / clarification" values={analysis.unresolved} onChange={unresolved => setAnalysis(current => current ? { ...current, unresolved } : current)} />
          <EditableLines label="Notes to retain" values={analysis.notes} onChange={notes => setAnalysis(current => current ? { ...current, notes } : current)} />

          {error && <p className="rounded-lg border border-red-400/25 bg-red-400/[0.06] p-2 text-xs text-red-200" role="alert">{error}</p>}
          {status && <p className="text-center text-xs text-brand-teal" role="status" aria-live="polite">{status}</p>}
          <div className="sticky bottom-0 -mx-3 grid grid-cols-[1fr_auto] gap-2 border-t border-white/10 bg-[#0c0f0e]/95 px-3 pb-[calc(.25rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
            <button type="button" onClick={() => void confirm()} disabled={busy} className="min-h-12 rounded-full bg-brand-teal px-4 text-sm font-black text-black disabled:opacity-40">Confirm selected</button>
            <button type="button" onClick={startOver} disabled={busy} className="min-h-12 rounded-full border border-white/12 px-4 text-sm font-bold text-brand-primary">Start over</button>
          </div>
        </div>
      ) : stage === 'applying' && analysis ? (
        <div className="space-y-3 rounded-2xl border border-brand-teal/25 bg-brand-teal/[0.05] p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-teal/30 border-t-brand-teal" aria-hidden="true" />
            <div>
              <p className="text-base font-black text-white" role="status" aria-live="polite">Applying your update</p>
              <p className="text-xs text-brand-teal">Saving confirmed actions…</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {selectedSuggestions.map(item => (
              <li key={item.id} className="flex gap-2 text-sm text-white">
                <span className="text-brand-teal" aria-hidden="true">•</span>
                <span className="min-w-0 break-words">{item.title}</span>
              </li>
            ))}
          </ul>
          {status && <p className="text-xs text-brand-teal" role="status" aria-live="polite">{status}</p>}
        </div>
      ) : stage === 'complete' && completeResult ? (
        <div className="space-y-4 rounded-2xl border border-brand-teal/30 bg-brand-teal/[0.06] p-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-2xl text-black" aria-hidden="true">✓</div>
          <div>
            <p className="text-lg font-black text-white">Update saved</p>
            <p className="mt-1 text-sm text-brand-primary/70">Your day capture is on your timeline.</p>
          </div>
          <ul className="mx-auto max-w-xs space-y-1 text-left text-sm text-white">
            {completeResult.tasks_created > 0 && <li>{completeResult.tasks_created} task{completeResult.tasks_created === 1 ? '' : 's'} created</li>}
            {completeResult.tasks_updated > 0 && <li>{completeResult.tasks_updated} existing task{completeResult.tasks_updated === 1 ? '' : 's'} updated</li>}
            {completeResult.existing_tasks_linked > 0 && <li>{completeResult.existing_tasks_linked} existing task{completeResult.existing_tasks_linked === 1 ? '' : 's'} linked</li>}
            {completeResult.timeline_notes_saved > 0 && <li>{completeResult.timeline_notes_saved} note{completeResult.timeline_notes_saved === 1 ? '' : 's'} saved to your timeline</li>}
          </ul>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={done} className="min-h-12 w-full rounded-full bg-brand-teal px-4 text-sm font-black text-black">Done</button>
            <button type="button" onClick={recordAnother} className="min-h-12 w-full rounded-full border border-brand-teal/35 px-4 text-sm font-bold text-brand-teal">Record another update</button>
          </div>
        </div>
      ) : stage === 'failed' ? (
        <div className="space-y-4 rounded-2xl border border-red-400/30 bg-red-400/[0.05] p-4 text-center">
          <p className="text-base font-black text-red-100" role="alert">{failureCopy.title}</p>
          <p className="text-sm text-brand-primary/70">{failureCopy.message}</p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={retry} className="min-h-12 w-full rounded-full bg-brand-teal px-4 text-sm font-black text-black">Try again</button>
            {failedStep === 'apply' ? (
              <button type="button" onClick={backToReview} className="min-h-12 w-full rounded-full border border-white/12 px-4 text-sm font-bold text-brand-primary">Back to review</button>
            ) : (
              <button type="button" onClick={typeInstead} className="min-h-12 w-full rounded-full border border-white/12 px-4 text-sm font-bold text-brand-primary">Type it instead</button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function ReviewGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wide text-brand-teal">{label}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  )
}

function EditableLines({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">{label}</span>
      <textarea value={values.join('\n')} onChange={event => onChange(splitLines(event.target.value))} rows={Math.max(2, Math.min(4, values.length + 1))} placeholder="None" className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-brand-primary/30" />
    </label>
  )
}

function SuggestionEditor({
  suggestion,
  clients,
  staff,
  onChange,
}: {
  suggestion: DailySuggestion
  clients: ActiveClientOption[]
  staff: StaffProfileOption[]
  onChange: (patch: Partial<DailySuggestion>) => void
}) {
  const needsClarification = Boolean(
    (suggestion.client_name && suggestion.client_status !== 'resolved')
    || (suggestion.assignee_name && suggestion.assignee_status !== 'resolved'),
  )
  return (
    <article className={`rounded-xl border p-3 ${needsClarification ? 'border-amber-400/35 bg-amber-400/[0.05]' : 'border-white/10 bg-white/[0.03]'}`}>
      <div className="flex items-center gap-3">
        <input type="checkbox" checked={suggestion.selected} onChange={event => onChange({ selected: event.target.checked })} className="h-6 w-6 shrink-0 accent-brand-teal" aria-label={`Include ${suggestion.title}`} />
        <select value={suggestion.kind} onChange={event => onChange({ kind: event.target.value as DailySuggestionKind })} className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121614] px-2 text-xs font-black text-white">
          {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <input value={suggestion.title} onChange={event => onChange({ title: event.target.value })} className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3 text-sm font-bold text-white" aria-label="Action title" />
      <textarea value={suggestion.detail} onChange={event => onChange({ detail: event.target.value })} rows={2} placeholder="Useful context" className="mt-2 w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white" />
      {suggestion.existing_task_id && (
        <div className="mt-2 rounded-lg border border-brand-teal/25 bg-brand-teal/[0.07] p-2 text-xs text-brand-teal">
          This may already be covered by <strong>{suggestion.existing_task_title}</strong>. It will update/link that task instead of creating a duplicate.
          <button type="button" onClick={() => onChange({ existing_task_id: null, existing_task_title: null, duplicate_confidence: null, kind: 'create_task' })} className="mt-1 block min-h-11 font-black underline">Create separately</button>
        </div>
      )}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="text-[10px] font-black uppercase text-brand-primary/50">
          Client
          <select value={suggestion.client_id ?? ''} onChange={event => {
            const client = clients.find(item => item.id === event.target.value)
            onChange({ client_id: client?.id ?? null, client_name: client?.name ?? null, client_status: client ? 'resolved' : 'unresolved', client_candidates: [] })
          }} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#121614] px-2 text-sm normal-case text-white">
            <option value="">No client</option>
            {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase text-brand-primary/50">
          Assignee
          <select value={suggestion.assignee_profile_id ?? ''} onChange={event => {
            const person = staff.find(item => item.id === event.target.value)
            onChange({ assignee_profile_id: person?.id ?? null, assignee_name: person?.full_name ?? null, assignee_status: person ? 'resolved' : 'unresolved', assignee_candidates: [] })
          }} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#121614] px-2 text-sm normal-case text-white">
            <option value="">Unassigned</option>
            {staff.map(person => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black uppercase text-brand-primary/50">
          Due date
          <input type="date" value={suggestion.due_date ?? ''} onChange={event => onChange({ due_date: event.target.value || null })} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#121614] px-2 text-sm normal-case text-white" />
        </label>
        <label className="text-[10px] font-black uppercase text-brand-primary/50">
          Reminder
          <input type="datetime-local" value={localInputValue(suggestion.reminder_at)} onChange={event => onChange({ reminder_at: localInputIso(event.target.value) })} className="mt-1 min-h-11 w-full rounded-lg border border-white/10 bg-[#121614] px-2 text-sm normal-case text-white" />
        </label>
      </div>
      {needsClarification && (
        <div className="mt-2 text-xs text-amber-200">
          <p className="font-black">Please confirm the highlighted match.</p>
          {[...suggestion.client_candidates, ...suggestion.assignee_candidates].slice(0, 4).map(candidate => <p key={`${candidate.id}:${candidate.name}`}>Did you mean {candidate.name}?</p>)}
          {suggestion.client_candidates.length + suggestion.assignee_candidates.length === 0 && <p>No confident directory match was found. Choose the correct client or staff member above, or deselect this action.</p>}
        </div>
      )}
    </article>
  )
}
