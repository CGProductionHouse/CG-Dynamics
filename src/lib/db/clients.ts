import { supabase } from '../supabase'

export interface Client {
  id: string
  name: string
  tier: 'standard' | 'premium'
  logo_url: string | null
  active: boolean
  created_at: string
}

export async function listClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('name')
  return { data: (data ?? []) as Client[], error }
}

export async function getClient(id: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()
  return { data: data as Client | null, error }
}

export async function createClient(input: {
  name: string
  tier: 'standard' | 'premium'
  logo_url?: string | null
}) {
  const { data, error } = await supabase
    .from('clients')
    .insert(input)
    .select()
    .single()
  return { data: data as Client | null, error }
}

export async function updateClient(
  id: string,
  input: Partial<Pick<Client, 'name' | 'tier' | 'logo_url' | 'active'>>
) {
  const { data, error } = await supabase
    .from('clients')
    .update(input)
    .eq('id', id)
    .select()
    .single()
  return { data: data as Client | null, error }
}
