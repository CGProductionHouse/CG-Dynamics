import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261002140000_website_enquiry_delivery_suppression.sql')
const runtime = read('../supabase/migrations/20261002110000_website_enquiry_delivery_runtime.sql')
const acceptance = read('./sql/405_website_enquiry_delivery_suppression_acceptance.sql')
const worker = read('../supabase/functions/website-enquiry-delivery-worker/index.ts')
const doc = read('../docs/ops/WEBSITE-ENQUIRY-DELIVERY-405.md')

test('suppression is additive, audited and creates no rows', () => {
  assert.match(migration, /drop constraint website_enquiry_delivery_jobs_delivery_state_check/)
  assert.match(migration, /'reconcile', 'suppressed'\)/)
  assert.match(migration, /website_enquiry_delivery_suppression_complete check/)
  assert.doesNotMatch(migration, /\b(insert into|delete from)\b/i)
})

test('only active admins/managers can suppress, and only before a provider accepted the message', () => {
  assert.match(migration, /profile\.role in \('admin', 'manager'\)/)
  assert.match(migration, /not in \('pending', 'failed', 'reconcile'\)/)
  assert.match(migration, /for update;/)
  assert.match(migration, /revoke all on function public\.suppress_website_enquiry_delivery\(uuid, text, text\) from public, anon/)
})

test('the worker can never claim or replay a suppressed job', () => {
  assert.match(runtime, /where job\.delivery_state = 'pending'\s+and job\.next_attempt_at <= v_now/)
  assert.match(runtime, /v_job\.delivery_state <> 'reconcile'/)
  assert.match(worker, /\.eq\('delivery_state', 'reconcile'\)/)
})

test('executable acceptance and runbook cover the pilot suppression gate', () => {
  for (const marker of [/worker claimed a suppressed job/, /unauthorised suppression accepted/, /in-flight job suppressed/,
    /sent job suppressed/, /worker claimed a job while it was being suppressed/, /unaudited suppression accepted/,
    /suppressed reconcile job was replayed/, /enquiry evidence changed/])
    assert.match(acceptance, marker)
  assert.match(doc, /website_enquiry_delivery_preflight\(\)/)
  assert.match(doc, /suppress_website_enquiry_delivery\(/)
  assert.match(doc, /acceptance_test/)
})
