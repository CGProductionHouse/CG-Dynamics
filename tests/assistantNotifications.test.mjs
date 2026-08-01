import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260731100000_assistant_notifications.sql')
const hardening = read('../supabase/migrations/20260801170000_backend_acceptance_hardening.sql')
const lib = read('../src/lib/notifications.ts')
const layout = read('../src/pages/admin/AdminLayout.tsx')

test('notifications: RLS on, users read/update only their own, no direct insert policy', () => {
  assert.match(sql, /alter table public\.notifications enable row level security/)
  assert.match(sql, /for select to authenticated using \(user_id = auth\.uid\(\)\)/)
  assert.match(sql, /for update to authenticated using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/)
  assert.doesNotMatch(sql, /for insert/i)
})

test('legacy create_notification is server-only after acceptance hardening', () => {
  const fn = sql.slice(sql.indexOf('function public.create_notification'))
  assert.match(fn, /security definer/)
  assert.match(fn, /if not is_staff\(\) then raise exception/)
  assert.match(fn, /target_role = 'client' then return null/)
  assert.match(hardening, /revoke all on function public\.create_notification\(uuid, text, text, text, text, uuid, text\) from public, anon, authenticated/)
})

test('client library reads explicit fields and marks read only through narrow RPCs', () => {
  assert.match(lib, /from\('notifications'\)\s*\.select/)
  assert.match(lib, /rpc\('mark_notification_read'/)
  assert.match(lib, /rpc\('mark_all_notifications_read'/)
  assert.doesNotMatch(lib, /createNotification|create_notification|\.insert\(|\.update\(/)
})

test('recipients cannot rewrite notification content and mark-read RPCs scope by auth.uid', () => {
  assert.match(hardening, /drop policy if exists "notifications update own"/)
  assert.match(hardening, /revoke insert, update, delete on table public\.notifications from public, anon, authenticated/)
  assert.match(hardening, /notification\.id = p_notification_id[\s\S]*notification\.user_id = auth\.uid\(\)/)
  assert.match(hardening, /function public\.mark_all_notifications_read\(\)[\s\S]*notification\.user_id = auth\.uid\(\)/)
})

test('notification links are internal and allowlisted with entity-derived task links', () => {
  assert.match(lib, /notification\.entity_type === 'planner_task'/)
  assert.match(lib, /ALLOWED_NOTIFICATION_PATHS\.has\(parsed\.pathname\)/)
  assert.match(lib, /notification\.link\.startsWith\('\/\/'\)/)
})

test('staff shell polls and renders accessible loading, error, empty, unread, and read controls', () => {
  assert.match(layout, /NOTIFICATION_POLL_MS = 30_000/)
  assert.match(layout, /Promise\.all\(\[listMyNotifications\(\), unreadNotificationCount\(\)\]\)/)
  assert.match(layout, /document\.addEventListener\('visibilitychange'/)
  assert.match(layout, /aria-controls="staff-notification-center"/)
  assert.match(layout, /Loading notifications\.\.\./)
  assert.match(layout, /Could not load notifications/)
  assert.match(layout, /No notifications yet/)
  assert.match(layout, /Mark all read/)
  assert.match(layout, /Mark read/)
  assert.match(layout, /bottom-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/)
})
