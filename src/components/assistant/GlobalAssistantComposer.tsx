import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
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
import { logPlannerActivity, listPlannerWorkloadSummary, loadOwnershipReviewSummary } from '../../lib/planner'
import { proposeScheduleChange } from '../../lib/scheduleChangeRequests'
import { enqueueBackgroundJob, nudgeBackgroundWorker, listMyBackgroundJobs, type BackgroundJob } from '../../lib/backgroundJobs'
import { createAssistantTask, updateAssistantTask } from '../../lib/assistantTasks'
import { listTasks, type CommandCentreTask } from '../../lib/commandCentre'
import { listMyAssistantMemory, addAssistantMemory } from '../../lib/assistantMemory'
import { assistantUpdateVideo, resolveContentRun } from '../../lib/assistantVideos'
import {
  analyseMeetingAudio,
  analyseMeetingText,
  applyMeetingDebrief,
  type MeetingDebriefAnalysis,
} from '../../lib/meetingDebrief'
import { runMicrosoftSync, checkMicrosoftSyncAvailability } from '../../lib/assistantMicrosoftSync'
import {
  findOpenArtifact,
  getCurrentVersion,
  listAwaitingReview,
  recordMarketingDecision,
  runMarketingSpecialist,
  SPECIALIST_LABELS,
  type MarketingArtifact,
  type MarketingSpecialist,
} from '../../lib/marketingWorkflow'
import { isManagerRole } from '../../lib/roles'
import { friendlyAssistantError } from '../../lib/assistantErrors'
import { useBodyScrollLock, useIsMobileViewport, useVisualViewportBottomInset, useVisualViewportRect } from '../../lib/mobileViewport'
import { MAX_VOICE_SECONDS } from '../../lib/voiceDebriefRequest'
import { DailyAssistantCapture } from './DailyAssistantCapture'
import { dailyAssistantContextLine, listMyAssistantDayCaptures, listMyAssistantDayItems } from '../../lib/dailyAssistant'

// ─────────────────────────────────────────────────────────────────────────────
// Global CG Assistant composer.
//
// A persistent, ChatGPT-style composer available across the whole authenticated
// staff app. Collapsed it is a slim launcher; expanded it is a chat panel.
//
// - Mobile: a slim launcher docked above the bottom navigation. Opening it
//   promotes the assistant to a FULL-SCREEN sheet sized to the visual viewport,
//   so the keyboard shrinks the sheet instead of covering it, the page behind is
//   frozen and untappable, and the app's bottom navigation steps aside.
// - Desktop: docked bottom-right, clear of the sidebar. Unchanged.
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

interface DebriefRequestToken {
  id: number
  profileId: string
}

const SESSION_KEY_PREFIX = 'cg-global-assistant-v1'
let messageSeq = 0
function nextId() {
  messageSeq += 1
  return `gac-${messageSeq}-${messageSeq * 7}`
}

function sessionKey(userId: string) {
  return `${SESSION_KEY_PREFIX}:${userId}`
}

