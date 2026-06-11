import { supabase } from '../supabase'

export interface Profile {
  id: string
  full_name: string | null
  role: 'admin' | 'team' | 'client'
  client_id: string | null
  created_at: string
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data: data as Profile | null, error }
}

export async function listProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  return { data: (data ?? []) as Profile[], error }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'role' | 'client_id'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  return { data: data as Profile | null, error }
}
