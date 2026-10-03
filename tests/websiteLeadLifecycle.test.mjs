import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import {
  LEAD_OUTCOMES,
  currentReportingMonth,
  formatQualificationRate,
  leadOutcome,
  lifecycleForOutcome,
  isLeadInboxUnavailableError,
  leadContactActions,
  mapWebsiteLeadRow,
  monthWindow,
  normaliseLeadLifecycle,
  validateLeadLifecycle,
  whatsappNumber,
} from '../src/lib/websiteLeads.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261002090000_website_lead_lifecycle.sql')
const acceptance = read('./sql/405_website_lead_lifecycle_acceptance.sql')
const page = read('../src/pages/client/ClientLeadsPage.tsx')
const metricsCard = read('../src/components/website/WebsiteLeadMetricsCard.tsx')
const db = read('../src/lib/db/websiteLeads.ts')

test('poor leads require a reason and good/unreviewed leads carry none', () => {
  assert.equal(validateLeadLifecycle({ status: 'qualified', quality: 'good', poorReason: null, poorNote: null }), null)
  assert.equal(validateLeadLifecycle({ status: 'new', quality: null, poorReason: null, poorNote: null }), null)
  assert.match(validateLeadLifecycle({ status: 'closed_lost', quality: 'poor', poorReason: null, poorNote: null }), /needs a reason/)
  assert.match(validateLeadLifecycle({ status: 'closed_lost', quality: 'poor', poorReason: 'other', poorNote: '  ' }), /note/)
  assert.equal(validateLeadLifecycle({ status: 'closed_lost', quality: 'poor', poorReason: 'other', poorNote: 'Asked for plumbing' }), null)
  assert.match(validateLeadLifecycle({ status: 'won', quality: 'good', poorReason: 'spam', poorNote: null }), /only apply/)
  assert.match(validateLeadLifecycle({ status: 'archived', quality: null, poorReason: null, poorNote: null }), /status/)
  assert.deepEqual(normaliseLeadLifecycle({ status: 'won', quality: 'good', poorReason: 'spam', poorNote: 'x' }),
    { status: 'won', quality: 'good', poorReason: null, poorNote: null })
})

test('Good maps to Qualified, Poor to Closed-Lost, and contradictions are rejected', () => {
  assert.deepEqual(lifecycleForOutcome('good'), { status: 'qualified', quality: 'good', poorReason: null, poorNote: null })
  assert.deepEqual(lifecycleForOutcome('poor', 'spam'), { status: 'closed_lost', quality: 'poor', poorReason: 'spam', poorNote: null })
  assert.deepEqual(lifecycleForOutcome('won', 'spam', 'x'), { status: 'won', quality: 'good', poorReason: null, poorNote: null })
  for (const outcome of LEAD_OUTCOMES) {
    const value = lifecycleForOutcome(outcome, 'wrong_service')
    assert.equal(leadOutcome(value.status, value.quality), outcome)
  }
  for (const [status, quality] of [['new', 'good'], ['contacted', 'good'], ['new', 'poor'], ['qualified', 'poor'], ['won', 'poor'], ['qualified', null], ['won', null], ['closed_lost', null]]) {
    assert.equal(leadOutcome(status, quality), null, `${status}/${quality}`)
    assert.match(validateLeadLifecycle({ status, quality, poorReason: quality === 'poor' ? 'spam' : null, poorNote: null }), /Good leads are Qualified/)
  }
})

test('current reporting month follows Africa/Johannesburg, not UTC', () => {
  // 31 Oct 22:30 UTC is already 1 Nov 00:30 in Johannesburg.
  assert.equal(currentReportingMonth(new Date('2026-10-31T22:30:00Z')), '2026-11')
  assert.equal(currentReportingMonth(new Date('2026-12-31T22:00:00Z')), '2027-01')
  assert.equal(currentReportingMonth(new Date('2026-10-31T21:59:59Z')), '2026-10')
  for (const file of [page, read('../src/components/admin/WebsitePerformancePanel.tsx')]) {
    assert.doesNotMatch(file, /toISOString\(\)\.slice\(0, 7\)/)
    assert.match(file, /currentReportingMonth\(\)/)
  }
})

test('contact actions come only from stored lead fields', () => {
  assert.deepEqual(leadContactActions({ contactPhone: '082 000 0001', contactEmail: 'visitor@example.test' }), {
    call: 'tel:0820000001', whatsapp: 'https://wa.me/27820000001', email: 'mailto:visitor@example.test',
  })
  assert.equal(leadContactActions({ contactPhone: '+44 20 7946 0000', contactEmail: null }).whatsapp, 'https://wa.me/442079460000')
  assert.deepEqual(leadContactActions({ contactPhone: null, contactEmail: null }), { call: null, whatsapp: null, email: null })
  assert.equal(whatsappNumber('12345'), null)
  assert.equal(whatsappNumber('0044 20 7946 0000'), '442079460000')
  assert.equal(leadContactActions({ contactPhone: null, contactEmail: 'not-an-email' }).email, null)
})