function loadSession(userId: string | null): ComposerMessage[] {
  if (!userId) return []
  try {
    const raw = window.sessionStorage.getItem(sessionKey(userId))
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

interface GlobalAssistantComposerProps {
  /**
   * Reports whether the assistant currently owns the whole mobile screen, so
   * the app shell can stand its bottom navigation down and put the page behind
   * out of the accessibility tree.
   */
  onMobileFullscreenChange?: (fullscreen: boolean) => void
}

export function GlobalAssistantComposer({ onMobileFullscreenChange }: GlobalAssistantComposerProps = {}) {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ComposerMessage[]>(() => loadSession(profile?.id ?? null))
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  // Whether the last failure is worth retrying, and the message to retry with.
  // Raw Edge Function / provider strings never reach the UI — see assistantErrors.
  const [chatErrorRetryable, setChatErrorRetryable] = useState(false)
  const [lastUserMessage, setLastUserMessage] = useState('')
  const [proposalError, setProposalError] = useState<string | null>(null)
  const [debriefError, setDebriefError] = useState<string | null>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  // Mobile initial state: secondary suggestions stay behind a small "More"
  // toggle so the first screen is just a prompt + two primary actions.
  const [moreOpen, setMoreOpen] = useState(false)
  const [listening, setListening] = useState(false)
  // Afrikaans + English + code-switched speech. Web Speech is single-locale, so
  // we let the user flip the dictation locale; server-side Whisper is the
  // higher-fidelity path for true mixed speech.
  const [micLang, setMicLang] = useState<'en-ZA' | 'af-ZA'>('en-ZA')

  // Action-agent state: a parsed proposal is shown as a confirm/edit/cancel
  // preview before ANY write. Nothing mutates until the user confirms.
  const [proposal, setProposal] = useState<ActionProposal | null>(null)
  const [applying, setApplying] = useState(false)
  // Live progress line while the controlled Microsoft sync runs.
  const [microsoftSyncNote, setMicrosoftSyncNote] = useState<string | null>(null)
  // Live stage progress while a Marketing AI specialist is running.
  const [marketingNote, setMarketingNote] = useState<string | null>(null)
  const [showJobs, setShowJobs] = useState(false)
  const [jobs, setJobs] = useState<BackgroundJob[]>([])

  // Post-meeting debrief flow: record/type → analyse → ONE editable confirmation
  // (meeting match, background, decisions, unresolved, tasks) → apply.
  const [dailyCaptureOpen, setDailyCaptureOpen] = useState(false)
  const [debriefOpen, setDebriefOpen] = useState(false)
  const [debriefText, setDebriefText] = useState('')
  const [debriefBusy, setDebriefBusy] = useState(false)
  const [debriefRecording, setDebriefRecording] = useState(false)
  const [debriefRecordingSeconds, setDebriefRecordingSeconds] = useState(0)
  const [debrief, setDebrief] = useState<MeetingDebriefAnalysis | null>(null)
  // Keep the full candidate list across re-analysis: re-matching after a manual
  // meeting pick returns only the chosen meeting, which would collapse the
  // select. Preserve the richer list so the reviewer can switch again.
  const [debriefCandidates, setDebriefCandidates] = useState<MeetingDebriefAnalysis['candidates']>([])
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const debriefRecordingStartedAtRef = useRef(0)
  const debriefAutoStoppedRef = useRef(false)
  const navigate = useNavigate()
  const isManager = isManagerRole(profile?.role)

  const workContextRef = useRef<AssistantLocalWorkContext | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Synchronous mirror of the `listening` state so a rapid double-tap cannot
  // start a second recognition instance before React re-renders.
  const listeningRef = useRef(false)
  const attachRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const clientsRef = useRef<ActiveClientOption[]>([])
  const staffRef = useRef<string[]>([])
  const taskRef = useRef<CommandCentreTask[]>([])
  const managementRef = useRef<string | null>(null)
  const memoryRef = useRef<string[]>([])
  // Live Microsoft 365 state, so conversational answers are grounded in the real
  // integration instead of a model guess. Admin-only (the status endpoint is
  // admin-gated), which matches who can actually run the sync.
  const microsoftStateRef = useRef<string | null>(null)
  // Manager-only ownership review state, so the management Assistant can say a
  // task needs review instead of naming an owner it cannot verify.
  const ownershipReviewRef = useRef<string | null>(null)
  const profileIdRef = useRef<string | null>(profile?.id ?? null)
  const actionRequestRef = useRef(0)
  const debriefRequestSeqRef = useRef(0)
  const debriefAnalysisRequestRef = useRef<DebriefRequestToken | null>(null)
  const debriefConfirmationRequestRef = useRef<DebriefRequestToken | null>(null)
  const viewportBottomInset = useVisualViewportBottomInset()
  const viewport = useVisualViewportRect()
  const isMobile = useIsMobileViewport()
  // Held in a ref so the reporting effect depends only on the fullscreen flag —
  // an inline callback from the parent would otherwise re-fire it every render.
  const onMobileFullscreenChangeRef = useRef(onMobileFullscreenChange)
  onMobileFullscreenChangeRef.current = onMobileFullscreenChange

  function invalidateDebriefRequests() {
    debriefRequestSeqRef.current += 1
    debriefAnalysisRequestRef.current = null
    debriefConfirmationRequestRef.current = null
  }

  function beginDebriefRequest(kind: 'analysis' | 'confirmation'): DebriefRequestToken | null {
    const requestedProfileId = profileIdRef.current
    if (!requestedProfileId) return null
    const token = { id: ++debriefRequestSeqRef.current, profileId: requestedProfileId }
    if (kind === 'analysis') {
      debriefAnalysisRequestRef.current = token
      debriefConfirmationRequestRef.current = null
    } else {
      debriefConfirmationRequestRef.current = token
      debriefAnalysisRequestRef.current = null
    }
    return token
  }

  function debriefRequestIsCurrent(kind: 'analysis' | 'confirmation', token: DebriefRequestToken) {
    const current = kind === 'analysis' ? debriefAnalysisRequestRef.current : debriefConfirmationRequestRef.current
    return current === token && profileIdRef.current === token.profileId
  }

  function stopActiveDebriefMedia() {
    const recorder = mediaRecorderRef.current
    mediaRecorderRef.current = null
    if (!recorder) return
    if (recorder.state !== 'inactive') recorder.stop()
    recorder.stream.getTracks().forEach(track => track.stop())
  }

  const profileId = profile?.id ?? null
  if (profileIdRef.current !== profileId) {
    invalidateDebriefRequests()
    stopActiveDebriefMedia()
    profileIdRef.current = profileId
    workContextRef.current = null
    clientsRef.current = []
    staffRef.current = []
    taskRef.current = []
    managementRef.current = null
    ownershipReviewRef.current = null
    memoryRef.current = []
    recognitionRef.current = null
    listeningRef.current = false
    audioChunksRef.current = []
    actionRequestRef.current += 1
    setMessages(loadSession(profileId))
    setProposal(null)
    setDebrief(null)
    setDebriefCandidates([])
    setDebriefOpen(false)
    setDailyCaptureOpen(false)
    setDebriefText('')
    setInput('')
    setSending(false)
    setApplying(false)
    setDebriefBusy(false)
    setDebriefRecording(false)
    setDebriefRecordingSeconds(0)
    setJobs([])
    setShowJobs(false)
    setListening(false)
    setChatError(null)
    setProposalError(null)
    setDebriefError(null)
  }

  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), [])

  useEffect(() => () => {
    invalidateDebriefRequests()
    stopActiveDebriefMedia()
  }, [])

  useEffect(() => {
    if (!debriefRecording) return
    const timer = window.setInterval(() => {
      setDebriefRecordingSeconds(Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - debriefRecordingStartedAtRef.current) / 1000)))
    }, 250)
    const autoStop = window.setTimeout(() => {
      debriefAutoStoppedRef.current = true
      stopDebriefRecording()
      setDebriefError('Recording stopped automatically at the 5-minute limit.')
    }, Math.max(0, MAX_VOICE_SECONDS * 1000 - (Date.now() - debriefRecordingStartedAtRef.current)))
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(autoStop)
    }
  }, [debriefRecording])

  // Load the authorised client + staff lists once, for name resolution. These
  // come through RLS, so a user only ever sees clients/staff they may see.
  useEffect(() => {
    let active = true
    const requestedProfileId = profileId
    fetchActiveClients().then(list => { if (active && profileIdRef.current === requestedProfileId) clientsRef.current = list }).catch(() => {})
    listStaffProfiles().then(res => {
      if (active && profileIdRef.current === requestedProfileId && !res.migrationNeeded) staffRef.current = res.data.map(s => s.full_name).filter((n): n is string => Boolean(n))
    }).catch(() => {})
    listTasks({ activeOnly: true }).then(res => {
      if (active && profileIdRef.current === requestedProfileId && !res.error) {
        taskRef.current = (res.data ?? []).filter(task => task.data_origin === 'planner_tasks' && Boolean(task.native_id))
      }
    }).catch(() => {})
    // Management grounding: only authorised admin/manager get a cross-team
    // workload summary the master assistant can reason over. RLS on the RPC also
    // enforces this server-side — normal staff never receive it.
    if (isManager) {
      listPlannerWorkloadSummary().then(res => {
        if (!active || profileIdRef.current !== requestedProfileId || res.error || !res.data) return
        const rows = res.data
        const overdue = rows.reduce((sum, r) => sum + (r.overdue_count ?? 0), 0)
        const blocked = rows.reduce((sum, r) => sum + (r.blocked_count ?? 0), 0)
        const unassigned = rows[0]?.unassigned_total ?? 0
        const busiest = [...rows].sort((a, b) => (b.active_task_count ?? 0) - (a.active_task_count ?? 0))[0]
        managementRef.current = `cross-team: ${overdue} overdue, ${blocked} blocked, ${unassigned} unassigned` +
          (busiest ? `, busiest ${busiest.full_name} (${busiest.active_task_count} active)` : '')
      }).catch(() => {})

      // Ownership review state, manager-gated server-side. Without this the
      // management Assistant cannot tell verified work from work whose owner is
      // unknown, and would answer "whose is this?" from whatever it was given.
      void loadOwnershipReviewSummary().then(summary => {
        if (!active || profileIdRef.current !== requestedProfileId || !summary) return
        ownershipReviewRef.current =
          `ownership review (manager-only): ${summary.conflicts} assignment conflict, ` +
          `${summary.needsAssignmentReview} needing assignment review, ${summary.unassigned} unassigned. ` +
          'These have NO verified owner — never say such a task belongs to a specific person; say it needs assignment review.'
      })
    }
    // Live Microsoft 365 state for grounded answers. The status endpoint is
    // admin-gated server-side, so only admins fetch it — matching who may run
    // the sync. Failures stay silent; an absent line is better than a guess.
    if (profile?.role === 'admin') {
      checkMicrosoftSyncAvailability().then(state => {
        if (!active || profileIdRef.current !== requestedProfileId || state.error) return
        microsoftStateRef.current = state.connected
          ? `microsoft365: CONNECTED (${state.sourceCount} Planner/Outlook source${state.sourceCount === 1 ? '' : 's'}); an admin can run the controlled reconciliation sync from CG Assistant`
          : `microsoft365: unavailable for sync (${state.message})`
      }).catch(() => {})
    }
    return () => { active = false }
  }, [isManager, profileId, profile?.role])

  // Durable per-user memory (own-only via RLS). Loaded once so the personal
  // assistant is grounded in what this user has asked it to remember. Strictly
  // isolated — no other user's or client's memory is ever visible.
  useEffect(() => {
    let active = true
    const requestedProfileId = profileId
    listMyAssistantMemory(12)
      .then(res => {
        if (active && profileIdRef.current === requestedProfileId && !res.error && res.data) {
          memoryRef.current = res.data.map(m => m.content).filter(Boolean)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [profileId])

  // Load the signed-in user's live work context once (best-effort; the assistant
  // still works without it).
  useEffect(() => {
    let active = true
    const requestedProfileId = profileId
    getMyDayContext(profile ?? null)
      .then(async ctx => {
        const [captureResult, itemResult] = await Promise.all([listMyAssistantDayCaptures(), listMyAssistantDayItems()])
        if (active && profileIdRef.current === requestedProfileId) {
          const work = buildAssistantLocalWorkContext(ctx)
          if (work) work.personalDaySummary = dailyAssistantContextLine(captureResult.data ?? [], itemResult.data ?? [])
          workContextRef.current = work
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [profile, profileId])

  useEffect(() => {
    if (!profileId) return
    try {
      window.sessionStorage.setItem(sessionKey(profileId), JSON.stringify(messages.slice(-40)))
    } catch {
      /* ignore quota */
    }
  }, [messages, profileId])

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
  }, [open, showJobs])

  const pageLabel = pageLabelFromPath(location.pathname)
  // The full Assistant page has its own composer — don't stack a second one.
  const onAssistantPage = location.pathname.startsWith('/admin/assistant')
  const clientId = searchParams.get('client') ?? searchParams.get('clientId') ?? ''
  const recordId = searchParams.get('reportId') ?? searchParams.get('id') ?? ''
  const onPlannerBoard = (location.pathname === '/admin/work' || location.pathname === '/admin/my-work') && searchParams.get('tab') === 'board'
  const plannerTaskId = onPlannerBoard ? (searchParams.get('id') ?? '') : ''
  const plannerTaskName = plannerTaskId ? (searchParams.get('task') ?? '') : ''
  const selectedRunId = location.pathname.includes('/admin/content') ? (searchParams.get('runId') ?? '') : ''

  // Mobile initial state: a single short context line (client name when one is
  // selected, otherwise the page label), so the header never dumps page content.
  const mobileContextLabel = clientId
    ? (clientsRef.current.find(c => c.id === clientId)?.name ?? pageLabel)
    : pageLabel
  // The compact suggestion area only exists while idle: typing, a chat in
  // flight, voice recording/transcribing, or a proposal being reviewed/applied
  // all hide it, and a clean idle state restores the two primary actions.
  const mobileSuggestionAreaHidden =
    input.trim() !== '' ||
    sending ||
    listening ||
    dailyCaptureOpen ||
    debriefOpen ||
    debriefRecording ||
    debriefBusy ||
    Boolean(debrief) ||
    Boolean(proposal) ||
    applying

  function currentContextLine(): string {
    const parts = [`page: ${pageLabel}`, `role: ${profile?.role ?? 'team'}`]
    if (clientId) parts.push(`clientId: ${clientId}`)
    if (recordId) parts.push(`recordId: ${recordId}`)
    if (plannerTaskId) parts.push(`plannerTaskId: ${plannerTaskId}`)
    if (selectedRunId) parts.push(`contentRunId: ${selectedRunId}`)
    // Management grounding is only ever added for authorised admin/manager.
    if (isManager && managementRef.current) parts.push(managementRef.current)
    // Manager-only. Ordinary staff never receive conflict evidence about others.
    if (isManager && ownershipReviewRef.current) parts.push(ownershipReviewRef.current)
    // Durable per-user memory (own-only) grounds the personal assistant.
    if (memoryRef.current.length > 0) parts.push(`remembered: ${memoryRef.current.slice(0, 6).join('; ')}`)
    // Real Microsoft 365 integration state (never a guess).
    if (microsoftStateRef.current) parts.push(microsoftStateRef.current)
    return parts.join(', ')
  }

  // Mobile composer controls: exactly one primary right-hand control. A sending
  // state keeps the send button in place (no width shift), an active dictation
  // always keeps the stop control visible, otherwise the mic shows while empty
  // and send takes over as soon as there is text.
  const mobileMicPrimary = speechSupported && !sending && (listening || input.trim() === '')
  const mobileSendPrimary = sending || (!listening && input.trim() !== '')

  // ── Mobile full-screen shell ──────────────────────────────────────────────
  // Opening the assistant on a phone takes over the whole screen rather than
  // floating another layer on top of the app. Everything below drives that.
  const mobileFullscreen = isMobile && open && !onAssistantPage
  // Freeze and restore the page behind. The hook captures the scroll offset on
  // lock and scrolls back to it on release, so closing returns the user to
  // exactly where they were.
  useBodyScrollLock(mobileFullscreen)

  useEffect(() => {
    onMobileFullscreenChangeRef.current?.(mobileFullscreen)
  }, [mobileFullscreen])

  // Tell the shell the assistant is gone if this component ever unmounts while
  // still open, so the bottom navigation can never be left hidden.
  useEffect(() => () => { onMobileFullscreenChangeRef.current?.(false) }, [])

  // Hardware/browser back closes the sheet instead of leaving the page, which is
  // what a full-screen surface is expected to do on a phone.
  useEffect(() => {
    if (!mobileFullscreen) return
    window.history.pushState({ cgAssistant: true }, '')
    const onPop = () => setOpen(false)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // Only unwind our own entry — if the pop is what closed the sheet the
      // entry is already gone and going back again would leave the page.
      if (window.history.state?.cgAssistant) window.history.back()
    }
  }, [mobileFullscreen])

  // Escape closes it too (external keyboards, and desktop-sized browser windows
  // dragged narrow during testing).
  useEffect(() => {
    if (!mobileFullscreen) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileFullscreen])

  // Keep the newest message in view as the keyboard opens and the sheet shrinks.
  useEffect(() => {
    if (!mobileFullscreen || !viewport.keyboardOpen) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mobileFullscreen, viewport.keyboardOpen, viewport.height])

  async function loadJobs(actionIsCurrent?: () => boolean) {
    const requestedProfileId = profileIdRef.current
    if (!requestedProfileId || (actionIsCurrent && !actionIsCurrent())) return
    const res = await listMyBackgroundJobs(10)
    if (profileIdRef.current !== requestedProfileId || (actionIsCurrent && !actionIsCurrent())) return
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
    const applyingProfileId = profileIdRef.current
    if (!applyingProfileId) return
    const applyingProfileName = profile?.id === applyingProfileId ? profile.full_name : null
    const actionRequestId = ++actionRequestRef.current
    const actionIsCurrent = () => Boolean(applyingProfileId) && profileIdRef.current === applyingProfileId && actionRequestRef.current === actionRequestId
    if (!actionIsCurrent()) return
    setApplying(true)
    setProposalError(null)
    try {
      if (p.type === 'job.enqueue') {
        const jobType = String(p.fields.job)
        const syncPreviousMonth = p.fields.sync_previous_month === 'yes'
        const today = new Date().toISOString().slice(0, 10)
        const res = await enqueueBackgroundJob({
          jobType,
          payload: jobType === 'meta_sync' ? { baseline: syncPreviousMonth } : {},
          // Idempotent per user, type, day and requested month range.
          // does not duplicate work — scoped to the user so one staff member's
          // job is never silently hidden by another's idempotency key.
          idempotencyKey: `${applyingProfileId}:${jobType}-${today}${syncPreviousMonth ? '-previous-month' : ''}`,
        })
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        await nudgeBackgroundWorker()
        if (!actionIsCurrent()) return
        setProposal(null)
        setShowJobs(true)
        void loadJobs(actionIsCurrent)
        pushAssistant(`Queued ${jobType === 'meta_sync' ? 'Meta sync' : 'report preparation'} as a background job. It runs on the server and continues even if you close the app — I'll notify you when it finishes. Progress is under "Background jobs".`)
        return
      }
      if (p.type === 'marketing.start' || p.type === 'marketing.continue') {
        // Marketing AI department. The controlled workflow, its evidence gate,
        // citation rules, metering and approval gates are untouched - this only
        // starts or advances it and reports the result honestly.
        if (!p.clientId) { setProposalError('I need an exact active client before starting marketing work.'); return }
        const specialistField = String(p.fields.specialist ?? 'auto')
        const specialist = specialistField !== 'auto' ? specialistField as MarketingSpecialist : undefined

        // Continue the existing open artifact rather than duplicating records.
        let artifactId: string | undefined
        if (p.type === 'marketing.continue') {
          const openArtifact = await findOpenArtifact(p.clientId)
          if (!actionIsCurrent()) return
          if (!openArtifact) {
            setProposalError(`${p.clientName} has no open marketing artifact to continue. Start a new one instead.`)
            return
          }
          artifactId = openArtifact.id
        }

        setProposal(null)
        setMarketingNote(artifactId ? 'Handing off to the next specialist...' : 'Starting the Marketing AI workflow...')
        const result = await runMarketingSpecialist({
          clientId: p.clientId,
          request: p.type === 'marketing.start' ? String(p.fields.request ?? '') : undefined,
          artifactId,
          specialist,
        })
        if (!actionIsCurrent()) return
        setMarketingNote(null)

        if (!result.ok) { pushAssistant(result.error ?? 'The specialist could not be run.'); return }
        if (result.insufficientEvidence) {
          // Honest insufficient-evidence / provider-exhaustion result.
          pushAssistant(result.message ?? 'Not enough approved knowledge to produce a grounded draft.')
          return
        }
        const cited = result.evidenceUsed?.length ?? 0
        const next = result.nextSpecialist ? SPECIALIST_LABELS[result.nextSpecialist] : null
        pushAssistant(
          `${result.specialistName} produced version ${result.version?.version} for ${p.clientName}, ` +
          `citing ${cited} approved card${cited === 1 ? '' : 's'}. ` +
          (next
            ? `Next: ${next} - say "continue the marketing workflow".`
            : 'The chain is complete and it is ready for a manager to review.') +
          ' Open it in Marketing AI to read the full draft.',
        )
        return
      }
      if (p.type === 'marketing.list') {
        const res = await listAwaitingReview()
        if (!actionIsCurrent()) return
        setProposal(null)
        if (res.error) { pushAssistant(`Could not load marketing drafts: ${res.error.message}`); return }
        const rows = (res.data ?? []) as MarketingArtifact[]
        if (rows.length === 0) { pushAssistant('No marketing drafts are waiting for review right now.'); return }
        const lines = rows.slice(0, 8).map(a => {
          const name = clientsRef.current.find(c => c.id === a.client_id)?.name ?? 'Unknown client'
          return `- ${name}: ${a.artifact_type.replace(/_/g, ' ')} v${a.current_version} (${a.status.replace(/_/g, ' ')}), with ${SPECIALIST_LABELS[a.current_specialist] ?? a.current_specialist}`
        })
        pushAssistant(
          `${rows.length} marketing draft${rows.length === 1 ? '' : 's'} awaiting review:\n` +
          `${lines.join('\n')}\n\nOpen Marketing AI to review and decide.`,
        )
        return
      }
      if (p.type === 'marketing.decide') {
        const decision = String(p.fields.decision) as 'approved' | 'rejected' | 'changes_requested'
        // Approve/reject stay manager+admin only. The RPC enforces this as well;
        // refusing here means the Assistant never appears to act beyond the
        // signed-in user's role.
        if ((decision === 'approved' || decision === 'rejected') && !isManager) {
          setProposalError('Approving or rejecting a marketing draft is restricted to managers and admins. You can request changes instead.')
          return
        }
        if (!p.clientId) { setProposalError('Which client draft should I act on? Open the client or name it.'); return }
        const openArtifact = await findOpenArtifact(p.clientId)
        if (!actionIsCurrent()) return
        if (!openArtifact) { setProposalError(`${p.clientName} has no open marketing draft to decide on.`); return }
        const version = await getCurrentVersion(openArtifact)
        if (!actionIsCurrent()) return
        if (!version) { setProposalError('Could not read the current version of that draft.'); return }
        const res = await recordMarketingDecision({
          artifactId: openArtifact.id,
          versionId: version.id,
          decision,
          note: p.fields.note ? String(p.fields.note) : undefined,
        })
        if (!actionIsCurrent()) return
        if (res.error) { setProposalError(res.error.message); return }
        setProposal(null)
        const label = openArtifact.artifact_type.replace(/_/g, ' ')
        pushAssistant(
          decision === 'approved'
            ? `Approved v${version.version} of the ${label} for ${p.clientName}. Nothing was published or changed on the client record - this records a human sign-off only.`
            : decision === 'rejected'
              ? `Rejected v${version.version} for ${p.clientName}. The version history is kept.`
              : `Requested changes on v${version.version} for ${p.clientName}. Say "continue the marketing workflow" to regenerate.`,
        )
        return
      }
      if (p.type === 'microsoft.sync') {
        // Controlled Microsoft 365 sync. Admin-only server-side; we surface that
        // truthfully here instead of letting the model claim "not connected".
        if (profile?.role !== 'admin') {
          setProposalError('Microsoft sync is restricted to admins. Ask an admin to run it from CG Assistant or the Microsoft Import page.')
          return
        }
        const rangeStart = String(p.fields.range_start)
        const rangeEnd = String(p.fields.range_end)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rangeStart) || !/^\d{4}-\d{2}-\d{2}$/.test(rangeEnd) || rangeEnd <= rangeStart) {
          setProposalError('Give me a valid date range (start before end) for the Microsoft sync.')
          return
        }
        setProposal(null)
        setMicrosoftSyncNote('Checking the live Microsoft connection…')
        const outcome = await runMicrosoftSync(rangeStart, rangeEnd, {
          onProgress: (_progress, note) => { if (actionIsCurrent()) setMicrosoftSyncNote(note) },
        })
        if (!actionIsCurrent()) return
        setMicrosoftSyncNote(null)
        pushAssistant(outcome.message)
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
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        if (res.tableMissing) throw new Error('CG Calendar is not enabled in this database yet.')
        if (res.data) {
          await logPlannerActivity({
            entity_type: 'company_calendar_event', entity_id: res.data.id, action: 'assistant_created',
            actor_user_id: applyingProfileId, actor_name: applyingProfileName,
            metadata: { via: 'cg_assistant', title: res.data.title, start_at: startAt },
          })
          if (!actionIsCurrent()) return
        }
        setProposal(null)
        pushAssistant(`Done — created "${p.fields.title}" on ${date}${time ? ` at ${time}` : ''} in CG Calendar.`)
      } else if (p.type === 'schedule.propose') {
        if (!recordId) { setProposalError('Open the Client Schedule post first so I know which item to change.'); return }
        const res = await proposeScheduleChange({
          deliverableId: recordId,
          change: { scheduled_date: String(p.fields.new_date) },
          reason: p.fields.note ? String(p.fields.note) : null,
          requestedBy: applyingProfileId,
          requestedByName: applyingProfileName,
        })
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        setProposal(null)
        pushAssistant('Submitted. This Client Schedule change stays pending until a manager or admin approves it.')
      } else if (p.type === 'memory.add') {
        // Durable per-user memory. RLS constrains the row to this user only.
        const note = String(p.fields.note ?? '').trim()
        if (!note) { setProposalError('Nothing to remember.'); return }
        const res = await addAssistantMemory(applyingProfileId, note)
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        memoryRef.current = [note, ...memoryRef.current].slice(0, 12)
        setProposal(null)
        pushAssistant(`Got it — I'll remember that: "${note}".`)
      } else if (p.type === 'task.create') {
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
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        const assignee = p.fields.assignee ? String(p.fields.assignee) : ''
        const due = p.fields.due_date ? ` (due ${p.fields.due_date})` : ''
        // Only claim a notification when the assignee name matches a real staff
        // profile — the server notifies only on a resolved profile.
        const assigneeResolved = assignee ? staffRef.current.some(name => name.toLowerCase() === assignee.toLowerCase()) : false
        const notified = assignee && assigneeResolved ? ' and they have been notified' : assignee ? ' — check the assignee name, it did not match a staff profile' : ''
        setProposal(null)
        pushAssistant(`Done — created the task${assignee ? ` for ${assignee}` : ''}${due}. It's on the board${notified}.`)
      } else if (p.type === 'task.assign') {
        if (p.target?.type !== 'planner_task') {
          setProposalError('Open the Planner task first so I know exactly which existing task to assign.')
          return
        }
        const assignee = p.fields.assignee ? String(p.fields.assignee) : null
        if (!assignee) { setProposalError('Choose an assignee.'); return }
        const res = await updateAssistantTask({ taskId: p.target.id, action: 'assign', assigneeName: assignee })
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        const dueDate = p.fields.due_date ? String(p.fields.due_date) : null
        setProposal(null)
        pushAssistant(`Done — assigned "${p.target.label}" to ${assignee}.${dueDate ? ' The due date was not changed; update it separately on the task so assignment cannot partially succeed.' : ''}`)
      } else if (p.type === 'task.update') {
        // Complete / block an existing task. Needs the task in context (opened
        // from a task record); otherwise ask rather than guess which task.
        if (p.target?.type !== 'planner_task') {
          setProposalError('Open the Planner task first so I know exactly which task to update.')
          return
        }
        const action = p.fields.status === 'done' ? 'complete' : 'block'
        const res = await updateAssistantTask({ taskId: p.target.id, action })
        if (!actionIsCurrent()) return
        if (res.error) throw new Error(res.error.message)
        setProposal(null)
        pushAssistant(action === 'complete' ? 'Done — task marked complete.' : 'Done — task flagged as blocked.')
      } else if (p.type === 'video.mark_shot' || p.type === 'video.move') {
        if (p.target?.type !== 'content_run') {
          setProposalError('Open a Content Run first so I know exactly which run to update.')
          return
        }
        const runId = p.target.id
        const runName = p.target.label
        if (p.type === 'video.mark_shot') {
          const numbers = String(p.fields.videos ?? '')
            .split(/[\s,]+/)
            .map(Number)
            .filter(n => Number.isInteger(n) && n > 0)
          if (numbers.length === 0) { setProposalError('Which video number should I mark as shot?'); return }
          for (const n of numbers) {
            if (!actionIsCurrent()) return
            const res = await assistantUpdateVideo({ runId, videoNumber: n, action: 'shot' })
            if (!actionIsCurrent()) return
            if (res.error) throw new Error(`Video ${n}: ${res.error.message}`)
          }
          setProposal(null)
          pushAssistant(`Done — marked video${numbers.length > 1 ? 's' : ''} ${numbers.join(', ')} as shot${runName ? ` on "${runName}"` : ''}.`)
        } else {
          const n = Number(p.fields.video)
          if (!Number.isInteger(n) || n <= 0) { setProposalError('Which video number should I move?'); return }
          const month = String(p.fields.scheduled_date ?? '')
          if (!actionIsCurrent()) return
          const res = await assistantUpdateVideo({
            runId,
            videoNumber: n,
            action: /^\d{4}-\d{2}-\d{2}$/.test(month) ? 'move_to_month' : 'move_next_month',
            scheduledMonth: /^\d{4}-\d{2}-\d{2}$/.test(month) ? month : null,
          })
          if (!actionIsCurrent()) return
          if (res.error) throw new Error(res.error.message)
          const moved = res.data as { month?: string | null } | null
          setProposal(null)
          pushAssistant(`Done — moved video ${n} to ${moved?.month ? moved.month.slice(0, 7) : 'next month'}${runName ? ` on "${runName}"` : ''}. The Client Schedule link needs confirmation before it appears on the schedule.`)
        }
      } else {
        // calendar.cancel still needs the on-record calendar entry to act on.
        if (!actionIsCurrent()) return
        setProposal(null)
        pushAssistant('Opening CG Calendar so you can finish this on the record.')
        navigate('/admin/cg-calendar')
      }
    } catch (err) {
      if (actionIsCurrent()) setProposalError(err instanceof Error ? err.message : 'Could not complete that action.')
    } finally {
      if (actionIsCurrent()) setApplying(false)
    }
  }

  // ── Meeting debrief flow ────────────────────────────────────────────────
  async function startDebriefRecording() {
    const requestToken = beginDebriefRequest('analysis')
    if (!requestToken || !debriefRequestIsCurrent('analysis', requestToken)) return
    setMoreOpen(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!debriefRequestIsCurrent('analysis', requestToken)) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []
      debriefAutoStoppedRef.current = false
      debriefRecordingStartedAtRef.current = Date.now()
      setDebriefRecordingSeconds(0)
      recorder.ondataavailable = event => {
        if (event.data.size > 0 && debriefRequestIsCurrent('analysis', requestToken)) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const durationSeconds = Math.min(MAX_VOICE_SECONDS, (Date.now() - debriefRecordingStartedAtRef.current) / 1000)
        if (blob.size > 0 && debriefRequestIsCurrent('analysis', requestToken)) {
          void analyseDebrief({ audio: blob, durationSeconds, limitReached: debriefAutoStoppedRef.current })
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      if (!debriefRequestIsCurrent('analysis', requestToken)) {
        stopActiveDebriefMedia()
        return
      }
      setDebriefRecording(true)
    } catch {
      if (debriefRequestIsCurrent('analysis', requestToken)) setDebriefError('Microphone access was blocked. Type the debrief instead.')
    }
  }

  function stopDebriefRecording() {
    mediaRecorderRef.current?.stop()
    setDebriefRecording(false)
  }

  async function analyseDebrief(input: { audio?: Blob; durationSeconds?: number; eventId?: string; limitReached?: boolean }) {
    const requestToken = beginDebriefRequest('analysis')
    if (!requestToken || !debriefRequestIsCurrent('analysis', requestToken)) return
    setDebriefBusy(true)
    if (!input.limitReached) setDebriefError(null)
    try {
      const opts = { eventId: input.eventId, clientId: clientId || undefined }
      const transcript = input.eventId && debrief ? debrief.transcript : debriefText
      const res = input.audio
        ? await analyseMeetingAudio(requestToken.profileId, input.audio, input.durationSeconds ?? 0, opts)
        : await analyseMeetingText(requestToken.profileId, transcript, opts)
      if (!debriefRequestIsCurrent('analysis', requestToken)) return
      if (res.error || !res.data) { setDebriefError(res.error ?? 'The debrief could not be analysed.'); return }
      // Keep the widest candidate set seen so a manual meeting pick never
      // collapses the select to a single option.
      if (res.data.candidates.length > 0 && !input.eventId) setDebriefCandidates(res.data.candidates)
      setDebrief(res.data)
    } catch {
      if (debriefRequestIsCurrent('analysis', requestToken)) setDebriefError('The debrief could not be analysed.')
    } finally {
      if (debriefRequestIsCurrent('analysis', requestToken)) {
        debriefAnalysisRequestRef.current = null
        setDebriefBusy(false)
      }
    }
  }

  async function confirmDebrief() {
    if (!debrief || debriefBusy) return
    const draft = debrief
    const requestToken = beginDebriefRequest('confirmation')
    if (!requestToken || !debriefRequestIsCurrent('confirmation', requestToken)) return
    setDebriefBusy(true)
    setDebriefError(null)
    try {
      const res = await applyMeetingDebrief({
        debriefId: draft.debriefId,
        summary: draft.summary,
        decisions: draft.decisions,
        unresolved: draft.unresolved,
        tasks: draft.tasks
          .filter(t => t.title.trim())
          .map(t => ({ title: t.title, assignee_name: t.assignee_name, client_id: t.client_id, client_name: t.client_name, due_date: t.due_date })),
      })
      if (!debriefRequestIsCurrent('confirmation', requestToken)) return
      if (res.error || !res.data) { setDebriefError(res.error ?? 'The debrief could not be applied.'); return }
      const namedAssignees = draft.tasks.filter(t => t.title.trim() && t.assignee_name?.trim())
      const allAssigneesResolved = namedAssignees.every(t => t.resolved_assignee)
      const notificationNote = namedAssignees.length > 0
        ? allAssigneesResolved ? ' (assignees notified)' : ' — some assignee names could not be matched'
        : ''
      setDebrief(null)
      setDebriefCandidates([])
      setDebriefOpen(false)
      setDebriefText('')
      setOpen(true)
      pushAssistant(
        `Debrief saved${res.data.notes_saved ? ' — notes are on the meeting' : ''}` +
        `${res.data.tasks_created > 0 ? ` and ${res.data.tasks_created} task${res.data.tasks_created > 1 ? 's were' : ' was'} created on the board${notificationNote}` : ''}.`,
      )
    } catch {
      if (debriefRequestIsCurrent('confirmation', requestToken)) setDebriefError('The debrief could not be applied.')
    } finally {
      if (debriefRequestIsCurrent('confirmation', requestToken)) {
        debriefConfirmationRequestRef.current = null
        setDebriefBusy(false)
      }
    }
  }

  function closeDebrief() {
    invalidateDebriefRequests()
    stopActiveDebriefMedia()
    setDebriefOpen(false)
    setDebrief(null)
    setDebriefText('')
    setDebriefCandidates([])
    setDebriefError(null)
    setDebriefBusy(false)
    setDebriefRecording(false)
    setDebriefRecordingSeconds(0)
  }

  function startDailyCapture() {
    invalidateDebriefRequests()
    stopActiveDebriefMedia()
    setDebriefOpen(false)
    setDebrief(null)
    setDailyCaptureOpen(true)
    setMoreOpen(false)
    setPlusOpen(false)
    setOpen(true)
  }
  function startNewDebrief() {
    invalidateDebriefRequests()
    stopActiveDebriefMedia()
    audioChunksRef.current = []
    setDebrief(null)
    setDebriefText('')
    setDebriefCandidates([])
    setDebriefError(null)
    setDebriefBusy(false)
    setDebriefRecording(false)
    setDebriefRecordingSeconds(0)
    setDebriefOpen(true)
    setMoreOpen(false)
    setPlusOpen(false)
  }

  function restartDebriefDraft() {
    invalidateDebriefRequests()
    setDebrief(null)
    setDebriefCandidates([])
    setDebriefError(null)
    setDebriefBusy(false)
  }

  async function send(text: string) {
    const clean = text.trim()
    const sendingProfileId = profileIdRef.current
    if (!clean || sending || applying || !sendingProfileId) return
    // Collapse the mobile "More" list: any send takes the assistant out of the
    // clean idle state that shows the two primary actions.
    setMoreOpen(false)

    // Action agent first: understand the instruction as a concrete app action.
    // A proposal is shown as a confirm/edit/cancel preview; ambiguity asks; a
    // plain question falls through to chat.
    const parsed = parseAssistantAction(clean, {
      today: new Date().toISOString().slice(0, 10),
      clients: clientsRef.current,
      staffNames: staffRef.current,
      tasks: taskRef.current.flatMap(task => task.native_id ? [{
        id: task.native_id,
        title: task.title,
        clientId: task.client_id,
        clientName: task.client_name,
        dueDate: task.due_date || null,
      }] : []),
      role: profile?.role ?? 'team',
      currentClientId: clientId || null,
      currentClientName: clientsRef.current.find(c => c.id === clientId)?.name ?? null,
      currentTaskId: plannerTaskId || null,
      currentTaskName: plannerTaskName || null,
    })
    if (parsed && 'type' in parsed) {
      let nextProposal = parsed
      if (parsed.type === 'schedule.propose' && (!location.pathname.startsWith('/admin/client-schedule') || !recordId)) {
        setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
        setInput('')
        setChatError(null)
        setOpen(true)
        pushAssistant('Open the Client Schedule post first so I know exactly which item to change.')
        return
      }
      if (parsed.type === 'video.mark_shot' || parsed.type === 'video.move') {
        setSending(true)
        setChatError(null)
        try {
          if (!selectedRunId) {
            setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
            setInput('')
            setOpen(true)
            pushAssistant('Open the Content Run first so I know exactly which run to update.')
            return
          }
          const run = await resolveContentRun(selectedRunId)
          if (profileIdRef.current !== sendingProfileId) return
          if (!run) {
            setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
            setInput('')
            setOpen(true)
            pushAssistant('That selected Content Run is no longer available. Open the run again before making a change.')
            return
          }
          nextProposal = { ...parsed, target: { type: 'content_run', id: run.id, label: run.name } }
        } catch {
          if (profileIdRef.current === sendingProfileId) setChatError('I could not verify the selected Content Run. Try again.')
          return
        } finally {
          if (profileIdRef.current === sendingProfileId) setSending(false)
        }
      }
      if (profileIdRef.current !== sendingProfileId) return
      setInput('')
      setChatError(null)
      setProposalError(null)
      setProposal(nextProposal)
      setOpen(true)
      return
    }
    if (parsed && 'clarify' in parsed) {
      setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
      setInput('')
      setChatError(null)
      setOpen(true)
      pushAssistant(parsed.clarify)
      return
    }

    const history: AssistantChatMessage[] = messages.map(m => ({ role: m.role, content: m.text }))
    setMessages(current => [...current, { id: nextId(), role: 'user', text: clean }])
    setInput('')
    setChatError(null)
    setLastUserMessage(clean)
    setSending(true)
    setOpen(true)

    // The assistant receives the current page/client/record as context; the user
    // only ever sees their own typed message.
    const contextual = `[Context — ${currentContextLine()}]\n${clean}`
    const workContext = workContextRef.current
    try {
      const response = await sendAssistantMessage(contextual, history, workContext, null)
      if (profileIdRef.current !== sendingProfileId) return
      if (!response.ok) {
        const friendly = friendlyAssistantError(response.error)
        setChatError(friendly.message)
        setChatErrorRetryable(friendly.retryable)
      }
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
    } catch (err) {
      if (profileIdRef.current === sendingProfileId) {
        const friendly = friendlyAssistantError(err instanceof Error ? err.message : null)
        setChatError(friendly.message)
        setChatErrorRetryable(friendly.retryable)
      }
    } finally {
      if (profileIdRef.current === sendingProfileId) setSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void send(input)
  }

  function startListening() {
    if (listeningRef.current) return
    // One recognition at a time: ignore re-entrant taps while recording so a
    // second instance can never start underneath an active one.
    const recognition = getSpeechRecognition()
    if (!recognition) return
    setMoreOpen(false)
    const listeningProfileId = profileIdRef.current
    recognition.lang = micLang
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = event => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript
      }
      if (profileIdRef.current === listeningProfileId) setInput(transcript)
    }
    recognition.onerror = () => {
      listeningRef.current = false
      if (profileIdRef.current === listeningProfileId) setListening(false)
    }
    recognition.onend = () => {
      listeningRef.current = false
      if (profileIdRef.current === listeningProfileId) setListening(false)
    }
    recognitionRef.current = recognition
    listeningRef.current = true
    setOpen(true)
    setListening(true)
    try {
      recognition.start()
    } catch {
      listeningRef.current = false
      setListening(false)
    }
  }

  function stopListening() {
    listeningRef.current = false
    recognitionRef.current?.stop()
    setListening(false)
  }

  function toggleMic() {
    if (listeningRef.current) stopListening()
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

  // Re-send the last message after a recoverable failure. The failed exchange is
  // dropped first so the retry does not stack a duplicate question in the thread.
  function retryLastMessage() {
    if (!lastUserMessage || sending) return
    setChatError(null)
    setChatErrorRetryable(false)
    setMessages(current => {
      const trimmed = [...current]
      if (trimmed.at(-1)?.role === 'assistant') trimmed.pop()
      if (trimmed.at(-1)?.role === 'user') trimmed.pop()
      return trimmed
    })
    void send(lastUserMessage)
  }

  function newChat() {
    setMessages([])
    setChatError(null)
    setChatErrorRetryable(false)
    setLastUserMessage('')
    setProposalError(null)
    setDebriefError(null)
    setMoreOpen(false)
    setPlusOpen(false)
    try {
      if (profileId) window.sessionStorage.removeItem(sessionKey(profileId))
    } catch {
      /* ignore */
    }
  }

  const STARTERS = [
    'What should I focus on today?',
    `Summarise this ${pageLabel} page for me`,
    'Draft a client update',
  ]
  // The existing suggestion chips, shared by desktop (idle surface) and mobile
  // (behind "More") so their actions are defined exactly once.
  const starterChips = (
    <div className="flex flex-wrap gap-1.5">
      {STARTERS.map(s => (
        <button key={s} type="button" onClick={() => void send(s)} className="min-h-11 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-brand-primary/80 hover:border-brand-teal/40 hover:text-white">
          {s}
        </button>
      ))}
    </div>
  )

  if (onAssistantPage) return null

  // ── Shell geometry ────────────────────────────────────────────────────────
  // Full-screen (mobile, open): sized to the VISUAL viewport rather than any vh
  // unit, and offset by the viewport's own scroll. iOS shrinks only the visual
  // viewport when the keyboard opens, so this is what makes the sheet end
  // exactly at the top of the keyboard with the composer still on screen —
  // instead of 100dvh running underneath it. `translateY(offsetTop)` keeps the
  // sheet pinned when iOS scrolls the page to reveal a focused field.
  //
  // Docked (desktop, or mobile while collapsed): unchanged behaviour.
  const shellStyle: CSSProperties = mobileFullscreen
    ? { height: `${viewport.height}px`, transform: `translateY(${viewport.offsetTop}px)` }
    : ({ '--assistant-viewport-inset': `${viewportBottomInset}px` } as CSSProperties)

  const shellClass = mobileFullscreen
    ? 'fixed inset-x-0 top-0 z-[60] flex flex-col bg-[#080b0a]'
    : 'pointer-events-none fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom)+var(--assistant-viewport-inset))] z-40 pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:inset-x-auto md:right-5 md:bottom-[calc(1.25rem+var(--assistant-viewport-inset))] md:px-0'

  const innerClass = mobileFullscreen
    ? 'flex min-h-0 w-full flex-1 flex-col px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))]'
    : 'pointer-events-auto mx-auto w-full max-w-2xl md:mx-0 md:w-[26rem]'

  // When a capture / debrief / proposal surface is open it IS the task, so in
  // full-screen it takes the flexible space and the chat log collapses instead.
  // Otherwise a tall panel overflows the shrunken sheet once the keyboard opens.
  const overlayOpen = dailyCaptureOpen || debriefOpen || Boolean(proposal)

  // Full-screen: the panel is the page, so it loses its floating card treatment
  // and becomes part of the flex column.
  const panelClass = mobileFullscreen
    ? `flex min-h-0 flex-col overflow-hidden ${overlayOpen ? 'shrink' : 'flex-1'}`
    : 'mb-2 overflow-hidden rounded-2xl border border-white/12 bg-[#0c0f0e]/98 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl'

  const scrollClass = mobileFullscreen
    ? 'min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-1 py-3'
    : 'max-h-[min(60vh,26rem)] min-h-[8rem] space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3'

  return (
    <div
      data-assistant-composer
      data-assistant-fullscreen={mobileFullscreen ? 'true' : undefined}
      role={mobileFullscreen ? 'dialog' : undefined}
      aria-modal={mobileFullscreen ? true : undefined}
      aria-label={mobileFullscreen ? 'CG Assistant' : undefined}
      className={shellClass}
      style={shellStyle}
    >
      <div className={innerClass}>
        {open && (
          <div className={panelClass}>
            <div className={`flex items-center justify-between gap-2 border-b border-white/10 ${mobileFullscreen ? 'px-2 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]' : 'px-4 py-2.5'}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-teal/15 text-[11px] font-black text-brand-teal">CG</span>
                <div className="leading-tight">
                  <p className="text-sm font-bold text-white">CG Assistant</p>
                  <p className="text-[10px] text-brand-primary/55 md:hidden">Context: {mobileContextLabel}</p>
                  <p className="hidden text-[10px] text-brand-primary/55 md:block">Knows: {pageLabel}{clientId ? ' · this client' : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link to="/admin/assistant" onClick={() => setOpen(false)} className="flex min-h-11 items-center rounded-md px-2 text-[11px] font-bold text-brand-primary/70 hover:text-white" title="Open full assistant">Expand</Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`min-h-11 rounded-md text-sm font-bold text-brand-primary/70 hover:text-white ${mobileFullscreen ? 'border border-white/12 px-3' : 'min-w-11 px-2'}`}
                  aria-label={mobileFullscreen ? 'Close assistant' : 'Minimise assistant'}
                >
                  {mobileFullscreen ? 'Close' : '–'}
                </button>
              </div>
            </div>

            {marketingNote && (
              <div className="border-b border-white/10 px-3 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-wide text-brand-primary/60">Marketing AI</p>
                <p className="mt-1 text-xs text-brand-primary/80">{marketingNote}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-teal" />
                </div>
              </div>
            )}

            {microsoftSyncNote && (
              <div className="border-b border-white/10 px-3 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-wide text-brand-primary/60">Microsoft 365 sync</p>
                <p className="mt-1 text-xs text-brand-primary/80">{microsoftSyncNote}</p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-brand-teal" />
                </div>
              </div>
            )}

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

            <div ref={scrollRef} className={scrollClass}>
              {messages.length === 0 && !sending && !mobileSuggestionAreaHidden && (
                <div className="space-y-2 py-1.5 md:hidden">
                  <p className="px-1 text-xs text-brand-primary/60">What do you need help with?</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button type="button" onClick={startDailyCapture} className="min-h-11 rounded-lg border border-brand-teal/30 bg-brand-teal/10 px-2 text-xs font-bold text-brand-teal hover:bg-brand-teal/20">
                      Record my update
                    </button>
                    <button type="button" onClick={() => void send('What should I do next?')} className="min-h-11 rounded-lg border border-white/10 bg-white/[0.04] px-2 text-xs font-bold text-brand-primary hover:border-brand-teal/40 hover:text-white">
                      What should I do next?
                    </button>
                  </div>
                  {moreOpen ? (
                    <div className="space-y-1">
                      {starterChips}
                      <button type="button" onClick={() => setMoreOpen(false)} className="min-h-11 rounded-md px-1 text-xs font-bold text-brand-primary/60 hover:text-white">Less</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setMoreOpen(true)} className="min-h-11 rounded-md px-1 text-xs font-bold text-brand-primary/60 hover:text-white">More</button>
                  )}
                </div>
              )}
              {messages.length === 0 && !sending && (
                <div className="hidden space-y-2 py-2 md:block">
                  <p className="px-1 text-xs text-brand-primary/60">Ask anything about your work, clients or this page.</p>
                  {starterChips}
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
              {chatError && (
                <div className="rounded-xl border border-red-400/25 bg-red-400/[0.07] px-3 py-2.5" role="alert">
                  <p className="text-xs leading-relaxed text-red-100">{chatError}</p>
                  {chatErrorRetryable && lastUserMessage && (
                    <button
                      type="button"
                      onClick={retryLastMessage}
                      disabled={sending}
                      className="mt-2 min-h-11 rounded-full border border-red-300/30 px-3 text-xs font-black text-red-100 transition-colors hover:bg-red-400/15 disabled:opacity-40"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/*
          Capture / debrief / proposal surfaces. `contents` keeps the docked
          layout byte-identical; in full-screen they become a bounded, scrollable
          band so a tall panel can never push the composer off the bottom.
        */}
        <div className={mobileFullscreen && overlayOpen ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain' : 'contents'}>
        {dailyCaptureOpen && profileId && (
          <DailyAssistantCapture
            userId={profileId}
            page={pageLabel}
            clientId={clientId || undefined}
            onClose={() => setDailyCaptureOpen(false)}
            onSaved={message => {
              setDailyCaptureOpen(false)
              pushAssistant(message)
              void getMyDayContext(profile ?? null).then(async ctx => {
                const [captureResult, itemResult] = await Promise.all([listMyAssistantDayCaptures(), listMyAssistantDayItems()])
                const work = buildAssistantLocalWorkContext(ctx)
                if (work) work.personalDaySummary = dailyAssistantContextLine(captureResult.data ?? [], itemResult.data ?? [])
                workContextRef.current = work
              })
            }}
          />
        )}
        {/* Meeting debrief — record/type → ONE editable confirmation → apply */}
        {debriefOpen && (
          <div className="mb-2 max-h-[70vh] overflow-y-auto rounded-2xl border border-brand-teal/30 bg-[#0c0f0e]/98 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-white">Meeting debrief</p>
              <button type="button" onClick={closeDebrief} className="min-h-11 min-w-11 rounded-md px-2 text-sm font-bold text-brand-primary/70 hover:text-white">✕</button>
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
                    aria-live="polite"
                    className={`min-h-11 flex-1 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors disabled:opacity-40 ${debriefRecording ? 'animate-pulse border-red-400/40 bg-red-400/15 text-red-200' : 'border-white/12 text-brand-primary hover:text-white'}`}
                  >
                    {debriefRecording ? `Stop · ${Math.floor((MAX_VOICE_SECONDS - debriefRecordingSeconds) / 60)}:${String((MAX_VOICE_SECONDS - debriefRecordingSeconds) % 60).padStart(2, '0')} left` : 'Record voice note (5:00 max)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void analyseDebrief({})}
                    disabled={debriefBusy || !debriefText.trim()}
                    className="min-h-11 flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40"
                  >
                    {debriefBusy ? 'Analysing…' : 'Analyse text'}
                  </button>
                </div>
                {debriefBusy && !debriefRecording && <p className="text-xs text-brand-primary/60" role="status" aria-live="polite">Transcribing and structuring the debrief…</p>}
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
                    {debriefCandidates.length === 0 && <option value="">No recent meeting found</option>}
                    {debriefCandidates.map(c => (
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
                {debriefError && <p className="text-xs text-red-300" role="alert">{debriefError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => void confirmDebrief()} disabled={debriefBusy} className="min-h-11 flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40">
                    {debriefBusy ? 'Saving…' : `Save notes${debrief.tasks.filter(t => t.title.trim()).length > 0 ? ` + create ${debrief.tasks.filter(t => t.title.trim()).length} task${debrief.tasks.filter(t => t.title.trim()).length > 1 ? 's' : ''}` : ''}`}
                  </button>
                  <button type="button" onClick={restartDebriefDraft} className="min-h-11 rounded-full border border-white/12 px-3 py-1.5 text-sm font-bold text-brand-primary hover:text-white">Back</button>
                </div>
              </div>
            )}
            {debriefError && !debrief && <p className="mt-2 text-xs text-red-300" role="alert">{debriefError}</p>}
          </div>
        )}

        {/* Action preview — confirm/edit/cancel before any write */}
        {proposal && (
          <div className="mb-2 rounded-2xl border border-brand-teal/30 bg-[#0c0f0e]/98 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-black text-white">{proposal.title}</p>
              <span className="shrink-0 rounded-full border border-brand-teal/30 bg-brand-teal/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-brand-teal">Preview</span>
            </div>
            {proposal.approvalNote && (
              <p className="mb-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2 py-1 text-[11px] text-amber-200">{proposal.approvalNote}</p>
            )}
            {proposal.type === 'task.assign' && proposal.fields.due_date && !proposal.approvalNote && (
              <p className="mb-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-2 py-1 text-[11px] text-amber-200">Assignment will be saved now. Change the due date separately on the task because both changes cannot be applied atomically.</p>
            )}
            {proposal.target && (
              <p className="mb-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs text-brand-primary">
                <span className="font-black text-white">{proposal.target.type === 'planner_task' ? 'Task' : 'Content Run'}:</span> {proposal.target.label}
              </p>
            )}
            <div className="space-y-1.5">
              {proposal.type === 'job.enqueue' && proposal.fields.job === 'meta_sync' && (
                <label className="flex min-h-11 items-center gap-2 text-sm text-brand-primary">
                  <input
                    type="checkbox"
                    checked={proposal.fields.sync_previous_month === 'yes'}
                    onChange={event => setProposal(current => current ? { ...current, fields: { ...current.fields, sync_previous_month: event.target.checked ? 'yes' : 'no' } } : current)}
                    className="h-5 w-5 accent-brand-teal"
                  />
                  Also sync the previous month
                </label>
              )}
              {Object.entries(proposal.fields)
                .filter(([key, value]) => {
                  if (key === 'job' || key === 'sync_previous_month' || key === 'status') return false
                  if (proposal.type === 'task.assign' && key === 'task') return false
                  if ((proposal.type === 'task.assign' || proposal.type === 'task.create') && (key === 'assignee' || key === 'due_date')) return true
                  return value !== null && value !== undefined && String(value) !== ''
                })
                .map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-[10px] font-black uppercase tracking-wide text-brand-primary/55">{key.replace(/_/g, ' ')}</span>
                    <input
                      type={key === 'due_date' || key === 'date' || key === 'new_date' || key === 'scheduled_date' ? 'date' : 'text'}
                      value={value === null || value === undefined ? '' : String(value)}
                      placeholder={key === 'assignee' || key === 'due_date' ? 'Optional' : undefined}
                      onChange={event => setProposal(current => current ? { ...current, fields: { ...current.fields, [key]: event.target.value } } : current)}
                      className="min-h-11 min-w-0 flex-1 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
                    />
                  </label>
                ))}
            </div>
            {proposalError && <p className="mt-2 text-xs text-red-300">{proposalError}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => void applyProposal()} disabled={applying} className="min-h-11 flex-1 rounded-full bg-brand-teal px-3 py-1.5 text-sm font-black text-black transition-opacity disabled:opacity-40">
                {applying ? 'Working…' : proposal.requiresApproval ? 'Submit for approval' : 'Confirm'}
              </button>
              <button type="button" onClick={() => { setProposal(null); setProposalError(null); inputRef.current?.focus() }} className="min-h-11 rounded-full border border-white/12 px-3 py-1.5 text-sm font-bold text-brand-primary hover:text-white">Cancel</button>
            </div>
          </div>
        )}
        </div>

        {/* Composer bar — the fixed footer of the full-screen column, so it is
            always the element sitting directly above the keyboard. */}
        <form onSubmit={handleSubmit} className={`relative flex items-end gap-1.5 rounded-2xl border border-white/12 bg-[#0c0f0e]/98 px-2 py-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl ${mobileFullscreen ? 'shrink-0' : ''}`}>
          {plusOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-xl border border-white/12 bg-[#121614] p-1 shadow-2xl">
              <button type="button" onClick={newChat} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">New chat</button>
              <button type="button" onClick={() => { setShowJobs(true); setOpen(true); setPlusOpen(false); void loadJobs() }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Background jobs</button>
              <button type="button" onClick={startDailyCapture} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm font-black text-brand-teal hover:bg-white/[0.05]">Record my day</button>
              <button type="button" onClick={startNewDebrief} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Meeting debrief</button>
              <button type="button" onClick={() => { attachRef.current?.click() }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Attach file</button>
              <Link to="/admin/assistant" onClick={() => { setPlusOpen(false); setOpen(false) }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">Open full assistant</Link>
            </div>
          )}
          <input ref={attachRef} type="file" className="hidden" onChange={event => onAttach(event.target.files)} />

          <button
            type="button"
            onClick={() => setPlusOpen(value => !value)}
            aria-label="Add action"
            aria-expanded={plusOpen}
            disabled={listening}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-lg font-bold text-brand-primary transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={event => { setInput(event.target.value); setMoreOpen(false) }}
            onFocus={() => setOpen(true)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                if (!listening) void send(input)
              }
            }}
            rows={1}
            placeholder="Ask CG Assistant"
            aria-label="Ask CG Assistant"
            className="max-h-28 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2.5 text-sm text-white placeholder:text-brand-primary/45 focus:outline-none"
          />

          {speechSupported && (
            <div className="hidden shrink-0 items-center gap-1 md:flex">
              <button
                type="button"
                onClick={() => setMicLang(l => (l === 'en-ZA' ? 'af-ZA' : 'en-ZA'))}
                disabled={listening || sending}
                className="min-h-11 min-w-11 rounded-md px-1 text-[10px] font-black uppercase tracking-wide text-brand-primary/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-40"
                title="Dictation language"
                aria-label={`Dictation language: ${micLang === 'en-ZA' ? 'English' : 'Afrikaans'}`}
              >
                {micLang === 'en-ZA' ? 'EN' : 'AF'}
              </button>
              <button
                type="button"
                onClick={toggleMic}
                disabled={sending}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={listening}
                className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:cursor-not-allowed disabled:opacity-40 ${
                  listening ? 'animate-pulse border-red-400/40 bg-red-400/15 text-red-200' : 'border-white/12 bg-white/[0.04] text-brand-primary hover:text-white'
                }`}
              >
                ●
              </button>
            </div>
          )}

          {/* Mobile: exactly one primary control — mic while empty/listening, send otherwise */}
          <div className="flex shrink-0 items-center md:hidden">
            {mobileSendPrimary ? (
              <button
                type="submit"
                disabled={sending || listening || !input.trim()}
                aria-label="Send message"
                className={`flex h-11 w-11 items-center justify-center rounded-full text-base font-black text-black transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:opacity-35 ${
                  sending ? 'bg-brand-teal/70' : 'bg-brand-teal hover:bg-brand-teal/90'
                }`}
              >
                {sending ? '…' : '↑'}
              </button>
            ) : mobileMicPrimary ? (
              <button
                type="button"
                onClick={toggleMic}
                aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                aria-pressed={listening}
                className={`flex h-11 w-11 items-center justify-center rounded-full text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal ${
                  listening
                    ? 'animate-pulse border border-red-400/40 bg-red-400/15 text-red-200'
                    : 'border border-transparent bg-brand-teal text-black font-black hover:bg-brand-teal/90'
                }`}
              >
                ●
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={sending || listening || !input.trim()}
            aria-label="Send message"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal text-base font-black text-black transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-teal disabled:opacity-35 md:flex"
          >
            {sending ? '…' : '↑'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default GlobalAssistantComposer
