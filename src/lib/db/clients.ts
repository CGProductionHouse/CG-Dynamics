import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'

export interface PackageSettings {
  professional_videos_per_month: number
  reels_per_month: number
  photo_posts_per_month: number
  design_posters_per_month: number
  animated_posters_per_month: number
  campaign_management_included: boolean
  monthly_campaign_budget: number
  shoot_days_per_month: number
  package_notes: string
}

export const EMPTY_PACKAGE_SETTINGS: PackageSettings = {
  professional_videos_per_month: 0,
  reels_per_month: 0,
  photo_posts_per_month: 0,
  design_posters_per_month: 0,
  animated_posters_per_month: 0,
  campaign_management_included: false,
  monthly_campaign_budget: 0,
  shoot_days_per_month: 0,
  package_notes: '',
}

// Read a (possibly missing / partial) package_settings JSON into a complete,
// safe PackageSettings object. Tolerates the column being absent before the
// phase-3j migration is applied.
export function readPackageSettings(raw: unknown): PackageSettings {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PACKAGE_SETTINGS }
  const source = raw as Record<string, unknown>
  const num = (key: keyof PackageSettings) => {
    const value = Number(source[key])
    return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
  }
  return {
    professional_videos_per_month: num('professional_videos_per_month'),
    reels_per_month: num('reels_per_month'),
    photo_posts_per_month: num('photo_posts_per_month'),
    design_posters_per_month: num('design_posters_per_month'),
    animated_posters_per_month: num('animated_posters_per_month'),
    campaign_management_included: Boolean(source.campaign_management_included),
    monthly_campaign_budget: num('monthly_campaign_budget'),
    shoot_days_per_month: num('shoot_days_per_month'),
    package_notes: typeof source.package_notes === 'string' ? source.package_notes : '',
  }
}

export interface Client {
  id: string
  name: string
  tier: 'standard' | 'premium'
  logo_url: string | null
  active: boolean
  created_at: string
  // Added by phase-3j migration. Optional so the app keeps working before it
  // is applied (the column simply won't be present in the row).
  package_settings?: PackageSettings | null
}

function columnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // 42703 = undefined_column. PostgREST may also report a schema-cache miss.
  if (error.code === '42703') return true
  const msg = (error.message ?? '').toLowerCase()
  return msg.includes('package_settings') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find'))
}

export async function listClients(filter: 'active' | 'archived' | 'all' = 'all') {
  const base = supabase.from('clients').select('*').order('name')
  const query =
    filter === 'active' ? base.eq('active', true) :
    filter === 'archived' ? base.eq('active', false) :
    base
  const { data, error } = await withRequestTimeout(
    query,
    'Loading clients took too long. Please try again.'
  )
  return { data: (data ?? []) as Client[], error }
}

export async function getClient(id: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single(),
    'Loading the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

export async function createClient(input: {
  name: string
  tier: 'standard' | 'premium'
  active?: boolean
  logo_url?: string | null
}) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .insert(input)
      .select()
      .single(),
    'Saving the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

export async function updateClient(
  id: string,
  input: Partial<Pick<Client, 'name' | 'tier' | 'logo_url' | 'active'>>
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .update(input)
      .eq('id', id)
      .select()
      .single(),
    'Saving the client took too long. Please try again.'
  )
  return { data: data as Client | null, error }
}

// Best-effort save of a client's monthly package. Isolated from core client
// CRUD so that, before the phase-3j migration is applied, saving a client still
// succeeds — this simply reports `migrationNeeded` and the UI shows a soft note.
export async function updateClientPackage(id: string, settings: PackageSettings) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .update({ package_settings: settings })
      .eq('id', id)
      .select()
      .single(),
    'Saving the package took too long. Please try again.'
  )
  if (error && columnMissing(error)) {
    return { data: null, error: null, migrationNeeded: true }
  }
  return { data: data as Client | null, error, migrationNeeded: false }
}

export async function archiveClient(id: string) {
  return updateClient(id, { active: false })
}

export async function restoreClient(id: string) {
  return updateClient(id, { active: true })
}

export async function deleteClient(id: string) {
  const { error } = await withRequestTimeout(
    supabase.from('clients').delete().eq('id', id),
    'Deleting the client took too long. Please try again.'
  )
  return { error }
}

export async function clientHasData(id: string): Promise<boolean> {
  const [reportsRes, metricsRes, postsRes] = await Promise.all([
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('manual_platform_metrics').select('id', { count: 'exact', head: true }).eq('client_id', id),
    supabase.from('imported_meta_posts').select('id', { count: 'exact', head: true }).eq('client_id', id),
  ])
  return ((reportsRes.count ?? 0) + (metricsRes.count ?? 0) + (postsRes.count ?? 0)) > 0
}
