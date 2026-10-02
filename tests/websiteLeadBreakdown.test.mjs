// Issue #405: qualified-lead breakdown by landing page / source (Website Performance).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { breakdownKeyLabel, mapWebsiteLeadBreakdown } from '../src/lib/websiteLeads.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const migration = read('../supabase/migrations/20261003010000_website_lead_breakdown.sql')
const card = read('../src/components/website/WebsiteLeadBreakdownCard.tsx')
const db = read('../src/lib/db/websiteLeads.ts')
const panel = read('../src/components/admin/WebsitePerformancePanel.tsx')
const clientPage = read('../src/pages/client/ClientLeadsPage.tsx')
const runner = read('../scripts/website-lead-lifecycle-acceptance.mjs')
const workflow = read('../.github/workflows/website-enquiry-transaction.yml')

const row = (over = {}) => ({ key: '/services/solar', total: 5, qualified: 3, poor: 1, unreviewed: 1, qualificationRate: 0.6, sufficientSample: true, ...over })
const payload = (over = {}) => ({ clientId: 'c', dimension: 'landing_page', state: 'available', minSample: 5, rows: [row()], otherRows: 0, ...over })

test('breakdown mapping is strict: shape, dimension, counts and keys', () => {
  const mapped = mapWebsiteLeadBreakdown(payload({ rows: [row(), row({ key: null, total: 2, qualified: 0, poor: 1, unreviewed: 1, qualificationRate: 0, sufficientSample: false })], otherRows: 3 }), 'landing_page')
  assert.deepEqual(mapped, {
    state: 'available', dimension: 'landing_page', minSample: 5, otherRows: 3,
    rows: [row(), { key: null, total: 2, qualified: 0, poor: 1, unreviewed: 1, qualificationRate: 0, sufficientSample: false }],
  })
  assert.deepEqual(mapWebsiteLeadBreakdown(payload({ state: 'not_connected', rows: [] }), 'landing_page').rows, [])
  for (const [label, bad] of [
    ['wrong dimension', payload({ dimension: 'source' })],
    ['unknown state', payload({ state: 'zero' })],
    ['missing rows', payload({ rows: null })],
    ['non-integer count', payload({ rows: [row({ total: 1.5 })] })],
    ['negative count', payload({ rows: [row({ poor: -1 })] })],
    ['empty row', payload({ rows: [row({ total: 0, qualified: 0, poor: 0, unreviewed: 0 })] })],
    ['parts exceed total', payload({ rows: [row({ qualified: 5 })] })],
    ['blank key', payload({ rows: [row({ key: '  ' })] })],
    ['numeric key', payload({ rows: [row({ key: 7 })] })],
    ['missing sample flag', payload({ rows: [row({ sufficientSample: undefined })] })],
    ['zero minSample', payload({ minSample: 0 })],
  ]) {
    assert.throws(() => mapWebsiteLeadBreakdown(bad, 'landing_page'), Error, label)
  }
  assert.throws(() => mapWebsiteLeadBreakdown(null, 'source'))
})

test('missing attribution is labelled honestly, never invented', () => {
  assert.equal(breakdownKeyLabel('landing_page', null), 'Landing page not recorded')
  assert.equal(breakdownKeyLabel('source', null), 'Source not recorded')
  assert.equal(breakdownKeyLabel('source', 'google'), 'google')
})

test('RPC is aggregate-only, exact-client, production-only and keyed by path/source only', () => {
  assert.match(migration, /security definer/)
  assert.match(migration, /set search_path = ''/)
  assert.match(migration, /public\.website_lead_caller_client\(p_client_id\)/)
  assert.match(migration, /enquiry\.environment = 'production'/)
  assert.match(migration, /p_dimension not in \('landing_page', 'source'\)/)
  assert.match(migration, /c_min_sample constant integer := 5/)
  assert.match(migration, /'sufficientSample', total >= c_min_sample/)
  assert.match(migration, /'otherRows'/)
  // Only attribution keys are read: never the visitor's submitted payload or contact snapshot.
  assert.doesNotMatch(migration, /contact_snapshot|canonical_payload|contact_email|contact_phone|website_enquiry_contacts/)
  assert.match(migration, /revoke all on function public\.website_lead_breakdown\(uuid, date, date, text\) from public, anon;/)
  assert.match(migration, /grant execute on function public\.website_lead_breakdown\(uuid, date, date, text\) to authenticated;/)
})

test('UI degrades to nothing when the RPC is unapplied and is shown to staff and clients', () => {
  assert.match(db, /supabase\.rpc\('website_lead_breakdown'/)
  assert.match(db, /isLeadInboxUnavailableError\(error\)\) return \{ state: 'unavailable' \}/)
  assert.match(db, /Lead breakdown identity mismatch/)
  assert.match(card, /current\?\.state === 'unavailable'/)
  assert.match(card, /low sample/)
  assert.match(panel, /<WebsiteLeadBreakdownCard clientId=\{clientId\}/)
  assert.match(clientPage, /<WebsiteLeadBreakdownCard clientId=\{null\}/)
})

test('PostgreSQL acceptance and CI cover the breakdown', () => {
  assert.match(runner, /20261003010000_website_lead_breakdown\.sql/)
  assert.match(runner, /405_website_lead_breakdown_acceptance\.sql/)
  assert.match(workflow, /website_lead_breakdown\.sql/)
  assert.match(workflow, /tests\/websiteLeadBreakdown\.test\.mjs/)
})
