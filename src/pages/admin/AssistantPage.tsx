import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { sendAssistantMessage, type AssistantChatMessage, type AssistantToolStatus } from '../../lib/assistant'
import { ActionButton } from '../../components/ui/Buttons'
import { PremiumCard, PremiumCardHeader } from '../../components/ui/PremiumCard'
import { Pill } from '../../components/ui/Badges'

const STARTER_PROMPTS = [
  'What should I focus on today?',
  'Summarise my tasks.',
  'What is urgent?',
  'Help me write a client update.',
  'What can you help with?',
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

const INITIAL_MESSAGE: AssistantChatMessage = {
  role: 'assistant',
  content:
    'Hi, I am CG Assistant. I can help with operational planning, client updates, prioritisation, and general CG workflow questions. Live task, calendar, approvals, Meta, and CG Hours tools are placeholders in this first version, so I will tell you clearly when something is not connected yet.',
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
  const [messages, setMessages] = useState<AssistantChatMessage[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
  const [tools, setTools] = useState<AssistantToolStatus[]>(DEFAULT_TOOLS)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const assistantHistory = useMemo(
    () => messages.filter((message) => message.role === 'user' || message.role === 'assistant'),
    [messages]
  )

  async function sendMessage(messageText = input) {
    const cleanMessage = messageText.trim()
    if (!cleanMessage || isSending) return

    const nextMessages = [...messages, { role: 'user' as const, content: cleanMessage }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setIsSending(true)

    const response = await sendAssistantMessage(cleanMessage, assistantHistory)

    setIsSending(false)
    if (response.tools?.length) setTools(response.tools)
    if (response.setupRequired) setSetupRequired(true)

    if (!response.ok && response.error) {
      setError(response.error)
    }

    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: response.answer,
      },
    ])

    window.setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  return (
    <div className="min-h-screen bg-brand-bg p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="overflow-hidden rounded-2xl border border-brand-muted bg-brand-surface">
          <div className="border-b border-white/10 bg-gradient-to-r from-brand-muted/70 via-brand-surface to-brand-accent/10 px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-brand-accent">
                  Staff portal
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  CG Assistant
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-brand-primary sm:text-base">
                  Practical, role-aware help for CG operations. This first version is intentionally guarded and only
                  uses approved server-side access.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent">{roleLabel(profile?.role)} access</Pill>
                <Pill tone="amber">Finance and payroll protected</Pill>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 sm:px-7">
            <p className="text-sm leading-relaxed text-brand-primary">
              Confidential finance, payroll, bank details, accounting values, profit/loss, owner notes, and private HR
              fields are protected. CG Assistant will refuse restricted requests instead of guessing or exposing data.
            </p>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <PremiumCard padding="none" className="flex min-h-[640px] flex-col overflow-hidden">
            <div className="border-b border-brand-muted px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Assistant chat</h2>
                  <p className="text-sm text-brand-primary">
                    Ask for operational help, drafting support, priorities, and workflow guidance.
                  </p>
                </div>
                {setupRequired && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-200">
                    OpenAI key needed
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
              {messages.map((message, index) => {
                const isUser = message.role === 'user'
                return (
                  <div key={`${message.role}-${index}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[min(44rem,92%)] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-brand-accent text-brand-bg'
                          : 'border border-brand-muted bg-brand-bg/70 text-brand-primary'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                )
              })}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-brand-muted bg-brand-bg/70 px-4 py-3 text-sm text-brand-primary">
                    CG Assistant is thinking...
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="border-t border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200 sm:px-5">
                {error}
              </div>
            )}

            <div className="border-t border-brand-muted bg-brand-surface/90 px-4 py-4 sm:px-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={isSending}
                    className="rounded-full border border-brand-muted bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:border-brand-accent/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
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
                <ActionButton type="submit" loading={isSending} disabled={!input.trim()} className="sm:self-end">
                  Send
                </ActionButton>
              </form>
              <p className="mt-2 text-xs text-brand-primary/70">
                Keep requests operational. The assistant does not have access to private finance, payroll, or owner-only
                notes.
              </p>
            </div>
          </PremiumCard>

          <aside className="space-y-5">
            <PremiumCard>
              <PremiumCardHeader
                eyebrow="Guardrails"
                title="What is connected"
                subtitle="This foundation keeps tools explicit so future integrations can be added safely."
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
                subtitle="Owner, admin, manager, and staff paths are separated before any AI response is generated."
              />
              <ul className="space-y-2 text-sm leading-relaxed text-brand-primary">
                <li>Staff: own work, visible project task context, public schedule, and general operational help.</li>
                <li>Managers: team workload, task status, approvals, and non-financial summaries when connected.</li>
                <li>Owner/admin: future full assistant tools, while confidential finance remains protected here.</li>
              </ul>
            </PremiumCard>
          </aside>
        </div>
      </div>
    </div>
  )
}
