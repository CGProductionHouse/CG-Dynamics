import { supabase } from './supabase'

export type AssistantRole = 'user' | 'assistant'

export interface AssistantChatMessage {
  role: AssistantRole
  content: string
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
