import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  buildAssistantLocalWorkContext,
  fetchActiveClients,
  sendAssistantMessage,
  type ActiveClientOption,
  type AssistantChatMessage,
  type AssistantLocalWorkContext,
} from '../../lib/assistant'
import { getMyDayContext } from '../../lib/workforceMyDay'
import { parseAssistantAction, type ActionProposal } from '../../lib/assistantActions'
import { listStaffProfiles } from '../../lib/contentWorkflow'
import { createCompanyEvent } from '../../lib/companyCalendar'
import { logPlannerActivity, listPlannerWorkloadSummary } from '../../lib/planner'
import { proposeScheduleChange } from '../../lib/scheduleChangeRequests'
import { enqueueBackgroundJob, nudgeBackgroundWorker, listMyBackgroundJobs, type BackgroundJob } from '../../lib/backgroundJobs'
import { createAssistantTask, updateAssistantTask } from '../../lib/assistantTasks'
import { listMyAssistantMemory, addAssistantMemory } from '../../lib/assistantMemory'
import { assistantUpdateVideo, resolveContentRun } from '../../lib/assistantVideos'
import {
  analyseMeetingAudio,
  analyseMeetingText,
  applyMeetingDebrief,
  type MeetingDebriefAnalysis,
} from '../../lib/meetingDebrief'
import { isManagerRole } from '../../lib/roles'

// ─────────────────────────────────────────────────────────────────────────────
// Global CG Assistant composer.
//
// A persistent, ChatGPT-style composer available across the whole authenticated
// staff app. Collapsed it is a slim launcher; expanded it is a chat panel.
//
// - Mobile: docked above the bottom navigation, full width.
// - Desktop: docked bottom-right, clear of the sidebar.
//
// It is automatically aware of the current page, client and record (derived from
// the route) plus the signed-in user's live work context, and routes models
// automatically through the existing provider system server-side — no model
// selection is ever exposed to the user.
// ─────────────────────────────────────────────────────────────────────────────

interface ComposerMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  restricted?: boolean
  setupRequired?: boolean
}

const SESSION_KEY = 'cg-global-assistant-v1'
let messageSeq = 0
function nextId() {
  messageSeq += 1
  return `gac-${messageSeq}-${messageSeq * 7}`
}

function loadSession(): ComposerMessage[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ComposerMessage[]
    return Array.isArray(parsed) ? parsed.slice(-40) : []
  } catch {
    return []
  }
}

// Human-friendly label for the current route, so the assistant knows where the
// user is without exposing any raw ids in the UI.
function pageLabelFromPath(pathname: string): string {
  const clean = pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean)
  if (clean.length === 0) return 'Hub'
  const map: Record<string, string> = {
    'cg-hub': 'Hub',
    clients: 'Clients',
    'client-schedule': 'Client Schedule',
    planner: 'Planner Board',
    'cg-calendar': 'CG Calendar',
    'command-centre': 'Daily Tasks',
    assistant: 'CG Assistant',
    reports: 'Reports',
    integrations: 'Meta / Integrations',
    content: 'Content',
    'content-workflow': 'Content Runs',
    published: 'Client Preview',
    'system-health': 'System Health',
  }
  return map[clean[0]] ?? clean[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Impl = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Impl ? new Impl() : null
}

