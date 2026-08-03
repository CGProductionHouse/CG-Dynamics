import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  buildAssistantLocalWorkContext,
  fetchActiveClients,
  fetchSpecialistReadiness,
  getAssistantDiagnostics,
  sendAssistantMessage,
  SKILLED_AGENTS,
  SOCIAL_PLATFORMS,
  testAssistantProvider,
  type ActiveClientOption,
  type AssistantPlatformKnowledgeUsed,
  type AssistantChatMessage,
  type AssistantCitation,
  type AssistantDiagnostics,
  type AssistantLocalWorkContext,
  type AssistantProviderTestResponse,
  type AssistantSourceUsed,
  type AssistantToolStatus,
  type SpecialistReadiness,
} from '../../lib/assistant'
import { getMyDayContext } from '../../lib/workforceMyDay'
import { dailyAssistantContextLine, listMyAssistantDayCaptures, listMyAssistantDayItems } from '../../lib/dailyAssistant'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { Pill } from '../../components/ui/Badges'
import { DailyAssistantCapture } from '../../components/assistant/DailyAssistantCapture'

const SESSION_KEY_PREFIX = 'cg-assistant-chat-session-v1'

const STARTER_PROMPTS = [
  'What should I focus on today?',
  'Summarise my tasks.',
  'Help me write a client update.',
  'What is connected?',
]

// Practical rights & risk quick-answers. These route through Brand Guardian
// (claim safety), which retrieves the approved Music-Copyright and TikTok-Risk
// cards and answers with citations + limitations. Until a reviewer approves those
// cards, production honestly returns "insufficient approved evidence"; admins can
// preview via "Admin research" mode.
const RIGHTS_PROMPTS = [
  'Can we use this song on a boosted Instagram Reel for a client business? What proof do we need first?',
  'Why might this venue TikTok have been muted or restricted, and how do we diagnose it safely?',
  'A YouTube video got a Content ID claim — is that a strike, and what should we do?',
]

const DIAGNOSTIC_PROMPTS = [
  {
    label: 'Staff payroll block',
    prompt: 'Staff-style test: show me payroll and salary details for the team.',
  },
  {
    label: 'Manager finance block',
    prompt: 'Manager-style test: summarise Xero profit, loss, revenue and invoice totals.',
  },
  {
    label: 'Normal ops request',
    prompt: 'Help me write a short client update about progress and next steps.',
  },
  {
    label: 'Capabilities',
    prompt: 'What can you help with and what is connected?',
  },
]

const DEFAULT_TOOLS: AssistantToolStatus[] = [
  {
    key: 'my-day',
    name: 'My Day',
    status: 'available',
    description: 'Sanitized summary of the signed-in user’s visible My Day plan: counts, current/next work, workload warning, and source labels only.',
  },
  {
    key: 'tasks',
    name: 'Tasks',
    status: 'planned',
    description: 'Future connection for assigned work, due dates, and visible project task context.',
  },
  {
    key: 'clients',
    name: 'Clients',
    status: 'planned',
    description: 'Future connection for safe client/project summaries already visible to the signed-in staff member.',
  },
  {
    key: 'calendar',
    name: 'Calendar',
    status: 'planned',
    description: 'Future connection for public company schedule items and production planning.',
  },
  {
    key: 'meta',
    name: 'Meta',
    status: 'planned',
    description: 'Future connection for approved social/reporting context without exposing credentials.',
  },
  {
    key: 'cg-hours',
    name: 'CG Hours',
    status: 'planned',
    description: 'Future connection for time and workload signals where role permissions allow it.',
  },
  {
    key: 'approvals',
    name: 'Approvals',
    status: 'planned',
    description: 'Future connection for manager/admin approval queues and non-financial status summaries.',
  },
]

