import { supabase } from './supabase'
import { withRequestTimeout } from './db/requestTimeout'

// ── Client Guides ──────────────────────────────────────────────────────────
// Derived/exportable documents from canonical Dynamics intelligence.
// Each row is a generated Client Guide for one client.
// The guide is derived, not manually maintained.
// Updating CG Dynamics intelligence should regenerate the guide.

export interface ClientGuide {
  id: string
  client_id: string
  guide_markdown: string
  project_instructions: string
  generated_at: string
  version: number
  source_pack_path: string | null
  created_at: string
  updated_at: string
}

/** List all client guides (admin/manager). */
export async function listClientGuides() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_guides')
      .select('*')
      .order('generated_at', { ascending: false }),
    'Loading client guides took too long.',
  )
  return { data: (data ?? []) as ClientGuide[], error }
}

/** Get the client guide for a specific client. */
export async function getClientGuide(clientId: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_guides')
      .select('*')
      .eq('client_id', clientId)
      .single(),
    'Loading client guide took too long.',
  )
  return { data: data as ClientGuide | null, error }
}

/** Upsert (insert or replace) a client guide for a client. */
export async function upsertClientGuide(input: {
  client_id: string
  guide_markdown: string
  project_instructions: string
  source_pack_path?: string
}) {
  const { data: existing } = await supabase
    .from('client_guides')
    .select('id, version')
    .eq('client_id', input.client_id)
    .single()

  const version = (existing?.version ?? 0) + 1

  if (existing) {
    const { data, error } = await withRequestTimeout(
      supabase
        .from('client_guides')
        .update({
          guide_markdown: input.guide_markdown,
          project_instructions: input.project_instructions,
          source_pack_path: input.source_pack_path ?? null,
          version,
          generated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single(),
      'Updating client guide took too long.',
    )
    return { data: data as ClientGuide | null, error }
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from('client_guides')
      .insert({
        client_id: input.client_id,
        guide_markdown: input.guide_markdown,
        project_instructions: input.project_instructions,
        source_pack_path: input.source_pack_path ?? null,
        version: 1,
      })
      .select()
      .single(),
    'Creating client guide took too long.',
  )
  return { data: data as ClientGuide | null, error }
}

/** Download the client guide as a .md file (client-side blob download). */
export function downloadClientGuide(guide: ClientGuide, clientName: string) {
  const filename = `${clientName.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}-cg-dynamics-client-guide.md`
  const blob = new Blob([guide.guide_markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Copy the Project Instructions to clipboard. Returns true on success. */
export async function copyProjectInstructions(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
