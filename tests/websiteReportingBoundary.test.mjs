import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const edge = readFileSync(new URL('../supabase/functions/website-performance-report/index.ts', import.meta.url), 'utf8')
const browser = readFileSync(new URL('../src/lib/websitePerformance.ts', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260918140000_website_report_snapshots.sql', import.meta.url), 'utf8')
const clientReport = readFileSync(new URL('../src/pages/client/ClientReportView.tsx', import.meta.url), 'utf8')

test('website reporting is a server-only, exact-client bridge', () => {
  assert.match(edge, /Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'/)
  assert.match(edge, /supabase\.auth\.getUser\(bearer\)/)
  assert.match(edge, /\.from\('profiles'\).*\.select\('role'\)/)
  assert.match(edge, /\.from\('clients'\).*\.eq\('id', input\.clientId\)/)
  assert.match(edge, /Object\.values\(mappings\).*\.length !== 1/)
  assert.match(edge, /report\.websiteId !== websiteId/)
  assert.match(edge, /report\.identity\?\.dynamicsClientId !== input\.clientId/)
  assert.match(edge, /endpoint\.searchParams\.set\('clientId', input\.clientId\)/)
  assert.match(edge, /endpoint\.protocol !== 'https:'/)
  assert.doesNotMatch(browser, /api\.vercel\.com|WEBSITE_BUILDER_REPORTING_TOKEN|SERVICE_ROLE/)
  assert.match(browser, /supabase\.functions\.invoke\('website-performance-report'/)
})

test('truthful reporting states never turn unavailable data into zero', () => {
  assert.match(edge, /state: 'not_connected', report: null/)
  assert.match(edge, /state: 'permission_required', report: null/)
  assert.match(edge, /state: 'unavailable', report: null/)
  assert.match(browser, /'not_connected'.*'not_tracked'.*'collecting'.*'partial'.*'available'.*'permission_required'.*'provider_error'/s)
})

test('website snapshots reuse the existing draft-review-publish path and stay exact-client', () => {
  assert.match(migration, /create table if not exists public\.website_report_snapshots/)
  assert.match(migration, /unique \(report_id, revision\)/)
  assert.match(migration, /Website report snapshots are immutable; create a new revision/)
  assert.match(migration, /force row level security/)
  assert.match(migration, /p_snapshot #>> '\{identity,dynamicsClientId\}' <> p_client_id::text/)
  assert.match(migration, /p_snapshot #>> '\{identity,environment\}' <> 'production'/)
  assert.match(migration, /v_report\.status = 'published'/)
  assert.match(migration, /Published report cannot receive an unreviewed snapshot/)
  assert.match(migration, /v_state not in \('available', 'partial'\)/)
  assert.match(migration, /report\.client_id = public\.my_client_id\(\)/)
  assert.match(migration, /public\.client_safe_website_report\(snapshot\.snapshot\)/)
  assert.doesNotMatch(migration, /grant .*website_report_snapshots.*authenticated/i)
})

test('the client website tab renders only the published report snapshot', () => {
  assert.match(clientReport, /PublishedWebsitePerformance report=\{report\.website_report \?\? null\}/)
  assert.match(clientReport, /No approved website snapshot was published/)
  assert.match(clientReport, /Nothing is being reported as zero|No figures are inferred or shown as zero/)
})
