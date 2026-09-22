import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const migration = readFileSync(
  new URL('../supabase/migrations/20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')
const webPushMigration = readFileSync(
  new URL('../supabase/migrations/20260804070651_iphone_web_push_notifications.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')
const backgroundWorker = readFileSync(
  new URL('../supabase/functions/background-worker/index.ts', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')
const queueFoundation = readFileSync(
  new URL('../supabase/migrations/20260801170000_backend_acceptance_hardening.sql', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n')

function allowedJobTypes(sql) {
  const match = sql.match(/check\s*\(\s*job_type\s+in\s*\(([^)]+)\)\s*\)\s*not valid/i)
  assert.ok(match, 'migration must install a NOT VALID job_type allowlist')
  return [...match[1].matchAll(/'([^']+)'/g)].map(result => result[1])
}

test('background job constraint has exactly the approved five-type allowlist', () => {
  assert.deepEqual(allowedJobTypes(migration), [
    'meta_sync',
    'report_prep',
    'web_push_delivery',
    'monthly_strategy_autopilot',
    'content_autopilot',
  ])
})

test('background job constraint rejects unrelated job types by omission', () => {
  const allowed = new Set(allowedJobTypes(migration))

  for (const unrelated of ['microsoft_sync', 'instagram_sync', 'google_ads_sync', 'arbitrary_job']) {
    assert.equal(allowed.has(unrelated), false, `${unrelated} must remain outside the database allowlist`)
  }
})

test('existing Web Push producer and worker handler remain represented in the database allowlist', () => {
  assert.ok(allowedJobTypes(migration).includes('web_push_delivery'))
  assert.match(webPushMigration, /function public\.queue_notification_web_push\(\)/)
  assert.match(webPushMigration, /select 'web_push_delivery', jsonb_build_object\('notification_id', new\.id\)/)
  assert.match(webPushMigration, /create trigger trg_notifications_queue_web_push after insert on public\.notifications/)
  assert.match(backgroundWorker, /case 'web_push_delivery':/)
})

test('authenticated enqueue RPC remains restricted to its existing manager-facing types', () => {
  const start = queueFoundation.indexOf('function public.enqueue_background_job')
  const end = queueFoundation.indexOf('create or replace function public.claim_next_background_job', start)
  assert.ok(start >= 0 && end > start)
  const enqueue = queueFoundation.slice(start, end)

  assert.match(enqueue, /p_job_type not in \('meta_sync', 'report_prep'\)/)
  assert.doesNotMatch(enqueue, /web_push_delivery|monthly_strategy_autopilot|content_autopilot/)
})

test('migration changes only the named check constraint', () => {
  assert.match(migration, /alter table public\.background_jobs\s+drop constraint background_jobs_allowed_type/i)
  assert.match(migration, /alter table public\.background_jobs\s+add constraint background_jobs_allowed_type/i)
  assert.doesNotMatch(migration, /create\s+(or\s+replace\s+)?function|create\s+policy|alter\s+policy|grant\s+|revoke\s+|cron\.|net\.http|insert\s+into|update\s+public\.|delete\s+from/i)
})
