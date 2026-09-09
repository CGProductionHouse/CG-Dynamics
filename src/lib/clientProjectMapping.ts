// clientProjectMapping.ts
// Maps canonical CG Dynamics clients to ChatGPT Projects.
// Supports the direct CG Dynamics ↔ ChatGPT client bridge (Issue #241).

import { supabase } from './supabase'
import { withRequestTimeout } from './db/requestTimeout'

export type SyncState = 'needs_setup' | 'connected' | 'stale' | 'disconnected'

export interface ClientProjectMapping {
  id: string
  client_id: string
  chatgpt_project_url: string | null
  project_name: string | null
  sync_state: SyncState
  last_context_retrieved_at: string | null
  last_instructions_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

/** List all client project mappings (admin/manager). */
export async function listClientProjectMappings() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_project_mappings')
      .select('*')
      .order('created_at', { ascending: false }),
    'Loading project mappings took too long.',
  )
  return { data: (data ?? []) as ClientProjectMapping[], error }
}

/** Get the mapping for a specific client. */
export async function getClientProjectMapping(clientId: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_project_mappings')
      .select('*')
      .eq('client_id', clientId)
      .maybeSingle(),
    'Loading project mapping took too long.',
  )
  return { data: data as ClientProjectMapping | null, error }
}

/** Upsert a client project mapping. */
export async function upsertClientProjectMapping(input: {
  client_id: string
  chatgpt_project_url?: string
  project_name?: string
  sync_state?: SyncState
  notes?: string
}) {
  const { data: existing } = await supabase
    .from('client_project_mappings')
    .select('id')
    .eq('client_id', input.client_id)
    .maybeSingle()

  if (existing) {
    const { data, error } = await withRequestTimeout(
      supabase
        .from('client_project_mappings')
        .update({
          ...(input.chatgpt_project_url !== undefined && { chatgpt_project_url: input.chatgpt_project_url }),
          ...(input.project_name !== undefined && { project_name: input.project_name }),
          ...(input.sync_state !== undefined && { sync_state: input.sync_state }),
          ...(input.notes !== undefined && { notes: input.notes }),
        })
        .eq('id', existing.id)
        .select()
        .single(),
      'Updating project mapping took too long.',
    )
    return { data: data as ClientProjectMapping | null, error }
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_project_mappings')
      .insert({
        client_id: input.client_id,
        chatgpt_project_url: input.chatgpt_project_url ?? null,
        project_name: input.project_name ?? null,
        sync_state: input.sync_state ?? 'needs_setup',
        notes: input.notes ?? null,
      })
      .select()
      .single(),
    'Creating project mapping took too long.',
  )
  return { data: data as ClientProjectMapping | null, error }
}

/** Record that context was retrieved for a client (updates last_context_retrieved_at). */
export async function recordContextRetrieval(clientId: string) {
  const { error } = await supabase
    .from('client_project_mappings')
    .update({ last_context_retrieved_at: new Date().toISOString() })
    .eq('client_id', clientId)
  return { error }
}

/** Open the mapped ChatGPT Project in a new tab. Returns true if a URL was opened. */
export function openChatgptProject(mapping: ClientProjectMapping | null): boolean {
  if (!mapping?.chatgpt_project_url) return false
  window.open(mapping.chatgpt_project_url, '_blank', 'noopener,noreferrer')
  return true
}
