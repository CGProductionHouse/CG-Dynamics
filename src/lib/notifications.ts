import { supabase } from './supabase'

// In-app notifications for staff (clients are outside CG Assistant). Users read
// and mark-read only their own via RLS; creation is server-side only through the
// create_notification SECURITY DEFINER RPC, which refuses client targets.

export interface AppNotification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export async function listMyNotifications(limit = 30) {
  return supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
}

export async function unreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return { count: count ?? 0, error }
}

export async function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).select().single()
}

export async function markAllNotificationsRead() {
  return supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
}

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  body?: string | null
  entityType?: string | null
  entityId?: string | null
  link?: string | null
}

// Notify a staff member (no-op for client targets, enforced server-side).
export async function createNotification(input: CreateNotificationInput) {
  return supabase.rpc('create_notification', {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body ?? null,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_link: input.link ?? null,
  })
}
