import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20260918124936_website_enquiry_transaction.sql')
const acceptance = read('./sql/405_website_enquiry_transaction_acceptance.sql')

test('contact identity and enquiry identity remain distinct and client scoped', () => {
  assert.match(migration, /create table public\.website_enquiry_contacts/i)
  assert.match(migration, /create table public\.website_enquiries/i)
  assert.match(migration, /website_enquiry_contacts_client_email_idx[\s\S]*\(client_id, normalized_email\)/i)
  assert.match(migration, /unique \(endpoint_id, submission_key\)/i)
  assert.doesNotMatch(migration, /unique \(normalized_email\)/i)
  assert.match(acceptance, /same-client contact links two distinct legitimate enquiries/i)
  assert.match(acceptance, /email identity never dedupes contacts across clients/i)
})

test('trusted tenant, Website, environment and recipients resolve only from server bindings', () => {
  const signature = migration.match(/create or replace function public\.submit_website_enquiry\(([\s\S]*?)\)\s*returns jsonb/i)?.[1] ?? ''
  assert.match(signature, /p_intake_key uuid/i)
  assert.match(signature, /p_schema_key text/i)
  assert.match(signature, /p_submission_key text/i)
  assert.doesNotMatch(signature, /client|website_editor|environment|recipient|delivery_state/i)
  assert.match(migration, /where endpoint\.intake_key = p_intake_key/i)
  assert.match(migration, /from public\.website_enquiry_recipient_routes route/i)
  assert.match(migration, /v_endpoint\.client_id/i)
  assert.match(migration, /v_endpoint\.website_editor_website_id/i)
  assert.match(migration, /v_endpoint\.environment <> 'production'/i)
  assert.match(acceptance, /recipient injection field was accepted/i)
})

test('versioned schemas enforce stable bounded field keys before transaction work', () => {
  assert.match(migration, /unique \(endpoint_id, schema_key, version\)/i)
  assert.match(migration, /Form schema field keys must be unique/i)
  assert.match(migration, /Submission contains unsupported fields/i)
  assert.match(migration, /Required form field is missing/i)
  assert.match(migration, /Activated form schema versions are immutable/i)
  assert.match(acceptance, /duplicate field keys were accepted/i)
})

test('one PostgreSQL function atomically creates enquiry, approved jobs and one event', () => {
  assert.match(migration, /insert into public\.website_enquiries/i)
  assert.match(migration, /insert into public\.website_enquiry_delivery_jobs/i)
  assert.match(migration, /insert into public\.website_enquiry_events/i)
  assert.match(migration, /unique \(enquiry_id, recipient_route_id\)/i)
  assert.match(migration, /unique \(enquiry_id, event_type\)/i)
  assert.match(migration, /event_type text not null check \(event_type = 'generate_lead'\)/i)
  assert.match(migration, /M2A only creates pending jobs/i)
  assert.doesNotMatch(migration, /resend|postmark|sendgrid|ses|smtp/i)
})

test('tenant-scoped idempotency returns the same receipt and conflicts on changed content', () => {
  assert.match(migration, /on conflict \(endpoint_id, submission_key\) do nothing/i)
  assert.match(migration, /v_existing\.canonical_payload <> v_canonical_payload/i)
  assert.match(migration, /Submission key was already used with different content/i)
  assert.match(migration, /'receipt_id', v_existing\.receipt_id/i)
  assert.match(acceptance, /all concurrent callers received the same receipt/i)
  assert.match(acceptance, /concurrent requests create one enquiry/i)
  assert.match(acceptance, /concurrent requests create one event/i)
})

test('browser roles have no base-table or transaction authority', () => {
  for (const table of [
    'website_enquiry_endpoints',
    'website_form_schemas',
    'website_enquiry_recipient_configurations',
    'website_enquiry_recipient_routes',
    'website_enquiry_contacts',
    'website_enquiries',
    'website_enquiry_delivery_jobs',
    'website_enquiry_events',
  ]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated`, 'i'))
  }
  assert.match(migration, /security invoker/i)
  assert.match(migration, /grant execute on function public\.submit_website_enquiry[\s\S]*to service_role/i)
  assert.doesNotMatch(migration, /grant execute on function public\.submit_website_enquiry[\s\S]*to (anon|authenticated)/i)
  assert.match(acceptance, /authenticated browser listed canonical enquiries/i)
  assert.match(acceptance, /anonymous browser called service transaction/i)
})

test('actual PostgreSQL acceptance covers concurrency, rollback and recoverable outbox state', () => {
  for (const connection of ['lead_c1', 'lead_c2', 'lead_c3', 'lead_c4', 'lead_c5', 'lead_c6']) {
    assert.match(acceptance, new RegExp(connection))
  }
  assert.match(acceptance, /injected event failure/i)
  assert.match(acceptance, /failed transaction leaves no enquiry/i)
  assert.match(acceptance, /failed transaction leaves no contact/i)
  assert.match(acceptance, /failed transaction leaves no delivery jobs/i)
  assert.match(acceptance, /same key safely retries after transaction rollback/i)
  assert.match(acceptance, /recoverable pending jobs after caller\/worker crash/i)
})
