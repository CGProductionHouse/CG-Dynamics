import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'

export interface Client {
  id: string
  name: string
  tier: 'standard' | 'premium'
  logo_url: string | null
  active: boolean
  created_at: string
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
