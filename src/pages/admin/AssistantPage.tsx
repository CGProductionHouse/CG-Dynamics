import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  buildAssistantLocalWorkContext,
  getAssistantDiagnostics,
  sendAssistantMessage,
  testAssistantProvider,
  type AssistantChatMessage,
  type AssistantDiagnostics,
  type AssistantLocalWorkContext,
  type AssistantProviderTestResponse,
  type AssistantToolStatus,
} from '../../lib/assistant'
import { getMyDayContext } from '../../lib/workforceMyDay'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard } from '../../components/ui/PremiumCard'
import { Pill } from '../../components/ui/Badges'

const SESSION_KEY = 'cg-assistant-chat-session-v1'

const STARTER_PROMPTS = [
  'What should I focus on today?',
  'Summarise my tasks.',
  'Help me write a client update.',
  'What is connected?',
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
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function loadSessionMessages(): LocalAssistantMessage[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
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
  options: Pick<LocalAssistantMessage, 'restricted' | 'setupRequired'> = {}
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
  const [messages, setMessages] = useState<LocalAssistantMessage[]>(loadSessionMessages)
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const profileRole = profile?.role as string | undefined
  const isAdminDiagnosticsUser = profileRole === 'admin' || profileRole === 'owner'

  const assistantHistory = useMemo<AssistantChatMessage[]>(
    () => messages.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
    [messages]
  )

  useEffect(() => {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-30)))
  }, [messages])

  useEffect(() => {
    let cancelled = false

    async function loadLocalWork() {
      try {
        const context = await getMyDayContext(profile)
        if (!cancelled) setLocalWorkContext(buildAssistantLocalWorkContext(context))
      } catch {
        if (!cancelled) setLocalWorkContext(null)
      }
    }

    void loadLocalWork()
    return () => { cancelled = true }
  }, [profile?.id])

  async function sendMessage(messageText = input) {
    const cleanMessage = messageText.trim()
    if (!cleanMessage || isSending) return

    const historyBeforeSend = assistantHistory
    const userMessage = makeMessage('user', cleanMessage)

    setMessages((current) => [...current, userMessage])
    setInput('')
    setError(null)
    setIsSending(true)

    const response = await sendAssistantMessage(cleanMessage, historyBeforeSend, localWorkContext)

    setIsSending(false)
    if (response.tools?.length) setTools(response.tools)
    if (response.setupRequired) setSetupRequired(true)

    if (!response.ok) {
      setError(response.error ?? 'Assistant unavailable. Check setup.')
    }

    setMessages((current) => [
      ...current,
      makeMessage('assistant', response.answer, {
        restricted: response.restricted,
        setupRequired: response.setupRequired,
      }),
    ])

    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function clearSession() {
    setMessages([])
    setError(null)
    setSetupRequired(false)
    window.sessionStorage.removeItem(SESSION_KEY)
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
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#f2b66f]">Staff portal</p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase tracking-wide text-white">CG Assistant</h1>
          <p className="mt-1 text-sm text-brand-primary/60">
            Ask for drafts, task summaries and checks. My Day context is used when available.
          </p>
        </div>
        <Pill tone="accent">{roleLabel(profile?.role)}</Pill>
      </div>

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

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
            {messages.length === 0 && (
              <div className="flex min-h-[18rem] items-center justify-center">
                <p className="text-sm text-brand-primary/50">Start with a quick request.</p>
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
                    <p className={`mt-1 px-1 text-[11px] text-brand-primary/60 ${isUser ? 'text-right' : ''}`}>
                      {isUser ? 'You' : 'CG Assistant'} {formatTime(message.createdAt)}
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
