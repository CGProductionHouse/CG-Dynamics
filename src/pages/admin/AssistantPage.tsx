import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getAssistantDiagnostics,
  sendAssistantMessage,
  testAssistantProvider,
  type AssistantChatMessage,
  type AssistantDiagnostics,
  type AssistantProviderTestResponse,
  type AssistantToolStatus,
} from '../../lib/assistant'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { Pill } from '../../components/ui/Badges'

const SESSION_KEY = 'cg-assistant-chat-session-v1'

const STARTER_PROMPTS = [
  'What should I focus on today?',
  'Summarise my tasks.',
  'What is urgent?',
  'Help me write a client update.',
  'What can you help with?',
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
    name: 'Meta Business',
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

  async function sendMessage(messageText = input) {
    const cleanMessage = messageText.trim()
    if (!cleanMessage || isSending) return

    const historyBeforeSend = assistantHistory
    const userMessage = makeMessage('user', cleanMessage)

    setMessages((current) => [...current, userMessage])
    setInput('')
    setError(null)
    setIsSending(true)

    const response = await sendAssistantMessage(cleanMessage, historyBeforeSend)

    setIsSending(false)
    if (response.tools?.length) setTools(response.tools)
    if (response.setupRequired) setSetupRequired(true)

    if (!response.ok) {
      setError(response.error ?? 'CG Assistant could not complete that request. Please try again.')
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
      setDiagnosticsError(response.error ?? 'Could not load CG Assistant diagnostics.')
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
    <div className="min-h-screen bg-brand-bg p-3 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="overflow-hidden rounded-2xl border border-brand-muted bg-brand-surface">
          <div className="border-b border-white/10 bg-gradient-to-r from-brand-muted/70 via-brand-surface to-brand-accent/10 px-4 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-brand-accent">
                  Staff portal
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  CG Assistant
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-primary sm:text-base">
                  Practical, role-aware help for CG operations. It answers from approved context only and says clearly
                  when a module is not connected yet.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent">{roleLabel(profile?.role)} access</Pill>
                <Pill tone="amber">Finance and payroll protected</Pill>
              </div>
            </div>
          </div>
          <div className="px-4 py-4 sm:px-7">
            <p className="text-sm leading-relaxed text-brand-primary">
              Salary, payroll, bank, Xero, profit/loss, revenue, invoice totals, tax, ID numbers, and personal HR
              details are protected for staff and managers. CG Assistant will refuse restricted requests instead of
              guessing or exposing data.
            </p>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PremiumCard padding="none" className="flex min-h-[74vh] flex-col overflow-hidden">
            <div className="border-b border-brand-muted px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Assistant chat</h2>
                  <p className="text-sm text-brand-primary">
                    Ask for priorities, drafts, checklists, operational summaries, or setup status.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
                      Clear chat
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              {messages.length === 0 && (
                <div className="mx-auto flex min-h-[22rem] max-w-2xl flex-col items-center justify-center rounded-2xl border border-brand-muted bg-brand-bg/50 px-5 py-8 text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-accent">
                    Ready when you are
                  </p>
                  <h3 className="mt-3 text-2xl font-black text-white">Start with an operational question</h3>
                  <p className="mt-3 text-sm leading-relaxed text-brand-primary">
                    CG Assistant can help draft client updates, plan priorities, explain what is connected, and create
                    practical checklists. It will not invent task or finance data.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {STARTER_PROMPTS.slice(0, 4).map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        disabled={isSending}
                        className="rounded-full border border-brand-muted bg-brand-surface px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:border-brand-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
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
              <div className="border-t border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 sm:px-5">
                {error} If this keeps happening, confirm the Edge Function is deployed and the user is signed in.
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
                  placeholder="Ask CG Assistant for operational help..."
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
              <p className="mt-2 text-xs text-brand-primary/70">
                Session history stays in this browser tab. Keep requests operational and avoid pasting confidential
                payroll, finance, or private HR details.
              </p>
            </div>
          </PremiumCard>

          <aside className="space-y-5">
            {isAdminDiagnosticsUser && (
              <PremiumCard>
                <PremiumCardHeader
                  eyebrow="Admin only"
                  title="Assistant diagnostics"
                  subtitle="Provider setup, audit readiness, and safe launch checks. Secret values are never shown."
                />

                <div className="space-y-3">
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
                          {diagnostics.providerOrder.join(' -> ')}
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
                        <p className="mt-1">
                          {providerTest.provider} / {providerTest.model}
                        </p>
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
              </PremiumCard>
            )}

            <PremiumCard>
              <PremiumCardHeader
                eyebrow="Capabilities"
                title="What is connected"
                subtitle="The assistant is ready for safe tool connections, but this version does not fake live data."
              />
              <div className="space-y-3">
                {tools.map((tool) => (
                  <div key={tool.key} className="rounded-xl border border-brand-muted bg-brand-bg/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-bold text-white">{tool.name}</h3>
                      <Pill tone={toolTone(tool.status)}>
                        {tool.status === 'available' ? 'Live' : tool.status === 'protected' ? 'Protected' : 'Planned'}
                      </Pill>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-brand-primary">{tool.description}</p>
                  </div>
                ))}
              </div>
            </PremiumCard>

            <PremiumCard>
              <PremiumCardHeader
                eyebrow="Access"
                title="Role-aware answers"
                subtitle="The server checks role and protected topics before any AI response."
              />
              <ul className="space-y-2 text-sm leading-relaxed text-brand-primary">
                <li>Staff: general operational help and future own-task/public-schedule context.</li>
                <li>Managers: future team workload, status, and approvals without finance or payroll details.</li>
                <li>Owner/admin: setup planning is allowed, but unavailable finance data is never invented.</li>
              </ul>
            </PremiumCard>
          </aside>
        </div>
      </div>
    </div>
  )
}