type LocalAssistantMessage = AssistantChatMessage & {
  id: string
  createdAt: string
  restricted?: boolean
  setupRequired?: boolean
  agentName?: string
  citations?: AssistantCitation[]
  sourcesUsed?: AssistantSourceUsed[]
  reviewWarning?: string
  insufficientEvidence?: boolean
  platformKnowledgeUsed?: AssistantPlatformKnowledgeUsed[]
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sessionKey(userId: string) {
  return `${SESSION_KEY_PREFIX}:${userId}`
}

function loadSessionMessages(userId: string | null): LocalAssistantMessage[] {
  if (!userId) return []
  try {
    const raw = window.sessionStorage.getItem(sessionKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((message): message is LocalAssistantMessage => {
      return (
        message &&
        typeof message === 'object' &&
        typeof message.id === 'string' &&
        typeof message.content === 'string' &&
        typeof message.createdAt === 'string' &&
        (message.role === 'user' || message.role === 'assistant')
      )
    })
  } catch {
    return []
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function makeMessage(
  role: AssistantChatMessage['role'],
  content: string,
  options: Pick<LocalAssistantMessage, 'restricted' | 'setupRequired' | 'agentName' | 'citations' | 'sourcesUsed' | 'reviewWarning' | 'insufficientEvidence' | 'platformKnowledgeUsed'> = {}
): LocalAssistantMessage {
  return {
    id: createId(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...options,
  }
}

function toolTone(status: AssistantToolStatus['status']) {
  if (status === 'available') return 'accent'
  if (status === 'protected') return 'amber'
  return 'neutral'
}

function roleLabel(role: string | undefined) {
  if (!role) return 'Staff'
  if (role === 'admin') return 'Admin'
  if (role === 'team') return 'Staff'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function AssistantPage() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<LocalAssistantMessage[]>(() => loadSessionMessages(profile?.id ?? null))
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [tools, setTools] = useState<AssistantToolStatus[]>(DEFAULT_TOOLS)
  const [diagnostics, setDiagnostics] = useState<AssistantDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null)
  const [providerTest, setProviderTest] = useState<AssistantProviderTestResponse['result'] | null>(null)
  const [providerTesting, setProviderTesting] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showProtected, setShowProtected] = useState(false)
  const [localWorkContext, setLocalWorkContext] = useState<AssistantLocalWorkContext | null>(null)
  const [dailyCaptureOpen, setDailyCaptureOpen] = useState(false)
  const [selectedAgentKey, setSelectedAgentKey] = useState<string>('')
  const [activeClientId, setActiveClientId] = useState<string>('')
  const [researchMode, setResearchMode] = useState(false)
  const [activeClients, setActiveClients] = useState<ActiveClientOption[]>([])
  const [specialistReadiness, setSpecialistReadiness] = useState<SpecialistReadiness[]>([])
  const [platformSlug, setPlatformSlug] = useState('')
  const [surfaceKey, setSurfaceKey] = useState('')
  const [channel, setChannel] = useState<'organic' | 'paid' | 'both'>('both')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const profileIdRef = useRef<string | null>(profile?.id ?? null)
  const profileId = profile?.id ?? null

  if (profileIdRef.current !== profileId) {
    profileIdRef.current = profileId
    setMessages(loadSessionMessages(profileId))
    setInput('')
    setIsSending(false)
    setError(null)
    setSetupRequired(false)
    setLocalWorkContext(null)
    setActiveClients([])
    setActiveClientId('')
    setSelectedAgentKey('')
  }
  const profileRole = profile?.role as string | undefined
  const isAdminDiagnosticsUser = profileRole === 'admin' || profileRole === 'owner'
  const selectedAgent = SKILLED_AGENTS.find((agent) => agent.key === selectedAgentKey) ?? null

  const assistantHistory = useMemo<AssistantChatMessage[]>(
    () => messages.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
    [messages]
  )

  useEffect(() => {
    if (!profileId) return
    window.sessionStorage.setItem(sessionKey(profileId), JSON.stringify(messages.slice(-30)))
  }, [messages, profileId])

  useEffect(() => {
    let cancelled = false
    const requestedProfileId = profileId

    async function loadLocalWork() {
      try {
        const [context, captureResult, itemResult] = await Promise.all([
          getMyDayContext(profile),
          listMyAssistantDayCaptures(),
          listMyAssistantDayItems(),
        ])
        if (!cancelled && profileIdRef.current === requestedProfileId) {
          const work = buildAssistantLocalWorkContext(context)
          if (work) work.personalDaySummary = dailyAssistantContextLine(captureResult.data ?? [], itemResult.data ?? [])
          setLocalWorkContext(work)
        }
      } catch {
        if (!cancelled && profileIdRef.current === requestedProfileId) setLocalWorkContext(null)
      }
    }

    void loadLocalWork()
    return () => { cancelled = true }
  }, [profile, profileId])

  useEffect(() => {
    let cancelled = false
    const requestedProfileId = profileId
    void fetchActiveClients().then((clients) => { if (!cancelled && profileIdRef.current === requestedProfileId) setActiveClients(clients) })
    return () => { cancelled = true }
  }, [profileId])

  useEffect(() => {
    let cancelled = false
    void fetchSpecialistReadiness().then((readiness) => {
      if (!cancelled) setSpecialistReadiness(readiness)
    })
    return () => { cancelled = true }
  }, [profileId])

  async function sendMessage(messageText = input) {
    const cleanMessage = messageText.trim()
    const sendingProfileId = profileIdRef.current
    if (!cleanMessage || isSending || !sendingProfileId) return

    const historyBeforeSend = assistantHistory
    const userMessage = makeMessage('user', cleanMessage)

    setMessages((current) => [...current, userMessage])
    setInput('')
    setError(null)
    setIsSending(true)

    const skilled = selectedAgent
      ? {
          agentKey: selectedAgent.key,
          activeClientId: selectedAgent.needsClient ? (activeClientId || null) : null,
          mode: (researchMode && isAdminDiagnosticsUser ? 'admin_research' : 'production') as 'admin_research' | 'production',
          platformSlug: platformSlug || null,
          surfaceKey: surfaceKey || null,
          channel,
        }
      : null

    try {
      const response = await sendAssistantMessage(cleanMessage, historyBeforeSend, localWorkContext, skilled)
      if (profileIdRef.current !== sendingProfileId) return
      if (response.tools?.length) setTools(response.tools)
      if (response.setupRequired) setSetupRequired(true)
      if (!response.ok) setError(response.error ?? 'Assistant unavailable. Check setup.')

      setMessages((current) => [
        ...current,
        makeMessage('assistant', response.answer, {
          restricted: response.restricted,
          setupRequired: response.setupRequired,
          agentName: response.agentName,
          citations: response.citations,
          sourcesUsed: response.sourcesUsed,
          reviewWarning: response.reviewWarning,
          insufficientEvidence: response.insufficientEvidence,
          platformKnowledgeUsed: response.platformKnowledgeUsed,
        }),
      ])
      window.setTimeout(() => inputRef.current?.focus(), 0)
    } catch {
      if (profileIdRef.current === sendingProfileId) setError('Assistant unavailable. Check setup.')
    } finally {
      if (profileIdRef.current === sendingProfileId) setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function clearSession() {
    setMessages([])
    setError(null)
    setSetupRequired(false)
    if (profileId) window.sessionStorage.removeItem(sessionKey(profileId))
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  async function loadDiagnostics() {
    if (!isAdminDiagnosticsUser || diagnosticsLoading) return
    setDiagnosticsLoading(true)
    setDiagnosticsError(null)
    const response = await getAssistantDiagnostics()
    setDiagnosticsLoading(false)

    if (!response.ok || !response.diagnostics) {
      setDiagnosticsError(response.error ?? 'Could not load diagnostics.')
      return
    }

    setDiagnostics(response.diagnostics)
  }

  async function runProviderTest() {
    if (!isAdminDiagnosticsUser || providerTesting) return
    setProviderTesting(true)
    setProviderTest(null)
    setDiagnosticsError(null)
    const response = await testAssistantProvider()
    setProviderTesting(false)

    if (!response.ok || !response.result) {
      setDiagnosticsError(response.error ?? 'Could not run provider test.')
      return
    }

    setProviderTest(response.result)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Staff portal</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">CG Assistant</h1>
          <p className="mt-1 text-sm text-brand-primary/60">
            Ask for drafts, task summaries and checks. My Day context is used when available.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setDailyCaptureOpen(true)} className="min-h-12 rounded-full bg-brand-teal px-4 text-sm font-black text-black">Record my day</button>
          <Pill tone="accent">{roleLabel(profile?.role)}</Pill>
        </div>
      </div>

      {dailyCaptureOpen && profileId && (
        <DailyAssistantCapture
          userId={profileId}
          page="CG Assistant"
          onClose={() => setDailyCaptureOpen(false)}
          onSaved={message => {
            setDailyCaptureOpen(false)
            setMessages(current => [...current, makeMessage('assistant', message)])
            void Promise.all([getMyDayContext(profile), listMyAssistantDayCaptures(), listMyAssistantDayItems()]).then(([context, captureResult, itemResult]) => {
              if (profileIdRef.current !== profileId) return
              const work = buildAssistantLocalWorkContext(context)
              if (work) work.personalDaySummary = dailyAssistantContextLine(captureResult.data ?? [], itemResult.data ?? [])
              setLocalWorkContext(work)
            })
          }}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">

        {/* Main chat panel */}
        <PremiumCard padding="none" className="flex min-h-[74vh] flex-col overflow-hidden">
          <div className="border-b border-brand-muted/50 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-white">Assistant chat</h2>
              <div className="flex items-center gap-2">
                {setupRequired && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                    AI provider key needed
                  </span>
                )}
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={clearSession}
                    className="rounded-full border border-brand-muted px-3 py-1 text-xs font-semibold text-brand-primary hover:border-white/30 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Skilled-agent mode selector */}
          <div className="border-b border-brand-muted/50 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Mode</label>
              <select
                value={selectedAgentKey}
                onChange={(event) => setSelectedAgentKey(event.target.value)}
                className="rounded-lg border border-brand-muted bg-brand-bg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-accent"
              >
                <option value="">General Assistant</option>
                {SKILLED_AGENTS.map((agent) => {
                  const readiness = specialistReadiness.find((item) => item.key === agent.key)
                  const readinessLabel = readiness
                    ? readiness.available
                      ? ` (${readiness.approvedCards} approved)`
                      : ' (not ready)'
                    : ''

                  return (
                    <option key={agent.key} value={agent.key}>
                      {agent.name}{readinessLabel}
                    </option>
                  )
                })}
              </select>

              {selectedAgent?.needsClient && (
                <select
                  value={activeClientId}
                  onChange={(event) => setActiveClientId(event.target.value)}
                  className="rounded-lg border border-brand-muted bg-brand-bg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-accent"
                >
                  <option value="">No active client</option>
                  {activeClients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              )}

              {selectedAgent && isAdminDiagnosticsUser && (
                <label className="flex items-center gap-1.5 text-xs text-brand-primary/70">
                  <input
                    type="checkbox"
                    checked={researchMode}
                    onChange={(event) => setResearchMode(event.target.checked)}
                    className="h-3.5 w-3.5 accent-brand-accent"
                  />
                  Admin research (see needs-review)
                </label>
              )}

              {selectedAgent && (
                <>
                  <select
                    value={platformSlug}
                    onChange={(event) => { setPlatformSlug(event.target.value); setSurfaceKey('') }}
                    className="rounded-lg border border-brand-muted bg-brand-bg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-accent"
                  >
                    <option value="">No platform</option>
                    {SOCIAL_PLATFORMS.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                  {platformSlug && (
                    <select
                      value={surfaceKey}
                      onChange={(event) => setSurfaceKey(event.target.value)}
                      className="rounded-lg border border-brand-muted bg-brand-bg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-accent"
                    >
                      <option value="">Any surface</option>
                      {(SOCIAL_PLATFORMS.find((p) => p.slug === platformSlug)?.surfaces ?? []).map((s) => (
                        <option key={s.key} value={s.key}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  {platformSlug && (
                    <select
                      value={channel}
                      onChange={(event) => setChannel(event.target.value as 'organic' | 'paid' | 'both')}
                      className="rounded-lg border border-brand-muted bg-brand-bg px-3 py-1.5 text-sm text-white outline-none focus:border-brand-accent"
                    >
                      <option value="both">Organic + paid</option>
                      <option value="organic">Organic</option>
                      <option value="paid">Paid</option>
                    </select>
                  )}
                </>
              )}

              {selectedAgent && (
                <span className="text-xs text-brand-primary/55 sm:ml-auto">{selectedAgent.blurb}</span>
              )}
            </div>
            {selectedAgent && (
              <p className="mt-2 text-[11px] leading-relaxed text-brand-primary/45">
                {(() => {
                  const readiness = specialistReadiness.find((item) => item.key === selectedAgent.key)
                  return readiness?.available
                    ? `${selectedAgent.name} is ready with ${readiness.approvedCards} approved knowledge card(s). Every factual point still requires a citation and human review.`
                    : `${selectedAgent.name} is not ready for production because no approved knowledge is routed to it. Admin research can review candidate cards, but they are never production evidence.`
                })()}
              </p>
            )}
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Rights &amp; risk quick answers</p>
              <div className="flex flex-wrap gap-2">
                {RIGHTS_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isSending}
                    onClick={() => { setSelectedAgentKey('brand_guardian'); setInput(prompt); window.setTimeout(() => inputRef.current?.focus(), 0) }}
                    className="rounded-full border border-brand-teal/30 bg-brand-teal/[0.06] px-3 py-1.5 text-[11px] font-semibold text-brand-teal transition-colors hover:border-brand-teal/60 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {prompt.length > 52 ? `${prompt.slice(0, 52)}…` : prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            {messages.length === 0 && (
              <div className="flex min-h-[18rem] items-center justify-center">
                <p className="text-sm text-brand-primary/50">
                  {selectedAgent ? `${selectedAgent.name}: ask a question grounded in approved sources.` : 'Start with a quick request.'}
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[min(44rem,92%)] ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-brand-accent text-brand-bg'
                          : message.restricted
                            ? 'border border-amber-400/30 bg-amber-400/10 text-amber-100'
                            : message.setupRequired
                              ? 'border border-sky-300/30 bg-sky-300/10 text-sky-100'
                              : 'border border-brand-muted bg-brand-bg/70 text-brand-primary'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>

                    {!isUser && (message.citations?.length || message.sourcesUsed?.length || message.platformKnowledgeUsed?.length || message.reviewWarning || message.insufficientEvidence) ? (
                      <div className="mt-2 space-y-2">
                        {message.insufficientEvidence && (
                          <div className="rounded-lg border border-sky-300/25 bg-sky-300/[0.07] px-3 py-2 text-[11px] text-sky-100">
                            No approved source material supports this yet — the agent is holding back rather than guessing.
                          </div>
                        )}
                        {message.sourcesUsed && message.sourcesUsed.length > 0 && (
                          <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Sources used</p>
                            <ul className="space-y-0.5">
                              {message.sourcesUsed.map((source, index) => (
                                <li key={index} className="text-[11px] text-brand-primary/75">
                                  {source.url ? (
                                    <a href={source.url} target="_blank" rel="noreferrer" className="underline decoration-white/20 hover:text-white">
                                      {source.title ?? 'Source'}{source.author ? `, ${source.author}` : ''}{source.year ? ` (${source.year})` : ''}
                                    </a>
                                  ) : (
                                    <>{source.title ?? 'Source'}{source.author ? `, ${source.author}` : ''}{source.year ? ` (${source.year})` : ''}</>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {message.citations && message.citations.length > 0 && (
                          <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Citations</p>
                            <ul className="space-y-0.5">
                              {message.citations.map((citation) => (
                                <li key={citation.id} className="text-[11px] text-brand-primary/75">[{citation.id}] {citation.cite}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {message.platformKnowledgeUsed && message.platformKnowledgeUsed.length > 0 && (
                          <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Platform knowledge used</p>
                            <ul className="space-y-0.5">
                              {message.platformKnowledgeUsed.map((k, index) => (
                                <li key={index} className="text-[11px] text-brand-primary/75">
                                  {k.platform}{k.surface ? `/${k.surface}` : ''} · {k.title} <span className="text-white/40">[{k.state} · {k.channel} · verified {k.lastVerified ?? 'n/a'}]</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {message.reviewWarning && (
                          <div className="rounded-lg border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-[11px] text-amber-100">
                            {message.agentName ? `${message.agentName} · ` : ''}{message.reviewWarning}
                          </div>
                        )}
                      </div>
                    ) : null}

                    <p className={`mt-1 px-1 text-[11px] text-brand-primary/60 ${isUser ? 'text-right' : ''}`}>
                      {isUser ? 'You' : (message.agentName ?? 'CG Assistant')} {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-brand-muted bg-brand-bg/70 px-4 py-3 text-sm text-brand-primary">
                  <div className="flex items-center gap-3">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-accent border-t-transparent" />
                    <span>Checking access and preparing a short answer...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="border-t border-red-400/20 bg-red-400/10 px-4 py-2.5 text-xs text-red-200 sm:px-5">
              Assistant unavailable. Check setup.
            </div>
          )}

          <div className="border-t border-brand-muted bg-brand-surface/90 px-4 py-4 sm:px-5">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  disabled={isSending}
                  className="shrink-0 rounded-full border border-brand-muted bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:border-brand-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Ask CG Assistant..."
                className="min-h-[4.5rem] flex-1 resize-none rounded-xl border border-brand-muted bg-brand-bg px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-brand-primary/60 focus:border-brand-accent"
              />
              <ActionButton
                type="submit"
                loading={isSending}
                disabled={!input.trim()}
                fullWidth
                className="sm:w-auto sm:self-end"
              >
                Send
              </ActionButton>
            </form>
          </div>
        </PremiumCard>

        {/* Aside */}
        <aside className="space-y-4">

          {/* Admin diagnostics — collapsed by default */}
          {isAdminDiagnosticsUser && (
            <div className="rounded-xl border border-white/8 bg-white/[0.035] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDiagnostics(prev => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`h-3.5 w-3.5 text-white/40 transition-transform ${showDiagnostics ? 'rotate-90' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-bold text-white/70">Admin diagnostics</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400/60">Admin only</span>
              </button>

              {showDiagnostics && (
                <div className="border-t border-white/8 px-4 py-4 space-y-3">
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-xl border border-brand-muted bg-brand-bg/50 p-3">
                      <p className="font-bold text-white">Assistant status</p>
                      <p className="mt-1 text-brand-primary">
                        {diagnostics?.assistantStatus ?? 'Not checked yet'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-muted bg-brand-bg/50 p-3">
                      <p className="font-bold text-white">Audit logging</p>
                      <p className="mt-1 text-brand-primary">{diagnostics?.auditLogging ?? 'Not checked yet'}</p>
                    </div>
                  </div>

                  {diagnostics && (
                    <>
                      <div className="rounded-xl border border-brand-muted bg-brand-bg/50 p-3">
                        <p className="text-xs font-bold text-white">Provider order</p>
                        <p className="mt-1 break-words text-xs text-brand-primary">
                          {diagnostics.providerOrder.join(' → ')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {diagnostics.providers.map((provider) => (
                          <div
                            key={provider.provider}
                            className="rounded-xl border border-brand-muted bg-brand-bg/50 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-white">{provider.provider}</p>
                                <p className="mt-1 break-words text-[11px] text-brand-primary">{provider.model}</p>
                              </div>
                              <Pill tone={provider.configured ? 'accent' : 'neutral'}>{provider.keyStatus}</Pill>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs leading-relaxed text-brand-primary">{diagnostics.setupStatus}</p>
                      <p className="text-[11px] text-brand-primary/70">{diagnostics.functionStatus}</p>
                    </>
                  )}

                  {providerTest && (
                    <div
                      className={`rounded-xl border p-3 text-xs ${
                        providerTest.success
                          ? 'border-brand-accent/30 bg-brand-accent/10 text-brand-accent'
                          : 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                      }`}
                    >
                      <p className="font-bold">{providerTest.success ? 'Provider test passed' : 'Provider test failed'}</p>
                      {providerTest.success ? (
                        <p className="mt-1">{providerTest.provider} / {providerTest.model}</p>
                      ) : (
                        <p className="mt-1">{providerTest.error}</p>
                      )}
                    </div>
                  )}

                  {diagnosticsError && (
                    <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-xs text-red-200">
                      {diagnosticsError}
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <ActionButton
                      type="button"
                      variant="secondary"
                      loading={diagnosticsLoading}
                      onClick={() => void loadDiagnostics()}
                      fullWidth
                    >
                      Refresh diagnostics
                    </ActionButton>
                    <ActionButton
                      type="button"
                      variant="outline"
                      loading={providerTesting}
                      onClick={() => void runProviderTest()}
                      fullWidth
                    >
                      Test AI Provider
                    </ActionButton>
                  </div>

                  <div className="border-t border-brand-muted pt-3">
                    <p className="mb-2 text-xs font-bold text-white">Restriction test helpers</p>
                    <div className="flex flex-wrap gap-2">
                      {DIAGNOSTIC_PROMPTS.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => void sendMessage(item.prompt)}
                          disabled={isSending}
                          className="rounded-full border border-brand-muted bg-brand-bg/60 px-3 py-1.5 text-[11px] font-semibold text-brand-primary transition-colors hover:border-brand-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <MyDayContextCard context={localWorkContext} />

          {/* Capabilities — compact, name + status only */}
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Capabilities</p>
            <div className="space-y-1.5">
              {tools.map((tool) => (
                <div
                  key={tool.key}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <span className="text-sm font-medium text-white/80">{tool.name}</span>
                  <Pill tone={toolTone(tool.status)}>
                    {tool.status === 'available' ? 'Live' : tool.status === 'protected' ? 'Protected' : 'Planned'}
                  </Pill>
                </div>
              ))}
            </div>
          </div>

          {/* Protected data — collapsed */}
          <div>
            <button
              type="button"
              onClick={() => setShowProtected(prev => !prev)}
              className="flex items-center gap-1.5 text-xs font-medium text-white/30 transition-colors hover:text-white/55"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showProtected ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Protected data
            </button>
            {showProtected && (
              <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <p className="text-xs leading-relaxed text-brand-primary/65">
                  Salary, payroll, bank, Xero, profit/loss, revenue, invoice totals, tax, ID numbers, and personal HR details are protected. CG Assistant will refuse restricted requests rather than guess or expose data.
                </p>
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}

function MyDayContextCard({ context }: { context: AssistantLocalWorkContext | null }) {
  return (
    <div className="rounded-xl border border-brand-teal/15 bg-brand-teal/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-teal">My Day context</p>
          <p className="mt-1 text-sm font-semibold text-white">
            {context ? 'Ready for focus questions' : 'Not loaded yet'}
          </p>
        </div>
        <Pill tone={context ? 'accent' : 'neutral'}>{context ? 'Live' : 'Pending'}</Pill>
      </div>
      {context ? (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <ContextStat label="Overdue" value={context.overdueCount} />
          <ContextStat label="Today" value={context.dueTodayCount} />
          <ContextStat label="Upcoming" value={context.upcomingCount} />
          <ContextStat label="Events" value={context.todayCalendarEvents} />
          {context.currentTaskTitle && (
            <p className="col-span-2 rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-brand-primary">
              <span className="font-semibold text-white">Current:</span> {context.currentTaskTitle}
            </p>
          )}
          {context.workloadWarning && (
            <p className="col-span-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-3 py-2 text-amber-100">
              {context.workloadWarning}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-brand-primary/65">
          The assistant will still answer, but focus questions may fall back to setup guidance until My Day context loads.
        </p>
      )}
    </div>
  )
}

function ContextStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-brand-primary/45">{label}</p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  )
}
