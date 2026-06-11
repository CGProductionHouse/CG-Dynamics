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

export async function listClients() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('clients')
      .select('*')
      .order('name'),
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
