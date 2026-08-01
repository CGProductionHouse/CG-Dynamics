import { supabase } from './supabase'

// Durable per-user assistant memory. RLS is own-only (user_id = auth.uid()),
// so each staff member's memory is strictly isolated — no cross-user or
// cross-client leakage, and clients (no staff profile) have none.

export interface AssistantMemory {
  id: string
  user_id: string
  kind: string
  content: string
  created_at: string
}

export async function listMyAssistantMemory(limit = 12) {
  return supabase
    .from('assistant_memory')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function addAssistantMemory(userId: string, content: string, kind = 'note') {
  return supabase
    .from('assistant_memory')
    .insert({ user_id: userId, content: content.trim(), kind })
    .select()
    .single()
}
