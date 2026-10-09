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
    assert.match(html, /Photo posts/)
    assert.doesNotMatch(html, /Shoot days|Campaign management|Animated posters|>Reels</)
    assert.doesNotMatch(html, /Content planning|To confirm/)
    assert.doesNotMatch(html, /PRIVATE|Included|Not included/)
    assert.match(html, /href="https:\/\/wa\.me\/27791152339"/)
    assert.match(html, /href="tel:\+27791152339"/)
    assert.match(html, /<summary[^>]*>Amend package/)
    assert.equal(JSON.stringify(confirmed), before)
    for (const raw of [null, {}, values, { ...confirmed, reels_per_month: 0 }]) {
      const unavailable = render(raw)
      assert.doesNotMatch(unavailable, /To confirm|per month|Included/)
      assert.doesNotMatch(unavailable, /per month<\/dd>/)
    }
    for (const value of [true, false]) {
      const next = { ...values, campaign_management_included: value }
      const row = { ...confirmed, ...next, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(next) } }
      assert.doesNotMatch(render(row), /Campaign management|>Included<\/dd>|>Not included<\/dd>/)
    }
    for (const [photo, design, expected] of [
      [null, null, null], [null, 12, '12 confirmed per month'],
      [4, null, '4 per month'], [0, 0, null], [4, 3, '7 per month'],
    ]) {
      const next = { ...values, photo_posts_per_month: photo, design_posters_per_month: design }
      const row = { ...confirmed, ...next, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(next) } }
      const rendered = render(row)
      assert.equal(rendered.includes('Posters</dt>') || rendered.includes('Photo posts</dt>') || rendered.includes('Design posters</dt>'), expected !== null)
      if (expected) assert.ok(rendered.includes(expected))
      assert.doesNotMatch(rendered, /To confirm/)
    }
    const designOnly = { ...values, photo_posts_per_month: null, design_posters_per_month: 8 }
    const designOnlyRow = { ...confirmed, ...designOnly, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(designOnly) } }
    const designOnlyHtml = render(designOnlyRow)
    assert.match(designOnlyHtml, /Posters<\/dt>[\s\S]*8 confirmed per month/)
    assert.doesNotMatch(designOnlyHtml, /Design posters|9 per month|To confirm/)
    const onceOff = { ...values, professional_videos_per_month: null, photo_posts_per_month: null, design_posters_per_month: null, other_agreed_deliverables: 'Once-off' }
    const onceOffRow = { ...confirmed, ...onceOff, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(onceOff) } }
    assert.match(render(onceOffRow), /Engagement<\/dt>[\s\S]*Once-off<\/dd>/)
    assert.doesNotMatch(render(onceOff), /Engagement|Once-off/)
    const privateText = { ...onceOff, other_agreed_deliverables: 'Private service details' }
    const privateRow = { ...confirmed, ...privateText, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(privateText) } }
    assert.doesNotMatch(render(privateRow), /Private service details|Engagement/)
    const renderFor = clientId => renderToStaticMarkup(createElement(ClientPackageSummary, { packageSettings: confirmed, clientId }))
    for (const id of ['ed7aa1ae-de21-4151-a8f9-54796b234c1f', 'd53d8e62-9e6a-4bb9-be3f-554f40942d45',
      'cdb11a82-339e-4b46-9b09-bde1a23efeaf', 'fd16ebae-a50b-4920-afe0-94c2631f8f06',
      'aece5a86-c962-4234-a1fe-7904c20f03ff']) {
      assert.doesNotMatch(renderFor(id), /Website maintenance|Website updates|>Included<\/dd>/)
      assert.doesNotMatch(renderFor(id), /updates per month|clientId|canonicalHost/)
    }
    for (const id of [undefined, 'Piek Group', '3404f726-a693-4b2d-8c13-c9d3dfd17bbc']) {
      assert.doesNotMatch(renderFor(id), /Website maintenance/)
    }
    const { cgManagedWebsiteForClient } = await server.ssrLoadModule('/src/lib/cgWebsiteFleet.ts')
    assert.equal(cgManagedWebsiteForClient('aece5a86-c962-4234-a1fe-7904c20f03ff'), null, 'maintenance does not activate reporting')
    const unverifiedWebsite = renderToStaticMarkup(createElement(ClientPackageSummary, { packageSettings: {}, clientId: 'aece5a86-c962-4234-a1fe-7904c20f03ff' }))
    assert.doesNotMatch(unverifiedWebsite, /Website maintenance|Website updates|Included|To confirm/)
    assert.doesNotMatch(unverifiedWebsite, /per month/)
    const zeroUpdates = { ...values, website_updates_per_month: 0, professional_videos_per_month: 0 }
    const zeroRow = { ...confirmed, ...zeroUpdates, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(zeroUpdates) } }
    const zeroHtml = renderToStaticMarkup(createElement(ClientPackageSummary, { packageSettings: zeroRow, clientId: 'ed7aa1ae-de21-4151-a8f9-54796b234c1f' }))
    assert.doesNotMatch(zeroHtml, /Website updates|Professional videos|0 per month/)
    const websiteValues = { ...values, website_updates_per_month: 2 }
    const websiteRow = { ...confirmed, ...websiteValues, verification: { ...confirmed.verification, field_states: buildPackageFieldStates(websiteValues) } }
    assert.match(renderToStaticMarkup(createElement(ClientPackageSummary, { packageSettings: websiteRow })), /Website updates[\s\S]*2 per month/)
  } finally { await server.close() }
})

test('package presentation reuses the scoped client context and never adds a client selector or write path', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const plan = read('../src/pages/client/ClientPlanPage.tsx')
  assert.match(plan, /useClientPortal\(\)/)
  assert.match(plan, /packageSettings=\{client\?\.package_settings\}/)
  assert.match(plan, /\{ key: 'package', label: 'Your package' \}/)
  assert.ok(plan.indexOf('aria-label="Plan sections"') < plan.indexOf('role="tabpanel"'))
  const component = read('../src/components/client/ClientPackageSummary.tsx')
  assert.match(component, /readPackageAuthority\(packageSettings\)/)
  assert.doesNotMatch(component, /\.from\(|\.rpc\(|source_references|confirmed_by_profile_id|evidence_note|package_notes|package_exclusions/)
})
