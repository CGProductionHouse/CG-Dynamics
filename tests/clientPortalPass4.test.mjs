import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const states = read('../src/components/client/ClientPortalStates.tsx')
const layout = read('../src/components/client/ClientPortalLayout.tsx')
const home = read('../src/pages/client/ClientPortalHome.tsx')
const performance = read('../src/pages/client/Dashboard.tsx')
const calendar = read('../src/pages/client/ClientContentCalendarPage.tsx')
const guides = read('../src/pages/client/ClientContentGuidesPage.tsx')
const approvals = read('../src/pages/admin/ContentReviewsPage.tsx')
const brandHub = read('../src/features/client-onboarding/ClientSetupPage.tsx')

test('all client routes share stable, accessible loading and failure states', () => {
  for (const source of [home, performance, calendar, guides, approvals, brandHub]) {
    assert.match(source, /ClientPortalLoadingState/)
    assert.match(source, /ClientPortalErrorState/)
  }
  assert.match(states, /min-h-\[22rem\]/)
  assert.match(states, /delayMs = 180/)
  assert.match(states, /aria-live="polite"/)
  assert.match(states, /motion-reduce:animate-none/)
})

test('the persistent shell preloads route chunks without mounting a second shell', () => {
  assert.match(layout, /requestIdleCallback/)
  assert.match(layout, /import\('\.\.\/\.\.\/pages\/client\/ClientPortalHome'\)/)
  assert.match(layout, /import\('\.\.\/\.\.\/pages\/client\/ClientPlanPage'\)/)
  assert.match(layout, /import\('\.\.\/\.\.\/pages\/admin\/ContentReviewsPage'\)/)
  assert.match(layout, /<Suspense fallback=\{<ClientPortalContentLoading \/>\}>/)
})

test('client approvals stay on the canonical review queue and real decision actions', () => {
  assert.match(approvals, /supabase\.rpc\('client_content_review_queue'\)/)
  assert.match(approvals, /ContentReviewCard/)
  assert.match(approvals, /review\.state === 'client_review'/)
  assert.doesNotMatch(approvals, /monthly_deliverables.*(?:insert|update|upsert)/s)
})

test('Brand Hub uses the dedicated client-safe library projection and keeps onboarding context optional', () => {
  assert.match(brandHub, /loadClientPortalLibrary\(\)/)
  assert.match(brandHub, /loadPortalSetup\(\)/)
  assert.match(brandHub, /<ClientPortalLibrary library=\{library\} \/>/)
  assert.doesNotMatch(brandHub.slice(brandHub.indexOf('function ClientBrandHub')), /BrandAssetLibrary/)
  assert.doesNotMatch(brandHub, /drive_item_id|drive_path|sharepoint|onedrive/i)
})
