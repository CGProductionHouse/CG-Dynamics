import { supabase } from './supabase'

export type AssistantRole = 'user' | 'assistant'

export interface AssistantChatMessage {
  role: AssistantRole
  content: string
  createdAt?: string
}

export interface AssistantToolStatus {
  key: string
  name: string
  status: 'planned' | 'protected' | 'available'
  description: string
}

export interface AssistantChatResponse {
  ok: boolean
  answer: string
  setupRequired?: boolean
  restricted?: boolean
  model?: string
  tools?: AssistantToolStatus[]
  error?: string
}

export interface AssistantProviderDiagnostic {
  provider: string
  model: string
  configured: boolean
  keyStatus: string
}

export interface AssistantDiagnostics {
  assistantStatus: 'ready' | 'setup_required' | string
  setupStatus: string
  providers: AssistantProviderDiagnostic[]
  providerOrder: string[]
  auditLogging: 'available' | 'pending' | string
  functionStatus: string
}

export interface AssistantDiagnosticsResponse {
  ok: boolean
  diagnostics?: AssistantDiagnostics
  error?: string
}

export interface AssistantProviderTestResponse {
  ok: boolean
  result?: {
    success: boolean
    provider?: string
    model?: string
    message?: string
    error?: string
  }
  error?: string
}

export async function sendAssistantMessage(
  message: string,
  history: AssistantChatMessage[]
): Promise<AssistantChatResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantChatResponse>('cg-assistant-chat', {
    body: {
      message,
      history: history.slice(-8),
    },
  })

  if (error) {
    return {
      ok: false,
      answer: 'CG Assistant could not be reached. Please check the server function setup and try again.',
      error: error.message,
    }
  }

  if (!data) {
    return {
      ok: false,
      answer: 'CG Assistant did not return a response. Please try again.',
    }
  }

  return data
}

export async function getAssistantDiagnostics(): Promise<AssistantDiagnosticsResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantDiagnosticsResponse>('cg-assistant-chat', {
    body: {
      action: 'diagnostics',
    },
  })

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return data ?? { ok: false, error: 'CG Assistant diagnostics did not return a response.' }
}

export async function testAssistantProvider(): Promise<AssistantProviderTestResponse> {
  const { data, error } = await supabase.functions.invoke<AssistantProviderTestResponse>('cg-assistant-chat', {
    body: {
      action: 'test_provider',
    },
  })

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  return data ?? { ok: false, error: 'CG Assistant provider test did not return a response.' }
}