export function GlobalAssistantComposer() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ComposerMessage[]>(loadSession)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [listening, setListening] = useState(false)
  // Afrikaans + English + code-switched speech. Web Speech is single-locale, so
  // we let the user flip the dictation locale; server-side Whisper is the
  // higher-fidelity path for true mixed speech.
  const [micLang, setMicLang] = useState<'en-ZA' | 'af-ZA'>('en-ZA')

  // Action-agent state: a parsed proposal is shown as a confirm/edit/cancel
  // preview before ANY write. Nothing mutates until the user confirms.
  const [proposal, setProposal] = useState<ActionProposal | null>(null)
  const [applying, setApplying] = useState(false)
  const [showJobs, setShowJobs] = useState(false)
  const [jobs, setJobs] = useState<BackgroundJob[]>([])

  // Post-meeting debrief flow: record/type → analyse → ONE editable confirmation
  // (meeting match, background, decisions, unresolved, tasks) → apply.
  const [debriefOpen, setDebriefOpen] = useState(false)
  const [debriefText, setDebriefText] = useState('')
  const [debriefBusy, setDebriefBusy] = useState(false)
  const [debriefRecording, setDebriefRecording] = useState(false)
  const [debrief, setDebrief] = useState<MeetingDebriefAnalysis | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const navigate = useNavigate()
  const isManager = isManagerRole(profile?.role)

  const workContextRef = useRef<AssistantLocalWorkContext | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const attachRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const clientsRef = useRef<ActiveClientOption[]>([])
  const staffRef = useRef<string[]>([])
  const managementRef = useRef<string | null>(null)
  const memoryRef = useRef<string[]>([])

  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), [])

  // Load the authorised client + staff lists once, for name resolution. These
  // come through RLS, so a user only ever sees clients/staff they may see.
  useEffect(() => {
    let active = true
    fetchActiveClients().then(list => { if (active) clientsRef.current = list }).catch(() => {})
    listStaffProfiles().then(res => {
      if (active && !res.migrationNeeded) staffRef.current = res.data.map(s => s.full_name).filter((n): n is string => Boolean(n))
    }).catch(() => {})
    // Management grounding: only authorised admin/manager get a cross-team
    // workload summary the master assistant can reason over. RLS on the RPC also
    // enforces this server-side — normal staff never receive it.
    if (isManager) {
      listPlannerWorkloadSummary().then(res => {
        if (!active || res.error || !res.data) return
        const rows = res.data
        const overdue = rows.reduce((sum, r) => sum + (r.overdue_count ?? 0), 0)
        const blocked = rows.reduce((sum, r) => sum + (r.blocked_count ?? 0), 0)
        const unassigned = rows[0]?.unassigned_total ?? 0
        const busiest = [...rows].sort((a, b) => (b.active_task_count ?? 0) - (a.active_task_count ?? 0))[0]
        managementRef.current = `cross-team: ${overdue} overdue, ${blocked} blocked, ${unassigned} unassigned` +
          (busiest ? `, busiest ${busiest.full_name} (${busiest.active_task_count} active)` : '')
      }).catch(() => {})
    }
    return () => { active = false }
  }, [isManager])

  // Durable per-user memory (own-only via RLS). Loaded once so the personal
  // assistant is grounded in what this user has asked it to remember. Strictly
  // isolated — no other user's or client's memory is ever visible.
  useEffect(() => {
    let active = true
    listMyAssistantMemory(12)
      .then(res => {
        if (active && !res.error && res.data) {
          memoryRef.current = res.data.map(m => m.content).filter(Boolean)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [profile])

  // Load the signed-in user's live work context once (best-effort; the assistant
  // still works without it).
  useEffect(() => {
    let active = true
    getMyDayContext(profile ?? null)
      .then(ctx => {
        if (active) workContextRef.current = buildAssistantLocalWorkContext(ctx)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-40)))
    } catch {
      /* ignore quota */
    }
  }, [messages])

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, messages, sending])

  // Stop dictation if the panel closes.
  useEffect(() => {
    if (!open && listening) stopListening()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Live background-job states while the jobs panel is open.
  useEffect(() => {
    if (!open || !showJobs) return
    void loadJobs()
    const interval = window.setInterval(() => { void loadJobs() }, 5000)
    return () => window.clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showJobs])

  const pageLabel = pageLabelFromPath(location.pathname)
  // The full Assistant page has its own composer — don't stack a second one.
  const onAssistantPage = location.pathname.startsWith('/admin/assistant')
  const clientId = searchParams.get('client') ?? searchParams.get('clientId') ?? ''
  const recordId = searchParams.get('reportId') ?? searchParams.get('runId') ?? searchParams.get('id') ?? ''

  function currentContextLine(): string {
    const parts = [`page: ${pageLabel}`, `role: ${profile?.role ?? 'team'}`]
    if (clientId) parts.push(`clientId: ${clientId}`)
    if (recordId) parts.push(`recordId: ${recordId}`)
    // Management grounding is only ever added for authorised admin/manager.
    if (isManager && managementRef.current) parts.push(managementRef.current)
    // Durable per-user memory (own-only) grounds the personal assistant.
    if (memoryRef.current.length > 0) parts.push(`remembered: ${memoryRef.current.slice(0, 6).join('; ')}`)
    return parts.join(', ')
  }

  async function loadJobs() {
    const res = await listMyBackgroundJobs(10)
    if (!res.error) setJobs((res.data ?? []) as BackgroundJob[])
  }

  function pushAssistant(text: string) {
    setMessages(current => [...current, { id: nextId(), role: 'assistant', text }])
  }

  // Confirmed action → execute through an existing RLS-protected path, then
  // audit. Nothing here runs until the user confirms the preview.
  async function applyProposal() {
    if (!proposal || applying) return
    const p = proposal
    setApplying(true)
    setError(null)
    try {
      if (p.type === 'job.enqueue') {
        const jobType = String(p.fields.job)
        const baseline = p.fields.baseline === 'yes'
        const today = new Date().toISOString().slice(0, 10)
        const res = await enqueueBackgroundJob({
          jobType,
          payload: jobType === 'meta_sync' ? { baseline } : {},
          // Idempotent per type per day (+baseline) so double-asking does not
          // duplicate work.
          idempotencyKey: `${jobType}-${today}${baseline ? '-baseline' : ''}`,
        })
        if (res.error) throw new Error(res.error.message)
        void nudgeBackgroundWorker()
        setProposal(null)
        setShowJobs(true)
        void loadJobs()
        pushAssistant(`Queued ${jobType === 'meta_sync' ? 'Meta sync' : 'report preparation'} as a background job. It runs on the server and continues even if you close the app — I'll notify you when it finishes. Progress is under "Background jobs".`)
        return
      }
      if (p.type === 'calendar.create') {
        const date = String(p.fields.date)
        const time = p.fields.time ? String(p.fields.time) : null
        const startAt = `${date}T${time ?? '09:00'}:00`
        const res = await createCompanyEvent({
          title: String(p.fields.title ?? 'Meeting'),
          event_type: String(p.fields.event_type) === 'client_event' ? 'client_event' : 'meeting',
          client_id: p.clientId,
          client_name: p.clientName,
          start_at: startAt,
        })
        if (res.error) throw new Error(res.error.message)
        if (res.tableMissing) throw new Error('CG Calendar is not enabled in this database yet.')
        if (res.data) {
          await logPlannerActivity({
            entity_type: 'company_calendar_event', entity_id: res.data.id, action: 'assistant_created',
            actor_user_id: profile?.id ?? null, actor_name: profile?.full_name ?? null,
            metadata: { via: 'cg_assistant', title: res.data.title, start_at: startAt },
          })
        }
        setProposal(null)
        pushAssistant(`Done — created "${p.fields.title}" on ${date}${time ? ` at ${time}` : ''} in CG Calendar.`)
      } else if (p.type === 'schedule.propose') {
        if (!recordId) { setError('Open the Client Schedule post first so I know which item to change.'); return }
        const res = await proposeScheduleChange({
          deliverableId: recordId,
          change: { scheduled_date: String(p.fields.new_date) },
          reason: p.fields.note ? String(p.fields.note) : null,
          requestedBy: profile?.id ?? null,
          requestedByName: profile?.full_name ?? null,
        })
        if (res.error) throw new Error(res.error.message)
        setProposal(null)
        pushAssistant('Submitted. This Client Schedule change stays pending until an Admin approves it.')
      } else if (p.type === 'memory.add') {
        // Durable per-user memory. RLS constrains the row to this user only.
        if (!profile?.id) throw new Error('Sign in to save assistant memory.')
        const note = String(p.fields.note ?? '').trim()
        if (!note) { setError('Nothing to remember.'); return }
        const res = await addAssistantMemory(profile.id, note)
        if (res.error) throw new Error(res.error.message)
        memoryRef.current = [note, ...memoryRef.current].slice(0, 12)
        setProposal(null)
        pushAssistant(`Got it — I'll remember that: "${note}".`)
      } else if (p.type === 'task.create' || p.type === 'task.assign') {
        // Direct canonical task write through the audited SECURITY DEFINER RPC.
        // The task lands on the real operations board, is audited, and the
        // assignee is notified — no routing, no hidden store.
        const res = await createAssistantTask({
          title: String(p.fields.task ?? 'New task'),
          assigneeName: p.fields.assignee ? String(p.fields.assignee) : null,
          dueDate: p.fields.due_date ? String(p.fields.due_date) : null,
          clientId: p.clientId,
          clientName: p.clientName,
        })
        if (res.error) throw new Error(res.error.message)
        const assignee = p.fields.assignee ? ` for ${p.fields.assignee}` : ''
        const due = p.fields.due_date ? ` (due ${p.fields.due_date})` : ''
        setProposal(null)
        pushAssistant(`Done — created the task${assignee}${due}. It's on the board${assignee ? ' and they have been notified' : ''}.`)
      } else if (p.type === 'task.update') {
        // Complete / block an existing task. Needs the task in context (opened
        // from a task record); otherwise ask rather than guess which task.
        if (!recordId) {
          setError('Open the task first (or tell me which task), then I can update it.')
          return
        }
        const action = p.fields.status === 'done' ? 'complete' : 'block'
        const res = await updateAssistantTask({ taskId: recordId, action })
        if (res.error) throw new Error(res.error.message)
        setProposal(null)
        pushAssistant(action === 'complete' ? 'Done — task marked complete.' : 'Done — task flagged as blocked.')
      } else if (p.type === 'video.mark_shot' || p.type === 'video.move') {
        // Direct Content Run video actions through the audited RPC. The run is
        // the one on the current page when open, else resolved deterministically
        // (current client's most recent run / most recent run). No routing.
        const onContent = location.pathname.includes('/admin/content')
        let runId = onContent && recordId ? recordId : null
        let runName: string | null = null
        if (!runId) {
          const run = await resolveContentRun(p.clientId ?? (clientId || null))
          if (!run) { setError('I could not find a Content Run to act on. Tell me the client or open the run.'); return }
          runId = run.id
          runName = run.name
        }
        if (p.type === 'video.mark_shot') {
          const numbers = String(p.fields.videos ?? '')
            .split(/[\s,]+/)
            .map(Number)
            .filter(n => Number.isInteger(n) && n > 0)
          if (numbers.length === 0) { setError('Which video number should I mark as shot?'); return }
          for (const n of numbers) {
            const res = await assistantUpdateVideo({ runId, videoNumber: n, action: 'shot' })
            if (res.error) throw new Error(`Video ${n}: ${res.error.message}`)
          }
          setProposal(null)
          pushAssistant(`Done — marked video${numbers.length > 1 ? 's' : ''} ${numbers.join(', ')} as shot${runName ? ` on "${runName}"` : ''}.`)
        } else {
          const n = Number(p.fields.video)
          if (!Number.isInteger(n) || n <= 0) { setError('Which video number should I move?'); return }
          const month = String(p.fields.scheduled_date ?? '')
          const res = await assistantUpdateVideo({
            runId,
            videoNumber: n,
            action: /^\d{4}-\d{2}-\d{2}$/.test(month) ? 'move_to_month' : 'move_next_month',
            scheduledMonth: /^\d{4}-\d{2}-\d{2}$/.test(month) ? month : null,
          })
          if (res.error) throw new Error(res.error.message)
          const moved = res.data as { month?: string | null } | null
          setProposal(null)
          pushAssistant(`Done — moved video ${n} to ${moved?.month ? moved.month.slice(0, 7) : 'next month'}${runName ? ` on "${runName}"` : ''}. The Client Schedule link needs confirmation before it appears on the schedule.`)
        }
      } else {
        // calendar.cancel still needs the on-record calendar entry to act on.
        setProposal(null)
        pushAssistant('Opening CG Calendar so you can finish this on the record.')
        navigate('/admin/cg-calendar')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete that action.')
    } finally {
      setApplying(false)
    }
  }

  // ── Meeting debrief flow ────────────────────────────────────────────────
  async function startDebriefRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      recorder.ondataavailable = event => { if (event.data.size > 0) audioChunksRef.current.push(event.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        if (blob.size > 0) void analyseDebrief({ audio: blob })
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setDebriefRecording(true)
    } catch {
      setError('Microphone access was blocked. Type the debrief instead.')
    }
  }

  function stopDebriefRecording() {
    mediaRecorderRef.current?.stop()
    setDebriefRecording(false)
  }

  async function analyseDebrief(input: { audio?: Blob; eventId?: string }) {
    setDebriefBusy(true)
    setError(null)
    try {
      const opts = { eventId: input.eventId, clientId: clientId || undefined }
      const res = input.audio
        ? await analyseMeetingAudio(input.audio, opts)
        : await analyseMeetingText(input.eventId && debrief ? debrief.transcript : debriefText, opts)
      if (res.error || !res.data) { setError(res.error ?? 'The debrief could not be analysed.'); return }
      setDebrief(res.data)
    } finally {
      setDebriefBusy(false)
    }
  }

  async function confirmDebrief() {
    if (!debrief || debriefBusy) return
    setDebriefBusy(true)
    setError(null)
    try {
      const res = await applyMeetingDebrief({
        debriefId: debrief.debriefId,
        summary: debrief.summary,
        decisions: debrief.decisions,
        unresolved: debrief.unresolved,
        tasks: debrief.tasks
          .filter(t => t.title.trim())
          .map(t => ({ title: t.title, assignee_name: t.assignee_name, client_id: t.client_id, client_name: t.client_name, due_date: t.due_date })),
      })
      if (res.error || !res.data) { setError(res.error ?? 'The debrief could not be applied.'); return }
      setDebrief(null)
      setDebriefOpen(false)
      setDebriefText('')
      setOpen(true)
      pushAssistant(
        `Debrief saved${res.data.notes_saved ? ' — notes are on the meeting' : ''}` +
        `${res.data.tasks_created > 0 ? ` and ${res.data.tasks_created} task${res.data.tasks_created > 1 ? 's were' : ' was'} created on the board (assignees notified)` : ''}.`,
      )
    } finally {
      setDebriefBusy(false)
    }
  }

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || sending || applying) return

    // Action agent first: understand the instruction as a concrete app action.
    // A proposal is shown as a confirm/edit/cancel preview; ambiguity asks; a
    // plain question falls through to chat.
    const parsed = parseAssistantAction(clean, {
      today: new Date().toISOString().slice(0, 10),
      clients: clientsRef.current,
      staffNames: staffRef.current,
      role: profile?.role ?? 'team',
      currentClientId: clientId || null,
      currentClientName: clientsRef.current.find(c => c.id === clientId)?.name ?? null,
    })
    if (parsed && 'type' in parsed) {
      setInput('')
      setError(null)
      setProposal(parsed)
      setOpen(true)
      return
    }
    if (parsed && 'clarify' in parsed) {
      setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
      setInput('')
      setOpen(true)
      pushAssistant(parsed.clarify)
      return
    }

    const history: AssistantChatMessage[] = messages.map(m => ({ role: m.role, content: m.text }))
    setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
    setInput('')
    setError(null)
    setSending(true)
    setOpen(true)

    // The assistant receives the current page/client/record as context; the user
    // only ever sees their own typed message.
    const contextual = `[Context — ${currentContextLine()}]\n${clean}`
    const response = await sendAssistantMessage(contextual, history, workContextRef.current, null)
    setSending(false)
    if (!response.ok) setError(response.error ?? 'CG Assistant is unavailable right now.')
    setMessages(current => [
      ...current,
      {
        id: nextId(),
        role: 'assistant',
        text: response.answer,
        restricted: response.restricted,
        setupRequired: response.setupRequired,
      },
    ])
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(input)
  }

  function startListening() {
    const recognition = getSpeechRecognition()
    if (!recognition) return
    recognition.lang = micLang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = event => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      setInput(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setOpen(true)
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
    }
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function toggleMic() {
    if (listening) stopListening()
    else startListening()
  }

  function onAttach(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    // The chat function is text-first; we reference the attachment by name so the
    // assistant can reason about it. Binary upload lands where the backend
    // supports it.
    setInput(current => `${current ? `${current} ` : ''}[Attached file: ${file.name}] `.trimStart())
    setOpen(true)
    setPlusOpen(false)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function newChat() {
    setMessages([])
    setError(null)
    setPlusOpen(false)
    try {
      window.sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
  }

  const STARTERS = [
    'What should I focus on today?',
    `Summarise this ${pageLabel} page for me`,
    'Draft a client update',
  ]

  if (onAssistantPage) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-2 md:inset-x-auto md:right-5 md:bottom-5 md:px-0">
      <div className="pointer-events-auto mx-auto w-full max-w-2xl md:mx-0 md:w-[26rem]">
        {open && (
          <div className="mb-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0c0f0e]/98 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-teal/15 text-[11px] font-black text-brand-teal">CG</span>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">CG Assistant</p>
                  <p className="text-[10px] text-brand-primary/55">Knows: {pageLabel}{clientId ? ' · this client' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/admin/assistant" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[11px] font-bold text-brand-primary/70 hover:text-white" title="Open full assistant">Expand</Link>
                <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm font-bold text-brand-primary/70 hover:text-white" aria-label="Minimise assistant">–</button>
              </div>
            </div>

            {showJobs && (
              <div className="border-b border-white/10 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-wide text-brand-primary/60">Background jobs</p>
                  <button type="button" onClick={() => setShowJobs(false)} className="text-[11px] font-bold text-brand-primary/60 hover:text-white">Hide</button>
                </div>
                {jobs.length === 0 ? (
                  <p className="text-xs text-brand-primary/45">No background jobs yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {jobs.map(job => {
                      const tone = job.status === 'succeeded' ? 'text-[#2dd4bf]' : job.status === 'failed' ? 'text-red-300' : job.status === 'running' ? 'text-amber-300' : 'text-brand-primary/60'
                      return (
                        <li key={job.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-xs font-semibold text-white">{job.job_type.replace(/_/g, ' ')}</span>
                            <span className={`shrink-0 text-[10px] font-black uppercase ${tone}`}>{job.status}</span>
                          </div>
                          {(job.status === 'running' || job.status === 'queued') && (
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
                              <div className="h-full rounded-full bg-brand-teal transition-all" style={{ width: `${job.progress}%` }} />
                            </div>
                          )}
                          {job.status === 'failed' && job.error && <p className="mt-1 truncate text-[10px] text-red-300/80">{job.error}</p>}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}

            <div ref={scrollRef} className="max-h-[min(60vh,26rem)] min-h-[8rem] space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3">
              {messages.length === 0 && !sending && (
                <div className="space-y-2 py-2">
                  <p className="px-1 text-xs text-brand-primary/60">Ask anything about your work, clients or this page.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {STARTERS.map(s => (
                      <button key={s} type="button" onClick={() => void send(s)} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-brand-primary/80 hover:border-brand-teal/40 hover:text-white">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map(message => (
                <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-brand-teal/15 text-white'
                      : message.setupRequired
                        ? 'border border-amber-400/25 bg-amber-400/[0.06] text-amber-100'
                        : 'border border-white/10 bg-white/[0.04] text-brand-primary'
                  }`}>
                    {message.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-brand-primary/60">CG Assistant is thinking…</div>
                </div>
              )}
              {error && <p className="px-1 text-xs text-red-300">{error}</p>}
            </div>
          </div>
        )}

        {/* Meeting debrief — record/type → ONE editable confirmation → apply */}
        {debriefOpen && (
          <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-brand-teal/30 bg-[#0c0f0e]/98 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-white">Meeting debrief</p>
              <button type="button" onClick={() => { setDebriefOpen(false); setDebrief(null); setDebriefText(''); if (debriefRecording) stopDebriefRecording() }} className="rounded-md px-2 py-1 text-sm font-bold text-brand-primary/70 hover:text-white">✕</button>
            </div>

            {!debrief ? (
              <div className="space-y-2">
                <p className="text-xs text-brand-primary/60">Speak or type what happened in the meeting — English, Afrikaans or mixed. Nothing is saved until you confirm the preview.</p>
                <textarea
                  value={debriefText}
                  onChange={event => setDebriefText(event.target.value)}
                  rows={4}
                  placeholder="Type the debrief here, or record it…"
                  className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-sm text-white placeholder:text-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => (debriefRecording ? stopDebriefRecording() : void startDebriefRecording())}
                    disabled={debriefBusy}
                    className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-40 ${debriefRecording ? 'animate-pulse border-red-400/40 bg-red-400/15 text-red-200' : 'border-white/12 text-brand-primary hover:text-white'}`}
                  >
                    {debriefRecording ? 'Stop recording' : 'Record voice note'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void analyseDebrief({})}
                    disabled={debriefBusy || !debriefText.trim()}
                    className="flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40"
                  >
                    {debriefBusy ? 'Analysing…' : 'Analyse text'}
                  </button>
                </div>
                {debriefBusy && !debriefRecording && <p className="text-xs text-brand-primary/60">Transcribing and structuring the debrief…</p>}
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Meeting</span>
                  <select
                    value={debrief.meeting?.id ?? ''}
                    onChange={event => { const id = event.target.value; if (id && id !== debrief.meeting?.id) void analyseDebrief({ eventId: id }) }}
                    className="mt-0.5 w-full rounded-md border border-white/10 bg-[#121614] px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  >
                    {debrief.candidates.length === 0 && <option value="">No recent meeting found</option>}
                    {debrief.candidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title} — {c.startAt.slice(0, 10)}{c.clientName ? ` (${c.clientName})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Background notes</span>
                  <textarea
                    value={debrief.summary}
                    onChange={event => setDebrief(current => current ? { ...current, summary: event.target.value } : current)}
                    rows={3}
                    className="mt-0.5 w-full resize-y rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Decisions (one per line)</span>
                  <textarea
                    value={debrief.decisions.join('\n')}
                    onChange={event => setDebrief(current => current ? { ...current, decisions: event.target.value.split('\n').map(v => v.trim()).filter(Boolean) } : current)}
                    rows={2}
                    className="mt-0.5 w-full resize-y rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Unresolved (one per line)</span>
                  <textarea
                    value={debrief.unresolved.join('\n')}
                    onChange={event => setDebrief(current => current ? { ...current, unresolved: event.target.value.split('\n').map(v => v.trim()).filter(Boolean) } : current)}
                    rows={2}
                    className="mt-0.5 w-full resize-y rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  />
                </label>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wide text-brand-primary/55">Tasks ({debrief.tasks.length})</span>
                  <div className="mt-1 space-y-1.5">
                    {debrief.tasks.map((task, index) => (
                      <div key={index} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            value={task.title}
                            onChange={event => setDebrief(current => current ? { ...current, tasks: current.tasks.map((t, i) => i === index ? { ...t, title: event.target.value } : t) } : current)}
                            placeholder="Task title"
                            className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                          />
                          <button type="button" aria-label="Remove task" onClick={() => setDebrief(current => current ? { ...current, tasks: current.tasks.filter((_, i) => i !== index) } : current)} className="shrink-0 rounded-md px-1.5 text-sm font-bold text-brand-primary/60 hover:text-red-300">✕</button>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <input
                            value={task.assignee_name ?? ''}
                            onChange={event => setDebrief(current => current ? { ...current, tasks: current.tasks.map((t, i) => i === index ? { ...t, assignee_name: event.target.value || null } : t) } : current)}
                            placeholder="Assignee"
                            className={`w-32 rounded-md border px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-teal ${task.assignee_name && !task.resolved_assignee ? 'border-amber-400/40 bg-amber-400/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}
                            title={task.assignee_name && !task.resolved_assignee ? 'Not matched to a staff member — check the name' : undefined}
                          />
                          <input
                            type="date"
                            value={task.due_date ?? ''}
                            onChange={event => setDebrief(current => current ? { ...current, tasks: current.tasks.map((t, i) => i === index ? { ...t, due_date: event.target.value || null } : t) } : current)}
                            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                            title="Leave empty to keep no due date"
                          />
                          {task.client_name && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary/70">{task.client_name}</span>}
                          {!task.due_date && <span className="text-[10px] text-brand-primary/45">no due date</span>}
                        </div>
                      </div>
                    ))}
                    {debrief.tasks.length === 0 && <p className="text-xs text-brand-primary/45">No tasks were mentioned.</p>}
                  </div>
                </div>
                {error && <p className="text-xs text-red-300">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => void confirmDebrief()} disabled={debriefBusy} className="flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40">
                    {debriefBusy ? 'Saving…' : `Save notes${debrief.tasks.filter(t => t.title.trim()).length > 0 ? ` + create ${debrief.tasks.filter(t => t.title.trim()).length} task${debrief.tasks.filter(t => t.title.trim()).length > 1 ? 's' : ''}` : ''}`}
                  </button>
                  <button type="button" onClick={() => setDebrief(null)} className="rounded-full border border-white/12 px-3 py-1.5 text-sm font-bold text-brand-primary hover:text-white">Back</button>
                </div>
              </div>
            )}
            {error && !debrief && <p className="mt-2 text-xs text-red-300">{error}</p>}
          </div>
        )}

        {/* Action preview — confirm/edit/cancel before any write */}
        {proposal && (
          <div className="mb-2 rounded-2xl border border-brand-teal/30 bg-[#0c0f0e]/98 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-black text-white">{proposal.title}</p>
              <span className="shrink-0 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-teal">Preview</span>
            </div>
            {proposal.requiresApproval && proposal.approvalNote && (
              <p className="mb-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2 py-1 text-[11px] text-amber-200">{proposal.approvalNote}</p>
            )}
            <div className="space-y-1.5">
              {Object.entries(proposal.fields)
                .filter(([, value]) => value !== null && value !== undefined && String(value) !== '')
                .map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[10px] font-black uppercase tracking-wide text-brand-primary/55">{key.replace(/_/g, ' ')}</span>
                    <input
                      value={String(value)}
                      onChange={event => setProposal(current => current ? { ...current, fields: { ...current.fields, [key]: event.target.value } } : current)}
                      className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                    />
                  </label>
                ))}
            </div>
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void applyProposal()} disabled={applying} className="flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40">
                {applying ? 'Working…' : proposal.requiresApproval ? 'Submit for approval' : 'Confirm'}
              </button>
              <button type="button" onClick={() => { setProposal(null); setError(null); inputRef.current?.focus() }} className="rounded-full border border-white/12 px-3 py-1.5 text-sm font-bold text-brand-primary hover:text-white">Cancel</button>
            </div>
          </div>
        )}

        {/* Composer bar */}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-1.5 rounded-2xl border border-white/12 bg-[#0c0f0e]/98 px-2 py-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {plusOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-xl border border-white/12 bg-[#121614] p-1 shadow-2xl">
              <button type="button" onClick={newChat} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">New chat</button>
              <button type="button" onClick={() => { setShowJobs(true); setOpen(true); setPlusOpen(false); void loadJobs() }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Background jobs</button>
              <button type="button" onClick={() => { setDebriefOpen(true); setPlusOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Meeting debrief</button>
              <button type="button" onClick={() => { attachRef.current?.click() }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Attach file</button>
              <Link to="/admin/assistant" onClick={() => { setPlusOpen(false); setOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Open full assistant</Link>
            </div>
          )}
          <input ref={attachRef} type="file" className="hidden" onChange={event => onAttach(event.target.files)} />

          <button
            type="button"
            onClick={() => setPlusOpen(value => !value)}
            aria-label="More actions"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-lg font-bold text-brand-primary transition-colors hover:text-white"
          >
            +
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(input)
              }
            }}
            rows={1}
            placeholder="Ask CG Assistant"
            aria-label="Ask CG Assistant"
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-brand-primary/45 focus:outline-none"
          />

          {speechSupported && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setMicLang(l => (l === 'en-ZA' ? 'af-ZA' : 'en-ZA'))}
                className="rounded-md px-1 text-[10px] font-black uppercase tracking-wide text-brand-primary/60 hover:text-white"
                title="Dictation language"
                aria-label={`Dictation language: ${micLang === 'en-ZA' ? 'English' : 'Afrikaans'}`}
              >
                {micLang === 'en-ZA' ? 'EN' : 'AF'}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                aria-pressed={listening}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors ${
                  listening ? 'animate-pulse border-red-400/40 bg-red-400/15 text-red-200' : 'border-white/12 bg-white/[0.04] text-brand-primary hover:text-white'
                }`}
              >
                ●
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send to CG Assistant"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-teal text-base font-black text-black transition-opacity disabled:opacity-35"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  )
}

export default GlobalAssistantComposer
