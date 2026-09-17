import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const SHARED = read('../supabase/functions/_shared/google-ads-tracking-contract.ts')
const APP = read('../src/lib/googleAdsTrackingContract.ts')
const LOADER = read('../src/lib/trackingSetupHealth.ts')
const PANEL = read('../src/components/admin/TrackingSetupHealth.tsx')
const PAGE = read('../src/pages/admin/GoogleAdsIntegrationPage.tsx')

test('tracking contract app and Deno copies do not drift', () => {
  const stripHeader = s => s.split('\n').slice(1).join('\n')
  assert.equal(stripHeader(APP), stripHeader(SHARED), 'src/lib and _shared tracking contract must match')
})

// ── the health surface is read-only ─────────────────────────────────────────

test('the loader performs no write and no Google provider call', () => {
  for (const forbidden of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.upsert\(/, /fetch\(/]) {
    assert.doesNotMatch(LOADER, forbidden, `unexpected side effect: ${forbidden}`)
  }
  assert.match(LOADER, /performs no provider call/i)
})

test('the panel offers no control that could change a Google setting', () => {
  assert.doesNotMatch(PANEL, /<button/i, 'a read-only panel must not offer actions')
  assert.doesNotMatch(PANEL, /onClick/i)
  assert.match(PANEL, /Nothing on this panel changes a Google Ads or Analytics setting/)
})

// ── honest degradation before the gated migration is applied ────────────────

test('a missing mapping table degrades to "not deployed yet" rather than misreporting the client', () => {
  assert.match(LOADER, /PGRST205/)
  assert.match(LOADER, /mapping tables are not deployed yet/i)
  assert.match(LOADER, /mappingSchemaAvailable: false/)
})

test('auto-tagging and the final URL suffix are reported unread, never assumed configured', () => {
  assert.match(LOADER, /autoTaggingEnabled: null/)
  assert.match(LOADER, /finalUrlSuffix: null/)
  assert.match(PANEL, /Not read \(requires a Google Ads API call\)/)
})

test('the panel names the exact gated changes rather than performing them', () => {
  assert.match(PANEL, /requiredGatedChanges/)
  assert.match(PANEL, /Requires CA approval/)
})

// ── wired into the existing Google Ads admin surface ────────────────────────

test('the panel is rendered on the existing Google Ads integration page, not a new area', () => {
  assert.match(PAGE, /<TrackingSetupHealthPanel health=\{targetClientId \? setupHealth : null\} \/>/)
  assert.match(PAGE, /loadTrackingSetupHealth\(targetClientId\)/)
})

test('health is loaded per exact selected client and never shown for a different one', () => {
  assert.match(PAGE, /if \(targetClientId\) \{/, 'only loads for a selected client')
  assert.match(PAGE, /\}, \[targetClientId\]\)/, 'reloads when the selected client changes')
  // Derived rather than reset in the effect, so a cleared selection cannot leave stale health on
  // screen and no state is set synchronously during render.
  assert.match(PAGE, /health=\{targetClientId \? setupHealth : null\}/)
})
