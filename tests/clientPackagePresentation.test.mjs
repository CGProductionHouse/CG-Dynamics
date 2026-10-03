import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

test('client package renders confirmed capacity while preserving unknown/zero and hiding private receipts', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' }, optimizeDeps: { noDiscovery: true } })
  try {
    const { ClientPackageSummary } = await server.ssrLoadModule('/src/components/client/ClientPackageSummary.tsx')
    const { buildPackageFieldStates } = await server.ssrLoadModule('/src/lib/packageAuthority.ts')
    const values = {
      professional_videos_per_month: 1, reels_per_month: null, photo_posts_per_month: 4,
      design_posters_per_month: 0, animated_posters_per_month: null,
      campaign_management_included: null, monthly_campaign_budget: null,
      shoot_days_per_month: null, website_updates_per_month: null,
      other_agreed_deliverables: null, package_notes: 'PRIVATE STAFF NOTE', package_exclusions: null,
    }
    const confirmed = { ...values, verification: {
      status: 'confirmed', version: 2, confirmed_at: '2026-10-03T12:00:00Z',
      confirmed_by_profile_id: 'PRIVATE ACTOR ID', evidence_note: 'PRIVATE CONTRACT RECEIPT',
      inference_note: 'PRIVATE INFERENCE NOTE', source_references: ['PRIVATE SOURCE URL'],
      field_states: buildPackageFieldStates(values),
    } }
    const before = JSON.stringify(confirmed)
    const render = raw => renderToStaticMarkup(createElement(ClientPackageSummary, { packageSettings: raw }))
    const html = render(confirmed)
    assert.match(html, /1 per month/)
    assert.match(html, /4 per month/)
    assert.match(html, /0 per month/)
    assert.match(html, /To confirm/)
    assert.doesNotMatch(html, /PRIVATE|Included|Not included/)
    assert.match(html, /actual planned work/)
    assert.equal(JSON.stringify(confirmed), before)
    for (const raw of [null, {}, values, { ...confirmed, reels_per_month: 0 }]) {
      const unavailable = render(raw)
      assert.match(unavailable, /No quantities are assumed/)
      assert.doesNotMatch(unavailable, /per month<\/dd>/)
    }
    for (const value of [true, false]) {
      const next = { ...values, campaign_management_included: value }
      const row = { ...confirmed, ...next, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(next) } }
      assert.match(render(row), value ? />Included<\/dd>/ : />Not included<\/dd>/)
    }
  } finally { await server.close() }
})

test('package presentation reuses the scoped client context and never adds a client selector or write path', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const plan = read('../src/pages/client/ClientPlanPage.tsx')
  assert.match(plan, /useClientPortal\(\)/)
  assert.match(plan, /packageSettings=\{client\?\.package_settings\}/)
  const component = read('../src/components/client/ClientPackageSummary.tsx')
  assert.match(component, /readPackageAuthority\(packageSettings\)/)
  assert.doesNotMatch(component, /\.from\(|\.rpc\(|source_references|confirmed_by_profile_id|evidence_note|package_notes|package_exclusions/)
})
