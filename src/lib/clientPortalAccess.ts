import { supabase } from './supabase'

export interface ClientPortalAccessRow {
  client_id: string
  client_name: string
  proposed_username: string
  username: string | null
  provisioned: boolean
  enabled: boolean
  existing_client_users: number
}

export interface ClientPortalAccessReceipt {
  username: string
}

interface AccessResponse {
  ok?: boolean
  error?: string
  clients?: ClientPortalAccessRow[]
  username?: string
  session?: {
    access_token: string
    refresh_token: string
    expires_in?: number
    expires_at?: number
  }
}

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<AccessResponse>('client-portal-access', { body })
  if (error) {
    if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
      try {
        const response = await error.context.clone().json() as AccessResponse
        if (response.error) return { data: null, error: new Error(response.error) }
      } catch {
        // Fall through to the safe SDK error.
      }
    }
    return { data: null, error: error instanceof Error ? error : new Error('Portal access request failed.') }
  }
  if (!data?.ok) return { data: null, error: new Error(data?.error ?? 'Portal access request failed.') }
  return { data, error: null }
}

export async function signInWithPortalUsername(username: string, password: string) {
  const result = await invoke({ action: 'login', username, password })
  if (result.error || !result.data?.session) {
    return { session: null, error: result.error ?? new Error('Invalid username or password.') }
  }
  return { session: result.data.session, error: null }
}

export async function listClientPortalAccess() {
  const result = await invoke({ action: 'list' })
  return {
    data: result.data?.clients ?? [],
    error: result.error,
  }
}

export async function provisionClientPortalAccess(clientId: string, username: string) {
  const result = await invoke({ action: 'provision', client_id: clientId, username })
  return {
    data: result.data?.username
      ? { username: result.data.username } satisfies ClientPortalAccessReceipt
      : null,
    error: result.error,
  }
}

export async function resetClientPortalAccess(clientId: string) {
  const result = await invoke({ action: 'reset', client_id: clientId })
  return {
    data: result.data?.username
      ? { username: result.data.username } satisfies ClientPortalAccessReceipt
      : null,
    error: result.error,
  }
}

export async function setClientPortalAccessEnabled(clientId: string, enabled: boolean) {
  const result = await invoke({ action: enabled ? 'enable' : 'disable', client_id: clientId })
  return { error: result.error }
}
