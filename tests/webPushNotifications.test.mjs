import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260804070651_iphone_web_push_notifications.sql')
const worker = read('../supabase/functions/background-worker/index.ts')
const configFn = read('../supabase/functions/web-push-config/index.ts')
const client = read('../src/lib/webPush.ts')
const card = read('../src/components/assistant/WebPushSetupCard.tsx')
const serviceWorker = read('../public/sw.js')
const manifest = JSON.parse(read('../public/manifest.webmanifest'))
const indexHtml = read('../index.html')
const main = read('../src/main.tsx')
const auth = read('../src/contexts/AuthContext.tsx')

test('manifest supports a standalone iPhone Home Screen web app', () => {
  assert.equal(manifest.id, '/')
  assert.equal(manifest.scope, '/')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, '/admin/assistant')
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'))
  assert.match(indexHtml, /rel="manifest" href="\/manifest\.webmanifest"/)
  assert.match(indexHtml, /apple-mobile-web-app-capable/)
  assert.match(main, /navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/)
})

test('service worker displays private pushes and opens only safe same-origin app paths', () => {
  assert.match(serviceWorker, /addEventListener\('push'/)
  assert.match(serviceWorker, /showNotification/)
  assert.match(serviceWorker, /notificationclick/)
  assert.match(serviceWorker, /clients\.openWindow/)
  assert.match(serviceWorker, /target\.origin !== self\.location\.origin/)
  assert.match(serviceWorker, /tag: `cg-dynamics:\$\{notificationId\}`/)
  assert.doesNotMatch(serviceWorker, /endpoint|p256dh|auth_secret|VAPID_PRIVATE_KEY/)
})

test('subscription and delivery tables are RLS protected and never directly exposed', () => {
  for (const table of ['web_push_subscriptions', 'web_push_deliveries']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`))
  }
  assert.match(migration, /unique\(notification_id, subscription_id\)/)
  assert.match(migration, /endpoint_hash text not null unique/)
})

test('subscription RPCs are active-staff-only and scoped to auth.uid', () => {
  const register = migration.slice(migration.indexOf('function public.register_my_web_push_subscription'))
  assert.match(register, /profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(register, /user_id = auth\.uid\(\)/)
  assert.match(register, /p_endpoint !~ '\^https:\/\/'/)
  const status = migration.slice(migration.indexOf('function public.my_web_push_subscription_status'))
  assert.match(status, /subscription\.user_id = auth\.uid\(\)/)
  const remove = migration.slice(migration.indexOf('function public.unregister_my_web_push_subscription'))
  assert.match(remove, /subscription\.user_id = auth\.uid\(\)/)
  assert.doesNotMatch(migration, /grant select on table public\.web_push_subscriptions to authenticated/)
})

test('every canonical notification queues one idempotent delivery per active recipient device', () => {
  const queue = migration.slice(migration.indexOf('function public.queue_notification_web_push'))
  assert.match(queue, /after insert on public\.notifications/)
  assert.match(queue, /subscription\.user_id = new\.user_id/)
  assert.match(queue, /profile\.role in \('admin', 'manager', 'staff', 'team'\)/)
  assert.match(queue, /on conflict \(notification_id, subscription_id\) do nothing/)
  assert.match(queue, /'web-push:' \|\| new\.id::text/)
  assert.match(queue, /jsonb_build_object\('notification_id', new\.id\), null/)
  assert.match(queue, /on conflict \(idempotency_key\) do nothing/)
})

test('closed-app schedule creates only per-user quiet-hour notifications and reminders', () => {
  const schedule = migration.slice(migration.indexOf('function public.generate_due_assistant_notifications'))
  assert.match(schedule, /if v_hour < 7 or v_hour >= 19 then return 0/)
  for (const value of ['Morning plan', 'Midday check', 'Before you finish today', 'Follow-up reminder', 'Task due today']) {
    assert.match(schedule, new RegExp(value))
  }
  assert.match(schedule, /item\.user_id/)
  assert.match(schedule, /assignment\.profile_id/)
  assert.doesNotMatch(schedule, /manager_id|manager_user_id|supervisor/)
  assert.match(migration, /cron\.schedule\('cg-assistant-push-refresh', '\*\/5 \* \* \* \*'/)
})

test('worker uses server-only VAPID keys, retries transient failures and expires dead endpoints', () => {
  assert.match(worker, /npm:web-push@3\.6\.7/)
  assert.match(worker, /case 'web_push_delivery'/)
  assert.match(worker, /Deno\.env\.get\('VAPID_PRIVATE_KEY'\)/)
  assert.match(worker, /webpush\.sendNotification/)
  assert.match(worker, /status === 404 \|\| status === 410/)
  assert.match(worker, /is_active: false/)
  assert.match(worker, /status: 'sent'/)
  assert.match(worker, /throw new Error\(`\$\{transientFailures\} Web Push delivery attempt/)
  assert.doesNotMatch(worker, /console\.log\([^\n]*(endpoint|p256dh|auth_secret)/)
})

test('config function authenticates against profiles and clients are denied', () => {
  assert.match(configFn, /client\.auth\.getUser\(token\)/)
  assert.match(configFn, /select\('role,is_active'\)/)
  assert.match(configFn, /STAFF_ROLES\.has\(profile\.role\)/)
  assert.match(configFn, /Staff access required/)
  assert.match(configFn, /VAPID_PUBLIC_KEY/)
  assert.doesNotMatch(configFn, /VAPID_PRIVATE_KEY/)
})

test('UI reports active only when browser permission and server storage both exist', () => {
  assert.match(card, /state\.permission === 'granted' && state\.browserSubscription && state\.serverSubscription/)
  assert.match(card, /Active on this device/)
  assert.match(card, /Send test notification/)
  assert.match(card, /Add CG Dynamics to your Home Screen/)
  assert.match(client, /Notification\.requestPermission\(\)/)
  assert.match(client, /register_my_web_push_subscription/)
  assert.match(client, /my_web_push_subscription_status/)
  assert.match(client, /unregister_my_web_push_subscription/)
  assert.match(client, /send_my_test_push_notification/)
  assert.match(auth, /await disableWebPush\(\)[\s\S]*await supabase\.auth\.signOut\(\)/)
})
