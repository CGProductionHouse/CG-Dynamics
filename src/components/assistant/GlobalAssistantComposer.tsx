import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  buildAssistantLocalWorkContext,
  sendAssistantMessage,
  type AssistantChatMessage,
  type AssistantLocalWorkContext,
} from '../../lib/assistant'
import { getMyDayContext } from '../../lib/workforceMyDay'

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

  const workContextRef = useRef<AssistantLocalWorkContext | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const attachRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const speechSupported = useMemo(() => Boolean(getSpeechRecognition()), [])

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

  const pageLabel = pageLabelFromPath(location.pathname)
  // The full Assistant page has its own composer — don't stack a second one.
  const onAssistantPage = location.pathname.startsWith('/admin/assistant')
  const clientId = searchParams.get('client') ?? searchParams.get('clientId') ?? ''
  const recordId = searchParams.get('reportId') ?? searchParams.get('runId') ?? searchParams.get('id') ?? ''

  function currentContextLine(): string {
    const parts = [`page: ${pageLabel}`]
    if (clientId) parts.push(`clientId: ${clientId}`)
    if (recordId) parts.push(`recordId: ${recordId}`)
    return parts.join(', ')
  }

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || sending) return
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

        {/* Composer bar */}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-1.5 rounded-2xl border border-white/12 bg-[#0c0f0e]/98 px-2 py-1.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {plusOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-xl border border-white/12 bg-[#121614] p-1 shadow-2xl">
              <button type="button" onClick={newChat} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-brand-primary hover:bg-white/[0.05] hover:text-white">New chat</button>
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
