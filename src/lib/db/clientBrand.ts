import { supabase } from '../supabase'

const BRAND_TABLE = 'client_brand_profiles'
const LOG_TABLE = 'client_brand_logs'

export interface ClientBrandProfile {
  id: string
  client_id: string
  brand_notes: string | null
  tone_voice: string | null
  visual_direction: string | null
  colours_fonts: string | null
  do_notes: string | null
  dont_notes: string | null
  asset_notes: string | null
  onedrive_url: string | null
}

export interface ClientBrandLog {
  id: string
  client_id: string
  log_date: string
  title: string
  note: string | null
  changed_by_name: string | null
  created_at: string
}

function isTableMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string }
  return e.code === '42P01'
}

export async function getBrandProfile(clientId: string): Promise<{
  data: ClientBrandProfile | null
  error: unknown
  tableMissing: boolean
}> {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle()
  if (error && isTableMissingError(error)) return { data: null, error: null, tableMissing: true }
  return { data: data as ClientBrandProfile | null, error, tableMissing: false }
}

export async function upsertBrandProfile(
  clientId: string,
  patch: Partial<Omit<ClientBrandProfile, 'id' | 'client_id'>>,
): Promise<{ data: ClientBrandProfile | null; error: unknown; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from(BRAND_TABLE)
    .upsert({ ...patch, client_id: clientId }, { onConflict: 'client_id' })
    .select()
    .single()
  if (error && isTableMissingError(error)) return { data: null, error: null, tableMissing: true }
  return { data: data as ClientBrandProfile | null, error, tableMissing: false }
}

export async function listBrandLogs(clientId: string): Promise<{
  data: ClientBrandLog[]
  error: unknown
  tableMissing: boolean
}> {
  const { data, error } = await supabase
    .from(LOG_TABLE)
    .select('*')
    .eq('client_id', clientId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error && isTableMissingError(error)) return { data: [], error: null, tableMissing: true }
  return { data: (data ?? []) as ClientBrandLog[], error, tableMissing: false }
}

export async function addBrandLog(
  clientId: string,
  title: string,
  note: string | null,
  changedByName: string | null,
) {
  return supabase
    .from(LOG_TABLE)
    .insert({
      client_id: clientId,
      title,
      note,
      changed_by_name: changedByName,
      log_date: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single()
}
