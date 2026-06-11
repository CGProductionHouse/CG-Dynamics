import { supabase } from '../supabase'
import { withRequestTimeout } from './requestTimeout'

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: 'admin' | 'team' | 'client'
  client_id: string | null
  created_at: string
}

export async function getProfile(userId: string) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(),
    'Loading your profile took too long. Please try again.'
  )
  return { data: data as Profile | null, error }
}

export async function listProfiles() {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false }),
    'Loading users took too long. Please try again.'
  )
  return { data: (data ?? []) as Profile[], error }
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'role' | 'client_id'>>
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single(),
    'Saving the user took too long. Please try again.'
  )
  return { data: data as Profile | null, error }
}