test('row mapping rejects unknown lifecycle values instead of guessing', () => {
  const row = {
    enquiry_id: 'e', receipt_id: 'r', accepted_at: '2026-10-02T08:00:00Z', website_editor_website_id: 'w',
    form_schema_key: 'contact_form', form_schema_version: 1, contact_name: 'A', contact_email: 'a@example.test', contact_phone: null,
    fields: [{ key: 'name', label: 'Name', type: 'text', value: 'A' }], attribution: { utm_source: 'google', bad: 1 },
    status: 'new', quality: null, poor_reason: null, poor_note: null, lifecycle_updated_at: null,
  }
  const lead = mapWebsiteLeadRow(row)
  assert.equal(lead.status, 'new')
  assert.deepEqual(lead.attribution, { utm_source: 'google' })
  assert.throws(() => mapWebsiteLeadRow({ ...row, status: 'archived' }))
  assert.throws(() => mapWebsiteLeadRow({ ...row, quality: 'great' }))
  assert.throws(() => mapWebsiteLeadRow({ ...row, status: 'won', quality: null }))
})

test('metrics formatting and unavailable detection stay truthful', () => {
  assert.equal(formatQualificationRate(null), '—')
  assert.equal(formatQualificationRate(0.3333), '33.3%')
  assert.equal(isLeadInboxUnavailableError({ code: 'PGRST202' }), true)
  assert.equal(isLeadInboxUnavailableError({ code: '42501', message: 'Not authorized' }), false)
  assert.deepEqual(monthWindow('2026-12'), { from: '2026-12-01', to: '2027-01-01' })
  assert.equal(monthWindow('2026-13'), null)
})

test('lifecycle is separate from immutable acquisition evidence', () => {
  assert.match(migration, /create table public\.website_enquiry_lead_states/i)
  assert.match(migration, /references public\.website_enquiries\(id, client_id\)/i)
  assert.doesNotMatch(migration, /alter table public\.website_enquiries\b/i)
  assert.doesNotMatch(migration, /update public\.website_enquiries\b/i)
  assert.doesNotMatch(migration, /insert into public\.(clients|website_enquiry_endpoints|website_enquiries)\b/i)
  assert.match(migration, /check \(\(quality = 'poor'\) = \(poor_reason is not null\)\)/i)
  assert.match(migration, /website_enquiry_lead_states_outcome_check/)
  assert.match(acceptance, /impossible combination accepted/)
  assert.match(acceptance, /table accepted unreviewed Won/)
  assert.match(migration, /website_enquiry_lead_state_events/i)
})

test('every RPC resolves one exact client server-side and excludes synthetic enquiries', () => {
  for (const name of ['website_lead_inbox', 'set_website_lead_lifecycle', 'website_lead_metrics']) {
    const body = migration.match(new RegExp(`function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`, 'i'))?.[0] ?? ''
    assert.match(body, /security definer/i, name)
    assert.match(body, /set search_path = ''/i, name)
    assert.match(body, /website_lead_caller_client/i, name)
    assert.match(body, /environment = 'production'/i, name)
  }
  assert.match(migration, /if v_profile\.role = 'client' then[\s\S]*p_client_id <> v_profile\.client_id/i)
  assert.match(migration, /revoke all on function public\.website_lead_caller_client\(uuid\) from public, anon, authenticated, service_role/i)
  assert.match(migration, /revoke all on table public\.website_enquiry_lead_states from public, anon, authenticated, service_role/i)
  assert.doesNotMatch(migration, /grant [^;]* on table public\.website_enquiry_lead_states to authenticated/i)
})

test('disposable PostgreSQL acceptance covers isolation, rules and PII-free metrics', () => {
  for (const marker of [
    /client A read client B inbox/, /client A mutated client B lead/, /poor lead without reason accepted/,
    /synthetic lead mutated/, /metrics leaked PII/, /audit trail stores PII/, /inactive client user read inbox/,
    /anonymous session read inbox/, /empty period is not truthful/, /'not_connected'/,
  ]) assert.match(acceptance, marker)
})

test('UI is client-pinned, analytics-free and truthful when unavailable or empty', () => {
  assert.match(page, /listWebsiteLeads\(\)/)
  // The client route names no client: <LeadInbox /> defaults clientId to null, so the server
  // pins reads/writes to the signed-in client; only the staff preview passes a clientId.
  assert.match(page, /export default function ClientLeadsPage\(\) \{\s*return <LeadInbox \/>/)
  assert.match(page, /clientId = null/)
  assert.match(page, /WebsiteLeadMetricsCard clientId=\{clientId\}/)
  assert.match(page, /LEAD_OUTCOMES\.map/)
  assert.doesNotMatch(page, /role="radiogroup"/)
  assert.match(page, /not been switched on/)
  assert.match(page, /No website enquiries yet/)
  assert.doesNotMatch(page + metricsCard + db, /gtag|dataLayer|googletagmanager|analytics\.track/i)
  assert.match(metricsCard, /Lead tracking is not activated yet/)
  assert.match(metricsCard, /No website enquiry form is connected/)
  assert.match(db, /metrics\.clientId !== clientId/)
})
