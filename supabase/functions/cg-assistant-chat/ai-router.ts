export type AiProviderName = 'openrouter' | 'gemini' | 'groq' | 'openai'

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiRouterResult {
  content: string
  provider: AiProviderName
  model: string
}

export interface AiProviderDiagnostic {
  provider: AiProviderName
  model: string
  configured: boolean
  keyStatus: 'configured' | 'missing'
}

interface ProviderConfig {
  name: AiProviderName
  apiKey: string | null
  model: string
}

const DEFAULT_PROVIDER_ORDER: AiProviderName[] = ['openrouter', 'gemini', 'groq', 'openai']
const PROVIDER_TIMEOUT_MS = 12000
const DEFAULT_MAX_FALLBACKS = 3

function envValue(name: string, fallback = ''): string {
  return (Deno.env.get(name) ?? fallback).trim()
}

function providerConfig(name: AiProviderName): ProviderConfig {
  const config: Record<AiProviderName, ProviderConfig> = {
    openrouter: {
      name: 'openrouter',
      apiKey: envValue('OPENROUTER_API_KEY') || null,
      model: envValue('OPENROUTER_MODEL', 'openrouter/free'),
    },
    gemini: {
      name: 'gemini',
      apiKey: envValue('GEMINI_API_KEY') || null,
      model: envValue('GEMINI_MODEL', 'gemini-2.5-flash-lite'),
    },
    groq: {
      name: 'groq',
      apiKey: envValue('GROQ_API_KEY') || null,
      model: envValue('GROQ_MODEL', 'llama-3.1-8b-instant'),
    },
    openai: {
      name: 'openai',
      apiKey: envValue('OPENAI_API_KEY') || null,
      model: envValue('OPENAI_MODEL', 'gpt-4o-mini'),
    },
  }

  return config[name]
}

function providerOrder(): AiProviderName[] {
  const raw = envValue('AI_PROVIDER_ORDER', DEFAULT_PROVIDER_ORDER.join(','))
  const requested = raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is AiProviderName => {
      return item === 'openrouter' || item === 'gemini' || item === 'groq' || item === 'openai'
    })

  return requested.length > 0 ? requested : DEFAULT_PROVIDER_ORDER
}

export function getProviderOrder(): AiProviderName[] {
  return providerOrder()
}

export function getProviderDiagnostics(): AiProviderDiagnostic[] {
  return DEFAULT_PROVIDER_ORDER.map((name) => {
    const config = providerConfig(name)
    const configured = Boolean(config.apiKey)
    return {
      provider: name,
      model: config.model,
      configured,
      keyStatus: configured ? 'configured' : 'missing',
    }
  })
}

function maxAttempts(): number {
  const raw = Number(envValue('AI_MAX_FALLBACKS', String(DEFAULT_MAX_FALLBACKS)))
  const fallbackCount = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_MAX_FALLBACKS
  return fallbackCount + 1
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

function parseOpenAiCompatibleAnswer(data: unknown): string {
  const content = (data as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Provider returned an empty response.')
  }
  return content.trim()
}

function geminiContents(messages: AiChatMessage[]) {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }))
}

function systemText(messages: AiChatMessage[]): string {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n')
}

function parseGeminiAnswer(data: unknown): string {
  const parts = (data as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>
  })?.candidates?.[0]?.content?.parts

  const content = parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim()

  if (!content) {
    throw new Error('Gemini returned an empty response.')
  }

  return content
}

async function callOpenAiCompatibleProvider(
  config: ProviderConfig,
  messages: AiChatMessage[],
  endpoint: string,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  if (!config.apiKey) throw new Error(`${config.name} API key is missing.`)

  const response = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      max_tokens: 500,
      messages,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`${config.name} failed with ${response.status}: ${errorText.slice(0, 300)}`)
  }

  return parseOpenAiCompatibleAnswer(await response.json())
}

async function callGemini(config: ProviderConfig, messages: AiChatMessage[]): Promise<string> {
  if (!config.apiKey) throw new Error('Gemini API key is missing.')

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemText(messages) }],
      },
      contents: geminiContents(messages),
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 500,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`gemini failed with ${response.status}: ${errorText.slice(0, 300)}`)
  }

  return parseGeminiAnswer(await response.json())
}

async function callProvider(config: ProviderConfig, messages: AiChatMessage[]): Promise<string> {
  if (config.name === 'openrouter') {
    return callOpenAiCompatibleProvider(
      config,
      messages,
      'https://openrouter.ai/api/v1/chat/completions',
      {
        'HTTP-Referer': 'https://cg-dynamics.vercel.app',
        'X-Title': 'CG Dynamics',
      }
    )
  }

  if (config.name === 'groq') {
    return callOpenAiCompatibleProvider(config, messages, 'https://api.groq.com/openai/v1/chat/completions')
  }

  if (config.name === 'openai') {
    return callOpenAiCompatibleProvider(config, messages, 'https://api.openai.com/v1/chat/completions')
  }

  return callGemini(config, messages)
}

export function hasAnyConfiguredProvider(): boolean {
  return DEFAULT_PROVIDER_ORDER.some((name) => Boolean(providerConfig(name).apiKey))
}

export async function routeAiChat(messages: AiChatMessage[]): Promise<AiRouterResult> {
  const order = providerOrder()
  const attemptsAllowed = maxAttempts()
  let attempts = 0
  const errors: string[] = []

  for (const providerName of order) {
    const config = providerConfig(providerName)
    if (!config.apiKey) {
      console.info(`[cg-assistant] Skipping ${providerName}: API key not configured.`)
      continue
    }

    if (attempts >= attemptsAllowed) break
    attempts += 1

    try {
      const content = await callProvider(config, messages)
      console.info(`[cg-assistant] AI provider used: ${config.name}/${config.model}`)
      return {
        content,
        provider: config.name,
        model: config.model,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown provider error.'
      console.warn(`[cg-assistant] ${config.name}/${config.model} unavailable: ${message}`)
      errors.push(`${config.name}: ${message}`)
    }
  }

  if (!hasAnyConfiguredProvider()) {
    throw new Error('NO_AI_PROVIDER_KEYS')
  }

  throw new Error(`NO_AI_PROVIDER_AVAILABLE: ${errors.join(' | ') || 'No providers attempted.'}`)
}
