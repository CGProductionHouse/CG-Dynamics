// clientContext.ts
// Client-side function to call the get-client-context Edge Function.
// Returns task-scoped context for the ChatGPT bridge.

import { supabase } from './supabase'

export type TaskType = 'caption' | 'content_idea' | 'poster_copy' | 'image_edit' | 'factual_lookup' | 'campaign' | 'seo_hashtags'

export interface TaskContextRequest {
  client_id: string
  task_type: TaskType
  scope_key?: string
  content_mode?: string
  topic?: string
  platform?: string
}

export interface TaskContextResponse {
  client_id: string
  client_name: string
  task_type: TaskType
  scope_key?: string
  topic?: string
  platform?: string
  generated_at: string
  context: Record<string, unknown>
}

/** Get task-scoped context for a specific client from the CG Dynamics bridge. */
export async function getClientContext(request: TaskContextRequest): Promise<{
  data: TaskContextResponse | null
  error: { message: string } | null
}> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { data: null, error: { message: 'Authentication required.' } }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    return { data: null, error: { message: 'Supabase URL not configured.' } }
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/get-client-context`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const result = await response.json()

    if (!response.ok) {
      return { data: null, error: { message: result.error || 'Context retrieval failed.' } }
    }

    return { data: result as TaskContextResponse, error: null }
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : 'Network error.' } }
  }
}
