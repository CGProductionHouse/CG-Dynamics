import { supabase } from '../supabase'

const TABLE = 'client_content_links'

export interface ClientContentLinks {
  id: string
  client_id: string
  onedrive_main_url: string | null
  brand_assets_url: string | null
  raw_footage_url: string | null
  ready_to_edit_url: string | null
  exports_url: string | null
  naming_convention: string | null
  content_guideline: string | null
  video_reel_notes: string | null
  shot_list: string | null
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string }
  return e.code === '42P01'
}

export async function getContentLinks(clientId: string): Promise<{
  data: ClientContentLinks | null
  error: unknown
  tableMissing: boolean
}> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error && isTableMissingError(error)) return { data: null, error: null, tableMissing: true }
  return { data: data as ClientContentLinks | null, error, tableMissing: false }
}

export async function upsertContentLinks(
  clientId: string,
  patch: Partial<Omit<ClientContentLinks, 'id' | 'client_id'>>,
): Promise<{ data: ClientContentLinks | null; error: unknown; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ ...patch, client_id: clientId }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error && isTableMissingError(error)) return { data: null, error: null, tableMissing: true }
  return { data: data as ClientContentLinks | null, error, tableMissing: false }
}
