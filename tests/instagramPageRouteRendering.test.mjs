import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

let server
let Queue
before(async () => {
  server = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true, hmr: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } })
  ;({ InstagramConnectionQueue: Queue } = await server.ssrLoadModule('/src/components/integrations/InstagramConnectionQueue.tsx'))
})
after(async () => { await server?.close() })

const fields = ['professional_videos_per_month', 'reels_per_month', 'photo_posts_per_month', 'design_posters_per_month', 'animated_posters_per_month', 'campaign_management_included', 'monthly_campaign_budget', 'shoot_days_per_month', 'website_updates_per_month', 'other_agreed_deliverables', 'package_notes', 'package_exclusions']
const packageSettings = {
  ...Object.fromEntries(fields.map(field => [field, field === 'design_posters_per_month' ? 4 : null])),
  verification: { status: 'confirmed', version: 2, confirmed_at: '2026-10-02T00:00:00Z', confirmed_by_profile_id: 'fixture-admin', evidence_note: 'Synthetic exact package fixture.', inference_note: '', source_references: ['fixture'], field_states: Object.fromEntries(fields.map(field => [field, field === 'design_posters_per_month' ? 'known' : 'unknown'])) },
}
const props = {
  clients: [{ id: 'fixture-client', name: 'Red Oak', active: true, package_settings: packageSettings }],
  linkedAssets: [{ client_id: 'fixture-client', facebook_page_id: 'exact-page', instagram_account_id: null, instagram_not_applicable: false }],
  providerPages: [], providerAssetsLoaded: true, providerPagesAvailable: true,
  onLoadProviderAssets() {}, async onCanonicalMappingChanged() {},
}
const render = overrides => renderToStaticMarkup(React.createElement(Queue, { ...props, ...overrides }))

test('rendered missing saved Page is unresolved with a disabled standalone control', () => {
  const html = render({})
  assert.match(html, /Page route unresolved/)
  assert.match(html, /saved Facebook Page was not returned/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Check Page route first<\/button>/)
  assert.doesNotMatch(html, /Standalone candidate|did not expose|Connect exact Instagram account/)
})

test('rendered provider failure cannot offer standalone even when a Page row exists', () => {
  const html = render({ providerPagesAvailable: false, providerPages: [{ id: 'exact-page', instagramAccount: null }] })
  assert.match(html, /Page-linked discovery is unavailable/)
  assert.match(html, /<button[^>]*disabled=""[^>]*>Check Page route first<\/button>/)
})

test('rendered exact linked Page stays Page-first and never borrows another client account', () => {
  const html = render({ providerPages: [{ id: 'other-page', instagramAccount: { id: 'other-ig', username: 'wrong_client' } }, { id: 'exact-page', instagramAccount: { id: 'exact-ig', username: 'official.redoak' } }] })
  assert.match(html, /Page-linked available/)
  assert.match(html, /official\.redoak/)
  assert.doesNotMatch(html, /wrong_client|Connect exact Instagram account/)
})
