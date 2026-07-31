import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const sql = read('../supabase/migrations/20260731100000_assistant_notifications.sql')
const lib = read('../src/lib/notifications.ts')

test('notifications: RLS on, users read/update only their own, no direct insert policy', () => {
  assert.match(sql, /alter table public\.notifications enable row level security/)
  assert.match(sql, /for select to authenticated using \(user_id = auth\.uid\(\)\)/)
  assert.match(sql, /for update to authenticated using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/)
  assert.doesNotMatch(sql, /for insert/i)
})

test('create_notification is SECURITY DEFINER, staff-gated, and excludes clients', () => {
  const fn = sql.slice(sql.indexOf('function public.create_notification'))
  assert.match(fn, /security definer/)
  assert.match(fn, /if not is_staff\(\) then raise exception/)
  assert.match(fn, /target_role = 'client' then return null/)
})

test('client library reads own + marks read + creates only via the RPC', () => {
  assert.match(lib, /from\('notifications'\)\s*\.select/)
  assert.match(lib, /rpc\('create_notification'/)
  // No cross-user insert from the client — creation is server-side only.
  assert.doesNotMatch(lib, /\.from\('notifications'\)\s*\.insert/)
})
