import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const edge = readFileSync(new URL('../supabase/functions/website-performance-report/index.ts', import.meta.url), 'utf8')
const browser = readFileSync(new URL('../src/lib/websitePerformance.ts', import.meta.url), 'utf8')

test('website reporting is a server-only, exact-client bridge', () => {
  assert.match(edge, /supabase\.auth\.getUser\(bearer\)/)
  assert.match(edge, /\.from\('profiles'\).*\.select\('role'\)/)
  assert.match(edge, /\.from\('clients'\).*\.eq\('id', input\.clientId\)/)
  assert.match(edge, /Object\.values\(mappings\).*\.length !== 1/)
  assert.match(edge, /report\.websiteId !== websiteId/)
  assert.match(edge, /endpoint\.protocol !== 'https:'/)
  assert.doesNotMatch(browser, /api\.vercel\.com|WEBSITE_BUILDER_REPORTING_TOKEN|SERVICE_ROLE/)
  assert.match(browser, /supabase\.functions\.invoke\('website-performance-report'/)
})
