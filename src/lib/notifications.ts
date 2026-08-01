import { supabase } from './supabase'

// In-app notifications are created by trusted database/worker workflows. The
// browser can only read and mark the signed-in recipient's notifications read.

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
    .select('id,user_id,type,title,body,entity_type,entity_id,link,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(50, Math.floor(limit))))
}

export async function unreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return { count: count ?? 0, error }
}

export async function markNotificationRead(id: string) {
  return supabase.rpc('mark_notification_read', { p_notification_id: id })
}

export async function markAllNotificationsRead() {
  return supabase.rpc('mark_all_notifications_read')
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_NOTIFICATION_PATHS = new Set([
  '/admin/cg-hub',
  '/admin/work',
  '/admin/cg-calendar',
  '/admin/client-schedule',
  '/admin/content',
  '/admin/clients',
  '/admin/client-performance',
  '/admin/reports',
  '/admin/integrations/meta',
])

export function safeNotificationLink(notification: AppNotification) {
  if (notification.entity_type === 'planner_task' && notification.entity_id && UUID_PATTERN.test(notification.entity_id)) {
    return `/admin/work?tab=board&id=${encodeURIComponent(notification.entity_id)}`
  }
  if (notification.entity_type === 'client_schedule_change_request') return '/admin/client-schedule'
  if (!notification.link || !notification.link.startsWith('/') || notification.link.startsWith('//')) return null

  try {
    const parsed = new URL(notification.link, 'https://cg-dynamics.internal')
    if (parsed.origin !== 'https://cg-dynamics.internal' || !ALLOWED_NOTIFICATION_PATHS.has(parsed.pathname)) return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}
